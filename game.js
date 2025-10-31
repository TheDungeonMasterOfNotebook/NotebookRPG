/* game.js — Legacy of Ash (Phase 3)
   - seeded RNG (mulberry32)
   - events, relics, bosses (multi-phase)
   - cinematic dark-gothic overlays
   - alignment, journal, soul fragments (meta), meta shop
   - audio placeholders, autosave/load/reset, UI wiring
*/

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);
const now = () => (new Date()).toLocaleTimeString();
function log(msg){ const l = $('log'); if(l) l.innerHTML = `<div>[${now()}] ${msg}</div>` + l.innerHTML; }

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
const SAVE_KEY = 'dim_legacy_of_ash_v1';
const META_KEY = 'dim_legacy_meta';
const LEADER_KEY = 'dim_legacy_leader_v1';

/* ---------- Rarity/items (kept minimal) ---------- */
const RARITIES = [
  { key:'Common', css:'rarity-common', mult:1.0, chance:0.45 },
  { key:'Uncommon', css:'rarity-uncommon', mult:1.2, chance:0.25 },
  { key:'Rare', css:'rarity-rare', mult:1.5, chance:0.15 },
  { key:'Epic', css:'rarity-epic', mult:2.0, chance:0.10 },
  { key:'Legendary', css:'rarity-legendary', mult:3.0, chance:0.05 }
];
function pickRarity(){ const r = rnd(); let c=0; for(const it of RARITIES){ c+=it.chance; if(r<=c) return it; } return RARITIES[0]; }
function makeItem(base,type,stats,cost){
  const r = pickRarity();
  return { baseName:base, type, rarity:r.key, rarityCss:r.css, nameHtml:`<span class="${r.css}">${r.key} ${base}</span>`, atk:stats.atk?Math.max(0,Math.round(stats.atk*r.mult)):0, def:stats.def?Math.max(0,Math.round(stats.def*r.mult)):0, hp:stats.hp?Math.max(0,Math.round(stats.hp*r.mult)):0, cost:Math.max(1,Math.round(cost*r.mult)) };
}
function equipmentPool(){ return [ makeItem("Iron Sword","weapon",{atk:3},25), makeItem("Steel Sword","weapon",{atk:5},50), makeItem("Leather Armor","armor",{def:2},20), makeItem("Iron Armor","armor",{def:4},45), makeItem("Amulet of Vitality","accessory",{hp:10},40), makeItem("Ring of Power","accessory",{atk:2},40) ]; }

/* ---------- Relics & Effects ---------- */
function makeRelic(name,rarity,desc,id,effectFn){
  return { name, rarity, desc, id, effectFn };
}
const RELIC_POOL = [
  makeRelic("Traveler's Coin","Common","+10% gold",'coin', (S)=> S.goldMult = (S.goldMult||1)+0.10),
  makeRelic("Minor Charm","Common","+5% dodge",'charm', (S)=> S.dodge = (S.dodge||0)+0.05),
  makeRelic("Dragon Sigil","Rare","Spells cost -1 MP",'dragon_sigil', (S)=> S.spellDiscount = (S.spellDiscount||0)+1),
  makeRelic("Heart of Ash","Rare","+20% fire damage",'heart_ash', (S)=> S.fireBonus = (S.fireBonus||0)+0.20),
  makeRelic("Chrono Crystal","Epic","Once per floor, rewind turn",'chrono', (S)=> S.rewind = true),
  makeRelic("Soul Eater Fang","Epic","Heal 5% of damage dealt",'fang', (S)=> S.lifeSteal = (S.lifeSteal||0)+0.05),
  makeRelic("Aether Crown","Legendary","+1 MP per turn",'crown', (S)=> S.aether = true),
  makeRelic("Oblivion Eye","Legendary","15% chance to nullify incoming attack",'eye', (S)=> S.nullChance = (S.nullChance||0)+0.15)
];

/* ---------- Classes ---------- */
const CLASSES = {
  Warrior: { baseHp:28, baseAtk:7, baseDef:2, mag:2, spells:['Shield'], starter: ()=> [ makeItem('Rusty Sword','weapon',{atk:1},5), makeItem('Leather Armor','armor',{def:1},5) ] },
  Mage: { baseHp:18, baseAtk:3, baseDef:1, mag:8, spells:['Firebolt','Lightning Strike','Heal'], starter: ()=> [ makeItem('Apprentice Staff','weapon',{atk:1},5), makeItem('Cloth Robe','armor',{def:1},4) ] },
  Rogue: { baseHp:22, baseAtk:5, baseDef:1, mag:4, spells:['Ice Shard','Firebolt'], starter: ()=> [ makeItem('Dagger','weapon',{atk:2},8), makeItem('Leather Armor','armor',{def:2},10) ] }
};

/* ---------- Bosses ---------- */
const BOSSES = [
  { id:'shadow_warden', name:'The Shadow Warden', phases:[
      { hp: 80, atk:8, moves:['Dark Slash','Siphon'], text:'The Warden stalks the hall in shadow.' },
      { hp:120, atk:12, moves:['Abyss Nova','Shadow Heal'], text:'The Warden dissolves and reforms, void-black and cruel.' }
    ], reward:'fang' },
  { id:'blood_archon', name:'Blood Archon', phases:[
      { hp:100, atk:9, moves:['Blood Lash','Crimson Mark'], text:'A crowned archon drips ichor.' },
      { hp:150, atk:13, moves:['Hemorrhage','Sanguine Barrier'], text:'The Archon tastes battle and grows stronger.' },
      { hp:200, atk:18, moves:['Obliterate','Life Drain'], text:'The Archon becomes a god of blood.' }
    ], reward:'crown' },
  { id:'spider_queen', name:'Spider Queen', phases:[
      { hp:70, atk:7, moves:['Venom Spit','Web Bind'], text:'A massive spider watches with many eyes.' },
      { hp:110, atk:11, moves:['Brood Summon','Envenom'], text:'The Queen calls her brood; the web grows taut.' }
    ], reward:'dragon_sigil' }
];

/* ---------- State (game + meta) ---------- */
let state = {
  seed: null,
  runId: Date.now(),
  classKey: null,
  player: null,
  floorMap: {},
  currentEnemy: null,
  inCombat: false,
  relics: [],
  legacyRelics: JSON.parse(localStorage.getItem(META_KEY) || '[]') || [],
  alignment: 0, // -100..+100
  journal: [],
  soulFragments: parseInt(localStorage.getItem(META_KEY||'0_frag')||'0') || 0,
  achievements: JSON.parse(localStorage.getItem('dim_achievements')||'{}'),
  ngPlus:false, endless:false, leaderboard: JSON.parse(localStorage.getItem(LEADER_KEY) || '[]')
};

/* ---------- Audio stubs ---------- */
let audioCtx=null;
function beep(freq=440,t=0.04,vol=0.05){ try{ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + t);}catch(e){} }
function playBGM(src){ const bg = $('bgm'); if(!bg) return; if(!src){ bg.pause(); bg.src=''; return; } if(bg.src !== src){ bg.src = src; bg.play().catch(()=>{}); } }

/* ---------- Relic application + alignment helpers ---------- */
function applyRelicEffects(){
  // reset derived relic-driven state
  state.spellDiscount = 0; state.goldMult = 1; state.dodge = 0; state.fireBonus = 0; state.lifeSteal = 0; state.nullChance = 0; state.aether = false; state.rewind = false;
  for(const r of state.relics.concat(state.legacyRelics||[])){
    const found = RELIC_POOL.find(x=>x.id === (r.id||r));
    if(found && typeof found.effectFn === 'function') found.effectFn(state);
  }
}

function changeAlignment(delta){
  state.alignment = Math.max(-100, Math.min(100, (state.alignment||0) + delta));
  const lbl = $('alignmentLabel');
  if(lbl){
    if(state.alignment > 30) lbl.innerText = `Alignment: Redeemed (${state.alignment})`;
    else if(state.alignment < -30) lbl.innerText = `Alignment: Corrupted (${state.alignment})`;
    else lbl.innerText = `Alignment: Neutral (${state.alignment})`;
  }
  // UI tint could be controlled by a CSS variable if desired
}

/* ---------- Derived stats ---------- */
function derivePlayer(){
  if(!state.player) return;
  applyRelicEffects();
  const p = state.player;
  p.maxHp = p.baseHp + (p.equip?.accessory?.hp || 0) + (p.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0);
  p.attack = p.baseAtk + (p.equip?.weapon?.atk || 0) + (p.equip?.accessory?.atk || 0);
  p.defense = p.baseDef + (p.equip?.armor?.def || 0);
  p.maxMp = Math.max(5, p.mag + 3);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
}

/* ---------- Save / Load / Meta ---------- */
function showSaveToast(){ const el = $('saveToast'); if(!el) return; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function fullSave(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(META_KEY, JSON.stringify(state.legacyRelics || []));
    localStorage.setItem('dim_fragments', String(state.soulFragments || 0));
    showSaveToast();
  }catch(e){ console.warn('save failed', e); }
}
function fullLoad(){
  const s = localStorage.getItem(SAVE_KEY);
  if(!s) return false;
  try{
    const loaded = JSON.parse(s);
    // preserve legacy relics from storage
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
  localStorage.removeItem('dim_fragments');
  state = { seed:state.seed || null, runId:Date.now(), classKey:null, player:null, floorMap:{}, currentEnemy:null, inCombat:false, relics:[], legacyRelics:[], alignment:0, journal:[], soulFragments:0, achievements:{}, ngPlus:false, endless:false, leaderboard:[] };
  log('🔁 Save and meta reset.');
  fullSave(); renderAll();
}

/* ---------- New Run ---------- */
function newRun(classKey, ngPlus=false, endless=false){
  if(!CLASSES[classKey]) { alert('Invalid class'); return; }
  const cls = CLASSES[classKey];
  const player = {
    name: classKey, classKey,
    baseHp: cls.baseHp + (ngPlus?2:0), hp: cls.baseHp + (ngPlus?2:0),
    baseAtk: cls.baseAtk + (ngPlus?1:0), baseDef: cls.baseDef, mag: cls.mag,
    mp:10, xp:0, level:1,
    gold:12 + (ngPlus?10:0), potions:1, ethers:1,
    equip:{weapon:null,armor:null,accessory:null},
    inventory: cls.starter? cls.starter() : [], spells: (cls.spells||[]).slice(),
    tempDef:0, status:[], floor:1
  };
  state.classKey = classKey;
  state.player = player;
  state.floorMap = {};
  state.currentEnemy = null;
  state.inCombat = false;
  state.relics = [];
  state.ngPlus = ngPlus;
  state.endless = endless;
  derivePlayer();
  cineShow(`The run is bound by seed ${state.seed}...`,900).then(()=>{ log(`🆕 New run: ${classKey} — seed ${state.seed}`); fullSave(); renderAll(); });
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

/* ---------- Room progression ---------- */
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

/* ---------- Monsters & Bosses ---------- */
function startMonster(){
  const floor = state.player.floor || 1;
  const names = ['Goblin','Skeleton','Bandit','Orc','Troll','Shadow Beast'];
  const name = rChoice(names);
  state.currentEnemy = { name, hp:8 + floor*6, atk:2 + Math.floor(floor*1.1), status:[], isBoss:false };
  state.inCombat = true; log(`⚔️ ${name} appears!`); fullSave(); renderAll();
}
function startBoss(){
  const floor = state.player.floor || 1;
  const bossTpl = rChoice(BOSSES);
  const phases = bossTpl.phases.map(p=> Object.assign({},p));
  state.currentEnemy = { bossId:bossTpl.id, name:bossTpl.name, phases, phaseIndex:0, hp:phases[0].hp, atk:phases[0].atk, moves:phases[0].moves.slice(), isBoss:true, status:[], reward:bossTpl.reward };
  state.inCombat = true;
  cineShow(`🔥 ${state.currentEnemy.name} appears — ${phases[0].text}`,1200).then(()=>{ log(`🔥 Boss: ${state.currentEnemy.name} (Phase 1)`); renderAll(); fullSave(); });
}

/* ---------- Combat actions ---------- */
function playerAttack(){
  if(!state.inCombat || !state.currentEnemy) return;
  derivePlayer();
  const p = state.player; const atk = p.attack || 0;
  const r = rInt(1,6); const dmg = Math.max(1, r + atk - Math.floor((state.currentEnemy.atk||0)/3));
  if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic nullified your attack!'); }
  else {
    state.currentEnemy.hp = Math.max(0, (state.currentEnemy.hp||0) - dmg);
    log(`⚔️ You attack for ${dmg} damage.`);
    if(state.lifeSteal){ const heal = Math.max(1, Math.round(dmg * state.lifeSteal)); state.player.hp = Math.min(maxHpLocal(), state.player.hp + heal); log(`💉 Lifesteal: +${heal} HP.`); }
  }
  beep(420,0.04,0.04);
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

function showSpellMenu(){ $('spellMenu').classList.remove('hidden'); renderSpellButtons(); }
function hideSpellMenu(){ $('spellMenu').classList.add('hidden'); }
function castSpell(spell){
  if(!state.inCombat || !state.currentEnemy) return;
  const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Arcane Burst':6};
  const discount = state.spellDiscount || 0; const cost = Math.max(0, (costMap[spell]||0) - discount);
  if(state.player.mp < cost){ log('Not enough MP.'); return; }
  state.player.mp -= cost;
  if(spell === 'Firebolt'){ const dmg = 5 + state.player.floor; const bonus = state.fireBonus? Math.round(dmg*state.fireBonus):0; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - (dmg+bonus)); log(`🔥 Firebolt ${dmg + (bonus?(' +'+bonus):'')} dmg.`); }
  else if(spell === 'Ice Shard'){ const dmg = 3 + Math.floor(state.player.mag/4); state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg); state.currentEnemy.atk = Math.max(1, state.currentEnemy.atk - 1); log(`❄️ Ice Shard ${dmg} dmg, -1 ATK.`); }
  else if(spell === 'Heal'){ const h = 5 + Math.floor(state.player.mag/3); state.player.hp = Math.min(maxHpLocal(), state.player.hp + h); log(`💚 Heal +${h} HP.`); }
  else if(spell === 'Lightning Strike'){ if(rnd() < 0.6){ const d = 8 + state.player.floor; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - d); log(`⚡ Lightning hits ${d}!`); } else log('⚡ Lightning missed!'); }
  else if(spell === 'Shield'){ state.player.tempDef = (state.player.tempDef||0)+3; log('🛡️ Shield +3 DEF for next hit.'); }
  else if(spell === 'Arcane Burst'){ const d = 12 + Math.floor(state.player.mag/2); state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - d); log(`✨ Arcane Burst dealt ${d}.`); }
  hideSpellMenu();
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

function useItemCombat(){
  const p = state.player;
  if(p.potions > 0){ p.potions--; const heal = rInt(6,12); p.hp = Math.min(maxHpLocal(), p.hp + heal); log(`🧴 Potion +${heal} HP.`); }
  else if(p.ethers > 0){ p.ethers--; const m = rInt(4,8); p.mp = Math.min(p.maxMp || 10, p.mp + m); log(`🔮 Ether +${m} MP.`); }
  else log('No items.');
  enemyTurn(); fullSave(); renderAll();
}
function attemptRun(){ if(!state.inCombat) return; if(rnd() < 0.5){ log('🏃 You escape.'); state.inCombat=false; state.currentEnemy=null; renderAll(); fullSave(); } else { log('✋ Escape failed.'); enemyTurn(); fullSave(); } }

/* ---------- Enemy turn & statuses ---------- */
function tickStatus(entity){
  if(!entity || !entity.status) return;
  const remaining = [];
  for(const s of entity.status){
    if(s.k === 'poison'){ entity.hp = Math.max(0, entity.hp - (s.p||1)); log(`${entity.name||'You'} suffers ${(s.p||1)} poison.`); }
    if(s.k === 'burn'){ entity.hp = Math.max(0, entity.hp - (s.p||2)); log(`${entity.name||'You'} burns for ${(s.p||2)}.`); }
    s.t = (s.t||1)-1;
    if(s.t > 0) remaining.push(s);
  }
  entity.status = remaining;
}

function enemyTurn(){
  if(!state.currentEnemy) return;
  tickStatus(state.currentEnemy);
  if(state.currentEnemy.hp <= 0) return onVictory();
  const e = state.currentEnemy;
  if(e.isBoss && e.phases){
    const move = rChoice(e.moves || e.phases[e.phaseIndex].moves);
    // interpret a few named moves:
    if(move === 'Siphon'){ const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); e.hp = Math.max(0, e.hp + Math.min(6, Math.floor(dmg/2))); log(`🖤 ${e.name} uses Siphon — ${dmg} dmg and heals.`); }
    else if(move === 'Dark Slash'){ const dmg = Math.max(1, e.atk + rInt(-1,1) - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`🔪 ${e.name} uses Dark Slash — ${dmg} dmg.`); }
    else if(move === 'Abyss Nova'){ const dmg = Math.max(2, e.atk + 4 - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`💥 ${e.name} unleashes Abyss Nova — ${dmg} dmg.`); }
    else if(move === 'Venom Spit'){ state.player.status = state.player.status || []; state.player.status.push({k:'poison',t:3,p:2}); log('🕷️ Venom Spit poisons you.'); }
    else if(move === 'Web Bind'){ state.player.tempDef = Math.max(0, (state.player.tempDef||0) - 1); log('🕸️ Web binds — your next defense reduced.'); }
    else if(move === 'Blood Lash'){ const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`🩸 Blood Lash — ${dmg} dmg.`); }
    else if(move === 'Obliterate'){ const dmg = Math.max(4, e.atk + 6 - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`☠️ Obliterate — ${dmg} dmg.`); }
    else { const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`${e.name} attacks for ${dmg}.`); }
  } else {
    const dmg = Math.max(1, (state.currentEnemy.atk || 2) + rInt(-1,1) - (state.player.defense||0) - (state.player.tempDef||0));
    state.player.tempDef = 0;
    if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic blocked the enemy attack!'); }
    else { state.player.hp = Math.max(0, state.player.hp - dmg); log(`💥 ${state.currentEnemy.name} hits for ${dmg}.`); }
  }
  tickStatus(state.player);
  if(state.player.hp <= 0){ log('💀 You died. Run ends.'); onRunEnd(); }
  if(state.currentEnemy && state.currentEnemy.isBoss) checkBossPhase();
}

/* ---------- Boss phases ---------- */
function checkBossPhase(){
  const e = state.currentEnemy;
  if(!e || !e.phases) return;
  const idx = e.phaseIndex;
  if(e.hp <= 0 && idx < e.phases.length - 1){
    e.phaseIndex++;
    const np = e.phases[e.phaseIndex];
    e.hp = np.hp; e.atk = np.atk; e.moves = np.moves.slice();
    cineShow(`${e.name} collapses and reforms — ${np.text}`, 1200).then(()=>{ log(`⚠️ ${e.name} shifts to Phase ${e.phaseIndex+1}`); renderAll(); fullSave(); });
  }
}

/* ---------- Victory & drops ---------- */
function onVictory(){
  const e = state.currentEnemy; const isBoss = !!e && !!e.isBoss;
  const goldGain = rInt(8,16) + (state.player.floor||1)*3 + (isBoss?18:0);
  state.player.gold = (state.player.gold||0) + Math.round(goldGain * (state.goldMult||1));
  log(`🏆 Defeated ${e.name}! +${Math.round(goldGain * (state.goldMult||1))} gold.`);
  if(isBoss){
    // award boss relic if template says
    const rewardId = e.reward;
    if(rewardId){
      const relicTpl = RELIC_POOL.find(r=>r.id===rewardId);
      if(relicTpl){ state.relics.push({id:relicTpl.id, name:relicTpl.name}); log(`🎁 Boss relic: ${relicTpl.name}`); applyRelicEffects(); }
    }
    // drop gear
    const pool = equipmentPool(); const reward = rChoice(pool); state.player.inventory = state.player.inventory||[]; state.player.inventory.push(reward);
    state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12);
    // grant journal entry
    addJournal(`${e.name} was vanquished. A fragment of the Order's past is revealed.`);
    // award soul fragments
    state.soulFragments = (state.soulFragments||0) + Math.max(3, Math.floor((state.player.floor||1)/2));
  } else {
    if(rnd() < 0.28){ state.player.potions = (state.player.potions||0)+1; log('🧴 Found a potion.'); }
    else if(rnd() < 0.2){ const pool = equipmentPool(); const it = rChoice(pool); state.player.inventory.push(it); log(`🎁 Drop: ${it.rarity} ${it.baseName}`); }
  }
  // XP & level
  const xpGain = 5 + (state.player.floor||1);
  state.player.xp = (state.player.xp||0) + xpGain;
  checkLevel();
  state.currentEnemy = null; state.inCombat = false; derivePlayer(); fullSave(); renderAll();
}

/* ---------- Leveling ---------- */
function checkLevel(){
  const p = state.player; const xpTo = 8 + p.level * 6;
  while(p.xp >= xpTo){ p.xp -= xpTo; p.level++;
    const choices = [ {name:'+3 HP',apply:pl=>{pl.baseHp+=3; log('Perk: +3 HP');}}, {name:'+1 ATK',apply:pl=>{pl.baseAtk+=1; log('Perk: +1 ATK');}}, {name:'+1 DEF',apply:pl=>{pl.baseDef+=1; log('Perk: +1 DEF');}}, {name:'+1 MAG',apply:pl=>{pl.mag+=1; log('Perk: +1 MAG');}} ];
    const a = rInt(0,choices.length-1); let b = rInt(0,choices.length-1); while(b===a) b = rInt(0,choices.length-1);
    const pick = prompt(`Level up! Pick:\n1) ${choices[a].name}\n2) ${choices[b].name}\nEnter 1 or 2`,'1'); const idx = (pick==='2')?b:a;
    choices[idx].apply(p); derivePlayer(); fullSave();
  }
}

/* ---------- Chests / Shops / Events ---------- */
function openChest(){ if(!state.player) return; if(rnd() < 0.55){ const pool = equipmentPool(); const it = rChoice(pool); state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`🎁 Chest: Found ${it.rarity} ${it.baseName}`); } else { const g = rInt(6,26) + (state.player.floor||1)*2; state.player.gold = (state.player.gold||0) + Math.round(g * (state.goldMult||1)); log(`💰 Chest: +${Math.round(g * (state.goldMult||1))} gold.`); } fullSave(); renderAll(); }

let lastShop = [];
function openShop(){ if(state.inCombat){ log('Cannot shop during combat.'); return; } const pool = equipmentPool(); lastShop = []; for(let i=0;i<3;i++) lastShop.push(rChoice(pool)); lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8 }); lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6 });
  let html = `<div class="small">Merchant's Wares</div><div class="shop-list" style="margin-top:8px">`;
  lastShop.forEach((it,idx)=>{ html += `<div class="item-row"><div>${it.nameHtml || it.baseName}${it.rarity?` <span class="small muted">(${it.rarity})</span>`:''}</div><div><span class="small">${it.cost}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html; log('🏪 Merchant appears.'); fullSave();
}
function buy(idx){ const it = lastShop[idx]; if(!it) return; if(!state.player){ log('Start a run first'); return; } if(state.player.gold < it.cost){ log('Not enough gold.'); return; } state.player.gold -= it.cost; if(it.type==='consumable'){ if(it.baseName==='Potion') state.player.potions=(state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers=(state.player.ethers||0)+1; log(`Bought ${it.baseName}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`Bought ${it.rarity||''} ${it.baseName}`); } fullSave(); renderAll(); }
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

/* ---------- Events: expanded & narrative ---------- */
function addJournal(text){ state.journal = state.journal || []; state.journal.unshift({text, time: new Date().toISOString()}); fullSave(); }
const EVENTS = [
  { id:'whisper_door', text:'A door hums with whispers. Speak your name into it or remain silent?', choices:[
      { label:'Speak', func: s=>{ s.player.xp=(s.player.xp||0)+5; s.player.hp = Math.max(1, s.player.hp - 5); changeAlignment(-2); addJournal('You whispered to the Door — a fragment answered.'); log('The door answers — +5 XP, -5 HP.'); } },
      { label:'Silent', func: s=>{ if(rnd()<0.35){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); addJournal('Silence rewarded with a relic.'); log(`Silence rewards you: ${r.name}`); } else { log('Silence brings nothing.'); } } }
  ]},
  { id:'cursed_fountain', text:'A cursed fountain bubbles. Drink to heal but risk a curse?', choices:[
      { label:'Drink', func: s=>{ if(rnd()<0.5){ s.player.hp = Math.min(maxHpLocal(), s.player.hp + 12); addJournal('The fountain healed you painfully.'); log('It heals you...'); } else { s.player.status = s.player.status || []; s.player.status.push({k:'poison',t:3,p:2}); changeAlignment(-3); addJournal('The fountain cursed your blood.'); log('A curse! Poisoned.'); } } },
      { label:'Pass', func: s=>{ log('You pass the fountain.'); } }
  ]},
  { id:'wandering_merchant', text:'A hooded merchant offers a relic for gold (rare chance). Buy or bargain?', choices:[
      { label:'Buy (20g)', func: s=>{ if(s.player.gold < 20){ log('Not enough gold.'); return; } s.player.gold -= 20; if(rnd()<0.30){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); addJournal('You purchased a strange relic from the merchant.'); log(`They hand you ${r.name}.`); } else { const pool = equipmentPool(); s.player.inventory.push(rChoice(pool)); addJournal('You bought a curious trinket.'); log('You bought a trinket (item).'); } } },
      { label:'Bargain (gain 6g)', func: s=>{ s.player.gold += 6; addJournal('You haggled with the merchant and earned coin.'); log('You haggle and gain 6 gold.'); } }
  ]},
  { id:'fallen_knight', text:'A fallen knight holds a broken blade — take it (rare weapon) or bury them?', choices:[
      { label:'Take', func: s=>{ const pool = equipmentPool(); const it = rChoice(pool); s.player.inventory.push(it); s.player.hp = Math.max(1, s.player.hp - 10); changeAlignment(-4); addJournal('You took the blade and the knight’s shame.'); log(`You take ${it.rarity} ${it.baseName}, but lose 10 HP.`); } },
      { label:'Bury', func: s=>{ s.honor = (s.honor||0) + 1; changeAlignment(+3); addJournal('You buried the knight with respect.'); log('You bury the knight. Honor increases.'); } }
  ]},
  { id:'sudden_trap', text:'A pressure tile clicks — try to disarm or dash through?', choices:[
      { label:'Disarm', func: s=>{ if(rnd()<0.5){ addJournal('You carefully disarmed the trap.'); log('You disarm it.'); } else { const d = rInt(4,10); s.player.hp = Math.max(0, s.player.hp - d); addJournal('A trap cuts you; it was brutal.'); log(`Trap triggers — ${d} damage.`); } } },
      { label:'Dash', func: s=>{ if(rnd()<0.6){ log('You dash through untouched.'); } else { const d = rInt(6,12); s.player.hp = Math.max(0, s.player.hp - d); addJournal('You stumble into a trap while dashing.'); log(`You stumble — ${d} damage.`); } } }
  ]},
  { id:'blood_altar', text:'A blood altar offers power for a price — sacrifice HP for gold?', choices:[
      { label:'Offer 8 HP (gain 20g)', func: s=>{ if(s.player.hp > 8){ s.player.hp -= 8; s.player.gold += 20; changeAlignment(-5); addJournal('You offered blood to the altar.'); log('The altar feeds — +20g, -8 HP.'); } else log('Too weak to sacrifice.'); } },
      { label:'Refuse', func: s=>{ addJournal('You refuse the altar and walk away.'); log('You refuse the altar.'); } }
  ]},
  { id:'obsidian_mirror', text:'An obsidian mirror shows a possible future — view it (gain hint) or not?', choices:[
      { label:'View (hint)', func: s=>{ const floor = s.player.floor || 1; const f = genFloor(floor); const next = f.rooms[f.pointer] || {type:'none'}; s.nextHint = next.type; addJournal('A shard of future glimpsed in black glass.'); log(`The mirror shows: next room may be ${next.type}.`); } },
      { label:'Avoid', func: s=>{ log('You avert your gaze.'); } }
  ]},
  { id:'bloodied_banner', text:'A tattered banner flutters — claim it (temporary buff) or leave?', choices:[
      { label:'Claim', func: s=>{ s.tempBanner = (s.tempBanner||0)+1; changeAlignment(+1); addJournal('You claimed the banner — morale rises.'); log('You claim the banner — minor buff.'); } },
      { label:'Leave', func: s=>{ log('You leave the banner.'); } }
  ]},
  { id:'wandering_song', text:'A haunting song passes — listen (gain MP) or cover ears?', choices:[
      { label:'Listen', func: s=>{ s.player.mp = Math.min(s.player.maxMp || 10, s.player.mp + rInt(3,6)); addJournal('A haunting melody restored your mind.'); log('The song restores some MP.'); } },
      { label:'Cover', func: s=>{ log('You keep your focus.'); } }
  ]},
  { id:'mire_path', text:'A misty path splits — choose the narrow or wide way?', choices:[
      { label:'Narrow', func: s=>{ if(rnd()<0.5){ const pool = equipmentPool(); s.player.inventory.push(rChoice(pool)); addJournal('Treasure found down the narrow way.'); log('Treasure found in the narrow way.'); } else { s.player.hp = Math.max(0, s.player.hp - rInt(4,10)); addJournal('The narrow way cut you with some hidden spike.'); log('A hidden spike cuts you.'); } } },
      { label:'Wide', func: s=>{ if(rnd()<0.7){ s.player.gold += rInt(6,14); addJournal('A safer road with coins scattered.'); log('You find coins on the wide path.'); } else log('The wide path yields nothing.'); } }
  ]},
  { id:'ancient_scroll', text:'A damp scroll contains a ritual — learn spell or trade for gold?', choices:[
      { label:'Study', func: s=>{ if(rnd()<0.35){ s.player.spells = s.player.spells || []; if(!s.player.spells.includes('Arcane Burst')){ s.player.spells.push('Arcane Burst'); addJournal('You learned Arcane Burst from a brittle scroll.'); log('You learn Arcane Burst!'); } else log('The scroll offered nothing new.'); } else log('The text is faded — nothing learned.'); } },
      { label:'Sell', func: s=>{ s.player.gold += 18; addJournal('You sold an ancient scroll for coin.'); log('You sell the scroll for 18g.'); } }
  ]},
  { id:'tomb_whisper', text:'A voice from a tomb offers a relic for a favor — agree or refuse?', choices:[
      { label:'Agree', func: s=>{ if(rnd()<0.25){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); addJournal('The tomb granted you a relic, at cost.'); log(`The tomb grants relic: ${r.name}`); } else { s.player.hp = Math.max(0,s.player.hp - rInt(6,12)); addJournal('The bargain drains your life.'); log('The bargain drains you.'); } } },
      { label:'Refuse', func: s=>{ log('You refuse the tomb.'); } }
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

/* ---------- Inventory / Equip ---------- */
function openInventory(){
  if(!state.player) return; if(state.inCombat){ log('Finish combat first.'); return; }
  const inv = state.player.inventory || [];
  let html = `<div class="small">Inventory</div><div class="inv-list">`;
  if(inv.length === 0) html += `<div class="small">— empty —</div>`;
  inv.forEach((it, idx)=>{ const stats = `${it.atk?`ATK+${it.atk} `:''}${it.def?`DEF+${it.def} `:''}${it.hp?`HP+${it.hp}`:''}`; html+= `<div class="item-row"><div>${it.nameHtml || it.baseName}<div class="small">${stats}</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
}
function equipItem(idx){ const it = state.player.inventory[idx]; if(!it) return; if(!['weapon','armor','accessory'].includes(it.type)){ log('Not equippable.'); return; } const slot = it.type; if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName}`); } state.player.equip[slot] = it; state.player.inventory.splice(idx,1); log(`🛡️ Equipped ${it.rarity} ${it.baseName}`); derivePlayer(); fullSave(); renderAll(); }
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity} ${it.baseName}\nATK:${it.atk}\nDEF:${it.def}\nHP:${it.hp}\nValue:${it.cost}g`); }

/* ---------- Helpers ---------- */
function totalDefLocal(){ return (state.player.baseDef || 0) + (state.player.equip?.armor?.def || 0); }
function maxHpLocal(){ return (state.player.baseHp || 0) + (state.player.equip?.accessory?.hp || 0) + (state.player.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0); }

/* ---------- Export & Leaderboard ---------- */
function exportLog(){ const txt = $('log').innerText; const blob = new Blob([txt],{type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `dim_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); }
function showLeaderboard(){ const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]'); if(lb.length===0){ alert('No runs recorded.'); return; } lb.sort((a,b)=> b.floor - a.floor); let txt = 'Local Leaderboard\n'; lb.slice(0,10).forEach((e,i)=> txt += `${i+1}. Floor ${e.floor} • Gold ${e.gold} • Class ${e.class}\n`); alert(txt); }

/* ---------- Spell UI ---------- */
function renderSpellButtons(){ const container = $('spellRow'); if(!container) return; container.innerHTML = ''; if(!state.player) return; const spells = state.player.spells || []; const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Arcane Burst':6}; spells.forEach(s=>{ const b = document.createElement('button'); b.className='secondary'; const cost = Math.max(0,(costMap[s]||0)-(state.spellDiscount||0)); b.textContent = `${s} (${cost})`; b.onclick = ()=>{ castSpell(s); $('spellMenu').classList.add('hidden'); }; container.appendChild(b); }); }

/* ---------- Render helpers ---------- */
function renderRelicsUI(){
  const el = $('relicRow'); if(!el) return; el.innerHTML = ''; const combined = (state.relics||[]).concat(state.legacyRelics||[]); if(combined.length===0){ el.innerText = 'Relics: —'; return; } for(const r of combined){ const pill = document.createElement('div'); pill.className='relic-pill'; pill.innerText = (r.name||r.id); el.appendChild(pill); }
}
function renderJournal(){
  const el = $('journalContent'); if(!el) return; el.innerHTML = ''; const j = state.journal || []; if(j.length===0) el.innerHTML = `<div class="small muted">— No entries yet —</div>`; j.forEach(entry=>{ const d = new Date(entry.time).toLocaleString(); el.innerHTML += `<div style="margin-bottom:8px"><div class="small muted">${d}</div><div>${entry.text}</div></div>`; });
}
function renderMeta(){
  const el = $('metaContent'); if(!el) return;
  let html = `<div class="small">Fragments: <strong>${state.soulFragments||0}</strong></div><div style="margin-top:8px">`;
  // cost examples: unlock legacy relics
  const offers = [
    { id:'legacy_fang', name:'Legacy Soul Eater Fang', cost:6, desc:'Persisting Soul Eater Fang (Epic effect).' , relicId:'fang'},
    { id:'legacy_crown', name:'Legacy Aether Crown', cost:10, desc:'Persisting Aether Crown (Legendary).' , relicId:'crown'},
    { id:'unlock_mage', name:'Unlock: Arcane Path (starter spell)', cost:4, desc:'Gain a permanent starting spell for Mages.' , relicId:null}
  ];
  offers.forEach((o, idx)=>{ html += `<div class="item-row"><div><strong>${o.name}</strong><div class="small muted">${o.desc}</div></div><div><span class="small">${o.cost} fragments</span> <button class="secondary" onclick="buyMeta(${idx})">Buy</button></div></div>`; });
  html += `</div>`;
  el.innerHTML = html;
}
function buyMeta(idx){
  const offers = [
    { id:'legacy_fang', name:'Legacy Soul Eater Fang', cost:6, relicId:'fang'},
    { id:'legacy_crown', name:'Legacy Aether Crown', cost:10, relicId:'crown'},
    { id:'unlock_mage', name:'Unlock Arcane Path', cost:4, relicId:null}
  ];
  const o = offers[idx];
  if(!o) return; if(state.soulFragments < o.cost){ alert('Not enough Soul Fragments'); return; }
  state.soulFragments -= o.cost;
  if(o.relicId){ const tpl = RELIC_POOL.find(r=>r.id===o.relicId); if(tpl){ state.legacyRelics.push({id:tpl.id,name:tpl.name}); applyRelicEffects(); log(`Meta: purchased legacy relic ${tpl.name}`); addJournal(`A legacy relic, ${tpl.name}, was gained.`); } }
  else { // unlock: in this simple demo, grant a guaranteed spell to all Mages or add a general relic
    state.legacyRelics.push({id:'arcane_path', name:'Arcane Path'}); log('Meta: Arcane Path unlocked.'); addJournal('Arcane Path unlocked in the meta.'); 
  }
  fullSave(); renderMeta(); renderAll();
}

/* ---------- Render All ---------- */
function renderAll(){
  // player panel
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
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? state.player.equip.weapon.nameHtml : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? state.player.equip.armor.nameHtml : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? state.player.equip.accessory.nameHtml : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${(state.player.inventory||[]).length}`;
  } else {
    $('playerName').innerText = '—';
  }

  // combat UI
  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = state.currentEnemy.name;
    $('enemyHP').innerText = Math.max(0, state.currentEnemy.hp || 0);
    $('enemyATK').innerText = state.currentEnemy.atk || 0;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length)? state.currentEnemy.status.map(s=>s.k).join(','): '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = 'Battle — choose your action.';
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore rooms, fight monsters, collect relics.';
  }

  // relic UI
  renderRelicsUI();
  // journal & meta
  renderJournal();
  renderMeta();
  // fragments
  if($('fragments')) $('fragments').innerText = state.soulFragments || 0;
  // seed display
  if($('seedDisplay')) $('seedDisplay').innerText = state.seed || '—';
  fullSave();
}

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

/* ---------- UI bindings ---------- */
function wireUI(){
  $('btnNew').addEventListener('click', ()=>{ const cls = prompt('New run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls || !CLASSES[cls]){ alert('Invalid class'); return; } newRun(cls,false,false); });
  $('btnReset').addEventListener('click', resetAll);
  $('btnEnterRoom').addEventListener('click', enterRoom);
  $('btnShop').addEventListener('click', openShop);
  $('btnRest').addEventListener('click', ()=>{ if(!state.player){ alert('Start a run first'); return; } if(state.player.gold < 5){ log('Not enough gold to rest.'); return; } state.player.gold -= 5; state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12); state.player.mp = Math.min(state.player.maxMp || 10, state.player.mp + 6); log('You rest at camp (5g) — HP & MP recovered.'); renderAll(); fullSave(); });
  $('btnInventory').addEventListener('click', openInventory);
  $('btnJournal').addEventListener('click', ()=>{ $('journalModal').classList.remove('hidden'); $('journalModal').setAttribute('aria-hidden','false'); renderJournal(); });
  $('btnLeaderboard').addEventListener('click', showLeaderboard);
  $('btnExport').addEventListener('click', exportLog);
  $('btnAttack').addEventListener('click', playerAttack);
  $('btnSpell').addEventListener('click', ()=>{ $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
  $('btnItem').addEventListener('click', useItemCombat);
  $('btnRun').addEventListener('click', ()=>{ if(confirm('Attempt to flee?')) attemptRun(); });
  $('btnSpellBack').addEventListener('click', ()=> $('spellMenu').classList.add('hidden'));
  $('btnMeta').addEventListener('click', ()=>{ $('metaModal').classList.remove('hidden'); $('metaModal').setAttribute('aria-hidden','false'); renderMeta(); });
  $('btnCopySeed')?.addEventListener('click', ()=>{ navigator.clipboard.writeText(location.href.split('?')[0] + '?seed=' + encodeURIComponent(state.seed)).then(()=> alert('Seed link copied to clipboard')); });
  // modal close helpers
  window.closeMeta = ()=>{ $('metaModal').classList.add('hidden'); $('metaModal').setAttribute('aria-hidden','true'); };
  window.closeJournal = ()=>{ $('journalModal').classList.add('hidden'); $('journalModal').setAttribute('aria-hidden','true'); };
  window.closeSummary = ()=>{ $('summaryModal').classList.add('hidden'); $('summaryModal').setAttribute('aria-hidden','true'); };
}

/* ---------- End-of-run summary & achievements ---------- */
function onRunEnd(){
  // compute fragments reward
  const floors = state.player?.floor || 1;
  const fragmentsEarned = Math.max(1, Math.floor(floors / 2));
  state.soulFragments = (state.soulFragments || 0) + fragmentsEarned;
  // record to leaderboard
  const entry = { floor: floors, gold: state.player?.gold || 0, class: state.classKey || 'Unknown', seed: state.seed || '' };
  const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]'); lb.push(entry); localStorage.setItem(LEADER_KEY, JSON.stringify(lb));
  // achievements (simple examples)
  state.achievements = state.achievements || {};
  if(floors >= 10) state.achievements['Deep Delver'] = true;
  if((state.relics||[]).length >= 3) state.achievements['Relic Hunter'] = true;
  localStorage.setItem('dim_achievements', JSON.stringify(state.achievements||{}));
  // show summary modal
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
  // reset run-specific state
  state.player = null; state.floorMap = {}; state.currentEnemy = null; state.inCombat = false; fullSave(); renderAll();
}

/* ---------- Meta shop UI helpers (closeMeta/buyMeta implemented earlier) ---------- */

/* ---------- Boot: gameInit ---------- */
function gameInit(seedString){
  state.seed = seedString || String(Date.now());
  initSeed(state.seed);
  // try to load existing save
  if(fullLoad()){
    if(state.seed !== window.CURRENT_SEED) initSeed(state.seed);
    log('Save loaded on boot.');
  } else {
    log('No save found — create a New Run (top-left). Seed: ' + state.seed);
    fullSave();
  }
  wireUI(); renderAll();
}

/* expose gameInit to index.html */
window.gameInit = gameInit;

/* If index.html provided an initial seed before load */
if(window.INIT_SEED) gameInit(window.INIT_SEED);
