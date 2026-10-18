import { createTapGame } from "./rules.mjs";
import { readBest, saveBest } from "../../shared/records.mjs";
("use strict");
const field = document.getElementById("field");
const target = document.getElementById("target");
const message = document.getElementById("message");
const start = document.getElementById("start");
const timeLabel = document.getElementById("time");
const scoreLabel = document.getElementById("score");
const bestLabel = document.getElementById("best");
const round = createTapGame(readBest("tapBest"));
let timer = null;
bestLabel.textContent = "最高記録：" + round.state.best + "点";
function moveTarget() {
  const maxX = Math.max(0, field.clientWidth - target.offsetWidth);
  const maxY = Math.max(0, field.clientHeight - target.offsetHeight);
  target.style.left = Math.random() * maxX + "px";
  target.style.top = Math.random() * maxY + "px";
}
function finish(result) {
  if (!result.finished) return;
  globalThis.GameRecords?.record("tap-circle", { score: round.state.score });
  clearInterval(timer);
  target.style.display = "none";
  timeLabel.textContent = "0";
  message.textContent = "終了！ " + round.state.score + "点！ 🎉";
  start.disabled = false;
  start.textContent = "もう一回！";
  if (result.newRecord) {
    bestLabel.textContent = "最高記録：" + round.state.best + "点";
    message.textContent = "最高記録！ " + round.state.score + "点！ 🏆";
    saveBest("tapBest", round.state.best);
  }
}
function updateTime() {
  const now = performance.now();
  timeLabel.textContent = round.secondsLeft(now);
  finish(round.update(now));
}
start.addEventListener("click", function () {
  if (!round.start(performance.now())) return;
  scoreLabel.textContent = "0";
  timeLabel.textContent = "20";
  message.textContent = "";
  start.disabled = true;
  start.textContent = "プレイ中！";
  target.style.display = "block";
  moveTarget();
  clearInterval(timer);
  timer = setInterval(updateTime, 50);
});
target.addEventListener("pointerdown", function (event) {
  event.preventDefault();
  const result = round.tap(performance.now());
  if (!result.scored) {
    finish(result);
    return;
  }
  scoreLabel.textContent = round.state.score;
  moveTarget();
});
window.addEventListener("resize", function () {
  if (round.state.playing) moveTarget();
});
