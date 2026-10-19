"use strict";
// ▼ サーバーの場所（?server=127.0.0.1:8787 でテスト用サーバーに切りかえ）
const SERVER =
  new URLSearchParams(location.search).get("server") || "tomiyoko-online.shoulang.workers.dev";
const ROOM_CODE = /^[0-9A-Za-z_\-぀-ゟ゠-ヿ一-鿿]{1,20}$/;
const COLORS = [
  "#4fc3ff",
  "#ff4d6d",
  "#5dff87",
  "#ffd84d",
  "#b06cff",
  "#ff8d3b",
  "#ff5ce1",
  "#4de1d2",
];
const ORB_COLORS = [...COLORS, "#ffffff"];
const ITEMS = [
  { e: "⚡", n: "スピード", c: "#ffd84d", toast: "⚡ スピードアップ!" },
  { e: "🛡️", n: "シールド", c: "#4fc3ff", toast: "🛡️ シールドゲット!" },
  { e: "🧲", n: "マグネット", c: "#ff5ce1", toast: "🧲 マグネット!" },
  { e: "👻", n: "すりぬけ", c: "#b06cff", toast: "👻 すりぬけ!" },
  { e: "🍎", n: "大きいエサ", c: "#ff4d6d", toast: "🍎 ぐーんと長くなった!" },
];
const F = { BOOST: 1, SHIELD: 2, GHOST: 4, SPEED: 8, MAGNET: 16, PROTECT: 32, DEAD: 64 };
const M_PER_UNIT = 1 / 32;
const INTERP_DELAY = 0.1; // 少し前の時刻を描くと、なめらかになる
const RESPAWN_SEC = 5;

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) {
    try {
      return localStorage.getItem("sbo." + k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("sbo." + k, v);
    } catch {}
  },
};
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const lerp = (a, b, k) => a + (b - a) * k;
const angleDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

// ================= 画面の切りかえ =================
function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("on", s.id === id);
  current = id;
  if (id === "game") {
    resize();
    requestWakeLock();
  }
}
let current = "join";

// ================= 音 =================
let audio = null;
let muted = store.get("mute", "0") === "1";
function tone(freq, dur, vol = 0.05, type = "sine", delay = 0) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {}
}
let lastEatSound = 0;
// ザーッという音（倒したときの「ドカーン」に使う）
function noise(dur, vol, freq) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const length = Math.floor(audio.sampleRate * dur);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      g = audio.createGain();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    g.gain.value = vol;
    src.buffer = buffer;
    src.connect(filter).connect(g).connect(audio.destination);
    src.start();
  } catch {}
}

// ▼ eat / kill / death / boost / firstPlace は、こうちゃんの「スネークバトル」と同じ音
const sfx = {
  eat() {
    const n = performance.now();
    if (n - lastEatSound < 32) return;
    lastEatSound = n;
    tone(820 + Math.random() * 90, 0.055, 0.035, "square");
    tone(1180 + Math.random() * 100, 0.035, 0.018, "sine", 0.018);
  },
  kill() {
    tone(180, 0.16, 0.1, "sawtooth");
    tone(105, 0.22, 0.08, "square", 0.03);
    tone(75, 0.27, 0.07, "sawtooth", 0.055);
    noise(0.16, 0.075, 1500);
  },
  death() {
    tone(95, 0.3, 0.12, "sawtooth");
    tone(65, 0.42, 0.1, "square", 0.025);
    tone(42, 0.48, 0.08, "sine", 0.06);
  },
  boost() {
    tone(160, 0.1, 0.035, "sawtooth");
    tone(240, 0.13, 0.03, "triangle", 0.03);
    tone(340, 0.17, 0.025, "sine", 0.07);
  },
  firstPlace() {
    tone(523.25, 0.11, 0.06, "square");
    tone(659.25, 0.11, 0.06, "square", 0.12);
    tone(783.99, 0.12, 0.07, "square", 0.24);
    tone(1046.5, 0.27, 0.08, "sine", 0.36);
  },
  // ▼ ここから下は元のゲームにない場面の音
  item() {
    tone(660, 0.08, 0.06, "square");
    tone(990, 0.12, 0.06, "square", 0.08);
    tone(1320, 0.16, 0.05, "sine", 0.16);
  },
  shield() {
    tone(1200, 0.08, 0.05, "triangle");
    tone(700, 0.15, 0.05, "triangle", 0.06);
  },
  beep() {
    tone(660, 0.12, 0.06, "square");
  },
  go() {
    tone(990, 0.3, 0.07, "square");
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 0.06, "square", i * 0.13));
  },
};
// ===== BGM（こうちゃんの「スネークバトル」と同じ曲） =====
const BGM_MELODY = [
  261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23, 261.63, 329.63, 392.0, 523.25,
  440.0, 392.0, 329.63, 293.66,
];
const BGM_BASS = [130.81, 130.81, 146.83, 146.83, 110.0, 110.0, 130.81, 130.81];
let bgmTimer = null,
  bgmStep = 0;
function bgmNote() {
  tone(BGM_MELODY[bgmStep % BGM_MELODY.length], 0.17, 0.018, "triangle");
  if (bgmStep % 2 === 0)
    tone(BGM_BASS[Math.floor(bgmStep / 2) % BGM_BASS.length], 0.28, 0.018, "sine");
  bgmStep++;
}
function startBGM() {
  stopBGM();
  bgmStep = 0;
  bgmNote();
  bgmTimer = setInterval(bgmNote, 220);
}
function stopBGM() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

function updateMuteButtons() {
  for (const id of ["muteBtn1", "muteBtn2"]) $(id).textContent = muted ? "🔇" : "🔊";
}
for (const id of ["muteBtn1", "muteBtn2"])
  $(id).onclick = () => {
    muted = !muted;
    store.set("mute", muted ? "1" : "0");
    updateMuteButtons();
  };
updateMuteButtons();

let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}
}

// ================= 通信 =================
let ws = null,
  myId = null,
  lobby = null,
  roomCode = "",
  leaving = false;
let controlMode = store.get("control", "stick");

$("nameIn").value = store.get("name", "");
$("codeIn").value = store.get("code", "");
$("enterBtn").onclick = join;
$("codeIn").addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});






for (const id of ["leaveBtn1", "leaveBtn2", "leaveBtn3"]) $(id).onclick = leave;
setInterval(() => send({ t: "p" }), 5000);

// ================= ロビー =================
function onLobby(m) {
  lobby = m;
  if (current === "join") show("lobby");
  renderLobby();
}

const SETTING_NOTES = {
  time: "制限時間がきたとき いちばん長いヘビの勝ち。やられても5秒で復活!",
  survival: "復活なし。最後まで生きのこったヘビの勝ち（5分たったら いちばん長いヘビ）",
};

function renderLobby() {
  if (!lobby) return;
  const me = lobby.players.find((p) => p.id === myId);
  const isHost = lobby.host === myId;
  $("lobbyCode").textContent = roomCode;

  // メンバー
  let html = "";
  for (let i = 0; i < 4; i++) {
    const p = lobby.players[i];
    if (!p) {
      html += `<div class="member empty"><span class="dot" style="background:rgba(255,255,255,.12);box-shadow:none"></span>（あき）</div>`;
      continue;
    }
    const host = p.id === lobby.host;
    const status = p.playing
      ? `<span class="tag">🎮 ゲーム中</span>`
      : host
        ? `<span class="tag ok">👑 リーダー</span>`
        : p.ready
          ? `<span class="tag ok">✅ 準備OK</span>`
          : `<span class="tag wait">⏳ えらび中</span>`;
    html += `<div class="member"><span class="dot" style="background:${COLORS[p.color]};color:${COLORS[p.color]}"></span>
      <span class="nm">${host ? "👑 " : ""}${esc(p.name)}${p.id === myId ? "（じぶん）" : ""}</span>${status}</div>`;
  }
  $("members").innerHTML = html;
  $("cpuNote").textContent = `🤖 CPU ${lobby.cpuCount}匹が参加（ぜんぶで10匹）`;

  // 色
  const taken = new Set(lobby.players.filter((p) => p.id !== myId).map((p) => p.color));
  $("palette").innerHTML = COLORS.map(
    (c, i) =>
      `<button class="sw ${me && me.color === i ? "sel" : ""}" data-c="${i}" style="background:${c};color:${c}" ${taken.has(i) ? "disabled" : ""} aria-label="色${i + 1}"></button>`,
  ).join("");
  for (const b of $("palette").querySelectorAll(".sw"))
    b.onclick = () => send({ t: "color", c: Number(b.dataset.c) });

  // 操作
  for (const b of $("controlChips").querySelectorAll(".chip"))
    b.classList.toggle("sel", b.dataset.v === controlMode);
  $("controlNote").textContent =
    controlMode === "stick"
      ? "左手のスティックで向き、右手の ⚡ でダッシュ"
      : "指で行きたい方向をなぞる。⚡ でダッシュ";

  // 準備OK（リーダーは押さなくてOK）
  const rb = $("readyBtn");
  rb.style.display = isHost ? "none" : "";
  rb.classList.toggle("on", !!me?.ready);
  rb.textContent = me?.ready ? "✅ 準備OK!（タップで取り消し）" : "👉 準備ができたらタップ";

  // ルール
  $("rulesWho").textContent = isHost ? "（リーダーが決める）" : "（リーダーが決めます）";
  const s = lobby.settings;
  for (const group of document.querySelectorAll("#lobby .chips[data-key]")) {
    const key = group.dataset.key;
    for (const b of group.querySelectorAll(".chip")) {
      b.classList.toggle("sel", String(s[key]) === b.dataset.v);
      b.disabled = !isHost;
    }
  }
  $("minutesRow").style.display = s.mode === "time" ? "" : "none";
  $("modeNote").textContent = SETTING_NOTES[s.mode];

  // スタート
  const others = lobby.players.filter((p) => p.id !== lobby.host);
  const readyCount = others.filter((p) => p.ready).length;
  const allReady = readyCount === others.length;
  const sb = $("startBtn");
  sb.style.display = isHost ? "" : "none";
  sb.disabled = !allReady || lobby.phase !== "lobby";
  $("startHint").textContent =
    lobby.phase !== "lobby"
      ? "ゲーム中です。おわったら参加できるよ"
      : isHost
        ? allReady
          ? "みんな準備OK! スタートを押してね"
          : `みんなの準備OKを待っています（${readyCount}/${others.length}）`
        : "リーダーがスタートするのを待っています";

  renderTally(lobby.tally, "tallyBox", "tally");
}

function renderTally(tally, boxId, listId) {
  const entries = Object.entries(tally || {}).sort((a, b) => b[1] - a[1]);
  $(boxId).style.display = entries.length ? "" : "none";
  $(listId).innerHTML = entries
    .map(
      ([n, w]) =>
        `<div><span>${esc(n)}</span><span>${"★".repeat(Math.min(w, 10))} ${w}勝</span></div>`,
    )
    .join("");
}

$("readyBtn").onclick = () => {
  const me = lobby?.players.find((p) => p.id === myId);
  send({ t: "ready", v: !me?.ready });
};
for (const b of $("controlChips").querySelectorAll(".chip")) {
  b.onclick = () => {
    controlMode = b.dataset.v;
    store.set("control", controlMode);
    renderLobby();
  };
}
for (const group of document.querySelectorAll("#lobby .chips[data-key]")) {
  for (const b of group.querySelectorAll(".chip")) {
    b.onclick = () => {
      const key = group.dataset.key;
      let v = b.dataset.v;
      if (key === "minutes") v = Number(v);
      if (key === "rocks") v = v === "true";
      send({ t: "settings", s: { [key]: v } });
    };
  }
}
$("startBtn").onclick = () => send({ t: "start" });

// ================= ゲームの状態 =================
let game = null; // { mode, R, rocks, duration, snakes:[{id,name,color,cpu}], myIdx, spectator }
let snaps = []; // [{ tm, at, sn }]
let trails = []; // [{ gen, pts:[{x,y}] }]
const food = new Map();
const items = new Map();
let flying = [];
let feedItems = [];
let myEffects = {}; // アイテム番号 -> 終わる時刻
let myKills = 0;
let countdownEnd = 0;
let lastCount = -1;
let deathInfo = null; // { at, by }
let lastLeft = 0;

function onStart(m) {
  game = {
    mode: m.mode,
    R: m.R,
    rocks: m.rocks,
    duration: m.duration,
    snakes: m.snakes.map((s) => ({ id: s.id, name: s.name, color: s.color, cpu: s.cpu })),
  };
  game.myIdx = m.snakes.findIndex((s) => s.id === myId);
  game.spectator = game.myIdx < 0;
  if (!game.spectator) globalThis.GamePlays?.record("snake-battle-online");
  snaps = [{ tm: m.tm, at: performance.now(), sn: m.snakes.map((s) => s.state) }];
  trails = m.snakes.map((s) => {
    const pts = [];
    for (let i = 0; i < s.body.length; i += 2) pts.push({ x: s.body[i], y: s.body[i + 1] });
    return { gen: s.state[6], pts };
  });
  food.clear();
  for (const f of m.food) food.set(f[0], { x: f[1], y: f[2], s: f[3], c: f[4] });
  items.clear();
  for (const it of m.items) items.set(it[0], { x: it[1], y: it[2], type: it[3] });
  flying = [];
  feedItems = [];
  myEffects = {};
  myKills = 0;
  deathInfo = null;
  lastCount = -1;
  wasBoosting = false;
  lastLeader = -1;
  lastLeft = m.duration - m.tm;
  // 途中から観戦する人には 3,2,1 を出さない
  countdownEnd = m.cd > 0 ? performance.now() + m.cd * 1000 : performance.now() - 1000;
  if (m.cd <= 0) startBGM();
  const head = game.spectator
    ? { x: 0, y: 0 }
    : { x: m.snakes[game.myIdx].state[0], y: m.snakes[game.myIdx].state[1] };
  cam.x = head.x;
  cam.y = head.y;
  cam.scale = baseScale(14);
  input.angle = game.spectator ? 0 : m.snakes[game.myIdx].state[2];
  input.boost = false;
  $("feed").innerHTML = "";
  show("game");
  setupControls();
  showHint(
    game.spectator
      ? ""
      : controlMode === "stick"
        ? "🕹️ スティックで向き・⚡ でダッシュ"
        : "👆 行きたい方向をなぞってね・⚡ でダッシュ",
  );
}

function onSnap(m) {
  if (!game) return;
  const now = performance.now();
  snaps.push({ tm: m.tm, at: now, sn: m.sn });
  if (snaps.length > 30) snaps.shift();
  lastLeft = m.left;

  for (const f of m.fa) food.set(f[0], { x: f[1], y: f[2], s: f[3], c: f[4] });
  for (const [id, eater] of m.fr) {
    const f = food.get(id);
    if (!f) continue;
    food.delete(id);
    flying.push({ x: f.x, y: f.y, s: f.s, c: ORB_COLORS[f.c] ?? "#fff", to: eater, t0: now });
    if (eater === game.myIdx) sfx.eat();
  }
  for (const it of m.ia) items.set(it[0], { x: it[1], y: it[2], type: it[3] });
  for (const [id] of m.ir) items.delete(id);

  for (const ev of m.ev) handleEvent(ev, m.tm);
}

function snakeName(idx) {
  const s = game.snakes[idx];
  return s ? (s.cpu ? "🤖" : "") + s.name : "?";
}

function handleEvent(ev, tm) {
  const me = game.myIdx;
  switch (ev[0]) {
    case "k": {
      const [, killer, victim, cause] = ev;
      const how = { wall: "外枠にぶつかった", rock: "岩にぶつかった", left: "ぬけた" }[cause];
      if (killer >= 0) addFeed(`💥 ${snakeName(killer)} → ${snakeName(victim)}`);
      else if (how && cause !== "left") addFeed(`💫 ${snakeName(victim)} が${how}`);
      if (victim === me) {
        deathInfo = { at: performance.now(), by: killer >= 0 ? snakeName(killer) : (how ?? "") };
        sfx.death();
      }
      if (killer === me && victim !== me) {
        myKills++;
        toast(`💥 ${snakeName(victim)} をたおした!`);
        sfx.kill();
      }
      break;
    }
    case "i": {
      const [, idx, type, until] = ev;
      if (idx !== me) break;
      if (until > 0) myEffects[type] = until;
      toast(ITEMS[type].toast);
      sfx.item();
      break;
    }
    case "sb":
      if (ev[1] === me) {
        toast("🛡️ シールドで守った!");
        sfx.shield();
      }
      break;
    case "r":
      if (ev[1] === me) {
        deathInfo = null;
        myEffects = {};
        toast("✨ 復活!");
      }
      break;
    case "L":
      addFeed(`🚪 ${snakeName(ev[1])} がぬけた`);
      break;
  }
}

function addFeed(text) {
  const el = document.createElement("div");
  el.textContent = text;
  $("feed").prepend(el);
  while ($("feed").children.length > 4) $("feed").lastChild.remove();
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 600);
  }, 3500);
}

let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 1300);
}

let hintTimer = null;
function showHint(text) {
  $("hint").textContent = text;
  $("hint").style.opacity = text ? "1" : "0";
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    $("hint").style.opacity = "0";
  }, 6000);
}

// ================= なめらかに動かす =================
function serverNow() {
  const last = snaps[snaps.length - 1];
  return last.tm + Math.min(0.25, (performance.now() - last.at) / 1000);
}

// 少し前の時刻（2つの snapshot の間）を計算して描く
function sample() {
  const rt = serverNow() - INTERP_DELAY;
  let a = snaps[0],
    b = snaps[snaps.length - 1];
  if (rt <= a.tm) return a.sn;
  if (rt >= b.tm) return b.sn;
  for (let i = snaps.length - 2; i >= 0; i--) {
    if (snaps[i].tm <= rt) {
      a = snaps[i];
      b = snaps[i + 1];
      break;
    }
  }
  const k = (rt - a.tm) / Math.max(0.001, b.tm - a.tm);
  return b.sn.map((sb, j) => {
    const sa = a.sn[j];
    if (!sa || sa[6] !== sb[6] || (sa[5] & F.DEAD) !== (sb[5] & F.DEAD)) return sb;
    return [
      lerp(sa[0], sb[0], k),
      lerp(sa[1], sb[1], k),
      sa[2] + angleDiff(sa[2], sb[2]) * k,
      lerp(sa[3], sb[3], k),
      lerp(sa[4], sb[4], k),
      sb[5],
      sb[6],
    ];
  });
}

// 頭の通った道をつなげて、からだを作る
function updateTrail(i, st) {
  const tr = trails[i];
  if (!tr) return;
  if (tr.gen !== st[6] || tr.pts.length < 2) {
    tr.gen = st[6];
    tr.pts = [];
    for (let d = 0; d <= st[3]; d += 10)
      tr.pts.push({ x: st[0] - Math.cos(st[2]) * d, y: st[1] - Math.sin(st[2]) * d });
    if (tr.pts.length < 2) tr.pts.push({ x: st[0], y: st[1] });
    return;
  }
  const pts = tr.pts;
  if (Math.hypot(pts[1].x - st[0], pts[1].y - st[1]) >= 6) pts.unshift({ x: st[0], y: st[1] });
  else {
    pts[0].x = st[0];
    pts[0].y = st[1];
  }
  let dist = 0;
  for (let k = 1; k < pts.length; k++) {
    dist += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    if (dist > st[3]) {
      pts.length = k + 1;
      break;
    }
  }
}

// ================= 操作 =================
const input = { angle: 0, boost: false, sentAngle: null, sentBoost: null };

function setupControls() {
  const playing = game && !game.spectator;
  $("stick").style.display = playing && controlMode === "stick" ? "" : "none";
  $("boost").style.display = playing ? "" : "none";
}

// 指をつかまえる（すでに離れた指だとエラーになるので、そのときは何もしない）
function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {}
}

// スティック
(() => {
  const stick = $("stick"),
    knob = $("knob");
  let pid = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2),
      dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy),
      max = r.width * 0.32;
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (d > 8) input.angle = Math.atan2(dy, dx);
  };
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pid = e.pointerId;
    capture(stick, pid);
    move(e);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === pid) move(e);
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    knob.style.transform = "";
  };
  stick.addEventListener("pointerup", end);
  stick.addEventListener("pointercancel", end);
})();

// ダッシュボタン
(() => {
  const b = $("boost");
  const on = (e) => {
    e.preventDefault();
    capture(b, e.pointerId);
    input.boost = true;
    b.classList.add("on");
  };
  const off = () => {
    input.boost = false;
    b.classList.remove("on");
  };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
})();

// なぞる（マウスはボタンを押さなくても向く）
let slidePointer = null;
function aimAt(clientX, clientY) {
  if (!game || game.spectator || controlMode !== "slide") return;
  const head = myHeadScreen;
  if (!head) return;
  const dx = clientX - head.x,
    dy = clientY - head.y;
  if (Math.hypot(dx, dy) > 12) input.angle = Math.atan2(dy, dx);
}
$("canvas").addEventListener("pointerdown", (e) => {
  slidePointer = e.pointerId;
  aimAt(e.clientX, e.clientY);
});
$("canvas").addEventListener("pointermove", (e) => {
  if (e.pointerId === slidePointer || e.pointerType === "mouse") aimAt(e.clientX, e.clientY);
});
$("canvas").addEventListener("pointerup", (e) => {
  if (e.pointerId === slidePointer) slidePointer = null;
});

// キーボード（パソコン）
const keys = {};
addEventListener("keydown", (e) => {
  if (current !== "game") return;
  keys[e.code] = true;
  if (e.code === "Space" || e.code === "ShiftLeft") {
    input.boost = true;
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "Space" || e.code === "ShiftLeft") input.boost = false;
});
function keyboardAim() {
  let dx = 0,
    dy = 0;
  if (keys.ArrowLeft || keys.KeyA) dx--;
  if (keys.ArrowRight || keys.KeyD) dx++;
  if (keys.ArrowUp || keys.KeyW) dy--;
  if (keys.ArrowDown || keys.KeyS) dy++;
  if (dx || dy) input.angle = Math.atan2(dy, dx);
}

// 送るのは、向きかダッシュが変わったときだけ（1秒に14回まで）
setInterval(() => {
  if (!game || game.spectator || performance.now() < countdownEnd) return;
  const a = Math.round(input.angle * 100) / 100;
  if (a !== input.sentAngle || input.boost !== input.sentBoost) {
    send({ t: "in", a, b: input.boost ? 1 : 0 });
    input.sentAngle = a;
    input.sentBoost = input.boost;
  }
}, 70);

// ================= 描画 =================
const canvas = $("canvas"),
  ctx = canvas.getContext("2d");
const mini = $("mini"),
  mctx = mini.getContext("2d");
let W = 0,
  H = 0,
  DPR = 1;
const cam = { x: 0, y: 0, scale: 1 };
let myHeadScreen = null;

function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
}
addEventListener("resize", resize);
resize();

function baseScale(r) {
  return Math.min(W, H) / 900 / (1 + (r - 14) / 70);
}

// 光るエサとアイテムの絵を先に作っておく（毎回作ると重いので）
const orbSprites = ORB_COLORS.map((c) => {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.25, c);
  grad.addColorStop(0.55, c + "55");
  grad.addColorStop(1, c + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return s;
});
const itemSprites = ITEMS.map((it) => {
  const s = document.createElement("canvas");
  s.width = s.height = 128;
  const g = s.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, it.c + "cc");
  grad.addColorStop(0.5, it.c + "44");
  grad.addColorStop(1, it.c + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 34, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,8,30,.75)";
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = it.c;
  g.stroke();
  g.font = "40px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(it.e, 64, 67);
  return s;
});
const stars = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: 0.05 + Math.random() * 0.25,
  s: Math.random() * 1.6 + 0.3,
}));

function frame() {
  requestAnimationFrame(frame);
  if (current !== "game" || !game) return;
  keyboardAim();
  const now = performance.now();
  const states = sample();
  for (let i = 0; i < states.length; i++) if (!(states[i][5] & F.DEAD)) updateTrail(i, states[i]);

  // カメラ
  const mine = game.spectator ? null : states[game.myIdx];
  let target = { x: 0, y: 0 },
    scale = Math.min(W, H) / (game.R * 2.2);
  if (mine && !(mine[5] & F.DEAD)) {
    target = { x: mine[0], y: mine[1] };
    scale = baseScale(mine[4]);
  } else if (mine && game.mode === "time") {
    target = { x: mine[0], y: mine[1] };
    scale = baseScale(14) * 0.7;
  } else {
    const leader = leaderIdx(states);
    if (
      leader >= 0 &&
      game.mode === "survival" &&
      !game.spectator &&
      mine &&
      now - (deathInfo?.at ?? 0) < 2500
    ) {
      target = { x: mine[0], y: mine[1] };
      scale = baseScale(14) * 0.7;
    } else if (leader >= 0) {
      target = { x: states[leader][0], y: states[leader][1] };
      scale = baseScale(states[leader][4]) * 0.75;
    }
  }
  const follow = mine && !(mine[5] & F.DEAD) ? 0.35 : 0.06;
  cam.x = lerp(cam.x, target.x, follow);
  cam.y = lerp(cam.y, target.y, follow);
  cam.scale = lerp(cam.scale, scale, 0.05);

  drawWorld(states, now);
  drawLabels(states);
  if (now > countdownEnd) soundCues(states);
  if (now - lastHud > 100) {
    lastHud = now;
    updateHud(states, now);
  }
  updateOverlay(now, mine);
}
let lastHud = 0;

function leaderIdx(states) {
  let best = -1;
  for (let i = 0; i < states.length; i++) {
    if (states[i][5] & F.DEAD) continue;
    if (best < 0 || states[i][3] > states[best][3]) best = i;
  }
  return best;
}

function toScreen(x, y) {
  return { x: W / 2 + (x - cam.x) * cam.scale, y: H / 2 + (y - cam.y) * cam.scale };
}

function drawWorld(states, now) {
  const s = cam.scale;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 背景と星（少しずつずれて、奥行きが出る）
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
  bg.addColorStop(0, "#2a1650");
  bg.addColorStop(0.5, "#140c34");
  bg.addColorStop(1, "#070718");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  for (const st of stars) {
    const x = (((st.x * W - cam.x * st.z * s) % W) + W) % W;
    const y = (((st.y * H - cam.y * st.z * s) % H) + H) % H;
    ctx.globalAlpha = 0.25 + st.z * 2;
    ctx.fillRect(x, y, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  // ここから先は世界の座標で描く
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (W / 2 - cam.x * s), DPR * (H / 2 - cam.y * s));
  const view = {
    x0: cam.x - W / 2 / s,
    x1: cam.x + W / 2 / s,
    y0: cam.y - H / 2 / s,
    y1: cam.y + H / 2 / s,
  };
  const inView = (x, y, m) =>
    x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
  const R = game.R;

  // ステージの外は赤っぽく
  ctx.beginPath();
  ctx.rect(view.x0 - 10, view.y0 - 10, view.x1 - view.x0 + 20, view.y1 - view.y0 + 20);
  ctx.arc(0, 0, R, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(90,10,50,.45)";
  ctx.fill();

  // マス目
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(8,6,28,.35)";
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.strokeStyle = "rgba(120,140,255,.08)";
  ctx.lineWidth = 2 / s;
  const g = 160;
  ctx.beginPath();
  for (let x = Math.floor(view.x0 / g) * g; x <= view.x1; x += g) {
    ctx.moveTo(x, view.y0);
    ctx.lineTo(x, view.y1);
  }
  for (let y = Math.floor(view.y0 / g) * g; y <= view.y1; y += g) {
    ctx.moveTo(view.x0, y);
    ctx.lineTo(view.x1, y);
  }
  ctx.stroke();
  ctx.restore();

  // 外枠（光る線）
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,76,240,.18)";
  ctx.lineWidth = 46;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,76,240,.35)";
  ctx.lineWidth = 20;
  ctx.stroke();
  ctx.strokeStyle = "#ff8cf6";
  ctx.lineWidth = 6;
  ctx.stroke();

  // 岩
  for (const r of game.rocks) {
    if (!inView(r.x, r.y, r.r + 40)) continue;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(176,108,255,.15)";
    ctx.fill();
    const rg = ctx.createRadialGradient(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.1, r.x, r.y, r.r);
    rg.addColorStop(0, "#8a6bff");
    rg.addColorStop(1, "#24145e");
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#c79bff";
    ctx.stroke();
  }

  // エサ
  for (const f of food.values()) {
    if (!inView(f.x, f.y, 40)) continue;
    const r = f.s * 2.6;
    ctx.drawImage(orbSprites[f.c] ?? orbSprites[8], f.x - r, f.y - r, r * 2, r * 2);
  }
  // 食べられたエサが吸いこまれる
  flying = flying.filter((fl) => {
    const k = (now - fl.t0) / 180;
    if (k >= 1) return false;
    const st = states[fl.to];
    if (!st) return false;
    const x = lerp(fl.x, st[0], k),
      y = lerp(fl.y, st[1], k),
      r = fl.s * 2.6 * (1 - k);
    ctx.globalAlpha = 1 - k;
    ctx.drawImage(
      orbSprites[ORB_COLORS.indexOf(fl.c)] ?? orbSprites[8],
      x - r,
      y - r,
      r * 2,
      r * 2,
    );
    ctx.globalAlpha = 1;
    return true;
  });

  // アイテム（ふわふわ動く）
  for (const it of items.values()) {
    if (!inView(it.x, it.y, 60)) continue;
    const bob = Math.sin(now / 300 + it.x) * 6;
    ctx.drawImage(itemSprites[it.type], it.x - 40, it.y - 40 + bob, 80, 80);
  }

  // ヘビ（じぶんはいちばん上）
  const order = states.map((_, i) => i).filter((i) => i !== game.myIdx);
  if (!game.spectator) order.push(game.myIdx);
  for (const i of order) drawSnake(i, states[i], now, inView);
}

function drawSnake(i, st, now, inView) {
  if (st[5] & F.DEAD) return;
  const tr = trails[i];
  if (!tr || tr.pts.length < 2) return;
  const color = COLORS[game.snakes[i].color];
  const r = st[4];
  const flags = st[5];
  const pts = tr.pts;
  if (!pts.some((p, k) => k % 6 === 0 && inView(p.x, p.y, r * 3))) return;

  ctx.save();
  if (flags & F.GHOST) ctx.globalAlpha = 0.4;
  else if (flags & F.PROTECT) ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 80);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  for (let k = pts.length - 2; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y);

  // ひかり → からだ → しま模様
  ctx.strokeStyle = color + (flags & F.BOOST ? "66" : "2e");
  ctx.lineWidth = r * 2 + (flags & F.BOOST ? 30 : 16);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.stroke();
  ctx.setLineDash([r * 0.7, r * 1.3]);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = r * 1.1;
  ctx.stroke();
  ctx.setLineDash([]);

  // 頭
  const a = st[2],
    hx = st[0],
    hy = st[1];
  ctx.beginPath();
  ctx.arc(hx, hy, r * 1.08, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  const fx = Math.cos(a),
    fy = Math.sin(a),
    sx = -fy,
    sy = fx;
  for (const d of [-1, 1]) {
    const ex = hx + fx * r * 0.35 + sx * r * 0.45 * d,
      ey = hy + fy * r * 0.35 + sy * r * 0.45 * d;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + fx * r * 0.12, ey + fy * r * 0.12, r * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    if (flags & F.BOOST) {
      ctx.beginPath();
      ctx.moveTo(ex - fx * r * 0.1 + sx * d * r * 0.42, ey - fy * r * 0.1 + sy * d * r * 0.42);
      ctx.lineTo(ex + fx * r * 0.32 - sx * d * r * 0.1, ey + fy * r * 0.32 - sy * d * r * 0.1);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.stroke();
    }
  }

  // アイテムの効果
  if (flags & F.SHIELD) {
    ctx.beginPath();
    ctx.arc(hx, hy, r * 1.08 + 12 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(79,195,255,.9)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  if (flags & F.MAGNET) {
    ctx.setLineDash([14, 14]);
    ctx.lineDashOffset = -now / 30;
    ctx.beginPath();
    ctx.arc(hx, hy, 200, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,92,225,.35)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (flags & F.SPEED) {
    for (let k = 0; k < 5; k++) {
      const off = (now / 40 + k * 13) % 60;
      ctx.beginPath();
      ctx.moveTo(hx - fx * (r + off) + sx * (k - 2) * 6, hy - fy * (r + off) + sy * (k - 2) * 6);
      ctx.lineTo(
        hx - fx * (r + off + 20) + sx * (k - 2) * 6,
        hy - fy * (r + off + 20) + sy * (k - 2) * 6,
      );
      ctx.strokeStyle = "rgba(255,216,77,.7)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 名前は画面の座標で描く（ズームしても読みやすいように）
function drawLabels(states) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const leader = leaderIdx(states);
  myHeadScreen = null;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (st[5] & F.DEAD) continue;
    const p = toScreen(st[0], st[1]);
    if (i === game.myIdx) myHeadScreen = p;
    if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) continue;
    const sn = game.snakes[i];
    const label = (i === leader ? "👑 " : "") + (sn.cpu ? "🤖" : "") + sn.name;
    const y = p.y - st[4] * cam.scale - 14;
    ctx.font =
      i === game.myIdx
        ? "bold 15px sans-serif"
        : sn.cpu
          ? "12px sans-serif"
          : "bold 13px sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.strokeText(label, p.x, y);
    ctx.fillStyle = i === game.myIdx ? "#ffd84d" : "#fff";
    ctx.fillText(label, p.x, y);
  }
}

// ================= 画面の表示（時間・順位・地図など） =================
function rankOrder(states) {
  const idx = states.map((_, i) => i);
  return idx.sort((a, b) => {
    const da = states[a][5] & F.DEAD,
      db = states[b][5] & F.DEAD;
    if (!!da !== !!db) return da ? 1 : -1;
    return states[b][3] - states[a][3];
  });
}

let wasBoosting = false;
let lastLeader = -1;
let lastFirstPlaceCue = 0;
function soundCues(states) {
  if (game.spectator) return;
  const me = states[game.myIdx];
  const alive = !(me[5] & F.DEAD);
  const boosting = alive && !!(me[5] & F.BOOST);
  if (boosting && !wasBoosting) sfx.boost();
  wasBoosting = boosting;
  const leader = leaderIdx(states);
  if (leader !== lastLeader) {
    // 長さがほぼ同じだと1位が何度も入れかわるので、3秒は続けて鳴らさない
    if (
      leader === game.myIdx &&
      lastLeader !== -1 &&
      alive &&
      performance.now() - lastFirstPlaceCue > 3000
    ) {
      lastFirstPlaceCue = performance.now();
      toast("👑 1位になった!");
      sfx.firstPlace();
    }
    lastLeader = leader;
  }
}

function updateHud(states, now) {
  // 時間
  const left = Math.max(0, Math.ceil(lastLeft));
  $("timer").textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  $("timer").classList.toggle("hurry", left <= 10 && now > countdownEnd);

  const order = rankOrder(states);
  const alive = states.filter((s) => !(s[5] & F.DEAD)).length;

  // じぶん
  if (game.spectator) {
    $("mine").innerHTML = `👀 観戦中<br>🐍 のこり ${alive}匹`;
  } else {
    const me = states[game.myIdx];
    const dead = me[5] & F.DEAD;
    const rank = order.indexOf(game.myIdx) + 1;
    $("mine").innerHTML =
      `📏 ${dead ? "-" : (me[3] * M_PER_UNIT).toFixed(1) + "m"}　🏆 ${dead ? "-" : rank + "位"}<br>💥 たおした ${myKills}` +
      (game.mode === "survival" ? `　🐍 のこり ${alive}匹` : "");
  }

  // 順位
  const row = (i, rank) => {
    const s = states[i],
      sn = game.snakes[i],
      dead = s[5] & F.DEAD;
    return `<div class="r ${i === game.myIdx ? "me" : ""}"><b>${rank === 1 ? "👑" : rank}</b>
      <span class="d" style="background:${COLORS[sn.color]}"></span>
      <span class="n">${sn.cpu ? "🤖" : ""}${esc(sn.name)}</span><span>${dead ? "💀" : (s[3] * M_PER_UNIT).toFixed(0) + "m"}</span></div>`;
  };
  let html = order
    .slice(0, 5)
    .map((i, k) => row(i, k + 1))
    .join("");
  const myRank = order.indexOf(game.myIdx);
  if (!game.spectator && myRank >= 5)
    html += `<div class="sep"></div>` + row(game.myIdx, myRank + 1);
  $("rank").innerHTML = html;

  // アイテムの効果（のこり秒数）
  if (!game.spectator) {
    const me = states[game.myIdx];
    const tm = serverNow();
    const chips = [];
    for (const [type, flag] of [
      [0, F.SPEED],
      [2, F.MAGNET],
      [3, F.GHOST],
    ]) {
      if (me[5] & flag)
        chips.push(
          `<span class="eff" style="color:${ITEMS[type].c}">${ITEMS[type].e} ${Math.max(0, Math.ceil((myEffects[type] ?? tm) - tm))}</span>`,
        );
    }
    if (me[5] & F.SHIELD) chips.push(`<span class="eff" style="color:${ITEMS[1].c}">🛡️</span>`);
    $("effects").innerHTML = chips.join("");
  } else {
    $("effects").innerHTML = "";
  }

  drawMini(states, order[0]);
}

function drawMini(states, leader) {
  const w = mini.width,
    c = w / 2,
    k = (w / 2 - 6) / game.R;
  mctx.clearRect(0, 0, w, w);
  mctx.beginPath();
  mctx.arc(c, c, w / 2 - 4, 0, Math.PI * 2);
  mctx.fillStyle = "rgba(8,6,28,.85)";
  mctx.fill();
  mctx.strokeStyle = "#ff8cf6";
  mctx.lineWidth = 3;
  mctx.stroke();
  mctx.fillStyle = "rgba(176,108,255,.7)";
  for (const r of game.rocks) {
    mctx.beginPath();
    mctx.arc(c + r.x * k, c + r.y * k, Math.max(2, r.r * k), 0, Math.PI * 2);
    mctx.fill();
  }
  for (const it of items.values()) {
    mctx.fillStyle = ITEMS[it.type].c;
    mctx.fillRect(c + it.x * k - 2, c + it.y * k - 2, 4, 4);
  }
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (st[5] & F.DEAD) continue;
    const me = i === game.myIdx;
    mctx.beginPath();
    mctx.arc(c + st[0] * k, c + st[1] * k, me ? 6 : 4, 0, Math.PI * 2);
    mctx.fillStyle = COLORS[game.snakes[i].color];
    mctx.fill();
    if (me) {
      mctx.lineWidth = 3;
      mctx.strokeStyle = "#fff";
      mctx.stroke();
    }
  }
  if (leader >= 0 && !(states[leader][5] & F.DEAD)) {
    mctx.font = "18px sans-serif";
    mctx.textAlign = "center";
    mctx.fillText("👑", c + states[leader][0] * k, c + states[leader][1] * k - 8);
  }
}

function updateOverlay(now, mine) {
  const ov = $("overlay");
  // 3, 2, 1, スタート!
  if (now < countdownEnd + 700) {
    const leftSec = (countdownEnd - now) / 1000;
    const n = Math.ceil(leftSec);
    if (n !== lastCount) {
      lastCount = n;
      if (n > 0) {
        ov.innerHTML = `<div><div class="big glow">${n}</div><div class="sub">${game.spectator ? "👀 観戦中" : "じゅんびして!"}</div></div>`;
        sfx.beep();
      } else {
        ov.innerHTML = `<div class="big glow" style="color:var(--yellow)">スタート!</div>`;
        sfx.go();
        startBGM();
      }
    }
    return;
  }
  lastCount = -1;
  if (game.spectator) {
    ov.innerHTML = `<div style="align-self:flex-end;margin-bottom:22vh"><div class="mid">👀 観戦中</div><div class="sub">つぎのゲームから参加できるよ</div></div>`;
    return;
  }
  if (mine && mine[5] & F.DEAD && deathInfo) {
    const by = deathInfo.by
      ? `${esc(deathInfo.by)}${deathInfo.by.endsWith("た") ? "" : " にやられた"}`
      : "";
    if (game.mode === "time") {
      const left = Math.max(0, Math.ceil(RESPAWN_SEC - (now - deathInfo.at) / 1000));
      ov.innerHTML = `<div><div class="mid">💥 やられた!</div><div class="sub">${by}</div><div class="big glow">${left}</div><div class="sub">びょうごに 復活</div></div>`;
    } else {
      ov.innerHTML = `<div style="align-self:flex-end;margin-bottom:22vh"><div class="mid">💀 脱落…</div><div class="sub">${by}<br>みんなの戦いを観戦しよう</div></div>`;
    }
    return;
  }
  ov.innerHTML = "";
}

requestAnimationFrame(frame);

// ================= 結果 =================
function onEnd(m) {
  stopBGM();
  const res = m.results;
  game = null;
  $("resMode").textContent = res.mode === "time" ? "⏱ 時間制バトル" : "💀 サバイバル";
  const top = res.rows.slice(0, 3);
  const pod = [top[1], top[0], top[2]];
  const heights = [120, 160, 96];
  const medals = ["🥈", "🥇", "🥉"];
  $("podium").innerHTML = pod
    .map((r, k) =>
      !r
        ? `<div class="pod"></div>`
        : `
    <div class="pod">
      <div class="medal">${medals[k]}</div>
      <div class="who" style="color:${COLORS[r.color]}">${r.cpu ? "🤖" : ""}${esc(r.name)}</div>
      <div class="stand" style="height:${heights[k]}px;background:linear-gradient(${COLORS[r.color]}55,${COLORS[r.color]}11)">
        <div>📏 ${r.meters}m</div><div>💥 ${r.kills}</div>
      </div>
    </div>`,
    )
    .join("");
  $("titles").innerHTML = res.titles
    .map(
      (t) => `
    <div class="ttl"><span class="e">${t.emoji}</span><div><b>${esc(t.title)}</b><br>${esc(t.name)}（${esc(t.value)}）</div></div>`,
    )
    .join("");
  $("resTable").innerHTML =
    `<tr><th>順位</th><th>なまえ</th><th>長さ</th><th>💥</th><th>🎁</th><th>⚡</th></tr>` +
    res.rows
      .map(
        (r) => `<tr class="${r.id === myId ? "me" : ""}"><td>${r.rank}</td>
      <td style="text-align:left"><span class="dot" style="display:inline-block;width:12px;height:12px;vertical-align:middle;background:${COLORS[r.color]}"></span>
      ${r.cpu ? "🤖" : ""}${esc(r.name)}${r.left ? "（ぬけた）" : ""}</td>
      <td>${r.meters}m</td><td>${r.kills}</td><td>${r.items}</td><td>${r.boostSec}秒</td></tr>`,
      )
      .join("");
  renderTally(m.tally, "resTallyBox", "resTally");
  show("result");
  if (res.rows[0]?.id === myId) sfx.win();
}

$("againBtn").onclick = () => {
  if (lobby && lobby.host !== myId) send({ t: "ready", v: true });
  show("lobby");
  renderLobby();
};

