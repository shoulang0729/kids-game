import { RANKINGS } from './leaderboard-policy.mjs';
export const PLAY_GAMES = Object.freeze(Object.keys(RANKINGS));
export const EVENT_AGE = 7 * 24 * 60 * 60 * 1000;
export function validPlay(game, event, now = Date.now()) {
  return PLAY_GAMES.includes(game) && event && typeof event.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(event.id || '') &&
    Number.isSafeInteger(event.startedAt) && event.startedAt >= now - EVENT_AGE && event.startedAt <= now + 60000;
}
export function playSummary(rows) {
  const counts = Object.fromEntries(PLAY_GAMES.map(game => [game, 0]));
  for (const row of rows) if (PLAY_GAMES.includes(row.game)) counts[row.game] = Number(row.plays);
  const most = Math.max(0, ...Object.values(counts));
  return { counts, leaders: most ? PLAY_GAMES.filter(game => counts[game] === most) : [], most, total: Object.values(counts).reduce((sum, n) => sum + n, 0) };
}
