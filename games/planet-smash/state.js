(function (root) {
  const rules =
    typeof module !== "undefined" && module.exports
      ? require("./rules.js")
      : root.PlanetRules;
  function createGame({ stages, attacks, random = Math.random }) {
    const state = { attacks: attacks.map((attack) => ({ ...attack })) };
    const poisons = new Set();
    function reset() {
      poisons.clear();
      Object.assign(state, {
        stage: 0,
        money: 0,
        hp: stages[0].hp,
        maxHp: stages[0].hp,
        selected: 0,
        cleared: false,
        completed: 0,
      });
      state.attacks.forEach((attack, i) => {
        attack.unlocked = i === 0;
      });
    }
    function chooseAttack(index) {
      if (!Number.isInteger(index) || !state.attacks[index]) return null;
      const attack = state.attacks[index];
      if (attack.unlocked) {
        state.selected = index;
        return { status: "selected", attack };
      }
      if (state.money < attack.cost) return { status: "insufficient", attack };
      state.money -= attack.cost;
      attack.unlocked = true;
      state.selected = index;
      return { status: "unlocked", attack };
    }
    function damage(amount) {
      if (state.cleared || !Number.isFinite(amount) || amount <= 0) return null;
      state.hp = Math.max(0, state.hp - amount);
      if (state.hp > 0) return { transition: null };
      const clearedStage = state.stage;
      state.completed = Math.max(state.completed, clearedStage + 1);
      // All poison belongs to the planet on which it was fired.
      poisons.clear();
      if (clearedStage === stages.length - 1) {
        state.cleared = true;
        return {
          transition: {
            clearedStage,
            completed: state.completed,
            bonus: 0,
            cleared: true,
          },
        };
      }
      const bonus = stages[clearedStage].bonus;
      state.money += bonus;
      state.stage = rules.stageAfterClear(clearedStage, stages.length);
      state.hp = state.maxHp = stages[state.stage].hp;
      return {
        transition: {
          clearedStage,
          completed: state.completed,
          bonus,
          cleared: false,
        },
      };
    }
    function attack() {
      if (state.cleared) return null;
      const attack = state.attacks[state.selected];
      const amount = rules.attackDamage(attack, random);
      const reward = rules.reward(amount);
      state.money += reward;
      const { transition } = damage(amount);
      let poison = null;
      if (attack.type === "poison" && !transition) {
        poison = { remaining: 5 };
        poisons.add(poison);
      }
      return { attack, damage: amount, reward, transition, poison };
    }
    function tickPoison(token) {
      if (!poisons.has(token) || state.cleared) return null;
      const amount = 700,
        reward = rules.reward(amount, 40);
      state.money += reward;
      token.remaining--;
      const { transition } = damage(amount);
      if (!token.remaining) poisons.delete(token);
      return { damage: amount, reward, transition, active: poisons.has(token) };
    }
    reset();
    return { state, reset, chooseAttack, damage, attack, tickPoison };
  }
  const api = Object.freeze({ createGame });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PlanetState = api;
})(globalThis);
