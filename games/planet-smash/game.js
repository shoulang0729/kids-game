const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const msg = document.getElementById("msg");

const planetGame = PlanetState.createGame(PlanetData);
const planet = planetGame.state;
const { stages } = PlanetData;
const { attacks } = planet;

let rot = 0;
let shake = 0;
let boom = 0;
let cracks = [];
let effects = [];
let poisonTimers = [];

function stopPoison(timer) {
  clearInterval(timer);
  let i = poisonTimers.indexOf(timer);
  if (i >= 0) poisonTimers.splice(i, 1);
}

function clearAllPoison() {
  poisonTimers.forEach((t) => clearInterval(t));
  poisonTimers = [];
}

function makeButtons() {
  const box = document.getElementById("attackButtons");
  box.innerHTML = "";
  attacks.forEach((a, i) => {
    let btn = document.createElement("button");
    btn.id = "atk" + i;
    btn.onclick = () => attackButton(i);
    box.appendChild(btn);
  });
  updateButtons();
}

function updateButtons() {
  attacks.forEach((a, i) => {
    let btn = document.getElementById("atk" + i);
    btn.className = "";
    if (i === planet.selected) btn.classList.add("selected");
    if (!a.unlocked) btn.classList.add("locked");

    if (a.unlocked) {
      btn.textContent =
        a.name +
        " / " +
        (a.type === "rainbow" ? "3000〜14999" : a.dmg) +
        "ダメージ";
    } else {
      btn.textContent = "🔒 解放 " + a.cost + "円： " + a.name;
    }
  });
}

function attackButton(i) {
  const result = planetGame.chooseAttack(i);
  if (!result) return;
  const a = result.attack;
  msg.textContent =
    result.status === "insufficient"
      ? "お金が足りない！必要：" + a.cost + "円"
      : result.status === "unlocked"
        ? a.name + " を解放！これから無料で使える！"
        : a.name + " を選択！惑星をタッチ！";
  updateText();
  updateButtons();
}

function updateText() {
  document.getElementById("stageName").textContent = stages[planet.stage].name;
  document.getElementById("money").textContent = Math.floor(planet.money);
  document.getElementById("hp").textContent = Math.max(
    0,
    Math.floor(planet.hp),
  );
  document.getElementById("maxHp").textContent = planet.maxHp;
  document.getElementById("attackName").textContent =
    attacks[planet.selected].name;
  let damage = Math.floor((1 - planet.hp / planet.maxHp) * 100);
  document.getElementById("damage").textContent = Math.min(
    100,
    Math.max(0, damage),
  );
}

function hitVisual(tx, ty) {
  shake = 18;
  boom = 25;
  cracks.push({
    a: Math.random() * Math.PI * 2,
    len: 25 + Math.random() * 90,
    x: tx - 350,
    y: ty - 200,
  });
}

function showTransition(transition) {
  if (!transition) return false;
  clearAllPoison();
  globalThis.GameRecords?.record("planet-smash", {
    stages: transition.completed,
  });
  if (transition.cleared) {
    msg.textContent = "🏆 完全クリア！宇宙皇帝ゼログを破壊した！";
  } else {
    cracks = [];
    boom = 40;
    shake = 25;
    msg.textContent =
      "ステージクリア！ +" +
      transition.bonus +
      "円！ 次は " +
      stages[planet.stage].name;
  }
  return true;
}

function useAttack(tx, ty) {
  const result = planetGame.attack();
  if (!result) {
    msg.textContent = "完全クリア済み！もう一回で最初から！";
    return;
  }
  const a = result.attack;
  effects.push({ x: tx, y: ty, color: a.color, type: a.type, life: 28 });
  hitVisual(tx, ty);
  if (!showTransition(result.transition)) {
    msg.textContent =
      a.name +
      "！ " +
      result.damage +
      "ダメージ！ +" +
      result.reward +
      "円！" +
      (result.poison ? "毒追加！" : "");
  }
  if (result.poison) {
    const timer = setInterval(() => {
      const tick = planetGame.tickPoison(result.poison);
      if (!tick) {
        stopPoison(timer);
        return;
      }
      effects.push({ x: tx, y: ty, color: "lime", type: "poison", life: 16 });
      cracks.push({
        a: Math.random() * Math.PI * 2,
        len: 30 + Math.random() * 50,
        x: tx - 350,
        y: ty - 200,
      });
      showTransition(tick.transition);
      if (!tick.active) stopPoison(timer);
      updateText();
      updateButtons();
    }, 600);
    poisonTimers.push(timer);
  }
  updateText();
  updateButtons();
}

function damagePlanet(dmg, tx, ty) {
  const result = planetGame.damage(Number(dmg));
  if (!result) return;
  hitVisual(tx, ty);
  showTransition(result.transition);
  updateText();
  updateButtons();
}

function resetGame() {
  clearAllPoison();
  planetGame.reset();
  rot = shake = boom = 0;
  cracks = [];
  effects = [];
  msg.textContent = "🔄 もう一回スタート！地球が復活した！";
  updateText();
  updateButtons();
}

// A touch generates a click too: listen once so one tap means one attack.
canvas.addEventListener("click", function (event) {
  const rect = canvas.getBoundingClientRect();
  useAttack(
    (event.clientX - rect.left) * (canvas.width / rect.width),
    (event.clientY - rect.top) * (canvas.height / rect.height),
  );
});
canvas.addEventListener("keydown", function (event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (!event.repeat) useAttack(canvas.width / 2, canvas.height / 2);
});

function drawStars() {
  ctx.fillStyle = "white";
  for (let i = 0; i < 90; i++) {
    let x = (i * 97) % 700;
    let y = (i * 53) % 400;
    let s = (i % 3) + 1;
    ctx.globalAlpha = 0.3 + 0.7 * Math.sin(rot + i);
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawPlanet() {
  let st = stages[planet.stage];
  let cx = 350 + (Math.random() * shake - shake / 2);
  let cy = 200 + (Math.random() * shake - shake / 2);
  let r = 115;

  let grad = ctx.createRadialGradient(cx - 45, cy - 55, 15, cx, cy, r);
  grad.addColorStop(0, st.color1);
  grad.addColorStop(0.45, st.color2);
  grad.addColorStop(1, "#000014");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = st.land;
  for (let i = 0; i < 8; i++) {
    let x = cx + Math.sin(rot + i) * 90;
    let y = cy + Math.cos(rot * 0.7 + i * 2) * 55;
    ctx.beginPath();
    ctx.ellipse(x, y, 35, 17, Math.sin(i), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,.22)";
  for (let i = -90; i <= 90; i += 25) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, Math.sqrt(r * r - i * i) / 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,0,0,.9)";
  ctx.lineWidth = 3;
  cracks.forEach((cr) => {
    ctx.beginPath();
    let x = cx + cr.x;
    let y = cy + cr.y;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(cr.a) * cr.len, y + Math.sin(cr.a) * cr.len);
    ctx.lineTo(
      x + (Math.cos(cr.a + 0.8) * cr.len) / 2,
      y + (Math.sin(cr.a + 0.8) * cr.len) / 2,
    );
    ctx.stroke();
  });

  ctx.restore();

  ctx.strokeStyle = "rgba(120,200,255,.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.stroke();

  if (st.ring) {
    ctx.strokeStyle = "rgba(255,220,120,.8)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r + 45, 28, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (boom > 0) {
    ctx.fillStyle = "rgba(255,120,0," + boom / 40 + ")";
    ctx.beginPath();
    ctx.arc(cx, cy, 150 - boom * 2, 0, Math.PI * 2);
    ctx.fill();
    boom--;
  }

  if (planet.cleared) {
    ctx.fillStyle = "rgba(255,80,0,.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, 170 + Math.sin(rot * 8) * 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "48px sans-serif";
    ctx.fillText("完全勝利", cx - 100, cy + 18);
  }

  if (shake > 0) shake--;
}

function drawEffects() {
  for (let i = effects.length - 1; i >= 0; i--) {
    let e = effects[i];
    ctx.globalAlpha = e.life / 28;

    if (
      e.type === "beam" ||
      e.type === "poison" ||
      e.type === "rainbow" ||
      e.type === "blackhole"
    ) {
      ctx.lineWidth = 8;
      ctx.strokeStyle =
        e.type === "rainbow"
          ? ["red", "orange", "yellow", "lime", "cyan", "blue", "purple"][
              e.life % 7
            ]
          : e.color;
      ctx.beginPath();
      ctx.moveTo(80, 70);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }

    if (e.type === "meteor") {
      ctx.font = "46px sans-serif";
      ctx.fillText("☄️", e.x - 25, e.y + 15);
    }

    if (e.type === "blast") {
      ctx.font = "46px sans-serif";
      ctx.fillText("🌋", e.x - 25, e.y + 15);
    }

    if (e.type === "wave") {
      ctx.font = "46px sans-serif";
      ctx.fillText("🌊", e.x - 25, e.y + 15);
    }

    if (e.type === "turret") {
      ctx.font = "40px sans-serif";
      ctx.fillText("🏰🏰🏰", e.x - 70, e.y + 10);
    }

    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 30 - e.life / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "24px sans-serif";
    ctx.fillText("💥", e.x - 13, e.y + 9);

    e.life--;
    if (e.life <= 0) effects.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  ctx.clearRect(0, 0, 700, 400);
  drawStars();
  drawPlanet();
  drawEffects();
  rot += 0.018;
  requestAnimationFrame(loop);
}

makeButtons();
updateText();
loop();
