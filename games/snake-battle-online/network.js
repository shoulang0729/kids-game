"use strict";
// Extracted without changing the original functions; page state stays in game.js.
function join() {
  const name = $("nameIn").value.trim();
  const code = $("codeIn").value.trim();
  if (!ROOM_CODE.test(code)) {
    $("joinErr").textContent =
      "合言葉は20文字まで。ひらがな・カタカナ・漢字・英数字だけ使えるよ";
    return;
  }
  store.set("name", name);
  store.set("code", code);
  $("joinErr").textContent = "つないでいます…";
  $("enterBtn").disabled = true;
  tone(1, 0.01, 0.0001); // iPad で音を出せるようにする（最初のタップで準備）
  roomCode = code;
  connect(name, code);
}

function connect(name, code) {
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(SERVER);
  const url = `${local ? "ws" : "wss"}://${SERVER}/snake/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`;
  leaving = false;
  myId = null;
  let full = false;
  ws = new WebSocket(url);
  ws.onopen = () => {
    const profile = globalThis.GameRecords?.profile();
    if (profile?.code && profile.name)
      ws.send(JSON.stringify({ t: "profile", code: profile.code }));
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === "welcome") myId = m.you;
    else if (m.t === "lobby") onLobby(m);
    else if (m.t === "start") onStart(m);
    else if (m.t === "s") onSnap(m);
    else if (m.t === "end") onEnd(m);
    else if (m.t === "full") full = true;
  };
  ws.onclose = () => {
    stopBGM();
    game = null;
    if (leaving) return;
    $("enterBtn").disabled = false;
    $("joinErr").textContent = full
      ? "この部屋は満員です（4人まで）。ちがう合言葉にしてね"
      : myId
        ? "つながりが切れました。もう一度入ってね"
        : "つながりませんでした。少し待ってもう一度ためしてね";
    show("join");
  };
}

function send(o) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o));
}

function leave() {
  stopBGM();
  leaving = true;
  ws?.close();
  game = null;
  $("enterBtn").disabled = false;
  $("joinErr").textContent = "";
  show("join");
}
