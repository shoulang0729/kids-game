const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '../..');
const games = JSON.parse(fs.readFileSync(path.join(root, 'data/games.json'), 'utf8'));
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
    await p.locator('button[onclick="startGame()"]').first().click();
    assert.ok(await p.evaluate(() => currentMission !== null));
    assert.ok(await p.locator('#foodButtons button').count() > 0);
    await p.click('#menuBtn');
    await p.locator('button[onclick="showScreen(\'bookScreen\')"]').click();
    assert.ok(await p.locator('#bookScreen').isVisible());
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
    await p.locator('button[onclick="resetGame()"]').click();
    assert.equal(await p.locator('#hp').innerText(), hp);
  },
  async 'chaos-ultra-x'(p) {
    await p.click('#startBtn');
    assert.ok(await p.evaluate(() => state === 'play' && p.hp === 100));
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

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/kids-game/`;
  let browser;
  let failures = 0;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    for (const width of [390, 1280]) {
      for (const game of [{ id: 'home', url: 'index.html' }, { id: 'manual', url: 'wiki/index.html' }, ...games.map(g => ({ ...g, url: `games/${g.id}/index.html` }))]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width === 390 });
        const page = await context.newPage();
        // Software WebGL on CI is slower than a desktop GPU. Keep ordinary
        // pages fast while allowing the real arcade scene time to render.
        page.setDefaultTimeout(game.id === 'kochan-3d-arcade' ? 30000 : 8000);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
        page.on('requestfailed', r => { if (r.url().startsWith(base)) errors.push(`${r.failure()?.errorText} ${r.url()}`); });
        await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
        try {
          await page.goto(base + game.url, { waitUntil: 'load' });
          if (game.id === 'home') {
            assert.equal(await page.locator('#grid .card').count(), games.length);
            assert.deepEqual(await page.locator('#grid h2').allTextContents(), games.map(g => g.title));
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
