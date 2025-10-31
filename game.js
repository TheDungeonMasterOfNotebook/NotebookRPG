/* game.js — Runic Neon complete engine
   - procedural floors (fixed progression)
   - classes, spells, relics, crafting stubs
   - autosave (full), load, reset
   - inventory, equipment, rarity tiers
   - shop, events, combat, boss floors
   - save toast indicator
*/

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const nowStr = () => (new Date()).toLocaleTimeString();
function log(msg){ if($('log')) $('log').innerHTML = `<div>[${nowStr()}] ${msg}</div>` + $('log').innerHTML; }

/* ---------- Save keys ---------- */
const SAVE_KEY = 'dim_phase2_final_v1';
const LEADER_KEY = 'dim_phase2_leader_v1';

/* ---------- Rarity & Items ---------- */
const rarities = [
  {key:'Common', css:'rarity-common', mult:1.0, chance:0.45},
  {key:'Uncommon', css:'rarity-uncommon', mult:1.2, chance:0.25},
  {key:'Rare', css:'rarity-rare', mult:1.5, chance:0.15},
  {key:'Epic', css:'rarity-epic', mult:2.0, chance:0.10},
  {key:'Legendary', css:'rarity-legendary', mult:3.0, chance:0.05}
];
function pickRarity(){
  const r = Math.random(); let c = 0;
  for(let it of rarities){ c += it.chance; if(r <= c) return it; }
  return rarities[0];
}
function makeItem(baseName, type, stats, baseCost){
  const r = pickRarity();
  return {
    baseName, type,
    rarity: r.key,
    rarityCss: r.css,
    nameHtml: `<span class="${r.css}">${r.key} ${baseName}</span>`,
    atk: stats.atk?Math.max(0, Math.round(stats.atk * r.mult)):0,
    def: stats.def?Math.max(0, Math.round(stats.def * r.mult)):0,
    hp: stats.hp?Math.max(0, Math.round(stats.hp * r.mult)):0,
    cost: Math.max(1, Math.round(baseCost * r.mult))
  };
}
function equipmentPool(){
  return [
    makeItem("Iron Sword","weapon",{atk:3},25),
    makeItem("Steel Sword","weapon",{atk:5},50),
    makeItem("Leather Armor","armor",{def:2},20),
    makeItem("Iron Armor","armor",{def:4},45),
    makeItem("Amulet of Vitality","accessory",{hp:10},40),
    makeItem("Ring of Power","accessory",{atk:2},40)
  ];
}

/* ---------- Classes ---------- */
const CLASSES = {
  Warrior: {
    baseHp: 28, baseAtk: 7, baseDef: 2, mag: 2,
    spells: ['Shield'],
    starter: [ makeItem('Rusty Sword','weapon',{atk:1},5), makeItem('Leather Armor','armor',{def:1},5) ]
  },
  Mage: {
    baseHp: 18, baseAtk: 3, baseDef: 1, mag: 8,
    spells: ['Firebolt','Lightning Strike','Heal'],
    starter: [ makeItem('Apprentice Staff','weapon',{atk:1},5), makeItem('Cloth Robe','armor',{def:1},4) ]
  },
  Rogue: {
    baseHp: 22, baseAtk: 5, baseDef:1, mag:4,
    spells: ['Ice Shard','Firebolt'],
    starter: [ makeItem('Dagger','weapon',{atk:2},8), makeItem('Leather Armor','armor',{def:2},10) ]
  }
};

/* ---------- Relics (simple examples) ---------- */
function makeRelic(name,desc,effect){ return { name, desc, effect, id: 'relic_' + name.replace(/\s+/g,'_').toLowerCase() }; }
const RELIC_POOL = [
  makeRelic('Ring of Fortune','+1 gold per kill', (s)=> s.goldPerKill = (s.goldPerKill||0)+1 ),
  makeRelic('Tome of Focus','Spells cost -1 MP', (s)=> s.spellDiscount = Math.min(2,(s.spellDiscount||0)+1) ),
  makeRelic('Ironwill','+2 base HP permanently', (s)=> s.baseHpBonus = (s.baseHpBonus||0) + 2)
];

/* ---------- Engine state ---------- */
let state = {
  runId: Date.now(),
  classKey: null,
  player: null,
  floorMap: {},  // floor -> { rooms: [...], pointer: 0 }
  currentEnemy: null,
  inCombat: false,
  relics: [],
  ngPlus: false,
  endless: false,
  leaderboard: JSON.parse(localStorage.getItem(LEADER_KEY) || '[]')
};

/* ---------- Audio (very lightweight beep) ---------- */
let audioCtx = null;
function beep(freq=440, t=0.04, vol=0.04){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + t);
  }catch(e){}
}

/* ---------- Derived stat helpers ---------- */
function derivePlayer(){
  if(!state.player) return;
  const p = state.player;
  p.maxHp = p.baseHp + (p.equip?.accessory?.hp || 0) + (p.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0);
  p.attack = p.baseAtk + (p.equip?.weapon?.atk || 0) + (p.equip?.accessory?.atk || 0);
  p.defense = p.baseDef + (p.equip?.armor?.def || 0);
  p.maxMp = Math.max(5, p.mag + 3);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
}

/* ---------- Save / Load / Auto-save ---------- */
function showSaveToast(){ const el = $('saveToast'); el.classList.add('show'); setTimeout(()=> el.classList.remove('show'),800); }
function fullSave(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    showSaveToast();
  }catch(e){ console.warn('save failed', e); }
}
function fullLoad(){
  const s = localStorage.getItem(SAVE_KEY);
  if(!s) return false;
  try{
    state = JSON.parse(s);
    // ensure derived values present
    derivePlayer();
    renderAll();
    log('📂 Saved run loaded.');
    return true;
  }catch(e){ console.warn('load error', e); return false; }
}
function resetAll(){
  if(!confirm('Reset your save and start new run?')) return;
  localStorage.removeItem(SAVE_KEY);
  state = { runId: Date.now(), classKey:null, player:null, floorMap:{}, currentEnemy:null, inCombat:false, relics:[], ngPlus:false, endless:false, leaderboard: state.leaderboard || [] };
  log('🔁 Save cleared. Start a new run with New Run.');
  renderAll();
  fullSave();
}

/* ---------- New run ---------- */
function newRun(classKey, ngPlus=false, endless=false){
  if(!CLASSES[classKey]) { alert('Invalid class'); return; }
  const cls = CLASSES[classKey];
  const player = {
    name: classKey,
    classKey,
    baseHp: cls.baseHp + (ngPlus?2:0),
    hp: cls.baseHp + (ngPlus?2:0),
    baseAtk: cls.baseAtk + (ngPlus?1:0),
    baseDef: cls.baseDef,
    mag: cls.mag,
    mp: 10,
    xp: 0,
    level: 1,
    gold: 12 + (ngPlus?10:0),
    potions: 1,
    ethers: 1,
    equip: { weapon:null, armor:null, accessory:null },
    inventory: (cls.starter||[]).slice(),
    spells: (cls.spells||[]).slice(),
    tempDef: 0,
    status: []
  };
  state.classKey = classKey;
  state.player = player;
  state.floorMap = {};
  state.currentEnemy = null;
  state.inCombat = false;
  state.relics = ngPlus ? (state.relics || []) : [];
  state.ngPlus = ngPlus;
  state.endless = endless;
  derivePlayer();
  log(`🆕 New run as ${classKey}${ngPlus? ' (NG+)':''}`);
  fullSave();
  renderAll();
}

/* ---------- Floor generation (fixed progression) ---------- */
function genFloor(floorNum){
  if(state.floorMap['f'+floorNum]) return state.floorMap['f'+floorNum];
  const rooms = [];
  const totalRooms = 6 + Math.floor(Math.min(10,floorNum));
  for(let i=0;i<totalRooms;i++){
    const r = Math.random();
    if(r < 0.50) rooms.push({type:'monster'});
    else if(r < 0.66) rooms.push({type:'treasure'});
    else if(r < 0.80) rooms.push({type:'event'});
    else if(r < 0.92) rooms.push({type:'shop'});
    else rooms.push({type:'rest'});
  }
  // place stairs as last room
  rooms.push({type:'stairs'});
  if(floorNum % 3 === 0) rooms.push({type:'boss'}); // boss appended near end for challenge
  state.floorMap['f'+floorNum] = { rooms, pointer: 0 };
  return state.floorMap['f'+floorNum];
}

/* ---------- Room flow (Enter Room) ---------- */
function enterRoom(){
  if(!state.player){ alert('Start a run first.'); return; }
  if(state.inCombat){ log('Finish current combat.'); return; }
  const floor = state.player.floor || 1;
  const fobj = genFloor(floor);
  const idx = fobj.pointer;
  if(idx >= fobj.rooms.length){
    // reached stairs end — advance floor
    log('You reach the stairs down.');
    descendFloor();
    fullSave();
    return;
  }
  const room = fobj.rooms[idx];
  fobj.pointer++;
  log(`➡ You enter a room: ${room.type}`);
  if(room.type === 'monster') startMonster();
  else if(room.type === 'treasure') openChest();
  else if(room.type === 'shop') openShop();
  else if(room.type === 'rest') useFountain();
  else if(room.type === 'event') runEvent();
  else if(room.type === 'stairs') {
    log('🔻 You found the stairs down.');
    descendFloor();
  } else if(room.type === 'boss') startBoss();
  renderAll();
  fullSave();
}

/* ---------- Descend floor ---------- */
function descendFloor(){
  if(!state.player) return;
  state.player.floor = (state.player.floor || 1) + 1;
  if(state.player.floor > 50 && !state.endless) state.player.floor = 50; // safety cap
  // heal a bit on descend
  derivePlayer();
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
  state.player.mp = Math.min(state.player.maxMp, state.player.mp + 4);
  log(`⬇️ You descend to floor ${state.player.floor}.`);
  fullSave();
  renderAll();
}

/* ---------- Monster & Boss creation ---------- */
function startMonster(){
  const floor = state.player.floor || 1;
  const names = ['Goblin','Skeleton','Bandit','Orc','Troll','Shadow Beast'];
  const n = names[rand(0,names.length-1)];
  state.currentEnemy = { name: n, hp: 8 + floor*6, atk: 2 + Math.floor(floor*1.1), status: [], isBoss: false };
  state.inCombat = true;
  log(`⚔️ A ${n} appears!`);
  fullSave();
  renderAll();
}
function startBoss(){
  const floor = state.player.floor || 1;
  if(floor === 3) state.currentEnemy = { name:'🕷️ Spider Queen', hp: 40 + floor*5, atk: 6 + floor, status: [], isBoss:true, ability:'poison' };
  else if(floor === 5) state.currentEnemy = { name:'💀 Dungeon Overlord', hp: 80 + floor*10, atk: 8 + floor, status: [], isBoss:true, ability:'rage' };
  else state.currentEnemy = { name:'Ancient Guardian', hp: 50 + floor*6, atk: 6 + floor, status: [], isBoss:true };
  state.inCombat = true;
  log(`🔥 Boss: ${state.currentEnemy.name} blocks your path!`);
  fullSave();
  renderAll();
}

/* ---------- Combat: player actions ---------- */
function playerAttack(){
  if(!state.inCombat || !state.currentEnemy) return;
  derivePlayer();
  const p = state.player;
  const atk = p.attack || 0;
  const r = rand(1,6);
  const dmg = Math.max(1, r + atk - Math.floor(state.currentEnemy.atk/3));
  state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg);
  log(`⚔️ You attack for ${dmg} damage (roll ${r}+atk ${atk}).`);
  beep(420,0.05,0.04);
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn();
  fullSave();
  renderAll();
}

function showSpellMenu(){
  $('spellMenu').classList.remove('hidden');
  renderSpellButtons();
}
function hideSpellMenu(){ $('spellMenu').classList.add('hidden'); }

function castSpell(spell){
  if(!state.inCombat || !state.currentEnemy) return;
  const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3};
  const discount = state.spellDiscount || 0;
  const cost = Math.max(0,(costMap[spell]||0) - discount);
  if(state.player.mp < cost){ log('Not enough MP.'); return; }
  state.player.mp -= cost;
  if(spell === 'Firebolt'){
    const dmg = 5 + state.player.floor;
    state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg);
    log(`🔥 Firebolt deals ${dmg}.`);
    beep(880,0.06,0.05);
  } else if(spell === 'Ice Shard'){
    const dmg = 3 + Math.floor(state.player.mag/4);
    state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg);
    state.currentEnemy.atk = Math.max(1, state.currentEnemy.atk - 1);
    log(`❄️ Ice Shard ${dmg} dmg, -1 ATK.`);
  } else if(spell === 'Heal'){
    const h = 5 + Math.floor(state.player.mag/3);
    state.player.hp = Math.min(maxHpLocal(), state.player.hp + h);
    log(`💚 Heal restores ${h} HP.`);
  } else if(spell === 'Lightning Strike'){
    if(Math.random() < 0.6){ const d = 8 + state.player.floor; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - d); log(`⚡ Lightning hits ${d}!`); } else log('⚡ Lightning missed!');
  } else if(spell === 'Shield'){
    state.player.tempDef = (state.player.tempDef||0) + 3;
    log('🛡️ Shield: +3 DEF next hit.');
  }
  hideSpellMenu();
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn();
  fullSave();
  renderAll();
}

function useItemCombat(){
  const p = state.player;
  if(p.potions > 0){ p.potions--; const heal = rand(6,12); p.hp = Math.min(maxHpLocal(), p.hp + heal); log(`🧴 Used Potion +${heal} HP.`); }
  else if(p.ethers > 0){ p.ethers--; const m = rand(4,8); p.mp = Math.min(p.maxMp || 10, p.mp + m); log(`🔮 Used Ether +${m} MP.`); }
  else log('No items available.');
  enemyTurn();
  fullSave();
  renderAll();
}

function attemptRun(){
  if(!state.inCombat) return;
  if(Math.random() < 0.5){ log('🏃 You escaped.'); state.inCombat = false; state.currentEnemy = null; renderAll(); fullSave(); }
  else { log('✋ Escape failed.'); enemyTurn(); fullSave(); }
}

/* ---------- Enemy turn & status ticking ---------- */
function tickStatus(entity){
  if(!entity || !entity.status || entity.status.length===0) return;
  const remaining = [];
  for(let s of entity.status){
    if(s.k === 'poison'){ entity.hp = Math.max(0, entity.hp - (s.p||1)); log(`${entity.name || 'You'} takes ${(s.p||1)} poison.`); }
    if(s.k === 'burn'){ entity.hp = Math.max(0, entity.hp - (s.p||2)); log(`${entity.name || 'You'} burns for ${(s.p||2)}.`); }
    s.t = (s.t||1) - 1;
    if(s.t > 0) remaining.push(s);
  }
  entity.status = remaining;
}

function enemyTurn(){
  if(!state.currentEnemy) return;
  tickStatus(state.currentEnemy);
  if(state.currentEnemy.hp <= 0) return onVictory();
  const e = state.currentEnemy;
  const dmg = Math.max(1, e.atk + rand(-1,1) - (state.player.defense || 0) - (state.player.tempDef||0));
  state.player.tempDef = 0;
  state.player.hp = Math.max(0, state.player.hp - dmg);
  log(`💥 ${e.name} strikes for ${dmg} damage.`);
  beep(220,0.05,0.06);
  tickStatus(state.player);
  if(state.player.hp <= 0){ log('💀 You died. Run ends.'); onRunEnd(); }
  // boss unique effects
  if(e.isBoss && e.ability === 'poison' && Math.random() < 0.25){ state.player.status = state.player.status || []; state.player.status.push({k:'poison',t:3,p:2}); log('🕷️ You are poisoned!'); }
  if(e.isBoss && e.ability === 'rage' && e.hp < 20 && Math.random() < 0.35){ e.atk += 2; log('💢 Boss enrages!'); }
}

/* ---------- Victory & rewards ---------- */
function onVictory(){
  const e = state.currentEnemy;
  const isBoss = !!e.isBoss;
  const extraPerKill = state.relics.some(r => r.id === 'relic_ring_of_fortune') ? 1 : 0;
  const goldGain = rand(8,16) + (state.player.floor || 1) * 3 + extraPerKill + (isBoss?18:0);
  state.player.gold = (state.player.gold||0) + goldGain;
  log(`🏆 Defeated ${e.name}. +${goldGain} gold.`);
  if(isBoss){
    const pool = equipmentPool();
    const reward = pool[rand(0,pool.length-1)];
    state.player.inventory = state.player.inventory || [];
    state.player.inventory.push(reward);
    state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12);
    log(`🎁 Boss reward: ${reward.rarity} ${reward.baseName}`);
  } else {
    if(Math.random() < 0.28){ state.player.potions = (state.player.potions||0)+1; log('🧴 Found a potion.'); }
    else if(Math.random() < 0.2){ const pool = equipmentPool(); const it = pool[rand(0,pool.length-1)]; state.player.inventory.push(it); log(`🎁 Drop: ${it.rarity} ${it.baseName}`); }
  }
  // XP & level
  const xpGain = 5 + (state.player.floor || 1);
  state.player.xp = (state.player.xp||0) + xpGain;
  checkLevel();
  // clear combat
  state.currentEnemy = null;
  state.inCombat = false;
  derivePlayer();
  fullSave();
  renderAll();
}

/* ---------- Leveling / Perks ---------- */
function checkLevel(){
  const p = state.player;
  const xpToLevel = 8 + p.level * 6;
  while(p.xp >= xpToLevel){
    p.xp -= xpToLevel;
    p.level++;
    // pick perk UI via prompt for simplicity
    const perks = [
      { name:'+3 Max HP', apply: (pl)=>{ pl.baseHp += 3; log('Perk chosen: +3 Max HP'); } },
      { name:'+1 ATK', apply: (pl)=>{ pl.baseAtk += 1; log('Perk chosen: +1 ATK'); } },
      { name:'+1 DEF', apply: (pl)=>{ pl.baseDef += 1; log('Perk chosen: +1 DEF'); } },
      { name:'+1 MAG', apply: (pl)=>{ pl.mag += 1; log('Perk chosen: +1 MAG'); } }
    ];
    const choices = [];
    while(choices.length < 2){ const c = perks[rand(0,perks.length-1)]; if(!choices.includes(c)) choices.push(c); }
    const pick = prompt(`Level up! Choose perk:\n1) ${choices[0].name}\n2) ${choices[1].name}\nEnter 1 or 2`, '1');
    const idx = pick === '2' ? 1 : 0;
    choices[idx].apply(p);
    derivePlayer();
    fullSave();
  }
}

/* ---------- Chest / Shop / Events ---------- */
function openChest(){
  if(!state.player) return;
  if(Math.random() < 0.55){
    const pool = equipmentPool();
    const it = pool[rand(0,pool.length-1)];
    state.player.inventory = state.player.inventory || [];
    state.player.inventory.push(it);
    log(`🎁 Chest: Found ${it.rarity} ${it.baseName}`);
  } else {
    const g = rand(6, 26) + (state.player.floor || 1) * 2;
    state.player.gold = (state.player.gold||0) + g;
    log(`💰 Chest: +${g} gold.`);
  }
  fullSave();
  renderAll();
}

let lastShop = [];
function openShop(){
  if(state.inCombat){ log('Cannot shop during combat.'); return; }
  const pool = equipmentPool();
  lastShop = [];
  for(let i=0;i<3;i++) lastShop.push(pool[rand(0,pool.length-1)]);
  lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8 });
  lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6 });
  let html = `<div class="small">Merchant's Wares</div><div class="shop-list" style="margin-top:8px">`;
  lastShop.forEach((it,idx)=>{
    html += `<div class="item-row"><div>${it.nameHtml || it.baseName}${it.rarity?` <span class="small muted">(${it.rarity})</span>`:''}</div><div><span class="small">${it.cost}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  log('🏪 Merchant appears.');
  fullSave();
}

function buy(idx){
  const it = lastShop[idx];
  if(!it) return;
  if(!state.player){ log('Start a run first'); return; }
  if(state.player.gold < it.cost){ log('Not enough gold.'); return; }
  state.player.gold -= it.cost;
  if(it.type === 'consumable'){ if(it.baseName==='Potion') state.player.potions = (state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers = (state.player.ethers||0)+1; log(`Bought ${it.baseName}`); }
  else { state.player.inventory = state.player.inventory || []; state.player.inventory.push(it); log(`Bought ${it.rarity || ''} ${it.baseName}`); }
  fullSave();
  renderAll();
}
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

/* ---------- Events ---------- */
const EVENTS = [
  { id:'lost_traveler', text:'A lost traveler asks for help (5g) — help for a chance at relic?', choices:[
    { label:'Help', func: ()=>{ if(state.player.gold < 5){ log('Not enough gold to help.'); return; } state.player.gold -= 5; if(Math.random() < 0.4){ const r = RELIC_POOL[rand(0,RELIC_POOL.length-1)]; state.relics.push(r); log(`They reward you: relic ${r.name}`); } else log('They depart empty-handed.'); } },
    { label:'Ignore', func: ()=>{ log('You ignore them.'); } }
  ]},
  { id:'cursed_fountain', text:'A dark fountain bubbles — drink? (may heal or poison)', choices:[
    { label:'Drink', func: ()=>{ if(Math.random() < 0.5){ state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12); log('It heals you.'); } else { state.player.status = state.player.status || []; state.player.status.push({k:'poison',t:3,p:2}); log('Cursed! You are poisoned.'); } } },
    { label:'Leave', func: ()=>{ log('You leave it be.'); } }
  ]},
  { id:'mystic_chest', text:'A rune chest hums — open?', choices:[
    { label:'Open', func: ()=>{ if(Math.random()<0.4){ const pool = equipmentPool(); const it = pool[rand(0,pool.length-1)]; state.player.inventory.push(it); log(`Found ${it.rarity} ${it.baseName}`); } else { const g = rand(8,30); state.player.gold += g; log(`Found ${g} gold.`); } } },
    { label:'Leave', func: ()=>{ log('You step away from the chest.'); } }
  ]}
];

function runEvent(){
  if(!state.player) return;
  const ev = EVENTS[rand(0, EVENTS.length-1)];
  log(`❓ Event: ${ev.text}`);
  let html = `<div class="small">${ev.text}</div><div class="shop-list" style="margin-top:8px">`;
  ev.choices.forEach((c, idx) => {
    html += `<div class="item-row"><div>${c.label}</div><div><button class="secondary" onclick="chooseEvent(${idx})">Choose</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  window.chooseEvent = function(idx){ ev.choices[idx].func(); renderAll(); fullSave(); closeShopPanel(); };
}

/* ---------- Inventory / Equip ---------- */
function openInventory(){
  if(!state.player) return;
  if(state.inCombat){ log('Finish combat first.'); return; }
  const inv = state.player.inventory || [];
  let html = `<div class="small">Inventory</div><div class="inv-list">`;
  if(inv.length === 0) html += `<div class="small">— empty —</div>`;
  inv.forEach((it, idx) => {
    const stats = `${it.atk?`ATK+${it.atk} `:''}${it.def?`DEF+${it.def} `:''}${it.hp?`HP+${it.hp}`:''}`;
    html += `<div class="item-row"><div>${it.nameHtml || it.baseName}<div class="small">${stats}</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
}

function equipItem(idx){
  const it = state.player.inventory[idx];
  if(!it) return;
  if(!['weapon','armor','accessory'].includes(it.type)){ log('Not equippable.'); return; }
  const slot = it.type;
  if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName}`); }
  state.player.equip[slot] = it;
  state.player.inventory.splice(idx,1);
  log(`🛡️ Equipped ${it.rarity} ${it.baseName}`);
  derivePlayer();
  fullSave();
  renderAll();
}
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity} ${it.baseName}\nATK:${it.atk}\nDEF:${it.def}\nHP:${it.hp}\nValue:${it.cost}g`); }

/* ---------- Helpers ---------- */
function totalDefLocal(){ return (state.player.baseDef || 0) + (state.player.equip?.armor?.def || 0); }
function maxHpLocal(){ return (state.player.baseHp || 0) + (state.player.equip?.accessory?.hp || 0) + (state.player.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0); }

/* ---------- Export log ---------- */
function exportLog(){
  const txt = $('log').innerText;
  const blob = new Blob([txt], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `dim_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
}

/* ---------- Leaderboard ---------- */
function showLeaderboard(){
  const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  if(lb.length === 0) { alert('No runs recorded.'); return; }
  lb.sort((a,b) => b.floor - a.floor);
  let txt = 'Local Leaderboard\n';
  lb.slice(0,10).forEach((e,i) => txt += `${i+1}. Floor ${e.floor} • Gold ${e.gold} • Class ${e.class}\n`);
  alert(txt);
}

/* ---------- Render / UI sync ---------- */
function renderSpellButtons(){
  const container = $('spellRow');
  container.innerHTML = '';
  if(!state.player) return;
  const spells = state.player.spells || [];
  const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3};
  spells.forEach(s => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = `${s} (${Math.max(0, (costMap[s]||0) - (state.spellDiscount||0))})`;
    b.onclick = ()=> { castSpell(s); $('spellMenu').classList.add('hidden'); };
    container.appendChild(b);
  });
}

function renderAll(){
  // player card
  if(state.player){
    $('playerName').innerText = state.player.name || '—';
    $('playerClass').innerText = state.classKey || '—';
    $('hp').innerText = Math.max(0, state.player.hp || 0);
    $('maxhp').innerText = maxHpLocal();
    $('mp').innerText = state.player.mp || 0;
    $('maxmp').innerText = state.player.maxMp || 10;
    $('atk').innerText = state.player.attack || 0;
    $('def').innerText = totalDefLocal();
    $('mag').innerText = state.player.mag || 0;
    $('floor').innerText = state.player.floor || 1;
    $('gold').innerText = state.player.gold || 0;
    $('xp').innerText = state.player.xp || 0;
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? state.player.equip.weapon.nameHtml : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? state.player.equip.armor.nameHtml : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? state.player.equip.accessory.nameHtml : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${(state.player.inventory||[]).length}`;
  } else {
    $('playerName').innerText = '—';
  }

  // combat UI toggle
  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = state.currentEnemy.name;
    $('enemyHP').innerText = state.currentEnemy.hp;
    $('enemyATK').innerText = state.currentEnemy.atk;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length) ? state.currentEnemy.status.map(s=>s.k).join(',') : '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = 'Battle — choose action.';
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore rooms, fight monsters, collect relics.';
  }

  renderSpellButtons();
  fullSave();
}

/* ---------- UI bindings ---------- */
$('btnNew').addEventListener('click', ()=> {
  const cls = prompt('New run — pick class: Warrior, Mage, Rogue', 'Warrior');
  if(!cls || !CLASSES[cls]){ alert('Invalid class'); return; }
  newRun(cls,false,false);
});
$('btnNGPlus').addEventListener('click', ()=>{
  const cls = prompt('NG+ run — pick class: Warrior, Mage, Rogue', 'Warrior');
  if(!cls || !CLASSES[cls]){ alert('Invalid class'); return; }
  newRun(cls,true,false);
});
$('btnReset').addEventListener('click', resetAll);
$('btnEnterRoom').addEventListener('click', enterRoom);
$('btnShop').addEventListener('click', openShop);
$('btnRest').addEventListener('click', ()=> {
  if(!state.player){ alert('Start a run first'); return; }
  if(state.player.gold < 5){ log('Not enough gold to rest.'); return; }
  state.player.gold -= 5;
  state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12);
  state.player.mp = Math.min(state.player.maxMp || 10, state.player.mp + 6);
  log('You rest at camp (5g) — HP & MP recovered.');
  renderAll();
  fullSave();
});
$('btnInventory').addEventListener('click', openInventory);
$('btnCodex').addEventListener('click', ()=> { alert('Codex: collect lore pages as you explore — coming soon.'); });
$('btnLeaderboard').addEventListener('click', showLeaderboard);
$('btnExport').addEventListener('click', exportLog);
$('btnAttack').addEventListener('click', playerAttack);
$('btnSpell').addEventListener('click', ()=> { $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
$('btnItem').addEventListener('click', useItemCombat);
$('btnRun').addEventListener('click', ()=> { if(confirm('Attempt to flee?')) attemptRun(); });
$('btnSpellBack').addEventListener('click', hideSpellMenu);

/* ---------- Boot: attempt autoload or start fresh ---------- */
if(!fullLoad()){
  log('No save found — click "New Run" to begin.');
  renderAll();
} else {
  renderAll();
}
