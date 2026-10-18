// Local records remain usable when storage is disabled or full.
export function readBest(key, getStorage = () => globalThis.localStorage) {
  try {
    const value = Number(getStorage().getItem(key));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}
export function saveBest(
  key,
  value,
  getStorage = () => globalThis.localStorage,
) {
  try {
    getStorage().setItem(key, String(value));
  } catch {
    /* gameplay continues */
  }
}
