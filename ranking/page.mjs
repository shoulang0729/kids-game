import { RANKINGS } from "../shared/leaderboard-policy.mjs";
import {
  profile,
  setProfile,
  flush,
  load,
} from "../shared/leaderboard-client.mjs";
const $ = (id) => document.getElementById(id);
const games = await (await fetch("../data/games.json")).json();
for (const game of games.filter((g) => RANKINGS[g.id]))
  $("game").add(new Option(game.title, game.id));
const wanted = new URLSearchParams(location.search).get("game");
if (wanted && Object.hasOwn(RANKINGS, wanted)) $("game").value = wanted;
$("name").value = profile().name;
let requestNumber = 0;
function metrics() {
  $("metric").replaceChildren();
  for (const [key, rule] of Object.entries(RANKINGS[$("game").value]))
    $("metric").add(new Option(rule.label, key));
}
async function refresh() {
  const number = ++requestNumber,
    game = $("game").value,
    metric = $("metric").value;
  $("rows").replaceChildren();
  $("own").textContent = "";
  $("board-status").textContent = "読み込み中…";
  try {
    const result = await load(game, metric);
    if (number !== requestNumber) return;
    const unit = RANKINGS[game][metric].unit;
    for (const [i, row] of result.rows.entries()) {
      const tr = document.createElement("tr");
      for (const text of [i + 1, row.name, `${row.score}${unit}`]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      $("rows").append(tr);
    }
    $("own").textContent = result.own
      ? `自分の最高記録：${result.own.score}${unit}`
      : "自分の記録はまだありません。";
    $("board-status").textContent = result.rows.length
      ? "上位20件"
      : "まだ記録がありません。";
  } catch (e) {
    if (number === requestNumber) $("board-status").textContent = e.message;
  }
}
async function save(code) {
  try {
    const result = setProfile($("name").value, code);
    $("status").textContent = result.persisted
      ? "名前を登録しました。"
      : "このブラウザには保存できません。引継ぎコードを控えてください。";
    await flush();
    $("status").textContent += " 記録の送信が完了しました。";
    await refresh();
  } catch (e) {
    $("status").textContent = e.message;
  }
}
$("save").onclick = () => {
  void save();
};
$("import").onclick = () => {
  void save($("import-code").value.trim().toLowerCase());
};
$("show-code").onclick = () => {
  $("code").textContent = profile().code || "まず名前を登録してください。";
};
$("retry").onclick = async () => {
  try {
    if (!profile().name) throw Error("まず名前を登録してください。");
    await flush();
    $("status").textContent = "記録の送信が完了しました。";
    await refresh();
  } catch (e) {
    $("status").textContent = e.message;
  }
};
$("game").onchange = () => {
  metrics();
  void refresh();
};
$("metric").onchange = () => {
  void refresh();
};
$("refresh").onclick = () => {
  void refresh();
};
metrics();
void refresh();
