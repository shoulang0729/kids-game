import { RANKINGS } from "../shared/leaderboard-policy.mjs";
import { profile, setProfile, flush, load } from "../shared/leaderboard-client.mjs";
import { formatScore, ownPosition, syncSummary, recordSummary } from "./view.mjs";
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const localServer = params.get("server");
function pageLink(href) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(localServer || "")
    ? `${href}${href.includes("?") ? "&" : "?"}server=${encodeURIComponent(localServer)}` : href;
}
let games = [];
try {
  const response = await fetch("../data/games.json");
  if (!response.ok) throw Error("catalog");
  games = await response.json();
} catch {
  $("intro").textContent = "ゲーム一覧を読み込めませんでした。ページを開き直してください。名前の設定はこの下で使えます。";
}
const rankedGames = games.filter(g => Object.hasOwn(RANKINGS, g.id));
const wanted = params.get("game");
const game = rankedGames.find(g => g.id === wanted);
const returned = rankedGames.find(g => g.id === params.get("return"));
const profileHref = pageLink(game ? `index.html?return=${encodeURIComponent(game.id)}` : "index.html#profile-panel");
$("name").value = profile().name;
$("setup-link").href = profileHref;
for (const item of rankedGames) {
  const link = document.createElement("a");
  link.className = "game-card";
  link.href = pageLink(`index.html?game=${encodeURIComponent(item.id)}`);
  const title = document.createElement("strong");
  title.textContent = `${item.emoji} ${item.title}`;
  const detail = document.createElement("span");
  detail.textContent = Object.values(RANKINGS[item.id]).map(rule => rule.label).join(" / ");
  link.append(title, detail);
  $("game-list").append(link);
  $("game-choice").add(new Option(`${item.emoji} ${item.title}`, item.id));
}
if (wanted !== null) {
  $("profile-panel").hidden = true;
  if (game) {
    $("page-title").textContent = `${game.emoji} ${game.title}のランキング`;
    document.title = `${game.title}のランキング - とみよこゲームランド`;
    $("intro").textContent = "自分の最高記録と、みんなの上位20人を見てみよう！";
    $("board-panel").hidden = false;
    $("game-picker").hidden = true;
    $("record-note").hidden = false;
    $("profile-link").hidden = false;
    $("profile-link").href = profileHref;
    $("play-link").hidden = false;
    $("play-link").textContent = `▶ ${game.title}へ`;
    $("play-link").href = pageLink(`../games/${game.id}/${game.entry || "index.html"}`);
    $("game-choice").value = game.id;
  } else {
    $("page-title").textContent = "ゲームが見つかりません";
    $("intro").textContent = "この下の一覧からランキングを選び直してね。";
  }
} else if (returned) {
  $("return-link").hidden = false;
  $("return-link").classList.add("primary-link");
  $("return-link").href = pageLink(`index.html?game=${encodeURIComponent(returned.id)}`);
  $("return-link").textContent = `🏆 ${returned.title}のランキングへ戻る`;
}
function updateProfile() {
  const p = profile(), summary = syncSummary(p);
  $("player-name").textContent = summary.title;
  $("sync-status").textContent = summary.text;
  $("sync-status").parentElement.dataset.state = summary.state;
  $("setup-link").hidden = !!p.name;
  $("save").textContent = p.name ? "この名前に変更する" : "この名前で始める";
  $("retry").hidden = !p.name || !p.pending;
  if (game && p.name && p.pending) {
    $("setup-link").hidden = false;
    $("setup-link").textContent = "記録を再送する →";
  } else $("setup-link").textContent = "名前を登録する →";
}
let requestNumber = 0, busy = false;
async function publicPlayer() {
  const code = profile().code;
  if (!code) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function refresh() {
  if (!game) return;
  const number = ++requestNumber, metric = $("metric").value, rule = RANKINGS[game.id][metric];
  $("metric-hint").textContent = `${rule.label}で比べます。数字が大きいほど上位です。`;
  $("rows").replaceChildren();
  $("own").textContent = "読み込み中…";
  $("own-rank").textContent = "";
  $("next-goal").textContent = "";
  $("board-status").textContent = "みんなの記録を読み込み中…";
  $("board-help").textContent = "";
  $("board-panel").setAttribute("aria-busy", "true");
  try {
    const [result, player] = await Promise.all([load(game.id, metric), publicPlayer()]);
    if (number !== requestNumber) return;
    const index = ownPosition(result.rows, result.own, player);
    for (const [i, row] of result.rows.entries()) {
      const tr = document.createElement("tr");
      if (i === index) tr.className = "is-you";
      const rank = document.createElement("td");
      rank.textContent = ["🥇 1", "🥈 2", "🥉 3"][i] || String(i + 1);
      if (i < 3) rank.className = "rank-top";
      const name = document.createElement("td");
      name.textContent = row.name;
      if (i === index) { const tag = document.createElement("span"); tag.className = "you-tag"; tag.textContent = "あなた"; name.append(tag); }
      const score = document.createElement("td");
      score.textContent = formatScore(row.score, rule);
      tr.append(rank, name, score);
      $("rows").append(tr);
    }
    if (!result.rows.length) {
      const row = document.createElement("tr"), cell = document.createElement("td");
      cell.colSpan = 3; cell.className = "empty-row"; cell.textContent = "最初の記録に挑戦しよう！";
      row.append(cell); $("rows").append(row);
    }
    const summary = recordSummary(result, profile(), player, rule);
    $("own").textContent = summary.score;
    $("own-rank").textContent = summary.rank;
    $("next-goal").textContent = summary.goal;
    $("board-status").textContent = result.rows.length ? `最新の上位${result.rows.length}人を表示しています。` : "この記録には、まだ参加者がいません。";
    $("board-help").textContent = "ひとりにつき最高記録を1件表示。同じ記録なら、先に出した人が上になります。";
    updateProfile();
  } catch (e) {
    if (number === requestNumber) {
      $("own").textContent = "読み込めませんでした";
      $("board-status").textContent = e.message;
      $("board-help").textContent = "上の「最新の記録を見る」で、もう一度試せます。名前や送信待ちの記録は消えません。";
    }
  } finally {
    if (number === requestNumber) $("board-panel").setAttribute("aria-busy", "false");
  }
}
function message(text, error = false) { $("status").textContent = text; $("status").dataset.error = String(error); }
async function submit(action) {
  if (busy) return;
  busy = true;
  $("save").disabled = $("import").disabled = $("retry").disabled = true;
  let persisted = true;
  try {
    if (action !== "retry") {
      const imported = action === "import" ? $("import-code").value.trim().toLowerCase() : undefined;
      if (action === "import" && !imported) throw Error("別の端末でコピーしたコードを貼り付けてください。");
      if (action === "import" && !/^[a-f0-9]{64}$/.test(imported)) throw Error("コードは64文字です。途中で切れていないか確認して、もう一度貼り付けてください。");
      persisted = setProfile($("name").value, imported).persisted;
      $("name").value = profile().name;
      $("code").textContent = ""; $("code-panel").hidden = true; $("copy-status").textContent = "";
    } else if (!profile().name) throw Error("まず名前を登録してください。");
    message("記録を送っています…"); updateProfile();
    await flush();
    message(`${action === "import" ? "引継ぎコードを設定しました。" : action === "retry" ? "" : "名前を登録しました。"} 記録の送信が完了しました。${persisted ? "次からは遊ぶだけで自動送信します。" : "このブラウザには保存できません。ページを閉じる前に引継ぎコードを控えてください。"}`);
  } catch (e) {
    message(`${e.message}${!persisted ? " このブラウザには保存できません。引継ぎコードを控えてください。" : ""}`, true);
  } finally {
    busy = false;
    $("save").disabled = $("import").disabled = $("retry").disabled = false;
    updateProfile();
  }
}
$("save").onclick = () => void submit("save");
$("import").onclick = () => void submit("import");
$("retry").onclick = () => void submit("retry");
$("name").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void submit("save"); } };
$("show-code").onclick = () => {
  $("copy-status").textContent = "";
  if (!profile().code) { $("copy-status").textContent = "まず上で名前を登録してください。"; return; }
  $("code").textContent = profile().code; $("code-panel").hidden = false;
};
$("copy-code").onclick = async () => {
  const code = profile().code;
  if (!code) return;
  try { await navigator.clipboard.writeText(code); $("copy-status").textContent = "コピーしました！ 自分の別の端末に貼り付けてね。"; }
  catch { $("copy-status").textContent = "自動コピーができませんでした。上のコードを長押ししてコピーしてください。"; }
};
$("hide-code").onclick = () => { $("code-panel").hidden = true; $("code").textContent = ""; $("copy-status").textContent = ""; };
$("game-choice").onchange = () => { location.href = pageLink(`index.html?game=${encodeURIComponent($("game-choice").value)}`); };
$("metric").onchange = () => void refresh();
$("refresh").onclick = () => void refresh();
async function syncOnReturn() {
  try { await flush(); if (game) void refresh(); } catch { /* pending summary offers retry */ }
  updateProfile();
}
globalThis.addEventListener("online", () => void syncOnReturn());
globalThis.addEventListener("focus", updateProfile);
if (game) {
  for (const [key, rule] of Object.entries(RANKINGS[game.id])) $("metric").add(new Option(rule.label, key));
  void refresh();
}
updateProfile();
if (profile().name && profile().pending) void syncOnReturn();
$("settings").disabled = false;
