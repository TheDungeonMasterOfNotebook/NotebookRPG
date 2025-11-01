/* Phase 5 integrated: monsters (rarity + sprites), loot (weapons/armor/relics),
   pixel item icons, daily runs, seeded RNG, autosave/load/reset, UI polish.
   Requires:
     - assets/sprites.png  (item sprite sheet)
     - assets/monsters.png (monster sprite sheet)
*/

/* ---------- small DOM helpers ---------- */
const $ = id => document.getElementById(id);
const now = () => (new Date()).toLocaleTimeString();
function log(msg){ const l = $('log'); if(l) l.innerHTML = `<div>[${now()}] ${msg}</div>` + l.innerHTML; }

/* ---------- Daily seed generator ---------- */
function generateDailySeedForDate(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}${m}${day}`;
}
window.generateDailySeed = ()=> generateDailySeedForDate(new Date());

/* ---------- Seeded RNG (mulberry32) ---------- */
let RNG_STATE = null;
function mulberry32(a){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function initSeed(seedStr){
  let s = 0;
  for(let i=0;i<seedStr.length;i++) s = (s * 131 + seedStr.charCodeAt(i)) >>> 0;
  if(s === 0) s = Date.now() & 0xffffffff;
  RNG_STATE = mulberry32(s);
  window.CURRENT_SEED = seedStr;
  if($('seedDisplay')) $('seedDisplay').innerText = seedStr;
}
function rnd(){ return RNG_STATE ? RNG_STATE() : Math.random(); }
function rInt(a,b){ return Math.floor(rnd()*(b-a+1))+a; }
function rChoice(arr){ return arr[Math.floor(rnd()*arr.length)]; }

/* ---------- Save keys ---------- */
const SAVE_KEY = 'epictextrpg_save_v5';
const META_KEY = 'epictextrpg_meta';
const LEADER_KEY = 'epictextrpg_leader_v5';
const DAILY_LEADER_KEY = 'epictextrpg_daily_v5';

/* ---------- Rarity weights (seeded use) ---------- */
const rarityWeightsBase = { Common: 60, Uncommon: 25, Rare: 10, Epic: 4, Legendary: 1 };

/* use seeded weighted choice */
function weightedChoiceFromMap(weights){
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  let roll = rnd() * total;
  for(const k of Object.keys(weights)){
    if(roll < weights[k]) return k;
    roll -= weights[k];
  }
  return Object.keys(weights)[0];
}

/* ---------- Items: weapons / armor / relics (tiered) ---------- */
/* each entry: { name, sprite, effect: {...} } */
const WEAPONS = {
  Common: [
    { name: "Rusted Sword", sprite: "sword", effect:{atk:1} },
    { name: "Cracked Staff", sprite: "staff", effect:{mag:1} },
    { name: "Broken Dagger", sprite: "dagger", effect:{atk:1} }
  ],
  Uncommon: [
    { name: "Iron Longsword", sprite: "sword", effect:{atk:2} },
    { name: "Bone Dagger", sprite: "dagger", effect:{atk:1, crit:10} }
  ],
  Rare: [
    { name: "Knight's Greatsword", sprite: "sword", effect:{atk:4, speed:-5} },
    { name: "Ember Rod", sprite: "staff", effect:{mag:3, burn:true} }
  ],
  Epic: [
    { name: "Bloodfang Blade", sprite: "sword", effect:{atk:5, lifesteal:true} },
    { name: "Soulbrand Spear", sprite: "axe", effect:{atk:4, crit:10} }
  ],
  Legendary: [
    { name: "Shadow Reaver", sprite: "sword", effect:{atk:8, doubleStrike:25} },
    { name: "Wand of the Abyss", sprite: "staff", effect:{mag:6, stun:15} }
  ]
};

const ARMOR = {
  Common: [
    { name: "Leather Tunic", sprite: "chest", effect:{def:2} },
    { name: "Rusted Helm", sprite: "helmet", effect:{def:1} }
  ],
  Uncommon: [
    { name: "Iron Plate", sprite: "chest", effect:{def:3} },
    { name: "Bone Mask", sprite: "helmet", effect:{def:1, evasion:5} }
  ],
  Rare: [
    { name: "Cloak of Shadows", sprite: "cloak", effect:{def:2, evasion:10} },
    { name: "Knight's Shield", sprite: "shield", effect:{def:5} }
  ],
  Epic: [
    { name: "Wraith Armor", sprite: "chest", effect:{def:4, poisonImmune:true} },
    { name: "Mirror Helm", sprite: "helmet", effect:{reflect:10} }
  ],
  Legendary: [
    { name: "Armor of the Fallen King", sprite: "chest", effect:{def:6, atk:3} },
    { name: "Halo of Night", sprite: "helmet", effect:{def:3, crit:15} }
  ]
};

const RELICS = {
  Common: [
    { name: "Old Coin", sprite: "coin", effect:{goldBonus:5} },
    { name: "Cracked Ring", sprite: "ring", effect:{luck:1} }
  ],
  Uncommon: [
    { name: "Soul Charm", sprite: "amulet", effect:{xpBoost:10} },
    { name: "Blood Rune", sprite: "orb", effect:{atk:2} }
  ],
  Rare: [
    { name: "Heart of Cinders", sprite: "orb", effect:{postBattleHeal:5} },
    { name: "Phantom Hourglass", sprite: "orb", effect:{extraTurnEvery:3} }
  ],
  Epic: [
    { name: "Infernal Sigil", sprite: "orb", effect:{spellBoost:25} },
    { name: "Eye of the Abyss", sprite: "orb", effect:{revealBoss:true} }
  ],
  Legendary: [
    { name: "Crown of Eternity", sprite: "crown", effect:{allStats:3} },
    { name: "Tome of the Void", sprite: "scroll", effect:{unlockSpell:"Voidstrike"} }
  ]
};

/* ---------- Monster tables (by rarity) ---------- */
/* sprite keys must match monsterSprites mapping below */
const MONSTERS = {
  Common:[
    { name:"Ratling", sprite:"rat", hp:10, atk:3, def:1, xp:5, gold:3 },
    { name:"Cave Spider", sprite:"spider", hp:12, atk:4, def:1, xp:6, gold:4, poison:true },
    { name:"Slime", sprite:"slime", hp:8, atk:2, def:0, xp:4, gold:2 },
    { name:"Goblin", sprite:"goblin", hp:12, atk:4, def:1, xp:8, gold:5 }
  ],
  Uncommon:[
    { name:"Shadow Wolf", sprite:"wolf", hp:18, atk:6, def:2, xp:14, gold:10, crit:6 },
    { name:"Ghoul", sprite:"ghoul", hp:20, atk:5, def:2, xp:15, gold:12 },
    { name:"Venom Spider", sprite:"spider2", hp:22, atk:5, def:2, xp:16, gold:12, poison:true }
  ],
  Rare:[
    { name:"Grave Knight", sprite:"knight", hp:35, atk:10, def:4, xp:28, gold:20, blockFirst:true },
    { name:"Wraith", sprite:"wraith", hp:30, atk:8, def:3, xp:25, gold:18, ghost:true },
    { name:"Fire Golem", sprite:"golem", hp:40, atk:9, def:6, xp:30, gold:24, burn:true }
  ],
  Epic:[
    { name:"Blood Witch", sprite:"witch", hp:60, atk:15, def:5, xp:60, gold:45, lifedrain:true },
    { name:"Vampire Lord", sprite:"vampire", hp:50, atk:10, def:5, xp:48, gold:40, lifesteal:true }
  ],
  Legendary:[
    { name:"The Hollow King", sprite:"hollowking", hp:120, atk:20, def:8, xp:150, gold:120, twoPhase:true },
    { name:"Eclipse Dragon", sprite:"dragon", hp:140, atk:22, def:10, xp:180, gold:160, fire:true }
  ]
};

/* ---------- Monster sprite mapping — background-position (16x16 grid) ---------- */
/* update sheet cols/rows in CSS root if your sheet is different */
const monsterSprites = {
  rat: "0 0",
  spider: "-16px 0",
  slime: "-32px 0",
  goblin: "-48px 0",
  wolf: "0 -16px",
  ghoul: "-16px -16px",
  spider2: "-32px -16px",
  knight: "-48px -16px",
  wraith: "0 -32px",
  golem: "-16px -32px",
  witch: "-32px -32px",
  vampire: "-48px -32px",
  hollowking: "0 -48px",
  dragon: "-16px -48px",
  /* add more positions matching your sheet */
  rat2: "-32px -48px",
  eye: "-48px -48px"
};

/* ---------- Item sprite mapping (items sprites.png) ---------- */
const itemSpriteMapping = {
  sword: "0 0",
  dagger: "-16px 0",
  staff: "-32px 0",
  axe: "-48px 0",
  chest: "0 -16px",
  helmet: "-16px -16px",
  ring: "-32px -16px",
  shield: "-48px -16px",
  amulet: "0 -32px",
  coin: "-16px -32px",
  orb: "-32px -32px",
  cloak: "-48px -32px",
  scroll: "0 -48px",
  potion: "-16px -48px",
  key: "-32px -48px"
};

/* ---------- State ---------- */
let state = {
  seed: null, runId:Date.now(), classKey:null, player:null, floorMap:{}, currentEnemy:null, inCombat:false,
  relics:[], legacyRelics: JSON.parse(localStorage.getItem(META_KEY) || '[]') || [], alignment:0, journal:[],
  soulFragments: parseInt(localStorage.getItem('epic_fragments')||'0') || 0, achievements: JSON.parse(localStorage.getItem('epic_achievements')||'{}') || {},
  ngPlus:false, endless:false
};

/* ---------- Relic effects & apply ---------- */
function applyRelicEffects(){
  state.spellDiscount = 0; state.goldMult = 1; state.dodge = 0; state.fireBonus = 0; state.lifeSteal = 0; state.nullChance = 0; state.aether=false; state.rewind=false;
  for(const r of state.relics.concat(state.legacyRelics||[])){
    const id = r.name || r.id;
    if(id === "Old Coin") state.goldMult = (state.goldMult||1) + 0.10;
    if(id === "Cracked Ring") state.luck = (state.luck||0) + 1;
    if(id === "Crown of Eternity") { state.player && (state.player.baseHp += 3); }
    if(id === "Soul Charm") state.xpBoost = (state.xpBoost||0) + 0.10;
    if(id === "Infernal Sigil") state.spellBoost = (state.spellBoost||0) + 0.25;
    if(id === "Eye of the Abyss") state.revealBoss = true;
  }
}

/* ---------- Derived stats ---------- */
function derivePlayer(){
  if(!state.player) return;
  applyRelicEffects();
  const p = state.player;
  p.maxHp = p.baseHp + (p.equip?.accessory?.hp || 0) + (p.equip?.armor?.hp || 0);
  p.attack = p.baseAtk + (p.equip?.weapon?.atk || 0) + (p.equip?.accessory?.atk || 0);
  p.defense = p.baseDef + (p.equip?.armor?.def || 0);
  p.maxMp = Math.max(5, p.mag + 3);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
}

/* ---------- Save / Load / Reset ---------- */
function showSaveToast(){ const el=$('saveToast'); if(!el) return; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function fullSave(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(META_KEY, JSON.stringify(state.legacyRelics || []));
    localStorage.setItem('epic_fragments', String(state.soulFragments || 0));
    localStorage.setItem('epic_achievements', JSON.stringify(state.achievements || {}));
    showSaveToast();
  }catch(e){ console.warn('save failed', e); }
}
function fullLoad(){
  const s = localStorage.getItem(SAVE_KEY);
  if(!s) return false;
  try{
    const loaded = JSON.parse(s);
    loaded.legacyRelics = JSON.parse(localStorage.getItem(META_KEY) || '[]') || [];
    state = Object.assign(state, loaded);
    if(state.seed) initSeed(state.seed);
    derivePlayer();
    renderAll();
    log('📂 Save loaded.');
    return true;
  }catch(e){ console.warn('load fail', e); return false; }
}
function resetAll(){
  if(!confirm('Reset your save and meta progress?')) return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(META_KEY);
  localStorage.removeItem('epic_fragments');
  localStorage.removeItem('epic_achievements');
  state = { seed: state.seed || null, runId:Date.now(), classKey:null, player:null, floorMap:{}, currentEnemy:null, inCombat:false, relics:[], legacyRelics:[], alignment:0, journal:[], soulFragments:0, achievements:{}, ngPlus:false, endless:false };
  log('🔁 Save and meta reset.');
  fullSave(); renderAll();
}

/* ---------- New Run & Daily Run ---------- */
function newRun(classKey, ngPlus=false, endless=false, daily=false){
  if(!["Warrior","Mage","Rogue"].includes(classKey)){ alert('Invalid class'); return; }
  const CLASSES = {
    Warrior: { baseHp:28, baseAtk:7, baseDef:2, mag:2, spells:['Shield'], starter: ()=> [{id:'rusty_sword', baseName:'Rusty Sword', type:'weapon', sprite:'sword', atk:1}] },
    Mage: { baseHp:18, baseAtk:3, baseDef:1, mag:8, spells:['Firebolt','Lightning Strike','Heal'], starter: ()=> [{id:'apprentice_staff', baseName:'Apprentice Staff', type:'weapon', sprite:'staff', atk:1}] },
    Rogue: { baseHp:22, baseAtk:5, baseDef:1, mag:4, spells:['Ice Shard','Firebolt'], starter: ()=> [{id:'dagger_01', baseName:'Dagger', type:'weapon', sprite:'dagger', atk:2}] }
  };
  const cls = CLASSES[classKey];
  const player = {
    name: classKey, classKey,
    baseHp: cls.baseHp + (ngPlus?2:0), hp: cls.baseHp + (ngPlus?2:0),
    baseAtk: cls.baseAtk + (ngPlus?1:0), baseDef: cls.baseDef, mag: cls.mag,
    mp:10, xp:0, level:1, gold:12 + (ngPlus?10:0), potions:1, ethers:1,
    equip:{weapon:null,armor:null,accessory:null}, inventory: cls.starter ? cls.starter() : [], spells: (cls.spells||[]).slice(),
    tempDef:0, status:[], floor:1, daily: !!daily
  };
  state.classKey = classKey; state.player = player; state.floorMap = {}; state.currentEnemy = null; state.inCombat = false; state.relics = [];
  derivePlayer();
  if(daily) cineShow(`🔥 Daily Seed: ${state.seed} — Season 1`,900).then(()=>{ log(`🆕 Daily run: ${classKey} — seed ${state.seed}`); fullSave(); renderAll(); });
  else cineShow(`The run is bound by seed ${state.seed}...`,900).then(()=>{ log(`🆕 New run: ${classKey} — seed ${state.seed}`); fullSave(); renderAll(); });
}

/* ---------- Floor generation ---------- */
function genFloor(floorNum){
  if(state.floorMap['f'+floorNum]) return state.floorMap['f'+floorNum];
  const rooms = []; const total = 6 + Math.floor(Math.min(12, floorNum));
  for(let i=0;i<total;i++){
    const r = rnd();
    if(r < 0.50) rooms.push({type:'monster'});
    else if(r < 0.66) rooms.push({type:'treasure'});
    else if(r < 0.80) rooms.push({type:'event'});
    else if(r < 0.92) rooms.push({type:'shop'});
    else rooms.push({type:'rest'});
  }
  rooms.push({type:'stairs'});
  if(floorNum % 3 === 0) rooms.push({type:'boss'});
  state.floorMap['f'+floorNum] = { rooms, pointer:0 };
  return state.floorMap['f'+floorNum];
}

/* ---------- Monster generation (weighted + floor-scaling) ---------- */
function getAdjustedRarityWeightsForFloor(floor){
  // copy
  const w = Object.assign({}, rarityWeightsBase);
  if(floor > 4){ w.Rare += 5; w.Uncommon -= 3; }
  if(floor > 8){ w.Epic += 3; w.Rare += 3; w.Common -= 5; }
  if(floor > 14){ w.Legendary += 1; w.Epic += 2; w.Common -= 4; }
  // normalize minimum 1
  Object.keys(w).forEach(k=> { if(w[k] < 1) w[k] = 1; });
  return w;
}

function getRandomMonsterForFloor(floor){
  const weights = getAdjustedRarityWeightsForFloor(floor);
  const rarity = weightedChoiceFromMap(weights);
  const pool = MONSTERS[rarity] || MONSTERS.Common;
  const template = rChoice(pool);
  // scale stats slightly by floor and rarity
  const rarityMult = ({Common:1,Uncommon:1.15,Rare:1.3,Epic:1.6,Legendary:2})[rarity] || 1;
  const hp = Math.max(1, Math.round((template.hp || 10) + floor * 2) * rarityMult);
  const atk = Math.max(1, Math.round((template.atk || 2) + Math.floor(floor/2)) );
  const def = Math.max(0, Math.round((template.def || 0) + Math.floor(floor/4)) );
  const xp = Math.max(1, Math.round((template.xp || 5) * rarityMult));
  const gold = Math.max(0, Math.round((template.gold || 3) * rarityMult));
  return Object.assign({}, template, { hp, atk, def, xp, gold, rarity });
}

/* ---------- Enter room ---------- */
function enterRoom(){
  if(!state.player){ alert('Start a run first.'); return; }
  if(state.inCombat){ log('Finish combat first.'); return; }
  const floor = state.player.floor || 1; const fobj = genFloor(floor); const idx = fobj.pointer;
  if(idx >= fobj.rooms.length){ log('You reach the stairs and descend.'); descendFloor(); fullSave(); return; }
  const room = fobj.rooms[idx]; fobj.pointer++;
  log(`➡ You enter a room: ${room.type}`);
  if(room.type === 'monster') startMonster();
  else if(room.type === 'treasure') openChest();
  else if(room.type === 'shop') openShop();
  else if(room.type === 'rest') useFountain();
  else if(room.type === 'event') runEvent();
  else if(room.type === 'stairs'){ log('🔻 The stairs lead downward.'); descendFloor(); }
  else if(room.type === 'boss') startBoss();
  renderAll(); fullSave();
}

/* ---------- Descend ---------- */
function descendFloor(){
  if(!state.player) return;
  state.player.floor = (state.player.floor || 1) + 1;
  derivePlayer();
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
  state.player.mp = Math.min(state.player.maxMp, state.player.mp + 4);
  cineShow(`⬇️ You descend to Floor ${state.player.floor}...`,900).then(()=>{ log(`⬇️ Floor ${state.player.floor}`); fullSave(); renderAll(); });
}

/* ---------- Combat: start monster / boss ---------- */
function startMonster(){
  const floor = state.player.floor || 1;
  const enemy = getRandomMonsterForFloor(floor);
  state.currentEnemy = { ...enemy, currentHp: enemy.hp, status:[], isBoss:false };
  state.inCombat = true; log(`⚔️ ${enemy.rarity} ${enemy.name} appears!`); fullSave(); renderAll();
}

function startBoss(){
  const floor = state.player.floor || 1;
  const bossTpl = rChoice(MONSTERS.Legendary.concat(MONSTERS.Epic)); // pick a big one or curated bosses
  const scaled = getRandomMonsterForFloor(floor);
  // create two-phase for legendary if template has twoPhase flag
  state.currentEnemy = { ...bossTpl, currentHp: bossTpl.hp + floor * 3, status:[], isBoss:true, phases: bossTpl.twoPhase ? [{hp: bossTpl.hp},{hp: Math.round(bossTpl.hp * 1.5)}] : null };
  state.inCombat = true;
  cineShow(`🔥 ${state.currentEnemy.name} appears — a terrible presence.`,1200).then(()=>{ log(`🔥 Boss: ${state.currentEnemy.name}`); renderAll(); fullSave(); });
}

/* ---------- Combat actions ---------- */
function playerAttack(){
  if(!state.inCombat || !state.currentEnemy) return;
  derivePlayer();
  const p = state.player; const atk = p.attack || 0;
  const r = rInt(1,6); const dmg = Math.max(1, r + atk - Math.floor((state.currentEnemy.def||0)/2));
  if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic nullified your attack!'); }
  else {
    state.currentEnemy.currentHp = Math.max(0, (state.currentEnemy.currentHp||0) - dmg);
    showHitText(`-${dmg}`, 'hit');
    log(`⚔️ You attack for ${dmg} damage.`);
    if(state.lifeSteal){ const heal = Math.max(1, Math.round(dmg * state.lifeSteal)); state.player.hp = Math.min(maxHpLocal(), state.player.hp + heal); log(`💉 Lifesteal: +${heal} HP.`); }
  }
  if(state.currentEnemy.currentHp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

function showSpellMenu(){ $('spellMenu').classList.remove('hidden'); renderSpellButtons(); }
function hideSpellMenu(){ $('spellMenu').classList.add('hidden'); }
function castSpell(spell){
  if(!state.inCombat || !state.currentEnemy) return;
  const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Arcane Burst':6,'Voidstrike':7};
  const discount = state.spellDiscount || 0; const cost = Math.max(0, (costMap[spell]||0) - discount);
  if(state.player.mp < cost){ log('Not enough MP.'); return; }
  state.player.mp -= cost;
  let dmg = 0;
  if(spell === 'Firebolt'){ dmg = 5 + state.player.floor; const bonus = state.fireBonus? Math.round(dmg*state.fireBonus):0; state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - (dmg+bonus)); log(`🔥 Firebolt ${dmg + (bonus?(' +'+bonus):'')} dmg.`); showHitText(`-${dmg}`, 'fire'); }
  else if(spell === 'Ice Shard'){ dmg = 3 + Math.floor(state.player.mag/4); state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - dmg); state.currentEnemy.atk = Math.max(1, state.currentEnemy.atk - 1); log(`❄️ Ice Shard ${dmg} dmg, -1 ATK.`); showHitText(`-${dmg}`, 'ice'); }
  else if(spell === 'Heal'){ const h = 5 + Math.floor(state.player.mag/3); state.player.hp = Math.min(maxHpLocal(), state.player.hp + h); log(`💚 Heal +${h} HP.`); showHitText(`+${h}`, 'heal'); }
  else if(spell === 'Lightning Strike'){ if(rnd() < 0.6){ const d = 8 + state.player.floor; state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - d); log(`⚡ Lightning hits ${d}!`); showHitText(`-${d}`, 'light'); } else log('⚡ Lightning missed!'); }
  else if(spell === 'Shield'){ state.player.tempDef = (state.player.tempDef||0)+3; log('🛡️ Shield +3 DEF for next hit.'); showHitText('+DEF', 'buff'); }
  else if(spell === 'Arcane Burst' || spell === 'Voidstrike'){ const d = 12 + Math.floor(state.player.mag/2); state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - d); log(`✨ ${spell} dealt ${d}.`); showHitText(`-${d}`, 'arcane'); }
  hideSpellMenu();
  if(state.currentEnemy.currentHp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

function useItemCombat(){
  const p = state.player;
  if(p.potions > 0){ p.potions--; const heal = rInt(6,12); p.hp = Math.min(maxHpLocal(), p.hp + heal); log(`🧴 Potion +${heal} HP.`); showHitText(`+${heal}`, 'heal'); }
  else if(p.ethers > 0){ p.ethers--; const m = rInt(4,8); p.mp = Math.min(p.maxMp || 10, p.mp + m); log(`🔮 Ether +${m} MP.`); showHitText(`+${m} MP`, 'mp'); }
  else log('No items.');
  enemyTurn(); fullSave(); renderAll();
}
function attemptRun(){ if(!state.inCombat) return; if(rnd() < 0.5){ log('🏃 You escape.'); state.inCombat=false; state.currentEnemy=null; renderAll(); fullSave(); } else { log('✋ Escape failed.'); enemyTurn(); fullSave(); } }

/* ---------- Enemy turn & statuses ---------- */
function tickStatus(entity){
  if(!entity || !entity.status) return;
  const remaining = [];
  for(const s of entity.status){
    if(s.k === 'poison'){ entity.currentHp = Math.max(0, entity.currentHp - (s.p||1)); log(`${entity.name||'You'} suffers ${(s.p||1)} poison.`); }
    if(s.k === 'burn'){ entity.currentHp = Math.max(0, entity.currentHp - (s.p||2)); log(`${entity.name||'You'} burns for ${(s.p||2)}.`); }
    s.t = (s.t||1)-1;
    if(s.t > 0) remaining.push(s);
  }
  entity.status = remaining;
}

/* small helper to show floating hit text in battle area */
function showHitText(text, cls='hit'){
  const area = $('battleArea') || $('battleArea');
  const el = document.createElement('div'); el.className = `floating ${cls}`; el.innerText = text;
  el.style.position='relative'; el.style.zIndex=1000; area.appendChild(el);
  setTimeout(()=> el.remove(),900);
}

function enemyTurn(){
  if(!state.currentEnemy) return;
  tickStatus(state.currentEnemy);
  if(state.currentEnemy.currentHp <= 0) return onVictory();
  const e = state.currentEnemy;
  let dmg = Math.max(1, (e.atk || 2) + rInt(-1,1) - (state.player.defense||0) - (state.player.tempDef||0));
  state.player.tempDef = 0;
  if(e.blockFirst && e.blockFirstUsed){ e.blockFirstUsed = true; log(`${e.name} blocked the attack!`); }
  if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic blocked the enemy attack!'); }
  else { state.player.hp = Math.max(0, state.player.hp - dmg); showHitText(`-${dmg}`,'hurt'); log(`💥 ${e.name} hits for ${dmg}.`); }
  tickStatus(state.player);
  if(state.player.hp <= 0){ log('💀 You died. Run ends.'); onRunEnd(); }
}

/* ---------- Victory ---------- */
function onVictory(){
  const e = state.currentEnemy; const isBoss = !!e && !!e.isBoss;
  const goldGain = Math.max(1, Math.round(((e.gold||5) + (state.player.floor||1)*2) * (state.goldMult||1)));
  state.player.gold = (state.player.gold||0) + goldGain;
  log(`🏆 Defeated ${e.name}! +${goldGain} gold.`);
  // drop logic: higher rarity -> better loot chance
  const drop = generateLootForEnemy(e.rarity, state.player.floor || 1);
  if(drop) {
    if(drop.type === 'relic'){ state.relics.push({name:drop.name}); log(`🎁 Relic drop: ${drop.name}`); }
    else { state.player.inventory = state.player.inventory || []; state.player.inventory.push(drop); log(`🎁 Item drop: ${drop.rarity} ${drop.name}`); }
  } else {
    if(rnd() < 0.25){ state.player.potions = (state.player.potions||0)+1; log('🧴 Found a potion.'); }
  }
  // xp/gain
  const xpGain = Math.max(1, Math.round((e.xp || 5) * ({Common:1,Uncommon:1.25,Rare:1.5,Epic:2,Legendary:3})[e.rarity]));
  state.player.xp = (state.player.xp||0) + xpGain;
  checkLevel();
  state.currentEnemy = null; state.inCombat = false; derivePlayer(); fullSave(); renderAll();
}

/* ---------- Loot generation (weighted by rarity + category) ---------- */
const rarityOrder = ['Common','Uncommon','Rare','Epic','Legendary'];
function weightedRarityRoll(baseRarity, bias=0){
  // baseRarity string: shift distribution upward by bias (0 default)
  const idx = Math.max(0, rarityOrder.indexOf(baseRarity || 'Common'));
  // create weights skewed: prefer baseRarity or below but allow upward with small chance
  const weights = {};
  for(let i=0;i<rarityOrder.length;i++){
    // distance from base
    const dist = i - idx;
    let w = 0;
    if(dist <= 0) w = 50 - (Math.abs(dist)*12); // common-ish
    else w = Math.max(1, 6 - dist*2);
    // bias favors higher rarities as floor increases
    if(bias>0 && i >= idx) w += bias * (i - idx + 1);
    weights[rarityOrder[i]] = Math.max(1, w);
  }
  return weightedChoiceFromMap(weights);
}

function generateLootForEnemy(enemyRarity, floor){
  // pick category
  const categories = ['weapon','armor','relic'];
  const category = rChoice(categories);
  // bias by floor (higher floors slightly increase chance)
  const bias = Math.floor(Math.max(0, floor / 6));
  const chosenRarity = weightedRarityRoll(enemyRarity, bias);
  let pool;
  if(category === 'weapon') pool = WEAPONS[chosenRarity] || WEAPONS.Common;
  else if(category === 'armor') pool = ARMOR[chosenRarity] || ARMOR.Common;
  else pool = RELICS[chosenRarity] || RELICS.Common;
  const item = rChoice(pool);
  if(!item) return null;
  // format drop object
  return Object.assign({ type: category, rarity: chosenRarity }, item);
}

/* ---------- Leveling ---------- */
function checkLevel(){
  const p = state.player; if(!p) return;
  const xpTo = 8 + p.level * 6;
  while(p.xp >= xpTo){ p.xp -= xpTo; p.level++;
    const choices = [ {name:'+3 HP',apply:pl=>{pl.baseHp+=3; log('Perk: +3 HP');}}, {name:'+1 ATK',apply:pl=>{pl.baseAtk+=1; log('Perk: +1 ATK');}}, {name:'+1 DEF',apply:pl=>{pl.baseDef+=1; log('Perk: +1 DEF');}}, {name:'+1 MAG',apply:pl=>{pl.mag+=1; log('Perk: +1 MAG');}} ];
    const a = rInt(0,choices.length-1); let b = rInt(0,choices.length-1); while(b===a) b = rInt(0,choices.length-1);
    const pick = prompt(`Level up! Pick:\n1) ${choices[a].name}\n2) ${choices[b].name}\nEnter 1 or 2`,'1'); const idx = (pick==='2')?b:a;
    choices[idx].apply(p); derivePlayer(); fullSave();
  }
}

/* ---------- Chest / Shop / Events (kept similar) ---------- */
function openChest(){ if(!state.player) return; if(rnd() < 0.55){ const drop = generateLootForEnemy('Common', state.player.floor||1); if(drop.type==='relic'){ state.relics.push({name:drop.name}); log(`🎁 Chest: Relic found — ${drop.name}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(drop); log(`🎁 Chest: Item found — ${drop.rarity} ${drop.name}`); } } else { const g = rInt(6,26) + (state.player.floor||1)*2; state.player.gold = (state.player.gold||0) + Math.round(g * (state.goldMult||1)); log(`💰 Chest: +${Math.round(g * (state.goldMult||1))} gold.`); } fullSave(); renderAll(); }

let lastShop = [];
function openShop(){ if(state.inCombat){ log('Cannot shop during combat.'); return; } const pool = equipmentPoolPreview(); lastShop = []; for(let i=0;i<3;i++) lastShop.push(rChoice(pool)); lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8, sprite:'potion' }); lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6, sprite:'potion' });
  let html = `<div class="small">Merchant's Wares</div><div class="shop-list" style="margin-top:8px">`;
  lastShop.forEach((it,idx)=>{ const icon = getItemIcon(it); html += `<div class="item-row"><div class="item-cell"><span class="item-icon" data-rarity="${it.rarity||'Common'}"><img src="${icon}" alt="${it.baseName||it.name}" /></span><div>${it.nameHtml || it.baseName || it.name}${it.rarity?` <span class="small muted">(${it.rarity})</span>`:''}</div><div class="tooltip small muted">Cost: ${it.cost || 0}g</div></div><div><span class="small">${it.cost||5}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html; log('🏪 Merchant appears.'); fullSave();
}
function buy(idx){ const it = lastShop[idx]; if(!it) return; if(!state.player){ log('Start a run first'); return; } if(state.player.gold < (it.cost||5)){ log('Not enough gold.'); return; } state.player.gold -= (it.cost||5); if(it.type==='consumable'){ if(it.baseName==='Potion') state.player.potions=(state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers=(state.player.ethers||0)+1; log(`Bought ${it.baseName}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`Bought ${it.rarity||''} ${it.baseName || it.name}`); } fullSave(); renderAll(); }
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

/* equipmentPool preview small items for shops */
function equipmentPoolPreview(){
  const pool = [];
  Object.keys(WEAPONS).forEach(r=> WEAPONS[r].forEach(i=> pool.push(Object.assign({rarity:r,type:'weapon'}, i))));
  Object.keys(ARMOR).forEach(r=> ARMOR[r].forEach(i=> pool.push(Object.assign({rarity:r,type:'armor'}, i))));
  return pool;
}

/* ---------- Events & Journal (trimmed list) ---------- */
const EVENTS = [
  /* a selection of events (copy from earlier lists) */
  { id:'whisper_door', text:'A door hums with whispers. Speak your name into it or remain silent?', choices:[
      { label:'Speak', func: s=>{ s.player.xp=(s.player.xp||0)+5; s.player.hp = Math.max(1, s.player.hp - 5); changeAlignment(-2); addJournal('You whispered to the Door — a fragment answered.'); log('The door answers — +5 XP, -5 HP.'); } },
      { label:'Silent', func: s=>{ if(rnd()<0.35){ const r = rChoice(Object.values(RELICS).flat()); s.relics.push({name:r.name}); applyRelicEffects(); addJournal('Silence rewarded with a relic.'); log(`Silence rewards you: ${r.name}`); } else { log('Silence brings nothing.'); } } }
  ]},
  { id:'cursed_fountain', text:'A cursed fountain bubbles. Drink to heal but risk a curse?', choices:[
      { label:'Drink', func: s=>{ if(rnd()<0.5){ s.player.hp = Math.min(maxHpLocal(), s.player.hp + 12); addJournal('The fountain healed you painfully.'); log('It heals you...'); } else { s.player.status = s.player.status || []; s.player.status.push({k:'poison',t:3,p:2}); changeAlignment(-3); addJournal('The fountain cursed your blood.'); log('A curse! Poisoned.'); } } },
      { label:'Pass', func: s=>{ addJournal('You pass the fountain in silence.'); log('You pass the fountain.'); } }
  ]}
];

function runEvent(){
  if(!state.player) return;
  const ev = rChoice(EVENTS);
  log(`❓ Event: ${ev.text}`);
  let html = `<div class="small">${ev.text}</div><div class="shop-list" style="margin-top:8px">`;
  ev.choices.forEach((c, idx) => { html += `<div class="item-row"><div>${c.label}</div><div><button class="secondary" onclick="chooseEvent(${idx})">Choose</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  window.chooseEvent = function(idx){ ev.choices[idx].func(state); renderAll(); fullSave(); closeShopPanel(); };
}

/* ---------- Inventory / Equip (with icons) ---------- */
function openInventory(){
  if(!state.player) return; if(state.inCombat){ log('Finish combat first.'); return; }
  const inv = state.player.inventory || [];
  let html = `<div class="small">Inventory</div><div class="inv-list">`;
  if(inv.length === 0) html += `<div class="small">— empty —</div>`;
  inv.forEach((it, idx)=>{ const stats = `${it.effect?(it.effect.atk?`ATK+${it.effect.atk} `:'')+ (it.effect.def?`DEF+${it.effect.def} `:''):''}`; const icon = getItemIcon(it); html+= `<div class="item-row"><div class="item-cell"><span class="item-icon" data-rarity="${it.rarity||'Common'}"><img src="${icon}" alt="${it.baseName||it.name}" /></span><div>${it.nameHtml || it.baseName || it.name}<div class="small muted">${stats}</div></div><div class="tooltip small muted">Equip / Inspect</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
}
function equipItem(idx){ const it = state.player.inventory[idx]; if(!it) return; if(!['weapon','armor','accessory'].includes(it.type) && !['weapon','armor'].includes(it.type)){ log('Not equippable.'); return; } const slot = (it.type === 'weapon') ? 'weapon' : (it.type === 'armor'?'armor':'accessory'); if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName || state.player.equip[slot].name}`); } state.player.equip[slot] = it; state.player.inventory.splice(idx,1); log(`🛡️ Equipped ${it.rarity || ''} ${it.baseName || it.name}`); derivePlayer(); fullSave(); renderAll(); }
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity || 'Common'} ${it.baseName || it.name}\n${it.effect?Object.entries(it.effect).map(e=> `${e[0]}:${e[1]}`).join('\n'):''}\nValue:${it.cost||0}g`); }

/* ---------- Helpers ---------- */
function totalDefLocal(){ return (state.player?.baseDef || 0) + (state.player?.equip?.armor?.effect?.def || 0); }
function maxHpLocal(){ return (state.player?.baseHp || 0) + (state.player?.equip?.accessory?.effect?.hp || 0) + (state.player?.equip?.armor?.effect?.hp || 0); }

/* ---------- Item icon generator (renders small sprite to dataURL) ---------- */
const PALETTE = { '.': 'rgba(0,0,0,0)', 'b':'#2b2b2b', 'l':'#d8cfc6', 'r':'#8a0033', 'g':'#3fa34d','B':'#ffffff','y':'#ffcc00','p':'#a020f0','u':'#2979ff' };
const PIXEL_SPRITES_SMALL = {
  sword:{size:8, grid:["..b.....",".bbb....",".bLb....",".bLb....",".bLb....",".bLbb...","..bb....","........"], map:{'L':'l'}},
  staff:{size:8, grid:["....b...","...b....","...b....","...b....","..bbb...","..b.b...","..b.b...","........"]},
  potion:{size:8, grid:["..yy..",".yyyy.",".yBB y.",".yBB y.",".yBB y.","..yyy.","...y..","......"]},
  chest:{size:8, grid:[".bbb.b.","bbbbb..","bBbBb..","bBbBb..",".bbb...",".bbb...","..b....","......."], map:{'B':'B'}},
  helmet:{size:8, grid:[".bbb...","bbbbb..","bB B b.","bB B b.",".bbb...","..b....","..b....","........"], map:{'B':'B'}},
  dagger:{size:8, grid:["...b....","...bb...","...bb...","...b....",".bbb....","..b.....","........","........"]}
};
function spriteGridToPixels(sprite){
  const g = sprite.grid.map(row=>{
    let r = row;
    if(sprite.size && r.length < sprite.size) r = r.padEnd(sprite.size, '.');
    if(sprite.map){ for(const k in sprite.map) r = r.replace(new RegExp(k, 'g'), sprite.map[k]); }
    return r.split('');
  });
  return g;
}
function renderSpriteToDataURL(name, scale=3, bg='rgba(0,0,0,0)'){
  const sp = PIXEL_SPRITES_SMALL[name];
  if(!sp) return null;
  const grid = spriteGridToPixels(sp);
  const n = sp.size || grid.length;
  const canvas = document.createElement('canvas'); canvas.width = n * scale; canvas.height = n * scale;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<n;y++){ for(let x=0;x<n;x++){
    const ch = (grid[y] && grid[y][x]) || '.';
    const col = PALETTE[ch] || PALETTE['.'];
    if(!col || col === 'rgba(0,0,0,0)') continue;
    ctx.fillStyle = col; ctx.fillRect(x*scale, y*scale, scale, scale);
  }}
  return canvas.toDataURL();
}
const ICON_CACHE = {};
function getItemIcon(item){
  const key = item.id || item.baseName || item.name || JSON.stringify(item);
  if(ICON_CACHE[key]) return ICON_CACHE[key];
  const spriteName = item.sprite || (item.baseName && item.baseName.toLowerCase().includes('sword') ? 'sword' : 'potion');
  let url = renderSpriteToDataURL(spriteName, 3);
  if(!url) url = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  ICON_CACHE[key] = url;
  return url;
}

/* ---------- Monster sprite element creation ---------- */
function createMonsterSpriteEl(spriteKey){
  const el = document.createElement('div');
  el.className = 'monster-sprite';
  const pos = monsterSprites[spriteKey] || "0 0";
  // background-position expects pixel offsets; mapping uses 'x y'
  el.style.backgroundPosition = pos;
  return el;
}

/* ---------- Render helpers ---------- */
function renderRelicsUI(){
  const el = $('relicRow'); if(!el) return; el.innerHTML = ''; const combined = (state.relics||[]).concat(state.legacyRelics||[]); if(combined.length===0){ el.innerText = 'Relics: —'; return; } for(const r of combined){ const pill = document.createElement('div'); pill.className='relic-pill'; pill.innerText = (r.name||r.id); el.appendChild(pill); }
}
function renderJournal(){ const el = $('journalContent'); if(!el) return; el.innerHTML = ''; const j = state.journal || []; if(j.length===0) el.innerHTML = `<div class="small muted">— No entries yet —</div>`; j.forEach(entry=>{ const d = new Date(entry.time).toLocaleString(); el.innerHTML += `<div style="margin-bottom:8px"><div class="small muted">${d}</div><div>${entry.text}</div></div>`; }); }
function renderMeta(){ const el = $('metaContent'); if(!el) return;
  let html = `<div class="small">Fragments: <strong>${state.soulFragments||0}</strong></div><div style="margin-top:8px">`;
  const offers = [ { id:'legacy_fang', name:'Legacy Soul Eater Fang', cost:6, relicId:'fang'}, { id:'legacy_crown', name:'Legacy Aether Crown', cost:10, relicId:'crown'}, { id:'unlock_mage', name:'Unlock: Arcane Path', cost:4, relicId:null} ];
  offers.forEach((o, idx)=>{ html += `<div class="item-row"><div><strong>${o.name}</strong><div class="small muted">${o.cost} fragments</div></div><div><button class="secondary" onclick="buyMeta(${idx})">Buy</button></div></div>`; });
  html += `</div>`; el.innerHTML = html;
}
function buyMeta(idx){ const offers=[{id:'legacy_fang',name:'Legacy Soul Eater Fang',cost:6,relicId:'fang'},{id:'legacy_crown',name:'Legacy Aether Crown',cost:10,relicId:'crown'},{id:'unlock_mage',name:'Unlock Arcane Path',cost:4,relicId:null}]; const o=offers[idx]; if(!o) return; if(state.soulFragments < o.cost){ alert('Not enough Soul Fragments'); return; } state.soulFragments -= o.cost; if(o.relicId){ state.legacyRelics.push({id:o.relicId,name:o.name}); applyRelicEffects(); log(`Meta purchased ${o.name}`); } else { state.legacyRelics.push({id:'arcane_path',name:'Arcane Path'}); log('Meta: Arcane Path unlocked.'); } fullSave(); renderMeta(); renderAll(); }

/* ---------- Cinematic overlay ---------- */
function cineShow(text, ms=1200){
  const overlay = $('cineOverlay'); const t = $('cineText'); const b = $('cineBlood');
  if(!overlay || !t || !b){ log(text); return Promise.resolve(); }
  t.innerHTML = text;
  overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
  b.style.animation = 'bloodPulse 1.2s ease';
  t.style.animation = 'cineIn .9s ease forwards';
  return new Promise(resolve => setTimeout(()=>{ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); resolve(); }, ms));
}

/* ---------- End-of-run summary & daily recording ---------- */
function onRunEnd(){
  const floors = state.player?.floor || 1;
  const fragmentsEarned = Math.max(1, Math.floor(floors / 2));
  state.soulFragments = (state.soulFragments || 0) + fragmentsEarned;
  const entry = { floor: floors, gold: state.player?.gold || 0, class: state.classKey || 'Unknown', seed: state.seed || '' };
  const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]'); lb.push(entry); localStorage.setItem(LEADER_KEY, JSON.stringify(lb));
  state.achievements = state.achievements || {};
  if(floors >= 10) state.achievements['Deep Delver'] = true;
  if((state.relics||[]).length >= 3) state.achievements['Relic Hunter'] = true;
  localStorage.setItem('epic_achievements', JSON.stringify(state.achievements||{}));

  if(state.player && state.player.daily){
    recordDailyResult(state.seed, floors, state.player.gold, state.classKey);
    addJournal(`Daily run completed (Seed ${state.seed}) — Floors: ${floors}`);
  }

  const sumEl = $('summaryContent'); if(sumEl){
    let html = `<div class="small">Seed: <code>${state.seed}</code></div>`;
    html += `<div style="margin-top:8px">Floors cleared: <strong>${floors}</strong></div>`;
    html += `<div>Fragments earned: <strong>${fragmentsEarned}</strong> (Total: ${state.soulFragments})</div>`;
    html += `<div style="margin-top:8px">Relics found: ${(state.relics||[]).map(r=>r.name||r.id).join(', ') || '—'}</div>`;
    html += `<div style="margin-top:8px">Journal entries: ${(state.journal||[]).length}</div>`;
    html += `<div style="margin-top:12px"><strong>Achievements</strong><div class="small">${Object.keys(state.achievements||{}).filter(k=>state.achievements[k]).join(', ') || '—'}</div></div>`;
    sumEl.innerHTML = html;
    $('summaryModal').classList.remove('hidden'); $('summaryModal').setAttribute('aria-hidden','false');
  }
  state.player = null; state.floorMap = {}; state.currentEnemy = null; state.inCombat = false; fullSave(); renderAll();
}

/* ---------- Leaderboards (daily) ---------- */
function recordDailyResult(seed, floors, gold, klass){
  const dateKey = generateDailySeedForDate(new Date());
  const store = JSON.parse(localStorage.getItem(DAILY_LEADER_KEY) || '{}');
  store[dateKey] = store[dateKey] || [];
  store[dateKey].push({ seed, floors, gold, class: klass, time: new Date().toISOString() });
  store[dateKey].sort((a,b)=> b.floors - a.floors);
  store[dateKey] = store[dateKey].slice(0,20);
  localStorage.setItem(DAILY_LEADER_KEY, JSON.stringify(store));
}
function showDailyLeaderboard(){ const dateKey = generateDailySeedForDate(new Date()); const store = JSON.parse(localStorage.getItem(DAILY_LEADER_KEY) || '{}'); const arr = store[dateKey] || []; if(arr.length===0){ alert('No daily runs recorded for today yet.'); return; } let txt = `Daily Leaders for ${dateKey}\n`; arr.forEach((e,i)=> txt += `${i+1}. ${e.class} — Floor ${e.floors} • Gold ${e.gold}\n`); alert(txt); }

/* ---------- Spell UI ---------- */
function renderSpellButtons(){ const container = $('spellRow'); if(!container) return; container.innerHTML = ''; if(!state.player) return; const spells = state.player.spells || []; const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Arcane Burst':6,'Voidstrike':7}; spells.forEach(s=>{ const b = document.createElement('button'); b.className='secondary'; const cost = Math.max(0,(costMap[s]||0)-(state.spellDiscount||0)); b.textContent = `${s} (${cost})`; b.onclick = ()=>{ castSpell(s); $('spellMenu').classList.add('hidden'); }; container.appendChild(b); }); }

/* ---------- UI binding & render ---------- */
function wireUI(){
  $('btnNew').addEventListener('click', ()=>{ const cls = prompt('New run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls || !["Warrior","Mage","Rogue"].includes(cls)){ alert('Invalid class'); return; } newRun(cls,false,false,false); });
  $('btnReset').addEventListener('click', resetAll);
  $('btnEnterRoom').addEventListener('click', enterRoom);
  $('btnShop').addEventListener('click', openShop);
  $('btnRest').addEventListener('click', ()=>{ if(!state.player){ alert('Start a run first'); return; } if(state.player.gold < 5){ log('Not enough gold to rest.'); return; } state.player.gold -= 5; state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12); state.player.mp = Math.min(state.player.maxMp, state.player.mp + 6); log('You rest at camp (5g) — HP & MP recovered.'); renderAll(); fullSave(); });
  $('btnInventory').addEventListener('click', openInventory);
  $('btnJournal').addEventListener('click', ()=>{ $('journalModal').classList.remove('hidden'); $('journalModal').setAttribute('aria-hidden','false'); renderJournal(); });
  $('btnLeaderboard').addEventListener('click', showLeaderboard);
  $('btnExport').addEventListener('click', ()=>{ const txt = $('log').innerText; const blob = new Blob([txt],{type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `epic_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); });
  $('btnAttack').addEventListener('click', playerAttack);
  $('btnSpell').addEventListener('click', ()=>{ $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
  $('btnItem').addEventListener('click', useItemCombat);
  $('btnRun').addEventListener('click', ()=>{ if(confirm('Attempt to flee?')) attemptRun(); });
  $('btnSpellBack').addEventListener('click', ()=> $('spellMenu').classList.add('hidden'));
  $('btnMeta').addEventListener('click', ()=>{ $('metaModal').classList.remove('hidden'); $('metaModal').setAttribute('aria-hidden','false'); renderMeta(); });
  $('btnDaily').addEventListener('click', openDailyModal);
  $('btnCredits').addEventListener('click', ()=>{ $('creditsModal').classList.remove('hidden'); $('creditsModal').setAttribute('aria-hidden','false'); });
  $('closeCredits').addEventListener('click', ()=>{ $('creditsModal').classList.add('hidden'); $('creditsModal').setAttribute('aria-hidden','true'); });
  $('btnCopySeed')?.addEventListener('click', ()=>{ navigator.clipboard.writeText(location.href.split('?')[0] + '?seed=' + encodeURIComponent(state.seed)).then(()=> alert('Seed link copied to clipboard')); });

  window.closeMeta = ()=>{ $('metaModal').classList.add('hidden'); $('metaModal').setAttribute('aria-hidden','true'); };
  window.closeJournal = ()=>{ $('journalModal').classList.add('hidden'); $('journalModal').setAttribute('aria-hidden','true'); };
  window.closeSummary = ()=>{ $('summaryModal').classList.add('hidden'); $('summaryModal').setAttribute('aria-hidden','true'); };
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape'){ ['metaModal','journalModal','summaryModal','creditsModal','dailyModal'].forEach(id=>{ const el=$(id); if(el && !el.classList.contains('hidden')){ el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); } }); }});
}

/* ---------- Render all ---------- */
function renderAll(){
  if(state.player){
    $('playerName').innerText = state.player.name || '—';
    $('playerClass').innerText = state.classKey || '—';
    derivePlayer();
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
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? state.player.equip.weapon.nameHtml || state.player.equip.weapon.baseName : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? state.player.equip.armor.nameHtml || state.player.equip.armor.baseName : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? state.player.equip.accessory.nameHtml || state.player.equip.accessory.baseName : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${(state.player.inventory||[]).length}`;
  } else {
    $('playerName').innerText = '—';
  }

  /* combat UI */
  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = `${state.currentEnemy.rarity} ${state.currentEnemy.name}`;
    $('enemyHP').innerText = Math.max(0, state.currentEnemy.currentHp || 0);
    $('enemyATK').innerText = state.currentEnemy.atk || 0;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length)? state.currentEnemy.status.map(s=>s.k).join(','): '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = state.currentEnemy.isBoss ? 'Boss battle — focus and survive.' : 'Battle — choose your action.';
    // sprite + name color
    const ba = $('battleArea'); ba.innerHTML = '';
    const spr = createMonsterSpriteEl(state.currentEnemy.sprite || 'rat');
    ba.appendChild(spr);
    const name = document.createElement('div'); name.className = `enemy ${state.currentEnemy.rarity}`; name.innerText = `${state.currentEnemy.rarity} • ${state.currentEnemy.name}`; ba.appendChild(name);
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore rooms, fight monsters, collect relics.';
    $('battleArea').innerHTML = '';
  }

  renderRelicsUI();
  renderJournal();
  renderMeta();
  if($('fragments')) $('fragments').innerText = state.soulFragments || 0;
  if($('seedDisplay')) $('seedDisplay').innerText = state.seed || '—';
  fullSave();
}

/* ---------- Daily modal wiring ---------- */
function openDailyModal(){
  const seed = generateDailySeedForDate(new Date());
  const html = `<div class="small">Today's seed: <code>${seed}</code></div><div style="margin-top:8px"><div class="small muted">Daily runs are single-run challenges. Complete the run for bonus fragments.</div><div style="margin-top:8px">Best local results for today: <button class="secondary" onclick="showDailyLeaderboard()">View</button></div></div>`;
  $('dailyContent').innerHTML = html;
  $('dailyModal').classList.remove('hidden'); $('dailyModal').setAttribute('aria-hidden','false');
  $('btnStartDaily').onclick = ()=> {
    $('dailyModal').classList.add('hidden'); $('dailyModal').setAttribute('aria-hidden','true');
    window.INIT_SEED = seed; if(window.gameInit) gameInit(seed);
    const cls = prompt('Daily run — choose class: Warrior, Mage, Rogue','Warrior');
    if(!cls || !["Warrior","Mage","Rogue"].includes(cls)){ alert('Invalid class — start canceled.'); return; }
    newRun(cls,false,false,true);
  };
}
function closeDaily(){ $('dailyModal').classList.add('hidden'); $('dailyModal').setAttribute('aria-hidden','true'); }

/* ---------- Boot ---------- */
function gameInit(seedString){
  state.seed = seedString || String(Date.now());
  initSeed(state.seed);
  if(fullLoad()){
    if(state.seed !== window.CURRENT_SEED) initSeed(state.seed);
    log('Save loaded on boot.');
  } else {
    log('No save found — create a New Run (top-left). Seed: ' + state.seed);
    fullSave();
  }
  wireUI(); renderAll();
}

/* expose some helpers to console */
window.gameInit = gameInit; window.getItemIcon = getItemIcon; window.generateDailySeed = generateDailySeed;

/* auto-start if seed provided */
if(window.INIT_SEED) gameInit(window.INIT_SEED);
