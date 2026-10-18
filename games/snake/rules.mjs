// The original level progression and collision rules, independent of the screen.
export const LEVELS = Object.freeze(
  [
    { grid: 20, speed: 6, obstacles: 0 },
    { grid: 18, speed: 7, obstacles: 2 },
    { grid: 16, speed: 8, obstacles: 3 },
    { grid: 14, speed: 9, obstacles: 5 },
    { grid: 12, speed: 10, obstacles: 7 },
    { grid: 10, speed: 12, obstacles: 9 },
  ].map(Object.freeze),
);

export function createSnakeGame(random = Math.random) {
  const state = {
    grid: 20,
    level: 0,
    speed: 6,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    obstacles: [],
    score: 0,
    alive: false,
  };
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  function cells() {
    const result = [];
    for (let y = 0; y < state.grid; y++)
      for (let x = 0; x < state.grid; x++) result.push({ x, y });
    return result;
  }
  function centerSnake() {
    const c = Math.floor(state.grid / 2);
    state.snake = [
      { x: c, y: c },
      { x: c - 1, y: c },
      { x: c - 2, y: c },
    ];
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
  }
  function applyLevel(level) {
    state.level = Math.max(0, Math.min(LEVELS.length - 1, level));
    const config = LEVELS[state.level];
    state.grid = config.grid;
    state.speed = config.speed;
    if (
      state.snake.some(
        (p) => p.x < 0 || p.y < 0 || p.x >= state.grid || p.y >= state.grid,
      )
    )
      centerSnake();
    const head = state.snake[0];
    const safe = head
      ? [1, 2, 3].map((i) => ({
          x: head.x + state.dir.x * i,
          y: head.y + state.dir.y * i,
        }))
      : [];
    const empty = cells().filter(
      (c) =>
        !state.snake.some((p) => same(p, c)) &&
        !same(state.food, c) &&
        !safe.some((p) => same(p, c)),
    );
    for (let i = empty.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [empty[i], empty[j]] = [empty[j], empty[i]];
    }
    state.obstacles = empty.slice(0, config.obstacles);
  }
  function placeFood() {
    const empty = cells().filter(
      (c) =>
        !state.snake.some((p) => same(p, c)) &&
        !state.obstacles.some((p) => same(p, c)),
    );
    state.food = empty.length
      ? empty[Math.floor(random() * empty.length)]
      : null;
  }
  function reset() {
    applyLevel(0);
    centerSnake();
    state.score = 0;
    state.alive = false;
    placeFood();
  }
  reset();
  return {
    state,
    reset,
    applyLevel,
    placeFood,
    start() {
      reset();
      state.alive = true;
    },
    stop() {
      state.alive = false;
    },
    setDirection(x, y) {
      if (state.dir.x === -x && state.dir.y === -y) return;
      state.nextDir = { x, y };
    },
    step() {
      if (!state.alive) return { ended: false, levelChanged: false };
      state.dir = state.nextDir;
      const head = {
        x: state.snake[0].x + state.dir.x,
        y: state.snake[0].y + state.dir.y,
      };
      // Preserve the existing rule: moving into any body segment, including the
      // current tail, is a collision.
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= state.grid ||
        head.y >= state.grid ||
        state.snake.some((p) => same(p, head)) ||
        state.obstacles.some((p) => same(p, head))
      ) {
        state.alive = false;
        return { ended: true, levelChanged: false };
      }
      state.snake.unshift(head);
      const ate = same(head, state.food);
      const levelChanged = !!ate && (state.score + 10) % 50 === 0;
      if (ate) {
        state.score += 10;
        if (levelChanged) applyLevel(state.level + 1);
        placeFood();
        state.speed = Math.min(24, state.speed + 0.25);
      } else state.snake.pop();
      return { ended: false, ate: !!ate, levelChanged };
    },
  };
}
