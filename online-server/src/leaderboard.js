import { DurableObject } from "cloudflare:workers";
import { RANKINGS, validScores } from "../../shared/leaderboard-policy.mjs";

export function cleanName(raw) {
  return (
    String(raw ?? "")
      .replace(/[\u0000-\u001f<>&"'`]/g, "")
      .trim()
      .slice(0, 12) || "ななし"
  );
}
export async function playerId(token) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// One SQLite-backed object per game, not one global bottleneck.
export class Leaderboard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scores (
      metric TEXT NOT NULL, player TEXT NOT NULL, name TEXT NOT NULL,
      score REAL NOT NULL, updated INTEGER NOT NULL,
      PRIMARY KEY(metric, player)
    );
    CREATE INDEX IF NOT EXISTS scores_order ON scores(metric, score DESC, updated ASC);
    CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS rate (player TEXT PRIMARY KEY, started INTEGER, count INTEGER);`);
  }
  upsert(metric, player, name, score) {
    this.sql.exec(
      `INSERT INTO scores(metric,player,name,score,updated) VALUES(?,?,?,?,?)
      ON CONFLICT(metric,player) DO UPDATE SET name=excluded.name,
      score=MAX(scores.score,excluded.score),
      updated=CASE WHEN excluded.score > scores.score THEN excluded.updated ELSE scores.updated END`,
      metric,
      player,
      cleanName(name),
      score,
      Date.now(),
    );
  }
  submit(game, player, name, scores) {
    if (game === "snake-battle-online" || !validScores(game, scores))
      return { error: "invalid score", status: 400 };
    const now = Date.now();
    const rate = this.sql
      .exec("SELECT started,count FROM rate WHERE player=?", player)
      .toArray()[0];
    if (rate && now - rate.started < 60000 && rate.count >= 20)
      return { error: "少し待って再送してください", status: 429 };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        `INSERT INTO rate VALUES(?,?,1) ON CONFLICT(player) DO UPDATE SET
        started=CASE WHEN ?-started>=60000 THEN ? ELSE started END,
        count=CASE WHEN ?-started>=60000 THEN 1 ELSE count+1 END`,
        player,
        now,
        now,
        now,
        now,
      );
      for (const [key, score] of Object.entries(scores))
        this.upsert(key, player, name, score);
    });
    return { saved: true };
  }
  list(metric, player = null) {
    const rows = this.sql
      .exec(
        "SELECT player,name,score FROM scores WHERE metric=? ORDER BY score DESC,updated ASC,player ASC LIMIT 20",
        metric,
      )
      .toArray();
    const own = player
      ? this.sql
          .exec(
            "SELECT name,score FROM scores WHERE metric=? AND player=?",
            metric,
            player,
          )
          .toArray()[0] || null
      : null;
    // The capability itself is never returned or stored; public IDs are hashes.
    return { rows, own };
  }
  recordMatch(matchId, results) {
    return this.ctx.storage.transactionSync(() => {
      if (
        this.sql.exec("SELECT id FROM matches WHERE id=?", matchId).toArray()
          .length
      )
        return;
      this.sql.exec("INSERT INTO matches VALUES(?)", matchId);
      for (const row of results) {
        if (
          !/^[0-9a-f]{64}$/.test(row.player) ||
          !Number.isFinite(row.meters) ||
          row.meters < 0 ||
          row.meters > RANKINGS["snake-battle-online"].meters.max
        )
          continue;
        this.upsert("meters", row.player, row.name, row.meters);
        if (row.winner) {
          this.sql.exec(
            `INSERT INTO scores VALUES('wins',?,?,1,?) ON CONFLICT(metric,player)
            DO UPDATE SET score=scores.score+1,name=excluded.name,updated=excluded.updated`,
            row.player,
            cleanName(row.name),
            Date.now(),
          );
        }
      }
    });
  }
}

async function boundedJSON(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const parts = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export async function rankingsRequest(request, env) {
  const url = new URL(request.url),
    origin = request.headers.get("Origin");
  const allowed =
    origin === "https://shoulang0729.github.io" ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (allowed)
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  if (origin && !allowed) return json({ error: "origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  const game = url.pathname.slice("/rankings/".length);
  if (!Object.hasOwn(RANKINGS, game))
    return json({ error: "unknown game" }, 404);
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  const player = await playerId(token);
  const stub = env.LEADERBOARDS.get(env.LEADERBOARDS.idFromName(game));
  if (request.method === "GET") {
    const metric =
      url.searchParams.get("metric") || Object.keys(RANKINGS[game])[0];
    if (!Object.hasOwn(RANKINGS[game], metric))
      return json({ error: "unknown metric" }, 400);
    return json(await stub.list(metric, player));
  }
  if (request.method !== "POST")
    return json({ error: "method not allowed" }, 405);
  if (!player) return json({ error: "invalid player code" }, 401);
  const data = await boundedJSON(request);
  if (!data || !validScores(game, data.scores))
    return json({ error: "invalid score" }, 400);
  const result = await stub.submit(
    game,
    player,
    cleanName(data.name),
    data.scores,
  );
  return json(result, result.status || 200);
}
