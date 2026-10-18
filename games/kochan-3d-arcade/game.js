"use strict";
const $ = (s) => document.querySelector(s),
  clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  ease = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
const kinds = [
  ["🧸", "くま"],
  ["🐰", "うさぎ"],
  ["🦖", "きょうりゅう"],
  ["🐱", "ねこ"],
  ["🐧", "ペンギン"],
  ["🐙", "たこ"],
  ["🐶", "いぬ"],
  ["🦄", "ユニコーン"],
  ["🐼", "パンダ"],
  ["🦊", "きつね"],
  ["🐸", "かえる"],
  ["🐨", "コアラ"],
  ["🦁", "ライオン"],
  ["🐷", "ぶた"],
  ["🤖", "ロボット"],
  ["👽", "宇宙人"],
  ["🐥", "ひよこ"],
  ["🦈", "サメ"],
  ["🐲", "ドラゴン"],
  ["🦝", "アライグマ"],
];
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("kochan-claw-v1") || "{}") || {};
} catch {}
let owned = Array.from({ length: kinds.length }, (_, i) =>
    Math.max(0, Number(saved.owned?.[i]) || 0),
  ),
  tries = Number(saved.tries) || 0,
  soundOn = false,
  audio = null;
function msg(s) {
  $("#message").textContent = s;
}
function tone(f, d = 0.12) {
  if (!soundOn) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    let o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.frequency.value = f;
    g.gain.setValueAtTime(0.06, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
    o.start();
    o.stop(audio.currentTime + d);
  } catch {}
}
function updateUI() {
  const total = owned.reduce((a, b) => a + b, 0),
    unique = owned.filter(Boolean).length;
  globalThis.GameRecords?.record("kochan-3d-arcade", { prizes: total, kinds: unique });
  $("#score").textContent = `GET ${total} / ${unique}種類`;
  $("#collectionStats").textContent =
    `${unique} / ${kinds.length}種類 · 合計${total}個 · ${tries}回プレイ`;
  $("#collection").innerHTML = kinds
    .map(
      (k, i) =>
        `<div class="item ${owned[i] ? "" : "lock"}">${k[0]}<small>${owned[i] ? k[1] + " ×" + owned[i] : "？？？"}</small></div>`,
    )
    .join("");
  try {
    localStorage.setItem("kochan-claw-v1", JSON.stringify({ owned, tries }));
  } catch {}
}
const configs = [
  {
    offset: -4,
    name: "① 本格台",
    real: true,
    arms: 2,
    type: "real",
    speed: 1,
    size: 1,
    risk: 0,
    color: "#f0adc8",
    title: "01  REAL UFO",
    hint: "①横 → ②奥の2ボタン操作",
  },
  {
    offset: 4,
    name: "② 自由台",
    real: false,
    arms: 3,
    type: "free",
    speed: 1,
    size: 1,
    risk: 0,
    color: "#9ce4e0",
    title: "02  FREE UFO",
    hint: "4方向に動かして好きな場所でつかむ",
  },
  {
    offset: -12,
    name: "③ ミニ台",
    real: false,
    arms: 3,
    type: "mini",
    speed: 1.3,
    size: 0.65,
    risk: -0.02,
    color: "#b8cdfc",
    title: "03  MINI CATCH",
    hint: "小さい人形がたくさん！ アームの動きが速い",
  },
  {
    offset: 12,
    name: "④ ジャンボ台",
    real: true,
    arms: 2,
    type: "giant",
    speed: 0.8,
    size: 1.3,
    risk: 0.1,
    color: "#efd08c",
    title: "04  JUMBO CATCH",
    hint: "大きく重い人形をゆっくり持ち上げよう",
  },
  {
    offset: -20,
    name: "⑤ つるつる台",
    real: false,
    arms: 3,
    type: "slippery",
    speed: 1,
    size: 1,
    risk: 0.25,
    color: "#c5b1ee",
    title: "05  SLIPPERY UFO",
    hint: "アームが弱め！ 真ん中を狙う高難度の台",
  },
  {
    offset: 20,
    name: "⑥ 動く床の台",
    real: false,
    arms: 3,
    type: "moving",
    speed: 1,
    size: 0.9,
    risk: 0.04,
    color: "#bce08b",
    title: "06  MOVING BED",
    hint: "床が左右に動く！ 動きを読んでつかもう",
  },
];
function createMachine(index, extra = {}) {
  const cfg = { ...configs[index], ...extra };
  const m = {
    ...cfg,
    index,
    real: cfg.real,
    armCount: cfg.arms,
    claw: { x: 175, y: 415, z: 0, open: 1 },
    prizes: [],
    particles: [],
    state: "idle",
    phase: 0,
    clock: 0,
    target: null,
    quality: 0,
    fallen: null,
    delivery: null,
    slipPlan: null,
    gripOffset: { x: 0, y: 0 },
    gripTilt: 0,
    swing: { x: 0, z: 0, vx: 0, vz: 0 },
    held: new Set(),
    velocity: { x: 0, y: 0 },
    step: 0,
    timeLeft: 30,
    start: {},
    result: "",
  };
  m.restock = () => {
    if (m.state !== "idle") return false;
    m.prizes = [];
    for (let i = 0; i < (m.type === "mini" ? 16 : m.type === "giant" ? 8 : 12); i++)
      m.prizes.push({
        x: 203 + (i % 4) * 103 + (Math.random() - 0.5) * 10,
        y:
          (m.type === "mini" ? 250 : 260) +
          Math.floor(i / 4) * (m.type === "mini" ? 49 : m.type === "giant" ? 115 : 66) +
          (Math.random() - 0.5) * 8,
        kind: (index * 10 + i) % kinds.length,
        rot: (Math.random() - 0.5) * 1.5,
        tilt: 0,
        size: (0.86 + Math.random() * 0.15) * m.size,
        vx: 0,
        vy: 0,
        leanV: 0,
      });
    return true;
  };
  m.begin = () => {
    if (m.state !== "idle") return;
    m.held.clear();
    tries++;
    updateUI();
    m.phase = 0;
    m.target = null;
    m.fallen = null;
    m.delivery = null;
    m.slipPlan = null;
    m.result = "";
    m.velocity = { x: 0, y: 0 };
    m.claw.open = 1;
    m.swing = { x: 0, z: 0, vx: 0, vz: 0 };
    if (m.real) {
      m.claw.x = 175;
      m.claw.y = 415;
      m.claw.z = 0;
      m.state = "aim";
      m.step = 1;
      m.timeLeft = 30;
      msg(m.name + "：①を長押しして横移動。離したら②へ！");
    } else m.lower();
    tone(600);
  };
  m.lower = () => {
    m.held.clear();
    m.velocity = { x: 0, y: 0 };
    m.state = "lower";
    m.phase = 0;
    m.target = null;
    let best = Infinity;
    for (const p of m.prizes) {
      let d = Math.hypot(p.x - m.claw.x, (p.y - m.claw.y) * 1.1);
      if (d < best) {
        best = d;
        m.target = p;
      }
    }
    let radius = ($("#difficulty").value === "easy" ? 35 : 29) * (m.target?.size || 1);
    if (best > radius) m.target = null;
    else m.quality = clamp(1 - best / radius, 0, 1);
    m.slipPlan = null;
    msg(m.name + "：アーム下降中…");
  };
  m.release = (axis) => {
    m.held.delete(axis === 1 ? "right" : "up");
    m.velocity = { x: 0, y: 0 };
    if (m.state !== "aim" || m.step !== axis) return;
    if (axis === 1) {
      m.step = 2;
      msg(m.name + "：②を長押しして奥へ。離すとつかむよ！");
      tone(500);
    } else {
      m.step = 3;
      m.lower();
    }
  };
  m.attach = () => {
    const p = m.target;
    if (!p) return;
    const reach = ($("#difficulty").value === "easy" ? 35 : 29) * (p.size || 1);
    if (Math.hypot(p.x - m.claw.x, (p.y - m.claw.y) * 1.1) > reach) {
      m.target = null;
      return;
    }
    /* Preserve the actual contact transform: never pull the prize to the claw center. */ m.gripOffset =
      { x: p.x - m.claw.x, y: p.y - m.claw.y };
    m.gripTilt = p.tilt || 0;
    m.gripZ = m.claw.z;
    m.swing = { x: 0, z: 0, vx: 0, vz: 0 };
    m.prizes.splice(m.prizes.indexOf(p), 1);
    let radius = ($("#difficulty").value === "easy" ? 35 : 29) * (p.size || 1);
    m.quality = clamp(1 - Math.hypot(m.gripOffset.x, m.gripOffset.y * 1.1) / radius, 0, 1);
    const risk = clamp(
      ($("#difficulty").value === "easy" ? 0.12 : 0.19) +
        (m.real ? 0.8 : 0.69) * Math.pow(1 - m.quality, 1.2) +
        m.risk,
      0.04,
      0.97,
    );
    if (Math.random() < risk)
      m.slipPlan = {
        stage: m.quality < 0.32 ? "lift" : Math.random() < 0.4 ? "lift" : "carry",
        at: 0.5 + Math.random() * 0.5,
      };
  };
  m.heldPose = () => {
    const c = m.claw,
      sw = m.swing;
    return {
      x: c.x + m.gripOffset.x + sw.x * 40,
      y: c.y + m.gripOffset.y + sw.z * 40,
      height: 0.1 + ((m.gripZ ?? 1) - c.z) * 2.4,
      rot: m.target?.rot || 0,
      tilt: m.gripTilt + sw.x,
    };
  };
  m.slip = () => {
    const pose = m.heldPose();
    m.fallen = {
      prize: m.target,
      ...pose,
      vy: 0,
      vx: m.swing.vx * 15,
      vz: m.swing.vz * 15,
      age: 0,
      bounces: 0,
    };
    m.target = null;
    m.slipPlan = null;
    m.state = "slip";
    m.phase = 0;
    m.claw.open = 0.48;
    msg(m.name + "：あっ、すべり落ちた！");
    tone(160, 0.25);
  };
  m.returnHome = (text) => {
    m.result = text || m.result;
    m.target = null;
    m.delivery = null;
    m.state = "return";
    m.phase = 0;
    m.start = { ...m.claw };
    m.claw.open = 1;
  };
  m.advance = (dt) => {
    m.clock += dt;
    const c = m.claw;
    if (m.type === "moving" && ["idle", "aim"].includes(m.state)) {
      const shift = Math.cos(m.clock * 0.9) * 16 * dt;
      for (const p of m.prizes) p.x = clamp(p.x + shift, 175, 575);
    }
    let oldX = c.x,
      oldY = c.y;
    for (const p of m.prizes) {
      p.x = clamp(p.x + (p.vx || 0) * dt, 175, 575);
      p.y = clamp(p.y + (p.vy || 0) * dt, 245, 415);
      p.vx = (p.vx || 0) * Math.exp(-6 * dt);
      p.vy = (p.vy || 0) * Math.exp(-6 * dt);
      p.leanV = ((p.leanV || 0) - (p.tilt || 0) * 14 * dt) * Math.exp(-5 * dt);
      p.tilt = (p.tilt || 0) + p.leanV * dt;
    }
    for (let i = 0; i < m.prizes.length; i++)
      for (let j = i + 1; j < m.prizes.length; j++) {
        let a = m.prizes[i],
          b = m.prizes[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy),
          r = (36 * ((a.size || 1) + (b.size || 1))) / 2;
        if (d < r && d > 0.01) {
          let push = (r - d) * 0.5;
          for (const [p, sign] of [
            [a, -1],
            [b, 1],
          ]) {
            p.x = clamp(p.x + ((sign * dx) / d) * push, 175, 575);
            p.y = clamp(p.y + ((sign * dy) / d) * push, 245, 415);
          }
        }
      }
    if (m.state === "idle" || m.state === "aim") {
      if (m.state === "aim") {
        m.timeLeft = Math.max(0, m.timeLeft - dt);
        if (m.timeLeft <= 0) {
          m.lower();
          return;
        }
      }
      let tx = ((m.held.has("right") ? 1 : 0) - (m.held.has("left") ? 1 : 0)) * 115,
        ty = ((m.held.has("down") ? 1 : 0) - (m.held.has("up") ? 1 : 0)) * 84;
      if (m.real && m.state === "idle") {
        tx = 0;
        ty = 0;
      }
      m.velocity.x += (tx - m.velocity.x) * Math.min(1, dt * 11);
      m.velocity.y += (ty - m.velocity.y) * Math.min(1, dt * 11);
      c.x = clamp(c.x + m.velocity.x * dt, 175, 575);
      c.y = clamp(c.y + m.velocity.y * dt, 245, 415);
    } else {
      m.phase += dt * m.speed;
      if (m.state === "lower") {
        c.z = ease(m.phase / 1.55);
        if (m.phase >= 1.55) {
          m.state = "close";
          m.phase = 0;
          for (const p of m.prizes) {
            if (p === m.target) continue;
            let dx = p.x - c.x,
              dy = p.y - c.y,
              d = Math.hypot(dx, dy);
            if (d < 57 && d > 1) {
              p.vx += (dx / d) * 28;
              p.vy += (dy / d) * 24;
              p.leanV += (dx / d) * 0.8;
            }
          }
          tone(230, 0.15);
        }
      } else if (m.state === "close") {
        c.open = 1 - ease(m.phase / 0.9) * 0.78;
        if (m.phase >= 0.9) {
          m.attach();
          m.phase = 0;
          m.state = "lift";
          msg(m.target ? m.name + "：つかんだ！" : m.name + "：空振り！");
        }
      } else if (m.state === "lift") {
        c.z = 1 - ease(m.phase / 1.65);
        if (m.target && m.slipPlan?.stage === "lift" && m.phase >= m.slipPlan.at) {
          m.slip();
          return;
        }
        if (m.phase >= 1.65) {
          m.state = "carry";
          m.phase = 0;
          m.start = { x: c.x, y: c.y };
          if (!m.target) m.returnHome("次は景品の真ん中をねらおう！");
        }
      } else if (m.state === "carry") {
        let e = ease(m.phase / 2.1);
        c.x = m.start.x + (105 - m.start.x) * e;
        c.y = m.start.y + (390 - m.start.y) * e;
        if (m.target && m.slipPlan?.stage === "carry" && m.phase >= m.slipPlan.at) {
          m.slip();
          return;
        }
        if (m.phase >= 2.1) {
          m.state = "drop";
          m.phase = 0;
          m.delivery = { height: m.heldPose().height, vy: 0 };
          msg(m.name + "：取り出し口へ！");
        }
      } else if (m.state === "slip") {
        let f = m.fallen;
        f.age += dt;
        f.vy -= 8.5 * dt;
        f.height += f.vy * dt;
        /* Keep world-space position continuous, including a slip near the chute. */ f.x = clamp(
          f.x + f.vx * dt,
          70,
          575,
        );
        f.y = clamp(f.y + f.vz * dt, 245, 430);
        f.rot += dt * 1.8;
        f.tilt = clamp(f.tilt + dt * 1.3, -0.7, 0.7);
        c.open = Math.min(1, c.open + dt);
        if (f.height <= 0.1) {
          if (f.x < 160 && f.y > 340) {
            m.target = f.prize;
            m.delivery = { height: f.height, vy: f.vy };
            m.fallen = null;
            m.state = "drop";
            m.phase = 0.24;
            return;
          }
          f.height = 0.1;
          if (!f.bounces && Math.abs(f.vy) > 0.55) {
            f.vy = -f.vy * 0.22;
            f.bounces++;
            tone(95, 0.09);
          } else {
            let p = f.prize;
            p.x = clamp(f.x, 175, 575);
            p.y = clamp(f.y, 245, 415);
            p.rot = f.rot;
            p.tilt = f.tilt;
            p.leanV = -0.5;
            m.prizes.push(p);
            m.fallen = null;
            m.returnHome("すべり落ちた！ もう一度ねらおう！");
          }
        }
      } else if (m.state === "drop") {
        c.open = clamp(0.22 + m.phase * 1.8, 0.22, 1);
        if (m.phase > 0.23) {
          m.delivery.vy -= 8.5 * dt;
          m.delivery.height += m.delivery.vy * dt;
        }
        if (m.delivery.height <= -0.7) {
          owned[m.target.kind]++;
          updateUI();
          tone(880, 0.2);
          m.result = "🎉 " + kinds[m.target.kind][1] + " ゲット！";
          m.state = "prize";
          m.phase = 0;
          msg(m.result);
        }
      } else if (m.state === "prize") {
        if (m.phase > 1.1) m.returnHome(m.result);
      } else if (m.state === "return") {
        let e = ease(m.phase / 1.45);
        c.x = m.start.x + (175 - m.start.x) * e;
        c.y = m.start.y + (415 - m.start.y) * e;
        c.z = m.start.z * (1 - e);
        if (m.phase >= 1.45) {
          m.state = "idle";
          m.phase = 0;
          m.target = null;
          c.z = 0;
          c.open = 1;
          m.velocity = { x: 0, y: 0 };
          if (!m.prizes.length) m.restock();
          if (m.result) msg(m.result);
        }
      }
    }
    let ax = (c.x - oldX) / Math.max(dt, 0.001) / 100,
      az = (c.y - oldY) / Math.max(dt, 0.001) / 100;
    const sw = m.swing;
    sw.vx += (-sw.x * 12 - sw.vx * 2.8 - ax * 0.9) * dt;
    sw.vz += (-sw.z * 12 - sw.vz * 2.8 - az * 0.9) * dt;
    sw.x = clamp(sw.x + sw.vx * dt, -0.3, 0.3);
    sw.z = clamp(sw.z + sw.vz * dt, -0.25, 0.25);
  };
  m.restock();
  return m;
}
const machines = configs.map((_, i) => createMachine(i)),
  canvas = $("#game");
let scene;
try {
  scene = window.createClawScene(canvas);
} catch (e) {
  msg(e.message);
  throw e;
}
const sports = window.createArcadeGames(scene, msg, tone);
const fields = window.createPhysicalFields(scene, msg, tone);
const walk = { x: 0, y: 0 },
  keys = new Set(),
  buttons = [];
let modal = false,
  look = null,
  joyId = null,
  last = 0,
  dashing = false;
const cabinets = window.createVideoCabinets(scene, msg, tone);
function stopInputs() {
  fields.clearInputs();
  cabinets.clearInputs();
  sports.stop();
  dashing = false;
  $("#dash").classList.remove("on");
  walk.x = walk.y = 0;
  keys.clear();
  joyId = null;
  $("#knob").style.transform = "";
  for (const m of machines) {
    m.held.clear();
    m.velocity = { x: 0, y: 0 };
  }
  for (const b of buttons) b.el.classList.remove("on");
  look = null;
}
function allowed(m, action) {
  if (action === "start") return m.state === "idle";
  if (m.real)
    return (
      m.state === "aim" && (action === "right" ? m.step === 1 : action === "up" && m.step === 2)
    );
  return m.state === "idle";
}
function makeButton(m, action, label, x, z, cls = "") {
  const b = document.createElement("button");
  b.className = "cabbutton " + cls;
  b.innerHTML = label;
  b.setAttribute("aria-label", m.name + " " + action);
  $("#worldControls").appendChild(b);
  let ptr = null;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!allowed(m, action)) return;
    b.setPointerCapture(e.pointerId);
    ptr = e.pointerId;
    b.classList.add("on");
    if (action === "start") m.begin();
    else m.held.add(action);
  });
  function end(e, cancel = false) {
    if (ptr !== e.pointerId) return;
    ptr = null;
    b.classList.remove("on");
    m.held.delete(action);
    if (!cancel && m.real && ["right", "up"].includes(action))
      m.release(action === "right" ? 1 : 2);
  }
  b.addEventListener("pointerup", (e) => end(e));
  for (const ev of ["pointercancel", "lostpointercapture"])
    b.addEventListener(ev, (e) => end(e, true));
  b.addEventListener("click", (e) => {
    if (e.detail === 0 && allowed(m, action)) {
      if (action === "start") m.begin();
      else if (m.real) m.release(action === "right" ? 1 : 2);
      else {
        m.claw.x = clamp(
          m.claw.x + (action === "right" ? 10 : action === "left" ? -10 : 0),
          175,
          575,
        );
        m.claw.y = clamp(m.claw.y + (action === "down" ? 10 : action === "up" ? -10 : 0), 245, 415);
      }
    }
  });
  buttons.push({ el: b, m, action, point: [m.offset + x, 0.02, z] });
}
function registerMachine(m) {
  if (m.real) {
    makeButton(m, "right", "1<small>横へ</small>", 0.25, 2.05);
    makeButton(m, "up", "2<small>奥へ</small>", 1.2, 2.05, "blue");
    makeButton(m, "start", "START", 2.25, 2.05, "start");
  } else {
    for (const [a, l, x, z] of [
      ["left", "◀", -0.05, 2.05],
      ["right", "▶", 1.15, 2.05],
      ["up", "▲", 0.55, 1.68],
      ["down", "▼", 0.55, 2.42],
    ])
      makeButton(m, a, l, x, z, "blue");
    makeButton(m, "start", "つかむ", 2.15, 2.05, "start");
  }
}
for (const m of machines) registerMachine(m);
// A repeating recipe makes the hall unbounded; only nearby stations stay resident.
const hallRecords = new Map([
  ...machines.map((m) => [Math.round((m.offset + 20) / 8), { kind: "crane", obj: m }]),
  ...sports.games.map((g) => [Math.round((g.offset + 20) / 8), { kind: "arcade", obj: g }]),
  ...fields.games.map((g) => [Math.round((g.offset + 20) / 8), { kind: "field", obj: g }]),
]);
const hallRecipe = [
  4,
  2,
  0,
  1,
  3,
  5,
  "basket",
  "moles",
  "hockey",
  "crystal",
  "timing",
  ...cabinets.catalog.map((d) => d.id),
  ...fields.templates.map((d) => d.id),
];
function ensureHall() {
  const center = Math.round((scene.player.x + 20) / 8),
    radius = 4;
  for (let slot = center - radius; slot <= center + radius; slot++) {
    if (hallRecords.has(slot)) continue;
    const offset = -20 + slot * 8,
      recipe = hallRecipe[((slot % hallRecipe.length) + hallRecipe.length) % hallRecipe.length],
      variant = ((Math.floor(slot / hallRecipe.length) % 3) + 3) % 3;
    let record;
    if (typeof recipe === "number") {
      const cfg = configs[recipe],
        m = createMachine(recipe, {
          offset,
          size: cfg.size * (1 + variant * 0.045),
          risk: cfg.risk + variant * 0.015,
          title: cfg.title + " / " + (slot + 1),
        });
      m.name += " #" + (slot + 1);
      registerMachine(m);
      machines.push(m);
      record = { kind: "crane", obj: m };
    } else if (fields.templates.some((d) => d.id === recipe)) {
      const g = fields.addGame(recipe, offset, slot);
      record = { kind: "field", obj: g };
    } else if (cabinets.catalog.some((d) => d.id === recipe)) {
      const g = cabinets.addGame(recipe, offset, slot);
      record = { kind: "video", obj: g };
    } else {
      const g = sports.addGame(recipe, offset, slot);
      g.name += " #" + (slot + 1);
      record = { kind: "arcade", obj: g };
    }
    try {
      const data = JSON.parse(localStorage.getItem("kochan-station-" + slot) || "null");
      if (data && (!data.stationType || data.stationType === (record.obj.id || record.obj.type))) {
        if (record.kind === "crane" && Array.isArray(data.prizes)) record.obj.prizes = data.prizes;
        else if (record.kind !== "crane") {
          record.obj.score = data.score || 0;
          record.obj.state = data.done ? "done" : "idle";
        }
      }
    } catch {}
    hallRecords.set(slot, record);
  }
  for (const [slot, rec] of hallRecords) {
    if ((slot >= 0 && slot <= 10) || Math.abs(slot - center) <= radius) continue;
    const m = rec.obj;
    if (
      (rec.kind === "crane" && (m.state !== "idle" || m.held.size)) ||
      (rec.kind !== "crane" && m.state === "playing")
    )
      continue;
    try {
      localStorage.setItem(
        "kochan-station-" + slot,
        JSON.stringify(
          rec.kind === "crane"
            ? { prizes: m.prizes, stationType: m.type }
            : { score: m.score, done: m.state === "done", stationType: m.id || m.type },
        ),
      );
    } catch {}
    if (rec.kind === "crane") {
      for (let i = buttons.length - 1; i >= 0; i--)
        if (buttons[i].m === m) {
          buttons[i].el.remove();
          buttons.splice(i, 1);
        }
      const i = machines.indexOf(m);
      if (i >= 0) machines.splice(i, 1);
    } else if (rec.kind === "field") fields.dropGame(m);
    else if (rec.kind === "video") cabinets.dropGame(m);
    else sports.dropGame(m);
    hallRecords.delete(slot);
  }
  const total = sports.totals();
  $("#loading").textContent =
    "全37種類 · ENDLESS · エリア " +
    (Math.floor(center / hallRecipe.length) + 1) +
    " · 💎" +
    total.gems +
    " / 🎁" +
    total.treasure;
}
const dash = $("#dash");
dash.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  dash.setPointerCapture(e.pointerId);
  dashing = true;
  dash.classList.add("on");
});
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
  dash.addEventListener(ev, () => {
    dashing = false;
    dash.classList.remove("on");
  });
canvas.addEventListener("pointerdown", (e) => {
  if (modal || look) return;
  if (fields.pointerDown(e) || cabinets.pointerDown(e) || sports.pointerDown(e)) {
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (fields.pointerMove(e) || cabinets.pointerMove(e) || sports.pointerMove(e)) return;
  if (!look || look.id !== e.pointerId) return;
  scene.look((e.clientX - look.x) * 0.0045, -(e.clientY - look.y) * 0.004);
  look.x = e.clientX;
  look.y = e.clientY;
});
for (const k of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(k, (e) => {
    fields.pointerUp(e);
    cabinets.pointerUp(e);
    sports.pointerUp(e);
    if (look?.id === e.pointerId) look = null;
  });
const joy = $("#joystick");
function moveJoy(e) {
  let r = joy.getBoundingClientRect(),
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2,
    range = r.width * 0.32,
    len = Math.hypot(dx, dy),
    scale = Math.min(1, range / (len || 1));
  dx *= scale;
  dy *= scale;
  walk.x = dx / range;
  walk.y = -dy / range;
  $("#knob").style.transform = `translate(${dx}px,${dy}px)`;
}
joy.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (joyId !== null) return;
  joyId = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  moveJoy(e);
});
joy.addEventListener("pointermove", (e) => {
  if (joyId === e.pointerId) moveJoy(e);
});
for (const k of ["pointerup", "pointercancel", "lostpointercapture"])
  joy.addEventListener(k, (e) => {
    if (joyId === e.pointerId) {
      joyId = null;
      walk.x = walk.y = 0;
      $("#knob").style.transform = "";
    }
  });
window.addEventListener("keydown", (e) => {
  if (modal || fields.handlesKeys(e) || cabinets.handlesKeys(e)) return;
  if (e.target.matches("select,input,button")) return;
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "KeyE",
      "Space",
    ].includes(e.code)
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  const m = nearest();
  if (e.code === "KeyE" && m && scene.distance(m.offset) < 8) m.begin();
  if (e.code.startsWith("Arrow") && m) {
    const action = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[
      e.code
    ];
    if (allowed(m, action)) m.held.add(action);
  }
});
window.addEventListener("keyup", (e) => {
  if (modal || fields.handlesKeys(e) || cabinets.handlesKeys(e)) return;
  keys.delete(e.code);
  for (const m of machines) {
    let a = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.code];
    if (m.held.has(a)) {
      m.held.delete(a);
      if (m.real) m.release(a === "right" ? 1 : 2);
    }
  }
});
window.addEventListener("blur", stopInputs);
document.addEventListener("visibilitychange", stopInputs);
function nearest() {
  return machines.reduce((a, b) => (scene.distance(a.offset) < scene.distance(b.offset) ? a : b));
}
const catalogList = $("#catalogList");
function catalogEntry(name, hint, offset) {
  const b = document.createElement("button");
  b.innerHTML = name + "<small>" + hint + "</small>";
  b.onclick = () => {
    stopInputs();
    scene.player.x = offset;
    scene.player.z = 6;
    scene.player.yaw = 0;
    scene.player.pitch = -0.3;
    $("#catalogModal").hidden = true;
    modal = false;
    ensureHall();
    msg(name + "の前へ移動したよ。台のボタンで遊ぼう！");
  };
  catalogList.appendChild(b);
}
for (const cfg of configs) catalogEntry("🧸 " + cfg.name, cfg.hint, cfg.offset);
for (const d of sports.templates) catalogEntry(d.name, d.hint, d.offset);
for (let i = 0; i < cabinets.catalog.length; i++) {
  const d = cabinets.catalog[i];
  catalogEntry(d.icon + " " + d.name, d.hint, 68 + i * 8);
}
for (const d of fields.templates) catalogEntry("⚽ " + d.name, d.hint, d.offset);
$("#catalogOpen").onclick = () => openModal("catalogModal");
function openModal(id) {
  stopInputs();
  modal = true;
  $("#" + id).hidden = false;
}
$("#collectionOpen").onclick = () => openModal("collectionModal");
$("#helpOpen").onclick = () => openModal("helpModal");
document.querySelectorAll("[data-close]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#" + b.dataset.close).hidden = true;
      modal = false;
    }),
);
$("#sound").onclick = () => {
  soundOn = !soundOn;
  $("#sound").textContent = "音 " + (soundOn ? "ON" : "OFF");
  $("#sound").setAttribute("aria-pressed", String(soundOn));
  tone(660);
};
$("#restock").onclick = () => {
  let m = nearest();
  if (scene.distance(m.offset) > 8) {
    msg("クレーンの近くで補充ボタンを押してね");
    return;
  }
  msg(m.restock() ? m.name + "の景品を補充したよ！" : "プレイが終わってから補充してね");
};
$("#entrance").onclick = () => {
  scene.reset();
  stopInputs();
  $("#helpModal").hidden = true;
  modal = false;
};
function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.035);
  last = t;
  if (!modal) {
    let x = walk.x + (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      z = walk.y + (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    scene.walk(x, z, dt, dashing || keys.has("ShiftLeft") || keys.has("ShiftRight"));
    ensureHall();
    for (const m of machines) m.advance(dt);
    sports.advance(dt);
    fields.advance(dt);
  }
  cabinets.update(dt, modal);
  scene.draw({
    machines,
    arcades: sports.games,
    videos: cabinets.games,
    fields: fields.games,
    aimHelp: $("#guide").checked,
  });
  sports.updateControls(!modal);
  cabinets.updateControls(!modal);
  fields.updateControls(!modal);
  for (const b of buttons) {
    const p = scene.project(b.point),
      show =
        !modal &&
        p &&
        scene.distance(b.m.offset) < 8 &&
        scene.player.z > 2.8 &&
        Math.abs(scene.player.x - b.m.offset) < 5;
    b.el.hidden = !show;
    if (show) {
      b.el.style.left = p.x + "px";
      b.el.style.top = p.y + "px";
      b.el.disabled = !allowed(b.m, b.action);
    }
  }
  const m = nearest(),
    d = scene.distance(m.offset);
  $("#near").textContent =
    d < 8
      ? m.name +
        (m.state === "aim"
          ? " · 残り" + Math.ceil(m.timeLeft) + "秒"
          : m.state === "idle"
            ? " · " + m.hint
            : " · プレイ中")
      : "スティックで台の近くへ";
  const other = sports.games.reduce((a, b) =>
    scene.distance(a.offset) < scene.distance(b.offset) ? a : b,
  );
  if (scene.distance(other.offset) < Math.min(d, 7.5))
    $("#near").textContent = sports.status(other);
  if (cabinets.games.length) {
    const v = cabinets.games.reduce((a, b) =>
      scene.distance(a.offset) < scene.distance(b.offset) ? a : b,
    );
    if (scene.distance(v.offset) < Math.min(d, scene.distance(other.offset), 7.5))
      $("#near").textContent = cabinets.status(v);
  }
  if (fields.games.length) {
    const f = fields.games.reduce((a, b) =>
      scene.distance(a.offset) < scene.distance(b.offset) ? a : b,
    );
    if (
      scene.distance(f.offset) <
      Math.min(
        d,
        scene.distance(other.offset),
        ...cabinets.games.map((v) => scene.distance(v.offset)),
        7.5,
      )
    )
      $("#near").textContent = fields.status(f);
  }
  requestAnimationFrame(frame);
}
updateUI();
requestAnimationFrame(frame);
