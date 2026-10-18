(function (root) {
  const rules =
    typeof module !== "undefined" && module.exports
      ? require("./rules.js")
      : root.BattleRules;
  // Turn resolution and purchases have no DOM or timer dependency.
  function createGame(
    { skills, weapons, upgradeCosts },
    { random = () => Math.random() } = {},
  ) {
    const state = {
      playerMaxHp: 150,
      playerHp: 150,
      enemyMaxHp: 100,
      enemyHp: 100,
      baseMaxHp: 1000,
      baseHp: 1000,
      enemyAttackPower: 15,
      currentNode: 1,
      infiniteLevel: 1,
      defenseWave: 1,
      coins: 0,
      robots: 0,
      cannons: 0,
      attackBoost: 0,
      mode: "",
      bossPhase: 1,
      level: 1,
      exp: 0,
      nextExp: 100,
      defending: false,
      battleEnded: true,
      currentWeapon: { name: "🗡️ 木の剣", bonus: 0 },
      cooldowns: Object.fromEntries(Object.keys(skills).map((key) => [key, 0])),
    };
    const roll = (min, max) => Math.floor(random() * (max - min + 1)) + min;
    function resetCooldowns() {
      for (const key of Object.keys(state.cooldowns)) state.cooldowns[key] = 0;
      state.defending = false;
    }
    function reduceCooldowns() {
      for (const key of Object.keys(state.cooldowns))
        if (state.cooldowns[key] > 0) state.cooldowns[key]--;
    }
    function enemyTurn() {
      const damage = rules.defendDamage(
        roll(state.enemyAttackPower - 5, state.enemyAttackPower + 7),
        state.defending,
      );
      state.defending = false;
      state.playerHp = Math.max(0, state.playerHp - damage);
      if (state.mode === "defense")
        state.baseHp = Math.max(0, state.baseHp - Math.floor(damage / 2));
      const lost =
        state.playerHp <= 0 || (state.mode === "defense" && state.baseHp <= 0);
      if (lost) state.battleEnded = true;
      return { damage, lost };
    }
    function useSkill(key) {
      if (state.battleEnded || !Object.hasOwn(skills, key))
        return { status: "blocked" };
      if (state.cooldowns[key] > 0) return { status: "cooldown" };
      const skill = skills[key];
      let damage = 0,
        critical = false;
      if (skill.damage) {
        const base = roll(...skill.damage);
        critical = random() < 0.1;
        damage = rules.strike(
          base,
          state.currentWeapon.bonus,
          state.attackBoost,
          state.robots,
          state.cannons,
          critical,
        );
        state.enemyHp = Math.max(0, state.enemyHp - damage);
      }
      if (skill.heal)
        state.playerHp = rules.heal(
          state.playerHp,
          skill.heal,
          state.playerMaxHp,
        );
      state.cooldowns[key] = skill.cooldown;
      if (state.enemyHp <= 0) {
        state.battleEnded = true;
        return { status: "acted", damage, critical, won: true, lost: false };
      }
      const enemy = enemyTurn();
      reduceCooldowns();
      return {
        status: "acted",
        damage,
        critical,
        won: false,
        lost: enemy.lost,
      };
    }
    function defend() {
      if (state.battleEnded) return { status: "blocked" };
      state.defending = true;
      const enemy = enemyTurn();
      reduceCooldowns();
      return { status: "acted", ...enemy };
    }
    function addExp(amount) {
      state.exp += amount;
      const leveled = state.exp >= state.nextExp;
      if (leveled) {
        state.exp -= state.nextExp;
        state.level++;
        state.nextExp += 100;
        state.playerMaxHp += 20;
        state.attackBoost += 5;
        state.playerHp = state.playerMaxHp;
      }
      return leveled;
    }
    function buyUpgrade(key) {
      if (!Object.hasOwn(upgradeCosts, key)) return "invalid";
      if (state.coins < upgradeCosts[key]) return "insufficient";
      state.coins -= upgradeCosts[key];
      if (key === "hp") state.playerMaxHp += 20;
      if (key === "attack") state.attackBoost += 10;
      if (key === "base")
        state.baseHp = rules.heal(state.baseHp, 200, state.baseMaxHp);
      if (key === "robot") state.robots++;
      if (key === "cannon") state.cannons++;
      return "purchased";
    }
    function buyWeapon(key) {
      if (!Object.hasOwn(weapons, key)) return "invalid";
      const weapon = weapons[key];
      if (state.coins < weapon.cost) return "insufficient";
      state.coins -= weapon.cost;
      state.currentWeapon = { name: weapon.name, bonus: weapon.bonus };
      return "purchased";
    }
    return {
      state,
      resetCooldowns,
      useSkill,
      defend,
      addExp,
      buyUpgrade,
      buyWeapon,
    };
  }
  const api = Object.freeze({ createGame });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BattleState = api;
})(globalThis);
