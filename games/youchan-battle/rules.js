(function (root) {
  function strike(base, weapon, boost, robots, cannons, critical) {
    const damage = base + weapon + boost + robots * 10 + cannons * 20;
    return critical ? damage * 2 : damage;
  }
  function defendDamage(damage, defending) {
    return defending ? Math.floor(damage / 2) : damage;
  }
  function heal(hp, amount, max) {
    return Math.min(max, hp + amount);
  }
  const api = Object.freeze({ strike, defendDamage, heal });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BattleRules = api;
})(globalThis);
