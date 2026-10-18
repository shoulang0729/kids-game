// Extracted without changing the original functions; page state stays in game.js.
function join() {
  const name = $("name").value.trim();
  const code = $("code").value.trim();
  if (!ROOM_CODE.test(code)) {
    $("error").textContent =
      "合言葉は20文字まで。ひらがな・カタカナ・漢字・英数字だけ使えるよ";
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
    else if (!me)
      showJoin("つながりませんでした。少し待ってもう一度ためしてね");
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

function sendPosition(now) {
  if (!pendingSend || !me || ws?.readyState !== WebSocket.OPEN) return;
  if (now - lastSent < SEND_INTERVAL) return;
  ws.send(JSON.stringify({ type: "move", x: me.x, y: me.y }));
  lastSent = now;
  pendingSend = false;
}
