// Extracted without changing the original functions; page state stays in game.js.
function random(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  t = clamp(t, 0, 1);

  return t * t * (3 - 2 * t);
}

function angleDiff(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function metersToSegments(meters) {
  return Math.max(8, Math.floor(meters / METERS_PER_SEGMENT));
}
