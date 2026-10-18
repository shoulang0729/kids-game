/* Five arcade games with independent clocks and world-space interactions. */
window.createArcadeGames = function (scene, msg, tone) {
  const $ = (s) => document.querySelector(s),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let dragging = null;
  const templates = [
    {
      type: "basket",
      offset: 28,
      name: "バスケットシュート",
      hint: "ボールに触れて開始。奥へスワイプして離すとシュート！",
      duration: 40,
    },
    {
      type: "moles",
      offset: 36,
      name: "モグラたたき",
      hint: "出てきたモグラをタップ！",
      duration: 30,
    },
    {
      type: "hockey",
      offset: 44,
      name: "エアホッケー",
      hint: "台の手前を触って開始。青いマレットを直接ドラッグ！",
      duration: 60,
    },
    {
      type: "crystal",
      offset: 52,
      name: "宝石すくい",
      hint: "手前に宝石が来たら「すくう」！ 5個でお宝",
      duration: 45,
    },
    {
      type: "timing",
      offset: 60,
      name: "ストップライト",
      hint: "光がいちばん上の星に来たら STOP！ 10回勝負",
      duration: 60,
    },
  ];
  const games = [];
  let totalGems = 0,
    totalTreasure = 0;
  try {
    const saved = JSON.parse(localStorage.getItem("kochan-gems-v1") || "{}");
    totalGems = Number(saved.gems) || 0;
    totalTreasure = Number(saved.treasure) || 0;
  } catch {}
  function addGame(type, offset, slot = null) {
    const t = templates.find((t) => t.type === type);
    if (!t) throw Error("Unknown arcade type");
    const g = {
      ...t,
      offset: offset ?? t.offset,
      slot,
      state: "idle",
      time: 0,
      clock: 0,
      score: 0,
      cpu: 0,
      charge: 0,
      charging: false,
      ball: null,
      holes: Array.from({ length: 9 }, () => ({ up: 0, hit: 0 })),
      spawn: 0,
      paddle: { x: 0, z: 1.15, tx: 0, tz: 1.15, vx: 0, vz: 0 },
      ai: { x: 0, z: -1.35 },
      puck: { x: 0, z: 0, vx: 1, vz: 1.8 },
      pause: 0,
      gems: Array.from({ length: 18 }, (_, i) => ({
        angle: (i * Math.PI) / 9,
        cooldown: 0,
        color: ["#8ee4d2", "#a1bcfa", "#e6abd6", "#e8cd8a"][i % 4],
      })),
      scoopTimer: 0,
      cargo: [],
      prizesWon: 0,
      lightAngle: 0,
      lightIndex: 0,
      attempts: 0,
      lock: 0,
    };
    games.push(g);
    setupControls(g);
    return g;
  }
  function dropGame(g) {
    if (dragging?.g === g) dragging = null;
    for (let i = controls.length - 1; i >= 0; i--)
      if (controls[i].g === g) {
        controls[i].el.remove();
        controls.splice(i, 1);
      }
    const i = games.indexOf(g);
    if (i >= 0) games.splice(i, 1);
  }
  function start(g) {
    if (g.state === "playing") return;
    g.state = "playing";
    g.time = g.duration;
    g.score = 0;
    g.cpu = 0;
    g.scoopTimer = 0;
    g.cargo = [];
    g.prizesWon = 0;
    g.gems.forEach((c) => (c.cooldown = 0));
    g.lightAngle = Math.random() * 24;
    g.lightIndex = Math.floor(g.lightAngle);
    g.attempts = 0;
    g.lock = 0;
    g.ball = null;
    g.charging = false;
    g.charge = 0;
    g.spawn = 0.2;
    g.holes.forEach((h) => {
      h.up = 0;
      h.hit = 0;
    });
    g.paddle = { x: 0, z: 1.15, tx: 0, tz: 1.15, vx: 0, vz: 0 };
    g.ai = { x: 0, z: -1.35 };
    g.puck = { x: 0, z: 0, vx: 0.8, vz: 1.9 };
    g.pause = 0.6;
    msg(g.name + "：" + g.hint);
    tone(660);
  }
  function finish(g) {
    g.state = "done";
    g.charging = false;
    g.ball = null;
    if (dragging?.g === g) dragging = null;
    const text =
      g.type === "crystal"
        ? "宝石" + g.score + "個、お宝" + g.prizesWon + "個！"
        : g.type === "hockey"
          ? g.score > g.cpu
            ? "勝ち！"
            : g.score < g.cpu
              ? "CPUの勝ち！"
              : "引き分け！"
          : g.score + "点！";
    msg(
      g.name +
        "終了：" +
        text +
        (g.type === "basket" || g.type === "hockey"
          ? " もう一度触ると再プレイ！"
          : " STARTでもう一度！"),
    );
    tone(440, 0.3);
  }
  function shoot(g) {
    if (g.state !== "playing" || !g.charging || g.ball) return;
    g.charging = false;
    g.ball = {
      x: 0,
      y: 0.6,
      z: 1.2,
      vx: 0,
      vy: 5.67 + g.charge * 2,
      vz: -2,
      age: 0,
      scored: false,
    };
    tone(280);
  }
  function whack(g, i) {
    const h = g.holes[i];
    if (g.state !== "playing" || h.up <= 0 || h.hit > 0) return;
    h.up = 0;
    h.hit = 0.3;
    g.score++;
    tone(520 + (g.score % 5) * 70, 0.08);
  }
  const controls = [];
  function button(g, label, point, action, enabled, cls = "") {
    const el = document.createElement("button");
    el.className = "cabbutton " + cls;
    el.innerHTML = label;
    el.setAttribute("aria-label", g.name + " " + label.replace(/<[^>]*>/g, ""));
    $("#worldControls").appendChild(el);
    let ptr = null;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabled()) return;
      el.setPointerCapture(e.pointerId);
      ptr = e.pointerId;
      el.classList.add("on");
      action("down");
    });
    function end(e, cancel) {
      if (ptr !== e.pointerId) return;
      ptr = null;
      el.classList.remove("on");
      action(cancel ? "cancel" : "up");
    }
    el.addEventListener("pointerup", (e) => end(e, false));
    for (const ev of ["pointercancel", "lostpointercapture"])
      el.addEventListener(ev, (e) => end(e, true));
    el.addEventListener("click", (e) => {
      if (e.detail === 0 && enabled()) {
        action("down");
        action("up");
      }
    });
    controls.push({ g, el, point, enabled });
  }
  function setupControls(g) {
    if (g.type !== "basket" && g.type !== "hockey")
      button(
        g,
        "START",
        [g.offset + 0.8, 0.37, 2.05],
        (phase) => {
          if (phase === "down") start(g);
        },
        () => g.state !== "playing",
        "start",
      );
    if (g.type === "crystal")
      button(
        g,
        "すくう",
        [g.offset - 0.8, 0.37, 2.05],
        (phase) => {
          if (phase === "down") scoop(g);
        },
        () => g.state === "playing" && g.scoopTimer <= 0,
        "start",
      );
    if (g.type === "timing")
      button(
        g,
        "STOP",
        [g.offset - 0.8, 0.37, 2.05],
        (phase) => {
          if (phase === "down") stopLight(g);
        },
        () => g.state === "playing" && g.lock <= 0,
        "start",
      );
    if (g.type === "moles")
      for (let i = 0; i < 9; i++)
        button(
          g,
          "●",
          [g.offset + ((i % 3) - 1) * 0.95, 0.88, (Math.floor(i / 3) - 1) * 0.8],
          (phase) => {
            if (phase === "down") whack(g, i);
          },
          () => g.state === "playing" && g.holes[i].up > 0,
          "mole-hit",
        );
  }
  for (const t of templates) addGame(t.type, t.offset);
  function scoop(g) {
    if (g.state !== "playing" || g.scoopTimer > 0) return;
    g.scoopTimer = 0.9;
    g.cargo = [];
    for (const c of g.gems) {
      if (c.cooldown > 0) continue;
      const angle = c.angle + g.clock * 0.75,
        x = Math.cos(angle) * 0.95,
        z = Math.sin(angle) * 0.95;
      if (z > 0.7 && Math.abs(x) < 0.5) {
        c.cooldown = 3.5;
        g.cargo.push(c.color);
      }
    }
    tone(300, 0.09);
    if (!g.cargo.length) msg("空振り！ 手前に宝石が来るのを待とう");
  }
  function stopLight(g) {
    if (g.state !== "playing" || g.lock > 0) return;
    const i = g.lightIndex,
      d = Math.min(i, 24 - i);
    g.attempts++;
    g.lock = 0.9;
    if (d === 0) {
      g.score += 10;
      msg("🌟 JACKPOT！ ＋10点");
      tone(1000, 0.25);
    } else if (d === 1) {
      g.score += 3;
      msg("おしい！ ＋3点");
      tone(650, 0.12);
    } else {
      msg("ずれちゃった！ 次の光をねらおう");
      tone(180, 0.12);
    }
  }
  function advance(dt) {
    for (const g of games) {
      g.clock += dt;
      if (g.state !== "playing") continue;
      g.time = Math.max(0, g.time - dt);
      if (g.time <= 0) {
        finish(g);
        continue;
      }
      if (g.type === "crystal") {
        for (const c of g.gems) c.cooldown = Math.max(0, c.cooldown - dt);
        if (g.scoopTimer > 0) {
          g.scoopTimer = Math.max(0, g.scoopTimer - dt);
          if (g.scoopTimer === 0 && g.cargo.length) {
            const count = g.cargo.length,
              old = Math.floor(g.score / 5);
            g.score += count;
            totalGems += count;
            const won = Math.floor(g.score / 5) - old;
            g.prizesWon += won;
            totalTreasure += won;
            try {
              localStorage.setItem(
                "kochan-gems-v1",
                JSON.stringify({ gems: totalGems, treasure: totalTreasure }),
              );
            } catch {}
            msg(
              won
                ? "🎁 宝石5個でお宝ゲット！"
                : "💎 宝石を" + count + "個ゲット！ あと" + (5 - (g.score % 5)) + "個でお宝",
            );
            tone(won ? 900 : 700, 0.2);
            g.cargo = [];
          }
        }
      } else if (g.type === "timing") {
        if (g.lock > 0) {
          g.lock = Math.max(0, g.lock - dt);
          if (g.lock === 0 && g.attempts >= 10) {
            finish(g);
            continue;
          }
        } else {
          g.lightAngle = (g.lightAngle + dt * (7 + g.attempts * 0.4)) % 24;
          g.lightIndex = Math.floor(g.lightAngle);
        }
      } else if (g.type === "basket") {
        if (g.charging && dragging?.g !== g) {
          g.chargeAge += dt;
          g.charge = (1 - Math.cos(g.chargeAge * 3.5)) / 2;
        }
        if (g.ball) {
          const b = g.ball,
            oldY = b.y;
          b.age += dt;
          b.vy -= 9.8 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          if (!b.scored && b.vy < 0 && oldY >= 2.2 && b.y <= 2.2) {
            const t = (oldY - 2.2) / Math.max(0.00001, oldY - b.y),
              crossZ = b.z - b.vz * dt * (1 - t);
            if (Math.hypot(b.x, crossZ + 0.9) < 0.32) {
              b.scored = true;
              g.score += 2;
              msg("ナイスシュート！ " + g.score + "点");
              tone(880, 0.2);
            } else if (Math.abs(crossZ + 0.9) < 0.62) {
              b.vy = Math.abs(b.vy) * 0.4;
              b.vz = -b.vz * 0.3;
              tone(170, 0.06);
            }
          }
          if (b.z < -1.45 && b.y > 1.5) {
            b.z = -1.45;
            b.vz = Math.abs(b.vz) * 0.65;
            tone(150, 0.06);
          }
          if (b.y < -0.7 || b.age > 4) g.ball = null;
        }
      } else if (g.type === "moles") {
        for (const h of g.holes) {
          h.up = Math.max(0, h.up - dt);
          h.hit = Math.max(0, h.hit - dt);
        }
        g.spawn -= dt;
        if (g.spawn <= 0) {
          const available = g.holes
            .map((h, i) => (h.up <= 0 && h.hit <= 0 ? i : -1))
            .filter((i) => i >= 0);
          if (available.length) {
            g.holes[available[Math.floor(Math.random() * available.length)]].up =
              0.7 + Math.random() * 0.5;
          }
          g.spawn = Math.max(0.28, 0.65 - (g.duration - g.time) * 0.008);
        }
      } else if (g.type === "hockey") {
        if (g.pause > 0) {
          g.pause -= dt;
          continue;
        }
        const p = g.paddle,
          oldX = p.x,
          oldZ = p.z;
        p.x += (p.tx - p.x) * Math.min(1, dt * 22);
        p.z += (p.tz - p.z) * Math.min(1, dt * 22);
        p.vx = (p.x - oldX) / Math.max(dt, 0.001);
        p.vz = (p.z - oldZ) / Math.max(dt, 0.001);
        const puck = g.puck;
        g.ai.x += clamp(puck.x - g.ai.x, -dt * 1.7, dt * 1.7);
        const steps = 3,
          sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
          puck.x += puck.vx * sdt;
          puck.z += puck.vz * sdt;
          puck.vx *= Math.exp(-0.13 * sdt);
          puck.vz *= Math.exp(-0.13 * sdt);
          if (Math.abs(puck.x) > 1.25) {
            puck.x = clamp(puck.x, -1.25, 1.25);
            puck.vx = -puck.vx * 0.96;
          }
          for (const [mallet, ai] of [
            [p, false],
            [g.ai, true],
          ]) {
            let dx = puck.x - mallet.x,
              dz = puck.z - mallet.z,
              d = Math.hypot(dx, dz);
            if (d < 0.35) {
              let nx = d > 0.0001 ? dx / d : 0,
                nz = d > 0.0001 ? dz / d : ai ? 1 : -1;
              puck.x = mallet.x + nx * 0.355;
              puck.z = mallet.z + nz * 0.355;
              let dot = puck.vx * nx + puck.vz * nz;
              if (dot < 0) {
                puck.vx -= 2 * dot * nx;
                puck.vz -= 2 * dot * nz;
              }
              if (ai) {
                puck.vz = Math.abs(puck.vz) + 1.4;
                puck.vx += p.x > 0 ? -0.65 : 0.65;
              } else {
                puck.vx += clamp(p.vx, -4, 4) * 0.65;
                puck.vz += clamp(p.vz, -4, 4) * 0.65;
                if (puck.vz > -0.7) puck.vz = -1.5;
              }
              puck.vx = clamp(puck.vx, -6, 6);
              puck.vz = clamp(puck.vz, -7, 7);
              tone(350, 0.04);
            }
          }
          if (Math.abs(puck.z) > 1.8) {
            if (Math.abs(puck.x) < 0.57) {
              if (puck.z < 0) g.score++;
              else g.cpu++;
              tone(780, 0.15);
              msg("エアホッケー：自分 " + g.score + " − " + g.cpu + " CPU");
              g.puck = {
                x: 0,
                z: 0,
                vx: (Math.random() - 0.5) * 1.5,
                vz: g.score > g.cpu ? 2 : -2,
              };
              g.pause = 0.75;
              break;
            } else {
              puck.z = clamp(puck.z, -1.8, 1.8);
              puck.vz = -puck.vz * 0.95;
            }
          }
        }
        if (g.score >= 5 || g.cpu >= 5) finish(g);
      }
    }
  }
  function updateControls(show) {
    for (const c of controls) {
      const p = scene.project(c.point),
        inFront = scene.player.z > 2.9 && Math.abs(scene.player.x - c.g.offset) < 4.5,
        visible = show && p && scene.distance(c.g.offset) < 7.5 && inFront;
      const hit = c.el.className.includes("mole-hit");
      c.el.hidden = !visible || (hit && !c.enabled());
      if (visible) {
        c.el.style.left = p.x + "px";
        c.el.style.top = p.y + "px";
        c.el.disabled = !c.enabled();
      }
    }
  }
  function pointerDown(e) {
    if (dragging) return false;
    for (const g of games) {
      if (
        !["basket", "hockey"].includes(g.type) ||
        scene.distance(g.offset) > 7.5 ||
        scene.player.z < 2.9 ||
        Math.abs(scene.player.x - g.offset) > 4.5
      )
        continue;
      const p = scene.planePoint(e.clientX, e.clientY, g.type === "basket" ? 0.6 : 0.33);
      if (!p || Math.abs(p.x - g.offset) > 1.5 || p.z < -0.2 || p.z > 1.9) continue;
      if (g.state !== "playing") start(g);
      if (g.type === "basket") {
        if (g.ball) return true;
        g.charging = true;
        g.charge = 0;
        g.chargeAge = 0;
        dragging = { id: e.pointerId, g, x: e.clientX, y: e.clientY };
        return true;
      }
      dragging = { id: e.pointerId, g };
      pointerMove(e);
      return true;
    }
    return false;
  }
  function pointerMove(e) {
    if (!dragging || dragging.id !== e.pointerId) return false;
    const g = dragging.g;
    if (g.type === "basket") {
      g.charge = clamp(Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) / 220, 0, 1);
      return true;
    }
    const p = scene.planePoint(e.clientX, e.clientY, 0.33);
    if (p) {
      g.paddle.tx = clamp(p.x - g.offset, -1.05, 1.05);
      g.paddle.tz = clamp(p.z, 0.05, 1.38);
    }
    return true;
  }
  function pointerUp(e) {
    if (dragging?.id !== e.pointerId) return;
    const g = dragging.g;
    dragging = null;
    if (g.type === "basket") {
      if (e.type === "pointercancel" || e.type === "lostpointercapture") g.charging = false;
      else shoot(g);
    }
  }
  function stop() {
    dragging = null;
    for (const g of games) g.charging = false;
    for (const c of controls) c.el.classList.remove("on");
  }
  function status(g) {
    return (
      g.name +
      (g.state === "playing"
        ? " · " +
          Math.ceil(g.time) +
          "秒 · " +
          (g.type === "hockey"
            ? g.score + " − " + g.cpu
            : g.type === "crystal"
              ? g.score + "個 / お宝" + g.prizesWon
              : g.type === "timing"
                ? g.score + "点 / " + g.attempts + "回"
                : g.score + "点")
        : " · " + g.hint)
    );
  }
  return {
    games,
    advance,
    updateControls,
    pointerDown,
    pointerMove,
    pointerUp,
    stop,
    status,
    start,
    shoot,
    whack,
    scoop,
    stopLight,
    addGame,
    dropGame,
    templates,
    totals: () => ({ gems: totalGems, treasure: totalTreasure }),
  };
};
