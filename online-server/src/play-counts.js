import { DurableObject } from 'cloudflare:workers';
import { validPlay, playSummary, EVENT_AGE } from '../../shared/play-policy.mjs';
export class PlayCounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS play_totals(game TEXT PRIMARY KEY,plays INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS play_events(id TEXT PRIMARY KEY,started INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS play_events_time ON play_events(started);`);
  }
  record(game, event) {
    if (!validPlay(game, event)) return { error: 'invalid play', status: 400 };
    return this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM play_events WHERE started<?', Date.now() - EVENT_AGE - 60000);
      if (this.sql.exec('SELECT id FROM play_events WHERE id=?', event.id).toArray().length) return { counted: false };
      this.sql.exec('INSERT INTO play_events VALUES(?,?)', event.id, event.startedAt);
      this.sql.exec('INSERT INTO play_totals VALUES(?,1) ON CONFLICT(game) DO UPDATE SET plays=plays+1', game);
      return { counted: true };
    });
  }
  list() { return playSummary(this.sql.exec('SELECT game,plays FROM play_totals').toArray()); }
}
async function bodyJSON(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0; const chunks = [];
  for (;;) { const {value,done} = await reader.read(); if (done) break; size += value.length; if (size > 512) { await reader.cancel(); return null; } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part,offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}
export async function playsRequest(request, env) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const allowed = origin === 'https://shoulang0729.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin'};
  if (allowed) Object.assign(headers, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
  const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers});
  if (origin && !allowed) return json({error:'origin not allowed'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  const stub = env.PLAY_COUNTS.get(env.PLAY_COUNTS.idFromName('all-games'));
  if (request.method === 'GET' && url.pathname === '/plays') return json(await stub.list());
  if (request.method !== 'POST') return json({error:'method not allowed'},405);
  const match = url.pathname.match(/^\/plays\/([a-z0-9-]+)$/), body = await bodyJSON(request);
  if (!match || !validPlay(match[1],body)) return json({error:'invalid play'},400);
  const result = await stub.record(match[1],body);
  return json(result,result.status || 200);
}
