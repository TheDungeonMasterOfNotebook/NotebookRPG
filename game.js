/* ===========================
   Notebook RPG — Updated game.js
   - Turn-based combat & enemy pool
   - Working Inventory & Merchant UIs
   - Dungeon crawl triggers real battles
   - Aces currency spending/conversion
   - Saves to localStorage "notebookSave"
   =========================== */

(() => {
  // ---------- Config ----------
  const SAVE_KEY = "notebookSave";
  const ACE_VALUES = { Spades: 100, Hearts: 50, Diamonds: 25, Clubs: 10 }; // value per card
  const ENEMY_POOL = [
    // common
    { id:'goblin', name:'Goblin Grunt', hp:30, atk:6, def:1, rarity:'Common', special:null },
    { id:'wolf', name:'Wild Wolf', hp:28, atk:7, def:0, rarity:'Common', special:null },
    // uncommon
    { id:'bandit', name:'Bandit', hp:45, atk:9, def:2, rarity:'Uncommon', special:'bleed' },
    { id:'sentry', name:'Stone Sentry', hp:50, atk:8, def:4, rarity:'Uncommon', special:'shield' },
    // rare
    { id:'fire_imp', name:'Fire Imp', hp:60, atk:11, def:2, rarity:'Rare', special:'burn' },
    { id:'ice_hound', name:'Ice Hound', hp:65, atk:10, def:3, rarity:'Rare', special:'slow' },
    // epic
    { id:'orc_warchief', name:'Orc Warchief', hp:100, atk:18, def:6, rarity:'Epic', special:'rage' },
    { id:'venom_spider', name:'Venom Spider', hp:80, atk:14, def:2, rarity:'Epic', special:'poison' },
    // boss (example)
    { id:'crypt_lord', name:'Crypt Lord', hp:220, atk:28, def:8, rarity:'Boss', special:'curse' }
  ];

  // DOM refs (assumes elements exist; create backup nodes if not)
  const $ = (s) => document.querySelector(s);
  const gameUI = $('#gameUI');
  const floatLayer = $('#floatLayer') || (function(){const d=document.createElement('div');d.id='floatLayer';document.body.appendChild(d);return d;})();
  const modalContainer = $('#modalContainer') || (function(){const d=document.createElement('div');d.id='modalContainer';document.body.appendChild(d);return d;})();
  const biomeBg = $('#biomeBackground') || (function(){const d=document.createElement('div');d.id='biomeBackground';document.body.appendChild(d);return d;})();
  const particleLayer = $('#particleLayer') || (function(){const d=document.createElement('div');d.id='particleLayer';document.body.appendChild(d);return d;})();

  // ---------- Save / Load ----------
  function saveGame() {
    if (!player) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  // ---------- Player initialization ----------
  let player = loadGame();
  // If no save, the index.html's character creation calls startGame() which sets player.
  // If there's a save, ensure required fields exist:
  function normalizePlayer(p) {
    p.acesset = p.acesset || {}; // no-op fallback
    p.aces = p.aces || { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    p.inventory = p.inventory || [];
    p.equipment = p.equipment || { Weapon:null, Armor:null, Accessory:null };
    p.status = p.status || [];
    p.level = p.level || 1;
    p.xp = p.xp || 0;
    p.nextXP = p.nextXP || Math.max(100, Math.floor(120 * Math.pow(p.level, 1.5)));
    p.maxHP = p.maxHP || p.hp || 100;
    p.hp = p.hp || p.maxHP;
    p.atk = p.atk || 10;
    p.def = p.def || 5;
    p.crit = p.crit || 5;
    return p;
  }
  if (player) player = normalizePlayer(player);

  // ---------- Utility helpers ----------
  function floatText(text, cls='gold') {
    const el = document.createElement('div');
    el.className = `floatText ${cls}`;
    el.textContent = text;
    el.style.left = `${10 + Math.random()*80}%`;
    el.style.top = `${30 + Math.random()*40}%`;
    floatLayer.appendChild(el);
    setTimeout(()=> el.remove(), 1500);
  }

  function totalAcesValue(aces) {
    aces = aces || player?.aces || { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    return (aces.Spades||0)*ACE_VALUES.Spades + (aces.Hearts||0)*ACE_VALUES.Hearts + (aces.Diamonds||0)*ACE_VALUES.Diamonds + (aces.Clubs||0)*ACE_VALUES.Clubs;
  }

  // Convert a raw value into coin counts (greedy descending)
  function coinsFromValue(total) {
    const out = { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    let rem = Math.floor(total);
    const order = ['Spades','Hearts','Diamonds','Clubs'];
    for (let k of order) {
      out[k] = Math.floor(rem / ACE_VALUES[k]);
      rem = rem % ACE_VALUES[k];
    }
    return out;
  }

  // Try spend a value (in ace value). Returns true if spent.
  function spendAces(value) {
    const current = totalAcesValue(player.aces);
    if (current < value) return false;
    const newCoins = coinsFromValue(current - value);
    player.aces = newCoins;
    saveGame();
    return true;
  }

  function addAcesValue(value) {
    const total = totalAcesValue(player.aces) + Math.floor(value);
    player.aces = coinsFromValue(total);
    saveGame();
  }

  // ---------- Inventory & Merchant UI ----------
  function openInventory() {
    const inv = player.inventory || [];
    if (inv.length === 0) {
      showModal("Inventory", "<div class='small'>Empty</div>");
      return;
    }
    let html = `<div style="display:flex;flex-direction:column;gap:8px">`;
    inv.forEach((it, idx) => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #333;border-radius:8px">
        <div><strong>${it.name}</strong><div class="small">${it.desc || it.slot || ''}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${it.usable ? `<button onclick="useItem(${idx})">Use</button>` : ''}
          ${it.slot ? `<button onclick="equipItem(${idx})">Equip</button>` : ''}
          <button onclick="sellItem(${idx})">Sell</button>
        </div>
      </div>`;
    });
    html += `</div>`;
    showModal("Inventory", html);
  }
  window.useItem = function(index) {
    const it = player.inventory[index];
    if (!it) return;
    if (it.type === 'potion') {
      player.hp = Math.min(player.maxHP, player.hp + (it.power||50));
      floatText(`Healed ${it.power||50}`, 'green');
      player.inventory.splice(index,1);
      saveGame(); updateMainUI(); closeModal();
    } else {
      floatText("Can't use that right now", 'red');
    }
  };
  window.equipItem = function(index) {
    const it = player.inventory[index];
    if (!it) return;
    const slot = it.slot || 'Accessory';
    // place item in equipment (simplified)
    const old = player.equipment[slot] || null;
    player.equipment[slot] = it;
    // quick stat adjust: if weapon -> atk, armor->maxHP
    if (slot === 'Weapon') player.atk += Math.floor((it.power||5)/2);
    if (slot === 'Armor') { player.maxHP += (it.power||10); player.hp += (it.power||10); }
    player.inventory.splice(index,1);
    floatText(`Equipped ${it.name}`, 'gold');
    saveGame(); updateMainUI(); closeModal();
  };
  window.sellItem = function(index) {
    const it = player.inventory[index];
    if (!it) return;
    const val = Math.max(5, Math.floor((it.power||10) * (it.valueMultiplier||1)));
    addAcesValue(val);
    player.inventory.splice(index,1);
    floatText(`Sold for ${val} value`, 'gold');
    saveGame(); updateMainUI(); closeModal();
  };

  function openMerchant() {
    // Offer 3 random items + enchant option
    let html = `<div class="small">Merchant offers (prices are value):</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">`;
    const offers = [];
    for (let i=0;i<3;i++){
      const it = randomLoot();
      const price = Math.max(10, Math.floor((it.power||10) * (5 + Math.random()*6)));
      offers.push({ it, price });
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;border:1px solid #333;border-radius:8px">
        <div><strong>${it.name}</strong><div class="small">${it.rarity} • ${it.slot||''}</div></div>
        <div style="text-align:right"><div class="small">${price} value</div><button onclick="buyOffer(${i})">Buy</button></div>
      </div>`;
    }
    html += `</div><div style="margin-top:8px"><button onclick="openEnchantMenu()">Open Enchantments</button></div>`;
    showModal("Merchant", html);
    // store offers in temp place
    player._merchantOffers = offers;
    saveGame();
  }
  window.buyOffer = function(index) {
    const offers = player._merchantOffers || [];
    const offer = offers[index];
    if (!offer) return;
    if (!spendAces(offer.price)) { floatText("Not enough Aces", 'red'); return; }
    player.inventory.push(offer.it);
    floatText(`Bought ${offer.it.name}`, 'gold');
    saveGame(); updateMainUI(); closeModal();
  };

  // Enchanting (simplified) — opens a small menu
  function openEnchantMenu() {
    const pool = [
      { id:'burn', name:'Burn Rune', cost:120, desc:'Chance to burn on hit' },
      { id:'poison', name:'Poison Rune', cost:110, desc:'Chance to poison' },
      { id:'lifesteal', name:'Vampiric Rune', cost:180, desc:'Steal some HP on hit' }
    ];
    let html = `<div class="small">Use Aces value to enchant a weapon (weapon required)</div><div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">`;
    pool.forEach((p, i) => {
      html += `<div style="padding:8px;border:1px solid #333"><strong>${p.name}</strong><div class="small">${p.desc}</div><div class="small">Cost: ${p.cost}</div><div style="margin-top:6px"><button onclick="applyRune(${i})">Apply Rune</button></div></div>`;
    });
    html += `</div>`;
    showModal("Enchantment", html);
    player._runePool = pool;
    saveGame();
  }
  window.applyRune = function(i) {
    const pool = player._runePool || [];
    const rune = pool[i];
    if (!rune) return;
    if (!spendAces(rune.cost)) { floatText("Not enough Aces", 'red'); return; }
    const w = player.equipment.Weapon;
    if (!w) { floatText("No weapon equipped", 'red'); return; }
    w.runes = w.runes || [];
    w.runes.push(rune.id);
    floatText(`Applied ${rune.name} to ${w.name}`, 'gold');
    saveGame(); closeModal(); updateMainUI();
  };

  // ---------- Dungeon & Combat ----------
  let combatState = null; // { enemy, turn: 'player'|'enemy' }

  function exploreDungeon() {
    // pick an event: 60% enemy (combat), 20% chest, 10% merchant, 10% trap/rest
    const r = Math.random();
    if (r < 0.6) {
      startCombat(randomEnemyByDepth());
    } else if (r < 0.8) {
      // chest
      const r2 = Math.random();
      if (r2 < 0.66) {
        const loot = randomLoot();
        player.inventory.push(loot);
        floatText(`Found ${loot.name}`, 'green');
        saveGame();
      } else {
        const val = 10 + Math.floor(Math.random()*60);
        addAcesValue(val);
        floatText(`Found ${val} Ace value`, 'gold');
      }
      updateMainUI();
    } else if (r < 0.9) {
      openMerchant();
    } else {
      const dmg = Math.max(5, Math.floor(player.maxHP * 0.12));
      player.hp = Math.max(1, player.hp - dmg);
      floatText(`Trap! -${dmg} HP`, 'red');
      if (player.hp <= 0) {
        playerDeath();
      }
      saveGame(); updateMainUI();
    }
  }

  function randomEnemyByDepth() {
    // depth influence: scale hp/atk by player level
    const base = ENEMY_POOL[Math.floor(Math.random()*ENEMY_POOL.length)];
    const scale = 1 + Math.min(6, (player.level - 1) * 0.08);
    return {
      id: base.id,
      name: base.name,
      hp: Math.max(10, Math.round(base.hp * scale)),
      maxHp: Math.max(10, Math.round(base.hp * scale)),
      atk: Math.max(1, Math.round(base.atk * scale)),
      def: base.def || 0,
      rarity: base.rarity || 'Common',
      special: base.special || null
    };
  }

  function startCombat(enemy) {
    combatState = { enemy, turn: 'player' };
    renderCombatScreen();
    saveGame();
  }

  function renderCombatScreen() {
    if (!combatState) return updateMainUI();
    const e = combatState.enemy;
    gameUI.innerHTML = `<div class="panel"><h2>⚔️ ${e.name} (${e.rarity})</h2>
      <div id="combatText" class="small" style="min-height:48px;margin-bottom:8px">Battle in progress</div>
      <div><strong>Player</strong> — HP: ${player.hp}/${player.maxHP} | ATK: ${player.atk} | DEF: ${player.def}</div>
      <div style="margin-top:8px"><strong>Enemy</strong> — HP: <span id="enemyHP">${e.hp}</span> / ${e.maxHp}</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="actAttack">Attack</button>
        <button id="actSkill">Skill</button>
        <button id="actItem">Item</button>
        <button id="actFlee">Flee</button>
      </div>
      <div style="margin-top:8px"><div id="playerStatusBar" class="status-bar"></div><div id="enemyStatusBar" class="status-bar"></div></div>
    </div>`;
    $('#actAttack').onclick = playerAttack;
    $('#actSkill').onclick = playerSkill;
    $('#actItem').onclick = ()=> { openInventory(); };
    $('#actFlee').onclick = playerFlee;
    updateStatusBars();
  }

  function playerAttack() {
    if (!combatState) return;
    const e = combatState.enemy;
    // tick status effects start-of-turn
    tickStatuses(player);
    tickStatuses(e);
    if (player.stunned || player.frozen) { floatText("You cannot act!", 'red'); enemyTurn(); return; }
    // compute damage
    let base = Math.max(1, player.atk - Math.floor(e.def * 0.5) + Math.floor(Math.random()*6));
    // crit
    if (Math.random()*100 < (player.crit||5)) { base = Math.floor(base * 1.8); floatText("Crit!", 'gold'); }
    // apply runes/enchantments on weapon (if any)
    applyWeaponRunes(player, e, base);
    e.hp = Math.max(0, e.hp - base);
    floatText(`-${base}`, 'red'); $('#enemyHP').textContent = e.hp;
    if (e.hp <= 0) {
      combatVictory();
    } else {
      enemyTurn();
    }
    saveGame();
  }

  function playerSkill() {
    // simple skill: class-based
    const cls = player.class;
    if (cls === 'Cleric') {
      // heal small
      const heal = Math.max(8, Math.floor(player.maxHP * 0.18));
      player.hp = Math.min(player.maxHP, player.hp + heal);
      floatText(`Healed ${heal}`, 'green'); enemyTurn(); saveGame(); updateMainUI();
      return;
    }
    if (cls === 'Rogue') {
      // heavy crit attempt
      let dmg = Math.floor(player.atk * 1.7) + Math.floor(Math.random()*6);
      if (Math.random() < 0.6) { // high crit chance
        dmg = Math.floor(dmg * 1.5);
        floatText('Backstab!', 'gold');
      }
      combatState.enemy.hp = Math.max(0, combatState.enemy.hp - dmg);
      $('#enemyHP').textContent = combatState.enemy.hp;
      if (combatState.enemy.hp <= 0) combatVictory(); else enemyTurn();
      saveGame(); return;
    }
    if (cls === 'Mage') {
      // magic blast with chance to burn
      let dmg = Math.floor(player.atk * 1.4 + Math.random()*6);
      combatState.enemy.hp = Math.max(0, combatState.enemy.hp - dmg);
      if (Math.random() < 0.28) combatState.enemy.status = combatState.enemy.status || [], combatState.enemy.status.push({ type:'burn', dur:3, power:6 });
      $('#enemyHP').textContent = combatState.enemy.hp;
      if (combatState.enemy.hp <= 0) combatVictory(); else enemyTurn(); saveGame(); return;
    }
    // fallback: do basic attack
    playerAttack();
  }

  function playerFlee() {
    // simple flee chance based on speed
    const chance = Math.min(0.85, 0.25 + (player.spd||10)/100);
    if (Math.random() < chance) {
      floatText("You fled successfully.", 'gold');
      combatState = null; renderMainUI(); saveGame();
    } else {
      floatText("Failed to flee!", 'red'); enemyTurn();
    }
  }

  function enemyTurn() {
    if (!combatState) return;
    const e = combatState.enemy;
    // tick statuses on enemy & player again before acting
    tickStatuses(e);
    tickStatuses(player);
    if (e.hp <= 0) return;
    if (e.stunned || e.frozen) {
      floatText(`${e.name} cannot act!`, 'gold');
      renderCombatScreen(); return;
    }
    // enemy action: damage or special
    let dmg = Math.max(1, e.atk - Math.floor(player.def * 0.4) + Math.floor(Math.random()*5));
    // special behavior
    if (e.special === 'bleed' && Math.random() < 0.2) { player.status.push({ type:'bleed', dur:3, power:4 }); floatText('Bleeding!', 'red'); }
    if (e.special === 'poison' && Math.random() < 0.2) { player.status.push({ type:'poison', dur:3, power:4 }); floatText('Poisoned!', 'red'); }
    if (e.special === 'burn' && Math.random() < 0.18) { player.status.push({ type:'burn', dur:3, power:4 }); floatText('Burned!', 'red'); }
    if (e.special === 'rage' && e.hp < (e.maxHp*0.35)) dmg = Math.floor(dmg * 1.6);
    player.hp = Math.max(0, player.hp - dmg);
    floatText(`-${dmg}`, 'red');
    if (player.hp <= 0) {
      // player death handling
      floatText('You fell...', 'red'); combatState = null; renderMainUI(); player.hp = Math.floor(player.maxHP * 0.4); saveGame();
      return;
    }
    renderCombatScreen();
    saveGame();
  }

  function tickStatuses(target) {
    if (!target || !target.status) return;
    // resolve and decrement
    for (let i = target.status.length -1; i >=0; i--) {
      const s = target.status[i];
      if (s.type === 'poison') { const d = s.power || 5; target.hp = Math.max(0, target.hp - d); floatText(`☠️ -${d}`,'red'); }
      if (s.type === 'burn') { const d = s.power || 5; target.hp = Math.max(0, target.hp - d); floatText(`🔥 -${d}`,'red'); }
      if (s.type === 'bleed') { const d = s.power || 3; target.hp = Math.max(0, target.hp - d); floatText(`💉 -${d}`,'red'); }
      // regen
      if (s.type === 'regen') { const h = s.power || Math.max(1, Math.floor(target.maxHp*0.03)); target.hp = Math.min(target.maxHp, target.hp + h); floatText(`🌿 +${h}`,'green'); }
      s.dur--; if (s.dur <= 0) target.status.splice(i,1);
    }
  }

  function combatVictory() {
    const e = combatState.enemy;
    floatText(`Victory! +XP`, 'green');
    const xpGain = Math.max(10, Math.floor((e.maxHp + e.atk*4) / 12));
    player.xp = (player.xp || 0) + xpGain;
    // aces drop:
    const roll = Math.random();
    if (roll < 0.45) player.aces.Clubs++;
    else if (roll < 0.75) player.aces.Diamonds++;
    else if (roll < 0.92) player.aces.Hearts++;
    else player.aces.Spades++;
    // possible loot
    if (Math.random() < 0.38) player.inventory.push(randomLoot());
    combatState = null;
    // process levelup
    if (player.xp >= (player.nextXP || 100)) {
      player.level = (player.level||1) + 1;
      player.xp = 0;
      player.maxHP += 10; player.hp = player.maxHP; player.atk += 2;
      floatText('LEVEL UP! Fully healed', 'gold');
    }
    saveGame(); updateMainUI();
  }

  // ---------- Loot generator ----------
  function randomLoot() {
    const rarityRoll = Math.random();
    let rarity = 'Common';
    if (rarityRoll < 0.45) rarity = 'Common';
    else if (rarityRoll < 0.72) rarity = 'Uncommon';
    else if (rarityRoll < 0.9) rarity = 'Rare';
    else if (rarityRoll < 0.97) rarity = 'Epic';
    else rarity = 'Legendary';
    const types = ['Sword','Bow','Staff','Armor','Ring','Amulet','Potion'];
    const type = types[Math.floor(Math.random()*types.length)];
    // potions are usable
    if (type === 'Potion') {
      return { name:`${rarity} Healing Potion`, desc:'Heals when used', usable:true, type:'potion', power: 40 + Math.floor(Math.random()*60) };
    }
    const power = 6 + Math.floor(Math.random()*18) + (['Rare','Epic','Legendary'].includes(rarity)?10:0);
    const slot = (type==='Armor') ? 'Armor' : (type==='Ring'||type==='Amulet') ? 'Accessory' : 'Weapon';
    return { id:Math.random().toString(36).slice(2,8), name:`${rarity} ${type}`, rarity, power, slot, valueMultiplier: (rarity==='Common'?0.8:rarity==='Uncommon'?1.1:rarity==='Rare'?1.5:rarity==='Epic'?2.2:3.5) };
  }

  // ---------- Weapon/Runes application ----------
  function applyWeaponRunes(attacker, defender, damage) {
    const w = attacker.equipment.Weapon;
    if (!w) return;
    // handle runes array if present
    (w.runes || []).forEach(r => {
      if (r === 'burn' && Math.random() < 0.28) defender.status = defender.status || [], defender.status.push({ type:'burn', dur:3, power:6 });
      if (r === 'poison' && Math.random() < 0.28) defender.status = defender.status || [], defender.status.push({ type:'poison', dur:3, power:6 });
      if (r === 'lifesteal') {
        const heal = Math.max(1, Math.floor(damage * 0.12));
        attacker.hp = Math.min(attacker.maxHP, attacker.hp + heal);
        floatText(`🩸 +${heal}`,'green');
      }
    });
  }

  // ---------- UI helpers: modal, main UI ----------
  function showModal(title, html) {
    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `<div class="modal"><h2>${title}</h2><div style="margin-top:8px">${html}</div><div style="margin-top:12px"><button id="modalClose">OK</button></div></div>`;
    document.getElementById('modalClose').onclick = () => { modalContainer.style.display = 'none'; modalContainer.innerHTML = ''; };
  }
  function closeModal() { modalContainer.style.display = 'none'; modalContainer.innerHTML = ''; }

  function updateMainUI() {
    // If no player yet, do nothing (character creation handles start)
    if (!player) return;
    // If in combat, render combat; otherwise render main screen
    if (combatState) { renderCombatScreen(); return; }
    // update main panel
    const aceTotal = totalAcesValue(player.aces);
    gameUI.innerHTML = `<div class="panel">
      <h2>${player.emoji||''} ${player.name} — ${player.class} (Lv ${player.level})</h2>
      <div><strong>HP:</strong> ${player.hp}/${player.maxHP}</div>
      <div><strong>ATK:</strong> ${player.atk} • <strong>DEF:</strong> ${player.def}</div>
      <div><strong>XP:</strong> ${player.xp}/${player.nextXP||100}</div>
      <div style="margin-top:8px"><strong>Aces value:</strong> ${aceTotal} (♠${player.aces.Spades||0} ♥${player.aces.Hearts||0} ♦${player.aces.Diamonds||0} ♣${player.aces.Clubs||0})</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="exploreDungeon()">🕯️ Explore Dungeon</button>
        <button onclick="openMerchant()">🪙 Merchant</button>
        <button onclick="openInventory()">🎒 Inventory</button>
        <button onclick="openEnchantMenu()">🔮 Enchant</button>
        <button onclick="saveGame()">💾 Save</button>
      </div>
    </div>`;
    updateBiome();
  }

  // ---------- Biome visuals ----------
  function updateBiome() {
    // use player.level to pick biome
    const lvl = player.level || 1;
    let bg = "linear-gradient(to bottom, #1b3a1a, #081308)";
    if (lvl < 6) bg = "linear-gradient(to bottom, #1b3a1a, #081308)"; // forest
    else if (lvl < 11) bg = "linear-gradient(to bottom, #e6c76a, #d9a441)"; // desert
    else if (lvl < 16) bg = "linear-gradient(to bottom, #a9d3f5, #456ca8)"; // tundra
    else bg = "linear-gradient(to bottom, #4c0a1a, #2b0707)"; // volcano
    biomeBg.style.backgroundImage = bg;
    spawnParticles();
  }

  function spawnParticles(){
    particleLayer.innerHTML = '';
    for (let i=0;i<18;i++){
      const p = document.createElement('div'); p.className='particle';
      const size = Math.random()*6 + 2; p.style.width = p.style.height = `${size}px`;
      p.style.left = `${Math.random()*100}%`; p.style.bottom = `-${Math.random()*150}px`;
      p.style.background = `rgba(255,255,255,${Math.random()*0.7})`; p.style.animationDuration = `${4 + Math.random()*6}s`;
      particleLayer.appendChild(p);
    }
  }

  // ---------- Player death ----------
  function playerDeath() {
    floatText("You fell... respawning with partial HP", 'red');
    player.hp = Math.max(1, Math.floor(player.maxHP * 0.4));
    saveGame(); updateMainUI();
  }

  // ---------- Helper random enemy chooser for testing ----------
  // Exposed functions for console testing:
  window.NRPG = {
    addAcesValue, spendAces, randomLoot, startCombat: (e)=>startCombat(e), getPlayer: ()=>player
  };

  // ---------- Start / hookup ----------
  // If a player exists from save, show the main UI, else keep the character creation UI visible (index.html handles creation)
  if (player) {
    updateMainUI();
  } else {
    // character creation flow in index.html will call save then reload or call startGame; ensure global function exists
    window.startGame = function(createdPlayer){
      // If index.html's creation code stored player to localStorage under 'notebookSave', reload it
      const s = loadGame();
      if (s) { player = normalizePlayer(s); updateMainUI(); }
    };
  }

  // Provide global bindings for UI buttons (index.html uses these functions directly)
  window.openInventory = openInventory;
  window.openMerchant = openMerchant;
  window.exploreDungeon = exploreDungeon;
  window.openEnchantMenu = openEnchantMenu;
  window.saveGame = saveGame;
  window.toggleAdminPanel = function() {
    const ap = $('#adminPanel');
    if(!ap) return;
    ap.classList.toggle('visible');
    // load into inputs if present
    if ($('#adminName')) $('#adminName').value = player.name || '';
    if ($('#adminLevel')) $('#adminLevel').value = player.level || 1;
    if ($('#adminXP')) $('#adminXP').value = player.xp || 0;
    if ($('#adminHP')) $('#adminHP').value = player.hp || 0;
    if ($('#adminAces')) $('#adminAces').value = totalAcesValue(player.aces) || 0;
  };

  // If there is an admin panel with a Save button, attach it
  try {
    if ($('#adminSave')) $('#adminSave').addEventListener('click', ()=>{
      player.name = $('#adminName').value || player.name;
      player.level = Math.max(1, parseInt($('#adminLevel').value)||player.level);
      player.xp = parseInt($('#adminXP').value)||player.xp;
      player.hp = Math.min(player.maxHP, parseInt($('#adminHP').value)||player.hp);
      // set aces from total value input if present
      const val = parseInt($('#adminAces').value) || totalAcesValue(player.aces);
      player.aces = coinsFromValue(val);
      saveGame(); updateMainUI(); floatText('Admin save applied','green');
    });
  } catch(e){ /* ignore if not present yet */ }

})();
