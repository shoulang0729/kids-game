import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
const key = "game-land.profile.v1";
// Run the shipped browser module body in independent page contexts sharing storage.
const source = readFileSync(new URL("../shared/leaderboard-client.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
function pages(initial) {
  const store = new Map(initial ? [[key, JSON.stringify(initial)]] : []), requests = [];
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  function boot(localStorage = storage) {
    const context = vm.createContext({
      localStorage, URLSearchParams, crypto: webcrypto, AbortSignal,
      setTimeout() {}, clearTimeout() {},
      fetch: async (url, options) => { requests.push({ url, ...options }); return { ok: true }; },
    });
    vm.runInContext(source, context);
    return code => vm.runInContext(code, context);
  }
  return { boot, requests, store };
}
test("records: anonymous results survive multiple page loads, keep maxima and send only after opt-in", async () => {
  const p = pages();
  let run = p.boot();
  run('record("planet-smash", {stages: 3});record("cooking", {points: 100})');
  assert.equal(run("profile().pending"), 2);
  assert.equal(p.requests.length, 0);
  run = p.boot();
  assert.equal(run("profile().pending"), 2);
  run('record("planet-smash", {stages: 1});record("cooking", {points: 200})');
  run = p.boot();
  assert.equal(run("profile().name"), "");
  assert.equal(run("profile().code"), "");
  assert.equal(p.requests.length, 0);
  run('setProfile("テスト")');
  assert.match(run("profile().code"), /^[a-f0-9]{64}$/);
  await run("flush()");
  assert.equal(p.requests.length, 2);
  const payloads = p.requests.map(r => JSON.parse(r.body));
  assert.deepEqual(payloads.map(p => p.scores), [{ stages: 3 }, { points: 200 }]);
  assert.ok(p.requests.every(r => r.headers.Authorization === "Bearer " + run("profile().code")));
  assert.equal(run("profile().pending"), 0);
  assert.equal(p.boot()("profile().code"), run("profile().code"));
});
test("records: a named profile with an invalid transfer code is discarded", () => {
  for (const code of ["", "invalid"]) {
    const p = pages({ code, name: "名前あり", best: { cooking: { points: 10 } }, pending: { cooking: { points: 10 } } });
    const run = p.boot();
    assert.equal(run("profile().name"), "");
    assert.equal(run("profile().pending"), 0);
    assert.equal(p.requests.length, 0);
  }
});
test("records: changing a registered identity does not reattribute its pending results", async () => {
  const p = pages();
  const run = p.boot();
  run('record("cooking", {points: 100});setProfile("元の名前")');
  const oldCode = run("profile().code");
  run('setProfile("別の記録", "a".repeat(64))');
  assert.notEqual(run("profile().code"), oldCode);
  await run("flush()");
  assert.equal(p.requests.length, 0);
  assert.equal(run("profile().pending"), 0);
});
test("records: unavailable browser storage remains usable within the page", () => {
  const p = pages();
  const run = p.boot({ getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } });
  run('record("planet-smash", {stages: 1})');
  assert.equal(run("profile().pending"), 1);
  assert.equal(run('setProfile("テスト").persisted'), false);
});

test("records: renaming during an in-flight upload preserves the renamed pending record", async () => {
  const p = pages(), run = p.boot();
  run('record("snake", {score: 100}); setProfile("元の名前"); let oldFetch=fetch, release; fetch=async(...args)=>{await new Promise(resolve=>{release=resolve}); return oldFetch(...args)}');
  const code=run('profile().code'), sending=run('flush()');
  run('setProfile("新しい名前"); release()');
  await sending;
  assert.equal(run('profile().pending'),1,'old upload must not erase the new name');
  assert.equal(JSON.parse(p.requests[0].body).name,'元の名前');
  run('fetch=oldFetch');await run('flush()');
  assert.equal(JSON.parse(p.requests[1].body).name,'新しい名前');
  assert.equal(p.requests[1].headers.Authorization,'Bearer '+code);
  assert.equal(run('profile().pending'),0);
});
