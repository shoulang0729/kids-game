import { loadPlays, flushPlays } from './play-count-client.mjs';
import { playSummary } from './play-policy.mjs';
const status = document.getElementById('popular-status'), winner = document.getElementById('popular-winner'), count = document.getElementById('popular-count'), button = document.getElementById('popular-refresh');
let catalog;
async function refresh() {
  button.disabled = true; status.textContent = 'みんなのプレイ回数を調べています…';
  try {
    if (!catalog) {const response = await fetch('data/games.json');if (!response.ok) throw Error('ゲーム一覧を読み込めませんでした。');catalog = await response.json();}
    try {await flushPlays();} catch { /* still show counts already on the server */ }
    const result = await loadPlays();
    if (!result.counts || Object.values(result.counts).some(n => !Number.isSafeInteger(n) || n<0)) throw Error('回数を読み込めませんでした。');
    const summary = playSummary(Object.entries(result.counts).map(([game,plays]) => ({game,plays})));
    winner.replaceChildren();
    if (!summary.leaders.length) { count.textContent = 'まだ集計がありません';status.textContent = 'ゲームを始めると回数が増えるよ。最初の1回を遊んでみよう！';return; }
    for (const id of summary.leaders) {
      const game = catalog.find(g => g.id === id);if (!game) continue;
      const link = document.createElement('a');link.href = `games/${id}/${game.entry || 'index.html'}`;link.textContent = `${game.emoji} ${game.title}`;winner.append(link);
    }
    count.textContent = `${summary.leaders.length>1?'同率1位':'1位'} · ${summary.most.toLocaleString('ja-JP')}回`;
    status.textContent = `全ゲーム合計 ${summary.total.toLocaleString('ja-JP')}回。名前を押すと遊べるよ！`;
  } catch { status.textContent = 'いまは回数を読み込めません。「回数を更新」で、もう一度試せるよ。'; }
  finally { button.disabled = false; }
}
button.addEventListener('click',() => void refresh());
void refresh();
