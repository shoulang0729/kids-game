/* In-world monitors and cabinet controls. Playing never changes the camera or opens a game overlay. */
window.createVideoCabinets = function (scene, onMessage, onTone) {
  const $ = (s) => document.querySelector(s),
    catalog = window.ArcadeVideo.definitions,
    games = [],
    controls = [],
    pointers = new Map();
  let inputEnabled = true;
  function best(id) {
    try {
      return Number(localStorage.getItem("kochan-best-" + id)) || 0;
    } catch {
      return 0;
    }
  }
  function persist(g) {
    if (!g.engine) return;
    g.score = Math.max(g.score, g.engine.score);
    if (g.score > best(g.id)) {
      try {
        localStorage.setItem("kochan-best-" + g.id, g.score);
      } catch {}
    }
  }
  function paint(g) {
    g.engine.draw(g.context);
    const c = g.context;
    c.fillStyle = "#112536e8";
    c.fillRect(0, 0, 720, 25);
    c.fillStyle = "#daf1ea";
    c.font = "bold 14px system-ui";
    c.textAlign = "left";
    c.fillText("SCORE " + g.engine.score + " / GOAL " + g.engine.def.target, 12, 18);
    c.textAlign = "right";
    c.fillText(Math.ceil(g.engine.time) + "s  BEST " + Math.max(g.score, g.engine.score), 708, 18);
    g.frame++;
  }
  function addGame(type, offset, slot) {
    const d = catalog.find((d) => d.id === type);
    if (!d) throw Error("Unknown video cabinet");
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 480;
    const g = {
      id: type,
      type: "video",
      offset,
      slot,
      name: d.name,
      hint: d.hint,
      color: d.color,
      icon: d.icon,
      score: best(type),
      state: "idle",
      engine: window.ArcadeVideo.createGame(type),
      canvas,
      context: canvas.getContext("2d"),
      frame: 0,
      paintAge: 0,
      lastScore: 0,
    };
    games.push(g);
    paint(g);
    addControl(g, "start", "START", 1.12, 1.82, "start");
    const n = d.buttons.length;
    d.buttons.forEach(([key, label], i) =>
      addControl(
        g,
        key,
        label,
        n <= 1 ? -0.5 : -1.15 + i * (1.85 / Math.max(1, n - 1)),
        1.82,
        "game-key",
      ),
    );
    return g;
  }
  function enabled(g, key) {
    return (
      inputEnabled &&
      (key === "start" ? g.engine.state !== "playing" : g.engine.state === "playing")
    );
  }
  function addControl(g, key, label, x, z, cls) {
    const el = document.createElement("button");
    el.className = "cabbutton " + cls;
    el.textContent = label;
    el.setAttribute("aria-label", g.name + " " + label);
    $("#worldControls").appendChild(el);
    let ptr = null;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabled(g, key)) return;
      el.setPointerCapture(e.pointerId);
      ptr = e.pointerId;
      el.classList.add("on");
      if (key === "start") start(g);
      else {
        g.engine.key(key, true);
        onTone(340, 0.03);
      }
    });
    el.addEventListener("pointerup", (e) => {
      if (ptr !== e.pointerId) return;
      ptr = null;
      el.classList.remove("on");
      if (key !== "start") g.engine.key(key, false);
    });
    for (const ev of ["pointercancel", "lostpointercapture"])
      el.addEventListener(ev, (e) => {
        if (ptr !== e.pointerId) return;
        ptr = null;
        el.classList.remove("on");
        g.engine.held.delete(key);
        if (key === "action") g.engine.charging = false;
      });
    el.addEventListener("click", (e) => {
      if (e.detail === 0 && enabled(g, key)) {
        if (key === "start") start(g);
        else {
          g.engine.key(key, true);
          g.engine.key(key, false);
        }
      }
    });
    controls.push({ g, key, el, point: [g.offset + x, 0.48, z] });
  }
  function dropGame(g) {
    persist(g);
    for (const [id, p] of pointers) if (p.g === g) pointers.delete(id);
    for (let i = controls.length - 1; i >= 0; i--)
      if (controls[i].g === g) {
        controls[i].el.remove();
        controls.splice(i, 1);
      }
    const i = games.indexOf(g);
    if (i >= 0) games.splice(i, 1);
  }
  function clearInputs() {
    pointers.clear();
    for (const g of games) {
      g.engine.held.clear();
      g.engine.charging = false;
      g.engine.pointerTarget = null;
      g.engine.lastPoint = null;
    }
    for (const b of controls) b.el.classList.remove("on");
  }
  function start(g) {
    if (g.engine.state === "playing") return;
    g.engine.start();
    g.state = "playing";
    g.lastScore = 0;
    paint(g);
    onMessage(g.name + "：" + g.hint + "（店内の視点のまま遊べるよ）");
    onTone(660, 0.1);
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
  function screenPoint(g, e) {
    const p = scene.verticalPoint(e.clientX, e.clientY, 0.12);
    if (!p) return null;
    return { x: ((p.x - g.offset + 1.34) / 2.68) * 720, y: ((2.92 - p.y) / 1.8) * 480 };
  }
  function pointerDown(e) {
    if (!inputEnabled) return false;
    const g = nearest();
    if (!g || g.engine.state !== "playing") return false;
    const p = screenPoint(g, e);
    if (!p || p.x < 0 || p.x > 720 || p.y < 0 || p.y > 480) return false;
    pointers.set(e.pointerId, { g });
    g.engine.pointer(p.x, p.y, "down");
    return true;
  }
  function pointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return false;
    const point = screenPoint(p.g, e);
    if (point) p.g.engine.pointer(point.x, point.y, "move");
    return true;
  }
  function pointerUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const point = screenPoint(p.g, e);
    if (point) p.g.engine.pointer(point.x, point.y, "up");
    pointers.delete(e.pointerId);
  }
  const keymap = {
    ArrowLeft: "left",
    KeyJ: "left",
    ArrowRight: "right",
    KeyK: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Space: "action",
    Enter: "action",
    KeyE: "start",
  };
  function handlesKeys(e) {
    return inputEnabled && !!keymap[e.code] && !!nearest();
  }
  window.addEventListener("keydown", (e) => {
    if (!handlesKeys(e) || e.target?.matches("select,input")) return;
    const g = nearest(),
      k = keymap[e.code];
    e.preventDefault();
    if (e.repeat) return;
    if (k === "start" || (g.engine.state !== "playing" && k === "action")) start(g);
    else g.engine.key(k, true);
  });
  window.addEventListener("keyup", (e) => {
    if (!keymap[e.code]) return;
    for (const g of games)
      if (g.engine.held.has(keymap[e.code])) g.engine.key(keymap[e.code], false);
  });
  window.addEventListener("blur", clearInputs);
  document.addEventListener("visibilitychange", clearInputs);
  function update(dt, paused = false) {
    for (const g of games) {
      if (!paused && !document.hidden) {
        g.engine.update(dt);
        g.state =
          g.engine.state === "playing" ? "playing" : g.engine.state === "done" ? "done" : "idle";
        if (g.engine.score > g.lastScore && scene.distance(g.offset) < 8) {
          onTone(620, 0.04);
          g.lastScore = g.engine.score;
        }
        if (g.state === "done") persist(g);
      }
      g.paintAge += dt;
      if (g.paintAge >= 1 / 30 && scene.distance(g.offset) < 28) {
        paint(g);
        g.paintAge = 0;
      }
    }
  }
  function updateControls(show) {
    inputEnabled = show;
    for (const b of controls) {
      const p = scene.project(b.point);
      b.el.hidden = !(
        show &&
        p &&
        scene.distance(b.g.offset) < 7.5 &&
        scene.player.z > 2.8 &&
        Math.abs(scene.player.x - b.g.offset) < 4.5
      );
      if (p) {
        b.el.style.left = p.x + "px";
        b.el.style.top = p.y + "px";
        b.el.disabled = !enabled(b.g, b.key);
        if (b.key === "start")
          b.el.textContent = b.g.engine.state === "done" ? "もう一度" : "START";
      }
    }
  }
  function status(g) {
    return (
      g.name +
      (g.engine.state === "playing"
        ? " · " +
          g.engine.score +
          "点 · " +
          Math.ceil(g.engine.time) +
          "秒 · 台のボタン／モニターを操作"
        : " · " + g.hint + " · STARTで開始")
    );
  }
  return {
    catalog,
    games,
    addGame,
    dropGame,
    start,
    clearInputs,
    pointerDown,
    pointerMove,
    pointerUp,
    handlesKeys,
    update,
    updateControls,
    status,
    screenPoint,
  };
};
