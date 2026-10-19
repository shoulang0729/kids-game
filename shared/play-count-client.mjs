import { PLAY_GAMES, validPlay } from './play-policy.mjs';
const server = new URLSearchParams(globalThis.location?.search || '').get('server');
export const PLAYS_API = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(server || '') ? `http://${server}` : 'https://tomiyoko-online.shoulang.workers.dev';
const prefix = 'game-land.play-event.';
const pending = new Map();
let sending;
function restore() {
  try {
    for (let i=localStorage.length-1;i>=0;i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try { const event = JSON.parse(localStorage.getItem(key)); if (validPlay(event.game,event)) pending.set(event.id,event); else localStorage.removeItem(key); } catch { /* malformed entry */ }
    }
  } catch { /* storage unavailable: in-memory retry still works */ }
}
export async function flushPlays() {
  if (sending) return sending;
  restore();
  sending = (async () => {
    await Promise.resolve();
    for (const [id,event] of pending) {
      if (!validPlay(event.game,event)) { pending.delete(id); try { localStorage.removeItem(prefix+id); } catch {} continue; }
      const response = await fetch(`${PLAYS_API}/plays/${event.game}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,startedAt:event.startedAt}),keepalive:true,signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('プレイ回数を送れませんでした');
      pending.delete(id);
      try { localStorage.removeItem(prefix+id); } catch { /* server deduplicates if retry survives */ }
    }
  })();
  try { await sending; } finally { sending = null; }
}
export function recordPlay(game) {
  if (!PLAY_GAMES.includes(game)) return;
  try {
    restore();
    if (pending.size >= 200) return;
    const event = {game,id:crypto.randomUUID(),startedAt:Date.now()};
    pending.set(event.id,event);
    try { localStorage.setItem(prefix+event.id,JSON.stringify(event)); } catch { /* optional persistence */ }
    void flushPlays().catch(() => {});
    return event.id;
  } catch { /* counting must never prevent a game from starting */ }
}
export async function loadPlays() {
  const response = await fetch(`${PLAYS_API}/plays`,{signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw Error('遊ばれた回数を読み込めませんでした。');
  return response.json();
}
globalThis.GamePlays = {record:recordPlay};
globalThis.addEventListener?.('online',() => void flushPlays().catch(() => {}));
globalThis.addEventListener?.('storage',e => {if(e.key?.startsWith(prefix)) void flushPlays().catch(() => {});});
void flushPlays().catch(() => {});
