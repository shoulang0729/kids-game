(function (root) {
  const rules =
    typeof module !== "undefined" && module.exports
      ? require("./rules.js")
      : root.CookingRules;

  // The model owns progress; the page owns the two-second animation and rendering.
  function createGame({ missions, shopFoods, random = Math.random }) {
    const state = {
      bowl: [],
      score: 0,
      money: 500,
      currentMission: null,
      history: [],
      madeDishes: [],
      unlockedFoods: ["にんじん", "たまご", "塩", "水"],
      phase: "idle",
    };
    let pending = null;
    const editable = () =>
      state.phase === "idle" || state.phase === "preparing";
    function canMakeItem(item) {
      for (const food of [
        "にんじん",
        "じゃがいも",
        "たまねぎ",
        "たまご",
        "肉",
        "魚",
      ])
        if (item.includes(food)) return state.unlockedFoods.includes(food);
      return state.unlockedFoods.includes(item);
    }
    function start() {
      // Invalidates the old completion token even if its timer has already fired.
      pending = null;
      state.bowl = [];
      const possible = missions.filter((m) => m.answer.every(canMakeItem));
      const rares = possible.filter((m) => m.rare);
      const normals = possible.filter((m) => !m.rare);
      const rare = random() < 0.15;
      const pool =
        rare && rares.length ? rares : normals.length ? normals : rares;
      state.currentMission = pool.length
        ? pool[Math.floor(random() * pool.length)]
        : null;
      state.phase = state.currentMission ? "preparing" : "idle";
      return state.currentMission;
    }
    function addIngredient(emoji, name) {
      if (!editable()) return false;
      state.bowl.push({ emoji, name });
      return true;
    }
    function removeIngredient(index) {
      if (
        !editable() ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= state.bowl.length
      )
        return false;
      state.bowl.splice(index, 1);
      return true;
    }
    function buyFood(name) {
      const item = shopFoods.find((item) => item.name === name);
      if (!item) return "unknown";
      if (state.unlockedFoods.includes(name)) return "owned";
      if (state.money < item.price) return "insufficient";
      state.money -= item.price;
      state.unlockedFoods.push(name);
      return "purchased";
    }
    function beginMix() {
      if (state.phase !== "preparing") return null;
      state.phase = "mixing";
      pending = {
        mission: state.currentMission,
        names: state.bowl.map((x) => x.name),
      };
      return pending;
    }
    function complete(result) {
      state.phase = "finished";
      state.score += result.point;
      state.money += result.point;
      state.history.push(result);
      if (state.history.length > 6) state.history.shift();
      if (
        result.kind === "success" &&
        !state.madeDishes.includes(result.mission.success)
      )
        state.madeDishes.push(result.mission.success);
      return result;
    }
    function finishMix(token) {
      if (!token || pending !== token || state.phase !== "mixing") return null;
      pending = null;
      const { mission, names } = token;
      const { clear, extra, point } = rules.judgeMission(names, mission);
      return complete({
        kind: clear ? "success" : "failure",
        mission,
        point,
        stars: clear ? (extra === 0 ? 3 : extra === 1 ? 2 : 1) : 0,
        dish: clear
          ? { emoji: mission.dish, name: mission.success }
          : rules.getMadeDish(names),
      });
    }
    function pass() {
      if (
        state.phase !== "preparing" ||
        !state.madeDishes.includes(state.currentMission.success)
      )
        return null;
      const mission = state.currentMission;
      return complete({
        kind: "pass",
        mission,
        point: Math.floor(mission.reward * 0.3),
        stars: 0,
        dish: { emoji: mission.dish, name: mission.success },
      });
    }
    return {
      state,
      canMakeItem,
      start,
      addIngredient,
      removeIngredient,
      buyFood,
      beginMix,
      finishMix,
      pass,
    };
  }
  const api = Object.freeze({ createGame });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CookingState = api;
})(globalThis);
