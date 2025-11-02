/* Notebook RPG — single-file game core (modern UI) 
   - save key: "notebookSave"
   - inline creation controlled by index.html
   - turn-based combat, inventory, merchant, enchant, aces, biomes, admin
*/

(() => {
  const SAVE_KEY = "notebookSave";
  const ACE_VALUES = { Spades: 100, Clubs: 10, Diamonds: 25, Hearts: 50 };

  /* ---------------- DOM shorthand ---------------- */
  const $ = (s) => document.querySelector(s);
  const gameRoot = $('#gameRoot');
  const creationRoot = $('#creationRoot');
  const classListEl = $('#classList');
  const gameUI = $('#gameUI');
  const floatLayer = $('#floatLayer');
  const modalRoot = $('#modalContainer');
  const biomeBg = $('#biomeBackground');
  const particleLayer = $('#particleLayer');
  const adminPanel = $('#adminPanel');

  /* ---------------- Classes (same mapping used by creator) ---------------- */
  const CLASS_DEFS = {
    Knight: { hp: 120, atk: 10, def: 10, spd: 5, trait: "Extra armor on start" },
    Rogue: { hp: 90, atk: 12, def: 6, spd: 12, trait: "Higher crit chance" },
    Mage: { hp: 80, atk: 16, def: 4, spd: 8, trait: "Bonus magic damage" },
    Ranger: { hp: 100, atk: 11, def: 6, spd: 10, trait: "High accuracy" },
    Cleric: { hp: 95, atk: 8, def: 8, spd: 7, trait: "Self-heal every 3 turns" },
    Berserker: { hp: 110, atk: 14, def: 5, spd: 9, trait: "More damage at low HP" },
    Necromancer: { hp: 85, atk: 10, def: 5, spd: 7, trait: "Summon on win (mini)" },
    Paladin: { hp: 115, atk: 11, def: 9, spd: 6, trait: "Light resist" }
  };

  /* ---------------- Utility & UI helpers ---------------- */
  function floatPopup(text, tone='gold') {
    const el = document.createElement('div');
    el.className = 'floatText ' + (tone === 'green' ? 'green' : tone === 'red' ? 'red' : 'gold');
    el.textContent = text;
    el.style.left = `${15 + Math.random() * 70}%`;
    el.style.top = `${30 + Math.random() * 40}%`;
    floatLayer.appendChild(el);
    setTimeout(()=> el.remove(), 1400);
  }

  function showModal(title, html, onClose) {
    modalRoot.style.display = 'flex';
    modalRoot.innerHTML = `<div class="modalInner"><h3 style="margin-bottom:8px">${title}</h3>${html}<div style="margin-top:12px;text-align:right"><button id="modalOk" class="btn primary">OK</button></div></div>`;
    $('#modalOk').onclick = () => { modalRoot.style.display = 'none'; modalRoot.innerHTML = ''; if (onClose) onClose(); };
  }
  function closeModal(){ modalRoot.style.display = 'none'; modalRoot.innerHTML = ''; }

  function savePlayer(p) { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); }
  function loadPlayer() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }
  function coinsFromValue(total) {
    total = Math.max(0, Math.floor(total));
    const out = { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    const order = ['Spades','Hearts','Diamonds','Clubs'];
    for (const k of order) { out[k] = Math.floor(total / ACE_VALUES[k]); total = total % ACE_VALUES[k]; }
    return out;
  }
  function totalAcesVal(aces) {
    aces = aces || { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    return (aces.Spades||0)*ACE_VALUES.Spades + (aces.Hearts||0)*ACE_VALUES.Hearts + (aces.Diamonds||0)*ACE_VALUES.Diamonds + (aces.Clubs||0)*ACE_VALUES.Clubs;
  }

  /* ---------------- Default enemy pool ---------------- */
  const ENEMIES = [
    { id:'goblin', name:'Goblin', hp:28, atk:6, def:1, behavior:null },
    { id:'wolf', name:'Wild Wolf', hp:30, atk:7, def:0, behavior:null },
    { id:'bandit', name:'Bandit', hp:44, atk:9, def:2, behavior:'bleed' },
    { id:'imp', name:'Fire Imp', hp:58, atk:11, def:2, behavior:'burn' },
    { id:'orc', name:'Orc', hp:88, atk:14, def:4, behavior:'heavy' },
    { id:'specter', name:'Specter', hp:70, atk:12, def:3, behavior:'drain' },
    { id:'chieftain', name:'Warchief', hp:140, atk:22, def:7, behavior:'enrage' },
    { id:'cryptlord', name:'Crypt Lord', hp:260, atk:34, def:10, behavior:'curse' }
  ];

  /* ---------------- Player / state ---------------- */
  let player = null;
  let combat = null; // {enemy, state:'player'|'enemy'}

  /* Load or show creation */
  const saved = loadPlayer();
  if (saved) {
    player = normalizeLoadedPlayer(saved);
    enterGame();
  } else {
    showCreationUI();
  }

  /* ---------------- Creation UI wiring ---------------- */
  function showCreationUI() {
    creationRoot.classList.remove('hidden');
    gameRoot.classList.add('hidden');
    // render class cards
    classListEl.innerHTML = '';
    Object.keys(CLASS_DEFS).forEach(key => {
      const def = CLASS_DEFS[key];
      const card = document.createElement('div');
      card.className = 'classCard';
      card.innerHTML = `<div style="font-weight:700">${key}</div><div class="small">${def.trait}</div><div class="small" style="margin-top:6px">HP ${def.hp} • ATK ${def.atk} • DEF ${def.def}</div>`;
      card.addEventListener('click', ()=> {
        document.querySelectorAll('.classCard').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');
        chosenClass = key;
      });
      classListEl.appendChild(card);
    });
  }

  let chosenClass = null;
  $('#beginAdventure').addEventListener('click', () => {
    const name = ($('#charName').value || '').trim();
    const emoji = ($('#charEmoji').value || '').trim();
    if (!name) return alert('Enter a name.');
    if (!chosenClass) return alert('Pick a class.');
    // build player
    const def = CLASS_DEFS[chosenClass];
    player = {
      name,
      emoji: emoji || '',
      className: chosenClass,
      level: 1,
      xp: 0,
      nextXP: Math.max(100, Math.floor(120 * Math.pow(1, 1.5))),
      hp: def.hp, maxHP: def.hp,
      atk: def.atk, defStat: def.def, spd: def.spd,
      crit: chosenClass === 'Rogue' ? 13 : 6,
      aces: { Spades:0, Hearts:0, Diamonds:0, Clubs:0 },
      inventory: [],
      equipment: { Weapon:null, Armor:null, Accessory:null },
      status: []
    };
    savePlayer(player);
    enterGame();
  });

  $('#loadSaveBtn').addEventListener('click', () => {
    const s = loadPlayer();
    if (!s) return alert('No save found.');
    player = normalizeLoadedPlayer(s);
    enterGame();
  });

  function normalizeLoadedPlayer(p) {
    p.aces = p.aces || { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    p.inventory = p.inventory || [];
    p.equipment = p.equipment || { Weapon:null, Armor:null, Accessory:null };
    p.status = p.status || [];
    p.level = p.level || 1;
    p.nextXP = p.nextXP || Math.max(100, Math.floor(120 * Math.pow(p.level, 1.5)));
    p.hp = Math.min(p.maxHP || 100, p.hp || (p.maxHP || 100));
    p.maxHP = p.maxHP || p.hp || 100;
    return p;
  }

  /* ---------------- Enter game (after create/load) ---------------- */
  function enterGame() {
    creationRoot.classList.add('hidden');
    gameRoot.classList.remove('hidden');
    updateMainUI();
    updateBiome();
    spawnParticles();
    // wire admin hotkey and buttons
    window.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') toggleAdmin(); });
    if ($('#adminSave')) {
      $('#adminSave').addEventListener('click', () => { applyAdminChanges(); });
      $('#spawnLoot').addEventListener('click', ()=> { player.inventory.push(randomLoot()); updateMainUI(); savePlayer(player); });
      $('#addXP').addEventListener('click', ()=> { player.xp += 100; floatPopup('+100 XP','green'); checkLevelUp(); savePlayer(player); updateMainUI(); });
      $('#healFull').addEventListener('click', ()=> { player.hp = player.maxHP; savePlayer(player); updateMainUI(); });
      $('#resetGame').addEventListener('click', ()=> { if(confirm('Reset save?')) { localStorage.removeItem(SAVE_KEY); location.reload(); } });
    }
  }

  function toggleAdmin(){
    if(!adminPanel) return;
    adminPanel.classList.toggle('hidden');
    if(!adminPanel.classList.contains('hidden')) {
      $('#adminName').value = player.name || '';
      $('#adminLevel').value = player.level || 1;
      $('#adminXP').value = player.xp || 0;
      $('#adminHP').value = player.hp || player.maxHP || 100;
      $('#adminAces').value = totalAcesVal(player.aces);
    }
  }
  function applyAdminChanges(){
    player.name = $('#adminName').value || player.name;
    player.level = Math.max(1, parseInt($('#adminLevel').value)||player.level);
    player.xp = parseInt($('#adminXP').value)||player.xp;
    player.hp = Math.min(player.maxHP, parseInt($('#adminHP').value)||player.hp);
    const val = parseInt($('#adminAces').value) || totalAcesVal(player.aces);
    player.aces = coinsFromValue(val);
    savePlayer(player); updateMainUI(); floatPopup('Admin saved','green');
  }

  /* ---------------- Main UI rendering ---------------- */
  function updateMainUI() {
    if (combat) { renderCombatUI(); return; }
    const aceVal = totalAcesVal(player.aces);
    $('#playerBadge').textContent = `${player.emoji || ''} ${player.name}`;
    gameUI.innerHTML = `
      <div class="small">Class: ${player.className} • Lvl ${player.level}</div>
      <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
        <div><strong>HP</strong><div>${player.hp}/${player.maxHP}</div></div>
        <div><strong>ATK</strong><div>${player.atk}</div></div>
        <div><strong>DEF</strong><div>${player.defStat}</div></div>
        <div><strong>XP</strong><div>${player.xp}/${player.nextXP}</div></div>
        <div><strong>Aces</strong><div>${aceVal} (♠${player.aces.Spades||0} ♥${player.aces.Hearts||0} ♦${player.aces.Diamonds||0} ♣${player.aces.Clubs||0})</div></div>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" id="btnExplore">Explore Dungeon</button>
        <button class="btn" id="btnMerchant">Merchant</button>
        <button class="btn" id="btnInventory">Inventory</button>
        <button class="btn" id="btnEnchant">Enchant</button>
        <button class="btn" id="btnSave">Save</button>
      </div>
    `;
    $('#btnExplore').onclick = ()=> exploreDungeon();
    $('#btnMerchant').onclick = ()=> openMerchant();
    $('#btnInventory').onclick = ()=> openInventory();
    $('#btnEnchant').onclick = ()=> openEnchant();
    $('#btnSave').onclick = ()=> { savePlayer(player); floatPopup('Saved','green'); };
  }

  /* ---------------- Dungeon & Events ---------------- */
  function exploreDungeon(){
    // 60% combat, 20% chest, 10% merchant, 10% trap/rest
    const r = Math.random();
    if (r < 0.6) {
      startCombat(randomEnemy());
    } else if (r < 0.8) {
      const r2 = Math.random();
      if (r2 < 0.65) {
        const loot = randomLoot(); player.inventory.push(loot); floatPopup(`Found: ${loot.name}`, 'gold');
      } else {
        const val = 10 + Math.floor(Math.random()*60); addAcesValue(val); floatPopup(`Found ${val} value`, 'gold');
      }
      savePlayer(player); updateMainUI();
    } else if (r < 0.9) {
      openMerchant();
    } else {
      const dmg = Math.max(5, Math.floor(player.maxHP * 0.12)); player.hp = Math.max(1, player.hp - dmg);
      floatPopup(`Trap: -${dmg} HP`, 'red'); if (player.hp <= 0) playerDeath();
      savePlayer(player); updateMainUI();
    }
  }

  function randomEnemy() {
    const base = ENEMIES[Math.floor(Math.random()*ENEMIES.length)];
    const scale = 1 + Math.min(6, (player.level - 1)*0.06);
    return {
      id: base.id, name: base.name, hp: Math.max(10, Math.round(base.hp * scale)),
      maxHp: Math.max(10, Math.round(base.hp * scale)), atk: Math.max(1, Math.round(base.atk * scale)),
      def: base.def||0, behavior: base.behavior || null
    };
  }

  /* ---------------- Combat core (turn-based) ---------------- */
  function startCombat(enemy) {
    combat = { enemy, phase: 'player' };
    renderCombatUI();
  }

  function renderCombatUI() {
    if (!combat) return updateMainUI();
    const e = combat.enemy;
    gameUI.innerHTML = `
      <div class="card">
        <h3>Encounter — ${e.name}</h3>
        <div class="small">Enemy HP: <span id="enemyHP">${e.hp}</span>/<span>${e.maxHp}</span></div>
        <div style="margin-top:10px"><strong>You</strong> — HP ${player.hp}/${player.maxHP}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="attackBtn">Attack</button>
          <button class="btn" id="skillBtn">Skill</button>
          <button class="btn" id="itemBtn">Item</button>
          <button class="btn" id="fleeBtn">Flee</button>
        </div>
        <div style="margin-top:10px" id="combatLog" class="small muted"></div>
      </div>
    `;
    $('#attackBtn').onclick = playerAttack;
    $('#skillBtn').onclick = playerSkill;
    $('#itemBtn').onclick = ()=> { openInventory(); };
    $('#fleeBtn').onclick = playerFlee;
  }

  function playerAttack() {
    if (!combat) return;
    tickStatuses(player); tickStatuses(combat.enemy);
    if (player.stunned || player.frozen) { floatPopup("You can't act", 'red'); return enemyAct(); }
    let dmg = Math.max(1, player.atk - Math.floor((combat.enemy.def||0)*0.4) + Math.floor(Math.random()*6));
    // crit
    if (Math.random()*100 < (player.crit||5)) { dmg = Math.floor(dmg * 1.8); floatPopup('Critical!','gold'); }
    // runes/enchant (weapon effects)
    applyWeaponEffects(player, combat.enemy, dmg);
    combat.enemy.hp = Math.max(0, combat.enemy.hp - dmg);
    $('#enemyHP').textContent = combat.enemy.hp;
    floatPopup(`-${dmg}`, 'red');
    if (combat.enemy.hp <= 0) return winCombat();
    enemyAct();
  }

  function playerSkill(){
    const cls = player.className;
    if (cls === 'Cleric') { const heal = Math.max(8, Math.floor(player.maxHP * 0.18)); player.hp = Math.min(player.maxHP, player.hp + heal); floatPopup(`Healed ${heal}`,'green'); enemyAct(); savePlayer(player); return; }
    if (cls === 'Rogue') { let dmg = Math.floor(player.atk * 1.6) + Math.floor(Math.random()*4); if (Math.random()<0.6){ dmg = Math.floor(dmg*1.4); floatPopup('Backstab!','gold'); } combat.enemy.hp = Math.max(0, combat.enemy.hp - dmg); $('#enemyHP').textContent = combat.enemy.hp; if (combat.enemy.hp<=0) return winCombat(); enemyAct(); savePlayer(player); return; }
    if (cls === 'Mage') { let dmg = Math.floor(player.atk * 1.4) + Math.floor(Math.random()*6); combat.enemy.hp = Math.max(0, combat.enemy.hp - dmg); if (Math.random()<0.28) combat.enemy.status = combat.enemy.status || [], combat.enemy.status.push({type:'burn', dur:3, power:6}); $('#enemyHP').textContent = combat.enemy.hp; if (combat.enemy.hp<=0) return winCombat(); enemyAct(); savePlayer(player); return; }
    // fallback
    playerAttack();
  }

  function enemyAct(){
    if (!combat || !combat.enemy) return;
    tickStatuses(player); tickStatuses(combat.enemy);
    const e = combat.enemy;
    if (e.hp <= 0) return winCombat();
    // enemy special chance
    if (e.behavior === 'bleed' && Math.random() < 0.18) { player.status.push({type:'bleed', dur:3, power:4}); floatPopup('Bleeding','red'); }
    if (e.behavior === 'burn' && Math.random() < 0.16) { player.status.push({type:'burn', dur:3, power:5}); floatPopup('Burned','red'); }
    const dmg = Math.max(1, e.atk - Math.floor(player.defStat*0.4) + Math.floor(Math.random()*5));
    player.hp = Math.max(0, player.hp - dmg);
    floatPopup(`-${dmg}`, 'red');
    if (player.hp <= 0) { floatPopup('You fell...','red'); combat = null; player.hp = Math.max(1, Math.floor(player.maxHP*0.4)); savePlayer(player); updateMainUI(); return; }
    renderCombatUI(); savePlayer(player);
  }

  function playerFlee(){
    const chance = Math.min(0.9, 0.25 + (player.spd||8)/100);
    if (Math.random() < chance) { floatPopup('Fled!', 'gold'); combat = null; updateMainUI(); savePlayer(player); } else { floatPopup('Failed to flee','red'); enemyAct(); }
  }

  function tickStatuses(target){
    if (!target || !target.status) return;
    for (let i = target.status.length-1; i>=0; i--){
      const s = target.status[i];
      if (s.type === 'poison') { const d = s.power || 5; target.hp = Math.max(0, target.hp - d); floatPopup(`☠️ -${d}`,'red'); }
      if (s.type === 'burn')   { const d = s.power || 5; target.hp = Math.max(0, target.hp - d); floatPopup(`🔥 -${d}`,'red'); }
      if (s.type === 'bleed')  { const d = s.power || 3; target.hp = Math.max(0, target.hp - d); floatPopup(`💉 -${d}`,'red'); }
      if (s.type === 'regen')  { const h = s.power || Math.max(1, Math.floor(target.maxHP * 0.03)); target.hp = Math.min(target.maxHP, target.hp + h); floatPopup(`🌿 +${h}`,'green'); }
      s.dur--; if (s.dur <= 0) target.status.splice(i,1);
    }
  }

  function winCombat(){
    if (!combat) return;
    const e = combat.enemy;
    const xpGain = Math.max(8, Math.floor((e.maxHp + e.atk*5) / 12));
    player.xp = (player.xp||0) + xpGain;
    // drop aces
    const r = Math.random();
    if (r < 0.45) player.aces.Clubs++;
    else if (r < 0.75) player.aces.Diamonds++;
    else if (r < 0.92) player.aces.Hearts++;
    else player.aces.Spades++;
    // possible loot
    if (Math.random() < 0.38) player.inventory.push(randomLoot());
    floatPopup(`Victory! +${xpGain} XP`, 'green');
    combat = null;
    checkLevelUp();
    savePlayer(player); updateMainUI();
  }

  function checkLevelUp(){
    while (player.xp >= player.nextXP) {
      player.xp -= player.nextXP;
      player.level++;
      player.maxHP += Math.floor(8 + player.level * 1.2);
      player.atk += Math.floor(2 + player.level * 0.2);
      player.nextXP = Math.max(60, Math.floor(120 * Math.pow(player.level, 1.45)));
      player.hp = player.maxHP;
      floatPopup('LEVEL UP! Fully healed', 'gold');
    }
  }

  /* ---------------- Inventory / Merchant / Enchant ---------------- */
  function openInventory(){
    const itms = player.inventory || [];
    if (itms.length === 0) return showModal('Inventory','<div class="small">Empty</div>');
    let html = '<div style="display:flex;flex-direction:column;gap:8px">';
    itms.forEach((it, idx) => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)">
        <div><strong>${it.name}</strong><div class="small">${it.rarity||''} ${it.slot?('• '+it.slot):''}</div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${it.usable?`<button onclick="useInventory(${idx})">Use</button>`:''}
          ${it.slot?`<button onclick="equipInventory(${idx})">Equip</button>`:''}
          <button onclick="sellInventory(${idx})">Sell</button>
        </div>
      </div>`;
    });
    html += '</div>';
    showModal('Inventory', html);
  }
  window.useInventory = function(i) {
    const it = player.inventory[i];
    if (!it) return;
    if (it.type === 'potion') {
      player.hp = Math.min(player.maxHP, player.hp + (it.power||50));
      player.inventory.splice(i,1);
      floatPopup(`Healed +${it.power||50}`,'green'); savePlayer(player); updateMainUI(); closeModal();
    }
  };
  window.equipInventory = function(i){
    const it = player.inventory[i];
    if (!it) return;
    const slot = it.slot || 'Accessory';
    player.equipment[slot] = it;
    if (slot === 'Weapon') player.atk += Math.floor((it.power||7)/2);
    if (slot === 'Armor') { player.maxHP += (it.power||10); player.hp += (it.power||10); }
    player.inventory.splice(i,1);
    floatPopup(`Equipped ${it.name}`,'gold');
    savePlayer(player); updateMainUI(); closeModal();
  };
  window.sellInventory = function(i){
    const it = player.inventory[i];
    if (!it) return;
    const val = Math.max(5, Math.floor((it.power||10) * (it.valueMultiplier||1)));
    addAcesByValue(val);
    player.inventory.splice(i,1);
    floatPopup(`Sold for ${val} value`,'gold');
    savePlayer(player); updateMainUI(); closeModal();
  };

  function openMerchant(){
    let html = '<div class="small">Offers (value):</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">';
    const offers = [];
    for (let i=0;i<3;i++){
      const it = randomLoot();
      const price = Math.max(12, Math.floor((it.power||10) * (6 + Math.random()*8)));
      offers.push({it,price});
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)">
        <div><strong>${it.name}</strong><div class="small">${it.rarity||''} • ${it.slot||''}</div></div>
        <div style="text-align:right"><div class="small">${price} value</div><button onclick="buyOffer(${i})">Buy</button></div>
      </div>`;
    }
    html += `</div>`;
    player._offers = offers; showModal('Merchant', html);
  }
  window.buyOffer = function(i){
    const off = player._offers && player._offers[i];
    if(!off) return;
    if (!spendAces(off.price)) { floatPopup('Not enough Aces','red'); return; }
    player.inventory.push(off.it); floatPopup(`Bought ${off.it.name}`,'green'); savePlayer(player); updateMainUI(); closeModal();
  };

  function openEnchant(){
    const pool = [
      { id:'burn', name:'Burn Rune', cost:120, desc:'Chance to burn' },
      { id:'poison', name:'Poison Rune', cost:110, desc:'Chance to poison' },
      { id:'lifesteal', name:'Vampiric Rune', cost:170, desc:'Heal on hit' }
    ];
    let html = '<div style="display:grid;gap:8px">';
    pool.forEach((p,i)=> html += `<div style="padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)"><strong>${p.name}</strong><div class="small">${p.desc}</div><div style="margin-top:6px" class="small">Cost: ${p.cost}</div><div style="margin-top:8px"><button onclick="applyRune(${i})">Apply</button></div></div>`);
    html += '</div>';
    player._runes = pool; showModal('Enchant', html);
  }
  window.applyRune = function(i){
    const rune = player._runes && player._runes[i];
    if (!rune) return;
    if (!spendAces(rune.cost)) { floatPopup('Not enough Aces','red'); return; }
    const w = player.equipment.Weapon;
    if (!w) { floatPopup('No weapon equipped','red'); return; }
    w.runes = w.runes || []; w.runes.push(rune.id); floatPopup(`Applied ${rune.name}`,'gold'); savePlayer(player); closeModal();
  };

  function applyWeaponEffects(attacker, defender, damage) {
    const w = attacker.equipment.Weapon;
    if (!w) return;
    (w.runes || []).forEach(r => {
      if (r === 'burn' && Math.random() < 0.28) defender.status = defender.status || [], defender.status.push({type:'burn', dur:3, power:6});
      if (r === 'poison' && Math.random() < 0.28) defender.status = defender.status || [], defender.status.push({type:'poison', dur:3, power:6});
      if (r === 'lifesteal') { const heal = Math.max(1, Math.floor(damage*0.12)); attacker.hp = Math.min(attacker.maxHP, attacker.hp + heal); floatPopup(`🩸 +${heal}`,'green'); }
    });
  }

  /* ---------------- Loot generator ---------------- */
  function randomLoot(){
    const rarities = ['Common','Uncommon','Rare','Epic','Legendary'];
    const r = Math.random();
    let rarity = 'Common';
    if (r > 0.96) rarity='Legendary'; else if (r > 0.86) rarity='Epic'; else if (r > 0.7) rarity='Rare'; else if (r>0.45) rarity='Uncommon';
    const types = ['Sword','Bow','Staff','Armor','Ring','Amulet','Potion'];
    const type = types[Math.floor(Math.random()*types.length)];
    if (type === 'Potion') return { name:`${rarity} Healing Potion`, usable:true, type:'potion', power:40 + Math.floor(Math.random()*60), rarity };
    const power = 6 + Math.floor(Math.random()*18) + (rarity==='Rare'?8:rarity==='Epic'?16:0);
    const slot = (type==='Armor') ? 'Armor' : (type==='Ring'||type==='Amulet') ? 'Accessory' : 'Weapon';
    return { id:Math.random().toString(36).slice(2,8), name:`${rarity} ${type}`, rarity, power, slot, valueMultiplier:(rarity==='Common'?0.8:rarity==='Uncommon'?1.1:rarity==='Rare'?1.6:rarity==='Epic'?2.6:4.2) };
  }

  /* ---------------- Aces helpers ---------------- */
  function addAcesByValue(v){ addAcesByValueInternal(v); savePlayer(player); updateMainUI(); }
  function addAcesByValueInternal(v){
    const total = totalAcesVal(player.aces) + Math.floor(v);
    player.aces = coinsFromValue(total);
  }
  function spendAces(v){
    const total = totalAcesVal(player.aces);
    if (total < v) return false;
    player.aces = coinsFromValue(total - v);
    savePlayer(player);
    return true;
  }
  function coinsFromValue(total){
    return coinsFromValueGlobal(total);
  }
  function coinsFromValueGlobal(total) {
    total = Math.max(0, Math.floor(total));
    const out = { Spades:0, Hearts:0, Diamonds:0, Clubs:0 };
    const order = ['Spades','Hearts','Diamonds','Clubs'];
    for (const k of order) { out[k] = Math.floor(total / ACE_VALUES[k]); total = total % ACE_VALUES[k]; }
    return out;
  }

  /* ---------------- Biome visuals ---------------- */
  function updateBiome(){
    const lvl = player.level || 1;
    let bg = "linear-gradient(180deg,#071728,#031022)";
    if (lvl < 6) bg = "linear-gradient(180deg,#08262a,#041416)";
    else if (lvl < 11) bg = "linear-gradient(180deg,#3c2f10,#24170a)";
    else if (lvl < 16) bg = "linear-gradient(180deg,#0b2a3a,#031022)";
    else bg = "linear-gradient(180deg,#2b0505,#0a0000)";
    biomeBg.style.background = bg; spawnParticles();
  }
  function spawnParticles(){
    particleLayer.innerHTML = '';
    for (let i=0;i<18;i++){
      const p = document.createElement('div'); p.className='particle';
      const size = Math.random()*6 + 2; p.style.width = p.style.height = `${size}px`;
      p.style.left = `${Math.random()*100}%`; p.style.bottom = `${-Math.random()*200}px`;
      p.style.background = `rgba(255,255,255,${0.06 + Math.random()*0.1})`; p.style.animationDuration = `${4 + Math.random()*6}s`;
      particleLayer.appendChild(p);
    }
  }

  /* ---------------- Player death ---------------- */
  function playerDeath(){
    floatPopup('You perished... respawning at partial HP','red');
    player.hp = Math.max(1, Math.floor(player.maxHP * 0.4));
    savePlayer(player); updateMainUI();
  }

  /* ---------------- Expose small debug API ---------------- */
  window.NRPG = {
    player: ()=> player,
    save: ()=> savePlayer(player),
    addValue: (v)=> { addAcesByValueInternal(v); savePlayer(player); updateMainUI(); }
  };

})();
