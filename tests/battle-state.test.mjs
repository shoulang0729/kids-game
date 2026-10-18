import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const data = require("../games/youchan-battle/data.js");
const { createGame } = require("../games/youchan-battle/state.js");
function fresh(random = () => 0.5) {
  const game = createGame(data, { random });
  game.state.battleEnded = false;
  game.state.mode = "infinite";
  return game;
}
test("battle turn: normal damage and gear/ally/critical contribution", () => {
  const game = fresh();
  const result = game.useSkill("attack");
  assert.equal(result.damage, 19);
  assert.equal(game.state.enemyHp, 81);
  assert.equal(game.state.playerHp, 134);
  const critical = fresh(() => 0);
  Object.assign(critical.state, { currentWeapon: { bonus: 15 }, attackBoost: 5, robots: 1, cannons: 1, enemyHp: 1000 });
  assert.equal(critical.useSkill("attack").damage, (14 + 15 + 5 + 10 + 20) * 2);
});
test("battle turn: unavailable skill does not consume HP, a turn, or cooldown", () => {
  const game = fresh();
  game.useSkill("fire");
  assert.equal(game.state.cooldowns.fire, 1);
  const before = JSON.stringify(game.state);
  assert.equal(game.useSkill("fire").status, "cooldown");
  assert.equal(game.useSkill("unknown").status, "blocked");
  assert.equal(JSON.stringify(game.state), before);
  game.defend();
  assert.equal(game.state.cooldowns.fire, 0);
  assert.equal(game.useSkill("fire").status, "acted");
});
test("battle turn: defense halves one hit, base loses half of that, healing is capped", () => {
  const game = fresh();
  game.state.mode = "defense";
  assert.equal(game.defend().damage, 8);
  assert.equal(game.state.playerHp, 142);
  assert.equal(game.state.baseHp, 996);
  game.useSkill("attack");
  assert.equal(game.state.playerHp, 126);
  assert.equal(game.state.baseHp, 988);
  game.state.playerHp = 149;
  game.useSkill("heal");
  assert.equal(game.state.playerHp, 134);
});
test("battle turn: winning prevents retaliation, locks duplicate actions and keeps cooldown", () => {
  const game = fresh();
  game.state.enemyHp = 1;
  assert.equal(game.useSkill("ultimate").won, true);
  assert.equal(game.state.playerHp, 150);
  assert.equal(game.state.enemyHp, 0);
  assert.equal(game.state.cooldowns.ultimate, 5);
  assert.equal(game.useSkill("attack").status, "blocked");
  assert.equal(game.defend().status, "blocked");
});
test("battle turn: player/base defeat is clamped; a destroyed base affects defense only", () => {
  const game = fresh();
  game.state.playerHp = 1;
  assert.equal(game.useSkill("attack").lost, true);
  assert.equal(game.state.playerHp, 0);
  const defense = fresh();
  defense.state.mode = "defense";
  defense.state.baseHp = 1;
  assert.equal(defense.useSkill("attack").lost, true);
  assert.equal(defense.state.baseHp, 0);
  const infinite = fresh();
  infinite.state.baseHp = 0;
  assert.equal(infinite.useSkill("attack").lost, false);
});
test("battle progression: EXP thresholds, HP/attack growth and independent initial state", () => {
  const game = fresh();
  assert.equal(game.addExp(50), false);
  game.state.playerHp = 1;
  assert.equal(game.addExp(50), true);
  assert.equal(game.state.level, 2);
  assert.equal(game.state.exp, 0);
  assert.equal(game.state.nextExp, 200);
  assert.equal(game.state.playerHp, 170);
  assert.equal(game.state.attackBoost, 5);
  assert.equal(fresh().state.level, 1);
  game.state.cooldowns.heal = 3;
  game.state.defending = true;
  game.resetCooldowns();
  assert.ok(Object.values(game.state.cooldowns).every(value => value === 0));
  assert.equal(game.state.defending, false);
});
test("battle shop: prices, capped base repair, equipment and invalid purchases", () => {
  const game = fresh();
  assert.equal(game.buyWeapon("fire"), "insufficient");
  assert.equal(game.buyUpgrade("robot"), "insufficient");
  game.state.coins = 2000;
  game.state.baseHp = 900;
  for (const key of ["hp", "attack", "base", "robot", "cannon"])
    assert.equal(game.buyUpgrade(key), "purchased");
  assert.equal(game.state.coins, 850);
  assert.equal(game.state.playerMaxHp, 170);
  assert.equal(game.state.playerHp, 150);
  assert.equal(game.state.attackBoost, 10);
  assert.equal(game.state.baseHp, 1000);
  assert.equal(game.state.robots, 1);
  assert.equal(game.state.cannons, 1);
  assert.equal(game.buyWeapon("fire"), "purchased");
  assert.equal(game.state.coins, 550);
  assert.equal(game.state.currentWeapon.bonus, 15);
  const before = JSON.stringify(game.state);
  assert.equal(game.buyWeapon("constructor"), "invalid");
  assert.equal(game.buyUpgrade("unknown"), "invalid");
  assert.equal(JSON.stringify(game.state), before);
});

function pageModel() {
  const directory = new URL("../games/youchan-battle/", import.meta.url);
  const html = readFileSync(new URL("index.html", directory), "utf8");
  const elements = new Map(), timers = new Map(), records = [];
  let serial = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, innerText: "" });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => ["selectScreen", "mapScreen", "battleScreen"].map(element) },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }), alert() {},
    setTimeout(fn, delay) { timers.set(++serial, { fn, delay }); return serial; },
    clearTimeout(id) { timers.delete(id); },
    GameRecords: { record(game, value) { records.push({ ...value }); } },
  });
  for (const file of ["rules.js", "data.js", "state.js", "game.js"]) {
    assert.ok(html.includes(`src="${file}"`), `shipped page must load ${file}`);
    vm.runInContext(readFileSync(new URL(file, directory), "utf8"), context);
  }
  const run = code => vm.runInContext(code, context);
  function advance() {
    assert.equal(timers.size, 1);
    const [id, timer] = [...timers][0]; timers.delete(id); timer.fn();
  }
  return { run, elements, timers, records, advance };
}
test("battle page progression: all three boss forms, visible bars/rewards and story ranking", () => {
  const p = pageModel();
  p.run("enterNode(7);battle.attackBoost=10000;useSkill('attack')");
  assert.equal(p.run("battle.bossPhase"), 2);
  assert.equal(p.run("battle.enemyHp"), 500);
  assert.equal(p.elements.get("enemyBar").style.width, "100%");
  assert.equal(p.elements.get("coinsText").innerText, 200);
  p.run("useSkill('attack')");
  assert.equal(p.run("battle.bossPhase"), 3);
  assert.equal(p.run("battle.enemyHp"), 800);
  p.run("useSkill('attack')");
  assert.equal(p.run("battle.battleEnded"), true);
  assert.equal(p.run("battle.coins"), 3600);
  assert.deepEqual(p.records, [{ story: 6 }, { story: 6 }, { story: 7 }]);
  p.advance();
  assert.equal(p.elements.get("selectScreen").style.display, "block");
});
test("battle page progression: 50 defense waves, exact rewards and no 51st-wave ranking", () => {
  const p = pageModel();
  p.run("startDefense();battle.attackBoost=10000");
  for (let wave = 1; wave <= 50; wave++) {
    assert.equal(p.run("battle.defenseWave"), wave);
    assert.equal(p.run("battle.enemyHp"), 120 + wave * 25);
    p.run("useSkill('attack')");
    assert.equal(p.run("battle.battleEnded"), true);
    p.advance();
  }
  assert.equal(p.run("battle.coins"), 15250);
  assert.deepEqual(p.records.map(r => r.defense), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(p.elements.get("selectScreen").style.display, "block");
});
test("battle page progression: infinite enemy/reward scaling, new modes reset cooldowns", () => {
  const p = pageModel();
  p.run("startInfinite();battle.attackBoost=10000;useSkill('attack')");
  assert.equal(p.run("battle.infiniteLevel"), 2);
  assert.equal(p.run("battle.enemyHp"), 280);
  assert.equal(p.run("battle.coins"), 130);
  assert.deepEqual(p.records, [{ infinite: 1 }]);
  p.run("battle.cooldowns.fire=2;startDefense()");
  assert.equal(p.run("battle.cooldowns.fire"), 0);
  p.run("battle.baseHp=0;startInfinite();battle.attackBoost=0;useSkill('attack')");
  assert.equal(p.run("battle.battleEnded"), false);
});
test("battle page progression: old callbacks cannot navigate away from a new mode", () => {
  const p = pageModel();
  p.run("enterNode(1);battle.attackBoost=10000;useSkill('attack')");
  const oldCallback = [...p.timers.values()][0].fn;
  p.run("startInfinite()");
  assert.equal(p.timers.size, 0);
  oldCallback();
  assert.equal(p.elements.get("battleScreen").style.display, "block");
  assert.equal(p.elements.get("mapScreen").style.display, "none");
});
