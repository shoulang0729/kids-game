import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

update('index.html', 'cards', games.map(g => `<a class="card" href="games/${escape(g.id)}/index.html">
  <div class="emoji">${escape(g.emoji)}</div>
  <h2>${escape(g.title)}</h2>
  <p>${escape(g.description + (g.author ? `（${g.author}作）` : ''))}</p>
  <span class="badge">あそぶ ▶</span>
</a>`).join('\n'));

update('README.md', 'catalog', `公開トップページと同じ${games.length}件を、同じ順番で掲載しています（接続テスト用デモを含む）。

| ゲーム | せつめい | 作った人 | フォルダ |
|--------|----------|----------|----------|
${games.map(g => `| ${cell(g.emoji)} ${cell(g.title)} | ${cell(g.description)} | ${cell(g.author || '—')} | \`games/${g.id}/\` |`).join('\n')}`);

update('README.md', 'tree', '```\nkids-game/\n├── index.html ← 入り口ページ（生成）\n├── games/\n' +
  games.map((g, i) => `│   ${i === games.length - 1 ? '└' : '├'}── ${g.id}/index.html ← ${g.title}`).join('\n') +
  '\n├── data/games.json ← ゲーム情報の正本\n├── wiki/index.html ← せつめいしょ（目次を生成）\n├── assets/ ← アイコン画像\n├── online-server/ ← オンライン対戦サーバー\n├── scripts/ ← 生成・整合性検査\n├── tests/ ← ブラウザ・ゲームの回帰テスト\n├── docs/refactoring.md ← 段階的な整理の計画\n├── .github/workflows/ ← PR検査・オンラインサーバーの公開\n├── package.json ← 開発用コマンド\n├── CONTRIBUTING.md ← 修正・追加・PRのルール\n└── README.md\n```');
update('wiki/index.html', 'navigation', games.filter(g => g.manual).map(g => `<a href="#${escape(g.manual)}">${escape(g.emoji)} ${escape(g.title)}</a>`).join('\n'));
console.log(check ? 'PASS: generated catalog is up to date' : 'Generated homepage, README and manual navigation');
