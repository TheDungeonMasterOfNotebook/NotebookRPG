/*───────────────────────────────────────────────
📘 NOTEBOOK RPG – GAME LOGIC
───────────────────────────────────────────────*/

//───────────────────────────────────────────────
// 🧍 PLAYER SETUP
//───────────────────────────────────────────────

let player = JSON.parse(localStorage.getItem("player")) || {
  name: "Adventurer",
  level: 1,
  xp: 0,
  nextXP: 100,
  hp: 100,
  maxHp: 100,
  attack: 10,
  defense: 5,
  inventory: [],
  equipment: {},
  aces: 0,
  gold: 0
};

let currentEnemy = null;
let inBattle = false;

//───────────────────────────────────────────────
// 🧮 UTILITY
//───────────────────────────────────────────────

function saveGame() {
  localStorage.setItem("player", JSON.stringify(player));
}

function addFloatingText(text, color = "gold") {
  const layer = document.getElementById("floatLayer");
  const span = document.createElement("div");
  span.className = `floatText ${color}`;
  span.innerText = text;
  span.style.left = `${Math.random() * 80 + 10}%`;
  span.style.top = `${Math.random() * 80 + 10}%`;
  layer.appendChild(span);
  setTimeout(() => span.remove(), 1500);
}

//───────────────────────────────────────────────
// 🧙‍♂️ LEVELING
//───────────────────────────────────────────────

function addXP(amount) {
  player.xp += amount;
  addFloatingText(`+${amount} XP`, "green");

  if (player.xp >= player.nextXP) {
    player.xp -= player.nextXP;
    player.level++;
    player.nextXP = Math.floor(player.nextXP * 1.25);
    player.maxHp = Math.floor(player.maxHp * 1.1);
    player.attack = Math.floor(player.attack * 1.1);
    player.defense = Math.floor(player.defense * 1.1);
    player.hp = player.maxHp; // Full heal
    addFloatingText(`LEVEL UP!`, "gold");
  }

  updateUI();
  saveGame();
}

//───────────────────────────────────────────────
// ⚔️ ENEMIES & COMBAT
//───────────────────────────────────────────────

function generateEnemy() {
  const level = player.level;
  const hp = 40 + level * 10;
  const attack = 6 + level * 2;
  const defense = 3 + level;
  return { name: "Enemy", level, hp, maxHp: hp, attack, defense };
}

function startBattle() {
  if (inBattle) return;
  currentEnemy = generateEnemy();
  inBattle = true;
  log(`⚔️ A level ${currentEnemy.level} enemy appears!`);
  updateUI();
}

function attackEnemy() {
  if (!inBattle) return;
  const damage = Math.max(1, player.attack - currentEnemy.defense + Math.random() * 5);
  currentEnemy.hp -= Math.round(damage);
  log(`🗡️ You hit the enemy for ${Math.round(damage)}!`);
  if (currentEnemy.hp <= 0) {
    winBattle();
  } else {
    enemyTurn();
  }
  updateUI();
}

function enemyTurn() {
  const damage = Math.max(1, currentEnemy.attack - player.defense + Math.random() * 4);
  player.hp -= Math.round(damage);
  log(`💥 Enemy hits you for ${Math.round(damage)}!`);
  if (player.hp <= 0) {
    loseBattle();
  }
  updateUI();
}

function winBattle() {
  inBattle = false;
  const xpGain = 40 + player.level * 10;
  const acesGain = dropAces();
  addXP(xpGain);
  player.hp = Math.min(player.hp + 10, player.maxHp);
  log(`🏆 Victory! You gained ${xpGain} XP and ${acesGain} Ace value.`);
  updateBiome();
  saveGame();
}

function loseBattle() {
  inBattle = false;
  log("💀 You were defeated... Respawning with full HP.");
  player.hp = player.maxHp;
  saveGame();
}

//───────────────────────────────────────────────
// ♠️ CURRENCY (ACES)
//───────────────────────────────────────────────

const aceTiers = [
  { name: "Ace of Clubs", value: 10, chance: 0.45 },
  { name: "Ace of Hearts", value: 25, chance: 0.3 },
  { name: "Ace of Diamonds", value: 50, chance: 0.2 },
  { name: "Ace of Spades", value: 100, chance: 0.05 }
];

function dropAces() {
  let drop = 0;
  const roll = Math.random();
  let acc = 0;
  for (const ace of aceTiers) {
    acc += ace.chance;
    if (roll < acc) {
      player.aces += ace.value;
      addFloatingText(`${ace.name} +${ace.value}`, "gold");
      drop = ace.value;
      break;
    }
  }
  updateUI();
  return drop;
}

//───────────────────────────────────────────────
/* 💍 EQUIPMENT, LOOT & MERCHANT */
//───────────────────────────────────────────────

const rarities = [
  { name: "Common", color: "#bbb", chance: 0.4, bonus: 1 },
  { name: "Uncommon", color: "#5eff5e", chance: 0.25, bonus: 1.1 },
  { name: "Rare", color: "#3399ff", chance: 0.15, bonus: 1.25 },
  { name: "Super Rare", color: "#b54bff", chance: 0.08, bonus: 1.4 },
  { name: "Epic", color: "#ff66cc", chance: 0.05, bonus: 1.55 },
  { name: "Most Def Epic", color: "#ff9933", chance: 0.04, bonus: 1.7 },
  { name: "Powerful", color: "#ff4444", chance: 0.02, bonus: 1.9 },
  { name: "Legendary", color: "#ffd700", chance: 0.009, bonus: 2.2 },
  { name: "Mythic", color: "#ff00ff", chance: 0.001, bonus: 2.6 }
];

function randomRarity() {
  const roll = Math.random();
  let sum = 0;
  for (let r of rarities) {
    sum += r.chance;
    if (roll < sum) return r;
  }
  return rarities[0];
}

function generateLoot() {
  const rarity = randomRarity();
  const types = ["Sword", "Shield", "Armor", "Ring"];
  const type = types[Math.floor(Math.random() * types.length)];
  const bonus = rarity.bonus;
  const item = {
    name: `${rarity.name} ${type}`,
    rarity: rarity.name,
    bonus,
    color: rarity.color
  };
  return item;
}

function equipItem(item) {
  player.equipment[item.name] = item;
  player.attack = Math.floor(player.attack * item.bonus);
  player.defense = Math.floor(player.defense * item.bonus);
  addFloatingText(`Equipped ${item.name}`, "gold");
  saveGame();
  updateUI();
}

//───────────────────────────────────────────────
// 🏪 MERCHANT
//───────────────────────────────────────────────

function openMerchant() {
  const modal = document.getElementById("modalContainer");
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal">
      <h3>🧑‍🎩 Merchant</h3>
      <p>You have ${player.aces} Ace value.</p>
      <div id="merchantItems"></div>
      <button onclick="closeModal()">Close</button>
    </div>
  `;
  const shop = document.getElementById("merchantItems");
  shop.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const loot = generateLoot();
    const price = Math.floor(loot.bonus * 80);
    const btn = document.createElement("button");
    btn.innerText = `${loot.name} - ${price} Aces`;
    btn.style.color = loot.color;
    btn.onclick = () => buyItem(loot, price);
    shop.appendChild(btn);
  }
}

function buyItem(loot, price) {
  if (player.aces < price) {
    addFloatingText("Not enough Aces!", "red");
    return;
  }
  player.aces -= price;
  player.inventory.push(loot);
  addFloatingText(`Bought ${loot.name}`, "gold");
  updateUI();
  saveGame();
}

function closeModal() {
  document.getElementById("modalContainer").style.display = "none";
}

//───────────────────────────────────────────────
// 🌍 BIOME SYSTEM
//───────────────────────────────────────────────

const biomes = [
  { name: "Forest", min: 1, max: 5, bg: "linear-gradient(to bottom, #1b3a1a, #081308)", color: "#67e667", particles: "leaf" },
  { name: "Desert", min: 6, max: 10, bg: "linear-gradient(to bottom, #e6c76a, #d9a441)", color: "#ffd47f", particles: "sand" },
  { name: "Tundra", min: 11, max: 15, bg: "linear-gradient(to bottom, #a9d3f5, #456ca8)", color: "#aaf", particles: "snow" },
  { name: "Volcano", min: 16, max: 20, bg: "linear-gradient(to bottom, #4c0a0a, #0a0000)", color: "#f33", particles: "ash" },
  { name: "Celestial Realm", min: 21, max: 999, bg: "linear-gradient(to bottom, #3a0066, #000010)", color: "#c9f", particles: "star" },
];

function updateBiome() {
  const biome = biomes.find(b => player.level >= b.min && player.level <= b.max);
  if (!biome) return;

  const bg = document.getElementById("biomeBackground");
  bg.style.backgroundImage = biome.bg;
  bg.style.filter = `drop-shadow(0 0 50px ${biome.color})`;

  spawnParticles(biome.particles);
}

function spawnParticles(type) {
  const layer = document.getElementById("particleLayer");
  layer.innerHTML = "";
  const count = 20;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    let size, color;
    switch (type) {
      case "leaf": size = 6; color = "#7fef74"; break;
      case "sand": size = 3; color = "#ffd47f"; break;
      case "snow": size = 5; color = "#fff"; break;
      case "ash": size = 4; color = "#ff6e40"; break;
      case "star": size = 2; color = "#b388ff"; break;
      default: size = 4; color = "#fff";
    }
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.bottom = `-${Math.random() * 100}px`;
    p.style.background = color;
    p.style.animationDuration = `${5 + Math.random() * 8}s`;
    layer.appendChild(p);
  }
}

//───────────────────────────────────────────────
// ⚙️ ADMIN PANEL SYSTEM
//───────────────────────────────────────────────

function toggleAdminPanel() {
  const panel = document.getElementById("adminPanel");
  panel.classList.toggle("visible");
  loadAdminData();
}

function loadAdminData() {
  document.getElementById("adminName").value = player.name;
  document.getElementById("adminLevel").value = player.level;
  document.getElementById("adminXP").value = player.xp;
  document.getElementById("adminHP").value = player.hp;
  document.getElementById("adminAces").value = player.aces;
}

function saveAdminData() {
  player.name = document.getElementById("adminName").value;
  player.level = parseInt(document.getElementById("adminLevel").value);
  player.xp = parseInt(document.getElementById("adminXP").value);
  player.hp = parseInt(document.getElementById("adminHP").value);
  player.aces = parseInt(document.getElementById("adminAces").value);
  updateUI();
  saveGame();
}

document.getElementById("adminSave").addEventListener("click", saveAdminData);
document.getElementById("spawnLoot").addEventListener("click", () => {
  const loot = generateLoot();
  player.inventory.push(loot);
  addFloatingText(`Spawned: ${loot.name}`, "gold");
  updateUI();
});
document.getElementById("addXP").addEventListener("click", () => addXP(100));
document.getElementById("healFull").addEventListener("click", () => {
  player.hp = player.maxHp;
  addFloatingText("Fully Healed!", "green");
  updateUI();
});
document.getElementById("resetGame").addEventListener("click", () => {
  if (confirm("Reset all progress?")) {
    localStorage.clear();
    location.reload();
  }
});
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyA") toggleAdminPanel();
});

//───────────────────────────────────────────────
// 🖥️ UI RENDERING
//───────────────────────────────────────────────

function log(text) {
  const logBox = document.getElementById("gameUI");
  const p = document.createElement("p");
  p.textContent = text;
  logBox.appendChild(p);
  logBox.scrollTop = logBox.scrollHeight;
}

function updateUI() {
  const ui = document.getElementById("gameUI");
  ui.innerHTML = `
    <p><strong>${player.name}</strong> (Lv ${player.level})</p>
    <p>HP: ${player.hp}/${player.maxHp}</p>
    <p>XP: ${player.xp}/${player.nextXP}</p>
    <p>Attack: ${player.attack} | Defense: ${player.defense}</p>
    <p>Aces: ${player.aces}</p>
    <button onclick="startBattle()">⚔️ Battle</button>
    <button onclick="openMerchant()">🛒 Merchant</button>
  `;
  if (inBattle && currentEnemy) {
    ui.innerHTML += `
      <hr>
      <p><strong>${currentEnemy.name}</strong> (Lv ${currentEnemy.level})</p>
      <p>HP: ${currentEnemy.hp}/${currentEnemy.maxHp}</p>
      <button onclick="attackEnemy()">🗡️ Attack</button>
    `;
  }
  updateBiome();
}

//───────────────────────────────────────────────
// 🏁 INIT
//───────────────────────────────────────────────

updateUI();
updateBiome();
saveGame();
