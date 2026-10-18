(function (root) {
  function awardXP(player, value) {
    player.xp += value;
    let count = 0;
    while (player.xp >= player.need) {
      player.xp -= player.need;
      player.level++;
      player.need = Math.floor(player.need * 1.24 + 11);
      count++;
    }
    return count;
  }
  function bossCount(wave) {
    return wave % 15 === 0 ? 3 : wave >= 10 && wave % 10 === 0 ? 2 : 1;
  }
  function formation(drones) {
    return {
      turrets: Math.floor(drones / 6),
      normal: drones % 6,
      ships: Math.floor(drones / 60),
    };
  }
  function remainingHP(hp, damage, nonlethal = false) {
    return nonlethal
      ? Math.max(1, hp - Math.max(0, damage))
      : hp - Math.max(0, damage);
  }
  function armoredDamage(value, armor) {
    return Math.max(1, Math.round(value * (1 - armor)));
  }
  const api = Object.freeze({
    awardXP,
    bossCount,
    formation,
    remainingHP,
    armoredDamage,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ChaosRules = api;
})(globalThis);
