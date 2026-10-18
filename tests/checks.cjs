// Exercise failure cases in an isolated copy; never edit the working tree.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kids-checks-'));
try {
  for (const file of ['index.html', 'README.md', 'data', 'scripts', 'wiki', 'ranking', 'games', 'assets', 'shared']) {
    fs.cpSync(path.join(root, file), path.join(fixture, file), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  const run = script => spawnSync(process.execPath, [path.join(fixture, 'scripts', script), ...(script === 'generate.mjs' ? ['--check'] : [])], { encoding: 'utf8' });
  assert.equal(run('check.mjs').status, 0);
  function rejects(file, transform, script, message) {
    const name = path.join(fixture, file), before = fs.readFileSync(name, 'utf8');
    try {
      fs.writeFileSync(name, transform(before));
      const result = run(script);
      assert.notEqual(result.status, 0, message);
      assert.match(result.stderr, message);
    } finally { fs.writeFileSync(name, before); }
  }
  rejects('games/snake/game.js', s => 'const broken = [{a: 1} {b: 2}];\n' + s, 'check.mjs', /SyntaxError/);
  rejects('index.html', s => s.replace('games/snake/index.html', 'games/missing/index.html'), 'check.mjs', /missing games\/missing/);
  rejects('wiki/index.html', s => s.replace('id="chaos-ultra-x"', 'id="missing-chaos"'), 'check.mjs', /missing anchor/);
  rejects('index.html', s => s.replace('<header>', '<header id="grid">'), 'check.mjs', /duplicate id grid/);
  rejects('data/games.json', s => { const data = JSON.parse(s); data.pop(); return JSON.stringify(data); }, 'check.mjs', /catalog must include every game/);
  rejects('data/games.json', s => { const data = JSON.parse(s); data[0].title = '変更'; return JSON.stringify(data); }, 'generate.mjs', /out of date/);
  rejects('games/kochan-3d-arcade/lobby.html', s => s.replace('index.html?game=crane-real', 'missing.html?game=crane-real'), 'check.mjs', /missing missing.html/);
  rejects('games/kochan-3d-arcade/arcade.js', s => s.replace('バスケットシュート', '新しいバスケ'), 'generate.mjs', /out of date/);
  rejects('data/games.json', s => { const data = JSON.parse(s); data.find(g => g.entry).entry = '../index.html'; return JSON.stringify(data); }, 'check.mjs', /invalid entry/);
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
console.log('PASS: syntax, broken links, missing manual, duplicate IDs and catalog omissions are rejected');
