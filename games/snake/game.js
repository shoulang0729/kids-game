import { createSnakeGame } from "./rules.mjs";
import { readBest, saveBest } from "../../shared/records.mjs";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const startBtn = document.getElementById("startBtn");
const levelNotice = document.getElementById("levelNotice");
const levelEl = document.getElementById("level");
const gridEl = document.getElementById("gridSize");
const model = createSnakeGame();
let best = readBest("snakeBest");
let accumulator = 0,
  lastTs = 0,
  flashTimer = null;
let DPR = Math.max(1, window.devicePixelRatio || 1);
function resizeCanvas() {
  cv.width = Math.round(cv.clientWidth * DPR);
  cv.height = Math.round(cv.clientHeight * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", () => {
  DPR = Math.max(1, window.devicePixelRatio || 1);
  draw();
});
function updateHud() {
  scoreEl.textContent = "てんすう：" + model.state.score;
  bestEl.textContent = "さいこう記録：" + best;
  levelEl.textContent = model.state.level + 1;
  gridEl.textContent = model.state.grid;
}
function start() {
  clearTimeout(flashTimer);
  levelNotice.textContent = "";
  model.start();
  globalThis.GamePlays?.record("snake");
  accumulator = 0;
  lastTs = 0;
  overlay.classList.add("hidden");
  updateHud();
}
function gameOver() {
  clearTimeout(flashTimer);
  levelNotice.textContent = "";
  model.stop();
  globalThis.GameRecords?.record("snake", { score: model.state.score });
  if (model.state.score > best) {
    best = model.state.score;
    saveBest("snakeBest", best);
  }
  updateHud();
  overlay.classList.remove("hidden");
  ovTitle.textContent = "💥 おわり！ てんすう " + model.state.score;
  startBtn.textContent = "▶ もういちど";
}
function flashLevel() {
  clearTimeout(flashTimer);
  // Keep the moving board visible; the notice has its own reserved space.
  levelNotice.textContent = "⚡ レベルアップ！ L" + (model.state.level + 1);
  flashTimer = setTimeout(() => {
    levelNotice.textContent = "";
  }, 900);
}

function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;
  if (model.state.alive) {
    accumulator += dt;
    while (model.state.alive && accumulator >= 1000 / model.state.speed) {
      accumulator -= 1000 / model.state.speed;
      const result = model.step();
      updateHud();
      if (result.ended) gameOver();
      else if (result.levelChanged) flashLevel();
    }
  }
  draw();
  requestAnimationFrame(gameLoop);
}
function draw() {
  const { grid: GRID, snake, food, obstacles } = model.state;
  let CELL;
  resizeCanvas();
  const W = cv.clientWidth;
  const H = cv.clientHeight; // css px
  CELL = W / GRID;
  // clear
  ctx.clearRect(0, 0, W, H);

  // background grid subtle
  ctx.fillStyle = "rgba(5,14,22,0.35)";
  ctx.fillRect(0, 0, W, H);

  // draw obstacles
  obstacles.forEach((o) => {
    ctx.fillStyle = "rgba(155,140,255,0.22)";
    ctx.fillRect(o.x * CELL + 2, o.y * CELL + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = "rgba(155,140,255,0.08)";
    ctx.strokeRect(o.x * CELL + 2, o.y * CELL + 2, CELL - 4, CELL - 4);
  });

  // food
  if (food) {
    ctx.font = Math.floor(CELL * 0.8) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍎", food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1);
  }

  // snake body
  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    const t = i / Math.max(1, snake.length);
    const x = s.x * CELL;
    const y = s.y * CELL;
    if (i === 0) {
      // head
      ctx.font = Math.floor(CELL * 0.9) + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😊", x + CELL / 2, y + CELL / 2 + 1);
      // glow
      ctx.fillStyle = "rgba(124,181,255,0.06)";
      ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    } else {
      const g = 140 - t * 80;
      ctx.fillStyle = `hsl(${g}, 70%, ${45 - t * 18}%)`;
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    }
  }

  // border glow
  ctx.strokeStyle = "rgba(124,231,255,0.06)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W, H);
}

// controls
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k))
    e.preventDefault();
  if (k === "ArrowUp") model.setDirection(0, -1);
  if (k === "ArrowDown") model.setDirection(0, 1);
  if (k === "ArrowLeft") model.setDirection(-1, 0);
  if (k === "ArrowRight") model.setDirection(1, 0);
  if (k === " " && !model.state.alive) start();
});

// touch swipe
let sx = 0,
  sy = 0;
cv.addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
  },
  { passive: true },
);
cv.addEventListener(
  "touchmove",
  (e) => {
    if (!sx && !sy) return;
    const t = e.touches[0];
    const dx = t.clientX - sx,
      dy = t.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) model.setDirection(dx > 0 ? 1 : -1, 0);
    else model.setDirection(0, dy > 0 ? 1 : -1);
    sx = 0;
    sy = 0;
  },
  { passive: true },
);

updateHud();
draw();
requestAnimationFrame(gameLoop);
startBtn.onclick = start;

