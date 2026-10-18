/* Physical sports areas: the balls, goals and targets live in the 3D hall. */
window.createPhysicalFields = function (scene, msg, tone) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    $ = (s) => document.querySelector(s),
    games = [],
    controls = [],
    drag = new Map();
  let enabled = true;
  const templates = [
    {
      id: "field-golf",
      name: "3Dミニゴルフ",
      offset: 228,
      color: "#81bfa3",
      duration: 150,
      hint: "グリーンを触って開始。そのまま狙う方向へスワイプして離すと打つ。12打で3ホール！",
      keys: [
        ["left", "左へ"],
        ["right", "右へ"],
        ["hit", "長押し→打つ"],
      ],
    },
    {
      id: "field-bowling",
      name: "立体ボウリング",
      offset: 236,
      color: "#d8b987",
      duration: 140,
      hint: "レーンを触って開始。投げる位置から奥へスワイプしてボールを転がそう！",
      keys: [
        ["left", "左へ"],
        ["right", "右へ"],
        ["hit", "長押し→投げる"],
      ],
    },
    {
      id: "field-soccer",
      name: "立体PKサッカー",
      offset: 244,
      color: "#8ebd9c",
      duration: 90,
      hint: "芝生を触って開始。狙うコースへスワイプしてキック！ 5本中3ゴール！",
      keys: [
        ["left", "左へ"],
        ["right", "右へ"],
        ["hit", "長押し→キック"],
      ],
    },
    {
      id: "field-archery",
      name: "3Dアーチェリー",
      offset: 252,
      color: "#c5aaa0",
      duration: 100,
      hint: "的を触って開始。指を動かして狙い、長押しで弓を引いて離す！ 6本で30点。",
      keys: [
        ["left", "左"],
        ["up", "上"],
        ["down", "下"],
        ["right", "右"],
        ["hit", "引く→放つ"],
      ],
    },
    {
      id: "field-rings",
      name: "立体輪投げ",
      offset: 260,
      color: "#c6b2d8",
      duration: 100,
      hint: "床を触って開始。狙う棒の方向へスワイプ。長く動かすほど遠くへ投げる！",
      keys: [
        ["left", "左へ"],
        ["right", "右へ"],
        ["hit", "長押し→投げる"],
      ],
    },
    {
      id: "field-batting",
      name: "立体バッティング",
      offset: 268,
      color: "#a7c1d2",
      duration: 75,
      hint: "ケージを触って開始。球が手前の白い線に来たらバットをタップ／スワイプ！",
      keys: [["hit", "スイング"]],
    },
  ];
  const floor = -0.91;
  function resetBall(g, x = 0, z = 1.3) {
    g.ball = { x, y: floor + 0.1, z, vx: 0, vy: 0, vz: 0 };
    g.moving = false;
    g.charging = false;
    g.delay = 0;
    g.shotAge = 0;
  }
  function golfCourse(g) {
    g.hole = { x: [0, 0.75, -0.75][g.course % 3], z: [-1.3, -1.2, -1.15][g.course % 3] };
    g.obstacles =
      g.course === 1
        ? [{ x: 0, z: -0.05, w: 0.28, d: 0.35 }]
        : g.course === 2
          ? [{ x: 0.42, z: -0.1, w: 0.3, d: 0.32 }]
          : [];
    resetBall(g);
    g.aimX = g.hole.x / 2.5;
  }
  function pins() {
    const arr = [];
    for (let row = 0; row < 4; row++)
      for (let i = 0; i <= row; i++)
        arr.push({ x: (i - row / 2) * 0.23, z: -0.85 - row * 0.23, down: false, tilt: 0, dir: 0 });
    return arr;
  }
  function start(g) {
    if (g.state === "playing") return;
    g.state = "playing";
    g.score = 0;
    g.round = 0;
    g.time = g.duration;
    g.shots = 0;
    g.course = 0;
    g.frameNumber = 0;
    g.roll = 0;
    g.aimX = 0;
    g.aimY = 0.65;
    g.power = 0;
    g.chargeAge = 0;
    g.held.clear();
    g.pins = pins();
    g.hitAge = 0;
    g.arrow = null;
    g.pitch = -0.5;
    g.swung = false;
    g.result = "";
    g.sunk = false;
    g.swingAge = 0;
    resetBall(g);
    if (g.id === "field-golf") golfCourse(g);
    if (g.id === "field-batting") g.ball.z = -1.7;
    msg(g.name + "：" + g.hint);
    tone(650, 0.12);
  }
  function finish(g, win, text) {
    g.state = "done";
    g.win = win;
    g.result = text;
    g.charging = false;
    g.moving = false;
    g.held.clear();
    msg(g.name + "：" + text + " コースを触るともう一度！");
    tone(win ? 900 : 300, 0.2);
  }
  function addGame(id, offset, slot = null) {
    const t = templates.find((t) => t.id === id);
    if (!t) throw Error("Unknown physical sport");
    const g = {
      ...t,
      offset: offset ?? t.offset,
      slot,
      type: "field",
      state: "idle",
      score: 0,
      clock: 0,
      time: t.duration,
      held: new Set(),
      aimX: 0,
      aimY: 0.65,
      power: 0,
      round: 0,
      course: 0,
      shots: 0,
      frameNumber: 0,
      roll: 0,
      pins: pins(),
      hitAge: 0,
      arrow: null,
      pitch: -0.5,
      swung: false,
      swingAge: 0,
      targetX: 0,
      obstacles: [],
      hole: { x: 0, z: -1.3 },
      result: "",
    };
    resetBall(g);
    games.push(g);
    return g;
  }
  function can(g, key) {
    return (
      enabled &&
      (key === "start"
        ? g.state !== "playing"
        : g.state === "playing" && ((!g.moving && g.delay <= 0) || key !== "hit"))
    );
  }
  function keyInput(g, key, down) {
    if (g.state !== "playing") return;
    if (down) g.held.add(key);
    else g.held.delete(key);
    if (key !== "hit") return;
    if (g.id === "field-batting") {
      if (down) swing(g);
      return;
    }
    if (g.moving || g.delay > 0) return;
    if (down) {
      g.charging = true;
      g.chargeAge = 0;
      g.power = 0;
    } else if (g.charging) {
      g.charging = false;
      shoot(g);
    }
  }
  function shoot(g) {
    if (g.state !== "playing" || g.moving || g.delay > 0) return;
    const b = g.ball,
      p = g.power;
    g.shots++;
    g.moving = true;
    g.shotAge = 0;
    g.swingAge = 0.35;
    g.delay = 0;
    tone(280, 0.07);
    if (g.id === "field-golf") {
      const len = Math.hypot(g.aimX, 1),
        v = 1 + p * 2.4;
      b.vx = (g.aimX / len) * v;
      b.vz = -v / len;
    }
    if (g.id === "field-bowling") {
      b.x = g.aimX * 0.82;
      b.vx = 0;
      b.vz = -(2.2 + p * 2.0);
    }
    if (g.id === "field-soccer") {
      b.x = 0;
      b.z = 1.3;
      b.y = floor + 0.1;
      b.vx = (g.aimX * (2.4 + p * 1.4)) / 2.9;
      b.vz = -(2.4 + p * 1.4);
      b.vy = 1.25 + p * 1.4;
      g.resolved = false;
    }
    if (g.id === "field-archery") {
      const t = 0.68 - p * 0.22,
        vy = (g.aimY - 0.6 + 1.6 * t * t) / t;
      g.arrow = {
        x: 0,
        y: 0.6,
        z: 1.35,
        vx: g.aimX / t,
        vy,
        vz: -2.92 / t,
        px: 0,
        py: 0.6,
        pz: 1.55,
      };
      g.resolved = false;
    }
    if (g.id === "field-rings") {
      const t = 0.95,
        tx = g.aimX,
        tz = 1.3 - (1.5 + p * 1.6);
      b.x = 0;
      b.y = floor + 0.65;
      b.z = 1.3;
      b.vx = tx / t;
      b.vz = (tz - b.z) / t;
      b.vy = (-0.625 + 2 * t * t) / t;
      g.resolved = false;
    }
  }
  function swing(g) {
    if (g.state !== "playing" || g.swung) return;
    g.swung = true;
    g.swingAge = 0.3;
    const error = Math.abs(g.pitch - 1);
    if (g.pitch > 0 && error < 0.13) {
      const points = error < 0.055 ? 10 : 5;
      g.score += points;
      g.ball.vx = 0.6;
      g.ball.vy = 3.3;
      g.ball.vz = -4.1;
      g.moving = true;
      g.delay = 1.3;
      msg(points === 10 ? "⚾ ホームラン！" : "⚾ ヒット！");
      tone(820, 0.1);
    } else {
      g.delay = 0.8;
      msg("空振り！ 次の球をねらおう");
      tone(170, 0.1);
    }
  }
  function nextRound(g) {
    g.round++;
    if (g.id === "field-soccer" && g.round >= 5) {
      finish(g, g.score >= 3, g.score + " / 5ゴール");
      return;
    }
    if (g.id === "field-archery" && g.round >= 6) {
      finish(g, g.score >= 30, g.score + "点！");
      return;
    }
    if (g.id === "field-rings" && g.round >= 6) {
      finish(g, g.score >= 3, g.score + " / 6回成功！");
      return;
    }
    resetBall(g);
    g.arrow = null;
  }
  function resolve(g, success, points, text) {
    if (g.resolved) return;
    g.resolved = true;
    if (success) {
      g.score += points;
      tone(820, 0.15);
    } else tone(170, 0.08);
    msg(g.name + "：" + text);
    g.delay = 1.0;
  }
  function advance(dt) {
    for (const g of games) {
      g.clock += dt;
      g.swingAge = Math.max(0, g.swingAge - dt);
      if (g.state !== "playing") continue;
      g.time = Math.max(0, g.time - dt);
      if (g.time <= 0) {
        const goal =
          g.id === "field-golf"
            ? 3
            : g.id === "field-bowling"
              ? 35
              : g.id === "field-batting"
                ? 30
                : g.id === "field-archery"
                  ? 30
                  : 3;
        finish(g, g.score >= goal, "時間終了：" + g.score + "点");
        continue;
      }
      g.aimX = clamp(
        g.aimX + ((g.held.has("right") ? 1 : 0) - (g.held.has("left") ? 1 : 0)) * dt * 0.75,
        -1,
        1,
      );
      g.aimY = clamp(
        g.aimY + ((g.held.has("up") ? 1 : 0) - (g.held.has("down") ? 1 : 0)) * dt * 0.65,
        -0.15,
        1.3,
      );
      if (g.charging) {
        g.chargeAge += dt;
        if (g.id === "field-archery" || ![...drag.values()].some((d) => d.g === g))
          g.power = (1 - Math.cos(g.chargeAge * 2.8)) / 2;
      }
      g.targetX = Math.sin(g.clock * 1.7) * 0.72;
      for (const p of g.pins) if (p.down) p.tilt = Math.min(1.5, p.tilt + dt * 3);
      if (g.id === "field-batting") {
        if (g.delay > 0) {
          g.delay -= dt;
          if (g.moving) {
            g.ball.x += g.ball.vx * dt;
            g.ball.y += g.ball.vy * dt;
            g.ball.z += g.ball.vz * dt;
            g.ball.vy -= 4 * dt;
          }
          if (g.delay <= 0) {
            g.round++;
            if (g.round >= 6) {
              finish(g, g.score >= 30, g.score + "点！");
              continue;
            }
            resetBall(g, 0, -1.7);
            g.pitch = -0.5;
            g.swung = false;
          }
        } else {
          g.pitch += dt * 0.68;
          g.ball.x = 0;
          g.ball.z = -1.7 + g.pitch * 2.9;
          g.ball.y = -0.15;
          if (g.pitch > 1.3) {
            g.swung = true;
            g.delay = 0.6;
            msg("見逃し！ 次の球をねらおう");
          }
        }
        continue;
      }
      if (g.delay > 0) {
        g.delay -= dt;
        if (g.delay <= 0) {
          if (g.id === "field-golf") {
            g.course++;
            if (g.course >= 3) {
              finish(g, true, "3ホールクリア！ " + g.shots + "打");
              continue;
            }
            g.sunk = false;
            golfCourse(g);
          } else if (g.id === "field-bowling") {
            const remaining = g.pins.filter((p) => !p.down).length;
            g.roll++;
            if (!remaining || g.roll >= 2) {
              g.frameNumber++;
              g.roll = 0;
              g.pins = pins();
              if (g.frameNumber >= 5) {
                finish(g, g.score >= 35, g.score + "本倒した！");
                continue;
              }
            }
            resetBall(g);
          } else nextRound(g);
        }
        continue;
      }
      if (!g.moving) {
        if (g.id === "field-bowling") g.ball.x = g.aimX * 0.82;
        continue;
      }
      g.shotAge += dt;
      const b = g.ball;
      if (g.id === "field-golf") {
        const friction = Math.exp(-0.85 * dt);
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.vx *= friction;
        b.vz *= friction;
        for (const axis of ["x", "z"]) {
          const lo = axis === "x" ? -1.27 : -1.72,
            hi = axis === "x" ? 1.27 : 1.52;
          if (b[axis] < lo || b[axis] > hi) {
            b[axis] = clamp(b[axis], lo, hi);
            b["v" + axis] *= -0.62;
          }
        }
        for (const o of g.obstacles)
          if (Math.abs(b.x - o.x) < o.w / 2 + 0.09 && Math.abs(b.z - o.z) < o.d / 2 + 0.09) {
            b.z += b.vz > 0 ? 0.1 : -0.1;
            b.vz *= -0.65;
          }
        const speed = Math.hypot(b.vx, b.vz);
        if (Math.hypot(b.x - g.hole.x, b.z - g.hole.z) < 0.16 && speed < 1.25) {
          b.x = g.hole.x;
          b.z = g.hole.z;
          b.y = floor - 0.05;
          g.score++;
          g.sunk = true;
          g.delay = 1;
          msg("⛳ カップイン！");
          tone(900, 0.2);
        } else if (speed < 0.035 || g.shotAge > 10) {
          g.moving = false;
          b.vx = b.vz = 0;
          if (g.shots >= 12) finish(g, false, g.score + " / 3ホール。もう一度！");
        }
      } else if (g.id === "field-bowling") {
        b.z += b.vz * dt;
        for (const p of g.pins) {
          if (p.down || Math.hypot(b.x - p.x, b.z - p.z) > 0.24) continue;
          p.down = true;
          p.dir = Math.atan2(p.x - b.x, -1);
          g.score++;
          for (const q of g.pins)
            if (!q.down && Math.hypot(p.x - q.x, p.z - q.z) < 0.34) {
              q.down = true;
              q.dir = p.dir + (q.x - p.x);
              g.score++;
            }
          tone(260, 0.05);
        }
        if (b.z < -1.95 || g.shotAge > 3) {
          g.delay = 1.2;
          g.moving = false;
          msg("🎳 合計 " + g.score + "本！");
        }
      } else if (g.id === "field-soccer") {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        b.vy -= 4 * dt;
        if (b.y < floor + 0.1) {
          b.y = floor + 0.1;
          b.vy = Math.abs(b.vy) * 0.28;
        }
        if (
          !g.resolved &&
          b.z < -1.05 &&
          b.z > -1.5 &&
          Math.abs(b.x - g.targetX) < 0.26 &&
          b.y < 0.15
        ) {
          resolve(g, false, 0, "キーパーが止めた！");
          b.vz = 1.2;
        }
        if (!g.resolved && b.z < -1.65) {
          const hit = Math.abs(b.x) < 1.05 && b.y < 0.38;
          resolve(g, hit, 1, hit ? "⚽ ゴール！" : "枠を外れた！");
        }
        if (g.shotAge > 3 && !g.resolved) resolve(g, false, 0, "次のシュートへ！");
      } else if (g.id === "field-archery") {
        const a = g.arrow;
        a.px = a.x;
        a.py = a.y;
        a.pz = a.z;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.z += a.vz * dt;
        a.vy -= 3.2 * dt;
        if (a.z <= -1.57 && !g.resolved) {
          a.z = -1.57;
          const d = Math.hypot(a.x, 0.65 - a.y),
            points = d < 0.14 ? 10 : d < 0.32 ? 6 : d < 0.57 ? 3 : 0;
          resolve(g, points > 0, points, points ? "🏹 " + points + "点！" : "的を外れた！");
        }
      } else if (g.id === "field-rings") {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        b.vy -= 4 * dt;
        if (b.y <= floor + 0.025 && !g.resolved) {
          b.y = floor + 0.025;
          const targets = [
            { x: -0.7, z: -0.5 },
            { x: 0, z: -1.1 },
            { x: 0.7, z: -0.5 },
          ];
          const hit = targets.some((t) => Math.hypot(b.x - t.x, b.z - t.z) < 0.22);
          resolve(g, hit, 1, hit ? "⭕ 輪が入った！" : "もう少し！");
        }
      }
    }
  }
  function nearest() {
    return games
      .filter(
        (g) =>
          scene.distance(g.offset) < 7.5 &&
          scene.player.z > 2.8 &&
          Math.abs(scene.player.x - g.offset) < 4.5,
      )
      .sort((a, b) => scene.distance(a.offset) - scene.distance(b.offset))[0];
  }
  function pointerMove(e) {
    const d = drag.get(e.pointerId);
    if (!d) return false;
    const g = d.g;
    if (d.batting) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 18) swing(g);
      return true;
    }
    aimPoint(g, e);
    const length = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    d.distance = Math.max(d.distance, length);
    if (g.id !== "field-archery") g.power = clamp(d.distance / 220, 0, 1);
    return true;
  }
  function aimPoint(g, e) {
    if (g.moving) return false;
    if (g.id === "field-archery") {
      const p = scene.verticalPoint(e.clientX, e.clientY, -1.57);
      if (!p || Math.abs(p.x - g.offset) > 1.5 || p.y < -0.5 || p.y > 1.6) return false;
      g.aimX = clamp(p.x - g.offset, -1, 1);
      g.aimY = clamp(p.y, -0.15, 1.3);
      return true;
    }
    const p = scene.planePoint(e.clientX, e.clientY, floor);
    if (!p || Math.abs(p.x - g.offset) > 1.4 || p.z < -1.9 || p.z > 1.8) return false;
    g.aimX =
      g.id === "field-golf"
        ? clamp((p.x - g.offset - g.ball.x) / Math.max(0.3, g.ball.z - p.z), -1, 1)
        : clamp(p.x - g.offset, -1, 1);
    return true;
  }
  function pointerDown(e) {
    if (!enabled) return false;
    const g = nearest();
    if (!g || [...drag.values()].some((d) => d.g === g)) return false;
    // Only touches on the real course/target are consumed; swiping the hall still looks around.
    const p =
      g.id === "field-archery"
        ? scene.verticalPoint(e.clientX, e.clientY, -1.57)
        : scene.planePoint(e.clientX, e.clientY, g.id === "field-batting" ? -0.15 : floor);
    if (
      !p ||
      Math.abs(p.x - g.offset) > 1.5 ||
      (g.id === "field-archery" ? p.y < -0.5 || p.y > 1.6 : p.z < -1.9 || p.z > 1.8)
    )
      return false;
    const starting = g.state !== "playing";
    if (starting) start(g);
    if (g.moving || g.delay > 0) return true;
    if (g.id === "field-batting") {
      drag.set(e.pointerId, { g, x: e.clientX, y: e.clientY, batting: true, starting });
      return true;
    }
    aimPoint(g, e);
    g.charging = true;
    g.chargeAge = 0;
    g.power = 0;
    drag.set(e.pointerId, { g, x: e.clientX, y: e.clientY, distance: 0 });
    return true;
  }
  function pointerUp(e) {
    const d = drag.get(e.pointerId);
    if (!d) return;
    drag.delete(e.pointerId);
    const g = d.g;
    if (e.type === "pointercancel" || e.type === "lostpointercapture") {
      g.charging = false;
      return;
    }
    if (d.batting) {
      if (!d.starting) swing(g);
      return;
    }
    if (!g.charging) return;
    g.charging = false;
    if (g.id !== "field-archery") g.power = clamp(d.distance / 220, 0, 1);
    shoot(g);
  }
  function clearInputs() {
    drag.clear();
    for (const g of games) {
      g.held.clear();
      g.charging = false;
    }
  }
  function dropGame(g) {
    for (const [id, obj] of drag) if (obj.g === g) drag.delete(id);
    for (let i = controls.length - 1; i >= 0; i--)
      if (controls[i].g === g) {
        controls[i].el.remove();
        controls.splice(i, 1);
      }
    const i = games.indexOf(g);
    if (i >= 0) games.splice(i, 1);
  }
  function updateControls(show) {
    enabled = show;
    if (!show) clearInputs();
  }
  function status(g) {
    return (
      g.name +
      " · " +
      (g.state === "playing"
        ? g.id === "field-golf"
          ? g.score + "/3ホール · " + g.shots + "打"
          : g.score + "点 · " + Math.ceil(g.time) + "秒"
        : g.hint)
    );
  }
  const keymap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Space: "hit",
    Enter: "hit",
    KeyE: "start",
  };
  function handlesKeys(e) {
    return enabled && !!keymap[e.code] && !!nearest();
  }
  window.addEventListener("keydown", (e) => {
    if (!handlesKeys(e) || e.target?.matches("input,select")) return;
    e.preventDefault();
    if (e.repeat) return;
    const g = nearest(),
      k = keymap[e.code];
    if (k === "start" || (g.state !== "playing" && k === "hit")) start(g);
    else keyInput(g, k, true);
  });
  window.addEventListener("keyup", (e) => {
    const k = keymap[e.code];
    if (!k) return;
    for (const g of games) if (g.held.has(k)) keyInput(g, k, false);
  });
  for (const t of templates) addGame(t.id, t.offset);
  return {
    templates,
    games,
    addGame,
    dropGame,
    start,
    finish,
    shoot,
    swing,
    keyInput,
    advance,
    updateControls,
    pointerDown,
    pointerMove,
    pointerUp,
    clearInputs,
    status,
    handlesKeys,
  };
};
