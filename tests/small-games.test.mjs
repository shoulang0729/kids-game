import test from "node:test";
import assert from "node:assert/strict";
import { createTapGame } from "../games/tap-circle/rules.mjs";
import { createSnakeGame, LEVELS } from "../games/snake/rules.mjs";
import { readBest, saveBest } from "../shared/records.mjs";

test("records: preserve old keys and tolerate denied or corrupt storage", () => {
  const entries = new Map([
    ["tapBest", "12"],
    ["snakeBest", "30"],
  ]);
  const getStorage = () => ({
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  });
  assert.equal(readBest("tapBest", getStorage), 12);
  assert.equal(readBest("snakeBest", getStorage), 30);
  saveBest("snakeBest", 40, getStorage);
  assert.equal(entries.get("snakeBest"), "40");
  entries.set("tapBest", "broken");
  assert.equal(readBest("tapBest", getStorage), 0);
  const denied = () => {
    throw Error("storage disabled");
  };
  assert.equal(readBest("snakeBest", denied), 0);
  assert.doesNotThrow(() => saveBest("snakeBest", 50, denied));
});

test("tap: pre-start hits, deadline boundary and repeated finish do not award points", () => {
  const g = createTapGame();
  assert.equal(g.tap(0).scored, false);
  assert.equal(g.start(1000), true);
  assert.equal(g.start(2000), false);
  assert.equal(g.state.endTime, 21000);
  assert.equal(g.tap(20999).scored, true);
  assert.deepEqual(g.tap(21000), {
    scored: false,
    finished: true,
    newRecord: true,
  });
  assert.equal(g.state.score, 1);
  assert.equal(g.state.best, 1);
  assert.equal(g.update(22000).finished, false);
  assert.equal(g.tap(22000).scored, false);
});
test("tap: countdown, expiration without tapping and replay preserve the best", () => {
  const g = createTapGame(5);
  g.start(100);
  assert.equal(g.secondsLeft(100), 20);
  assert.equal(g.secondsLeft(20099), 1);
  assert.equal(g.secondsLeft(20100), 0);
  assert.deepEqual(g.update(20100), { finished: true, newRecord: false });
  g.start(30000);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.best, 5);
  for (let i = 0; i < 6; i++) g.tap(30001 + i);
  assert.equal(g.update(50000).newRecord, true);
  assert.equal(g.state.best, 6);
});
test("snake: movement, no reversal, eating, growth and restart", () => {
  const g = createSnakeGame(() => 0.5),
    s = g.state;
  g.start();
  g.setDirection(-1, 0);
  assert.deepEqual(s.nextDir, { x: 1, y: 0 });
  s.food = { x: 11, y: 10 };
  assert.equal(g.step().ate, true);
  assert.equal(s.score, 10);
  assert.equal(s.snake.length, 4);
  assert.equal(s.speed, 6.25);
  g.setDirection(0, -1);
  g.step();
  assert.deepEqual(s.snake[0], { x: 11, y: 9 });
  g.start();
  assert.equal(s.score, 0);
  assert.equal(s.snake.length, 3);
  assert.equal(s.grid, 20);
});
for (const collision of ["wall", "body", "obstacle"])
  test(`snake: ${collision} ends the round; later steps are inert`, () => {
    const g = createSnakeGame(),
      s = g.state;
    g.start();
    if (collision === "wall") s.snake = [{ x: 19, y: 10 }];
    if (collision === "body")
      s.snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ];
    if (collision === "obstacle") s.obstacles = [{ x: 11, y: 10 }];
    assert.equal(g.step().ended, true);
    const snapshot = structuredClone(s);
    g.step();
    assert.deepEqual(s, snapshot);
  });
test("snake: shrinking grids recenter safely and exclude the next three cells", () => {
  const g = createSnakeGame(() => 0.3),
    s = g.state;
  g.start();
  s.snake = [
    { x: 17, y: 5 },
    { x: 16, y: 5 },
    { x: 15, y: 5 },
  ];
  s.score = 40;
  s.food = { x: 18, y: 5 };
  assert.equal(g.step().levelChanged, true);
  assert.equal(s.grid, 18);
  assert.equal(s.level, 1);
  assert.equal(s.speed, 7.25);
  assert.equal(s.obstacles.length, 2);
  assert.deepEqual(s.snake[0], { x: 9, y: 9 });
  for (const p of [
    ...s.snake,
    { x: 10, y: 9 },
    { x: 11, y: 9 },
    { x: 12, y: 9 },
  ]) {
    assert.ok(!s.obstacles.some((o) => o.x === p.x && o.y === p.y));
  }
  g.applyLevel(999);
  assert.equal(s.level, LEVELS.length - 1);
  assert.equal(s.grid, 10);
  assert.equal(s.obstacles.length, 9);
});
test("snake: food never overlaps the body/obstacles, including a full board", () => {
  const g = createSnakeGame(),
    s = g.state;
  s.snake = [];
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++) s.snake.push({ x, y });
  g.placeFood();
  assert.equal(s.food, null);
  s.snake.pop();
  g.placeFood();
  assert.deepEqual(s.food, { x: 19, y: 19 });
});
