// Names and scores are not identities: equal values may belong to different people.
export function formatScore(score, rule) {
  return `${Number(score).toLocaleString("ja-JP", { maximumFractionDigits: rule.integer ? 0 : 2 })}${rule.unit}`;
}
export function ownPosition(rows, own, player) {
  return own && player ? rows.findIndex(row => row.player === player) : -1;
}
export function syncSummary(p) {
  if (!p.name) return { state: "new", title: "名前を入力してね", text: "名前を登録するとランキングに進めます。" };
  return p.pending
    ? { state: "pending", title: `${p.name} で参加中`, text: `${p.pending}ゲーム分の記録が送信待ちです。再送して反映しよう。` }
    : { state: "ready", title: `${p.name} で参加中`, text: "自己ベストを更新すると自動で送ります。" };
}
export function recordSummary(result, rule) {
  return result.own ? formatScore(result.own.score, rule) : "まだ記録がありません";
}
