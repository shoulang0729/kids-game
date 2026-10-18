// ▼ サーバーの場所（?server=127.0.0.1:8787 でテスト用サーバーに切りかえ）
const SERVER =
  new URLSearchParams(location.search).get("server") || "tomiyoko-online.shoulang.workers.dev";
const ROOM_CODE = /^[0-9A-Za-z_\-぀-ゟ゠-ヿ一-鿿]{1,20}$/;
const SEND_INTERVAL = 50; // 1秒に20回まで送る

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

let ws = null;
let me = null; // 自分 {id,name,color,x,y}
let others = new Map(); // id -> {name,color,x,y, drawX,drawY}
let lastSent = 0;
let pendingSend = false;
let leaving = false;

// 前回のなまえ・合言葉を思い出す
try {
  $("name").value = localStorage.getItem("onlineDemo.name") || "";
  $("code").value = localStorage.getItem("onlineDemo.code") || "";
} catch {}

$("enter").onclick = join;
$("code").addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});
$("leave").onclick = () => {
  leaving = true;
  ws?.close();
  showJoin("");
};

function join() {
  const name = $("name").value.trim();
  const code = $("code").value.trim();
  if (!ROOM_CODE.test(code)) {
    $("error").textContent = "合言葉は20文字まで。ひらがな・カタカナ・漢字・英数字だけ使えるよ";
    return;
  }
  try {
    localStorage.setItem("onlineDemo.name", name);
    localStorage.setItem("onlineDemo.code", code);
  } catch {}

  $("error").textContent = "";
  $("enter").disabled = true;
  connect(name, code);
}

function connect(name, code) {
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(SERVER);
  const url = `${local ? "ws" : "wss"}://${SERVER}/room/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`;

  leaving = false;
  me = null;
  others = new Map();
  let full = false;

  ws = new WebSocket(url);
  setStatus("つないでいます…", "#ffd84d");

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "welcome") {
      me = msg.you;
      for (const p of msg.players) addOther(p);
      $("roomName").textContent = code;
      showGame();
      setStatus("つながった！", "#5dff87");
    } else if (msg.type === "join") {
      addOther(msg.player);
    } else if (msg.type === "move") {
      const p = others.get(msg.id);
      if (p) {
        p.x = msg.x;
        p.y = msg.y;
      }
    } else if (msg.type === "leave") {
      others.delete(msg.id);
    } else if (msg.type === "full") {
      full = true;
    }
    updateCount();
  };

  ws.onclose = () => {
    if (leaving) return;
    if (full) showJoin("この部屋は満員です（4人まで）。ちがう合言葉にしてね");
    else if (!me) showJoin("つながりませんでした。少し待ってもう一度ためしてね");
    else showJoin("つながりが切れました。もう一度入ってね");
  };
}

function addOther(p) {
  others.set(p.id, { ...p, drawX: p.x, drawY: p.y });
}

function showGame() {
  $("join").style.display = "none";
  $("game").style.display = "block";
  resize();
}

function showJoin(message) {
  $("game").style.display = "none";
  $("join").style.display = "flex";
  $("enter").disabled = false;
  $("error").textContent = message;
  me = null;
}

function setStatus(text, color) {
  $("status").textContent = text;
  $("dot").style.background = color;
}

function updateCount() {
  $("count").textContent = (me ? 1 : 0) + others.size;
}

// ===== 画面（どの端末でも同じ形になるよう、正方形のステージに描く） =====
let W = 0,
  H = 0,
  arena = { x: 0, y: 0, size: 100 };

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = $("bar").offsetHeight + 8;
  const size = Math.min(W - 24, H - top - 50);
  arena = { x: (W - size) / 2, y: top + (H - top - 50 - size) / 2, size: Math.max(100, size) };
}
window.addEventListener("resize", resize);

function toScreen(x, y) {
  return { x: arena.x + x * arena.size, y: arena.y + y * arena.size };
}

function toWorld(sx, sy) {
  return {
    x: Math.min(1, Math.max(0, (sx - arena.x) / arena.size)),
    y: Math.min(1, Math.max(0, (sy - arena.y) / arena.size)),
  };
}

// ===== 操作（指・マウスでなぞる / やじるしキー） =====
let dragging = false;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  moveTo(e.clientX, e.clientY);
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging) moveTo(e.clientX, e.clientY);
});
canvas.addEventListener("pointerup", () => {
  dragging = false;
});
canvas.addEventListener("pointercancel", () => {
  dragging = false;
});

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

function moveTo(sx, sy) {
  if (!me) return;
  const p = toWorld(sx, sy);
  me.x = p.x;
  me.y = p.y;
  pendingSend = true;
}

function sendPosition(now) {
  if (!pendingSend || !me || ws?.readyState !== WebSocket.OPEN) return;
  if (now - lastSent < SEND_INTERVAL) return;
  ws.send(JSON.stringify({ type: "move", x: me.x, y: me.y }));
  lastSent = now;
  pendingSend = false;
}

// ===== 描画 =====
function drawBox(p, x, y, isMe) {
  const s = toScreen(x, y);
  const size = arena.size * 0.09;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = isMe ? 18 : 8;
  ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
  ctx.shadowBlur = 0;
  if (isMe) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
  }
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000";
  const label = isMe ? `${p.name}（じぶん）` : p.name;
  ctx.strokeText(label, s.x, s.y - size / 2 - 8);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, s.x, s.y - size / 2 - 8);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!me) return;

  // キーボード操作
  const step = 0.012;
  let dx = 0,
    dy = 0;
  if (keys.ArrowLeft) dx -= step;
  if (keys.ArrowRight) dx += step;
  if (keys.ArrowUp) dy -= step;
  if (keys.ArrowDown) dy += step;
  if (dx || dy) {
    me.x = Math.min(1, Math.max(0, me.x + dx));
    me.y = Math.min(1, Math.max(0, me.y + dy));
    pendingSend = true;
  }
  sendPosition(now);

  ctx.clearRect(0, 0, W, H);

  // ステージ
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(arena.x, arena.y, arena.size, arena.size);
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const v = (arena.size / 10) * i;
    ctx.beginPath();
    ctx.moveTo(arena.x + v, arena.y);
    ctx.lineTo(arena.x + v, arena.y + arena.size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arena.x, arena.y + v);
    ctx.lineTo(arena.x + arena.size, arena.y + v);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ff4cf0";
  ctx.lineWidth = 3;
  ctx.strokeRect(arena.x, arena.y, arena.size, arena.size);

  // 相手（なめらかに追いかける）
  for (const p of others.values()) {
    p.drawX += (p.x - p.drawX) * 0.25;
    p.drawY += (p.y - p.drawY) * 0.25;
    drawBox(p, p.drawX, p.drawY, false);
  }
  // 自分はいちばん上に
  drawBox(me, me.x, me.y, true);
}
requestAnimationFrame(frame);
