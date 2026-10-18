import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { Game, TOTAL_SNAKES } from "../online-server/src/snake/game.js";
const require = createRequire(import.meta.url);
const cooking = require("../games/cooking/rules.js");
const planet = require("../games/planet-smash/rules.js");
const battle = require("../games/youchan-battle/rules.js");
const defense = require("../games/base-defense/rules.js");
const chaos = require("../games/chaos-ultra-x/rules.js");

test("cooking: required ingredients, extras, repeated ingredients and reward rounding", () => {
  const mission = { answer: ["たまご", "塩"], reward: 101 };
  assert.deepEqual(cooking.judgeMission(["塩", "たまご"], mission), {
    clear: true,
    extra: 0,
    point: 101,
  });
  assert.equal(
    cooking.judgeMission(["塩", "たまご", "たまご"], mission).point,
    101,
  );
  assert.equal(cooking.judgeMission(["塩"], mission).clear, false);
  assert.equal(cooking.judgeMission(["塩", "たまご", "水"], mission).point, 70);
  assert.equal(
    cooking.judgeMission(["塩", "たまご", "水", "肉"], mission).point,
    50,
  );
  assert.equal(cooking.rankFor(99), "🥄見習いシェフ");
  assert.equal(cooking.rankFor(100), "🍳シェフ");
  assert.equal(cooking.rankFor(1000), "👑伝説の料理王");
  assert.equal(cooking.getMadeDish([]).name, "空っぽ料理");
  assert.equal(cooking.getMadeDish(["ごはん", "切った魚"]).emoji, "🍣");
});
test("planet: damage, rainbow range, poison rewards and final-stage bounds", () => {
  assert.equal(planet.attackDamage({ type: "beam", dmg: 20 }), 20);
  assert.equal(
    planet.attackDamage({ type: "rainbow" }, () => 0),
    3000,
  );
  assert.equal(
    planet.attackDamage({ type: "rainbow" }, () => 0.999999),
    14999,
  );
  assert.equal(planet.reward(20), 1);
  assert.equal(planet.reward(700, 40), 17);
  assert.equal(planet.stageAfterClear(0, 18), 1);
  assert.equal(planet.stageAfterClear(17, 18), 17);
});
test("battle: equipment, companions, critical hits, defense and capped healing", () => {
  assert.equal(battle.strike(20, 10, 5, 2, 1, false), 75);
  assert.equal(battle.strike(20, 10, 5, 2, 1, true), 150);
  assert.equal(battle.defendDamage(19, true), 9);
  assert.equal(battle.defendDamage(19, false), 19);
  assert.equal(battle.heal(90, 30, 100), 100);
});
test("defense: build-range edges and ordinary/boss rewards", () => {
  assert.equal(defense.canBuild(7, 4, 3), true);
  assert.equal(defense.canBuild(6, 4, 3), false);
  assert.equal(defense.canBuild(13, 7, 3), false);
  assert.equal(defense.enemyReward("normal", 10), 60);
  assert.equal(defense.enemyReward("boss", 10), 200);
  assert.equal(defense.enemyReward("giantBoss", 10), 1000);
});
test("chaos: multiple level-ups, boss precedence, drone fusion and nonlethal blast", () => {
  const p = { xp: 0, level: 1, need: 35 };
  assert.equal(chaos.awardXP(p, 200), 3);
  assert.deepEqual(p, { xp: 34, level: 4, need: 106 });
  assert.equal(chaos.bossCount(5), 1);
  assert.equal(chaos.bossCount(10), 2);
  assert.equal(chaos.bossCount(30), 3);
  assert.deepEqual(chaos.formation(65), { turrets: 10, normal: 5, ships: 1 });
  assert.equal(chaos.remainingHP(20, 100, true), 1);
  assert.equal(chaos.remainingHP(20, 5, false), 15);
  assert.equal(chaos.remainingHP(20, -10, false), 20);
  assert.equal(chaos.armoredDamage(10, 1), 1);
});
test("local snake math: boundaries, wraparound, interpolation and meter conversion", () => {
  const context = vm.createContext({ METERS_PER_SEGMENT: 2, Math });
  vm.runInContext(
    readFileSync(
      new URL("../games/snake-battle/math.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  assert.equal(vm.runInContext("clamp(-1,0,1)", context), 0);
  assert.equal(vm.runInContext("lerp(10,20,.5)", context), 15);
  assert.equal(vm.runInContext("easeInOut(2)", context), 1);
  assert.ok(
    Math.abs(
      vm.runInContext("angleDiff(Math.PI-.1,-Math.PI+.1)", context) - 0.2,
    ) < 1e-10,
  );
  assert.equal(vm.runInContext("metersToSegments(2)", context), 8);
  assert.equal(vm.runInContext("metersToSegments(20)", context), 10);
});
const settings = {
  mode: "time",
  minutes: 1,
  size: "s",
  rocks: false,
  cpu: "easy",
};
function game(mode = "time") {
  return new Game({ ...settings, mode }, [
    { id: "human", name: "テスト", color: 0 },
  ]);
}
test("online snake: ten snakes, initial boost, finite inputs and respawn rules", () => {
  const g = game(),
    s = g.snakes[0];
  assert.equal(g.snakes.length, TOTAL_SNAKES);
  assert.ok(s.mass > 2);
  const target = s.target;
  g.input("human", NaN, true);
  assert.equal(s.target, target);
  const mass = s.mass;
  g.input("human", s.angle, true);
  g.move(s);
  assert.ok(s.mass < mass);
  assert.ok(s.stats.boostTime > 0);
  g.kill(s, null, "wall");
  assert.equal(s.alive, false);
  assert.equal(s.stats.deaths, 1);
  g.t = s.deadAt + 5;
  g.tick();
  assert.equal(s.alive, true);
  g.playerLeft("human");
  g.t += 6;
  g.tick();
  assert.equal(s.alive, false);
});
test("online snake: survival ranking prioritizes life and later elimination; time ends once", () => {
  const g = game("survival");
  for (const s of g.snakes) {
    s.alive = false;
    s.stats.deathT = s.idx;
    s.len = 1000;
  }
  g.snakes[0].alive = true;
  g.snakes[0].len = 300;
  assert.equal(g.ranking()[0].id, "human");
  assert.equal(g.ranking()[1].idx, 9);
  const timed = game();
  timed.t = timed.duration;
  timed.tick();
  assert.equal(timed.over, true);
  const t = timed.t;
  timed.tick();
  assert.equal(timed.t, t);
  assert.equal(timed.results().rows.length, TOTAL_SNAKES);
});
