// スネークバトルオンライン: ゲームのルールと計算（サーバー側）
//
// サーバーが 1 秒に 20 回 tick() を呼んで、ヘビの動き・当たり判定・CPU・アイテムを計算する。
// 画面側は計算結果（snapshot）を受け取って描くだけなので、ずるやズレが起きにくい。
// このファイルは Cloudflare に依存しないので、node で直接テストできる。

export const TICK_MS = 50;
const DT = TICK_MS / 1000;

export const COLORS = [
  "#4fc3ff", "#ff4d6d", "#5dff87", "#ffd84d",
  "#b06cff", "#ff8d3b", "#ff5ce1", "#4de1d2",
];
const WHITE = 8; // エサの色番号（COLORS の外 = 白）

export const ARENA_RADIUS = { s: 1500, m: 2200, l: 3000 };
const FOOD_CAP = { s: 260, m: 480, l: 800 };
const ROCK_COUNT = { s: 6, m: 10, l: 14 };
const ITEM_CAP = { s: 4, m: 6, l: 9 };

export const ITEM_TYPES = ["speed", "shield", "magnet", "ghost", "apple"];
const ITEM_WEIGHTS = [20, 15, 20, 15, 30];
const ITEM_SECONDS = { speed: 5, magnet: 8, ghost: 5 };
const ITEM_SPAWN_SEC = 4;

export const TOTAL_SNAKES = 10;
const SURVIVAL_LIMIT_SEC = 5 * 60;

const BASE_LEN = 260;
const LEN_PER_MASS = 2.6;
const MAX_LEN = 5000;
export const METERS_PER_UNIT = 1 / 32;
const SPEED = 170;
const BOOST_SPEED = 290;
const BOOST_COST = 5;          // 1秒あたりに減る量
const RESPAWN_SEC = 5;
const PROTECT_SEC = 2;
const MAGNET_RANGE = 200;
const CELL = 128;

// snapshot の flags
export const F = { BOOST: 1, SHIELD: 2, GHOST: 4, SPEED: 8, MAGNET: 16, PROTECT: 32, DEAD: 64 };

const CPU_LEVELS = {
  easy:   { think: [0.5, 0.9],  avoid: 0.6, look: 3, boost: 0.02, hunt: 0 },
  normal: { think: [0.25, 0.5], avoid: 0.9, look: 5, boost: 0.06, hunt: 0.15 },
  hard:   { think: [0.15, 0.3], avoid: 1.0, look: 7, boost: 0.12, hunt: 0.45 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

export class Game {
  // settings: { mode: "time"|"survival", minutes, size: "s"|"m"|"l", rocks: bool, cpu: "easy"|"normal"|"hard" }
  // players: [{ id, name, color }]  color は COLORS の番号
  constructor(settings, players) {
    this.settings = settings;
    this.mode = settings.mode;
    this.R = ARENA_RADIUS[settings.size] ?? ARENA_RADIUS.m;
    this.foodCap = FOOD_CAP[settings.size] ?? FOOD_CAP.m;
    this.itemCap = ITEM_CAP[settings.size] ?? ITEM_CAP.m;
    this.duration = this.mode === "time" ? settings.minutes * 60 : SURVIVAL_LIMIT_SEC;
    this.t = 0;
    this.over = false;
    this.nextFoodId = 1;
    this.nextItemId = 1;
    this.itemTimer = 1;
    this.food = new Map();
    this.items = new Map();
    this.rocks = settings.rocks ? this.makeRocks(ROCK_COUNT[settings.size] ?? 10) : [];
    this.resetDeltas();

    this.snakes = [];
    const used = new Set(players.map((p) => p.color));
    for (const p of players) {
      this.snakes.push(this.makeSnake(this.snakes.length, p.id, p.name, p.color, false));
    }
    const freeColors = COLORS.map((_, i) => i).filter((i) => !used.has(i));
    for (let n = 1; this.snakes.length < TOTAL_SNAKES; n++) {
      const color = freeColors.length ? freeColors[(n - 1) % freeColors.length] : (n % COLORS.length);
      this.snakes.push(this.makeSnake(this.snakes.length, `cpu${n}`, `CPU ${n}`, color, true));
    }
    for (const s of this.snakes) this.spawn(s);
    this.buildGrid(); // CPU は前回の tick のマス目を見て判断する

    while (this.food.size < this.foodCap) this.addFood();
    for (let i = 0; i < Math.ceil(this.itemCap / 2); i++) this.addItem();
    this.resetDeltas(); // 最初の分は start メッセージで丸ごと送る
  }

  makeSnake(idx, id, name, color, cpu) {
    return {
      idx, id, name, color, cpu,
      x: 0, y: 0, angle: 0, target: 0, boost: false,
      mass: 0, r: 14, len: BASE_LEN, body: [], skip: 0,
      alive: false, gen: 0, left: false,
      deadAt: 0, deathX: 0, deathY: 0,
      protectUntil: 0, shield: false, speedUntil: 0, magnetUntil: 0, ghostUntil: 0,
      dropTimer: 0,
      ai: { timer: 0, goal: 0, boostUntil: 0 },
      stats: { kills: 0, items: 0, boostTime: 0, deaths: 0, bestLife: 0, lifeStart: 0, maxLen: BASE_LEN, deathT: Infinity },
    };
  }

  makeRocks(count) {
    const rocks = [];
    for (let tries = 0; rocks.length < count && tries < 500; tries++) {
      const d = rand(0.25, 0.85) * this.R;
      const a = rand(0, Math.PI * 2);
      const r = rand(50, 110);
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      if (rocks.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 160)) {
        rocks.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r) });
      }
    }
    return rocks;
  }

  // ---------- 出現 ----------

  safeSpot(margin) {
    let best = null;
    let bestScore = -1;
    for (let tries = 0; tries < 40; tries++) {
      const d = Math.sqrt(Math.random()) * this.R * 0.75;
      const a = rand(0, Math.PI * 2);
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      if (this.rocks.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + margin)) continue;
      let nearest = Infinity;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        for (let i = 0; i < s.body.length; i += 4) {
          nearest = Math.min(nearest, Math.hypot(s.body[i].x - x, s.body[i].y - y));
        }
      }
      if (nearest > 500) return { x, y };
      if (nearest > bestScore) { bestScore = nearest; best = { x, y }; }
    }
    return best ?? { x: 0, y: 0 };
  }

  spawn(s) {
    const p = this.safeSpot(120);
    s.x = p.x;
    s.y = p.y;
    // だいたい中心のほうを向いて出てくる
    s.angle = Math.atan2(-p.y, -p.x) + rand(-0.8, 0.8);
    s.target = s.angle;
    s.mass = 0;
    s.r = 14;
    s.len = BASE_LEN;
    s.body = [];
    for (let d = 0; d <= s.len; d += 8) {
      s.body.push({ x: s.x - Math.cos(s.angle) * d, y: s.y - Math.sin(s.angle) * d });
    }
    s.alive = true;
    s.gen++;
    s.boost = false;
    s.protectUntil = this.t + PROTECT_SEC;
    s.shield = false;
    s.speedUntil = s.magnetUntil = s.ghostUntil = 0;
    s.stats.lifeStart = this.t;
    s.ai.timer = 0;
  }

  addFood(x, y, value = 1, color = WHITE, size) {
    if (x === undefined) {
      for (let tries = 0; tries < 10; tries++) {
        const d = Math.sqrt(Math.random()) * (this.R - 40);
        const a = rand(0, Math.PI * 2);
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
        if (!this.rocks.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 10)) break;
      }
      color = Math.random() < 0.3 ? Math.floor(Math.random() * COLORS.length) : WHITE;
    }
    if (Math.hypot(x, y) > this.R - 10) return;
    const s = size ?? clamp(3 + value * 1.6, 3, 16) + rand(0, 2);
    const f = { id: this.nextFoodId++, x: Math.round(x), y: Math.round(y), s: Math.round(s * 10) / 10, v: value, c: color };
    this.food.set(f.id, f);
    this.delta.fa.push([f.id, f.x, f.y, f.s, f.c]);
  }

  addItem() {
    let total = ITEM_WEIGHTS.reduce((a, b) => a + b, 0);
    let pick = Math.random() * total;
    let type = 0;
    while (pick >= ITEM_WEIGHTS[type]) pick -= ITEM_WEIGHTS[type++];
    for (let tries = 0; tries < 20; tries++) {
      const d = Math.sqrt(Math.random()) * (this.R - 120);
      const a = rand(0, Math.PI * 2);
      const x = Math.round(Math.cos(a) * d);
      const y = Math.round(Math.sin(a) * d);
      if (this.rocks.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 60)) continue;
      const it = { id: this.nextItemId++, x, y, type };
      this.items.set(it.id, it);
      this.delta.ia.push([it.id, x, y, type]);
      return;
    }
  }

  // ---------- 入力 ----------

  input(id, angle, boost) {
    const s = this.snakes.find((q) => q.id === id && !q.cpu);
    if (!s || !Number.isFinite(angle)) return;
    s.target = angle;
    s.boost = !!boost;
  }

  playerLeft(id) {
    const s = this.snakes.find((q) => q.id === id && !q.cpu);
    if (!s || s.left) return;
    s.left = true;
    if (s.alive) this.kill(s, null, "left");
    this.events.push(["L", s.idx]);
  }

  // ---------- 1回分の計算 ----------

  tick() {
    if (this.over) return;
    this.t += DT;

    for (const s of this.snakes) {
      if (!s.alive) {
        if (this.mode === "time" && !s.left && this.t >= s.deadAt + RESPAWN_SEC) {
          this.spawn(s);
          this.events.push(["r", s.idx]);
        }
        continue;
      }
      if (s.cpu) this.cpuThink(s);
      this.move(s);
    }

    this.buildGrid();
    this.collide();
    this.eat();

    // エサとアイテムの補充
    for (let n = 0; n < 6 && this.food.size < this.foodCap; n++) this.addFood();
    this.itemTimer -= DT;
    if (this.itemTimer <= 0) {
      this.itemTimer = ITEM_SPAWN_SEC;
      if (this.items.size < this.itemCap) this.addItem();
    }

    this.checkEnd();
  }

  move(s) {
    const speedItem = this.t < s.speedUntil;
    const canBoost = s.boost && s.mass > 2;
    let speed = speedItem ? BOOST_SPEED : canBoost ? BOOST_SPEED : SPEED;
    if (canBoost && !speedItem) {
      s.mass = Math.max(0, s.mass - BOOST_COST * DT);
      s.stats.boostTime += DT;
      s.dropTimer += DT;
      if (s.dropTimer > 0.35) {
        s.dropTimer = 0;
        const tail = s.body[s.body.length - 1];
        if (tail) this.addFood(tail.x, tail.y, 1, s.color);
      }
    } else if (speedItem && s.boost) {
      s.stats.boostTime += DT;
    }

    const turn = (3.4 / (1 + (s.r - 14) / 45)) * (speed > SPEED ? 0.85 : 1);
    s.angle += clamp(angleDiff(s.angle, s.target), -turn * DT, turn * DT);
    s.angle = Math.atan2(Math.sin(s.angle), Math.cos(s.angle)); // -π〜π に収める
    s.x += Math.cos(s.angle) * speed * DT;
    s.y += Math.sin(s.angle) * speed * DT;

    s.len = Math.min(MAX_LEN, BASE_LEN + s.mass * LEN_PER_MASS);
    s.r = Math.min(46, 14 + Math.sqrt(s.mass) * 0.55);
    s.stats.maxLen = Math.max(s.stats.maxLen, s.len);

    // からだ: 頭の位置を先頭に足して、長さを超えた分を切る
    s.body.unshift({ x: s.x, y: s.y });
    let dist = 0;
    s.skip = 0;
    for (let i = 1; i < s.body.length; i++) {
      dist += Math.hypot(s.body[i].x - s.body[i - 1].x, s.body[i].y - s.body[i - 1].y);
      if (dist < s.r * 1.6) s.skip = i + 1;
      if (dist > s.len) {
        s.body.length = i + 1;
        break;
      }
    }
  }

  // からだの点をマス目に分けて、当たり判定を速くする
  buildGrid() {
    this.grid = new Map();
    for (const s of this.snakes) {
      if (!s.alive || this.intangible(s)) continue;
      for (let i = s.skip; i < s.body.length; i++) {
        const p = s.body[i];
        const key = this.cellKey(p.x, p.y);
        let list = this.grid.get(key);
        if (!list) this.grid.set(key, (list = []));
        list.push(p.x, p.y, s.idx);
      }
    }
  }

  cellKey(x, y) {
    return (Math.floor(x / CELL) + 64) * 256 + (Math.floor(y / CELL) + 64);
  }

  // 半径 range の中にある、ほかのヘビのからだの点を探す
  nearestBody(x, y, range, selfIdx) {
    const c0x = Math.floor((x - range) / CELL), c1x = Math.floor((x + range) / CELL);
    const c0y = Math.floor((y - range) / CELL), c1y = Math.floor((y + range) / CELL);
    let hit = null;
    let bestOverlap = 0;
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const list = this.grid.get((cx + 64) * 256 + (cy + 64));
        if (!list) continue;
        for (let i = 0; i < list.length; i += 3) {
          const owner = list[i + 2];
          if (owner === selfIdx) continue;
          const other = this.snakes[owner];
          const reach = range + other.r * 0.8 - Math.hypot(list[i] - x, list[i + 1] - y);
          if (reach > bestOverlap) { bestOverlap = reach; hit = other; }
        }
      }
    }
    return hit;
  }

  intangible(s) {
    return this.t < s.protectUntil || this.t < s.ghostUntil;
  }

  collide() {
    const deaths = [];
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const protectedNow = this.t < s.protectUntil;
      const ghost = this.t < s.ghostUntil;

      // ステージの外枠（すりぬけ中でもアウト）
      if (Math.hypot(s.x, s.y) > this.R - s.r) {
        if (protectedNow || this.useShield(s, true)) continue;
        deaths.push([s, null, "wall"]);
        continue;
      }
      if (protectedNow || ghost) continue;

      if (this.rocks.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < o.r + s.r * 0.8)) {
        if (!this.useShield(s, false)) deaths.push([s, null, "rock"]);
        continue;
      }

      // 頭どうし: 短いほうの負け
      let headLoss = null;
      for (const o of this.snakes) {
        if (o === s || !o.alive || this.intangible(o)) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) < (o.r + s.r) * 0.9 && o.len >= s.len) {
          headLoss = o;
          break;
        }
      }
      if (headLoss) {
        if (!this.useShield(s, false)) deaths.push([s, headLoss, "head"]);
        continue;
      }

      const hit = this.nearestBody(s.x, s.y, s.r * 0.8, s.idx);
      if (hit && !this.useShield(s, false)) deaths.push([s, hit, "body"]);
    }
    for (const [s, killer, cause] of deaths) {
      if (s.alive) this.kill(s, killer, cause);
    }
  }

  // シールドがあれば1回だけ守る。外枠なら内側へ向きを変える
  useShield(s, wall) {
    if (!s.shield) return false;
    s.shield = false;
    s.protectUntil = this.t + 1;
    if (wall) {
      const back = Math.atan2(-s.y, -s.x);
      s.angle = back;
      s.target = back;
      const d = this.R - s.r - 5;
      const h = Math.hypot(s.x, s.y) || 1;
      s.x = (s.x / h) * d;
      s.y = (s.y / h) * d;
    }
    this.events.push(["sb", s.idx]);
    return true;
  }

  kill(s, killer, cause) {
    s.alive = false;
    s.deadAt = this.t;
    s.deathX = s.x;
    s.deathY = s.y;
    s.stats.deaths++;
    s.stats.deathT = this.t;
    s.stats.bestLife = Math.max(s.stats.bestLife, this.t - s.stats.lifeStart);
    if (killer && killer !== s) killer.stats.kills++;
    this.events.push(["k", killer ? killer.idx : -1, s.idx, cause]);

    // からだをエサに変えてばらまく
    const drops = Math.min(60, Math.max(4, Math.floor(s.body.length / 3)));
    const step = Math.max(1, Math.floor(s.body.length / drops));
    const value = Math.max(1, Math.round((s.mass * 0.7 + 10) / drops));
    for (let i = 0; i < s.body.length; i += step) {
      const p = s.body[i];
      this.addFood(p.x + rand(-6, 6), p.y + rand(-6, 6), value, s.color);
    }
    s.body = [];
    s.boost = false;
  }

  eat() {
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const magnet = this.t < s.magnetUntil ? MAGNET_RANGE : 0;
      const reach = s.r + 8 + magnet;
      for (const f of this.food.values()) {
        const dx = f.x - s.x;
        if (dx > reach + f.s || dx < -reach - f.s) continue;
        const dy = f.y - s.y;
        if (dx * dx + dy * dy < (reach + f.s) ** 2) {
          s.mass += f.v;
          this.food.delete(f.id);
          this.delta.fr.push([f.id, s.idx]);
        }
      }
      for (const it of this.items.values()) {
        if (Math.hypot(it.x - s.x, it.y - s.y) < s.r + 30) {
          this.items.delete(it.id);
          this.delta.ir.push([it.id, s.idx]);
          this.applyItem(s, ITEM_TYPES[it.type]);
        }
      }
    }
  }

  applyItem(s, type) {
    s.stats.items++;
    let until = 0;
    if (type === "apple") s.mass += 30;
    else if (type === "shield") s.shield = true;
    else {
      until = this.t + ITEM_SECONDS[type];
      if (type === "speed") s.speedUntil = until;
      if (type === "magnet") s.magnetUntil = until;
      if (type === "ghost") s.ghostUntil = until;
    }
    this.events.push(["i", s.idx, ITEM_TYPES.indexOf(type), Math.round(until * 100) / 100]);
  }

  // ---------- CPU ----------

  // 壁と岩はいつも気をつける。ほかのヘビは CPU の強さによって見落とすこともある
  danger(s, x, y, watchBodies) {
    if (Math.hypot(x, y) > this.R - s.r - 90) return true;
    if (this.t < s.ghostUntil) return false;
    if (this.rocks.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + s.r + 45)) return true;
    return watchBodies && !!this.nearestBody(x, y, s.r + 30, s.idx);
  }

  cpuThink(s) {
    const lv = CPU_LEVELS[this.settings.cpu] ?? CPU_LEVELS.normal;
    const ai = s.ai;
    ai.timer -= DT;

    if (ai.timer <= 0) {
      ai.timer = rand(lv.think[0], lv.think[1]);
      ai.goal = this.cpuGoal(s, lv);
      if (Math.random() < lv.boost && s.mass > 20) ai.boostUntil = this.t + rand(0.4, 1.0);
    }

    // 危ない方向をさける
    let want = ai.goal;
    const watchBodies = Math.random() < lv.avoid;
    const look = [s.r * 2 + 30, s.r * lv.look * 0.5 + 50, s.r * lv.look + 80];
    const offsets = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI];
    for (const off of offsets) {
      const a = want + off;
      const blocked = look.some((d) => this.danger(s, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, watchBodies));
      if (!blocked) { want = a; break; }
    }
    s.target = want;
    s.boost = this.t < ai.boostUntil;
  }

  cpuGoal(s, lv) {
    // つよい CPU は、自分より小さいヘビの頭の前に回りこむ
    if (Math.random() < lv.hunt) {
      let prey = null;
      let best = 450;
      for (const o of this.snakes) {
        if (o === s || !o.alive || o.len >= s.len * 0.9) continue;
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        if (d < best) { best = d; prey = o; }
      }
      if (prey) {
        s.ai.boostUntil = this.t + 0.6;
        return Math.atan2(prey.y + Math.sin(prey.angle) * 140 - s.y, prey.x + Math.cos(prey.angle) * 140 - s.x);
      }
    }
    // アイテムが近ければそれ、なければ近いエサ
    const nearRock = (p) =>
      Math.hypot(p.x, p.y) > this.R - s.r - 110 ||
      this.rocks.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < o.r + s.r + 50);
    let goal = null;
    let best = 600 * 600;
    for (const it of this.items.values()) {
      const d = (it.x - s.x) ** 2 + (it.y - s.y) ** 2;
      if (d < best && !nearRock(it)) { best = d; goal = it; }
    }
    if (!goal) {
      best = 700 * 700;
      let i = 0;
      for (const f of this.food.values()) {
        if (i++ % 3) continue;
        const d = ((f.x - s.x) ** 2 + (f.y - s.y) ** 2) / f.v;
        if (d < best && nearRock(f)) continue;
        if (d < best) { best = d; goal = f; }
      }
    }
    if (goal) return Math.atan2(goal.y - s.y, goal.x - s.x);
    // なにもなければ、中心のほうへ
    return Math.atan2(-s.y, -s.x) + rand(-0.6, 0.6);
  }

  // ---------- おわり ----------

  checkEnd() {
    if (this.t >= this.duration) { this.over = true; return; }
    if (this.mode === "survival") {
      const alive = this.snakes.filter((s) => s.alive);
      const humansAlive = this.snakes.some((s) => s.alive && !s.cpu);
      const anyHuman = this.snakes.some((s) => !s.cpu && !s.left);
      if (alive.length <= 1 || !humansAlive || !anyHuman) this.over = true;
    } else if (!this.snakes.some((s) => !s.cpu && !s.left)) {
      this.over = true;
    }
  }

  ranking() {
    return [...this.snakes].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (this.mode === "survival" && !a.alive) return b.stats.deathT - a.stats.deathT;
      return (b.alive ? b.len : 0) - (a.alive ? a.len : 0);
    });
  }

  results() {
    for (const s of this.snakes) {
      if (s.alive) s.stats.bestLife = Math.max(s.stats.bestLife, this.t - s.stats.lifeStart);
    }
    const ranked = this.ranking();
    const rows = ranked.map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.name,
      color: s.color,
      cpu: s.cpu,
      left: s.left,
      meters: Math.round((s.alive ? s.len : 0) * METERS_PER_UNIT * 10) / 10,
      maxMeters: Math.round(s.stats.maxLen * METERS_PER_UNIT * 10) / 10,
      kills: s.stats.kills,
      items: s.stats.items,
      boostSec: Math.round(s.stats.boostTime),
      deaths: s.stats.deaths,
      bestLife: Math.round(s.stats.bestLife),
    }));

    const titles = [];
    const award = (emoji, title, key, unit, min) => {
      let best = null;
      for (const r of rows) if (r[key] >= min && (!best || r[key] > best[key])) best = r;
      if (best) titles.push({ emoji, title, id: best.id, name: best.name, value: `${best[key]}${unit}` });
    };
    award("⚔️", "撃破王", "kills", "体", 1);
    award("🎁", "アイテム名人", "items", "こ", 1);
    award("⚡", "ダッシュ王", "boostSec", "秒", 2);
    award("🐢", "しぶとい賞", "bestLife", "秒", 1);
    award("📏", "いちばん長くなった", "maxMeters", "m", 0);

    return { mode: this.mode, rows, titles };
  }

  // ---------- 画面に送るデータ ----------

  resetDeltas() {
    this.delta = { fa: [], fr: [], ia: [], ir: [] };
    this.events = [];
  }

  snakeState(s) {
    let flags = 0;
    if (!s.alive) flags |= F.DEAD;
    else {
      if (s.boost && (s.mass > 2 || this.t < s.speedUntil)) flags |= F.BOOST;
      if (this.t < s.speedUntil) flags |= F.SPEED | F.BOOST;
      if (s.shield) flags |= F.SHIELD;
      if (this.t < s.ghostUntil) flags |= F.GHOST;
      if (this.t < s.magnetUntil) flags |= F.MAGNET;
      if (this.t < s.protectUntil) flags |= F.PROTECT;
    }
    const x = s.alive ? s.x : s.deathX;
    const y = s.alive ? s.y : s.deathY;
    return [Math.round(x), Math.round(y), Math.round(s.angle * 100) / 100, Math.round(s.len), Math.round(s.r * 10) / 10, flags, s.gen];
  }

  // 毎回送る差分
  snapshot() {
    const out = {
      t: "s",
      tm: Math.round(this.t * 100) / 100,
      left: Math.max(0, Math.round((this.duration - this.t) * 10) / 10),
      sn: this.snakes.map((s) => this.snakeState(s)),
      ...this.delta,
      ev: this.events,
    };
    this.resetDeltas();
    return out;
  }

  // 途中から見る人・ゲーム開始時に送る全部のデータ
  fullState() {
    return {
      mode: this.mode,
      R: this.R,
      rocks: this.rocks,
      duration: this.duration,
      tm: Math.round(this.t * 100) / 100,
      snakes: this.snakes.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        cpu: s.cpu,
        state: this.snakeState(s),
        body: s.body.filter((_, i) => i % 3 === 0).flatMap((p) => [Math.round(p.x), Math.round(p.y)]),
      })),
      food: [...this.food.values()].map((f) => [f.id, f.x, f.y, f.s, f.c]),
      items: [...this.items.values()].map((it) => [it.id, it.x, it.y, it.type]),
    };
  }
}
