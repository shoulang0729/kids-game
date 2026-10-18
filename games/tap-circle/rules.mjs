// No DOM, timers or storage: callers supply the monotonic time.
export function createTapGame(best = 0) {
  const state = { score: 0, best, playing: false, endTime: 0 };
  function finish() {
    if (!state.playing) return { finished: false, newRecord: false };
    state.playing = false;
    const newRecord = state.score > state.best;
    if (newRecord) state.best = state.score;
    return { finished: true, newRecord };
  }
  return {
    state,
    start(now) {
      if (state.playing) return false;
      state.score = 0;
      state.playing = true;
      state.endTime = now + 20000;
      return true;
    },
    update(now) {
      return state.playing && now >= state.endTime
        ? finish()
        : { finished: false };
    },
    tap(now) {
      if (!state.playing) return { scored: false, finished: false };
      if (now >= state.endTime) return { scored: false, ...finish() };
      state.score++;
      return { scored: true, finished: false };
    },
    secondsLeft(now) {
      return Math.max(0, Math.ceil((state.endTime - now) / 1000));
    },
  };
}
