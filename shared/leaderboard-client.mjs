const STORAGE_KEY = "game-land.profile.v1";
const server = new URLSearchParams(globalThis.location?.search || "").get(
  "server",
);
export const API = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(server || "")
  ? `http://${server}`
  : "https://tomiyoko-online.shoulang.workers.dev";
let data;
try {
  data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
} catch {
  /* storage unavailable */
}
if (
  !data ||
  typeof data !== "object" ||
  !/^[0-9a-f]{64}$/.test(data.code || "")
)
  data = { code: "", name: "", best: {}, pending: {} };
data.best ||= {};
data.pending ||= {};
let timer, flushing;
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function profile() {
  return {
    name: data.name,
    code: data.code,
    pending: Object.keys(data.pending).length,
  };
}
export function setProfile(name, code = data.code || newCode()) {
  if (!/^[0-9a-f]{64}$/.test(code))
    throw Error("引継ぎコードは64文字の英数字です");
  name = String(name)
    .replace(/[\u0000-\u001f<>&"'`]/g, "")
    .trim()
    .slice(0, 12);
  if (!name) throw Error("ランキングに使う名前を入れてください");
  if (data.code && data.code !== code) {
    data.best = {};
    data.pending = {};
  }
  data.name = name;
  data.code = code;
  for (const [game, scores] of Object.entries(data.best))
    data.pending[game] = { ...scores };
  const persisted = save();
  return { persisted };
}
export function record(game, scores) {
  const best = (data.best[game] ||= {});
  let improved = false;
  for (const [key, value] of Object.entries(scores)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      continue;
    if (best[key] === undefined || value > best[key]) {
      best[key] = value;
      improved = true;
    }
  }
  if (!improved) return;
  data.pending[game] = { ...best };
  save();
  clearTimeout(timer);
  if (data.name && data.code)
    timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 1000);
}
export async function flush() {
  if (flushing) return flushing;
  if (!data.name || !data.code) return;
  const code = data.code;
  flushing = (async () => {
    for (const [game, scores] of Object.entries({ ...data.pending })) {
      const response = await fetch(`${API}/rankings/${game}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${code}`,
        },
        body: JSON.stringify({ name: data.name, scores }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw Error("記録を送れませんでした。後で「再送」を押してください。");
      if (
        data.code === code &&
        JSON.stringify(data.pending[game]) === JSON.stringify(scores)
      )
        delete data.pending[game];
      save();
    }
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
}
export async function load(game, metric) {
  const headers = data.code ? { Authorization: `Bearer ${data.code}` } : {};
  const response = await fetch(
    `${API}/rankings/${game}?metric=${encodeURIComponent(metric)}`,
    { headers, signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok)
    throw Error(
      "ランキングを読み込めませんでした。少し待って再読み込みしてください。",
    );
  return response.json();
}

// Preserve existing personal bests when a profile is first registered.
for (const [game, key, metric] of [
  ["snake", "snakeBest", "score"],
  ["tap-circle", "tapBest", "score"],
  ["chaos-ultra-x", "chaos_best", "kills"],
]) {
  try {
    const value = Number(localStorage.getItem(key));
    if (value > 0) record(game, { [metric]: value });
  } catch {
    /* no legacy record */
  }
}
try {
  const previous = JSON.parse(localStorage.getItem("kochan-claw-v1") || "{}");
  if (Array.isArray(previous.owned)) {
    const owned = previous.owned
      .slice(0, 20)
      .map((v) => Math.max(0, Number(v) || 0));
    record("kochan-3d-arcade", {
      prizes: owned.reduce((a, b) => a + b, 0),
      kinds: owned.filter(Boolean).length,
    });
  }
} catch {
  /* no legacy collection */
}
globalThis.GameRecords = { record, profile, setProfile, flush, load };
globalThis.addEventListener?.("online", () => {
  void flush().catch(() => {});
});
if (data.name && data.code) void flush().catch(() => {});
