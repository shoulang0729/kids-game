import { RANKINGS } from "../shared/leaderboard-policy.mjs";
import { profile, setProfile, flush, load } from "../shared/leaderboard-client.mjs";
import { formatScore, ownPosition, syncSummary, recordSummary } from "./view.mjs";
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const localServer = params.get("server");
const dialog = $("name-dialog");
let rankedGames = [], game = null, requestNumber = 0, busy = false;
function pageLink(href) {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(localServer || "")) return href;
  const [target, fragment] = href.split("#");
  return `${target}${target.includes("?") ? "&" : "?"}server=${encodeURIComponent(localServer)}${fragment === undefined ? "" : `#${fragment}`}`;
}
function openEditor() {
  $("name").value = profile().name;
  $("profile-title").textContent = profile().name ? "名前を変更する" : "名前を入力してね";
  $("close-profile").hidden = !profile().name;
  $("code-panel").hidden = true;
  $("code").textContent = "";
  $("copy-status").textContent = "";
  if (!dialog.open) dialog.showModal();
  updateButtons();
  $("name").focus();
}
function closeEditor() {
  if (!profile().name) return;
  if (dialog.open) dialog.close();
}
function updateButtons() {
  $("save").disabled = busy || !$("name").value.trim();
  $("import").disabled = busy;
  $("retry").disabled = busy;
  $("change-name").disabled = busy;
}
function updateProfile() {
  const p = profile(), summary = syncSummary(p);
  $("ranking-content").hidden = !p.name;
  $("change-name").hidden = !p.name;
  $("player-name").textContent = summary.title;
  $("sync-status").textContent = summary.text;
  $("sync-status").parentElement.dataset.state = summary.state;
  $("save").textContent = p.name ? "この名前に変更する" : "次へ";
  $("retry").hidden = !p.name || !p.pending;
  updateButtons();
  if (!p.name && !dialog.open) openEditor();
}
async function initCatalog() {
  try {
    const response = await fetch("../data/games.json");
    if (!response.ok) throw Error("catalog");
    const games = await response.json();
    rankedGames = games.filter(g => Object.hasOwn(RANKINGS, g.id));
  } catch {
    $("intro").textContent = "ゲーム一覧を読み込めませんでした。ページを開き直してください。";
    return;
  }
  const wanted = params.get("game") ?? params.get("return");
  game = rankedGames.find(g => g.id === wanted) || null;
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
  if (game) {
    $("page-title").textContent = `${game.emoji} ${game.title}のランキング`;
    document.title = `${game.title}のランキング - とみよこゲームランド`;
    $("intro").textContent = "比べる記録を選んで、みんなの記録を見よう！";
    $("game-picker").hidden = true;
    $("board-panel").hidden = false;
    $("record-note").hidden = false;
    $("play-link").hidden = false;
    $("play-link").href = pageLink(`../games/${game.id}/${game.entry || "index.html"}`);
    $("play-link").setAttribute("aria-label", `${game.title}を遊ぶ`);
    $("game-choice").value = game.id;
    for (const [key, rule] of Object.entries(RANKINGS[game.id])) $("metric").add(new Option(rule.label, key));
    if (profile().name) void refresh();
  } else if (wanted !== null) {
    $("page-title").textContent = "ゲームが見つかりません";
    $("intro").textContent = "この下の一覧からランキングを選び直してね。";
  }
}
async function publicPlayer() {
  const code = profile().code;
  if (!code) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function refresh() {
  if (!game || !profile().name) return;
  const number = ++requestNumber, metric = $("metric").value, rule = RANKINGS[game.id][metric];
  if (!rule) return;
  $("score-heading").textContent = rule.label;
  $("rows").replaceChildren();
  $("own").textContent = "読み込み中…";
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
    $("own").textContent = recordSummary(result, rule);
    $("board-status").textContent = result.rows.length ? "最新の記録を表示しています。" : "この記録には、まだ参加者がいません。";
    $("board-help").textContent = "ひとりにつき最高記録を1件表示します。";
    updateProfile();
  } catch (e) {
    if (number === requestNumber) {
      $("own").textContent = "読み込めませんでした";
      $("board-status").textContent = e.message;
      $("board-help").textContent = "「最新の記録を見る」で、もう一度試せます。";
    }
  } finally {
    if (number === requestNumber) $("board-panel").setAttribute("aria-busy", "false");
  }
}
function message(text, error = false) {
  for (const id of ["status", "profile-feedback"]) { $(id).textContent = text; $(id).dataset.error = String(error); }
}
async function submit(action) {
  if (busy) return;
  busy = true; updateButtons();
  let persisted = true;
  try {
    if (action !== "retry") {
      if (!$("name").value.trim()) throw Error("名前を入力してね。");
      const imported = action === "import" ? $("import-code").value.trim().toLowerCase() : undefined;
      if (action === "import" && !/^[a-f0-9]{64}$/.test(imported)) throw Error("コードは64文字です。コピーしたコードをもう一度貼り付けてください。");
      persisted = setProfile($("name").value, imported).persisted;
      $("name").value = profile().name;
      updateProfile();
      closeEditor();
      if (game) void refresh();
    } else if (!profile().name) throw Error("名前を入力してね。");
    message("記録を送っています…");
    await flush();
    // A rename during an older in-flight upload leaves the new name queued.
    if (profile().pending) await flush();
    message(`記録の送信が完了しました。${persisted ? "次からは遊ぶだけで自動送信します。" : "このブラウザには保存できません。名前を変更するボタンから引継ぎコードを控えてください。"}`);
    if (game) void refresh();
  } catch (e) {
    message(`${e.message}${!persisted ? " このブラウザには保存できません。引継ぎコードを控えてください。" : ""}`, true);
  } finally {
    busy = false; updateProfile();
  }
}
$("save").onclick = () => submit("save");
$("import").onclick = () => submit("import");
$("retry").onclick = () => submit("retry");
$("change-name").onclick = openEditor;
$("close-profile").onclick = closeEditor;
dialog.addEventListener("cancel", e => { if (!profile().name) e.preventDefault(); });
$("name").oninput = updateButtons;
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
$("game-choice").onchange = () => {
  const id = $("game-choice").value;
  if (profile().name && rankedGames.some(g => g.id === id)) location.href = pageLink(`index.html?game=${encodeURIComponent(id)}`);
};
$("metric").onchange = () => void refresh();
$("refresh").onclick = () => void refresh();
async function syncOnReturn() {
  if (!profile().name) return;
  try { await flush(); if (game) void refresh(); } catch { /* pending summary offers retry */ }
  updateProfile();
}
globalThis.addEventListener("online", () => void syncOnReturn());
globalThis.addEventListener("focus", updateProfile);
$("settings").disabled = false;
updateProfile();
if (profile().name && location.hash === "#profile-panel") openEditor();
const catalogReady = initCatalog();
if (profile().name && profile().pending) void syncOnReturn();
