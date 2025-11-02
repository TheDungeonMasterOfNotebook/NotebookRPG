/*───────────────────────────────────────────────
 📘 NOTEBOOK RPG — Main Game Logic
───────────────────────────────────────────────*/

// 🧙‍♂️ Classes
const CLASSES = {
  Knight: { hp: 120, atk: 10, def: 10, spd: 5, trait: "Extra armor on start" },
  Rogue: { hp: 90, atk: 8, def: 5, spd: 12, trait: "Higher crit chance" },
  Mage: { hp: 80, atk: 14, def: 4, spd: 8, trait: "Bonus magic damage" },
  Ranger: { hp: 100, atk: 10, def: 6, spd: 10, trait: "High accuracy" },
  Cleric: { hp: 95, atk: 7, def: 8, spd: 7, trait: "Self-heal every 3 turns" },
  Berserker: { hp: 110, atk: 12, def: 5, spd: 9, trait: "More damage at low HP" },
  Necromancer: { hp: 85, atk: 9, def: 5, spd: 7, trait: "Can summon skeletons" },
  Paladin: { hp: 115, atk: 9, def: 9, spd: 6, trait: "Light damage resist" }
};

// 🎲 Rarities and Loot
const RARITIES = [
  "Common", "Uncommon", "Rare", "Super Rare", "Epic", "Most Def Epic",
  "Powerful", "Legendary", "Mythic"
];

// 💰 Aces currency tiers
const ACE_VALUES = {
  Hearts: 10,
  Diamonds: 25,
  Clubs: 50,
  Spades: 100
};

// 🧍 Player and Game State
let player = null;
let currentDungeon = { floor: 1, room: 0, active: false };
let biome = "forest";

//───────────────────────────────────────────────
// 🌿 Character Creation Setup
//───────────────────────────────────────────────
const charSection = document.getElementById("characterCreation");
const classList = document.getElementById("classList");
const gameContainer = document.getElementById("gameContainer");

// Create class buttons
Object.keys(CLASSES).forEach(cls => {
  const div = document.createElement("div");
  div.classList.add("classOption");
  div.textContent = `${cls}`;
  div.title = CLASSES[cls].trait;
  div.addEventListener("click", () => selectClass(cls, div));
  classList.appendChild(div);
});

let selectedClass = null;
function selectClass(cls, el) {
  document.querySelectorAll(".classOption").forEach(e => e.classList.remove("selected"));
  el.classList.add("selected");
  selectedClass = cls;
}

//───────────────────────────────────────────────
// 🧾 Begin Adventure
//───────────────────────────────────────────────
document.getElementById("beginAdventure").addEventListener("click", () => {
  const name = document.getElementById("charName").value.trim();
  const emoji = document.getElementById("charEmoji").value.trim() || "🙂";

  if (!name || !selectedClass) {
    alert("Please enter a name and select a class!");
    return;
  }

  const base = CLASSES[selectedClass];
  player = {
    name,
    emoji,
    class: selectedClass,
    level: 1,
    xp: 0,
    nextXP: 100,
    hp: base.hp,
    maxHP: base.hp,
    atk: base.atk,
    def: base.def,
    spd: base.spd,
    aces: { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 },
    equipment: [],
    trait: base.trait
  };

  saveGame();
  startGame();
});

function startGame() {
  charSection.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  updateUI();
  biomeTransition("forest");
  spawnParticles();
}

//───────────────────────────────────────────────
// 💾 Save / Load
//───────────────────────────────────────────────
function saveGame() {
  localStorage.setItem("notebookSave", JSON.stringify(player));
}

function loadGame() {
  const save = localStorage.getItem("notebookSave");
  if (save) {
    player = JSON.parse(save);
    startGame();
  }
}
loadGame();

//───────────────────────────────────────────────
// 🎮 UI Management
//───────────────────────────────────────────────
const gameUI = document.getElementById("gameUI");

function updateUI() {
  let aceTotal = calculateAces();

  gameUI.innerHTML = `
    <p>${player.emoji} <b>${player.name}</b> the ${player.class}</p>
    <p>Lvl ${player.level} | XP: ${player.xp}/${player.nextXP}</p>
    <p>HP: ${player.hp}/${player.maxHP}</p>
    <p>Aces Value: ${aceTotal}</p>
    <hr>
    <button onclick="exploreDungeon()">🕯️ Explore Dungeon</button>
    <button onclick="openMerchant()">🪙 Visit Merchant</button>
    <button onclick="openInventory()">🎒 Inventory</button>
    <button onclick="toggleAdminPanel()">⚙️ Admin</button>
  `;
}

function calculateAces() {
  return Object.keys(player.aces)
    .reduce((sum, k) => sum + (player.aces[k] * ACE_VALUES[k]), 0);
}

//───────────────────────────────────────────────
// 🏰 Dungeon Crawl
//───────────────────────────────────────────────
function exploreDungeon() {
  if (!currentDungeon.active) {
    currentDungeon = { floor: 1, room: 1, active: true };
  } else {
    currentDungeon.room++;
    if (currentDungeon.room > 5) {
      currentDungeon.floor++;
      currentDungeon.room = 1;
      floatText(`📖 Descended to Floor ${currentDungeon.floor}!`, "gold");
    }
  }

  const roll = Math.random();
  if (roll < 0.4) encounterEnemy();
  else if (roll < 0.6) findTreasure();
  else if (roll < 0.7) meetMerchant();
  else if (roll < 0.85) triggerTrap();
  else restSite();
}

function encounterEnemy() {
  const rarity = RARITIES[Math.floor(Math.random() * RARITIES.length)];
  const enemyHP = 30 + Math.floor(Math.random() * 20);
  const dmg = Math.max(1, player.atk - 2 + Math.floor(Math.random() * 5));
  floatText(`⚔️ Fought a ${rarity} foe!`, "red");

  // XP reward
  const xpGain = Math.ceil(Math.random() * 30 * (RARITIES.indexOf(rarity) + 1));
  addXP(xpGain);

  // Aces drop chance
  if (Math.random() < 0.4) dropAce();
  updateUI();
}

function findTreasure() {
  floatText("💎 Found a treasure chest!", "green");
  if (Math.random() < 0.6) dropAce();
}

function meetMerchant() {
  floatText("🧙‍♂️ A mysterious merchant appears...", "gold");
}

function triggerTrap() {
  const dmg = Math.floor(player.maxHP * 0.1);
  player.hp = Math.max(0, player.hp - dmg);
  floatText(`☠️ Trap! Lost ${dmg} HP`, "red");
  if (player.hp <= 0) playerDeath();
}

function restSite() {
  const heal = Math.floor(player.maxHP * 0.2);
  player.hp = Math.min(player.maxHP, player.hp + heal);
  floatText(`💤 Rested and recovered ${heal} HP`, "green");
}

//───────────────────────────────────────────────
// ⚡ XP, Leveling, and Loot
//───────────────────────────────────────────────
function addXP(amount) {
  player.xp += amount;
  floatText(`+${amount} XP`, "gold");
  if (player.xp >= player.nextXP) levelUp();
}

function levelUp() {
  player.level++;
  player.xp = 0;
  player.nextXP = Math.floor(100 * Math.pow(player.level, 1.5));
  player.maxHP += 10;
  player.hp = player.maxHP;
  player.atk += 2;
  floatText(`✨ LEVEL UP! (${player.level})`, "green");
}

function dropAce() {
  const suits = Object.keys(ACE_VALUES);
  const drop = suits[Math.floor(Math.random() * suits.length)];
  player.aces[drop]++;
  floatText(`🂡 Found Ace of ${drop}!`, "gold");
}

//───────────────────────────────────────────────
// ⚰️ Player Death
//───────────────────────────────────────────────
function playerDeath() {
  floatText("💀 You have fallen...", "red");
  currentDungeon.active = false;
  player.hp = player.maxHP;
}

//───────────────────────────────────────────────
// 🪙 Merchant & Inventory (Stub UI for now)
//───────────────────────────────────────────────
function openMerchant() {
  floatText("🪙 Merchant: 'Care to trade your Aces?'", "gold");
}
function openInventory() {
  floatText("🎒 You open your pack.", "green");
}

//───────────────────────────────────────────────
// 🌍 Biome Transitions & Particles
//───────────────────────────────────────────────
const biomeBG = document.getElementById("biomeBackground");
function biomeTransition(name) {
  let img = "url('https://i.imgur.com/y3nF3yM.jpeg')";
  if (name === "forest") img = "url('https://i.imgur.com/6kOQzFj.jpeg')";
  else if (name === "cave") img = "url('https://i.imgur.com/YL1gAcA.jpeg')";
  biomeBG.style.backgroundImage = img;
}

function spawnParticles() {
  const layer = document.getElementById("particleLayer");
  layer.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    const size = Math.random() * 4 + 2;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${5 + Math.random() * 5}s`;
    layer.appendChild(p);
  }
}

//───────────────────────────────────────────────
// 💬 Floating Texts
//───────────────────────────────────────────────
function floatText(msg, color = "white") {
  const layer = document.getElementById("floatLayer");
  const text = document.createElement("div");
  text.className = `floatText ${color}`;
  text.textContent = msg;
  text.style.left = `${Math.random() * 80 + 10}%`;
  text.style.top = `${Math.random() * 60 + 20}%`;
  layer.appendChild(text);
  setTimeout(() => text.remove(), 1300);
}

//───────────────────────────────────────────────
// ⚙️ Admin Panel
//───────────────────────────────────────────────
function toggleAdminPanel() {
  document.getElementById("adminPanel").classList.toggle("visible");
}

document.getElementById("adminSave").onclick = () => {
  player.name = document.getElementById("adminName").value;
  player.level = parseInt(document.getElementById("adminLevel").value);
  player.xp = parseInt(document.getElementById("adminXP").value);
  player.hp = parseInt(document.getElementById("adminHP").value);
  player.aces.Spades = parseInt(document.getElementById("adminAces").value);
  saveGame();
  updateUI();
  floatText("✅ Admin changes saved.", "green");
};

document.getElementById("spawnLoot").onclick = dropAce;
document.getElementById("addXP").onclick = () => addXP(100);
document.getElementById("healFull").onclick = () => { player.hp = player.maxHP; updateUI(); };
document.getElementById("resetGame").onclick = () => {
  localStorage.clear();
  location.reload();
};
