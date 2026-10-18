import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const data = require("../games/planet-smash/data.js");
const { createGame } = require("../games/planet-smash/state.js");
const create = (random = () => 0.5) => createGame({ ...data, random });
function advance(game, count) {
  for (let i = 0; i < count; i++) game.damage(game.state.hp);
}
function poisonGame() {
  const game = create();
  advance(game, 8);
  assert.equal(game.chooseAttack(8).status, "unlocked");
  return game;
}
test("planet progress: independent games and catalog; reset restores purchases and progress", () => {
  const game = create();
  assert.equal(game.state.hp, 3000);
  assert.equal(game.state.selected, 0);
  assert.equal(game.state.money, 0);
  game.attack();
  assert.equal(game.state.hp, 2980);
  assert.equal(game.state.money, 1);
  assert.equal(create().state.hp, 3000);
  advance(game, 2);
  game.chooseAttack(1);
  game.reset();
  assert.equal(game.state.stage, 0);
  assert.equal(game.state.completed, 0);
  assert.equal(game.state.cleared, false);
  assert.equal(game.state.hp, 3000);
  assert.equal(game.state.money, 0);
  assert.deepEqual(game.state.attacks.map(a => a.unlocked), data.attacks.map(a => a.unlocked));
  assert.equal(data.attacks[1].unlocked, false);
});
test("planet progress: insufficient funds, one-time purchase, free selection and invalid indices", () => {
  const game = create();
  assert.equal(game.chooseAttack(1).status, "insufficient");
  assert.equal(game.state.selected, 0);
  assert.equal(game.chooseAttack(-1), null);
  assert.equal(game.chooseAttack(100), null);
  assert.equal(game.chooseAttack(0.5), null);
  const transition = game.damage(3000).transition;
  assert.deepEqual(transition, { clearedStage: 0, completed: 1, bonus: 500, cleared: false });
  assert.equal(game.state.hp, 7000);
  assert.equal(game.chooseAttack(1).status, "unlocked");
  assert.equal(game.state.money, 0);
  assert.equal(game.chooseAttack(0).status, "selected");
  assert.equal(game.chooseAttack(1).status, "selected");
  assert.equal(game.state.money, 0);
  assert.equal(game.attack().damage, 80);
  assert.equal(game.state.money, 3);
});
test("planet progress: direct-hit money plus clear bonus without carrying excess damage", () => {
  const game = create();
  game.damage(2990);
  const result = game.attack();
  assert.equal(result.reward, 1);
  assert.equal(result.transition.completed, 1);
  assert.equal(game.state.money, 501);
  assert.equal(game.state.stage, 1);
  assert.equal(game.state.hp, 7000);
});
test("planet progress: poison ticks five times with original damage and rewards", () => {
  const game = poisonGame();
  const before = { hp: game.state.hp, money: game.state.money };
  const hit = game.attack();
  assert.equal(hit.damage, 1200);
  assert.equal(hit.reward, 48);
  for (let i = 0; i < 5; i++) {
    const tick = game.tickPoison(hit.poison);
    assert.equal(tick.damage, 700);
    assert.equal(tick.reward, 17);
    assert.equal(tick.active, i < 4);
  }
  assert.equal(game.tickPoison(hit.poison), null);
  assert.equal(game.state.hp, before.hp - 1200 - 700 * 5);
  assert.equal(game.state.money, before.money + 48 + 17 * 5);
});
test("planet progress: lethal poison hit never registers a timer on the next planet", () => {
  const game = poisonGame();
  game.damage(game.state.hp - 100);
  const result = game.attack();
  assert.ok(result.transition);
  assert.equal(result.poison, null);
  assert.equal(game.state.hp, data.stages[game.state.stage].hp);
});
test("planet progress: poison stacks and all pending ticks expire at stage change/reset", () => {
  const game = poisonGame();
  const a = game.attack().poison, b = game.attack().poison;
  game.damage(game.state.hp - 500);
  const transition = game.tickPoison(a).transition;
  assert.ok(transition);
  const snapshot = JSON.stringify(game.state);
  assert.equal(game.tickPoison(a), null);
  assert.equal(game.tickPoison(b), null);
  assert.equal(JSON.stringify(game.state), snapshot);
  const pending = game.attack().poison;
  game.reset();
  assert.equal(game.tickPoison(pending), null);
  assert.equal(game.state.hp, 3000);
});
test("planet progress: all 18 stage HP/bonuses and final clear counted once", () => {
  const game = create();
  let bonuses = 0;
  for (let i = 0; i < 18; i++) {
    assert.equal(game.state.stage, i);
    assert.equal(game.state.hp, data.stages[i].hp);
    assert.equal(game.state.maxHp, data.stages[i].hp);
    const result = game.damage(game.state.hp);
    assert.equal(result.transition.completed, i + 1);
    assert.equal(result.transition.cleared, i === 17);
    bonuses += data.stages[i].bonus;
    assert.equal(game.state.money, bonuses);
  }
  assert.equal(game.state.hp, 0);
  assert.equal(game.state.completed, 18);
  const snapshot = JSON.stringify(game.state);
  assert.equal(game.attack(), null);
  assert.equal(game.damage(100), null);
  assert.equal(JSON.stringify(game.state), snapshot);
});
test("planet progress: rainbow keeps its 3000..14999 damage range", () => {
  for (const [random, damage] of [[() => 0, 3000], [() => 0.999999, 14999]]) {
    const game = create(random);
    advance(game, 9);
    game.chooseAttack(9);
    assert.equal(game.attack().damage, damage);
  }
});
