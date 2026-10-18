import { RANKINGS } from "../shared/leaderboard-policy.mjs";
import {
  profile,
  setProfile,
  flush,
  load,
} from "../shared/leaderboard-client.mjs";
const $ = (id) => document.getElementById(id);
const games = await (await fetch("../data/games.json")).json();
const params = new URLSearchParams(location.search);
const localServer = params.get("server");
function pageLink(href) {
  // Match the client allowlist so local test records stay on the local API.
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(localServer || "")
    ? `${href}${href.includes("?") ? "&" : "?"}server=${encodeURIComponent(localServer)}`
    : href;
}
const wanted = params.get("game");
const game = games.find(g => g.id === wanted && Object.hasOwn(RANKINGS, g.id));
const returned = games.find(g => g.id === params.get("return") && Object.hasOwn(RANKINGS, g.id));
if (wanted !== null) {
  $("profile-panel").hidden = true;
  if (game) {
    $("page-title").textContent = `${game.emoji} ${game.title}のランキング`;
    document.title = `${game.title}のランキング - とみよこゲームランド`;
    $("intro").textContent = "このゲームの上位20件と、自分の最高記録です。";
    $("board-panel").hidden = false;
    $("record-note").hidden = false;
    $("profile-link").hidden = false;
    $("profile-link").href = pageLink(`index.html?return=${encodeURIComponent(game.id)}`);
    $("play-link").hidden = false;
    $("play-link").textContent = `${game.title}へ`;
    $("play-link").href = pageLink(`../games/${game.id}/${game.entry || "index.html"}`);
  } else {
    $("page-title").textContent = "ゲームが見つかりません";
    $("intro").textContent = "ゲームランドの一覧からランキングを選び直してください。";
  }
} else if (returned) {
  $("return-link").hidden = false;
  $("return-link").href = pageLink(`index.html?game=${encodeURIComponent(returned.id)}`);
  $("return-link").textContent = `${returned.title}のランキングへ戻る`;
}
$("name").value = profile().name;
let requestNumber = 0;
function metrics() {
  $("metric").replaceChildren();
  for (const [key, rule] of Object.entries(RANKINGS[game.id]))
    $("metric").add(new Option(rule.label, key));
}
async function refresh() {
  if (!game) return;
  const number = ++requestNumber,
    gameId = game.id,
    metric = $("metric").value;
  $("rows").replaceChildren();
  $("own").textContent = "";
  $("board-status").textContent = "読み込み中…";
  try {
    const result = await load(gameId, metric);
    if (number !== requestNumber) return;
    const unit = RANKINGS[gameId][metric].unit;
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
    if (game) await refresh();
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
    if (game) await refresh();
  } catch (e) {
    $("status").textContent = e.message;
  }
};
$("metric").onchange = () => {
  void refresh();
};
$("refresh").onclick = () => {
  void refresh();
};
if (game) {
  metrics();
  void refresh();
}

$("settings").disabled = false;
