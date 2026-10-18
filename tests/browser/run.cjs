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
    await p.fill('#name', 'テスト');
    await p.click('#save');
    await p.waitForFunction(() => document.querySelector('#status').textContent.includes('送信が完了'));
    await p.locator('summary').click();
    await p.click('#show-code');
    const code = await p.locator('#code').innerText();
    assert.match(code, /^[a-f0-9]{64}$/);
    const base = new URL('../', p.url()).href;
    await p.goto(base + 'games/tap-circle/index.html');
    p.context().rankingsWritable = false;
    await p.clock.install();
    await p.click('#start');
    await p.locator('#target').dispatchEvent('pointerdown', { pointerId: 1 });
    await p.clock.fastForward(20100);
    await p.evaluate(() => globalThis.GameRecords.flush().catch(() => {}));
    await p.goto(base + 'ranking/index.html?game=tap-circle');
    await p.click('#retry');
    await p.waitForFunction(() => document.querySelector('#status').textContent.includes('送れませんでした'));
    p.context().rankingsWritable = true;
    await p.click('#retry');
    await p.waitForFunction(() => document.querySelector('#own').textContent.includes('1点'));
    assert.match(await p.locator('#rows').innerText(), /テスト/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // A fresh browser context has no localStorage: import the code there.
    const second = await p.context().browser().newContext();
    try {
      await mockRankings(second, p.context().rankingStore);
      const device = await second.newPage();
      await device.goto(base + 'ranking/index.html?game=tap-circle');
      await device.fill('#name', 'テスト');
      await device.locator('details').evaluate(e => { e.open = true; });
      await device.fill('#import-code', code);
      await device.click('#import');
      await device.waitForFunction(() => document.querySelector('#own').textContent.includes('1点'));
      assert.equal(await device.locator('#rows tr').count(), 1);
    } finally { await second.close(); }
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
    await p.clock.install();
    await p.click('#startBtn');
    assert.equal(await p.locator('#overlay').isVisible(), false);
    await p.keyboard.press('ArrowUp');
    await p.clock.runFor(3000);
    assert.ok(await p.locator('#overlay').isVisible());
    await p.click('#startBtn');
    assert.equal(await p.locator('#overlay').isVisible(), false);
    assert.match(await p.locator('#score').innerText(), /0$/);
  },
  async 'base-defense'(p) {
    const before = await p.evaluate(() => money);
    // A buildable square next to the core: buying and deducting resources must work.
    await p.locator('.tile.buildable').first().click();
    assert.ok(await p.evaluate(() => towers.length === 1));
    assert.equal(await p.evaluate(() => money), before - 50);
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
    await p.locator('button[onclick="startInfinite()"]').click();
    assert.ok(await p.locator('#battleScreen').isVisible());
    const hp = await p.evaluate(() => enemyHp);
    await p.click('#attackBtn');
    assert.ok(await p.evaluate(() => enemyHp) < hp);
  },
  async 'planet-smash'(p) {
    const hp = await p.locator('#hp').innerText();
    await p.click('#c');
    assert.ok(Number(await p.locator('#hp').innerText()) < Number(hp));
    await p.evaluate(() => damagePlanet(hp, 350, 200));
    assert.match(await p.locator('#stageName').innerText(), /月/);
    await p.locator('button[onclick="resetGame()"]').click();
    assert.equal(await p.locator('#hp').innerText(), hp);
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

async function mockRankings(context, store = new Map()) {
  context.rankingStore = store;
  await context.route('https://tomiyoko-online.shoulang.workers.dev/rankings/**', async route => {
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
    const metric = url.searchParams.get('metric') || 'score';
    const rows = [...store.values()].filter(r => r.game === game && r.metric === metric).sort((a,b) => b.score-a.score);
    return route.fulfill({json:{rows,own:rows.find(r => r.code === code) || null}});
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
        if (game.id === 'ranking') await mockRankings(context);
        try {
          await page.goto(base + game.url, { waitUntil: 'load' });
          if (game.id === 'home') {
            assert.equal(await page.locator('#grid .card').count(), games.length);
            assert.deepEqual(await page.locator('#grid h2').allTextContents(), games.map(g => g.title));
            assert.deepEqual(await page.locator('#grid .card').evaluateAll(cards => cards.map(c => c.getAttribute('href'))), games.map(g => `games/${g.id}/${g.entry || 'index.html'}`));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            // Navigation must work with scripts disabled as well.
            const noJS = await browser.newContext({ javaScriptEnabled: false });
            const fallback = await noJS.newPage(); await fallback.goto(base);
            assert.equal(await fallback.locator('#grid a').count(), games.length); await noJS.close();
          } else if (game.id === 'manual') {
            for (const g of games.filter(g => g.manual)) assert.equal(await page.locator(`section#${g.manual}`).count(), 1);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          } else {
            assert.ok(scenarios[game.id], `missing scenario for ${game.id}`);
            await scenarios[game.id](page);
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
