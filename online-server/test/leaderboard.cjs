const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "kids-ranking-server-"));
const source = fs.readFileSync(
  path.join(__dirname, "../.wrangler/test-bundle/index.js"),
  "utf8",
);
// A test-only subclass can arrange a finished match. Its endGame(), SQL and
// outbox are the production implementation, not a mock storage layer.
const script =
  source +
  `
export class TestRoom extends SnakeRoom {
  finishMatch(id, player) {
    this.matchId = id;
    this.matchProfiles = new Map([['human', player]]);
    this.game = { results: () => ({ rows: [{ id:'human',name:'家族',cpu:false,maxMeters:123.4 }] }) };
    this.endGame();
  }
  async winsForTest() { return this.tally['家族'] || 0; }
  async pendingForTest() { return this.sql.exec('SELECT COUNT(*) AS n FROM ranking_outbox').one().n; }
  flushForTest() { return this.alarm(); }
}
`;
const options = convertV4MiniflareOptions({
  modules: true,
  script,
  compatibilityDate: "2025-09-01",
  resourcePersistencePath: persist,
  durableObjects: Object.fromEntries(
    [
      ["ROOMS", "Room"],
      ["SNAKE_ROOMS", "SnakeRoom"],
      ["LEADERBOARDS", "Leaderboard"],
      ["TESTROOM", "TestRoom"],
    ].map(([key, className]) => [key, { className, useSQLite: true }]),
  ),
});
const code = "a".repeat(64),
  otherCode = "b".repeat(64);
const hash = (value) => createHash("sha256").update(value).digest("hex");
let mf;
const api = (game, init = {}) =>
  mf.dispatchFetch(`https://test/rankings/${game}`, init);
async function post(game, scores, token = code, name = "家族") {
  return api(game, {
    method: "POST",
    headers: {
      Origin: "https://shoulang0729.github.io",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, scores }),
  });
}
(async () => {
  try {
    mf = new Miniflare(options);
    assert.equal((await post("snake", { score: 30 })).status, 200);
    assert.equal((await post("snake", { score: 10 })).status, 200);
    let body = await (await api("snake")).json();
    assert.equal(body.rows[0].score, 30, "lower score cannot overwrite best");
    assert.equal((await post("snake", { score: 20 }, otherCode)).status, 200);
    body = await (
      await api("snake", { headers: { Authorization: `Bearer ${otherCode}` } })
    ).json();
    assert.equal(
      body.rows.length,
      2,
      "same names with different codes stay separate",
    );
    assert.equal(
      body.own.score,
      20,
      "same code restores own record on another device",
    );
    assert.equal((await post("tap-circle", { score: 5 })).status, 200);
    assert.equal(
      (await (await api("tap-circle")).json()).rows[0].score,
      5,
      "games are isolated",
    );
    for (const scores of [
      { score: -1 },
      { score: 1.5 },
      { score: Infinity },
      { fake: 100 },
      { score: "30" },
    ])
      assert.equal((await post("snake", scores)).status, 400);
    assert.equal((await post("snake", { score: 30 }, "bad")).status, 401);
    assert.equal(
      (await post("snake-battle-online", { wins: 999 })).status,
      400,
      "online wins cannot be submitted by a browser",
    );
    assert.equal(
      (await api("snake", { headers: { Origin: "https://other.invalid" } }))
        .status,
      403,
    );
    const cors = await api("snake", {
      method: "OPTIONS",
      headers: { Origin: "https://shoulang0729.github.io" },
    });
    assert.equal(cors.status, 204);
    assert.equal(
      cors.headers.get("Access-Control-Allow-Origin"),
      "https://shoulang0729.github.io",
    );
    assert.equal((await api("missing")).status, 404);
    assert.equal((await api("snake?metric=unknown")).status, 400);
    assert.equal(
      (
        await api("snake", {
          method: "POST",
          headers: { Authorization: `Bearer ${code}` },
          body: "x".repeat(3000),
        })
      ).status,
      400,
    );
    const boards = await mf.getDurableObjectNamespace("LEADERBOARDS");
    const board = boards.get(boards.idFromName("snake-battle-online"));
    const row = { player: hash(code), name: "家族", meters: 100, winner: true };
    await board.recordMatch("once", [row]);
    await board.recordMatch("once", [row]);
    assert.equal(
      (await (await api("snake-battle-online?metric=wins")).json()).rows[0]
        .score,
      1,
      "match replay is idempotent",
    );
    const rooms = await mf.getDurableObjectNamespace("TESTROOM");
    let room = rooms.get(rooms.idFromName("family"));
    await room.finishMatch("family-match", hash(code));
    assert.equal(await room.winsForTest(), 1);
    await room.flushForTest();
    await room.finishMatch("family-pending", hash(code));
    assert.equal(await room.pendingForTest(), 1, "unflushed match is durably queued");
    await mf.dispose();
    mf = new Miniflare(options);
    assert.equal(
      (await (await api("snake")).json()).rows[0].score,
      30,
      "best survives a full runtime restart",
    );
    const roomsAfter = await mf.getDurableObjectNamespace("TESTROOM");
    room = roomsAfter.get(roomsAfter.idFromName("family"));
    assert.equal(
      await room.winsForTest(),
      2,
      "room wins survive a full runtime restart",
    );
    await room.flushForTest();
    assert.equal(await room.pendingForTest(), 0);
    const online = await (await api("snake-battle-online?metric=wins")).json();
    assert.equal(
      online.rows[0].score,
      3,
      "durable outbox restores the unflushed match exactly once",
    );
    assert.equal(
      (await (await api("snake-battle-online?metric=meters")).json()).rows[0]
        .score,
      123.4,
    );
    console.log(
      "PASS: real Workers SQLite persistence/restart, per-game isolation, identity transfer, validation, CORS, room wins and idempotent match outbox",
    );
  } finally {
    if (mf) await mf.dispose();
    fs.rmSync(persist, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
