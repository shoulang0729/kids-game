import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RANKINGS } from '../shared/leaderboard-policy.mjs';
import { arcadeCatalog } from './arcade-catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const games = JSON.parse(readFileSync(path.join(root, 'data/games.json'), 'utf8'));
const check = process.argv.includes('--check');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const cell = value => String(value).replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ');

function update(file, name, content) {
  const filename = path.join(root, file);
  const before = readFileSync(filename, 'utf8');
  const start = `<!-- BEGIN GENERATED: ${name} -->`;
  const end = `<!-- END GENERATED: ${name} -->`;
  if (before.split(start).length !== 2 || before.split(end).length !== 2) {
    throw new Error(`${file}: generated block ${name} must occur exactly once`);
  }
  const first = before.indexOf(start) + start.length;
  const last = before.indexOf(end);
  if (first > last) throw new Error(`${file}: invalid generated block ${name}`);
  const after = before.slice(0, first) + '\n' + content + '\n' + before.slice(last);
  if (before === after) return;
  if (check) throw new Error(`${file}: out of date; run npm run generate`);
  writeFileSync(filename, after);
}

update('index.html', 'cards', games.map(g => `<a class="card${g.entry ? ' portal' : ''}" href="games/${escape(g.id)}/${escape(g.entry || 'index.html')}">
  <div class="emoji">${escape(g.emoji)}</div>
  <h2>${escape(g.title)}</h2>
  <p>${escape(g.description + (g.author ? `（${g.author}作）` : ''))}</p>
  <span class="badge">${g.id === 'online-demo' ? '接続テスト ▶' : g.entry ? '専用入口でゲームをえらぶ ▶' : 'あそぶ ▶'}</span>
</a>`).join('\n'));

update('README.md', 'catalog', `公開トップページと同じ${games.length}件を、追加が古い順から新しい順に掲載しています（接続テスト用デモを含む）。

| ゲーム | せつめい | 作った人 | フォルダ |
|--------|----------|----------|----------|
${games.map(g => `| ${cell(g.emoji)} [${cell(g.title)}](https://shoulang0729.github.io/kids-game/games/${g.id}/${g.entry || 'index.html'}) | ${cell(g.description)} | ${cell(g.author || '—')} | \`games/${g.id}/\` |`).join('\n')}`);

update('README.md', 'tree', '```\nkids-game/\n├── index.html ← 入り口ページ（生成）\n├── games/\n' +
  games.map((g, i) => `│   ${i === games.length - 1 ? '└' : '├'}── ${g.id}/${g.entry || 'index.html'} ← ${g.title}${g.entry ? '（店内はindex.html）' : ''}`).join('\n') +
  '\n├── data/games.json ← ゲーム情報の正本\n├── wiki/index.html ← せつめいしょ（目次を生成）\n├── ranking/ ← ランキング・記録の引継ぎ\n├── shared/ ← 共通の記録保存・ランキング方針\n├── assets/ ← アイコン画像\n├── online-server/ ← オンライン対戦・ランキングサーバー\n├── scripts/ ← 生成・整合性検査\n├── tests/ ← ブラウザ・ゲームの回帰テスト\n├── docs/refactoring.md ← 段階的な整理の計画\n├── .github/workflows/ ← PR検査・オンラインサーバーの公開\n├── package.json ← 開発用コマンド\n├── CONTRIBUTING.md ← 修正・追加・PRのルール\n└── README.md\n```');
update('wiki/index.html', 'navigation', games.filter(g => g.manual).map(g => `<a href="#${escape(g.manual)}">${escape(g.emoji)} ${escape(g.title)}</a>`).join('\n'));
update('README.md', 'rankings', '| ゲーム | 記録 |\n|---|---|\n' + games.filter(g => RANKINGS[g.id]).map(g => `| ${cell(g.title)} | ${Object.values(RANKINGS[g.id]).map(m => cell(m.label)).join('・')} |`).join('\n'));
const groups = arcadeCatalog(root);
update('games/kochan-3d-arcade/lobby.html', 'arcade-lobby', groups.map(group => `<section id="${group.id}">
  <h2>${escape(group.name)} <small>${group.entries.length}種類</small></h2>
  <div class="cards">
${group.entries.map(e => `<a class="game-card" href="index.html?game=${e.id}">
    <span class="icon" aria-hidden="true">${escape(e.icon)}</span>
    <h3>${escape(e.name)}</h3><p>${escape(e.hint)}</p><span class="play">この台へ ▶</span>
  </a>`).join('\n')}
  </div>
</section>`).join('\n'));
console.log(check ? 'PASS: generated catalog is up to date' : 'Generated homepage, README, manual navigation and 3D lobby');
