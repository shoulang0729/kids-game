import test from "node:test";
import assert from "node:assert/strict";
import { RANKINGS, validScores } from "../shared/leaderboard-policy.mjs";
test("rankings distinguish game-specific units, bounds and integer scores", () => {
  assert.equal(validScores("snake", { score: 10 }), true);
  assert.equal(validScores("snake", { score: 1.5 }), false);
  assert.equal(validScores("snake-battle", { meters: 12.3 }), true);
  assert.equal(validScores("planet-smash", { stages: 18 }), true);
  assert.equal(validScores("planet-smash", { stages: 19 }), false);
  assert.equal(validScores("youchan-battle", { defense: 51 }), false);
  for (const value of [-1, Infinity, NaN, "30", null])
    assert.equal(validScores("snake", { score: value }), false);
  assert.equal(validScores("__proto__", { score: 1 }), false);
  assert.equal(validScores("snake", { constructor: 1 }), false);
  assert.equal(validScores("online-demo", { score: 1 }), false);
  assert.equal(validScores("snake", {}), false);
  assert.equal(Object.keys(RANKINGS).length, 10);
});
