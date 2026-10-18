(function (root) {
  function attackDamage(attack, random = Math.random) {
    return attack.type === "rainbow"
      ? 3000 + Math.floor(random() * 12000)
      : attack.dmg;
  }
  function reward(damage, divisor = 25) {
    return Math.max(1, Math.floor(damage / divisor));
  }
  function stageAfterClear(stage, count) {
    return Math.min(stage + 1, count - 1);
  }
  const api = Object.freeze({ attackDamage, reward, stageAfterClear });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PlanetRules = api;
})(globalThis);
