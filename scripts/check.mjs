import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parse as parseHTML } from 'parse5';
import { parse as parseJS } from 'acorn';
import { RANKINGS } from '../shared/leaderboard-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const games = JSON.parse(read('data/games.json'));
const ids = games.map(g => g.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate catalog game');
for (const g of games) {
  assert.match(g.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  for (const key of ['title', 'emoji', 'description']) assert.ok(typeof g[key] === 'string' && g[key].trim(), `${g.id}: ${key}`);
  assert.equal(typeof g.author, 'string');
  assert.ok(g.manual || g.manualNote, `${g.id}: manual or documented exception required`);
  if (g.manual) assert.match(g.manual, /^[a-z0-9-]+$/);
  if (g.entry) {
    assert.match(g.entry, /^[a-z0-9-]+\.html$/, `${g.id}: invalid entry`);
    assert.ok(existsSync(path.join(root, 'games', g.id, g.entry)), `${g.id}: missing entry ${g.entry}`);
  }
  assert.ok(Object.hasOwn(RANKINGS, g.id) || g.id === 'online-demo', `${g.id}: ranking policy is missing`);
}
assert.deepEqual([...ids].sort(), readdirSync(path.join(root, 'games')).filter(id => existsSync(path.join(root, 'games', id, 'index.html'))).sort(), 'catalog must include every game');

const documents = new Map();
function visit(node, fn) {
  fn(node);
  for (const child of node.childNodes || []) visit(child, fn);
}
function document(file) {
  if (documents.has(file)) return documents.get(file);
  const text = read(file);
  assert.ok(!/^(?:<{7}|={7}|>{7})(?: |$)/m.test(text), `${file}: merge conflict`);
  const tree = parseHTML(text);
  const ids = new Set();
  visit(tree, n => {
    const id = n.attrs?.find(a => a.name === 'id')?.value;
    if (id) { assert.ok(!ids.has(id), `${file}: duplicate id ${id}`); ids.add(id); }
  });
  const result = { tree, ids };
  documents.set(file, result);
  return result;
}
const files = ['index.html', 'wiki/index.html', 'ranking/index.html', ...games.flatMap(g => [`games/${g.id}/index.html`, ...(g.entry ? [`games/${g.id}/${g.entry}`] : [])])];
const checkedScripts = new Set();
function checkScript(file, module = false) {
  if (checkedScripts.has(file)) return;
  checkedScripts.add(file);
  const ast = parseJS(read(file), { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script' });
  for (const item of ast.body) {
    if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(item.type) || !item.source) continue;
    const specifier = item.source.value;
    assert.ok(specifier.startsWith('.'), `${file}: browser imports must use local paths`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    assert.ok(!target.startsWith('../') && existsSync(path.join(root, target)), `${file}: missing import ${specifier}`);
    checkScript(target, true);
  }
}
for (const file of files) {
  visit(document(file).tree, node => {
    const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
    const code = node.childNodes?.filter(c => c.nodeName === '#text').map(c => c.value).join('') || '';
    if (node.tagName === 'script' && (!attrs.type || ['module', 'text/javascript', 'application/javascript'].includes(attrs.type))) {
      if (attrs.src && !/^(?:https?:)?\/\//.test(attrs.src)) checkScript(path.posix.join(path.posix.dirname(file), attrs.src), attrs.type === 'module');
      else parseJS(code, { ecmaVersion: 'latest', sourceType: attrs.type === 'module' ? 'module' : 'script' });
    }
    for (const [name, value] of Object.entries(attrs)) {
      if (/^on[a-z]+$/.test(name)) parseJS(`function handler(event) {\n${value}\n}`, { ecmaVersion: 'latest' });
      if (!['href', 'src'].includes(name) || !value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;
      const url = new URL(value, `https://local.invalid/kids-game/${file}`);
      const prefix = '/kids-game/';
      assert.ok(url.pathname.startsWith(prefix), `${file}: link escapes GitHub Pages subpath: ${value}`);
      let target = decodeURIComponent(url.pathname.slice(prefix.length));
      if (target.endsWith('/')) target += 'index.html';
      assert.ok(existsSync(path.join(root, target)), `${file}: missing ${value}`);
      if (url.hash && target.endsWith('.html')) assert.ok(document(target).ids.has(decodeURIComponent(url.hash.slice(1))), `${file}: missing anchor ${value}`);
    }
  });
}
for (const g of games.filter(g => g.manual)) assert.ok(document('wiki/index.html').ids.has(g.manual), `${g.id}: missing manual section`);
console.log(`PASS: ${games.length} catalog entries; HTML/JS syntax, local links, anchors and unique IDs`);
