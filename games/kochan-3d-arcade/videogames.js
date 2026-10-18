/* Twenty distinct arcade simulations, shared lifecycle and touch controls. */
(function () {
  "use strict";
  const W = 720,
    H = 480,
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    rnd = (g, a, b) => a + g.random() * (b - a),
    over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const definitions = [];
  function add(d) {
    definitions.push(d);
  }
  function tint(color, factor) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
    return (
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(clamp(parseInt(color.slice(i, i + 2), 16) * factor, 0, 255))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  function circle(c, x, y, r, color) {
    c.save();
    if (r >= 6) {
      c.shadowColor = "#06142166";
      c.shadowBlur = r * 0.35;
      c.shadowOffsetY = r * 0.18;
      const g = c.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.05, x, y, r);
      g.addColorStop(0, tint(color, 1.32));
      g.addColorStop(0.5, color);
      g.addColorStop(1, tint(color, 0.6));
      c.fillStyle = g;
    } else c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  function rect(c, x, y, w, h, color) {
    c.save();
    const g = c.createLinearGradient(x, y, x + w * 0.2, y + h);
    g.addColorStop(0, tint(color, 1.16));
    g.addColorStop(0.48, color);
    g.addColorStop(1, tint(color, 0.76));
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    if (w > 12 && h > 8 && w < 650 && h < 400) {
      c.strokeStyle = "#edf6f324";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      c.fillStyle = "#e4f5fb15";
      c.fillRect(x + 1, y + 1, w - 2, Math.min(3, h * 0.12));
    }
    c.restore();
  }
  function text(c, t, x, y, size = 20, color = "#e5f4f5") {
    c.fillStyle = color;
    c.font = `bold ${size}px system-ui,sans-serif`;
    c.textAlign = "center";
    c.fillText(t, x, y);
  }
  function line(c, a, b, color = "#9ac9d9", width = 2) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    if (width > 6) {
      c.shadowColor = "#081c2877";
      c.shadowBlur = 5;
      c.shadowOffsetY = 3;
    }
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    if (width > 6) {
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      c.strokeStyle = "#f0faff44";
      c.lineWidth = Math.max(1, width * 0.12);
      c.beginPath();
      c.moveTo(a.x - width * 0.14, a.y);
      c.lineTo(b.x - width * 0.14, b.y);
      c.stroke();
    }
    c.restore();
  }
  function car(c, x, y, color, rotate = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rotate);
    c.shadowColor = "#06111dcc";
    c.shadowBlur = 9;
    c.shadowOffsetY = 6;
    rect(c, -24, -29, 48, 63, color);
    for (const side of [-1, 1]) {
      rect(c, side * 25 - 4, -20, 8, 16, "#182e3d");
      rect(c, side * 25 - 4, 15, 8, 16, "#182e3d");
    }
    rect(c, -17, -13, 34, 21, "#385b74");
    rect(c, -14, 10, 28, 12, "#32526a");
    rect(c, -19, -25, 12, 4, "#f5e4ba");
    rect(c, 7, -25, 12, 4, "#f5e4ba");
    rect(c, -19, 27, 9, 3, "#cf7184");
    rect(c, 10, 27, 9, 3, "#cf7184");
    line(c, { x: -8, y: -27 }, { x: -8, y: 25 }, "#e7f5ec55", 2);
    c.restore();
  }
  function pin(c, x, y) {
    c.save();
    c.shadowColor = "#19212a77";
    c.shadowBlur = 7;
    c.shadowOffsetY = 7;
    c.fillStyle = "#d6e2e7";
    c.beginPath();
    c.ellipse(x, y + 2, 10, 16, 0, 0, Math.PI * 2);
    c.fill();
    rect(c, x - 5, y - 16, 10, 18, "#dce8eb");
    circle(c, x, y - 18, 6, "#e8edef");
    rect(c, x - 5, y - 11, 10, 5, "#cc7184");
    line(c, { x: x - 3, y: y - 4 }, { x: x - 5, y: y + 7 }, "#ffffffaa", 2);
    c.restore();
  }
  function ballPattern(c, x, y, r) {
    circle(c, x, y, r, "#e5e9df");
    c.strokeStyle = "#647986";
    c.lineWidth = Math.max(1, r * 0.09);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    }
    c.stroke();
    circle(c, x, y, r * 0.3, "#526778");
  }
  function good(g, points = 10, note = "ナイス！") {
    g.score += points;
    g.notice = note;
    g.flash = 0.5;
  }
  function hurt(g, note = "ミス！") {
    if (g.invulnerable > 0) return;
    g.lives--;
    g.invulnerable = 0.8;
    g.notice = note;
    g.flash = 0.5;
    if (g.lives <= 0) g.finish(false, "ライフがなくなった！");
  }
  function endRounds(g, n, target) {
    if (g.round >= n)
      g.finish(g.score >= target, g.score >= target ? "目標クリア！" : "もう一度チャレンジ！");
  }
  function aim(g, dt, speed = 280) {
    g.x = clamp(
      g.x + ((g.held.has("right") ? 1 : 0) - (g.held.has("left") ? 1 : 0)) * speed * dt,
      80,
      640,
    );
  }
  function power(g, dt) {
    if (g.charging) g.power = (g.power + dt * 0.75) % 1;
  }
  function arrows(g, p) {
    g.x = clamp(p.x, 80, 640);
  }
  function powerDown(g, k, down) {
    if (k === "action") {
      g.charging = down;
      if (down) g.power = 0.15;
    }
  }
  add({
    id: "race",
    name: "ネオンレース",
    icon: "🏎️",
    color: "#7ac8ec",
    duration: 50,
    target: 1800,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "アクセル"],
    ],
    hint: "左右でハンドル、アクセルで加速。車を避けて1800m走ろう！",
    init(g) {
      g.x = 360;
      g.distance = 0;
      g.cars = [];
      g.spawn = 0.6;
      g.lives = 4;
    },
    update(g, dt) {
      aim(g, dt, 280);
      g.x = clamp(g.x, 170, 550);
      const boost = g.held.has("action"),
        speed = boost ? 82 : 48;
      g.distance += speed * dt;
      g.score = Math.floor(g.distance);
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = boost ? 0.62 : 0.95;
        g.cars.push({ x: rnd(g, 190, 530), y: -70, w: 46, h: 65 });
      }
      for (const o of g.cars) {
        o.y += (boost ? 255 : 175) * dt;
        if (over({ x: g.x - 23, y: 355, w: 46, h: 65 }, o)) {
          hurt(g, "車にぶつかった！");
          o.y = 600;
        }
      }
      g.cars = g.cars.filter((o) => o.y < 520);
      if (g.distance >= 1800) g.finish(true, "ゴール！ 1800m走った！");
    },
    pointer: arrows,
    draw(g, c) {
      rect(c, 140, 0, 440, 480, "#293d51");
      for (let i = 0; i < 12; i++) {
        let y = ((i * 65 + g.age * 150) % 560) - 60;
        rect(c, 285, y, 5, 33, "#a3bfca");
        rect(c, 430, y, 5, 33, "#a3bfca");
      }
      for (const o of g.cars) car(c, o.x + 23, o.y + 32, "#c87990");
      car(c, g.x, 387, g.invulnerable > 0 ? "#f5e4ac" : "#6ebda8");
      text(c, Math.floor(g.distance) + " / 1800 m", 360, 40);
    },
  });
  add({
    id: "space",
    name: "宇宙シューティング",
    icon: "🚀",
    color: "#a7b8ef",
    duration: 65,
    target: 360,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "レーザー"],
    ],
    hint: "左右に動いてレーザー！ 敵36機を倒し、赤い弾を避けよう。",
    init(g) {
      g.x = 360;
      g.shots = [];
      g.bullets = [];
      g.enemies = [];
      g.wave = 0;
      g.fire = 0;
      g.enemyFire = 1;
      g.lives = 4;
      spaceWave(g);
    },
    update(g, dt) {
      aim(g, dt);
      g.fire -= dt;
      if (g.held.has("action") && g.fire <= 0) {
        g.shots.push({ x: g.x, y: 400 });
        g.fire = 0.16;
      }
      g.enemyFire -= dt;
      if (g.enemyFire <= 0 && g.enemies.length) {
        let e = g.enemies[Math.floor(g.random() * g.enemies.length)];
        g.bullets.push({ x: e.x, y: e.y });
        g.enemyFire = 0.5;
      }
      for (const e of g.enemies) e.x = e.base + Math.sin(g.age * 1.3) * 48;
      for (const s of g.shots) {
        s.y -= 450 * dt;
        for (const e of g.enemies)
          if (!e.dead && Math.abs(s.x - e.x) < 24 && Math.abs(s.y - e.y) < 20) {
            e.dead = true;
            s.y = -100;
            good(g, 10);
          }
      }
      g.enemies = g.enemies.filter((e) => !e.dead);
      for (const b of g.bullets) {
        b.y += 190 * dt;
        if (Math.hypot(b.x - g.x, b.y - 410) < 25) {
          b.y = 600;
          hurt(g);
        }
      }
      g.shots = g.shots.filter((s) => s.y > 0);
      g.bullets = g.bullets.filter((b) => b.y < 500);
      if (!g.enemies.length) {
        if (g.wave >= 2) g.finish(true, "宇宙の敵を全滅！");
        else spaceWave(g);
      }
    },
    pointer: arrows,
    draw(g, c) {
      for (let i = 0; i < 40; i++)
        circle(c, (i * 113) % 720, (i * 67 + g.age * 30) % 480, 1.5, "#7f9dbd");
      for (const e of g.enemies) {
        rect(c, e.x - 20, e.y - 14, 40, 28, "#b4a0df");
        rect(c, e.x - 12, e.y + 14, 5, 7, "#e3bad7");
        rect(c, e.x + 8, e.y + 14, 5, 7, "#e3bad7");
      }
      for (const s of g.shots) rect(c, s.x - 2, s.y, 4, 18, "#a8ffe5");
      for (const b of g.bullets) circle(c, b.x, b.y, 5, "#f18d9e");
      c.fillStyle = "#90d6eb";
      c.beginPath();
      c.moveTo(g.x, 389);
      c.lineTo(g.x - 25, 432);
      c.lineTo(g.x + 25, 432);
      c.fill();
    },
  });
  function spaceWave(g) {
    g.wave++;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 6; col++)
        g.enemies.push({ base: 155 + col * 78, x: 155 + col * 78, y: 70 + row * 65 });
  }
  add({
    id: "gallery",
    name: "動く的の射的",
    icon: "🎯",
    color: "#ecc58d",
    duration: 40,
    target: 120,
    buttons: [],
    hint: "丸い的をタップ！ 赤いバツは押さない。120点を目指そう。",
    init(g) {
      g.targets = [];
      g.spawn = 0.1;
      g.lives = 4;
    },
    update(g, dt) {
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = 0.62;
        g.targets.push({
          x: rnd(g, 70, 650),
          y: rnd(g, 80, 370),
          vx: rnd(g, -35, 35),
          life: 1.8,
          bad: g.random() < 0.22,
        });
      }
      for (const t of g.targets) {
        t.life -= dt;
        t.x += t.vx * dt;
      }
      g.targets = g.targets.filter((t) => t.life > 0);
    },
    pointer(g, p) {
      if (p.phase !== "down") return;
      let t = g.targets.find((t) => t.life > 0 && dist(t, p) < 31);
      if (!t) return;
      t.life = 0;
      t.bad ? hurt(g, "バツを撃っちゃった！") : good(g, 10);
    },
    draw(g, c) {
      for (let y = 130; y < 480; y += 110) rect(c, 0, y, 720, 6, "#526880");
      for (const t of g.targets) {
        circle(c, t.x, t.y, 31, t.bad ? "#d57e92" : "#d9bf80");
        circle(c, t.x, t.y, 19, "#26394d");
        text(c, t.bad ? "×" : "◎", t.x, t.y + 10, 29, t.bad ? "#efafba" : "#f3de9c");
      }
    },
  });
  add({
    id: "bowling",
    name: "ボウリング",
    icon: "🎳",
    color: "#b1d1ed",
    duration: 60,
    target: 25,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "長押し→投げる"],
    ],
    hint: "左右で位置を決め、ボタンを長押しして離す。5投で25本！",
    init(g) {
      g.x = 360;
      g.power = 0.2;
      g.charging = false;
      g.ball = null;
      g.round = 0;
      g.pins = makePins();
    },
    update(g, dt) {
      aim(g, dt, 200);
      power(g, dt);
      if (g.ball) {
        let b = g.ball;
        b.y -= b.speed * dt;
        for (const p of g.pins)
          if (!p.down && dist(b, p) < 23) {
            p.down = true;
            good(g, 1, "ピンが倒れた！");
            for (const q of g.pins)
              if (!q.down && dist(p, q) < 43) {
                q.down = true;
                good(g, 1);
              }
          }
        if (b.y < 35) {
          g.ball = null;
          g.round++;
          endRounds(g, 5, 25);
          if (g.state === "playing") g.pins = makePins();
        }
      }
    },
    key(g, k, down) {
      if (k !== "action" || g.ball) return;
      if (down) {
        g.charging = true;
        g.power = 0.15;
      } else if (g.charging) {
        g.charging = false;
        g.ball = { x: g.x, y: 415, speed: 230 + g.power * 300 };
      }
    },
    pointer: arrows,
    draw(g, c) {
      rect(c, 170, 20, 380, 450, "#927e65");
      for (let x = 200; x < 550; x += 35) rect(c, x, 20, 2, 450, "#ac9876");
      for (const p of g.pins) if (!p.down) pin(c, p.x, p.y);
      circle(c, g.ball?.x ?? g.x, g.ball?.y ?? 415, 15, "#8ab9d5");
      text(c, g.round + 1 + " / 5投", 360, 44);
      drawPower(g, c);
    },
  });
  function makePins() {
    let p = [];
    for (let r = 0; r < 4; r++)
      for (let j = 0; j <= r; j++)
        p.push({ x: 360 + (j - r / 2) * 34, y: 145 - r * 30, down: false });
    return p;
  }
  function drawPower(g, c) {
    rect(c, 210, 451, 300, 13, "#2e4b61");
    rect(c, 210, 451, 300 * (g.power || 0), 13, "#d9c286");
    text(c, "POWER", 170, 463, 12);
  }
  add({
    id: "soccer",
    name: "PKサッカー",
    icon: "⚽",
    color: "#91cba8",
    duration: 55,
    target: 30,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "シュート"],
    ],
    hint: "左右でコースをねらい、動くキーパーのすきをついて5回シュート！",
    init(g) {
      g.x = 360;
      g.keeper = 360;
      g.ball = null;
      g.round = 0;
    },
    update(g, dt) {
      aim(g, dt, 240);
      g.keeper = 360 + Math.sin(g.age * 2.1) * 170;
      if (g.ball) {
        let b = g.ball;
        b.y -= 330 * dt;
        b.x += (b.target - b.x) * dt * 5;
        if (b.y <= 135) {
          if (Math.abs(b.x - g.keeper) > 58) good(g, 10, "ゴール！");
          else {
            g.notice = "キーパーに止められた！";
            g.flash = 0.9;
          }
          g.ball = null;
          g.round++;
          endRounds(g, 5, 30);
        }
      }
    },
    key(g, k, d) {
      if (k === "action" && d && !g.ball) g.ball = { x: 360, y: 410, target: clamp(g.x, 180, 540) };
    },
    pointer: arrows,
    draw(g, c) {
      rect(c, 80, 50, 560, 400, "#356e60");
      for (let i = 0; i < 7; i++) rect(c, 80, 50 + i * 56, 560, 27, "#407766");
      line(c, { x: 150, y: 330 }, { x: 570, y: 330 }, "#b8d1b3", 2);
      line(c, { x: 150, y: 330 }, { x: 150, y: 150 }, "#b8d1b3", 2);
      line(c, { x: 570, y: 330 }, { x: 570, y: 150 }, "#b8d1b3", 2);
      rect(c, 150, 65, 420, 85, "#b9d4d2");
      for (let x = 165; x < 570; x += 25) line(c, { x, y: 65 }, { x, y: 150 }, "#718f91", 1);
      line(c, { x: g.keeper - 40, y: 126 }, { x: g.keeper + 40, y: 126 }, "#c89c87", 11);
      rect(c, g.keeper - 16, 112, 32, 38, "#c18587");
      circle(c, g.keeper, 98, 13, "#d2b79b");
      line(c, { x: g.keeper - 10, y: 150 }, { x: g.keeper - 18, y: 168 }, "#3c566d", 10);
      line(c, { x: g.keeper + 10, y: 150 }, { x: g.keeper + 18, y: 168 }, "#3c566d", 10);
      line(c, { x: g.x, y: 370 }, { x: g.x, y: 325 }, "#f5dc99", 3);
      ballPattern(c, g.ball?.x ?? 360, g.ball?.y ?? 410, 13);
      text(c, g.round + 1 + " / 5本", 360, 35);
    },
  });
  add({
    id: "baseball",
    name: "ホームランバトル",
    icon: "⚾",
    color: "#e4b1aa",
    duration: 45,
    target: 40,
    buttons: [["action", "スイング"]],
    hint: "ボールが手前の丸に来たらスイング！ 10球で40点をねらおう。",
    init(g) {
      g.pitch = -0.8;
      g.swung = false;
      g.round = 0;
      g.resultTimer = 0;
      g.hitBall = null;
    },
    update(g, dt) {
      g.resultTimer = Math.max(0, g.resultTimer - dt);
      if (g.hitBall) {
        g.hitBall.x += 240 * dt;
        g.hitBall.y -= 280 * dt;
        if (g.hitBall.y < -50) g.hitBall = null;
      }
      g.pitch += dt * 0.75;
      if (g.pitch > 1.4) {
        g.round++;
        endRounds(g, 10, 40);
        g.pitch = -0.7;
        g.swung = false;
      }
    },
    key(g, k, d) {
      if (k !== "action" || !d || g.pitch < 0 || g.pitch > 1.25 || g.swung) return;
      g.swung = true;
      let error = Math.abs(g.pitch - 1);
      if (error < 0.11) {
        good(g, error < 0.045 ? 10 : 5, error < 0.045 ? "ホームラン！" : "ヒット！");
        g.hitBall = { x: 360, y: 400 };
      } else {
        g.notice = "空振り！";
        g.flash = 0.6;
      }
      g.pitch = 1.27;
    },
    draw(g, c) {
      rect(c, 0, 0, 720, 480, "#315d59");
      c.fillStyle = "#9d836b";
      c.beginPath();
      c.moveTo(360, 90);
      c.lineTo(610, 420);
      c.lineTo(110, 420);
      c.fill();
      circle(c, 360, 400, 25, "#d7cdb355");
      if (g.pitch >= 0 && g.pitch < 1.27)
        circle(c, 360, 110 + g.pitch * 290, 7 + g.pitch * 6, "#edf3ed");
      if (g.hitBall) circle(c, g.hitBall.x, g.hitBall.y, 9, "#f8eccf");
      line(
        c,
        { x: 415, y: 430 },
        { x: g.swung ? 330 : 460, y: g.swung ? 380 : 340 },
        "#d8ba8b",
        13,
      );
      text(c, g.round + 1 + " / 10球", 360, 40);
    },
  });
  add({
    id: "drums",
    name: "ふたつの太鼓",
    icon: "🥁",
    color: "#e59fa7",
    duration: 45,
    target: 240,
    buttons: [
      ["left", "ドン"],
      ["right", "カッ"],
    ],
    hint: "音符が下の線に来たら、同じ色の太鼓をたたこう。コンボで高得点！",
    init(g) {
      g.notes = [];
      g.spawn = 0.3;
      g.pattern = 0;
      g.combo = 0;
    },
    update(g, dt) {
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = 0.52;
        g.notes.push({ lane: g.pattern++ % 2, y: 25 });
      }
      for (const n of g.notes) n.y += 180 * dt;
      for (const n of g.notes)
        if (n.y > 445 && !n.missed) {
          n.missed = true;
          g.combo = 0;
        }
      g.notes = g.notes.filter((n) => n.y < 480);
    },
    key(g, k, d) {
      if (!d || !["left", "right"].includes(k)) return;
      let lane = k === "left" ? 0 : 1,
        n = g.notes
          .filter((n) => n.lane === lane)
          .sort((a, b) => Math.abs(a.y - 390) - Math.abs(b.y - 390))[0];
      if (n && Math.abs(n.y - 390) < 35) {
        good(g, Math.abs(n.y - 390) < 15 ? 10 : 5, "コンボ " + ++g.combo);
        g.notes.splice(g.notes.indexOf(n), 1);
      } else {
        g.combo = 0;
        g.notice = "タイミングを合わせよう";
        g.flash = 0.3;
      }
    },
    pointer(g, p) {
      if (p.phase === "down") this.key(g, p.x < 360 ? "left" : "right", true);
    },
    draw(g, c) {
      for (let lane = 0; lane < 2; lane++) {
        rect(c, 215 + lane * 160, 20, 130, 430, "#263f55");
        circle(c, 280 + lane * 160, 390, 36, lane ? "#76b6d6" : "#e593a6");
      }
      line(c, { x: 200, y: 390 }, { x: 520, y: 390 }, "#f3e2b0", 3);
      for (const n of g.notes)
        circle(c, 280 + n.lane * 160, n.y, 24, n.lane ? "#8bc7e6" : "#f0a6b4");
      text(c, "COMBO " + g.combo, 360, 40);
    },
  });
  add({
    id: "crossing",
    name: "道路わたり",
    icon: "🚦",
    color: "#b8d398",
    duration: 65,
    target: 3,
    buttons: [
      ["left", "◀"],
      ["up", "前へ"],
      ["right", "▶"],
      ["down", "戻る"],
    ],
    hint: "車の間をぬって向こう側へ！ 3回渡ったらクリア。",
    init(g) {
      g.x = 360;
      g.row = 0;
      g.lives = 4;
      g.traffic = Array.from({ length: 6 }, (_, i) => ({
        y: 365 - i * 50,
        speed: (i % 2 ? 1 : -1) * (80 + i * 13),
        cars: [80 + i * 43, 340 + i * 21, 600 + i * 9],
      }));
    },
    update(g, dt) {
      for (const row of g.traffic) {
        row.cars = row.cars.map((x) => ((x + row.speed * dt + 870) % 820) - 50);
        if (
          row.cars.some((x) => Math.abs(x - g.x) < 36) &&
          Math.abs(row.y - (430 - g.row * 50)) < 20
        ) {
          hurt(g, "車に注意！");
          g.row = 0;
          g.x = 360;
        }
      }
    },
    key(g, k, d) {
      if (!d) return;
      if (k === "left") g.x = clamp(g.x - 50, 60, 660);
      if (k === "right") g.x = clamp(g.x + 50, 60, 660);
      if (k === "down") g.row = Math.max(0, g.row - 1);
      if (k === "up") {
        g.row++;
        if (g.row >= 8) {
          good(g, 1, "渡れた！");
          g.row = 0;
          if (g.score >= 3) g.finish(true, "3回渡りきった！");
        }
      }
    },
    draw(g, c) {
      rect(c, 0, 50, 720, 380, "#2b4052");
      rect(c, 0, 20, 720, 40, "#618b70");
      rect(c, 0, 410, 720, 70, "#618b70");
      for (const row of g.traffic) {
        line(c, { x: 0, y: row.y + 24 }, { x: 720, y: row.y + 24 }, "#5a6e7c", 1);
        for (const x of row.cars) {
          c.save();
          c.translate(x, row.y);
          c.scale(0.78, 0.78);
          car(c, 0, 0, "#b58fa9", row.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
          c.restore();
        }
      }
      circle(c, g.x, 430 - g.row * 50, 14, "#b7ecd2");
      text(c, g.score + " / 3往路", 360, 35);
    },
  });
  add({
    id: "pinball",
    name: "ピンボール",
    icon: "🔮",
    color: "#c2a9e6",
    duration: 65,
    target: 150,
    buttons: [
      ["left", "左フリッパー"],
      ["action", "発射"],
      ["right", "右フリッパー"],
    ],
    hint: "発射して左右のフリッパーで打ち返す。3球で150点！",
    init(g) {
      g.ball = { x: 600, y: 420, vx: 0, vy: 0 };
      g.launched = false;
      g.lives = 3;
      g.bumpers = [
        { x: 290, y: 150 },
        { x: 440, y: 150 },
        { x: 365, y: 260 },
      ];
      g.bumpCooldown = 0;
    },
    update(g, dt) {
      if (!g.launched) return;
      g.bumpCooldown = Math.max(0, g.bumpCooldown - dt);
      let b = g.ball;
      b.vy += 260 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 150 || b.x > 590) {
        b.x = clamp(b.x, 150, 590);
        b.vx = -b.vx * 0.94;
      }
      if (b.y < 40) {
        b.y = 40;
        b.vy = Math.abs(b.vy);
      }
      for (const p of g.bumpers) {
        let dx = b.x - p.x,
          dy = b.y - p.y,
          d = Math.hypot(dx, dy);
        if (d < 45) {
          let nx = dx / (d || 1),
            ny = dy / (d || 1);
          b.x = p.x + nx * 46;
          b.y = p.y + ny * 46;
          b.vx = nx * 250;
          b.vy = ny * 260;
          if (g.bumpCooldown <= 0) {
            good(g, 10);
            g.bumpCooldown = 0.2;
          }
        }
      }
      if (b.y > 365 && b.y < 420 && b.vy > 0) {
        if ((b.x < 360 && g.held.has("left")) || (b.x >= 360 && g.held.has("right"))) {
          b.vy = -380;
          b.vx = b.x < 360 ? 140 : -140;
        }
      }
      if (b.y > 485) {
        hurt(g, "ボールが落ちた！");
        g.launched = false;
        g.ball = { x: 580, y: 420, vx: 0, vy: 0 };
      }
      if (g.score >= 150) g.finish(true, "バンパーマスター！");
    },
    key(g, k, d) {
      if (k === "action" && d && !g.launched) {
        g.launched = true;
        g.ball = { x: 580, y: 415, vx: -150, vy: -440 };
      }
    },
    draw(g, c) {
      rect(c, 135, 20, 470, 460, "#263b58");
      for (const p of g.bumpers) {
        circle(c, p.x, p.y, 34, "#8a6dba");
        circle(c, p.x, p.y, 21, "#d7b8ef");
      }
      line(c, { x: 235, y: 402 }, { x: 340, y: g.held.has("left") ? 365 : 425 }, "#dcb5d9", 17);
      line(c, { x: 485, y: 402 }, { x: 380, y: g.held.has("right") ? 365 : 425 }, "#b2c9e5", 17);
      circle(c, g.ball.x, g.ball.y, 11, "#e6e9ed");
    },
  });
  add({
    id: "breakout",
    name: "ブロックくずし",
    icon: "🧱",
    color: "#e7b798",
    duration: 75,
    target: 32,
    buttons: [
      ["left", "◀"],
      ["action", "発射"],
      ["right", "▶"],
    ],
    hint: "パドルで球を返し、32個のブロックを全部こわそう。",
    init(g) {
      g.x = 360;
      g.lives = 4;
      g.ball = { x: 360, y: 405, vx: 180, vy: -230 };
      g.launched = false;
      g.bricks = Array.from({ length: 32 }, (_, i) => ({
        x: 75 + (i % 8) * 72,
        y: 60 + Math.floor(i / 8) * 33,
        w: 66,
        h: 25,
      }));
    },
    update(g, dt) {
      aim(g, dt, 360);
      let b = g.ball;
      if (!g.launched) {
        b.x = g.x;
        return;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 35 || b.x > 685) b.vx = -b.vx;
      if (b.y < 20) b.vy = Math.abs(b.vy);
      if (b.y > 394 && b.y < 423 && b.vy > 0 && Math.abs(b.x - g.x) < 65) {
        b.vy = -Math.abs(b.vy);
        b.vx = (b.x - g.x) * 5;
      }
      for (const br of g.bricks)
        if (
          !br.dead &&
          b.x > br.x - 7 &&
          b.x < br.x + br.w + 7 &&
          b.y > br.y - 7 &&
          b.y < br.y + br.h + 7
        ) {
          br.dead = true;
          b.vy = -b.vy;
          good(g, 1);
          break;
        }
      if (b.y > 490) {
        hurt(g);
        g.launched = false;
        g.ball = { x: g.x, y: 405, vx: 180, vy: -230 };
      }
      if (g.score >= 32) g.finish(true, "全ブロック撃破！");
    },
    key(g, k, d) {
      if (k === "action" && d) g.launched = true;
    },
    pointer: arrows,
    draw(g, c) {
      for (const br of g.bricks)
        if (!br.dead)
          rect(
            c,
            br.x,
            br.y,
            br.w,
            br.h,
            ["#e3a0a4", "#d7bc86", "#89c8b7", "#93b9dc"][Math.floor((br.y - 60) / 33)],
          );
      rect(c, g.x - 58, 420, 116, 13, "#bddfe1");
      circle(c, g.ball.x, g.ball.y, 8, "#f4e4b8");
    },
  });
  add({
    id: "reaction",
    name: "反応スピード",
    icon: "⚡",
    color: "#bce9bc",
    duration: 40,
    target: 300,
    buttons: [["action", "タップ！"]],
    hint: "WAIT中は待つ。緑のGOが出たらすぐタップ！ 5回勝負。",
    init(g) {
      g.round = 0;
      g.signal = "wait";
      g.wait = rnd(g, 1.5, 3.5);
      g.elapsed = 0;
      g.feedback = 0;
    },
    update(g, dt) {
      if (g.signal === "feedback") {
        g.feedback -= dt;
        if (g.feedback <= 0) {
          endRounds(g, 5, 300);
          g.signal = "wait";
          g.wait = rnd(g, 1.5, 3.5);
          g.elapsed = 0;
        }
      } else if (g.signal === "wait") {
        g.wait -= dt;
        if (g.wait <= 0) {
          g.signal = "go";
          g.elapsed = 0;
        }
      } else {
        g.elapsed += dt;
        if (g.elapsed > 2) this.key(g, "action", true);
      }
    },
    key(g, k, d) {
      if (k !== "action" || !d || g.signal === "feedback") return;
      if (g.signal === "wait") {
        g.notice = "フライング！";
        g.flash = 1;
      } else {
        let ms = Math.round(g.elapsed * 1000);
        good(g, ms < 350 ? 100 : ms < 600 ? 60 : 20, ms + " ms！");
      }
      g.round++;
      g.signal = "feedback";
      g.feedback = 0.8;
    },
    pointer(g, p) {
      if (p.phase === "down") this.key(g, "action", true);
    },
    draw(g, c) {
      const go = g.signal === "go";
      circle(c, 360, 230, 105, go ? "#90d5aa" : "#bd8794");
      text(c, go ? "GO!" : g.signal === "wait" ? "WAIT" : "OK", 360, 249, 45, "#243d4c");
      text(c, g.round + " / 5回", 360, 405, 25);
    },
  });
  add({
    id: "memory",
    name: "光の記憶",
    icon: "🧠",
    color: "#bdb6e5",
    duration: 85,
    target: 210,
    buttons: [],
    hint: "光った順番を覚え、4色のパネルを同じ順でタップ。6段階に挑戦！",
    init(g) {
      g.sequence = [Math.floor(g.random() * 4)];
      g.level = 1;
      g.showAge = 0;
      g.enter = 0;
      g.showing = true;
      g.lives = 3;
      g.flashPad = -1;
      g.padTimer = 0;
    },
    update(g, dt) {
      g.padTimer = Math.max(0, g.padTimer - dt);
      if (g.showing) {
        g.showAge += dt;
        if (g.showAge >= g.sequence.length * 0.7 + 0.6) {
          g.showing = false;
          g.enter = 0;
        }
      }
    },
    pointer(g, p) {
      if (p.phase !== "down" || g.showing) return;
      let col = p.x >= 360 ? 1 : 0,
        row = p.y >= 240 ? 1 : 0,
        i = row * 2 + col;
      g.flashPad = i;
      g.padTimer = 0.22;
      if (i !== g.sequence[g.enter]) {
        hurt(g, "順番をもう一度見よう！");
        g.showing = true;
        g.showAge = 0;
        g.enter = 0;
        return;
      }
      g.enter++;
      if (g.enter === g.sequence.length) {
        good(g, g.level * 10, "レベル" + g.level + "クリア！");
        if (g.level >= 6) {
          g.finish(true, "記憶名人！");
          return;
        }
        g.level++;
        g.sequence.push(Math.floor(g.random() * 4));
        g.showAge = -0.5;
        g.showing = true;
        g.enter = 0;
      }
    },
    draw(g, c) {
      let showing = g.showing && g.showAge >= 0 ? Math.floor(g.showAge / 0.7) : -1;
      let lit =
        showing >= 0 && showing < g.sequence.length && g.showAge % 0.7 < 0.45
          ? g.sequence[showing]
          : g.padTimer > 0
            ? g.flashPad
            : -1;
      for (let i = 0; i < 4; i++) {
        rect(
          c,
          120 + (i % 2) * 245,
          65 + Math.floor(i / 2) * 180,
          230,
          160,
          lit === i ? "#f8e8b5" : ["#9b789b", "#628ba9", "#789b80", "#bc9d68"][i],
        );
        text(c, i + 1, 235 + (i % 2) * 245, 161 + Math.floor(i / 2) * 180, 34);
      }
      text(c, g.showing ? "見て覚えよう" : "同じ順番でタップ！", 360, 450, 21);
    },
  });
  add({
    id: "rings",
    name: "輪投げ",
    icon: "⭕",
    color: "#e6c0a0",
    duration: 65,
    target: 30,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "長押し→投げる"],
    ],
    hint: "左右と投げる強さを合わせて棒に輪を入れよう。6投で30点！",
    init(g) {
      g.x = 360;
      g.power = 0.15;
      g.charging = false;
      g.ring = null;
      g.round = 0;
      g.pegs = [
        { x: 220, y: 205 },
        { x: 360, y: 160 },
        { x: 500, y: 205 },
      ];
    },
    update(g, dt) {
      aim(g, dt, 240);
      power(g, dt);
      if (g.ring) {
        let r = g.ring;
        r.t += dt;
        let t = clamp(r.t / 0.85, 0, 1);
        r.x = 360 + (r.tx - 360) * t;
        r.y = 420 + (r.ty - 420) * t - Math.sin(t * Math.PI) * 100;
        if (t === 1) {
          if (g.pegs.some((p) => Math.hypot(p.x - r.x, p.y - r.y) < 30))
            good(g, 10, "輪が入った！");
          else {
            g.notice = "もう少し！";
            g.flash = 0.5;
          }
          g.ring = null;
          g.round++;
          endRounds(g, 6, 30);
        }
      }
    },
    key(g, k, d) {
      if (k !== "action" || g.ring) return;
      if (d) {
        g.charging = true;
        g.power = 0.15;
      } else if (g.charging) {
        g.charging = false;
        g.ring = { t: 0, x: 360, y: 420, tx: g.x, ty: 440 - g.power * 335 };
      }
    },
    pointer: arrows,
    draw(g, c) {
      for (const p of g.pegs) {
        circle(c, p.x, p.y + 8, 24, "#647d87");
        rect(c, p.x - 5, p.y - 30, 10, 40, "#e5d5b0");
      }
      circle(c, g.x, 440 - g.power * 335, 5, "#a9e9d1");
      if (g.ring) {
        c.shadowColor = "#111c2888";
        c.shadowBlur = 5;
        c.shadowOffsetY = 8;
        c.strokeStyle = "#edc898";
        c.lineWidth = 6;
        c.beginPath();
        c.ellipse(g.ring.x, g.ring.y, 23, 11, 0, 0, Math.PI * 2);
        c.stroke();
        c.shadowBlur = 0;
        c.shadowOffsetY = 0;
      }
      text(c, g.round + " / 6投", 360, 35);
      drawPower(g, c);
    },
  });
  add({
    id: "fishing",
    name: "フィッシング",
    icon: "🎣",
    color: "#87c9d2",
    duration: 60,
    target: 40,
    buttons: [
      ["left", "◀"],
      ["action", "針を下ろす"],
      ["right", "▶"],
    ],
    hint: "左右で位置を合わせて針を下ろす。魚をつかまえたら引き上げるよ！",
    init(g) {
      g.x = 360;
      g.hookY = 80;
      g.hookState = "ready";
      g.catch = null;
      g.fish = Array.from({ length: 9 }, (_, i) => ({
        x: rnd(g, 60, 660),
        y: 170 + (i % 3) * 90,
        vx: (i % 2 ? 1 : -1) * (45 + i * 4),
        value: i % 3 === 0 ? 10 : 5,
      }));
    },
    update(g, dt) {
      if (g.hookState === "ready") aim(g, dt, 250);
      for (const f of g.fish) {
        f.x += f.vx * dt;
        if (f.x < 35 || f.x > 685) f.vx = -f.vx;
      }
      if (g.hookState === "down") {
        g.hookY += 140 * dt;
        let f = g.fish.find((f) => Math.abs(f.x - g.x) < 27 && Math.abs(f.y - g.hookY) < 18);
        if (f) {
          g.catch = f;
          g.fish.splice(g.fish.indexOf(f), 1);
          g.hookState = "up";
        }
        if (g.hookY > 430) g.hookState = "up";
      } else if (g.hookState === "up") {
        g.hookY -= 190 * dt;
        if (g.hookY <= 80) {
          if (g.catch) {
            good(g, g.catch.value, "魚をゲット！");
            g.fish.push({ ...g.catch, x: rnd(g, 60, 660) });
          }
          g.catch = null;
          g.hookState = "ready";
          g.hookY = 80;
        }
      }
      if (g.score >= 40) g.finish(true, "大漁！");
    },
    key(g, k, d) {
      if (k === "action" && d && g.hookState === "ready") g.hookState = "down";
    },
    pointer(g, p) {
      if (g.hookState === "ready") arrows(g, p);
    },
    draw(g, c) {
      rect(c, 0, 95, 720, 385, "#235c76");
      for (let i = 0; i < 18; i++) {
        const x = i * 43,
          y = 120 + ((i * 77 + g.age * 16) % 330);
        circle(c, x, y, 2 + (i % 3), "#91c9d555");
      }
      for (const f of g.fish) {
        c.fillStyle = f.value === 10 ? "#e1bd86" : "#9ac9c4";
        c.beginPath();
        c.ellipse(f.x, f.y, 22, 12, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(f.x + 17, f.y);
        c.lineTo(f.x + 35, f.y - 12);
        c.lineTo(f.x + 35, f.y + 12);
        c.fill();
        circle(c, f.x - 9, f.y - 2, 2, "#274453");
      }
      line(c, { x: g.x, y: 45 }, { x: g.x, y: g.hookY }, "#c7e1e5", 2);
      text(c, "J", g.x, g.hookY + 12, 22);
      if (g.catch) circle(c, g.x, g.hookY + 20, 14, "#e1bd86");
    },
  });
  function pusherEdge(g) {
    return 318 + Math.sin(g.age * 2.1) * 15;
  }
  add({
    id: "pusher",
    name: "コインプッシャー",
    icon: "🪙",
    color: "#ddc48f",
    duration: 60,
    target: 20,
    buttons: [
      ["left", "◀"],
      ["right", "▶"],
      ["action", "コイン投入"],
    ],
    hint: "押し板は自動で前後に動くよ。左右で投入位置を合わせ、コインを入れて手前へ押し落とそう！",
    init(g) {
      g.x = 360;
      g.coins = Array.from({ length: 65 }, (_, i) => ({
        x: 100 + (i % 13) * 40,
        y: 330 + Math.floor(i / 13) * 22,
        vy: 0,
      }));
      g.supply = 30;
      g.cooldown = 0;
    },
    update(g, dt) {
      aim(g, dt);
      g.cooldown = Math.max(0, g.cooldown - dt);
      const shelf = pusherEdge(g);
      for (const c of g.coins) {
        if (c.vy) {
          c.vy += 220 * dt;
          c.y += c.vy * dt;
          if (g.coins.some((o) => o !== c && Math.hypot(c.x - o.x, c.y - o.y) < 22)) c.vy = 0;
        } else if (c.y < shelf + 11) c.y = shelf + 11;
        if (c.y > 435) {
          c.out = true;
          good(g, 1, "コインが落ちた！");
        }
      }
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i < g.coins.length; i++)
          for (let j = i + 1; j < g.coins.length; j++) {
            let a = g.coins[i],
              b = g.coins[j],
              dx = b.x - a.x,
              dy = b.y - a.y,
              d = Math.hypot(dx, dy);
            if (d < 21 && d > 0.01) {
              let k = (21 - d) * 0.5;
              a.x = clamp(a.x - (dx / d) * k, 75, 645);
              a.y -= (dy / d) * k;
              b.x = clamp(b.x + (dx / d) * k, 75, 645);
              b.y += (dy / d) * k;
            }
          }
      g.coins = g.coins.filter((c) => !c.out);
      if (g.score >= 20) g.finish(true, "コインタワー攻略！");
    },
    key(g, k, d) {
      if (k === "action" && d && g.supply > 0 && g.cooldown <= 0) {
        g.coins.push({ x: g.x, y: 150, vy: 180 });
        g.supply--;
        g.cooldown = 0.25;
      }
    },
    pointer: arrows,
    draw(g, c) {
      rect(c, 65, 100, 590, 350, "#3d5361");
      const edge = pusherEdge(g);
      rect(c, 75, edge - 34, 570, 34, "#a7b9c5");
      line(c, { x: 75, y: edge }, { x: 645, y: edge }, "#e1edf1", 3);
      text(
        c,
        Math.cos(g.age * 2.1) >= 0 ? "自動で押す ↓" : "自動で戻る ↑",
        360,
        edge - 48,
        18,
        "#d4e9ed",
      );
      rect(c, 65, 435, 590, 15, "#112b3f");
      for (const o of g.coins) {
        circle(c, o.x, o.y, 10, "#d6b775");
        circle(c, o.x, o.y, 6, "#f1d899");
      }
      text(c, "▼", g.x, 90, 28, "#f4d992");
      text(c, "残り " + g.supply + "枚", 360, 45);
    },
  });
  add({
    id: "stack",
    name: "バランスタワー",
    icon: "🏗️",
    color: "#a6d2c0",
    duration: 65,
    target: 10,
    buttons: [["action", "積む！"]],
    hint: "動くブロックを下のブロックに重ねて止める。はみ出すと幅が小さくなる！",
    init(g) {
      g.width = 230;
      g.center = 360;
      g.level = 0;
      g.x = 160;
      g.dir = 1;
      g.layers = [];
    },
    update(g, dt) {
      g.x += g.dir * (145 + g.level * 18) * dt;
      if (g.x < 80 + g.width / 2 || g.x > 640 - g.width / 2) {
        g.x = clamp(g.x, 80 + g.width / 2, 640 - g.width / 2);
        g.dir = -g.dir;
      }
    },
    key(g, k, d) {
      if (k !== "action" || !d) return;
      let l = Math.max(g.x - g.width / 2, g.center - g.width / 2),
        r = Math.min(g.x + g.width / 2, g.center + g.width / 2);
      if (r <= l) {
        g.finish(false, "タワーがくずれた！");
        return;
      }
      g.width = r - l;
      g.center = (l + r) / 2;
      g.layers.push({ x: g.center, w: g.width });
      g.level++;
      good(g, 1, "高さ " + g.level);
      if (g.level >= 10) g.finish(true, "10段タワー完成！");
      else {
        g.x = g.dir > 0 ? 80 + g.width / 2 : 640 - g.width / 2;
      }
    },
    pointer(g, p) {
      if (p.phase === "down") this.key(g, "action", true);
    },
    draw(g, c) {
      rect(c, 245, 440, 230, 20, "#7692a3");
      for (let i = 0; i < g.layers.length; i++)
        rect(
          c,
          g.layers[i].x - g.layers[i].w / 2,
          420 - i * 30,
          g.layers[i].w,
          27,
          ["#8fcebf", "#a5bde6", "#d5b58a"][i % 3],
        );
      rect(c, g.x - g.width / 2, 420 - g.level * 30, g.width, 27, "#e4c99b");
      text(c, g.level + " / 10段", 360, 40);
    },
  });
  add({
    id: "maze",
    name: "ころころ迷路",
    icon: "🔵",
    color: "#a7cbe3",
    duration: 75,
    target: 50,
    buttons: [
      ["left", "◀"],
      ["up", "▲"],
      ["down", "▼"],
      ["right", "▶"],
    ],
    hint: "ボタンや画面タッチで球を転がす。星を2個以上取って右上の出口へ！",
    init(g) {
      g.ball = { x: 65, y: 420, vx: 0, vy: 0 };
      g.walls = [
        { x: 145, y: 130, w: 25, h: 280 },
        { x: 260, y: 70, w: 25, h: 265 },
        { x: 380, y: 190, w: 25, h: 250 },
        { x: 500, y: 65, w: 25, h: 250 },
      ];
      g.stars = [
        { x: 215, y: 380 },
        { x: 335, y: 110 },
        { x: 565, y: 365 },
      ];
      g.pointerTarget = null;
    },
    update(g, dt) {
      let b = g.ball,
        ax = ((g.held.has("right") ? 1 : 0) - (g.held.has("left") ? 1 : 0)) * 450,
        ay = ((g.held.has("down") ? 1 : 0) - (g.held.has("up") ? 1 : 0)) * 450;
      if (g.pointerTarget) {
        ax = clamp((g.pointerTarget.x - b.x) * 6, -450, 450);
        ay = clamp((g.pointerTarget.y - b.y) * 6, -450, 450);
      }
      b.vx = (b.vx + ax * dt) * Math.exp(-3 * dt);
      b.vy = (b.vy + ay * dt) * Math.exp(-3 * dt);
      const hit = (x, y) => g.walls.some((w) => over({ x: x - 12, y: y - 12, w: 24, h: 24 }, w));
      let nx = clamp(b.x + b.vx * dt, 35, 685),
        ny = clamp(b.y + b.vy * dt, 35, 445);
      if (!hit(nx, b.y)) b.x = nx;
      else b.vx = -b.vx * 0.3;
      if (!hit(b.x, ny)) b.y = ny;
      else b.vy = -b.vy * 0.3;
      for (const st of g.stars)
        if (!st.dead && dist(st, b) < 25) {
          st.dead = true;
          good(g, 10, "星ゲット！");
        }
      if (b.x > 625 && b.y < 90 && g.score >= 20) {
        good(g, 30);
        g.finish(true, "迷路を脱出！");
      }
    },
    pointer(g, p) {
      g.pointerTarget = p.phase === "up" ? null : p;
    },
    draw(g, c) {
      rect(c, 20, 20, 680, 440, "#30485d");
      for (const w of g.walls) rect(c, w.x, w.y, w.w, w.h, "#8ba4b4");
      rect(c, 625, 25, 65, 65, "#7bac98");
      text(c, "EXIT", 657, 65, 15);
      for (const st of g.stars) if (!st.dead) text(c, "★", st.x, st.y + 10, 28, "#f3d798");
      circle(c, g.ball.x, g.ball.y, 12, "#b9dbea");
    },
  });
  add({
    id: "slice",
    name: "フルーツスラッシュ",
    icon: "🍉",
    color: "#edb8b0",
    duration: 45,
    target: 150,
    buttons: [],
    hint: "画面をスワイプしてフルーツを切ろう！ 黒い爆弾は避ける。",
    init(g) {
      g.fruit = [];
      g.spawn = 0.2;
      g.lives = 5;
      g.lastPoint = null;
      g.trail = [];
    },
    update(g, dt) {
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = 0.65;
        g.fruit.push({
          x: rnd(g, 80, 640),
          y: 520,
          vx: rnd(g, -60, 60),
          vy: -rnd(g, 410, 490),
          bad: g.random() < 0.17,
          kind: Math.floor(g.random() * 3),
          cut: false,
        });
      }
      for (const f of g.fruit) {
        f.vy += 410 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      g.fruit = g.fruit.filter((f) => f.y < 550);
      g.trail = g.trail.filter((p) => (p.life -= dt) > 0);
    },
    pointer(g, p) {
      if (p.phase === "up") {
        g.lastPoint = null;
        return;
      }
      let old = g.lastPoint || p;
      g.trail.push({ ...p, life: 0.2 });
      for (const f of g.fruit)
        if (!f.cut && segmentDistance(f, old, p) < 29) {
          f.cut = true;
          f.bad ? hurt(g, "爆弾に注意！") : good(g, 10, "スパッ！");
        }
      g.lastPoint = p;
    },
    draw(g, c) {
      for (const f of g.fruit)
        if (!f.cut) {
          circle(
            c,
            f.x,
            f.y,
            25,
            f.bad ? "#344558" : ["#d79b6c", "#cd8395", "#9dba78"][f.kind || 0],
          );
          if (f.bad) {
            line(c, { x: f.x + 10, y: f.y - 20 }, { x: f.x + 24, y: f.y - 33 }, "#ccb98f", 4);
            text(c, "✕", f.x, f.y + 9, 23, "#eed1a2");
          } else {
            line(c, { x: f.x, y: f.y - 25 }, { x: f.x + 3, y: f.y - 35 }, "#769567", 4);
            circle(c, f.x - 8, f.y - 9, 4, "#f6e7be66");
          }
        }
      for (let i = 1; i < g.trail.length; i++) line(c, g.trail[i - 1], g.trail[i], "#c5fff0", 5);
    },
  });
  function segmentDistance(p, a, b) {
    let dx = b.x - a.x,
      dy = b.y - a.y,
      l = dx * dx + dy * dy,
      t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  add({
    id: "pong",
    name: "ビデオテニス",
    icon: "🏓",
    color: "#acd6c5",
    duration: 90,
    target: 5,
    buttons: [
      ["up", "▲"],
      ["down", "▼"],
    ],
    hint: "左のパドルを上下に動かすか、画面をなぞる。CPUより先に5点！",
    init(g) {
      g.y = 240;
      g.ai = 240;
      g.ball = { x: 360, y: 240, vx: -220, vy: 100 };
      g.cpu = 0;
      g.pause = 0.5;
    },
    update(g, dt) {
      g.y = clamp(
        g.y + ((g.held.has("down") ? 1 : 0) - (g.held.has("up") ? 1 : 0)) * 300 * dt,
        55,
        425,
      );
      let b = g.ball;
      g.ai += clamp(b.y - g.ai, -145 * dt, 145 * dt);
      g.ai = clamp(g.ai, 55, 425);
      if (g.pause > 0) {
        g.pause -= dt;
        return;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < 15 || b.y > 465) {
        b.y = clamp(b.y, 15, 465);
        b.vy = -b.vy;
      }
      if (b.vx < 0 && b.x < 60 && b.x > 34 && Math.abs(b.y - g.y) < 60) {
        b.x = 61;
        b.vx = Math.abs(b.vx) * 1.03;
        b.vy = (b.y - g.y) * 4;
      }
      if (b.vx > 0 && b.x > 660 && b.x < 686 && Math.abs(b.y - g.ai) < 60) {
        b.x = 659;
        b.vx = -Math.abs(b.vx) * 1.03;
        b.vy = (b.y - g.ai) * 4;
      }
      if (b.x < 0 || b.x > 720) {
        if (b.x > 720) good(g, 1, "ポイント！");
        else {
          g.cpu++;
          g.notice = "CPUポイント";
          g.flash = 0.5;
        }
        g.ball = { x: 360, y: 240, vx: g.score > g.cpu ? -220 : 220, vy: rnd(g, -140, 140) };
        g.pause = 0.7;
      }
      if (g.score >= 5 || g.cpu >= 5)
        g.finish(g.score >= 5, g.score >= 5 ? "5点先取！" : "CPUの勝ち！");
    },
    pointer(g, p) {
      g.y = clamp(p.y, 55, 425);
    },
    draw(g, c) {
      line(c, { x: 360, y: 0 }, { x: 360, y: 480 }, "#4d6a7e", 3);
      rect(c, 38, g.y - 50, 14, 100, "#a8e1cd");
      rect(c, 668, g.ai - 50, 14, 100, "#dda4b2");
      circle(c, g.ball.x, g.ball.y, 10, "#efdfb5");
      text(c, g.score + " − " + g.cpu, 360, 60, 35);
    },
  });
  add({
    id: "cannon",
    name: "キャノンチャレンジ",
    icon: "💥",
    color: "#d5bd9d",
    duration: 65,
    target: 30,
    buttons: [
      ["left", "角度 −"],
      ["action", "発射"],
      ["right", "角度 ＋"],
    ],
    hint: "砲台の角度を調整して、遠くの箱を撃とう。8発で3ヒット！",
    init(g) {
      g.angle = 40;
      g.ball = null;
      g.round = 0;
      g.targetX = rnd(g, 460, 650);
    },
    update(g, dt) {
      g.angle = clamp(
        g.angle + ((g.held.has("right") ? 1 : 0) - (g.held.has("left") ? 1 : 0)) * 35 * dt,
        18,
        76,
      );
      if (g.ball) {
        let b = g.ball,
          oldY = b.y;
        b.vy += 400 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y >= 410 && oldY < 410 && b.vy > 0) {
          if (Math.abs(b.x - g.targetX) < 37) {
            good(g, 10, "命中！");
            g.targetX = rnd(g, 460, 650);
          } else {
            g.notice = "はずれ！ 角度を変えてみよう";
            g.flash = 0.7;
          }
          g.ball = null;
          g.round++;
          endRounds(g, 8, 30);
        } else if (b.x > 770) {
          g.ball = null;
          g.round++;
          endRounds(g, 8, 30);
        }
      }
    },
    key(g, k, d) {
      if (k === "action" && d && !g.ball) {
        let a = (g.angle * Math.PI) / 180;
        g.ball = { x: 85, y: 400, vx: Math.cos(a) * 500, vy: -Math.sin(a) * 500 };
      }
    },
    draw(g, c) {
      rect(c, 0, 430, 720, 50, "#746955");
      rect(c, g.targetX - 25, 375, 50, 55, "#c6a174");
      let a = (g.angle * Math.PI) / 180;
      line(
        c,
        { x: 80, y: 410 },
        { x: 80 + Math.cos(a) * 55, y: 410 - Math.sin(a) * 55 },
        "#b1c6cd",
        17,
      );
      circle(c, 80, 425, 21, "#536d7e");
      if (g.ball) circle(c, g.ball.x, g.ball.y, 8, "#ecdbb5");
      text(c, Math.round(g.angle) + "° / " + g.round + "発", 360, 45, 25);
    },
  });
  function createGame(id, random = Math.random) {
    const def = definitions.find((d) => d.id === id);
    if (!def) throw Error("Unknown cabinet " + id);
    const g = {
      id,
      def,
      random,
      state: "ready",
      age: 0,
      time: def.duration,
      score: 0,
      lives: 0,
      held: new Set(),
      notice: "",
      flash: 0,
      invulnerable: 0,
      result: "",
      start() {
        this.state = "playing";
        this.age = 0;
        this.time = def.duration;
        this.score = 0;
        this.lives = 0;
        this.held.clear();
        this.notice = "";
        this.flash = 0;
        this.invulnerable = 0;
        this.result = "";
        def.init(this);
      },
      finish(win, note) {
        if (this.state !== "playing") return;
        this.state = "done";
        this.win = win;
        this.result = note;
        this.held.clear();
        this.charging = false;
      },
      update(dt) {
        if (this.state !== "playing") return;
        dt = clamp(dt, 0, 0.04);
        this.age += dt;
        this.time = Math.max(0, this.time - dt);
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.flash = Math.max(0, this.flash - dt);
        def.update(this, dt);
        if (this.state === "playing" && this.time <= 0)
          this.finish(
            this.score >= def.target,
            this.score >= def.target ? "目標クリア！" : "タイムアップ！",
          );
      },
      key(k, down) {
        if (this.state !== "playing") return;
        if (down) this.held.add(k);
        else this.held.delete(k);
        if (def.key) def.key.call(def, this, k, down);
      },
      pointer(x, y, phase = "down") {
        if (this.state !== "playing") return;
        if (def.pointer)
          def.pointer.call(def, this, { x: clamp(x, 0, W), y: clamp(y, 0, H), phase });
      },
      draw(c) {
        rect(c, 0, 0, W, H, "#142738");
        if (this.state === "ready") {
          text(c, def.icon, 360, 185, 75);
          text(c, def.name, 360, 255, 32);
          text(c, "スタートで遊ぼう！", 360, 310, 21, "#b8d4dc");
          return;
        }
        def.draw(this, c);
        const shade = c.createRadialGradient(360, 220, 80, 360, 240, 450);
        shade.addColorStop(0, "#06142100");
        shade.addColorStop(1, "#06142155");
        c.fillStyle = shade;
        c.fillRect(0, 0, W, H);
        if (this.flash > 0) text(c, this.notice, 360, 474, 17, "#fff0c4");
        if (this.state === "done") {
          rect(c, 75, 135, 570, 195, "#162d45ee");
          text(c, this.win ? "CLEAR!" : "FINISH", 360, 190, 40, this.win ? "#a8edd3" : "#edc6b0");
          text(c, this.result, 360, 235, 23);
          text(c, this.score + "点", 360, 285, 31);
        }
      },
    };
    return g;
  }
  window.ArcadeVideo = { definitions, createGame, W, H };
})();
