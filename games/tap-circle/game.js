"use strict";
const field = document.getElementById("field");
const target = document.getElementById("target");
const message = document.getElementById("message");
const start = document.getElementById("start");
const timeLabel = document.getElementById("time");
const scoreLabel = document.getElementById("score");
const bestLabel = document.getElementById("best");
let score = 0,
  best = 0,
  playing = false,
  endTime = 0,
  timer = null;
try {
  best = Number(localStorage.getItem("tapBest")) || 0;
} catch (e) {}
bestLabel.textContent = "最高記録：" + best + "点";
function moveTarget() {
  const maxX = Math.max(0, field.clientWidth - target.offsetWidth);
  const maxY = Math.max(0, field.clientHeight - target.offsetHeight);
  target.style.left = Math.random() * maxX + "px";
  target.style.top = Math.random() * maxY + "px";
}
function finish() {
  playing = false;
  clearInterval(timer);
  target.style.display = "none";
  timeLabel.textContent = "0";
  message.textContent = "終了！ " + score + "点！ 🎉";
  start.disabled = false;
  start.textContent = "もう一回！";
  if (score > best) {
    best = score;
    bestLabel.textContent = "最高記録：" + best + "点";
    message.textContent = "最高記録！ " + score + "点！ 🏆";
    try {
      localStorage.setItem("tapBest", String(best));
    } catch (e) {}
  }
}
function updateTime() {
  const remaining = endTime - performance.now();
  timeLabel.textContent = Math.max(0, Math.ceil(remaining / 1000));
  if (remaining <= 0) finish();
}
start.addEventListener("click", function () {
  if (playing) return;
  score = 0;
  playing = true;
  scoreLabel.textContent = "0";
  timeLabel.textContent = "20";
  message.textContent = "";
  start.disabled = true;
  start.textContent = "プレイ中！";
  target.style.display = "block";
  moveTarget();
  endTime = performance.now() + 20000;
  clearInterval(timer);
  timer = setInterval(updateTime, 50);
});
target.addEventListener("pointerdown", function (event) {
  event.preventDefault();
  if (!playing) return;
  if (performance.now() >= endTime) {
    finish();
    return;
  }
  score++;
  scoreLabel.textContent = score;
  moveTarget();
});
window.addEventListener("resize", function () {
  if (playing) moveTarget();
});
