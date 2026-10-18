// Shared by the browser and Worker. Different rules/modes never share a score.
const metric = (label, unit, max, integer = true) => ({
  label,
  unit,
  max,
  integer,
});
export const RANKINGS = {
  snake: { score: metric("最高得点", "点", 10000000) },
  "tap-circle": { score: metric("20秒の最高得点", "点", 100000) },
  "chaos-ultra-x": {
    kills: metric("最高撃破数", "体", 1000000000),
    wave: metric("最高到達WAVE", "", 1000000),
  },
  "base-defense": { wave: metric("最高到達ウェーブ", "", 1000000) },
  "planet-smash": { stages: metric("クリアした惑星", "個", 18) },
  cooking: { points: metric("最高料理ポイント", "pt", 1000000000) },
  "youchan-battle": {
    infinite: metric("無限モード突破数", "戦", 1000000),
    defense: metric("防衛クリア数", "WAVE", 50),
    story: metric("ストーリー進行", "", 7),
  },
  "snake-battle": {
    meters: metric("1Pの最長記録", "m", 1000000000, false),
    kills: metric("1Pの最多撃破", "体", 1000000),
  },
  "snake-battle-online": {
    wins: metric("通算優勝回数", "勝", 1000000000),
    meters: metric("オンライン最長記録", "m", 1000000000, false),
  },
  "kochan-3d-arcade": {
    prizes: metric("景品獲得数", "個", 1000000000),
    kinds: metric("景品の種類", "種類", 20),
  },
};
export function validScores(game, scores) {
  if (
    !Object.hasOwn(RANKINGS, game) ||
    !scores ||
    typeof scores !== "object" ||
    Array.isArray(scores)
  )
    return false;
  const keys = Object.keys(scores);
  return (
    keys.length > 0 &&
    keys.length <= 4 &&
    keys.every((key) => {
      const rule = Object.hasOwn(RANKINGS[game], key) && RANKINGS[game][key];
      const value = scores[key];
      return (
        rule &&
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= rule.max &&
        (!rule.integer || Number.isInteger(value))
      );
    })
  );
}
