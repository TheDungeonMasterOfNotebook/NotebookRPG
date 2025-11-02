/*────────────────────────────────────────────────────────────
  Notebook RPG - Unified game.js
  Features:
  - Inline Character Creation (storybook style)
  - Classes, starting stats & emoji avatar
  - Turn-based combat + Status Effects (both sides)
  - Dungeon crawl (rooms, floors, boss)
  - Companions, Enchantments, Consumables, Merchant
  - Aces currency (4-tier), enchant & buy using Aces
  - Biomes and particle backgrounds
  - Admin panel (Ctrl+Shift+A)
  - Save/Load to localStorage "NotebookRPG_Player"
  - UI rendered into #gameUI, popups into #floatLayer
  ─────────────────────────────────────────────────────────---*/

(() => {
  // CONSTANTS & CONFIG
  const SAVE_KEY = "NotebookRPG_Player";
  const ACE_VALUES = { clubs: 10, diamonds: 25, hearts: 50, spades: 100 };
  const CLASS_DEFS = {
    "Knight":    { hp: 120, atk: 10, def: 10, spd: 5, trait: "Armor: +10% DEF" },
    "Rogue":     { hp: 90,  atk: 12, def: 6,  spd: 12, trait: "Crit: +8%" },
    "Mage":      { hp: 80,  atk: 16, def: 4,  spd: 8, trait: "Magic: +10% ATK" },
    "Ranger":    { hp: 100, atk: 11, def: 6,  spd: 10, trait: "Range: +5% crit" },
    "Cleric":    { hp: 95,  atk: 8,  def: 8,  spd: 7, trait: "Heal: regen every 3 turns" },
    "Berserker": { hp: 110, atk: 14, def: 5,  spd: 9, trait: "Rage: +15% ATK below 30% HP" },
    "Necromancer":{hp:85,  atk:10,  def:5,  spd:7, trait: "Summon skeleton companion" },
    "Paladin":   { hp:115, atk:10, def:9,  spd:6, trait: "Resist: -8% damage from dark" }
  };
  const BIOMES = [
    {name:"Forest", min:1, max:5, bg:"linear-gradient(to bottom, #1b3a1a, #081308)", color:"#67e667", particles:"leaf"},
    {name:"Desert", min:6, max:10, bg:"linear-gradient(to bottom, #e6c76a, #d9a441)", color:"#ffd47f", particles:"sand"},
    {name:"Tundra", min:11, max:15, bg:"linear-gradient(to bottom, #a9d3f5, #456ca8)", color:"#aaf", particles:"snow"},
    {name:"Volcano", min:16, max:20, bg:"linear-gradient(to bottom, #4c0a1a, #2b0707)", color:"#f33", particles:"ash"},
    {name:"Celestial", min:21, max:999, bg:"linear-gradient(to bottom, #3a0066, #000010)", color:"#c9f", particles:"star"}
  ];

  const ENCHANT_POOL = [
    {id:'flame', name:'Flame-Touched', effect:'burn', power:4, cost:120, desc:'Chance to apply Burn (3 turns)'},
    {id:'venom', name:'Venomous', effect:'poison', power:4, cost:120, desc:'Chance to Poison (3 turns)'},
    {id:'frost', name:'Frozen Edge', effect:'freeze', power:0, cost:140, desc:'Chance to Freeze (1 turn)'},
    {id:'shock', name:'Storm-Forged', effect:'stun', power:0, cost:140, desc:'Chance to Stun (1 turn)'},
    {id:'regen', name:"Nature's Grace", effect:'regen', power:6, cost:110, desc:'Chance to grant Regen (3 turns)'},
    {id:'vamp', name:'Vampiric', effect:'lifesteal', power:0.12, cost:180, desc:'Steal portion of damage as HP'}
  ];

  // DOM refs
  const $ = (q) => document.querySelector(q);
  const gameUI = $('#gameUI');
  const floatLayer = $('#floatLayer') || createFloatLayer();
  const biomeBg = $('#biomeBackground') || createBiomeBg();
  const particleLayer = $('#particleLayer') || createParticleLayer();
  const modalContainer = $('#modalContainer') || createModalContainer();
  const adminPanel = $('#adminPanel'); // expected to exist in index.html

  // Helper to ensure DOM elements exist if index doesn't have them
  function createFloatLayer(){ const el = document.createElement('div'); el.id='floatLayer'; document.body.appendChild(el); return el; }
  function createBiomeBg(){ const el = document.createElement('div'); el.id='biomeBackground'; document.body.appendChild(el); return el; }
  function createParticleLayer(){ const el = document.createElement('div'); el.id='particleLayer'; document.body.appendChild(el); return el; }
  function createModalContainer(){ const el = document.createElement('div'); el.id='modalContainer'; document.body.appendChild(el); return el; }

  // Game state
  let state = loadSave() || { // default initial state only if no save
    created: false,
    player: null,
    dungeon: null,
    companions: [],
    lastActive: Date.now()
  };

  // ---------- Character Creation UI (inline) ----------
  function renderCharacterCreation(){
    gameUI.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'panel';
    const title = document.createElement('h2');
    title.textContent = "A new page opens — Create your character";
    wrap.appendChild(title);

    const story = document.createElement('div');
    story.style.whiteSpace = 'pre-line';
    story.style.marginBottom = '12px';
    story.textContent = "From the margins of the notebook a figure emerges. Who will you write into this tale?";
    wrap.appendChild(story);

    // Name input
    const nameLabel = document.createElement('div');
    nameLabel.innerHTML = `<div class="small">Name</div><input id="cc_name" type="text" placeholder="Enter a name (e.g., Arin)"/>`;
    wrap.appendChild(nameLabel);

    // Class selection
    const classLabel = document.createElement('div');
    classLabel.innerHTML = `<div class="small" style="margin-top:8px">Class</div>`;
    const classBtns = document.createElement('div');
    classBtns.style.display = 'flex';
    classBtns.style.flexWrap = 'wrap';
    classBtns.style.gap='6px';
    Object.keys(CLASS_DEFS).forEach(cl => {
      const b = document.createElement('button');
      b.className = 'choiceBtn';
      b.textContent = cl;
      b.dataset.cls = cl;
      b.onclick = () => {
        document.querySelectorAll('#classPreview .choiceBtn.active').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        updateClassPreview(cl);
      };
      classBtns.appendChild(b);
    });
    classLabel.appendChild(classBtns);
    wrap.appendChild(classLabel);

    // emoji input and preview
    const emojiDiv = document.createElement('div');
    emojiDiv.style.marginTop = '8px';
    emojiDiv.innerHTML = `<div class="small">Avatar (optional)</div><input id="cc_emoji" type="text" maxlength="2" placeholder="e.g. 🗡️ or 🐺"/>`;
    wrap.appendChild(emojiDiv);

    // preview area
    const preview = document.createElement('div');
    preview.id = 'classPreview';
    preview.style.marginTop = '10px';
    preview.innerHTML = `<strong>Preview</strong><div id="previewStats" class="small" style="margin-top:6px">Pick a class to see starting stats & trait.</div>`;
    wrap.appendChild(preview);

    // Begin button
    const beginBtn = document.createElement('button');
    beginBtn.textContent = 'Begin Adventure';
    beginBtn.onclick = () => {
      const name = document.getElementById('cc_name').value.trim();
      const clsEl = document.querySelector('#classPreview .choiceBtn.active');
      const emoji = document.getElementById('cc_emoji').value.trim();
      if(!name) return alert("Please enter a name.");
      if(!clsEl) return alert("Please choose a class.");
      const cls = clsEl.dataset.cls;
      createNewPlayer(name, cls, emoji || '');
    };
    wrap.appendChild(beginBtn);

    gameUI.appendChild(wrap);

    function updateClassPreview(cls){
      const def = CLASS_DEFS[cls];
      $('#previewStats').innerHTML = `<div><strong>${cls}</strong> — ${def.trait}</div>
        <div>HP: ${def.hp} • ATK: ${def.atk} • DEF: ${def.def} • SPD: ${def.spd}</div>`;
      // make the active button visible in preview container too
      const btn = document.createElement('button'); btn.className='choiceBtn active'; btn.textContent = cls;
      const container = document.getElementById('classPreview');
      // minimal visual upkeep is done by class; actual DOM already updated above
    }
  }

  // Create new player and initialize state
  function createNewPlayer(name, cls, emoji){
    const def = CLASS_DEFS[cls];
    const player = {
      name,
      emoji: emoji || '',
      class: cls,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      baseMaxHp: def.hp,
      maxHp: def.hp,
      hp: def.hp,
      baseAttack: def.atk,
      attack: def.atk,
      defense: def.def,
      speed: def.spd,
      crit: 5,
      skills: { attack:0, defense:0, luck:0 },
      equipment: { Weapon: null, Armor: null, Accessory: null },
      loot: [],
      companions: [],
      statusEffects: [],
      aces: { clubs:0, diamonds:0, hearts:0, spades:0 },
      inventory: [],
      enchantments: {},
      createdAt: Date.now()
    };
    // special class passive adjustments
    if(cls === 'Rogue') player.crit += 8;
    if(cls === 'Mage') player.baseAttack = Math.floor(player.baseAttack * 1.08);
    if(cls === 'Knight') player.defense = Math.floor(player.defense * 1.08);
    // set into state and persist
    state.created = true;
    state.player = player;
    saveState();
    // go to main UI
    renderMainUI();
    showPopup(`Welcome, ${player.name} the ${player.class}!`);
  }

  // ---------------- XP curve ----------------
  function xpForLevel(l){
    return Math.max(60, Math.floor(120 * Math.pow(l, 1.55)));
  }

  // ---------------- Save / Load ----------------
  function saveState(){
    state.lastActive = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  function loadSave(){
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e){ console.warn("Failed to load save", e); return null; }
  }

  // ---------------- UI Utilities: popups, modal ----------------
  function showPopup(text, color='gold'){
    const el = document.createElement('div');
    el.className = 'floatText ' + (color==='green'?'green':(color==='red'?'red':'gold'));
    el.textContent = text;
    el.style.left = (20 + Math.random()*60) + '%';
    el.style.top = (30 + Math.random()*30) + '%';
    floatLayer.appendChild(el);
    setTimeout(()=> el.remove(), 1400);
  }
  function showModal(title, bodyHtml, onClose){
    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `<div class="modal"><h2>${title}</h2><div style="margin-top:8px">${bodyHtml || ''}</div><div style="margin-top:12px"><button id="modalOk">OK</button></div></div>`;
    $('#modalOk').onclick = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
      if(onClose) onClose();
    };
  }

  // ---------------- Aces currency helpers ----------------
  function totalAcesValue(aces){
    const a = aces || state.player.aces;
    return (a.clubs||0)*ACE_VALUES.clubs + (a.diamonds||0)*ACE_VALUES.diamonds + (a.hearts||0)*ACE_VALUES.hearts + (a.spades||0)*ACE_VALUES.spades;
  }
  function addAcesValue(value){
    // convert existing total plus value back into coin counts (greedy by spades->hearts->diamonds->clubs)
    const total = totalAcesValue() + Math.floor(value);
    const out = { spades:0, hearts:0, diamonds:0, clubs:0 };
    let remaining = total;
    const order = ['spades','hearts','diamonds','clubs'];
    for(const k of order){
      const v = ACE_VALUES[k];
      out[k] = Math.floor(remaining / v);
      remaining = remaining % v;
    }
    state.player.aces = out;
  }
  function trySpendAces(value){
    const total = totalAcesValue();
    if(total < value) return false;
    let rem = total - value;
    const out = {};
    const order = ['spades','hearts','diamonds','clubs'];
    for(const k of order){
      const v = ACE_VALUES[k];
      out[k] = Math.floor(rem / v);
      rem = rem % v;
    }
    // Because greedy above calculates remaining after spending => need to compute new coinset of remaining total; BUT easier: compute coin set of (total - value)
    // Instead do: compute coins for remaining
    let r = total - value;
    const coins = {spades:0,hearts:0,diamonds:0,clubs:0};
    for(const k of order){
      const v = ACE_VALUES[k];
      coins[k] = Math.floor(r / v); r = r % v;
    }
    state.player.aces = coins;
    return true;
  }

  // ---------------- Enchantments ----------------
  function openEnchantMenu(){
    // build enchant UI
    let html = `<div class="small">Your Aces value: ${totalAcesValue()} (auto-converted)</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">`;
    for(const e of ENCHANT_POOL){
      html += `<div class="enchant-card" style="border:1px solid #444;padding:8px;border-radius:8px">
        <div style="font-weight:bold">${e.name}</div>
        <div class="small">${e.desc}</div>
        <div class="small">Cost: ${e.cost} value</div>
        <div style="margin-top:6px"><button onclick="applyEnchantment('${e.id}')">Apply</button></div>
      </div>`;
    }
    html += `</div>`;
    showModal("Enchant Gear", html);
  }
  function applyEnchantment(id){
    const e = ENCHANT_POOL.find(x=>x.id===id);
    if(!e) return;
    if(!trySpendAces(e.cost)){ showPopup("Not enough Aces!", 'red'); return; }
    // enchant weapon by default
    const w = state.player.equipment.Weapon || { name: "Fists", enchantments: [] };
    w.enchantments = w.enchantments || [];
    // success chance
    const chance = 0.86;
    if(Math.random() < chance){
      w.enchantments.push(e);
      state.player.equipment.Weapon = w;
      showPopup(`Enchanted ${w.name} with ${e.name}!`);
    } else {
      showPopup(`Enchantment fizzled. Aces consumed.`, 'red');
    }
    saveState();
  }

  // Apply weapon enchant effects when dealing damage
  function applyWeaponEnchantments(attacker, defender, damage){
    const w = attacker.equipment && attacker.equipment.Weapon;
    if(!w || !w.enchantments) return;
    for(const ench of w.enchantments){
      if(ench.effect === 'burn' && Math.random() < 0.28) defender.statusEffects.push(new StatusEffect('Burn','burn',3,ench.power,'🔥'));
      if(ench.effect === 'poison' && Math.random() < 0.28) defender.statusEffects.push(new StatusEffect('Poison','poison',3,ench.power,'☠️'));
      if(ench.effect === 'freeze' && Math.random() < 0.18) defender.statusEffects.push(new StatusEffect('Freeze','freeze',1,0,'❄️'));
      if(ench.effect === 'stun' && Math.random() < 0.14) defender.statusEffects.push(new StatusEffect('Stun','stun',1,0,'⚡'));
      if(ench.effect === 'regen' && Math.random() < 0.5) attacker.statusEffects.push(new StatusEffect('Regen','regen',3,ench.power,'🌿'));
      if(ench.effect === 'lifesteal') {
        const heal = Math.max(1, Math.floor(damage * ench.power));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        showPopup(`🩸 +${heal}`, 'green');
      }
    }
  }

  // ---------------- Status Effects ----------------
  class StatusEffect {
    constructor(name, type, duration, power=0, emoji='') {
      this.name = name; this.type = type; this.duration = duration; this.power = power; this.emoji = emoji;
    }
    apply(target){
      switch(this.type){
        case 'poison':
          const pd = Math.max(1, Math.floor(target.maxHp * (this.power/100) || this.power));
          target.hp = Math.max(0, target.hp - pd);
          log(`${target.name||'You'} suffers Poison ${pd}.`);
          showPopup(`☠️ -${pd}`, 'red');
          break;
        case 'burn':
          const bd = Math.max(1, Math.floor(target.maxHp * (this.power/100) || this.power));
          target.hp = Math.max(0, target.hp - bd);
          log(`${target.name||'Enemy'} suffers Burn ${bd}.`);
          showPopup(`🔥 -${bd}`, 'red');
          break;
        case 'bleed':
          const bld = this.power || 3;
          target.hp = Math.max(0, target.hp - bld);
          showPopup(`💉 -${bld}`, 'red');
          break;
        case 'regen':
          const heal = this.power || Math.max(1, Math.floor(target.maxHp * 0.04));
          target.hp = Math.min(target.maxHp, target.hp + heal);
          showPopup(`🌿 +${heal}`, 'green');
          break;
        case 'freeze':
          target.frozen = true; showPopup('❄️ Freeze','red'); break;
        case 'stun':
          target.stunned = true; showPopup('⚡ Stun','red'); break;
      }
      this.duration--;
    }
  }

  function tickStatusFor(entity){
    if(!entity.statusEffects || !entity.statusEffects.length) return;
    // reset flags
    entity.frozen = false; entity.stunned = false;
    // iterate copy
    for(let i = entity.statusEffects.length - 1; i >= 0; i--){
      const s = entity.statusEffects[i];
      s.apply(entity);
      if(s.duration <= 0) entity.statusEffects.splice(i,1);
    }
  }

  // ---------------- Companion System ----------------
  class Companion {
    constructor(name, triggerTurns, ability, power){
      this.name = name;
      this.trigger = triggerTurns;
      this.ability = ability; this.power = power;
      this.turnCounter = 0;
      this.maxHp = 60; this.hp = this.maxHp;
    }
    tick(enemy){
      this.turnCounter++;
      if(this.turnCounter >= this.trigger){
        this.turnCounter = 0;
        // simple abilities
        if(this.ability === 'burn'){ enemy.hp = Math.max(0, enemy.hp - this.power); showPopup(`${this.name} burns enemy -${this.power}`); }
        if(this.ability === 'heal'){ state.player.hp = Math.min(state.player.maxHp, state.player.hp + this.power); showPopup(`${this.name} heals +${this.power}`,'green'); }
        if(this.ability === 'aceblow'){ const dmg = Math.max(1, Math.floor(totalAcesValue(state.player.aces)/20)); enemy.hp = Math.max(0, enemy.hp - dmg); showPopup(`${this.name} hits ${dmg}`); }
      }
    }
  }

  // ---------------- Dungeon System (text-based crawl) ----------------
  function newDungeon(){
    return {
      floor: 1,
      room: 0,
      roomsPerFloor: 5,
      floorCount: 5,
      descended: false,
      active: true
    };
  }

  function startDungeon(){
    if(!state.player) return;
    state.dungeon = newDungeon();
    saveState();
    renderDungeonUI();
    showPopup("You enter a shadowed dungeon...");
  }

  function renderDungeonUI(){
    const d = state.dungeon;
    if(!d){ renderMainUI(); return; }
    gameUI.innerHTML = '';
    const panel = document.createElement('div'); panel.className='panel';
    panel.innerHTML = `<h2>Dungeon — Floor ${d.floor} • Room ${d.room}/${d.roomsPerFloor}</h2>
      <div id="dungeonText" class="small" style="margin-bottom:10px">Choose to explore the next room.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="exploreBtn">Explore Room</button>
        <button id="leaveDungeonBtn">Leave Dungeon</button>
      </div>`;
    gameUI.appendChild(panel);
    $('#exploreBtn').onclick = () => exploreRoom();
    $('#leaveDungeonBtn').onclick = () => { state.dungeon = null; saveState(); renderMainUI(); showPopup("You leave the dungeon..."); };
  }

  function exploreRoom(){
    const d = state.dungeon;
    if(!d) return;
    d.room++;
    if(d.room > d.roomsPerFloor){
      // Floor cleared
      d.floor++;
      d.room = 1;
      showPopup(`You descend to floor ${d.floor}`);
      if(d.floor > d.floorCount){
        // Boss time
        encounterBoss();
        return;
      }
    }
    // pick random room type
    const roll = Math.random();
    if(roll < 0.45) encounterEnemy();
    else if(roll < 0.65) openChest();
    else if(roll < 0.78) openMerchantEncounter();
    else if(roll < 0.92) triggerTrap();
    else restSite();
    saveState();
  }

  function encounterEnemy(){
    // generate enemy scaled by floor & player level
    const lvl = Math.max(1, state.player.level + (state.dungeon.floor - 1));
    const rarityRoll = Math.random();
    const rarity = (rarityRoll<0.6)?'Common':(rarityRoll<0.85)?'Uncommon':(rarityRoll<0.96)?'Rare':'Epic';
    const hp = Math.floor(30 + lvl * 8 + (rarity==='Epic'?50:0));
    const atk = Math.floor(5 + lvl * 2 + (rarity==='Epic'?6:0));
    const mon = { id: 'm_'+Math.random().toString(36).slice(2,7), name: `${rarity} Marauder`, level:lvl, hp, maxHp:hp, attack:atk, rarity };
    state.currentEnemy = mon; state.inBattle = true;
    renderCombatUI(mon);
    showPopup(`A ${mon.name} appears!`);
  }

  function encounterBoss(){
    const lvl = state.player.level + state.dungeon.floor;
    const hp = Math.floor(180 + lvl * 14);
    const atk = Math.floor(18 + lvl * 3);
    const boss = { id:'boss_'+Date.now(), name:`Floor ${state.dungeon.floor} Boss`, level:lvl, hp, maxHp:hp, attack:atk, isBoss:true, rarity:'Boss' };
    state.currentEnemy = boss; state.inBattle = true;
    renderCombatUI(boss);
    showPopup(`A mighty boss emerges: ${boss.name}!`);
  }

  function openChest(){
    // loot or aces
    const roll = Math.random();
    if(roll < 0.6){
      const loot = generateLoot();
      state.player.loot.push(loot);
      showPopup(`Found ${loot.name}`);
    } else {
      // aces value
      const value = 10 + Math.floor(Math.random()*60);
      addAcesValue(value);
      showPopup(`Found ${value} value`);
    }
    renderDungeonUI();
  }

  function openMerchantEncounter(){
    // small merchant in dungeon
    showMerchantMini();
  }

  function triggerTrap(){
    const damage = Math.max(3, Math.floor(Math.random()*15 + state.dungeon.floor*3));
    state.player.hp = Math.max(1, state.player.hp - damage);
    showPopup(`Trap! -${damage} HP`, 'red');
    renderDungeonUI();
    saveState();
  }

  function restSite(){
    const heal = Math.floor(state.player.maxHp * 0.25);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    showPopup(`Rested +${heal} HP`, 'green');
    renderDungeonUI();
    saveState();
  }

  // ---------------- Combat UI & Loop ----------------
  function renderCombatUI(mon){
    gameUI.innerHTML = '';
    const panel = document.createElement('div'); panel.className='panel';
    panel.innerHTML = `<h2>${mon.name} (Lv ${mon.level})</h2>
      <div id="combatText" class="small" style="min-height:48px;margin-bottom:8px">Battle starts.</div>
      <div><strong>Your HP:</strong> ${state.player.hp}/${state.player.maxHp}</div>
      <div style="margin-top:8px">
        <button id="btnAttack">Attack</button>
        <button id="btnSpecial">Special</button>
        <button id="btnFlee">Flee</button>
      </div>
      <div style="margin-top:10px"><strong>Enemy HP:</strong> <span id="enemyHP">${mon.hp}</span> / ${mon.maxHp}</div>
      <div style="margin-top:8px"><div id="playerStatusBar" class="status-bar"></div><div id="enemyStatusBar" class="status-bar"></div></div>
    `;
    gameUI.appendChild(panel);
    $('#btnAttack').onclick = ()=> playerAttack(false);
    $('#btnSpecial').onclick = ()=> playerAttack(true);
    $('#btnFlee').onclick = ()=> { // simple flee
      state.inBattle = false; state.currentEnemy = null; showPopup('You fled the battle.'); renderDungeonUI(); saveState();
    };
    updateStatusBars();
    saveState();
  }

  function updateStatusBars(){
    // player statuses
    const pbar = $('#playerStatusBar');
    const ebar = $('#enemyStatusBar');
    if(pbar){
      pbar.innerHTML = (state.player.statusEffects||[]).map(s=>`<div class="status-icon status-${s.type.toLowerCase()}" title="${s.name}">${s.emoji||s.type[0]}</div>`).join('');
    }
    if(ebar && state.currentEnemy){
      ebar.innerHTML = (state.currentEnemy.statusEffects||[]).map(s=>`<div class="status-icon status-${s.type.toLowerCase()}" title="${s.name}">${s.emoji||s.type[0]}</div>`).join('');
    }
  }

  function playerAttack(isSpecial=false){
    const p = state.player;
    const mon = state.currentEnemy;
    if(!mon) return;
    // Start-of-turn status ticks for player & monster
    tickStatusFor(p); tickStatusFor(mon);
    updateStatusBars();
    if(p.stunned || p.frozen){ showPopup("You cannot act!", 'red'); enemyTurn(); return; }
    // compute base dmg
    let base = p.attack + Math.floor(p.level * 0.6) + Math.floor(Math.random()*4);
    if(isSpecial) base = Math.floor(base * 1.6);
    // crit
    if(Math.random() * 100 < p.crit){ base = Math.floor(base * 1.9); showPopup("Critical!", 'gold'); }
    // apply enchant effects
    applyWeaponEnchantments(p, mon, base);
    mon.hp = Math.max(0, mon.hp - base);
    $('#enemyHP').textContent = mon.hp;
    log(`You hit ${mon.name} for ${base}.`);
    // companion ticks
    (state.companions||[]).forEach(c => { if(c) c.tick(mon); });
    // check win
    if(mon.hp <= 0){ winCombat(mon); return; }
    // monster acts
    setTimeout(()=> { enemyTurn(); saveState(); }, 400);
    updateStatusBars();
    saveState();
  }

  function enemyTurn(){
    const mon = state.currentEnemy;
    const p = state.player;
    if(!mon) return;
    tickStatusFor(mon);
    tickStatusFor(p);
    updateStatusBars();
    if(mon.hp <= 0) return;
    // check freeze/stun
    if(mon.stunned || mon.frozen){ log(`${mon.name} cannot act.`); showPopup(`${mon.name} is disabled!`); return; }
    // attack
    let dmg = Math.max(1, mon.attack - Math.floor(p.defense * 0.5) + Math.floor(Math.random()*4));
    // companions shield maybe
    if(p._tempBuff && p._tempBuff.shield){ const red = Math.floor(dmg*0.3); dmg = Math.max(0, dmg - red); p._tempBuff.shield--; showPopup('Shield reduced damage'); }
    p.hp = Math.max(0, p.hp - dmg);
    log(`${mon.name} hits you for ${dmg}`);
    showPopup(`-${dmg}`, 'red');
    if(p.hp <= 0){
      // defeat
      showModal("You fell in the dungeon...", "You wake at the entrance — the notebook closes and reopens.");
      state.player.hp = Math.floor(state.player.maxHp * 0.4);
      state.dungeon = null; state.inBattle = false; state.currentEnemy = null;
      saveState(); renderMainUI();
    }
    updateStatusBars();
    saveState();
  }

  function winCombat(mon){
    state.inBattle = false;
    state.currentEnemy = null;
    // rewards: xp and aces & maybe loot
    const xp = Math.max(8, Math.floor((mon.maxHp + mon.attack*6) / 10));
    state.player.xp += xp;
    // level up checks
    while(state.player.xp >= state.player.xpToNext){
      state.player.xp -= state.player.xpToNext;
      state.player.level++;
      state.player.baseMaxHp += Math.floor(8 + state.player.level*1.6);
      state.player.baseAttack += Math.floor(2 + state.player.level*0.2);
      state.player.xpToNext = xpForLevel(state.player.level);
      state.player.maxHp = state.player.baseMaxHp;
      state.player.attack = state.player.baseAttack;
      state.player.hp = state.player.maxHp;
      showPopup('Level Up! Fully healed', 'gold');
    }
    // aces drop
    const ar = Math.random();
    if(ar < 0.45) state.player.aces.clubs++;
    else if(ar < 0.75) state.player.aces.diamonds++;
    else if(ar < 0.92) state.player.aces.hearts++;
    else state.player.aces.spades++;
    // possible loot
    if(Math.random() < 0.36){
      const item = generateLoot();
      state.player.loot.push(item);
      showPopup(`Loot: ${item.name}`);
    }
    showPopup(`+${xp} XP`, 'green');
    renderDungeonUI();
    saveState();
  }

  // ---------------- Loot generator ----------------
  function generateLoot(){
    const rarities = ["Common","Uncommon","Rare","Super Rare","Epic","Legendary","Mythic"];
    const rWeights = [45,28,12,8,5,1.5,0.5];
    const total = rWeights.reduce((s,v)=>s+v,0);
    let r = Math.random()*total; let idx = 0;
    for(let i=0;i<rWeights.length;i++){ r -= rWeights[i]; if(r<=0){ idx=i; break; } }
    const rarity = rarities[idx] || "Common";
    const types = ["Sword","Bow","Staff","Armor","Ring","Amulet"];
    const type = types[Math.floor(Math.random()*types.length)];
    const power = Math.max(1, Math.floor(5 + Math.random()*20 + idx*6));
    return { id: Math.random().toString(36).slice(2,8), name:`${rarity} ${type}`, rarity, power, slot: (type==="Armor"?"Armor": type==="Ring"||type==="Amulet"?"Accessory":"Weapon") };
  }

  // ---------------- Merchant mini or full ----------------
  function showMerchantMini(){
    const html = `<div class="small">A wandering merchant offers wares.</div>`;
    showModal("Merchant", html, ()=> renderDungeonUI());
    // in modal OK you can call openMerchant if we want full shop
  }

  function openMerchant(){
    let html = `<div class="small">Merchant inventory (prices in Aces value)</div><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">`;
    // generate offers
    for(let i=0;i<4;i++){
      const it = generateLoot();
      const price = Math.max(5, Math.floor(it.power * (10 + Math.random()*12)));
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;border:1px solid #333;border-radius:8px">
        <div><strong>${it.name}</strong><div class="small">${it.rarity} • ${it.slot}</div></div>
        <div><div class="small">${price} value</div><button onclick="buyMerchant('${it.id.replace(/'/g,'')}', ${price})">Buy</button></div>
      </div>`;
    }
    html += `</div>`;
    showModal("Merchant", html);
  }
  function buyMerchant(id, price){
    // simple: spend value (converted)
    if(!trySpendAces(price)){ showPopup("Not enough Aces", 'red'); return; }
    // create item by id generation (non-persistent)
    const item = generateLoot();
    state.player.loot.push(item);
    showPopup(`Purchased ${item.name}`, 'gold');
    saveState();
  }

  // ---------------- Biome updates & particles ----------------
  function updateBiome(){
    const lvl = state.player.level;
    const biome = BIOMES.find(b => lvl >= b.min && lvl <= b.max) || BIOMES[0];
    biomeBg.style.backgroundImage = biome.bg;
    biomeBg.style.filter = `drop-shadow(0 0 40px ${biome.color})`;
    spawnParticles(biome.particles);
  }

  function spawnParticles(type){
    particleLayer.innerHTML = '';
    const count = 18;
    for(let i=0;i<count;i++){
      const p = document.createElement('div');
      p.className ='particle';
      let size=4, color='#fff';
      switch(type){
        case 'leaf': size = 6; color = '#7fef74'; break;
        case 'sand': size = 3; color = '#ffd47f'; break;
        case 'snow': size = 5; color = '#fff'; break;
        case 'ash': size = 4; color = '#ff6e40'; break;
        case 'star': size = 2; color = '#b388ff'; break;
      }
      p.style.width = p.style.height = size + 'px';
      p.style.left = Math.random()*100 + 'vw';
      p.style.bottom = -Math.random()*200 + 'px';
      p.style.background = color;
      p.style.animationDuration = `${5 + Math.random()*8}s`;
      particleLayer.appendChild(p);
    }
  }

  // ---------------- Admin panel wiring ----------------
  function loadAdminData(){
    if(!adminPanel) return;
    $('#adminName').value = state.player ? state.player.name : '';
    $('#adminLevel').value = state.player ? state.player.level : 1;
    $('#adminXP').value = state.player ? state.player.xp : 0;
    $('#adminHP').value = state.player ? state.player.hp : 0;
    $('#adminAces').value = state.player ? totalAcesValue(state.player.aces) : 0;
  }
  function saveAdminData(){
    if(!adminPanel) return;
    state.player.name = $('#adminName').value;
    state.player.level = parseInt($('#adminLevel').value) || 1;
    state.player.xp = parseInt($('#adminXP').value) || 0;
    state.player.hp = parseInt($('#adminHP').value) || state.player.hp;
    // aces input is treated as raw value -> convert
    const val = parseInt($('#adminAces').value) || 0;
    // convert val -> coins greedy spades->hearts->diamonds->clubs
    let rem = val; const out = {spades:0,hearts:0,diamonds:0,clubs:0};
    ['spades','hearts','diamonds','clubs'].forEach(k => { out[k] = Math.floor(rem / ACE_VALUES[k]); rem = rem % ACE_VALUES[k]; });
    state.player.aces = out;
    saveState(); updateUI();
  }
  // admin actions (listeners) - only attach if adminPanel exist
  try {
    if(adminPanel){
      $('#adminSave').addEventListener('click', saveAdminData);
      $('#spawnLoot').addEventListener('click', ()=>{ const it = generateLoot(); state.player.loot.push(it); showPopup(`Spawned ${it.name}`); updateUI(); saveState();});
      $('#addXP').addEventListener('click', ()=>{ state.player.xp += 100; showPopup('+100 XP','green'); saveState(); updateUI(); });
      $('#healFull').addEventListener('click', ()=>{ state.player.hp = state.player.maxHp; showPopup('Healed','green'); saveState(); updateUI(); });
      $('#resetGame').addEventListener('click', ()=> { if(confirm('Reset all progress?')){ localStorage.removeItem(SAVE_KEY); location.reload(); }});
      window.addEventListener('keydown', (e) => { if(e.ctrlKey && e.shiftKey && e.code === 'KeyA'){ adminPanel.classList.toggle('visible'); loadAdminData(); }});
    }
  } catch(e){ console.warn('Admin panel wiring skipped', e); }

  // ---------------- UI render flow ----------------
  function renderMainUI(){
    // if no player created, show creation
    if(!state.created || !state.player){
      renderCharacterCreation(); return;
    }
    // main game UI: show player header, dungeon controls, merchant, inventory, equip
    gameUI.innerHTML = '';
    const p = state.player;
    const panel = document.createElement('div'); panel.className = 'panel';
    panel.innerHTML = `<h2>${p.emoji? p.emoji + ' ' : ''}${p.name} — ${p.class} (Lv ${p.level})</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="min-width:180px">
          <div><strong>HP:</strong> ${p.hp}/${p.maxHp}</div>
          <div><strong>ATK:</strong> ${p.attack} <strong>DEF:</strong> ${p.defense}</div>
          <div><strong>XP:</strong> ${p.xp} / ${p.xpToNext}</div>
          <div style="margin-top:6px"><strong>Aces:</strong> ♠${p.aces.spades||0} ♥${p.aces.hearts||0} ♦${p.aces.diamonds||0} ♣${p.aces.clubs||0}  (Total ${totalAcesValue(p.aces)})</div>
        </div>
        <div style="flex:1">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button id="btnExplore">Explore Dungeon</button>
            <button id="btnMerchant">Merchant</button>
            <button id="btnEnchant">Enchant Gear</button>
            <button id="btnInventory">Inventory</button>
            <button id="btnSave">Save</button>
          </div>
          <div style="margin-top:8px" id="miniLog" class="small"></div>
        </div>
      </div>
      <div style="margin-top:10px" id="companionsPanel"></div>
    `;
    gameUI.appendChild(panel);
    $('#btnExplore').onclick = ()=> startDungeon();
    $('#btnMerchant').onclick = ()=> openMerchant();
    $('#btnEnchant').onclick = ()=> openEnchantMenu();
    $('#btnInventory').onclick = ()=> openInventory();
    $('#btnSave').onclick = ()=> { saveState(); showPopup('Saved', 'green'); };
    renderCompanions();
    updateBiome();
  }

  function renderCompanions(){
    const cp = state.companions || [];
    const cpCont = $('#companionsPanel');
    if(!cpCont) return;
    cpCont.innerHTML = '';
    if(cp.length === 0){
      cpCont.innerHTML = `<div class="small">No companions</div>`;
      return;
    }
    cp.forEach(c => {
      const div = document.createElement('div');
      div.className = 'panel';
      div.style.display = 'inline-block';
      div.style.marginRight = '6px';
      div.innerHTML = `<div style="font-weight:bold">${c.name}</div><div class="small">HP: ${c.hp}/${c.maxHp}</div>`;
      cpCont.appendChild(div);
    });
  }

  function openInventory(){
    const items = state.player.loot || [];
    if(items.length === 0) return showModal('Inventory','<div class="small">Empty</div>');
    let html = `<div style="display:flex;flex-direction:column;gap:6px">`;
    items.forEach((it, idx) => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #333;border-radius:8px">
        <div><strong>${it.name}</strong><div class="small">${it.rarity} • ${it.slot} • Power ${it.power}</div></div>
        <div style="display:flex;flex-direction:column">
          <button onclick="equipFromInventory(${idx})">Equip</button>
          <button onclick="sellFromInventory(${idx})">Sell</button>
        </div>
      </div>`;
    });
    html += `</div>`;
    showModal('Inventory', html);
  }
  window.equipFromInventory = function(index){
    const it = state.player.loot[index];
    if(!it) return;
    state.player.equipment[it.slot] = it;
    // apply simple stat boost
    if(it.slot === 'Weapon') state.player.attack += Math.floor(it.power/2);
    if(it.slot === 'Armor') state.player.maxHp += Math.floor(it.power*2);
    state.player.loot.splice(index,1);
    saveState(); showPopup(`Equipped ${it.name}`); renderMainUI();
  };
  window.sellFromInventory = function(index){
    const it = state.player.loot[index];
    if(!it) return;
    const value = Math.max(5, Math.floor(it.power * (1 + (['Rare','Epic','Legendary','Mythic'].includes(it.rarity)?1.6:0))));
    addAcesValue(value);
    state.player.loot.splice(index,1);
    saveState(); showPopup(`Sold for ${value} value`);
    renderMainUI();
  };

  // ---------------- startup ----------------
  function init(){
    if(!state || !state.created || !state.player){
      renderCharacterCreation();
    } else {
      renderMainUI();
      updateBiome();
    }
    // attempt offline idle progression
    grantIdleProgress();
    // auto-save periodically
    setInterval(()=> saveState(), 5000);
  }

  // ---------------- Idle progression (generous) ----------------
  function grantIdleProgress(){
    if(!state || !state.player) return;
    const last = state.lastActive || state.player.createdAt || Date.now();
    const hours = (Date.now() - last) / 3600000;
    if(hours < 0.016) return;
    const battles = Math.floor(hours * 5);
    if(battles <= 0) return;
    const xpGain = battles * Math.max(12, Math.floor(18 + state.player.level * 2));
    state.player.xp += xpGain;
    addAcesValue(Math.floor(battles * 3));
    showPopup(`While away: +${xpGain} XP`, 'green');
    // simple level processing:
    while(state.player.xp >= state.player.xpToNext){
      state.player.xp -= state.player.xpToNext; state.player.level++; state.player.baseMaxHp += 8; state.player.baseAttack += 2;
      state.player.maxHp = state.player.baseMaxHp; state.player.attack = state.player.baseAttack; state.player.hp = state.player.maxHp;
      showPopup('Level Up (idle) — healed','gold');
    }
    saveState();
  }

  // ---------------- logging ----------------
  function log(msg){
    const mini = $('#miniLog');
    if(mini) {
      const p = document.createElement('div'); p.textContent = msg; mini.prepend(p);
      if(mini.children.length > 6) mini.removeChild(mini.lastChild);
    }
    console.log('[NRPG]', msg);
  }

  // expose some helpers for console/testing
  window.NRPG = {
    state, saveState, loadSave, addAcesValue, trySpendAces, applyEnchantment, spawnParticles
  };

  // initialize
  init();

})();
