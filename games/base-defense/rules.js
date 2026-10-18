(function (root) {
  function canBuild(x, y, range) {
    return Math.abs(x - 9.5) <= range && Math.abs(y - 6.5) <= range;
  }
  function enemyReward(type, wave) {
    return type === "giantBoss" ? 1000 : type === "boss" ? 200 : 20 + wave * 4;
  }
  const api = Object.freeze({ canBuild, enemyReward });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DefenseRules = api;
})(globalThis);
