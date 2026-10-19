// Small presentation helpers shared by the page and its tests.
export function formatScore(score, rule) {
  return `${Number(score).toLocaleString("ja-JP", { maximumFractionDigits: rule.integer ? 0 : 2 })}${rule.unit}`;
}
export function ownPosition(rows, own, player) {
  // Names and scores are not identities: two players may have the same values.
  if (!own || !player) return -1;
  return rows.findIndex(row => row.player === player);
}
export function syncSummary(p) {
  if (!p.name) return { state: "new", title: "まだ名前を登録していません", text: p.pending ? `このブラウザに${p.pending}ゲーム分の記録があります。名前を登録すると送れます。` : "ランキングを見るだけなら登録はいりません。参加するときに名前を決めよう。" };
  return p.pending
    ? { state: "pending", title: `${p.name} で参加中`, text: `${p.pending}ゲーム分の記録がまだ送れていません。再送してランキングに反映しよう。` }
    : { state: "ready", title: `${p.name} で参加中`, text: "送信待ちの記録はありません。自己ベストを更新すると自動で送ります。" };
}
export function recordSummary(result, p, player, rule) {
  if (!result.own) return { score: "まだ記録がありません", rank: "", goal: p.name ? "ゲームで遊んで最初の記録を作ろう！" : "見るだけでもOK。自分も参加するなら名前を登録しよう。" };
  const index = ownPosition(result.rows, result.own, player);
  let rank = index >= 0 ? `${index + 1}位 / 上位20人` : "上位20人の外";
  if (index < 0 && result.rows.length < 20) rank = "自分の最高記録";
  const higher = result.rows.filter(row => row.score > result.own.score).at(-1);
  const gap = higher ? higher.score - result.own.score + (rule.integer ? 1 : .01) : 0;
  return { score: formatScore(result.own.score, rule), rank, goal: higher ? `次に上の記録をこえるまで、あと${formatScore(gap, rule)}！` : "あなたの最高記録に挑戦しよう！" };
}
