(function (root) {
  const skills = {
    attack: {
      name: "⚔️ 攻撃",
      damage: [14, 24],
      cooldown: 0,
    },

    fire: {
      name: "🔥 ファイヤー",
      damage: [28, 45],
      cooldown: 2,
    },

    thunder: {
      name: "⚡ サンダー",
      damage: [45, 68],
      cooldown: 3,
    },

    heal: {
      name: "💚 回復",
      heal: 45,
      cooldown: 3,
    },

    ultimate: {
      name: "🌈 必殺技",
      damage: [90, 130],
      cooldown: 5,
    },
  };

  const upgradeCosts = {
    hp: 100,
    attack: 100,
    base: 150,
    robot: 300,
    cannon: 500,
  };

  const weapons = {
    fire: { cost: 300, name: "🔥 炎ソード", bonus: 15 },
    thunder: { cost: 700, name: "⚡ 雷神剣", bonus: 30 },
    cosmo: { cost: 1500, name: "🌌 宇宙剣", bonus: 50 },
    god: { cost: 5000, name: "👑 GOD剣", bonus: 100 },
  };

  const api = { skills, upgradeCosts, weapons };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BattleData = api;
})(globalThis);
