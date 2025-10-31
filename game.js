/* Dungeons in the Margins — Phase 2 engine
   Features: classes, procedural floors, relics, crafting, achievements,
   status effects, autosave (full), NG+, endless, daily seed, sounds (WebAudio).
   Keep as single file game logic for now. */

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const now = () => new Date().toLocaleTimeString();
function log(msg){ $('log').innerHTML = `<div>[${now()}] ${msg}</div>` + $('log').innerHTML; }

/* ---------- Save keys ---------- */
const SAVE_KEY = 'dim_phase2_full_v1';
const LEADER_KEY = 'dim_phase2_leaderboard_v1';
const ACH_KEY = 'dim_phase2_achievements_v1';

/* ---------- Rarity & Item factories ---------- */
const rarities = [
  {key:'Common', css:'rarity-common', mult:1.0, chance:0.45},
  {key:'Uncommon', css:'rarity-uncommon', mult:1.2, chance:0.25},
  {key:'Rare', css:'rarity-rare', mult:1.5, chance:0.15},
  {key:'Epic', css:'rarity-epic', mult:2.0, chance:0.10},
  {key:'Legendary', css:'rarity-legendary', mult:3.0, chance:0.05}
];
function pickRarity(){
  let r = Math.random(), cum = 0;
  for(let it of rarities){ cum += it.chance; if(r <= cum) return it; }
  return rarities[0];
}
function makeItem(baseName,type,stats,cost){
  const r = pickRarity();
  return {
    baseName, type,
    rarity: r.key,
    rarityCss: r.css,
    nameHtml: `<span class="${r.css}">${r.key} ${baseName}</span>`,
    atk: stats.atk?Math.max(0, Math.round(stats.atk * r.mult)) : 0,
    def: stats.def?Math.max(0, Math.round(stats.def * r.mult)) : 0,
    hp: stats.hp?Math.max(0, Math.round(stats.hp * r.mult)) : 0,
    cost: Math.max(1, Math.round(cost * r.mult))
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
    spells: ['Shield'] ,
    starter: [ makeItem('Rusty Sword','weapon',{atk:1},5) , makeItem('Leather Armor','armor',{def:1},5) ]
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

/* ---------- Relics ---------- */
function makeRelic(name,desc,effect){
  return { name, desc, effect, id: 'relic_' + name.replace(/\s+/g,'_').toLowerCase() };
}
const RELIC_POOL = [
  makeRelic('Ring of Fortune','+1 gold per kill',(state)=> state.modGoldPerKill++ ),
  makeRelic('Tome of Focus','Spells cost -1 MP',(state)=> state.spellCostDiscount = Math.min(2,(state.spellCostDiscount||0)+1) ),
  makeRelic('Ironwill','+2 max HP permanently', (state)=> state.baseHpBonus = (state.baseHpBonus||0) + 2)
];

/* ---------- Achievements ---------- */
let achievements = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');

/* ---------- Game State (full) ---------- */
let seed = Math.floor(Math.random()*1000000); // used for daily or seeded dungeon
let state = {
  runId: Date.now(),
  classKey: null,
  player: null,
  floorMap: {}, // stores generated floors
  currentEnemy: null,
  inCombat: false,
  relics: [],
  ngPlus: false,
  endless: false,
  dailySeed: null,
  leaderboard: JSON.parse(localStorage.getItem(LEADER_KEY) || '[]'),
  achievements: achievements || {}
};

/* ---------- Sound (WebAudio) simple ---------- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio(){ if(!audioCtx) audioCtx = new AudioCtx(); }
function beep(freq=440, time=0.06, vol=0.08){ try{ initAudio(); const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='sine'; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + time); }catch(e){} }

/* ---------- Save / Load / Autosave ---------- */
function showSaveToast(){
  const el = $('saveToast'); el.classList.add('show'); setTimeout(()=> el.classList.remove('show'),900);
}
function fullSave(){
  try{
    const payload = { state, timestamp: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    showSaveToast();
  }catch(e){ console.warn('save failed', e); }
}
function fullLoad(){
  const s = localStorage.getItem(SAVE_KEY);
  if(!s) return false;
  try{
    const p = JSON.parse(s);
    state = p.state;
    // restore functions where necessary — items remain objects
    log('📂 Loaded save.');
    renderAll();
    return true;
  }catch(e){ console.warn('load failed', e); return false; }
}
function resetAll(){
  if(!confirm('Reset save and start fresh?')) return;
  localStorage.removeItem(SAVE_KEY);
  state = {
    runId: Date.now(),
    classKey: null,
    player: null,
    floorMap: {},
    currentEnemy: null,
    inCombat: false,
    relics: [],
    ngPlus: false,
    endless: false,
    dailySeed: null,
    leaderboard: state.leaderboard || [],
    achievements: state.achievements || {}
  };
  achievements = {};
  localStorage.removeItem(ACH_KEY);
  log('🔁 Save reset.');
  fullSave();
  renderAll();
}

/* ---------- Helpers: derived player stat ---------- */
function deriveStats(){
  const p = state.player;
  p.maxHp = p.baseHp + (p.equip?.accessory?.hp||0) + (p.equip?.armor?.hp||0) + (state.relics.find(r=>r.id==='relic_ironwill') ? (state.baseHpBonus||0 || 0) : 0);
  p.attack = p.baseAtk + (p.equip?.weapon?.atk||0) + (p.equip?.accessory?.atk||0);
  p.defense = p.baseDef + (p.equip?.armor?.def||0);
  p.maxMp = Math.max(5, p.mag + 3);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
}

/* ---------- Init new run ---------- */
function newRun(classKey, ngPlus=false, endless=false, daily=null){
  // create player state
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
    gold: 12 + (ngPlus?20:0),
    potions: 1,
    ethers: 1,
    equip: { weapon:null, armor:null, accessory:null },
    spells: cls.spells.slice(),
    level: 1,
    perks: []
  };
  // starter gear
  cls.starter.forEach(it=> player.inventory = (player.inventory||[] , player.inventory ? player.inventory.concat([]) : [] )); // seeds previously
  // simpler: give a starter item array
  player.inventory = (cls.starter || []).map(i=> i);
  // set into state
  state.classKey = classKey;
  state.player = player;
  state.floorMap = {};
  state.currentEnemy = null;
  state.inCombat = false;
  state.relics = ngPlus ? (state.relics || []) : []; // keep relics in NG+ maybe
  state.ngPlus = ngPlus || false;
  state.endless = endless || false;
  state.dailySeed = daily || null;
  deriveStats();
  log(`🆕 New run: ${classKey}${ngPlus? ' (NG+)':''}${endless? ' (Endless)':''}`);
  fullSave();
  renderAll();
}

/* ---------- Procedural floor generation ---------- */
function genFloor(floorNum, seedVal){
  // Simple seeded RNG omitted for brevity — use Math.random for now; can be replaced by seeded RNG later.
  // Each floor returns an array of rooms: {type:'monster'|'shop'|'rest'|'event'|'treasure'|'boss'}
  const rooms = [];
  const totalRooms = 6 + Math.floor(Math.min(10,floorNum));
  for(let i=0;i<totalRooms;i++){
    const r = Math.random();
    if(r < 0.5) rooms.push({ type:'monster' });
    else if(r < 0.65) rooms.push({ type:'treasure' });
    else if(r < 0.78) rooms.push({ type:'event' });
    else if(r < 0.9) rooms.push({ type:'shop' });
    else rooms.push({ type:'rest' });
  }
  // place boss at end if boss floor (every 3rd)
  if(floorNum % 3 === 0) rooms.push({ type:'boss' });
  state.floorMap[`f${floorNum}`] = { rooms, pointer:0 };
  return state.floorMap[`f${floorNum}`];
}

/* ---------- Events (choice-driven) ---------- */
const EVENTS = [
  { id:'lost_traveler', text:'A lost traveler asks for help — give 5 gold to gain a relic chance?', choices:[
    { name:'Help (5g)', func: (s)=>{ if(s.player.gold < 5) { log('Not enough gold.'); return; } s.player.gold -= 5; if(Math.random() < 0.4){ const r = RELIC_POOL[rand(0,RELIC_POOL.length-1)]; s.relics.push(r); log(`You aided them — found relic: ${r.name}`); } else log('They are gone; nothing found.'); } },
    { name:'Ignore', func: (s)=>{ log('You ignore them and move on.'); } }
  ]},
  { id:'cursed_fountain', text:'A dark fountain bubbles — drink? (may heal or curse)', choices:[
    { name:'Drink', func: (s)=>{ if(Math.random()<0.5){ s.player.hp = Math.min(maxHpLocal(s), s.player.hp + 12); log('It heals you!'); } else { applyStatusLocal(s.player, {k:'poison',t:3,p:2}); log('Oh no — poison!'); } } },
    { name:'Leave', func: (s)=>{ log('You leave the fountain alone.'); } }
  ]},
  { id:'mysterious_chest', text:'A chest with runes — open it?', choices:[
    { name:'Open', func: (s)=>{ if(Math.random()<0.4){ const pool = equipmentPool(); const it = pool[rand(0,pool.length-1)]; s.player.inventory.push(it); log(`You found ${it.rarity} ${it.baseName}`); } else { const g = rand(8, 30); s.player.gold += g; log(`Found ${g} gold.`); } } },
    { name:'Ignore', func: (s)=>{ log('You choose not to risk it.'); } }
  ]}
];
function runEvent(floor){
  const ev = EVENTS[rand(0,EVENTS.length-1)];
  $('shopPanel').innerHTML = `<div class="small">${ev.text}</div>`;
  log(`❓ Event: ${ev.text}`);
  // present choices as buttons in panel
  let html = `<div class="small">${ev.text}</div><div class="shop-list" style="margin-top:8px">`;
  ev.choices.forEach((c,i)=>{
    html += `<div class="item-row"><div>${c.name}</div><div><button class="secondary" onclick="chooseEvent(${i})">Choose</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  // link choice
  window.chooseEvent = function(idx){
    ev.choices[idx].func(state);
    renderAll();
    fullSave();
    closeShopPanel();
  };
}

/* ---------- Helper local wrappers used above ---------- */
function applyStatusLocal(target, status){ // target is player or enemy
  target.status = target.status || [];
  target.status.push(status);
}
function maxHpLocal(s){
  return s.player.baseHp + (s.player.equip?.accessory?.hp||0) + (s.player.equip?.armor?.hp||0) + (s.baseHpBonus||0||0);
}

/* ---------- Exploration flow (room handling) ---------- */
function explore(){
  if(state.inCombat){ log('Finish the fight first.'); return; }
  const floor = state.player.floor;
  let fobj = state.floorMap[`f${floor}`];
  if(!fobj) fobj = genFloor(floor);
  const pointer = fobj.pointer;
  if(pointer >= fobj.rooms.length){ // reached floor end => descend
    log('You reach the stair down.');
    descendFloor();
    fullSave();
    return;
  }
  const room = fobj.rooms[pointer];
  fobj.pointer++;
  log(`➡ You enter a room: ${room.type}`);
  // handle types
  if(room.type === 'monster'){ startMonster(); }
  else if(room.type === 'treasure'){ openChest(); }
  else if(room.type === 'shop'){ openShop(); }
  else if(room.type === 'rest'){ useFountain(); }
  else if(room.type === 'event'){ runEvent(floor); }
  else if(room.type === 'boss'){ startBoss(); }
  renderAll();
  fullSave();
}

/* ---------- Combat helpers ---------- */
function startMonster(){
  const floor = state.player.floor;
  const enemyNames = ['Goblin','Skeleton','Bandit','Orc','Troll','Dark Mage'];
  const name = enemyNames[rand(0,enemyNames.length-1)];
  state.currentEnemy = { name, hp: 8 + floor*6, atk: 2 + Math.floor(floor*1.1), status:[], isBoss:false };
  state.inCombat = true;
  log(`⚔️ Encountered ${name} (HP ${state.currentEnemy.hp}).`);
  deriveStats();
  fullSave();
  renderAll();
}
function startBoss(){
  const floor = state.player.floor;
  state.currentEnemy = (floor === 3) ? { name:'🕷️ Spider Queen', hp:40 + floor*5, atk:6 + floor, status:[], isBoss:true, ability:'poison' } :
                      (floor === 5) ? { name:'💀 Dungeon Overlord', hp:80 + floor*10, atk:8 + floor, status:[], isBoss:true, ability:'rage' } :
                      { name:'Ancient Guardian', hp:40 + floor*6, atk:6 + floor, status:[], isBoss:true, ability:null };
  state.inCombat = true;
  log(`🔥 Boss appears: ${state.currentEnemy.name}`);
  fullSave();
  renderAll();
}

/* apply status tick at end of enemy or player turn */
function tickStatus(entity){
  if(!entity.status || entity.status.length===0) return;
  // process statuses array of {k,t,p}
  const remaining = [];
  for(let s of entity.status){
    if(s.k === 'poison'){ entity.hp = Math.max(0, entity.hp - (s.p||1)); log(`${entity.name || 'You'} suffers ${s.p||1} poison damage.`); }
    if(s.k === 'burn'){ entity.hp = Math.max(0, entity.hp - (s.p||2)); log(`${entity.name || 'You'} burns for ${(s.p||2)} damage.`); }
    s.t = (s.t||1) - 1;
    if(s.t > 0) remaining.push(s);
  }
  entity.status = remaining;
}

/* Player action: attack */
function playerAttack(){
  if(!state.inCombat || !state.currentEnemy) return;
  const p = state.player;
  deriveStats();
  const atk = p.attack;
  const roll = rand(1,6);
  const damage = Math.max(1, roll + atk - Math.floor(state.currentEnemy.atk/3));
  state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - damage);
  log(`⚔️ You hit for ${damage} (roll ${roll} + atk ${atk}).`);
  beep(400,0.04,0.04);
  if(state.currentEnemy.hp <= 0) return onVictory();
  // enemy turn
  enemyTurn();
  fullSave();
  renderAll();
}

/* Spell casting (names: 'Firebolt','Ice Shard','Heal','Lightning Strike','Shield') */
function castSpell(spell){
  if(!state.inCombat || !state.currentEnemy) return;
  const p = state.player;
  const costTable = { 'Firebolt':3, 'Ice Shard':4, 'Heal':4, 'Lightning Strike':5, 'Shield':3 };
  const cost = (costTable[spell] || 0) - (state.spellCostDiscount||0);
  if(p.mp < Math.max(0,cost)){ log("Not enough MP."); return; }
  p.mp -= Math.max(0,cost);
  if(spell === 'Firebolt'){ const dmg = 5 + state.player.floor; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg); log(`🔥 Firebolt deals ${dmg}.`); beep(900,0.06,0.06); }
  else if(spell === 'Ice Shard'){ const dmg = 3 + Math.floor(p.mag/4); state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg); state.currentEnemy.atk = Math.max(1, state.currentEnemy.atk - 1); log(`❄️ Ice Shard ${dmg} dmg, -1 ATK.`); }
  else if(spell === 'Heal'){ const h = 5 + Math.floor(p.mag/3); p.hp = Math.min(maxHpLocal(), p.hp + h); log(`💚 Heal: +${h} HP.`); }
  else if(spell === 'Lightning Strike'){ if(Math.random() < 0.6){ const d = 8 + state.player.floor; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - d); log(`⚡ Lightning hits ${d}.`); } else log('⚡ Lightning missed!'); }
  else if(spell === 'Shield'){ p.tempDef = (p.tempDef||0) + 3; log('🛡️ Shield: +3 DEF next hit.'); }
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn();
  fullSave();
  renderAll();
}

/* Use item in combat */
function useItemCombat(){
  const p = state.player;
  if(p.potions > 0){ p.potions--; const heal = rand(6,12); p.hp = Math.min(maxHpLocal(), p.hp + heal); log(`🧴 Used potion +${heal} HP.`); }
  else if(p.ethers > 0){ p.ethers--; const m = rand(4,8); p.mp = Math.min(p.maxMp || 10, p.mp + m); log(`🔮 Used ether +${m} MP.`); }
  else log('No items.');
  enemyTurn();
  fullSave();
  renderAll();
}

/* enemy turn logic */
function enemyTurn(){
  if(!state.currentEnemy) return;
  // enemy acts
  let e = state.currentEnemy;
  // status tick first
  tickStatus(e);
  if(e.hp <= 0) return onVictory();
  // compute damage
  const dmg = Math.max(1, e.atk + rand(-1,1) - totalDefLocal() - (state.player.tempDef || 0));
  state.player.tempDef = 0;
  state.player.hp = Math.max(0, state.player.hp - dmg);
  log(`💥 ${e.name} hits you for ${dmg} damage.`);
  beep(200,0.05,0.06);
  tickStatus(state.player);
  if(state.player.hp <= 0){ log('💀 You died. Run over.'); onRunEnd(); }
  // boss abilities (example)
  if(e.isBoss && e.ability === 'poison' && Math.random() < 0.25){ state.player.status = state.player.status || []; state.player.status.push({k:'poison',t:3,p:2}); log('🕷️ You were poisoned!'); }
  if(e.isBoss && e.ability === 'rage' && e.hp < 20 && Math.random() < 0.35){ e.atk += 2; log('💢 Boss enrages — ATK increases!'); }
}

/* Victory handling */
function onVictory(){
  const e = state.currentEnemy;
  const isBoss = !!e.isBoss;
  let gold = rand(8,16) + state.player.floor*3 + (isBoss? 18:0);
  // relics / modifiers
  const extraPerKill = state.relics.find(r=>r.id==='relic_ring_of_fortune') ? 1 : 0;
  gold += extraPerKill;
  state.player.gold += gold;
  log(`🏆 Defeated ${e.name}! +${gold} gold.`);
  // reward logic
  if(isBoss){
    const pool = equipmentPool();
    const reward = pool[rand(0,pool.length-1)];
    state.player.inventory = state.player.inventory || [];
    state.player.inventory.push(reward);
    state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12);
    log(`🎁 Boss reward: ${reward.rarity} ${reward.baseName}`);
    // add achievement
    state.achievements['beat_boss_'+state.player.floor] = true;
  } else {
    if(Math.random() < 0.28){ state.player.potions = (state.player.potions||0) + 1; log('🧴 Found a potion.'); }
    else if(Math.random() < 0.2){ const pool = equipmentPool(); const it = pool[rand(0,pool.length-1)]; state.player.inventory.push(it); log(`🎁 Drop: ${it.rarity} ${it.baseName}`); }
  }
  // add xp and maybe level
  const xpGain = 5 + state.player.floor;
  state.player.xp = (state.player.xp||0) + xpGain;
  checkLevel();
  // clear combat
  state.currentEnemy = null;
  state.inCombat = false;
  deriveStats();
  fullSave();
  renderAll();
}

/* leveling & perks */
function checkLevel(){
  const p = state.player;
  const xpToLevel = 10 + p.level * 6;
  while(p.xp >= xpToLevel){
    p.xp -= xpToLevel;
    p.level++;
    // perk choice
    givePerk();
  }
}
function givePerk(){
  // simple random perk choices
  const p = state.player;
  const choices = [
    { name:'+3 Max HP', func: (pl)=>{ pl.baseHp += 3; log('Perk: +3 Max HP.'); } },
    { name:'+1 ATK', func: (pl)=>{ pl.baseAtk += 1; log('Perk: +1 ATK.'); } },
    { name:'+1 DEF', func: (pl)=>{ pl.baseDef += 1; log('Perk: +1 DEF.'); } },
    { name:'+1 Spell', func: (pl)=>{ /* unlock new minor spell later */ pl.mag += 1; log('Perk: +1 Magic.'); } }
  ];
  const pick = [];
  while(pick.length < 2){
    const c = choices[rand(0,choices.length-1)];
    if(!pick.includes(c)) pick.push(c);
  }
  // show as simple confirm prompts (UI could be improved)
  const choiceText = `Level up! Choose a perk:\n1) ${pick[0].name}\n2) ${pick[1].name}\n(choose 1 or 2 in prompt)`;
  const sel = prompt(choiceText, '1');
  const idx = (sel === '2') ? 1 : 0;
  pick[idx].func(state.player);
  deriveStats();
  fullSave();
}

/* Run end (death) */
function onRunEnd(){
  // add leaderboard entry
  const score = { floor: state.player.floor || 0, gold: state.player.gold || 0, time: Date.now(), class: state.classKey || '—' };
  state.leaderboard = state.leaderboard || [];
  state.leaderboard.push(score);
  localStorage.setItem(LEADER_KEY, JSON.stringify(state.leaderboard));
  fullSave();
}

/* ---------- Shop / Inventory / UI helpers ---------- */
function openShop(){
  if(state.inCombat){ log('Cannot open shop in combat.'); return; }
  const pool = equipmentPool();
  lastShop = [];
  for(let i=0;i<3;i++) lastShop.push(pool[rand(0,pool.length-1)]);
  lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8 });
  lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6 });
  let html = `<div class="small">Merchant's wares</div><div class="shop-list">`;
  lastShop.forEach((it,idx)=>{
    html += `<div class="item-row"><div>${it.nameHtml || it.baseName}${it.rarity?` <span class="small muted">(${it.rarity})</span>` : ''}</div><div><span class="small">${it.cost}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  log('🏪 Merchant appears.');
  fullSave();
}
function buy(idx){
  const it = lastShop[idx];
  if(!it) return;
  if(state.player.gold < it.cost){ log('Not enough gold.'); return; }
  state.player.gold -= it.cost;
  if(it.type === 'consumable'){ if(it.baseName==='Potion') state.player.potions = (state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers = (state.player.ethers||0)+1; log(`Bought ${it.baseName}.`); }
  else { state.player.inventory.push(it); log(`Bought ${it.rarity || ''} ${it.baseName}.`); }
  fullSave();
  renderAll();
}
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

/* Inventory / Equipment */
function openInventory(){
  if(state.inCombat){ log('Finish combat first.'); return; }
  const inv = state.player.inventory || [];
  let html = `<div class="small">Inventory</div><div class="inv-list">`;
  if(inv.length === 0) html += `<div class="small">— empty —</div>`;
  inv.forEach((it, idx)=>{
    const stats = `${it.atk?`ATK+${it.atk} `:''}${it.def?`DEF+${it.def} `:''}${it.hp?`HP+${it.hp}`:''}`;
    html += `<div class="item-row"><div>${it.nameHtml || it.baseName}<div class="small">${stats}</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`;
  });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  fullSave();
}
function equipItem(idx){
  const it = state.player.inventory[idx];
  if(!it){ log('No item.'); return; }
  if(!['weapon','armor','accessory'].includes(it.type)){ log('Not equippable.'); return; }
  const slot = it.type;
  if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName}`); }
  state.player.equip[slot] = it;
  state.player.inventory.splice(idx,1);
  log(`🛡️ Equipped ${it.rarity} ${it.baseName}`);
  deriveStats();
  fullSave();
  renderAll();
}
function inspectItem(idx){
  const it = state.player.inventory[idx];
  if(!it) return;
  alert(`${it.rarity} ${it.baseName}\nATK:${it.atk}\nDEF:${it.def}\nHP:${it.hp}\nValue:${it.cost}g`);
}

/* ---------- Utilities: totals ---------- */
function totalDefLocal(){ return state.player.baseDef + (state.player.equip?.armor?.def||0); }
function maxHpLocal(){ return state.player.baseHp + (state.player.equip?.accessory?.hp||0) + (state.player.equip?.armor?.hp||0) + (state.baseHpBonus||0||0); }

/* ---------- Export log ---------- */
function exportLog(){
  const txt = $('log').innerText;
  const blob = new Blob([txt], { type:'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `dim_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
}

/* ---------- Leaderboard ---------- */
function showLeaderboard(){
  const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  if(lb.length === 0){ alert('No runs recorded yet.'); return; }
  let msg = 'Leaderboard (local)\n';
  lb.sort((a,b)=> b.floor - a.floor);
  lb.slice(0,10).forEach((e,i)=> msg += `${i+1}. Floor ${e.floor} • Gold ${e.gold} • Class ${e.class}\n`);
  alert(msg);
}

/* ---------- Render: update UI ---------- */
function renderAll(){
  // player panel
  if(state.player){
    $('playerName').innerText = state.player.name || '—';
    $('playerClass').innerText = state.classKey || '—';
    $('hp').innerText = Math.max(0, state.player.hp || 0);
    $('maxhp').innerText = maxHpLocal();
    $('mp').innerText = state.player.mp || 0;
    $('maxmp').innerText = state.player.maxMp || 10;
    $('atk').innerText = (state.player.baseAtk || 0) + (state.player.equip?.weapon?.atk||0);
    $('def').innerText = totalDefLocal();
    $('mag').innerText = state.player.mag || 0;
    $('floor').innerText = state.player.floor || 1;
    $('gold').innerText = state.player.gold || 0;
    $('xp').innerText = state.player.xp || 0;
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? state.player.equip.weapon.nameHtml : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? state.player.equip.armor.nameHtml : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? state.player.equip.accessory.nameHtml : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${ (state.player.inventory||[]).length }`;
  } else {
    $('playerName').innerText = '—';
  }

  // combat UI
  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = state.currentEnemy.name;
    $('enemyHP').innerText = state.currentEnemy.hp;
    $('enemyATK').innerText = state.currentEnemy.atk;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length) ? state.currentEnemy.status.map(s=>s.k).join(',') : '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = 'Battle underway — choose your action.';
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore to find monsters, shops, events, and lore.';
  }
  fullSave(); // auto save on render changes
}

/* ---------- UI wiring: buttons ---------- */
$('btnNew').addEventListener('click', ()=> {
  const sel = prompt('New run — choose class: Warrior, Mage, Rogue', 'Warrior');
  if(!sel || !CLASSES[sel]) { alert('Invalid class'); return; }
  newRun(sel,false,false,null);
});
$('btnNGPlus').addEventListener('click', ()=> {
  const sel = prompt('NG+ run — choose class: Warrior, Mage, Rogue', 'Warrior');
  if(!sel || !CLASSES[sel]) { alert('Invalid class'); return; }
  newRun(sel,true,false,null);
});
$('btnReset').addEventListener('click', resetAll);
$('btnExplore').addEventListener('click', explore);
$('btnShop').addEventListener('click', openShop);
$('btnRest').addEventListener('click', ()=> { if(!state.player) { alert('Start a run first'); return; } if(state.player.gold < 5) { log('Not enough gold to rest'); return; } state.player.gold -= 5; state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12); state.player.mp = Math.min(10, state.player.mp + 6); log('You rest at a camp (5g)'); renderAll(); });
$('btnInventory').addEventListener('click', openInventory);
$('btnCodex').addEventListener('click', ()=> { alert('Codex: (not yet implemented) — collect lore pages in future updates.'); });
$('btnLeaderboard').addEventListener('click', showLeaderboard);
$('btnExport').addEventListener('click', exportLog);
$('btnAttack').addEventListener('click', playerAttack);
$('btnSpell').addEventListener('click', ()=> { $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
$('btnItem').addEventListener('click', useItemCombat);
$('btnRun').addEventListener('click', ()=> { if(confirm('Attempt to flee?')) { if(Math.random() < 0.55){ log('🏃 You fled successfully.'); state.inCombat=false; state.currentEnemy=null; renderAll(); } else { log('Escape failed.'); enemyTurn(); } } });

$('btnSave').addEventListener('click', ()=> { fullSave(); log('💾 Saved.'); });
$('btnLoad').addEventListener('click', ()=> { if(fullLoad()) log('Loaded.'); else log('No save.'); });

/* spell buttons render */
function renderSpellButtons(){
  const container = $('spellRow');
  container.innerHTML = '';
  if(!state.player) return;
  const spellList = state.player.spells || [];
  spellList.forEach(s=>{
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = s + ' (' + ( {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3}[s] || 0 ) + ' )';
    b.onclick = ()=> { castSpell(s); $('spellMenu').classList.add('hidden'); };
    container.appendChild(b);
  });
}

/* ---------- Boot: attempt auto-load, else prompt new run ---------- */
if(!fullLoad()){
  // no save found — ask the player for new run or show class selection
  log('No saved run found. Create a new run using New Run button.');
  renderAll();
} else {
  // load success — show spells etc.
  renderAll();
}

/* show save-toast when saved */
(function(){
  // monkey patch fullSave to show toast as UI
  const old = fullSave;
  fullSave = function(){
    old();
    const t = $('saveToast'); t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 900);
  };
})();
