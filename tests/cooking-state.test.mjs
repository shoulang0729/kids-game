import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createGame } = require("../games/cooking/state.js");
const data = require("../games/cooking/data.js");
const create = () => createGame({ ...data, random: () => 0.5 });
function prepare(game, extras = []) {
  const mission = game.start();
  for (const name of [...mission.answer, ...extras]) game.addIngredient("🍴", name);
  return mission;
}
function cook(game, extras = []) {
  prepare(game, extras);
  return game.finishMix(game.beginMix());
}

test("cooking progress: initial inventory and only makeable missions", () => {
  const game = create();
  assert.equal(game.state.money, 500);
  assert.equal(game.state.score, 0);
  assert.equal(game.beginMix(), null);
  assert.equal(game.pass(), null);
  assert.equal(game.start().success, "たまご焼き");
  assert.ok(game.canMakeItem("焼いたたまご"));
  assert.ok(!game.canMakeItem("切った魚"));
});
for (const [extras, point, stars] of [[[], 100, 3], [["水"], 70, 2], [["水", "にんじん"], 50, 1]]) {
  test(`cooking progress: ${stars} stars, one reward and one book entry`, () => {
    const game = create();
    const result = cook(game, extras);
    assert.equal(result.kind, "success");
    assert.equal(result.point, point);
    assert.equal(result.stars, stars);
    assert.equal(game.state.score, point);
    assert.equal(game.state.money, 500 + point);
    assert.deepEqual(game.state.madeDishes, ["たまご焼き"]);
    assert.equal(game.state.history.length, 1);
    assert.equal(game.state.phase, "finished");
    assert.equal(game.beginMix(), null);
    assert.equal(game.pass(), null);
    cook(game);
    assert.deepEqual(game.state.madeDishes, ["たまご焼き"]);
  });
}
test("cooking progress: mixing locks the recipe and pays at most once", () => {
  const game = create();
  prepare(game);
  const token = game.beginMix();
  assert.equal(game.beginMix(), null);
  assert.equal(game.addIngredient("💧", "水"), false);
  assert.equal(game.removeIngredient(0), false);
  assert.equal(game.pass(), null);
  assert.equal(game.finishMix({ ...token }), null);
  assert.equal(game.finishMix(token).point, 100);
  assert.equal(game.finishMix(token), null);
  assert.equal(game.state.score, 100);
  assert.equal(game.state.history.length, 1);
});
test("cooking progress: restarting invalidates old completions even during another mix", () => {
  const game = create();
  prepare(game);
  const old = game.beginMix();
  prepare(game);
  const current = game.beginMix();
  assert.equal(game.finishMix(old), null);
  assert.equal(game.state.phase, "mixing");
  assert.equal(game.state.score, 0);
  assert.equal(game.state.history.length, 0);
  assert.equal(game.finishMix(current).point, 100);
});
test("cooking progress: failure has no reward/book entry; removal and next attempt work", () => {
  const game = create();
  prepare(game);
  assert.equal(game.removeIngredient(-1), false);
  assert.equal(game.removeIngredient(99), false);
  assert.equal(game.removeIngredient(0), true);
  const result = game.finishMix(game.beginMix());
  assert.equal(result.kind, "failure");
  assert.equal(game.state.score, 0);
  assert.equal(game.state.money, 500);
  assert.deepEqual(game.state.madeDishes, []);
  assert.equal(game.state.history.length, 1);
  assert.equal(cook(game).kind, "success");
});
test("cooking progress: pass is unlocked by success and pays 30% once", () => {
  const game = create();
  prepare(game);
  assert.equal(game.pass(), null);
  game.finishMix(game.beginMix());
  game.start();
  const result = game.pass();
  assert.equal(result.kind, "pass");
  assert.equal(result.point, 30);
  assert.equal(game.pass(), null);
  assert.equal(game.beginMix(), null);
  assert.equal(game.state.score, 130);
  assert.equal(game.state.money, 630);
  assert.equal(game.state.history.length, 2);
});
test("cooking progress: purchases use catalog prices, no duplicates/overspending", () => {
  const game = create();
  assert.equal(game.buyFood("チーズ"), "purchased");
  assert.equal(game.buyFood("チーズ"), "owned");
  assert.equal(game.buyFood("魚"), "insufficient");
  assert.equal(game.buyFood("unknown"), "unknown");
  assert.equal(game.state.money, 200);
  assert.equal(game.buyFood("レタス"), "purchased");
  assert.equal(game.state.money, 80);
  const salad = createGame({ ...data, random: () => 0 });
  salad.buyFood("レタス");
  assert.equal(salad.start().success, "にんじんサラダ");
});
test("cooking progress: history keeps last six, independent game instances", () => {
  const game = create();
  for (let i = 0; i < 8; i++) cook(game);
  assert.equal(game.state.history.length, 6);
  assert.equal(game.state.score, 800);
  assert.equal(create().state.score, 0);
});
test("cooking progress: no available mission and rare-only mission pool", () => {
  const unavailable = createGame({ missions: [data.missions[0]], shopFoods: [], random: () => 0.5 });
  assert.equal(unavailable.start(), null);
  assert.equal(unavailable.beginMix(), null);
  assert.equal(unavailable.pass(), null);
  const rare = { ...data.missions[1], rare: true };
  const game = createGame({ missions: [rare], shopFoods: [], random: () => 0.99 });
  assert.equal(game.start(), rare);
});
