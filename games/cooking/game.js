const { shopFoods, missions } = CookingData;
const cookingGame = CookingState.createGame(CookingData);
const cooking = cookingGame.state;
let mixTimer;

function toggleMenu() {
  let menu = document.getElementById("menu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
  document.getElementById("menu").style.display = "none";

  updateRank();
  updateShop();
  updateBook();
  updateAchievements();
}

function startGame() {
  clearTimeout(mixTimer);
  const mission = cookingGame.start();
  document.querySelector(".bowl").classList.remove("spin");
  updateBowl();
  document.getElementById("dish").innerHTML = "";
  document.getElementById("dish").classList.remove("perfect");
  document.getElementById("actions").innerHTML = "";
  document.getElementById("mission").textContent = mission
    ? "🎯ミッション：" + mission.text
    : "🎯ミッション：作れる料理がない！";
  const passText =
    mission && cooking.madeDishes.includes(mission.success)
      ? "<br>📖図鑑登録済み！パスできるよ"
      : "";
  document.getElementById("message").innerHTML = mission
    ? (mission.rare ? "✨レアミッション発生！✨" : "食材を選ぼう！") + passText
    : "🛒ショップで食材を買ってね！";
  updateProgress();
}

function updateControls() {
  const editable = cooking.phase === "idle" || cooking.phase === "preparing";
  document
    .querySelectorAll("#foodButtons button, #actions button, .deleteFoodBtn")
    .forEach((button) => {
      button.disabled = !editable;
    });
  document.querySelector('button[onclick="mix()"]').disabled =
    cooking.phase !== "preparing";
  document.getElementById("nextBtn").style.display =
    cooking.phase === "finished" ? "inline-block" : "none";
  document.getElementById("passBtn").style.display =
    cooking.phase === "preparing" &&
    cooking.madeDishes.includes(cooking.currentMission.success)
      ? "inline-block"
      : "none";
}

function updateProgress() {
  updateRank();
  updateHistory();
  updateShop();
  updateBook();
  updateAchievements();
  updateFoodButtons();
  updateControls();
}

function updateFoodButtons() {
  let area = document.getElementById("foodButtons");
  area.innerHTML = "";

  cooking.unlockedFoods.forEach((food) => {
    let btn = document.createElement("button");
    btn.innerHTML = getEmoji(food) + food;
    btn.onclick = function () {
      chooseFood(food);
    };
    area.appendChild(btn);
  });
}

function updateShop() {
  let area = document.getElementById("shopItems");
  if (!area) return;

  document.getElementById("shopMoney").innerHTML = "💰お金：" + cooking.money;
  area.innerHTML = "";

  shopFoods.forEach((item) => {
    let btn = document.createElement("button");

    if (cooking.unlockedFoods.includes(item.name)) {
      btn.innerHTML = item.emoji + item.name + " ✅購入済み";
      btn.className = "bought";
      btn.disabled = true;
    } else {
      btn.innerHTML = item.emoji + item.name + " " + item.price + "💰";
      btn.onclick = function () {
        buyFood(item.name);
      };
    }

    area.appendChild(btn);
  });
}

function buyFood(food) {
  const result = cookingGame.buyFood(food);
  if (result === "insufficient") {
    alert("💰お金が足りない！");
    return;
  }
  if (result !== "purchased") return;
  updateProgress();
  alert(food + "を買った！食材ボタンが追加された！");
}

function chooseFood(food) {
  if (cooking.phase === "mixing" || cooking.phase === "finished") return;
  let actions = document.getElementById("actions");

  if (food === "にんじん") {
    actions.innerHTML = `
      <h2>🥕にんじんをどう切る？</h2>
      <button onclick="addFood('🥕','にんじん')">そのまま</button>
      <button onclick="addFood('🥕','千切りにんじん')">🔪千切り</button>
      <button onclick="addFood('🥕','輪切りにんじん')">🔪輪切り</button>
      <button onclick="addFood('🥕','みじん切りにんじん')">🔪みじん切り</button>
    `;
  } else if (food === "じゃがいも") {
    actions.innerHTML = `
      <h2>🥔じゃがいもをどうする？</h2>
      <button onclick="addFood('🥔','角切りじゃがいも')">🔪角切り</button>
      <button onclick="addFood('🍟','揚げたじゃがいも')">🔥揚げる</button>
      <button onclick="addFood('🥔','つぶしたじゃがいも')">💥つぶす</button>
    `;
  } else if (food === "たまねぎ") {
    actions.innerHTML = `
      <h2>🧅たまねぎをどう切る？</h2>
      <button onclick="addFood('🧅','みじん切りたまねぎ')">🔪みじん切り</button>
      <button onclick="addFood('🧅','薄切りたまねぎ')">🔪薄切り</button>
    `;
  } else if (food === "たまご") {
    actions.innerHTML = `
      <h2>🥚たまごをどうする？</h2>
      <button onclick="addFood('🥚','たまご')">そのまま</button>
      <button onclick="addFood('🍳','焼いたたまご')">🔥焼く</button>
      <button onclick="addFood('🥚','ゆでたまご')">♨️ゆでる</button>
    `;
  } else if (food === "肉") {
    actions.innerHTML = `
      <h2>🥩肉をどうする？</h2>
      <button onclick="addFood('🥩','焼いた肉')">🔥焼く</button>
      <button onclick="addFood('🍖','揚げた肉')">🔥揚げる</button>
      <button onclick="addFood('🥩','煮た肉')">🍲煮る</button>
    `;
  } else if (food === "魚") {
    actions.innerHTML = `
      <h2>🐟魚をどうする？</h2>
      <button onclick="addFood('🐟','切った魚')">🔪切る</button>
      <button onclick="addFood('🐟','焼いた魚')">🔥焼く</button>
    `;
  } else {
    addFood(getEmoji(food), food);
  }
}

function getEmoji(food) {
  let emojis = {
    にんじん: "🥕",
    じゃがいも: "🥔",
    たまねぎ: "🧅",
    たまご: "🥚",
    肉: "🥩",
    魚: "🐟",
    パン: "🍞",
    チーズ: "🧀",
    トマト: "🍅",
    レタス: "🥬",
    コーン: "🌽",
    ごはん: "🍚",
    めん: "🍜",
    水: "💧",
    塩: "🧂",
    しょうゆ: "🟤",
    ケチャップ: "🍅",
    カレー粉: "🍛",
    きのこ: "🍄",
    えび: "🦐",
    牛乳: "🥛",
    バター: "🧈",
    小麦粉: "🌾",
    砂糖: "🍬",
    りんご: "🍎",
    いちご: "🍓",
    チョコ: "🍫",
    にんにく: "🧄",
  };
  return emojis[food] || "🍴";
}

function addFood(emoji, name) {
  if (!cookingGame.addIngredient(emoji, name)) return;
  updateBowl();
  document.getElementById("actions").innerHTML = "";
}

function updateBowl() {
  let bowlItems = document.getElementById("bowlItems");
  bowlItems.innerHTML = "";

  cooking.bowl.forEach((item, index) => {
    let div = document.createElement("div");
    div.className = "food";
    div.innerHTML = `
      <div class="foodEmoji">${item.emoji}</div>
      <div class="foodName">${item.name}</div>
      <button class="deleteFoodBtn" onclick="removeFood(${index})">❌</button>
    `;
    bowlItems.appendChild(div);
  });
  updateControls();
}

function removeFood(index) {
  if (!cookingGame.removeIngredient(index)) return;
  updateBowl();
}

function mix() {
  const token = cookingGame.beginMix();
  if (!token) {
    if (cooking.phase === "idle")
      document.getElementById("message").textContent = "先にスタートしてね！";
    return;
  }
  const bowlElement = document.querySelector(".bowl");
  bowlElement.classList.add("spin");
  document.getElementById("message").textContent = "🌀まぜまぜまぜ...";
  document.getElementById("dish").innerHTML = "";
  document.getElementById("dish").classList.remove("perfect");
  updateControls();
  mixTimer = setTimeout(() => {
    const result = cookingGame.finishMix(token);
    if (!result) return;
    bowlElement.classList.remove("spin");
    showResult(result);
  }, 2000);
}

function passMission() {
  const result = cookingGame.pass();
  if (result) showResult(result);
  else if (cooking.phase === "preparing")
    document.getElementById("message").textContent =
      "❌まだ一度も作ったことがない料理はパスできない！";
}

function showResult(result) {
  let message, rating;
  if (result.kind === "success") {
    const starText =
      result.stars === 3
        ? "パーフェクト！"
        : result.stars === 2
          ? "おしい！"
          : "なんとか完成！";
    rating = "⭐".repeat(result.stars) + "<br>" + starText;
    message = "🎉ミッション成功！ +" + result.point + "ポイント＆お金";
  } else if (result.kind === "pass") {
    rating = "パス報酬 30%";
    message = "⏩パス！ +" + result.point + "ポイント＆お金";
  } else {
    rating = "⭐評価なし";
    message = "😵ミッション失敗！変な料理になった！";
  }
  document.getElementById("message").textContent = message;
  document
    .getElementById("dish")
    .classList.toggle("perfect", result.stars === 3);
  document.getElementById("dish").innerHTML =
    result.dish.emoji +
    "<br><span style='font-size:35px'>" +
    result.dish.name +
    "</span>" +
    "<br><span style='font-size:" +
    (result.kind === "success" ? 35 : 28) +
    "px'>" +
    rating +
    "</span>";
  updateProgress();
}

function updateRank() {
  globalThis.GameRecords?.record("cooking", { points: cooking.score });
  document.getElementById("rankBox").innerHTML =
    "🏆ランク：" +
    getRank() +
    "<br>⭐ポイント：" +
    cooking.score +
    "<br>💰お金：" +
    cooking.money;
}

function getRank() {
  return CookingRules.rankFor(cooking.score);
}

function updateHistory() {
  const rows = cooking.history.map(
    (result) =>
      result.dish.emoji +
      " " +
      result.dish.name +
      " " +
      (result.kind === "success"
        ? "⭐".repeat(result.stars)
        : result.kind === "pass"
          ? "パス"
          : "評価なし"),
  );
  document.getElementById("historyBox").innerHTML =
    "📖作った料理<br>" + (rows.length ? rows.join("<br>") : "まだないよ");
}

function updateBook() {
  let box = document.getElementById("bookBox");
  if (!box) return;

  let html = "";

  missions.forEach((m) => {
    if (cooking.madeDishes.includes(m.success)) {
      html += m.dish + " " + m.success + " ✅<br>";
    } else {
      html += "？？？<br>";
    }
  });

  box.innerHTML = html;
}

function updateAchievements() {
  let box = document.getElementById("achievementBox");
  if (!box) return;

  let text = "";

  text +=
    cooking.score >= 100 ? "✅ 初めてのシェフ<br>" : "🔒 初めてのシェフ<br>";
  text += cooking.score >= 300 ? "✅ 一流への道<br>" : "🔒 一流への道<br>";
  text += cooking.score >= 1000 ? "✅ 伝説の料理王<br>" : "🔒 伝説の料理王<br>";
  text +=
    cooking.madeDishes.length >= 5
      ? "✅ 料理コレクター<br>"
      : "🔒 料理コレクター<br>";
  text +=
    cooking.unlockedFoods.length >= 10
      ? "✅ 食材マスター<br>"
      : "🔒 食材マスター<br>";

  box.innerHTML = text;
}

updateProgress();
