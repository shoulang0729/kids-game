const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '../..');
const games = JSON.parse(fs.readFileSync(path.join(root, 'data/games.json'), 'utf8'));
const entries = [{ id: 'home', url: 'index.html' }, { id: 'manual', url: 'wiki/index.html' }, { id: 'ranking', url: 'ranking/index.html' }, { id: 'arcade-lobby', url: 'games/kochan-3d-arcade/lobby.html' }, ...games.map(g => ({ ...g, url: `games/${g.id}/index.html` }))];
const targets = process.env.BROWSER_GAME ? entries.filter(g => g.id === process.env.BROWSER_GAME) : entries;
if (!targets.length) throw Error('Unknown BROWSER_GAME: ' + process.env.BROWSER_GAME);
const results = path.join(root, 'test-results');
fs.mkdirSync(results, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/kids-game/')) { res.writeHead(404).end(); return; }
  const filename = path.resolve(root, decodeURIComponent(url.pathname.slice('/kids-game/'.length)) || 'index.html');
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
  res.end(fs.readFileSync(filename));
});

// Test user-observable transitions first; state assertions check that actions really
// change the game, instead of merely hiding a start screen.
const scenarios = {
  async ranking(p) {
    const base = new URL('../', p.url()).href;
    await p.waitForFunction(() => document.querySelector('#name-dialog').open);
    assert.ok(await p.locator('#ranking-content').isHidden());
    assert.ok(await p.locator('#save').isDisabled());
    assert.ok(await p.locator('#close-profile').isHidden());
    await p.keyboard.press('Escape');
    assert.ok(await p.locator('#name-dialog').isVisible());
    await p.fill('#name','   ');
    assert.ok(await p.locator('#save').isDisabled());
    // Anonymous results still survive play/navigation before name registration.
    await p.goto(base+'games/planet-smash/index.html');
    await p.evaluate(() => damagePlanet(planet.hp,350,200));
    await p.goto(base+'ranking/index.html?game=planet-smash');
    await p.waitForFunction(() => document.querySelector('#name-dialog').open);
    assert.equal(await p.evaluate(() => GameRecords.profile().pending),1);
    assert.ok(await p.locator('#ranking-content').isHidden());
    await p.fill('#name','テスト');
    await p.click('#save');
    await p.waitForFunction(() => !document.querySelector('#name-dialog').open);
    await p.waitForFunction(() => document.querySelector('#own').textContent.includes('1個'));
    const originalCode=await p.evaluate(() => GameRecords.profile().code);
    assert.equal(await p.locator('#change-name').innerText(),'名前を変更する');
    assert.equal(await p.locator('#own-rank').count(),0);
    assert.equal(await p.locator('#next-goal').count(),0);
    assert.ok(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#metric')).fontSize)>=22));
    assert.equal(await p.locator('#play-link').innerText(),'これを遊ぶ');
    assert.equal(await p.evaluate(() => document.querySelector('#ranking-content').lastElementChild.id),'play-link');
    assert.ok(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#play-link')).fontSize)>=24));
    assert.equal(await p.locator('#rows tr.is-you').count(),1);
    await p.click('#change-name');
    assert.equal(await p.locator('#name').inputValue(),'テスト');
    await p.fill('#name','テスト2');
    await p.click('#save');
    await p.waitForFunction(() => document.querySelector('#profile-feedback').textContent.includes('送信が完了'));
    assert.equal(await p.evaluate(() => GameRecords.profile().code),originalCode,'renaming preserves record identity');
    await p.click('#change-name');
    await p.locator('summary').click();
    await p.click('#show-code');
    const code=await p.locator('#code').innerText();assert.equal(code,originalCode);
    await p.click('#hide-code');assert.ok(await p.locator('#code-panel').isHidden());
    await p.click('#show-code');assert.equal(await p.locator('#code').innerText(),code);
    await p.keyboard.press('Escape');
    assert.ok(await p.locator('#name-dialog').isHidden());
    await p.reload();assert.ok(await p.locator('#name-dialog').isHidden(),'registered player skips the prompt');
    await p.goto(base+'games/tap-circle/index.html');
    p.context().rankingsWritable=false;
    await p.clock.install();await p.click('#start');
    await p.locator('#target').dispatchEvent('pointerdown',{pointerId:1});
    await p.clock.fastForward(20100);
    await p.evaluate(() => GameRecords.flush().catch(()=>{}));
    await p.goto(base+'ranking/index.html?game=tap-circle');
    await p.click('#retry');
    await p.waitForFunction(() => document.querySelector('#profile-feedback').textContent.includes('送れませんでした'));
    p.context().rankingsWritable=true;
    await p.click('#retry');
    await p.waitForFunction(() => document.querySelector('#own').textContent.includes('1点'));
    assert.match(await p.locator('#rows').innerText(),/テスト2/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
    const second=await p.context().browser().newContext();
    try {
      await mockRankings(second,p.context().rankingStore);
      const device=await second.newPage();
      await device.goto(base+'ranking/index.html?game=tap-circle');
      assert.ok(await device.locator('#name-dialog').isVisible());
      await device.fill('#name','別の端末');
      await device.locator('details').evaluate(e=>{e.open=true});
      await device.fill('#import-code','bad');await device.click('#import');
      await device.waitForFunction(()=>document.querySelector('#status').textContent.includes('64文字'));
      assert.ok(await device.locator('#ranking-content').isHidden());
      await device.fill('#import-code',code);await device.click('#import');
      await device.waitForFunction(()=>document.querySelector('#own').textContent.includes('1点'));
      assert.ok(await device.locator('#name-dialog').isHidden());
      assert.equal(await device.locator('#rows tr.is-you').count(),1);
    } finally {await second.close();}
    for(const g of games.filter(g=>g.id!=='online-demo')) {
      await p.goto(base+`ranking/index.html?game=${g.id}`);
      await p.waitForFunction(()=>document.querySelector('#board-panel').getAttribute('aria-busy')==='false');
      assert.equal(await p.locator('#page-title').innerText(),`${g.emoji} ${g.title}のランキング`);
      assert.ok(await p.locator('#name-dialog').isHidden());
      assert.equal(await p.locator('#play-link').getAttribute('href'),`../games/${g.id}/${g.entry||'index.html'}`);
    }
    await p.goto(base+'ranking/index.html?game=online-demo');
    await p.waitForFunction(()=>document.querySelector('#page-title').textContent==='ゲームが見つかりません');
    assert.ok(await p.locator('#board-panel').isHidden());
    await p.goto(base+'ranking/index.html?game=base-defense');
    await p.waitForFunction(()=>document.querySelector('#board-status').textContent.includes('参加者がいません'));
    await p.selectOption('#game-choice','chaos-ultra-x');
    await p.waitForURL('**/ranking/index.html?game=chaos-ultra-x');
    await p.selectOption('#metric','wave');
    await p.waitForFunction(()=>document.querySelector('#score-heading').textContent==='最高到達WAVE');
    await p.waitForFunction(()=>document.querySelector('#board-panel').getAttribute('aria-busy')==='false');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mockRankings(p.context(),p.context().rankingStore,'http://localhost:8787');
    const requests=[],collect=r=>{if(r.url().includes('/rankings/'))requests.push({url:r.url(),method:r.method()})};
    p.on('request',collect);
    await p.goto(base+'ranking/index.html?game=snake&server=localhost:8787');
    await p.evaluate(()=>GameRecords.record('snake',{score:60}));
    await p.click('#change-name');await p.fill('#name','ローカル');await p.click('#save');
    await p.waitForFunction(()=>document.querySelector('#profile-feedback').textContent.includes('送信が完了'));
    await p.waitForFunction(()=>document.querySelector('#own').textContent.includes('60点'));
    assert.equal(new URL(await p.locator('#play-link').getAttribute('href'),p.url()).searchParams.get('server'),'localhost:8787');
    assert.ok(requests.some(r=>r.method==='POST'));
    assert.ok(requests.every(r=>r.url.startsWith('http://localhost:8787/')));
    p.off('request',collect);
    await p.goto(base+'ranking/index.html?return=snake&server=example.com');
    await p.waitForFunction(()=>!document.querySelector('#play-link').hidden);
    assert.equal(await p.locator('#play-link').getAttribute('href'),'../games/snake/index.html');
  },
  async 'tap-circle'(p) {
    await p.clock.install();
    await p.click('#start');
    await p.locator('#target').dispatchEvent('pointerdown', { pointerId: 1 });
    assert.equal(await p.locator('#score').innerText(), '1');
    await p.clock.fastForward(20100);
    assert.equal(await p.locator('#time').innerText(), '0');
    assert.equal(await p.evaluate(() => localStorage.getItem('tapBest')), '1');
    await p.reload();
    assert.match(await p.locator('#best').innerText(), /1点/);
    await p.click('#start');
    assert.equal(await p.locator('#score').innerText(), '0');
  },
  async snake(p) {
    // Expose the shipped module's model only in this browser test, so a level-up
    // can be reached deterministically without a production debug interface.
    await p.route('**/games/snake/game.js', route => route.fulfill({
      contentType: 'text/javascript',
      body: fs.readFileSync(path.join(root, 'games/snake/game.js'), 'utf8') + '\nglobalThis.__snakeTest = model;',
    }));
    await p.addInitScript(() => { Math.random = () => 0.5; });
    await p.reload();
    await p.clock.install();
    await p.click('#startBtn');
    assert.equal(await p.locator('#overlay').isVisible(), false);
    await p.keyboard.press('ArrowUp');
    await p.clock.runFor(3000);
    assert.ok(await p.locator('#overlay').isVisible());
    await p.click('#startBtn');
    assert.equal(await p.locator('#overlay').isVisible(), false);
    assert.match(await p.locator('#score').innerText(), /0$/);
    const before = await p.locator('#cv').boundingBox();
    await p.evaluate(() => {
      const s = __snakeTest.state;
      s.score = 40;
      s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    });
    await p.clock.runFor(200);
    assert.equal(await p.locator('#level').innerText(), '2');
    assert.match(await p.locator('#levelNotice').innerText(), /レベルアップ/);
    assert.ok(await p.locator('#overlay').isHidden());
    assert.deepEqual(await p.locator('#cv').boundingBox(), before, 'notice must not shift the board');
    const notice = await p.locator('#levelNotice').boundingBox();
    assert.ok(notice.y + notice.height <= before.y, 'notice stays outside the board');
    const head = await p.evaluate(() => ({ ...__snakeTest.state.snake[0] }));
    await p.clock.runFor(300);
    assert.notDeepEqual(await p.evaluate(() => __snakeTest.state.snake[0]), head, 'movement continues visibly');
    await p.screenshot({path:path.join(results, `snake-level-${p.viewportSize().width}.png`), fullPage:true});
    await p.keyboard.press('ArrowUp');
    await p.clock.runFor(700);
    assert.equal(await p.locator('#levelNotice').innerText(), '');
    assert.ok(await p.locator('#overlay').isHidden());
    // Ending a round during a second notice must retain the game-over display.
    await p.evaluate(() => {
      const s = __snakeTest.state;
      s.score = 90;
      s.food = { x: s.snake[0].x, y: s.snake[0].y - 1 };
    });
    await p.clock.runFor(200);
    assert.match(await p.locator('#levelNotice').innerText(), /レベルアップ/);
    await p.evaluate(() => {
      const s = __snakeTest.state;
      s.snake = [{x:s.grid-1,y:5}];
      s.dir = s.nextDir = {x:1,y:0};
    });
    await p.clock.runFor(200);
    assert.ok(await p.locator('#overlay').isVisible());
    assert.match(await p.locator('#ovTitle').innerText(), /おわり/);
    assert.equal(await p.locator('#levelNotice').innerText(), '');
    await p.clock.runFor(1000);
    assert.ok(await p.locator('#overlay').isVisible());
    await p.click('#startBtn');
    assert.equal(await p.locator('#levelNotice').innerText(), '');
    assert.ok(await p.locator('#overlay').isHidden());
    const viewport = p.viewportSize();
    for (const height of [320, 250]) {
      await p.setViewportSize({width:568, height});
      assert.ok((await p.locator('#cv').boundingBox()).width >= 224, 'short landscape board stays playable');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await p.locator('body').evaluate(e=>getComputedStyle(e).touchAction), 'pan-y');
      assert.equal(await p.locator('#cv').evaluate(e=>getComputedStyle(e).touchAction), 'none');
      const link = p.locator('.game-page-links .game-ranking');
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      assert.ok(box.y >= 0 && box.y+box.height <= height);
      await p.screenshot({path:path.join(results,`snake-landscape-${height}.png`),fullPage:true});
    }
    await p.setViewportSize(viewport);
  },
  async 'base-defense'(p) {
    const before = await p.evaluate(() => money);
    // A buildable square next to the core: buying and deducting resources must work.
    await p.locator('.tile.buildable').first().click();
    assert.ok(await p.evaluate(() => towers.length === 1));
    assert.equal(await p.evaluate(() => money), before - 50);
    // Check the complete board, not only document overflow: the border-box
    // regression clipped the rightmost tile in every row inside overflow:hidden.
    const viewport = p.viewportSize();
    for (const [width,height] of [[768,1024],[1024,768],[820,1180],[1180,820],[1024,1366],[1366,1024]]) {
      await p.setViewportSize({width,height});
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await p.locator('#stage').scrollIntoViewIfNeeded();
      const bounds = await p.evaluate(() => {
        const board = document.getElementById('game'), stage = document.getElementById('stage');
        const rect = board.getBoundingClientRect(), container = stage.getBoundingClientRect();
        const scale = rect.width / board.offsetWidth;
        const border = parseFloat(getComputedStyle(board).borderRightWidth) * scale;
        const clipped = [...board.querySelectorAll('.tile')].filter(tile => {
          const t = tile.getBoundingClientRect();
          return t.right > rect.right-border+.5 || t.bottom > rect.bottom-border+.5;
        }).length;
        return {world:[board.clientWidth,board.clientHeight],clipped,x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height,stageWidth:container.width,stageHeight:container.height,scroll:document.documentElement.scrollWidth};
      });
      assert.deepEqual(bounds.world,[900,600], 'the world size excludes the frame');
      assert.equal(bounds.clipped,0, 'all 20 columns and 13 rows must be visible');
      assert.ok(bounds.x>=-.5 && bounds.right<=width+.5 && bounds.y>=-.5 && bounds.bottom<=height+.5);
      assert.ok(bounds.width<=bounds.stageWidth+.5 && bounds.height<=bounds.stageHeight+.5);
      assert.ok(bounds.scroll<=width);
    }
    // A real click after rotating still builds at the visible square.
    const moneyBefore = await p.evaluate(() => money), towersBefore = await p.evaluate(() => towers.length);
    await p.locator('.tile.buildable').last().click();
    assert.equal(await p.evaluate(() => towers.length), towersBefore+1);
    assert.equal(await p.evaluate(() => money), moneyBefore-50);
    await p.setViewportSize(viewport);
    await p.locator('button[onclick="start()"]').click();
    assert.ok(await p.evaluate(() => running));
  },
  async cooking(p) {
    await p.clock.install();
    p.on('dialog', dialog => dialog.accept());
    const start = p.locator('button[onclick="startGame()"]').first();
    const mixButton = p.locator('button[onclick="mix()"]');
    assert.ok(await mixButton.isDisabled());
    await p.click('#menuBtn');
    await p.locator("button[onclick=\"showScreen('shopScreen')\"]").click();
    await p.getByRole('button', { name: '🥔じゃがいも 100💰', exact: true }).click();
    assert.ok(await p.getByRole('button', { name: '🥔じゃがいも ✅購入済み', exact: true }).isDisabled());
    assert.match(await p.locator('#shopMoney').innerText(), /400/);
    await p.click('#menuBtn');
    await p.locator("button[onclick=\"showScreen('gameScreen')\"]").click();
    await start.click();
    await p.getByRole('button', { name: '🥕にんじん', exact: true }).click();
    await p.getByRole('button', { name: '🔪千切り', exact: true }).click();
    await p.locator('.deleteFoodBtn').click();
    assert.equal(await p.locator('.food').count(), 0);
    const fillRecipe = async () => {
      await p.getByRole('button', { name: '🥚たまご', exact: true }).click();
      await p.getByRole('button', { name: '🔥焼く', exact: true }).click();
      await p.getByRole('button', { name: '🧂塩', exact: true }).click();
    };
    await fillRecipe();
    await mixButton.click();
    assert.ok(await mixButton.isDisabled());
    assert.ok(await p.locator('.deleteFoodBtn').first().isDisabled());
    // Model guards must hold even if a duplicate event bypasses disabled buttons.
    await p.evaluate(() => { mix(); removeFood(0); addFood('💧', '水'); });
    await p.clock.runFor(2100);
    assert.match(await p.locator('#message').innerText(), /ミッション成功！ \+100/);
    assert.match(await p.locator('#dish').innerText(), /パーフェクト/);
    assert.match(await p.locator('#rankBox').innerText(), /ポイント：100/);
    assert.equal(await p.evaluate(() => cooking.history.length), 1);
    assert.ok(await mixButton.isDisabled());
    await p.click('#nextBtn');
    await p.click('#passBtn');
    await p.evaluate(() => { passMission(); mix(); });
    assert.match(await p.locator('#rankBox').innerText(), /ポイント：130/);
    assert.match(await p.locator('#message').innerText(), /パス！ \+30/);
    await p.click('#nextBtn');
    await fillRecipe();
    await mixButton.click();
    await p.clock.runFor(500);
    await start.click();
    await p.clock.runFor(2100);
    assert.equal(await p.evaluate(() => cooking.history.length), 2);
    assert.ok(await p.locator('#nextBtn').isHidden());
    assert.ok(!await p.locator('.bowl').evaluate(e => e.classList.contains('spin')));
    await mixButton.click(); // Empty bowl: failure does not grant money/score.
    await p.clock.runFor(2100);
    assert.match(await p.locator('#message').innerText(), /ミッション失敗/);
    assert.match(await p.locator('#rankBox').innerText(), /ポイント：130/);
    assert.match(await p.locator('#rankBox').innerText(), /お金：530/);
    await p.click('#menuBtn');
    await p.locator("button[onclick=\"showScreen('bookScreen')\"]").click();
    assert.match(await p.locator('#bookBox').innerText(), /たまご焼き ✅/);
    await p.click('#menuBtn');
    await p.locator("button[onclick=\"showScreen('achievementScreen')\"]").click();
    assert.match(await p.locator('#achievementBox').innerText(), /✅ 初めてのシェフ/);
    assert.match(await p.locator('#historyBox').innerText(), /空っぽ料理 評価なし/);
  },
  async 'youchan-battle'(p) {
    await p.clock.install();
    p.on('dialog', dialog => dialog.accept());
    await p.evaluate(() => { Math.random = () => 0.5; });
    await p.locator('button[onclick="startInfinite()"]').click();
    await p.click('#fireBtn');
    assert.equal(await p.evaluate(() => battle.enemyHp), 83);
    assert.equal(await p.evaluate(() => battle.cooldowns.fire), 1);
    const hp = await p.evaluate(() => battle.playerHp);
    await p.click('#fireBtn');
    assert.match(await p.locator('#log').innerText(), /クールダウン/);
    assert.equal(await p.evaluate(() => battle.playerHp), hp);
    await p.click('#defendBtn');
    assert.equal(await p.evaluate(() => battle.playerHp), hp - 9);
    assert.equal(await p.evaluate(() => battle.cooldowns.fire), 0);
    await p.click('#fireBtn');
    await p.click('#healBtn');
    await p.click('#ultimateBtn');
    assert.equal(await p.evaluate(() => battle.infiniteLevel), 2);
    assert.equal(await p.locator('#coinsText').innerText(), '130');
    await p.locator("button[onclick=\"buyUpgrade('hp')\"]").click();
    assert.equal(await p.locator('#coinsText').innerText(), '30');
    assert.equal(await p.evaluate(() => battle.playerMaxHp), 170);
    await p.locator("button[onclick=\"buyWeapon('fire')\"]").click();
    assert.match(await p.locator('#log').innerText(), /コインが足りない/);
    await p.evaluate(() => showSelect());
    await p.locator('button[onclick="showStoryMap()"]').click();
    await p.locator('[onclick="enterNode(2)"]').click();
    await p.locator('[onclick="enterNode(4)"]').click();
    await p.locator('button[onclick="showSelect()"]').click();
    await p.locator('button[onclick="startInfinite()"]').click();
    assert.ok(await p.evaluate(() => Object.values(battle.cooldowns).every(value => value === 0)));
    await p.locator("button[onclick=\"buyWeapon('fire')\"]").click();
    assert.match(await p.locator('#weaponText').innerText(), /炎ソード \+15/);
    await p.locator("button[onclick=\"buyUpgrade('attack')\"]").click();
    assert.equal(await p.locator('#coinsText').innerText(), '130');
    await p.evaluate(() => showSelect());
    await p.locator('button[onclick="startDefense()"]').click();
    assert.ok(await p.locator('#baseArea').isVisible());
    while (!await p.evaluate(() => battle.battleEnded)) await p.click('#attackBtn');
    await p.clock.runFor(1600);
    assert.match(await p.locator('#waveText').innerText(), /Wave 2 \/ 50/);
    await p.evaluate(() => { battle.baseHp = 1; });
    await p.click('#defendBtn');
    assert.match(await p.locator('#log').innerText(), /負けた/);
    await p.clock.runFor(2100);
    await p.locator('button[onclick="startInfinite()"]').click();
    await p.click('#attackBtn');
    assert.equal(await p.evaluate(() => battle.battleEnded), false, 'destroyed base must not defeat infinite mode');
    assert.ok(await p.locator('#baseArea').isHidden());
    assert.equal(await p.locator('#waveText').innerText(), '');
    await p.evaluate(() => showStoryMap());
    await p.locator('[onclick="enterNode(7)"]').click();
    await p.evaluate(() => { battle.attackBoost = 10000; });
    await p.click('#attackBtn');
    assert.match(await p.locator('#title').innerText(), /真・宇宙魔王/);
    assert.equal(await p.locator('#enemyBar').evaluate(e => e.style.width), '100%');
    await p.click('#attackBtn');
    assert.match(await p.locator('#title').innerText(), /GOD宇宙魔王/);
    assert.equal(await p.locator('#enemyBar').evaluate(e => e.style.width), '100%');
    await p.click('#attackBtn');
    assert.match(await p.locator('#log').innerText(), /完全クリア/);
    assert.ok(Number(await p.locator('#coinsText').innerText()) >= 3600);
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({path: path.join(results, 'battle-clear-' + p.viewportSize().width + '.png')});
    // A new encounter invalidates a previous victory's delayed navigation.
    await p.evaluate(() => startDefense());
    await p.clock.runFor(3100);
    assert.ok(await p.locator('#battleScreen').isVisible());
    assert.equal(await p.evaluate(() => battle.mode), 'defense');
  },
  async 'planet-smash'(p) {
    await p.clock.install();
    const hit = () => p.viewportSize().width === 390 ? p.tap('#c') : p.click('#c');
    await hit();
    assert.equal(await p.locator('#hp').innerText(), '2980', 'one touch/click means one attack');
    assert.equal(await p.locator('#money').innerText(), '1');
    await p.locator('#c').focus();
    await p.keyboard.press('Enter');
    await p.keyboard.press('Space');
    assert.equal(await p.locator('#hp').innerText(), '2940');
    await p.click('#atk1');
    assert.match(await p.locator('#msg').innerText(), /お金が足りない/);
    assert.equal(await p.evaluate(() => planet.selected), 0);
    // Exercise normal attacks to earn the first unlock, including the stage bonus.
    await p.evaluate(() => { while (planet.stage === 0) useAttack(350, 200); });
    assert.match(await p.locator('#stageName').innerText(), /月/);
    assert.match(await p.locator('#msg').innerText(), /ステージクリア/);
    assert.equal(await p.locator('#money').innerText(), '650');
    await p.click('#atk1');
    assert.equal(await p.locator('#money').innerText(), '150');
    await p.click('#atk0');
    await p.click('#atk1');
    assert.equal(await p.locator('#money').innerText(), '150', 'already unlocked attacks are free');
    await hit();
    assert.equal(await p.locator('#hp').innerText(), '6920');
    // Use the real damage/clear path to reach and test the later poison mechanic.
    await p.evaluate(() => { while (planet.stage < 8) damagePlanet(planet.hp, 350, 200); });
    await p.click('#atk8');
    await hit();
    const directHP = Number(await p.locator('#hp').innerText());
    await p.clock.runFor(3100);
    assert.equal(Number(await p.locator('#hp').innerText()), directHP - 700 * 5);
    assert.equal(await p.evaluate(() => poisonTimers.length), 0);
    await p.evaluate(() => damagePlanet(planet.hp - 100, 350, 200));
    await hit(); // The direct poison hit clears the planet: no new timer may survive.
    assert.match(await p.locator('#msg').innerText(), /ステージクリア/);
    assert.equal(await p.evaluate(() => poisonTimers.length), 0);
    const nextHP = await p.locator('#hp').innerText();
    await p.clock.runFor(3600);
    assert.equal(await p.locator('#hp').innerText(), nextHP);
    await hit();
    await p.evaluate(() => damagePlanet(planet.hp - 500, 350, 200));
    await p.clock.runFor(700); // A poison tick also ends all poison on stage clear.
    assert.match(await p.locator('#msg').innerText(), /ステージクリア/);
    assert.equal(await p.evaluate(() => poisonTimers.length), 0);
    await hit();
    await p.locator('button[onclick="resetGame()"]').click();
    await p.clock.runFor(3100);
    assert.equal(await p.locator('#hp').innerText(), '3000');
    assert.equal(await p.locator('#money').innerText(), '0');
    assert.equal(await p.evaluate(() => planet.selected), 0);
    assert.equal(await p.evaluate(() => attacks.filter(a => a.unlocked).length), 1);
    await p.evaluate(() => { while (!planet.cleared) damagePlanet(planet.hp, 350, 200); });
    assert.match(await p.locator('#msg').innerText(), /完全クリア/);
    assert.equal(await p.locator('#hp').innerText(), '0');
    assert.equal(await p.evaluate(() => planet.completed), 18);
    await p.clock.runFor(100);
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({path: path.join(results, 'planet-clear-' + p.viewportSize().width + '.png')});
    const finalMoney = await p.locator('#money').innerText();
    await hit();
    assert.equal(await p.locator('#money').innerText(), finalMoney);
    await p.locator('button[onclick="resetGame()"]').click();
    assert.equal(await p.locator('#hp').innerText(), '3000');
  },
  async 'chaos-ultra-x'(p) {
    await p.click('#startBtn');
    assert.ok(await p.evaluate(() => state === 'play' && p.hp === 100));
    await p.evaluate(() => gainXP(35));
    assert.equal(await p.locator('#choices button').count(), 3);
    await p.locator('#choices button').first().click();
    assert.ok(await p.evaluate(() => state === 'play' && p.level === 2));
    assert.equal(await p.evaluate(() => {
      const enemy = spawnEnemy('normal', p.x + 50, p.y);
      damageEnemy(enemy, 9999, true, true); return enemy.hp;
    }), 1);
    await p.click('#boom');
    assert.equal(await p.evaluate(() => boomCharges), 4);
    await p.click('#blackhole');
    assert.ok(await p.evaluate(() => blackhole !== null && blackholeCD > 0));
    await p.click('#pauseBtn');
    assert.ok(await p.locator('#pauseScreen').isVisible());
    await p.click('#resumeBtn');
    assert.ok(await p.evaluate(() => state === 'play'));
    await p.evaluate(() => { gameOver(); });
    await p.click('#retryBtn');
    assert.equal(await p.evaluate(() => boomCharges), 5);
  },
  async 'snake-battle'(p) {
    await p.fill('#cpuCount', '1');
    await p.click('#startButton');
    await p.waitForFunction(() => playing);
    assert.ok(await p.locator('canvas').first().isVisible());
  },
  async 'arcade-lobby'(p) {
    const { arcadeCatalog } = await import('../../scripts/arcade-catalog.mjs');
    const groups = arcadeCatalog(root), all = groups.flatMap(g => g.entries);
    const lobby = p.url();
    assert.equal(await p.locator('.game-card').count(), 37);
    assert.deepEqual(await p.locator('.game-card h3').allTextContents(), all.map(e => e.name));
    assert.deepEqual(await p.locator('.game-card').evaluateAll(cards => cards.map(c => c.getAttribute('href'))), all.map(e => `index.html?game=${e.id}`));
    assert.deepEqual(await p.locator('script[src]').evaluateAll(scripts => scripts.map(s => s.getAttribute('src'))), ['lobby.js']);
    assert.equal(await p.locator('canvas').count(), 0);
    await p.fill('#search', 'ゴルフ');
    assert.equal(await p.locator('.game-card:visible').count(), 1);
    await p.fill('#search', 'ないゲーム123');
    assert.ok(await p.locator('#empty').isVisible());
    await p.locator('nav a[href="#cranes"]').click();
    assert.equal(await p.locator('.game-card:visible').count(), 37);
    assert.equal(await p.locator('#search').inputValue(), '');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({path: path.join(results, 'arcade-lobby-' + p.viewportSize().width + '.png'), fullPage: false});
    const noJS = await p.context().browser().newContext({ javaScriptEnabled: false });
    try {
      const fallback = await noJS.newPage();
      await fallback.goto(lobby);
      assert.equal(await fallback.locator('.game-card').count(), 37);
    } finally { await noJS.close(); }
    await p.evaluate(() => localStorage.setItem('kochan-claw-v1', JSON.stringify({ owned: [2, ...Array(19).fill(0)], tries: 3 })));
    // One actual URL entry per category; WebGL must load at the chosen station.
    for (const group of groups) {
      await p.goto(lobby);
      const entry = group.entries[0];
      await p.locator(`.game-card[href="index.html?game=${entry.id}"]`).click();
      await p.waitForFunction(x => typeof scene !== 'undefined' && scene.player.x === x, entry.offset);
      assert.equal(await p.evaluate(() => scene.player.z), 6);
      assert.ok(await p.locator('#game').isVisible());
      assert.equal(new URL(p.url()).searchParams.get('game'), entry.id);
      assert.ok(await p.locator('.lobby-link').evaluate(e => e.getBoundingClientRect().right <= innerWidth));
      assert.ok(await p.evaluate(() => {
        const title = document.querySelector('.top h1').getBoundingClientRect();
        const link = document.querySelector('.lobby-link').getBoundingClientRect();
        return title.bottom <= link.top || title.right <= link.left;
      }), 'header title and return link must not overlap');
      assert.match(await p.locator('#score').innerText(), /GET 2 \/ 1種類/);
      if (entry.id === 'race') {
        await p.getByRole('button', { name: 'ネオンレース START', exact: true }).click();
        assert.equal(await p.evaluate(() => cabinets.games.find(g => g.id === 'race').engine.state), 'playing');
        await p.screenshot({path: path.join(results, 'arcade-selected-' + p.viewportSize().width + '.png')});
      }
    }
    const links = await p.evaluate(() => [...destinations].map(([id, d]) => ({ id, offset: d.offset })));
    assert.deepEqual(links.sort((a,b) => a.id.localeCompare(b.id)), all.map(({id,offset}) => ({id,offset})).sort((a,b) => a.id.localeCompare(b.id)));
    // Every generated target exists and can be selected, including the farthest.
    for (const entry of all) {
      assert.equal(await p.evaluate(id => visitGame(id), entry.id), true);
      assert.equal(await p.evaluate(() => scene.player.x), entry.offset);
    }
    await p.goto(new URL('index.html?game=unknown', lobby).href);
    await p.waitForFunction(() => document.querySelector('#message').textContent.includes('見つからなかった'));
    assert.equal(await p.evaluate(() => scene.player.x), 0);
    await p.locator('.lobby-link').click();
    assert.equal(new URL(p.url()).pathname, new URL(lobby).pathname);
    assert.equal(await p.locator('.game-card').count(), 37);
  },
  async 'kochan-3d-arcade'(p) {
    await p.click('#catalogOpen');
    assert.ok(await p.locator('#catalogModal').isVisible());
    assert.ok(await p.locator('#catalogModal button').count() >= 37);
    await p.locator('[data-close="catalogModal"]').click();
    await p.click('#collectionOpen');
    assert.ok(await p.locator('#collectionModal').isVisible());
    await p.locator('[data-close="collectionModal"]').click();
    assert.ok(await p.locator('#game').isVisible());
  },
  async 'online-demo'(p) {
    let socket;
    await p.routeWebSocket('**/room/**', ws => { socket = ws; });
    await p.fill('#name', 'テスト');
    await p.fill('#code', '!');
    await p.click('#enter');
    assert.match(await p.locator('#error').innerText(), /合言葉/);
    await p.fill('#code', 'test');
    await p.click('#enter');
    await p.waitForFunction(() => document.querySelector('#enter').disabled);
    assert.ok(socket, 'WebSocket connection requested');
    socket.send(JSON.stringify({ type: 'welcome', you: { id: 'me', name: 'テスト', color: '#55ff88', x: .5, y: .5 }, players: [] }));
    await p.waitForFunction(() => document.querySelector('#status').textContent === 'つながった！');
    await p.click('#leave');
    assert.ok(await p.locator('#join').isVisible());
  },
  async 'snake-battle-online'(p) {
    let socket;
    await p.routeWebSocket('**/snake/**', ws => { socket = ws; });
    await p.fill('#nameIn', 'テスト');
    await p.fill('#codeIn', '!');
    await p.click('#enterBtn');
    assert.match(await p.locator('#joinErr').innerText(), /合言葉/);
    await p.fill('#codeIn', 'test');
    await p.click('#enterBtn');
    assert.ok(socket, 'WebSocket connection requested');
    socket.send(JSON.stringify({ t: 'welcome', you: 'me' }));
    socket.send(JSON.stringify({ t: 'lobby', host: 'me', players: [{ id: 'me', name: 'テスト', color: 0, ready: true }], cpuCount: 9, settings: { mode: 'time', minutes: 3, size: 1, rocks: true, cpu: 1 } }));
    await p.waitForFunction(() => document.querySelector('#lobby').classList.contains('on'));
    assert.match(await p.locator('#members').innerText(), /テスト/);
    await p.click('#leaveBtn1');
    assert.ok(await p.locator('#join').isVisible());
  }
};

async function mockPlays(context) {
  context.playCounts = new Map(); context.playEvents = new Set();
  await context.route('https://tomiyoko-online.shoulang.workers.dev/plays**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (context.playReadFails && request.method()==='GET') return route.fulfill({status:503,json:{error:'offline test'}});
    if (request.method()==='POST') {
      const game = url.pathname.split('/').pop(), event = request.postDataJSON();
      if (!context.playEvents.has(event.id)) {context.playEvents.add(event.id);context.playCounts.set(game,(context.playCounts.get(game)||0)+1);}
      return route.fulfill({json:{counted:true}});
    }
    return route.fulfill({json:{counts:Object.fromEntries(context.playCounts)}});
  });
}

async function mockRankings(context, store = new Map(), api = 'https://tomiyoko-online.shoulang.workers.dev') {
  context.rankingStore = store;
  await context.route(api + '/rankings/**', async route => {
    const request = route.request(), url = new URL(request.url()), game = url.pathname.split('/').pop();
    const code = request.headers().authorization || '';
    if (request.method() === 'POST') {
      if (context.rankingsWritable === false) return route.fulfill({status:503,json:{error:'offline test'}});
      const {name,scores} = request.postDataJSON();
      for (const [metric,score] of Object.entries(scores)) {
        const key = `${game}/${metric}/${code}`, old = store.get(key);
        store.set(key, {code,name,score:Math.max(old?.score || 0,score),game,metric});
      }
      return route.fulfill({json:{saved:true}});
    }
    if (context.rankingReadDelay) await new Promise(resolve => setTimeout(resolve, context.rankingReadDelay));
    const metric = url.searchParams.get('metric') || 'score';
    const rows = [...store.values()].filter(r => r.game === game && r.metric === metric).sort((a,b) => b.score-a.score);
    const publicRows = rows.slice(0,20).map(r => ({player: require('node:crypto').createHash('sha256').update(r.code.replace(/^Bearer /, '')).digest('hex'),name:r.name,score:r.score}));
    const own = rows.find(r => r.code === code);
    return route.fulfill({json:{rows:publicRows,own:own ? {name:own.name,score:own.score} : null}});
  });
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/kids-game/`;
  let browser;
  let failures = 0;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    for (const width of [390, 1280]) {
      for (const game of targets) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width === 390 });
        const page = await context.newPage();
        // Software WebGL on CI is slower than a desktop GPU. Keep ordinary
        // pages fast while allowing the real arcade scene time to render.
        page.setDefaultTimeout(['kochan-3d-arcade', 'arcade-lobby'].includes(game.id) ? 30000 : 8000);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
        page.on('requestfailed', r => { if (r.url().startsWith(base)) errors.push(`${r.failure()?.errorText} ${r.url()}`); });
        await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
        await mockPlays(context);
        if (game.id === 'ranking') await mockRankings(context);
        try {
          await page.goto(base + game.url, { waitUntil: 'load' });
          if (game.id === 'home') {
            assert.equal(await page.locator('#grid .card').count(), games.length);
            assert.deepEqual(await page.locator('#grid h2').allTextContents(), games.map(g => g.title));
            assert.deepEqual(await page.locator('#grid .play-link').evaluateAll(links => links.map(a => a.getAttribute('href'))), games.map(g => `games/${g.id}/${g.entry || 'index.html'}`));
            assert.deepEqual(await page.locator('#grid .game-manual').evaluateAll(links => links.map(a => a.getAttribute('href'))), games.map(g => `wiki/${g.manual}.html`));
            assert.deepEqual(await page.locator('#grid .game-ranking').evaluateAll(links => links.map(a => a.getAttribute('href'))), games.filter(g => g.id !== 'online-demo').map(g => `ranking/index.html?game=${g.id}`));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.waitForFunction(() => document.querySelector('#popular-count').textContent.includes('まだ集計'));
            assert.equal(context.playEvents.size,0,'viewing the homepage is not a play');
            await page.locator('#grid [href="games/tap-circle/index.html"]').click();
            await page.waitForFunction(() => !!globalThis.GamePlays);
            assert.equal(context.playEvents.size,0,'opening a game alone is not a play');
            const sent = page.waitForResponse(r => r.url().endsWith('/plays/tap-circle') && r.request().method()==='POST');
            await page.click('#start'); await sent;
            assert.equal(context.playCounts.get('tap-circle'),1);
            await page.goto(base);
            await page.waitForFunction(() => document.querySelector('#popular-count').textContent==='1位 · 1回');
            assert.match(await page.locator('#popular-winner').innerText(),/丸をタップ/);
            context.playCounts.set('snake',5);context.playCounts.set('tap-circle',5);
            await page.click('#popular-refresh');
            await page.waitForFunction(() => document.querySelector('#popular-count').textContent==='同率1位 · 5回');
            assert.equal(await page.locator('#popular-winner a').count(),2);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            context.playReadFails=true;await page.click('#popular-refresh');
            await page.waitForFunction(() => document.querySelector('#popular-status').textContent.includes('読み込めません'));
            assert.ok(await page.locator('#popular-refresh').isEnabled());
            context.playReadFails=false;
            // Navigation must work with scripts disabled as well.
            const noJS = await browser.newContext({ javaScriptEnabled: false });
            const fallback = await noJS.newPage(); await fallback.goto(base);
            assert.equal(await fallback.locator('#grid .play-link').count(), games.length); await noJS.close();
          } else if (game.id === 'manual') {
            const manualGames = games.filter(g => g.manual);
            assert.deepEqual(await page.locator('.manual-list a').allTextContents(), manualGames.map(g=>`${g.emoji} ${g.title}`));
            // A manual must contain only its own game, even without JavaScript.
            const noJS = await browser.newContext({javaScriptEnabled:false,viewport:{width,height:844}});
            try {
              const document = await noJS.newPage();
              for (const g of manualGames) {
                await document.goto(base+`wiki/${g.manual}.html`);
                assert.equal(await document.locator('h1').innerText(), `${g.emoji} ${g.title}のせつめいしょ`);
                assert.equal(await document.locator(`section#${g.manual}`).count(),1);
                for (const other of manualGames.filter(other=>other.id!==g.id))
                  assert.equal(await document.locator(`section#${other.manual}`).count(),0, `${g.id} must not show ${other.id}'s manual`);
                assert.equal(await document.locator('nav .play-link').getAttribute('href'), `../games/${g.id}/${g.entry || 'index.html'}`);
                assert.ok(await document.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
                await document.screenshot({path:path.join(results,`manual-${g.id}-${width}.png`),fullPage:true});
              }
            } finally {await noJS.close();}
            // Old bookmarks, including base-defense subsections, still open the right manual.
            for (const g of manualGames) {
              await page.goto(base+`wiki/index.html#${g.manual}`);
              await page.waitForURL(base+`wiki/${g.manual}.html#${g.manual}`);
              assert.equal(await page.locator('h1').innerText(), `${g.emoji} ${g.title}のせつめいしょ`);
            }
            await page.goto(base+'wiki/index.html#weapons');
            await page.waitForURL(base+'wiki/defense.html#weapons');
            assert.ok(await page.locator('#weapons').isVisible());
            await page.goto(base+'wiki/index.html#rankings');
            assert.ok(await page.locator('#rankings').isVisible());
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          } else {
            assert.ok(scenarios[game.id], `missing scenario for ${game.id}`);
            await scenarios[game.id](page);
          }
          if (games.some(g => g.id === game.id)) {
            assert.equal(await page.locator('.game-page-links .game-manual').first().getAttribute('href'), `../../wiki/${game.manual}.html`);
            const links = await page.locator('.game-page-links .game-ranking').evaluateAll(a => a.map(e => e.getAttribute('href')));
            assert.equal(links.length > 0, game.id !== 'online-demo');
            assert.ok(links.every(href => href === `../../ranking/index.html?game=${game.id}`));
          }
          // Observe several real rendering frames, not only synchronous initialization.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.deepEqual(errors, [], 'browser errors');
          console.log(`PASS ${width}px ${game.id}`);
        } catch (error) {
          failures++;
          console.error(`FAIL ${width}px ${game.id}: ${error.stack}\n${errors.join('\n')}`);
          await page.screenshot({ path: path.join(results, `${game.id}-${width}.png`), fullPage: true }).catch(() => {});
        } finally { await context.close(); }
      }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

