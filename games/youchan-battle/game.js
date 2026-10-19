const battleGame = BattleState.createGame(BattleData);
const battle = battleGame.state;
const { skills } = BattleData;
let transitionTimer;
let encounterVersion = 0;

function cancelTransition() {
  clearTimeout(transitionTimer);
  encounterVersion++;
}
function queueTransition(callback, delay) {
  clearTimeout(transitionTimer);
  const version = encounterVersion;
  transitionTimer = setTimeout(() => {
    if (version === encounterVersion) callback();
  }, delay);
}

showSelect();

function hideAll() {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.style.display = "none";
  });
}

function showSelect() {
  cancelTransition();
  battle.battleEnded = true;
  hideAll();

  document.getElementById("selectScreen").style.display = "block";
}

function showStoryMap() {
  cancelTransition();
  battle.battleEnded = true;
  hideAll();

  document.getElementById("mapScreen").style.display = "block";
}

function enterNode(node) {
  battle.currentNode = node;

  if (node === 2) {
    battle.playerMaxHp += 20;

    battle.coins += 200;

    alert("🎁 HPアップ！");

    return;
  }

  if (node === 4) {
    battle.playerHp = battle.playerMaxHp;

    battle.coins += 300;

    alert("💚 全回復！");

    return;
  }

  startStoryBattle(node);
}

function enemySetup(hp, attack, emoji, title) {
  battle.enemyMaxHp = hp;

  battle.enemyHp = hp;

  battle.enemyAttackPower = attack;

  document.getElementById("enemy").innerText = emoji;

  document.getElementById("title").innerText = title;
}

function startStoryBattle(node) {
  globalThis.GamePlays?.record("youchan-battle");
  cancelTransition();
  battle.mode = "story";

  battle.playerHp = battle.playerMaxHp;

  battle.bossPhase = 1;

  baseArea(false);

  resetCooldowns();

  if (node === 1) {
    enemySetup(140, 16, "👾", "🌲 森");
  }

  if (node === 3) {
    enemySetup(230, 22, "💀", "🕳️ 洞窟");
  }

  if (node === 5) {
    enemySetup(280, 24, "👹", "🌋 火山鬼");
  }

  if (node === 6) {
    enemySetup(320, 27, "🐉", "🏰 ドラゴン");
  }

  if (node === 7) {
    enemySetup(340, 25, "👑", "🌌 宇宙魔王");
  }

  startBattle();
}

function startInfinite() {
  globalThis.GamePlays?.record("youchan-battle");
  cancelTransition();
  resetCooldowns();
  battle.mode = "infinite";

  battle.infiniteLevel = 1;

  battle.playerHp = battle.playerMaxHp;

  baseArea(false);

  enemySetup(120, 18, "👾", "♾️ 無限モード");

  startBattle();
}

function startDefense() {
  globalThis.GamePlays?.record("youchan-battle");
  cancelTransition();
  resetCooldowns();
  battle.mode = "defense";

  battle.defenseWave = 1;

  battle.baseHp = battle.baseMaxHp;

  battle.playerHp = battle.playerMaxHp;

  baseArea(true);

  startDefenseWave();
}

function startDefenseWave() {
  enemySetup(
    120 + battle.defenseWave * 25,
    12 + battle.defenseWave * 2,
    battle.defenseWave === 50 ? "👑" : "👾",
    "🏰 防衛",
  );

  document.getElementById("waveText").innerText =
    "🌊 Wave " + battle.defenseWave + " / 50";

  startBattle();
}

function startBattle() {
  battle.battleEnded = false;

  hideAll();

  document.getElementById("battleScreen").style.display = "block";

  updateBars();

  updateButtons();

  updateCoins();

  updateWeapon();

  updateLevel();
}

function baseArea(show) {
  if (!show) document.getElementById("waveText").innerText = "";
  document.getElementById("baseArea").style.display = show ? "block" : "none";
}

function refreshBattle() {
  updateBars();
  updateButtons();
  updateCoins();
  updateWeapon();
  updateRobot();
  updateLevel();
}

function defend() {
  const result = battleGame.defend();
  if (result.status === "blocked") return;
  log("🛡️ 防御！ 次のダメージ半分！");
  if (result.lost) loseBattle();
  refreshBattle();
}

function useSkill(skillName) {
  const result = battleGame.useSkill(skillName);
  if (result.status === "blocked") return;
  if (result.status === "cooldown") {
    log("⏳ クールダウン");
    return;
  }
  if (result.damage)
    log(
      result.critical
        ? "💥 クリティカル！ " + result.damage + "ダメージ！"
        : skills[skillName].name + " " + result.damage + "ダメージ！",
    );
  if (result.won) winBattle();
  else if (result.lost) loseBattle();
  refreshBattle();
}

function addExp(amount) {
  if (battleGame.addExp(amount)) log("🧬 レベルアップ！ Lv." + battle.level);
  updateLevel();
}

function bossTransform() {
  if (battle.bossPhase === 1) {
    battle.bossPhase = 2;

    enemySetup(500, 35, "👑💀", "真・宇宙魔王");

    battle.battleEnded = false;

    return;
  }

  if (battle.bossPhase === 2) {
    battle.bossPhase = 3;

    enemySetup(800, 45, "🔥👑🔥", "GOD宇宙魔王");

    battle.battleEnded = false;

    return;
  }

  if (battle.bossPhase === 3) {
    battle.coins += 3000;

    log("🏆 完全クリア！");

    queueTransition(showSelect, 3000);
  }
}

function winBattle() {
  const metric =
    battle.mode === "story"
      ? "story"
      : battle.mode === "defense"
        ? "defense"
        : "infinite";
  const value =
    battle.mode === "story"
      ? battle.currentNode === 7 && battle.bossPhase < 3
        ? 6
        : battle.currentNode
      : battle.mode === "defense"
        ? battle.defenseWave
        : battle.infiniteLevel;
  globalThis.GameRecords?.record("youchan-battle", { [metric]: value });
  battle.battleEnded = true;

  addExp(50);

  if (battle.mode === "story") {
    battle.coins += 200;

    if (battle.currentNode === 7) {
      bossTransform();

      return;
    }

    log("🏆 勝利！");

    queueTransition(showStoryMap, 1500);
  }

  if (battle.mode === "infinite") {
    battle.coins += 100 + battle.infiniteLevel * 30;

    battle.infiniteLevel++;

    enemySetup(
      120 + battle.infiniteLevel * 80,
      18 + battle.infiniteLevel * 5,
      "👾",
      "♾️ レベル " + battle.infiniteLevel,
    );

    battle.playerHp = battle.playerMaxHp;

    battle.battleEnded = false;
  }

  if (battle.mode === "defense") {
    battle.coins += 50 + battle.defenseWave * 10;

    battle.defenseWave++;

    battle.playerHp = battle.playerMaxHp;

    if (battle.defenseWave > 50) {
      log("🏆 防衛制覇！");

      queueTransition(showSelect, 3000);

      return;
    }

    queueTransition(startDefenseWave, 1500);
  }

  updateCoins();

  updateBars();
}

function loseBattle() {
  battle.battleEnded = true;

  log("💀 負けた！");

  queueTransition(showSelect, 2000);
}

function buyUpgrade(type) {
  const result = battleGame.buyUpgrade(type);
  if (result === "insufficient") {
    log("💰 コインが足りない！");
    return;
  }
  if (result !== "purchased") return;
  const messages = {
    hp: "❤️ さいだいHPアップ！",
    attack: "⚔️ こうげき力アップ！",
    base: "🏯 基地を回復した！",
    robot: "🤖 ロボ兵がなかまになった！",
    cannon: "🔫 砲台をせっちした！",
  };
  log(messages[type]);
  refreshBattle();
}

function buyWeapon(type) {
  const result = battleGame.buyWeapon(type);
  if (result === "insufficient") {
    log("💰 コインが足りない！");
    return;
  }
  if (result !== "purchased") return;
  log(battle.currentWeapon.name + " を手に入れた！");
  refreshBattle();
}

function updateWeapon() {
  document.getElementById("weaponText").innerText =
    battle.currentWeapon.name + " +" + battle.currentWeapon.bonus;
}

function updateCoins() {
  document.getElementById("coinsText").innerText = battle.coins;
}

function updateRobot() {
  document.getElementById("robotText").innerText = battle.robots;

  document.getElementById("cannonText").innerText = battle.cannons;
}

function updateLevel() {
  document.getElementById("levelText").innerText = battle.level;

  document.getElementById("expText").innerText = battle.exp;

  document.getElementById("nextExpText").innerText = battle.nextExp;
}

function resetCooldowns() {
  battleGame.resetCooldowns();
}

function updateButtons() {
  for (let key in battle.cooldowns) {
    const btn = document.getElementById(key + "Btn");

    const names = {
      attack: "⚔️ 攻撃",

      fire: "🔥 ファイヤー",

      thunder: "⚡ サンダー",

      heal: "💚 回復",

      ultimate: "🌈 必殺技",
    };

    btn.innerText =
      battle.cooldowns[key] > 0
        ? names[key] + " " + battle.cooldowns[key]
        : names[key];
  }
}

function updateBars() {
  document.getElementById("playerBar").style.width =
    (battle.playerHp / battle.playerMaxHp) * 100 + "%";

  document.getElementById("enemyBar").style.width =
    (battle.enemyHp / battle.enemyMaxHp) * 100 + "%";

  document.getElementById("baseBar").style.width =
    (battle.baseHp / battle.baseMaxHp) * 100 + "%";
}

function log(text) {
  document.getElementById("log").innerText = text;
}

