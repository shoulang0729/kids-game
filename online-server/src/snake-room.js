// スネークバトルオンライン: 1つの合言葉 = 1つの部屋
//
// 部屋の流れ:  lobby（ロビー） → countdown（3,2,1） → playing（ゲーム中） → lobby（結果のあと）
// 人は最大4人。ゲーム中に入ってきた人は観戦して、次のゲームから参加する。

import { DurableObject } from "cloudflare:workers";
import { Game, TICK_MS, COLORS, TOTAL_SNAKES } from "./snake/game.js";

const MAX_HUMANS = 4;
const COUNTDOWN_MS = 3000;
const MAX_MESSAGES_PER_SEC = 40;

const DEFAULT_SETTINGS = { mode: "time", minutes: 3, size: "m", rocks: true, cpu: "normal" };
const ALLOWED = {
  mode: ["time", "survival"],
  minutes: [1, 2, 3, 5],
  size: ["s", "m", "l"],
  rocks: [true, false],
  cpu: ["easy", "normal", "hard"],
};

export class SnakeRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.clients = [];          // 入った順
    this.hostId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = "lobby";
    this.tally = {};            // 名前 -> 優勝回数
    this.game = null;
    this.loop = null;
    this.countdownTimer = null;
    this.countdownEnds = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const pair = new WebSocketPair();
    const [clientSocket, ws] = Object.values(pair);
    ws.accept();

    if (this.clients.length >= MAX_HUMANS) {
      ws.send(JSON.stringify({ t: "full", max: MAX_HUMANS }));
      ws.close(4000, "room full");
      return new Response(null, { status: 101, webSocket: clientSocket });
    }

    const taken = new Set(this.clients.map((c) => c.color));
    const client = {
      id: crypto.randomUUID().slice(0, 8),
      name: cleanName(url.searchParams.get("name")),
      color: COLORS.findIndex((_, i) => !taken.has(i)),
      ready: false,
      playing: false,
      ws,
      msgWindow: 0,
      msgCount: 0,
    };
    this.clients.push(client);
    if (!this.hostId) this.hostId = client.id;

    ws.addEventListener("message", (e) => this.onMessage(client, e.data));
    ws.addEventListener("close", () => this.onLeave(client));
    ws.addEventListener("error", () => this.onLeave(client));

    this.send(client, { t: "welcome", you: client.id });
    if (this.game && this.phase !== "lobby") {
      // ゲーム中に入ってきた人は観戦
      this.send(client, this.startMessage());
    }
    this.broadcastLobby();
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  onMessage(client, raw) {
    const now = Date.now();
    if (now - client.msgWindow > 1000) {
      client.msgWindow = now;
      client.msgCount = 0;
    }
    if (++client.msgCount > MAX_MESSAGES_PER_SEC) return;
    if (typeof raw !== "string" || raw.length > 400) return;

    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const isHost = client.id === this.hostId;

    switch (m.t) {
      case "in":
        if (this.phase === "playing" && client.playing) this.game.input(client.id, Number(m.a), m.b);
        return;
      case "p":
        return; // つながっているかの確認だけ
      case "ready":
        if (this.phase !== "lobby") return;
        client.ready = !!m.v;
        break;
      case "color": {
        const c = Number(m.c);
        if (this.phase !== "lobby" || !Number.isInteger(c) || c < 0 || c >= COLORS.length) return;
        if (this.clients.some((o) => o !== client && o.color === c)) return;
        client.color = c;
        break;
      }
      case "settings": {
        if (!isHost || this.phase !== "lobby" || typeof m.s !== "object" || !m.s) return;
        for (const key of Object.keys(ALLOWED)) {
          if (key in m.s && ALLOWED[key].includes(m.s[key])) this.settings[key] = m.s[key];
        }
        break;
      }
      case "start":
        if (!isHost || this.phase !== "lobby" || !this.everyoneReady()) return;
        this.startGame();
        return;
      default:
        return;
    }
    this.broadcastLobby();
  }

  everyoneReady() {
    return this.clients.every((c) => c.ready || c.id === this.hostId);
  }

  onLeave(client) {
    const i = this.clients.indexOf(client);
    if (i < 0) return;
    this.clients.splice(i, 1);
    if (this.game && client.playing) this.game.playerLeft(client.id);
    if (this.hostId === client.id) this.hostId = this.clients[0]?.id ?? null;

    if (this.clients.length === 0) {
      this.stopGame();
      this.phase = "lobby";
      return;
    }
    this.broadcastLobby();
  }

  // ---------- ゲーム ----------

  startGame() {
    const players = this.clients.map((c) => ({ id: c.id, name: c.name, color: c.color }));
    for (const c of this.clients) c.playing = true;
    this.game = new Game({ ...this.settings }, players);
    this.phase = "countdown";
    this.countdownEnds = Date.now() + COUNTDOWN_MS;
    this.broadcast(this.startMessage());
    this.broadcastLobby();

    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      if (!this.game) return;
      this.phase = "playing";
      this.loop = setInterval(() => this.tick(), TICK_MS);
    }, COUNTDOWN_MS);
  }

  startMessage() {
    return {
      t: "start",
      ...this.game.fullState(),
      cd: Math.max(0, this.countdownEnds - Date.now()) / 1000,
    };
  }

  tick() {
    if (!this.game) return;
    this.game.tick();
    this.broadcast(this.game.snapshot());
    if (this.game.over) this.endGame();
  }

  endGame() {
    const results = this.game.results();
    const winner = results.rows[0];
    if (winner) {
      const key = winner.cpu ? "🤖 CPU" : winner.name;
      this.tally[key] = (this.tally[key] ?? 0) + 1;
    }
    this.stopGame();
    this.phase = "lobby";
    for (const c of this.clients) {
      c.ready = false;
      c.playing = false;
    }
    this.broadcast({ t: "end", results, tally: this.tally });
    this.broadcastLobby();
  }

  stopGame() {
    if (this.loop) clearInterval(this.loop);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.loop = null;
    this.countdownTimer = null;
    this.game = null;
  }

  // ---------- 送信 ----------

  lobbyState() {
    return {
      t: "lobby",
      phase: this.phase,
      host: this.hostId,
      players: this.clients.map((c) => ({ id: c.id, name: c.name, color: c.color, ready: c.ready, playing: c.playing })),
      settings: this.settings,
      cpuCount: TOTAL_SNAKES - this.clients.length,
      tally: this.tally,
    };
  }

  broadcastLobby() {
    this.broadcast(this.lobbyState());
  }

  broadcast(message) {
    const text = JSON.stringify(message);
    for (const c of this.clients) {
      try {
        c.ws.send(text);
      } catch {
        // 切れかけの接続は close で片付く
      }
    }
  }

  send(client, message) {
    try {
      client.ws.send(JSON.stringify(message));
    } catch {
      // 同上
    }
  }
}

function cleanName(raw) {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f<>&"'`]/g, "")
    .trim()
    .slice(0, 12);
  return name || "ななし";
}
