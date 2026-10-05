// とみよこゲームランド オンラインサーバー
//
// しくみ:
//   ゲーム画面 --WebSocket--> /room/<合言葉>  --> Room（オンラインちびデモ）
//                           /snake/<合言葉> --> SnakeRoom（スネークバトルオンライン）
//   部屋（Durable Object）は合言葉ごとに1つずつ作られる。

import { DurableObject } from "cloudflare:workers";

export { SnakeRoom } from "./snake-room.js";

const MAX_PLAYERS = 4;
const MAX_MESSAGE_BYTES = 512;
const COLORS = ["#4fc3ff", "#ff4d6d", "#5dff87", "#ffd84d"];

// 合言葉: 1〜20文字。ひらがな・カタカナ・漢字・英数字・-_ だけ
const ROOM_CODE = /^[0-9A-Za-z_\-぀-ゟ゠-ヿ一-鿿]{1,20}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(room|snake)\/([^/]+)$/);

    if (!match) {
      return new Response("tomiyoko-online: ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let code;
    try {
      code = decodeURIComponent(match[2]);
    } catch {
      return new Response("bad room code", { status: 400 });
    }
    if (!ROOM_CODE.test(code)) {
      return new Response("bad room code", { status: 400 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("websocket only", { status: 426 });
    }

    const rooms = match[1] === "snake" ? env.SNAKE_ROOMS : env.ROOMS;
    const stub = rooms.get(rooms.idFromName(code));
    return stub.fetch(request);
  },
};

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const players = this.players();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (players.length >= MAX_PLAYERS) {
      // 満員: 理由を伝えてすぐ閉じる
      server.accept();
      server.send(JSON.stringify({ type: "full", max: MAX_PLAYERS }));
      server.close(4000, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }

    const used = new Set(players.map((p) => p.color));
    const player = {
      id: crypto.randomUUID().slice(0, 8),
      name: cleanName(url.searchParams.get("name")),
      color: COLORS.find((c) => !used.has(c)) ?? COLORS[0],
      x: 0.2 + Math.random() * 0.6,
      y: 0.2 + Math.random() * 0.6,
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(player);

    server.send(JSON.stringify({ type: "welcome", you: player, players }));
    this.broadcast({ type: "join", player }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) return;

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === "move") {
      const player = ws.deserializeAttachment();
      if (!player) return;
      player.x = clamp01(data.x);
      player.y = clamp01(data.y);
      ws.serializeAttachment(player);
      this.broadcast({ type: "move", id: player.id, x: player.x, y: player.y }, ws);
    }
  }

  async webSocketClose(ws, code) {
    this.leave(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, "bye");
    } catch {
      // すでに閉じている
    }
  }

  async webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const player = ws.deserializeAttachment();
    if (!player) return;
    ws.serializeAttachment(null);
    this.broadcast({ type: "leave", id: player.id }, ws);
  }

  players() {
    return this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment())
      .filter(Boolean);
  }

  broadcast(message, except) {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        // 切れかけの接続は無視
      }
    }
  }
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function cleanName(raw) {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f<>&"'`]/g, "")
    .trim()
    .slice(0, 12);
  return name || "ななし";
}
