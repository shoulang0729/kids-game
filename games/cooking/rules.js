(function (root) {
  function getMadeDish(names) {
    if (names.includes("ごはん") && names.includes("切った魚"))
      return { emoji: "🍣", name: "おすしっぽい料理" };
    if (names.includes("ごはん") && names.includes("塩"))
      return { emoji: "🍙", name: "おにぎりっぽい料理" };
    if (names.includes("焼いた肉") && names.includes("パン"))
      return { emoji: "🍔", name: "バーガーっぽい料理" };
    if (names.includes("角切りじゃがいも") && names.includes("カレー粉"))
      return { emoji: "🍛", name: "カレーっぽい料理" };
    if (names.includes("焼いたたまご"))
      return { emoji: "🍳", name: "たまご料理" };
    if (names.includes("千切りにんじん") || names.includes("レタス"))
      return { emoji: "🥗", name: "サラダっぽい料理" };
    if (names.includes("めん") && names.includes("水"))
      return { emoji: "🍜", name: "ラーメンっぽい料理" };
    if (names.includes("小麦粉") && names.includes("砂糖"))
      return { emoji: "🥞", name: "甘い粉料理" };
    if (names.includes("りんご"))
      return { emoji: "🥧", name: "りんごっぽい料理" };
    if (names.includes("いちご") && names.includes("チョコ"))
      return { emoji: "🍓🍫", name: "いちごチョコっぽい料理" };
    if (names.includes("焼いた肉")) return { emoji: "🍖", name: "肉料理" };
    if (names.includes("焼いた魚") || names.includes("切った魚"))
      return { emoji: "🐟", name: "魚料理" };
    if (names.length === 0) return { emoji: "❓", name: "空っぽ料理" };
    return { emoji: "🤢", name: "なぞの料理" };
  }
  function rankFor(score) {
    if (score >= 1000) return "👑伝説の料理王";
    if (score >= 600) return "🏆マスターシェフ";
    if (score >= 300) return "⭐一流シェフ";
    if (score >= 100) return "🍳シェフ";
    return "🥄見習いシェフ";
  }
  function judgeMission(names, mission) {
    const clear = mission.answer.every((item) => names.includes(item));
    const extra = names.filter((item) => !mission.answer.includes(item)).length;
    const point = clear
      ? extra === 0
        ? mission.reward
        : Math.floor(mission.reward * (extra === 1 ? 0.7 : 0.5))
      : 0;
    return { clear, extra, point };
  }
  const api = Object.freeze({ getMadeDish, rankFor, judgeMission });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CookingRules = api;
})(globalThis);
