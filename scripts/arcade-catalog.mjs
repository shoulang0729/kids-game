import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from 'acorn';

// Extract only literal metadata from the shipped game; never execute its code.
export function arcadeCatalog(root) {
  const directory = path.join(root, 'games/kochan-3d-arcade');
  function nodes(file) {
    const found = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (typeof node.type === 'string') found.push(node);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    }
    walk(parse(readFileSync(path.join(directory, file), 'utf8'), { ecmaVersion: 'latest' }));
    return found;
  }
  function literal(node) {
    if (node?.type === 'Literal') return node.value;
    if (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal') return -node.argument.value;
    throw Error('Arcade catalog metadata must be literal');
  }
  function get(object, key) {
    const property = object.properties.find(p => p.key?.name === key);
    assert.ok(property, `Arcade metadata missing ${key}`);
    return literal(property.value);
  }
  function array(file, name) {
    const declaration = nodes(file).find(n => n.type === 'VariableDeclarator' && n.id.name === name);
    assert.equal(declaration?.init.type, 'ArrayExpression');
    return declaration.init.elements;
  }
  const cranes = array('game.js', 'configs').map(d => ({ id: 'crane-' + get(d, 'type'), name: get(d, 'name'), hint: get(d, 'hint'), icon: '🧸', offset: get(d, 'offset') }));
  const arcadeIcons = { basket: '🏀', moles: '🔨', hockey: '🏒', crystal: '💎', timing: '🌟' };
  const arcade = array('arcade.js', 'templates').map(d => ({ id: get(d, 'type'), name: get(d, 'name'), hint: get(d, 'hint'), icon: arcadeIcons[get(d, 'type')], offset: get(d, 'offset') }));
  const fieldIcons = ['⛳', '🎳', '⚽', '🏹', '⭕', '⚾'];
  const fields = array('fields.js', 'templates').map((d, i) => ({ id: get(d, 'id'), name: get(d, 'name'), hint: get(d, 'hint'), icon: fieldIcons[i], offset: get(d, 'offset') }));
  const video = nodes('videogames.js').filter(n => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'add').map((n, i) => {
    const d = n.arguments[0];
    return { id: get(d, 'id'), name: get(d, 'name'), hint: get(d, 'hint'), icon: get(d, 'icon'), offset: 68 + i * 8 };
  });
  const groups = [
    { id: 'cranes', name: '🧸 クレーンゲーム', entries: cranes },
    { id: 'fields', name: '⛳ 立体スポーツ', entries: fields },
    { id: 'arcade', name: '🏀 スポーツ・お宝', entries: arcade },
    { id: 'video', name: '🕹️ ビデオゲーム', entries: video },
  ];
  const entries = groups.flatMap(g => g.entries);
  assert.deepEqual(groups.map(g => g.entries.length), [6, 6, 5, 20]);
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  for (const e of entries) {
    assert.match(e.id, /^[a-z0-9-]+$/);
    assert.ok(e.name && e.hint && e.icon && Number.isFinite(e.offset));
  }
  return groups;
}
