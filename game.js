/* game.js — Dark Gothic expansion:
   - seeded RNG (mulberry32)
   - expanded events, relics, boss phases
   - cinematic cutscenes in dark gothic style
   - autosave/load/reset + relic UI + all prior mechanics
*/

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);
const now = () => (new Date()).toLocaleTimeString();
function log(msg){ const l = $('log'); if(l) l.innerHTML = `<div>[${now()}] ${msg}</div>` + l.innerHTML; }

/* ---------- Seeded RNG (mulberry32) ---------- */
let RNG_STATE = null;
function mulberry32(a){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function initSeed(seedStr){
  // convert string to numeric seed deterministically
  let s = 0;
  for(let i=0;i<seedStr.length;i++) s = (s * 131 + seedStr.charCodeAt(i)) >>> 0;
  if(s === 0) s = (Date.now() & 0xffffffff);
  RNG_STATE = mulberry32(s);
  window.CURRENT_SEED = seedStr;
  if($('seedDisplay')) $('seedDisplay').innerText = seedStr;
}
function rnd(){ return RNG_STATE ? RNG_STATE() : Math.random(); }
function rInt(a,b){ return Math.floor(rnd()*(b-a+1))+a; }
function rChoice(arr){ return arr[Math.floor(rnd()*arr.length)]; }

/* ---------- Save keys ---------- */
const SAVE_KEY = 'dim_darkgothic_v2';
const LEADER_KEY = 'dim_darkgothic_leader_v2';

/* ---------- Rarities / Items ---------- */
const RARITIES = [
  { key:'Common', css:'rarity-common', mult:1.0, chance:0.45 },
  { key:'Uncommon', css:'rarity-uncommon', mult:1.2, chance:0.25 },
  { key:'Rare', css:'rarity-rare', mult:1.5, chance:0.15 },
  { key:'Epic', css:'rarity-epic', mult:2.0, chance:0.10 },
  { key:'Legendary', css:'rarity-legendary', mult:3.0, chance:0.05 }
];
function pickRarity(){ const r = rnd(); let c=0; for(let it of RARITIES){ c+=it.chance; if(r<=c) return it; } return RARITIES[0]; }
function makeItem(base,type,stats,cost){
  const r = pickRarity();
  return { baseName:base, type, rarity:r.key, rarityCss:r.css, nameHtml:`<span class="${r.css}">${r.key} ${base}</span>`, atk:stats.atk?Math.max(0,Math.round(stats.atk*r.mult)):0, def:stats.def?Math.max(0,Math.round(stats.def*r.mult)):0, hp:stats.hp?Math.max(0,Math.round(stats.hp*r.mult)):0, cost:Math.max(1,Math.round(cost*r.mult)) };
}
function equipmentPool(){ return [ makeItem("Iron Sword","weapon",{atk:3},25), makeItem("Steel Sword","weapon",{atk:5},50), makeItem("Leather Armor","armor",{def:2},20), makeItem("Iron Armor","armor",{def:4},45), makeItem("Amulet of Vitality","accessory",{hp:10},40), makeItem("Ring of Power","accessory",{atk:2},40) ]; }

/* ---------- Relics (expanded) ---------- */
function makeRelic(name,rarity,desc,id,effectFn){
  return { name, rarity, desc, id, effectFn };
}
const RELIC_POOL = [
  makeRelic('Traveler\'s Coin','Common','+10% gold found','coin', (s)=> s.goldMult = (s.goldMult||1) + 0.10),
  makeRelic('Minor Charm','Common','+5% dodge chance','charm', (s)=> s.dodge = (s.dodge||0)+0.05),
  makeRelic('Dragon Sigil','Rare','Spells cost -1 MP','dragon_sigil', (s)=> s.spellDiscount = (s.spellDiscount||0)+1),
  makeRelic('Heart of Ash','Rare','+20% fire spell damage','heart_ash', (s)=> s.fireBonus = (s.fireBonus||0)+0.20),
  makeRelic('Chrono Crystal','Epic','Once per floor, rewind one turn','chrono', (s)=> s.rewind = true),
  makeRelic('Soul Eater Fang','Epic','Heal 5% of damage dealt','fang', (s)=> s.lifeSteal = (s.lifeSteal||0) + 0.05),
  makeRelic('Aether Crown','Legendary','Gain +1 MP each turn','crown', (s)=> s.aether = true),
  makeRelic('Oblivion Eye','Legendary','15% chance to nullify incoming attack','eye', (s)=> s.nullChance = (s.nullChance||0)+0.15)
];

/* ---------- Classes ---------- */
const CLASSES = {
  Warrior: { baseHp:28, baseAtk:7, baseDef:2, mag:2, spells:['Shield'], starter: ()=> [ makeItem('Rusty Sword','weapon',{atk:1},5), makeItem('Leather Armor','armor',{def:1},5) ] },
  Mage: { baseHp:18, baseAtk:3, baseDef:1, mag:8, spells:['Firebolt','Lightning Strike','Heal'], starter: ()=> [ makeItem('Apprentice Staff','weapon',{atk:1},5), makeItem('Cloth Robe','armor',{def:1},4) ] },
  Rogue: { baseHp:22, baseAtk:5, baseDef:1, mag:4, spells:['Ice Shard','Firebolt'], starter: ()=> [ makeItem('Dagger','weapon',{atk:2},8), makeItem('Leather Armor','armor',{def:2},10) ] }
};

/* ---------- Boss templates (multi-phase) ---------- */
const BOSSES = [
  {
    id:'shadow_warden',
    name:'The Shadow Warden',
    phases:[
      { hp: 80, atk: 8, moves: ['Dark Slash','Siphon'] , text:'The Warden stalks the hall in shadow.' },
      { hp: 120, atk: 12, moves: ['Abyss Nova','Shadow Heal'], text:'The Warden dissolves and reforms, void-black and cruel.' }
    ],
    rewardRelicId:'fang'
  },
  {
    id:'blood_archon',
    name:'Blood Archon',
    phases:[
      { hp: 100, atk: 9, moves: ['Blood Lash','Crimson Mark'], text:'A crowned archon drips ichor.' },
      { hp: 150, atk: 13, moves: ['Hemorrhage','Sanguine Barrier'], text:'The Archon tastes battle and grows stronger.' },
      { hp: 200, atk: 18, moves: ['Obliterate','Life Drain'], text:'The Archon becomes a god of blood.' }
    ],
    rewardRelicId:'crown'
  },
  {
    id:'spider_queen',
    name:'Spider Queen',
    phases:[
      { hp: 70, atk: 7, moves: ['Venom Spit','Web Bind'], text:'A massive spider watches with many eyes.' },
      { hp: 110, atk: 11, moves: ['Brood Summon','Envenom'], text:'The Queen calls her brood; the web grows taut.' }
    ],
    rewardRelicId:'dragon_sigil'
  }
];

/* ---------- Game state ---------- */
let state = {
  seed: null,
  runId: Date.now(),
  classKey: null,
  player: null,
  floorMap: {},
  currentEnemy: null,
  inCombat: false,
  relics: [],
  ngPlus: false,
  endless: false,
  leaderboard: JSON.parse(localStorage.getItem(LEADER_KEY) || '[]')
};

/* ---------- Audio ---------- */
let audioCtx = null;
function beep(freq=440,t=0.04,vol=0.05){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + t);
  }catch(e){}
}

/* ---------- Derived stats + relic application ---------- */
function applyRelicEffects(){
  if(!state.player) return;
  // defaults reset
  state.spellDiscount = 0; state.goldMult = 1; state.dodge = 0; state.fireBonus = 0; state.lifeSteal = 0; state.nullChance = 0; state.aether = false; state.rewind = false;
  for(const r of state.relics || []){
    const found = RELIC_POOL.find(x=>x.id === r.id);
    if(found && typeof found.effectFn === 'function') found.effectFn(state);
  }
}
function derivePlayer(){
  if(!state.player) return;
  const p = state.player;
  p.maxHp = p.baseHp + (p.equip?.accessory?.hp || 0) + (p.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0);
  p.attack = p.baseAtk + (p.equip?.weapon?.atk || 0) + (p.equip?.accessory?.atk || 0);
  p.defense = p.baseDef + (p.equip?.armor?.def || 0);
  p.maxMp = Math.max(5, p.mag + 3);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
  applyRelicEffects();
}

/* ---------- Cinematic helper (returns Promise-like via setTimeout) ---------- */
function cineShow(text, ms=1200){
  const overlay = $('cineOverlay'); const t = $('cineText'); const b = $('cineBlood');
  if(!overlay || !t || !b){ log(text); return; }
  t.innerHTML = text;
  overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
  // animate by toggling classes and letting CSS handle the rest
  b.style.animation = 'bloodPulse 1.2s ease';
  t.style.animation = 'cineIn .9s ease forwards';
  // return a promise-like callback using setTimeout
  return new Promise(resolve => setTimeout(()=>{ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); resolve(); }, ms));
}

/* ---------- Save / Load ---------- */
function showSaveToast(){ const el = $('saveToast'); if(!el) return; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function fullSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); showSaveToast(); }catch(e){ console.warn('save fail',e); } }
function fullLoad(){ const s = localStorage.getItem(SAVE_KEY); if(!s) return false; try{ state = JSON.parse(s); if(state.seed) initSeed(state.seed); derivePlayer(); log('📂 Save loaded'); renderAll(); return true;}catch(e){ console.warn('load fail',e); return false; } }
function resetAll(){ if(!confirm('Reset your save and start fresh?')) return; localStorage.removeItem(SAVE_KEY); state = { seed: state.seed || null, runId: Date.now(), classKey:null, player:null, floorMap:{}, currentEnemy:null, inCombat:false, relics:[], ngPlus:false, endless:false, leaderboard: state.leaderboard || [] }; log('🔁 Save reset'); fullSave(); renderAll(); }

/* ---------- New Run ---------- */
function newRun(classKey, ngPlus=false, endless=false){
  if(!CLASSES[classKey]) { alert('Invalid class'); return; }
  const cls = CLASSES[classKey];
  const player = {
    name: classKey, classKey,
    baseHp: cls.baseHp + (ngPlus?2:0), hp: cls.baseHp + (ngPlus?2:0),
    baseAtk: cls.baseAtk + (ngPlus?1:0), baseDef: cls.baseDef, mag: cls.mag,
    mp: 10, xp:0, level:1,
    gold: 12 + (ngPlus?10:0), potions:1, ethers:1,
    equip:{weapon:null,armor:null,accessory:null},
    inventory: cls.starter? cls.starter() : [],
    spells: (cls.spells||[]).slice(),
    tempDef:0, status:[], floor:1
  };
  state.classKey = classKey; state.player = player; state.floorMap = {}; state.currentEnemy = null; state.inCombat = false; state.relics = ngPlus?state.relics||[]:[]; state.ngPlus = ngPlus; state.endless = endless;
  derivePlayer(); cineShow(`The run is bound by seed ${state.seed}...` , 900).then(()=>{ log(`🆕 New run: ${classKey} — seed ${state.seed}`); fullSave(); renderAll(); });
}

/* ---------- Floor generation (seeded) ---------- */
function genFloor(floorNum){
  if(state.floorMap['f'+floorNum]) return state.floorMap['f'+floorNum];
  const rooms = []; const total = 6 + Math.floor(Math.min(10,floorNum));
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
  if(!state.player){ alert('Start a run first'); return; }
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
  cineShow(`⬇️ You descend to Floor ${state.player.floor}...`, 900).then(()=>{ log(`⬇️ Floor ${state.player.floor}`); fullSave(); renderAll(); });
}

/* ---------- Monsters / Bosses ---------- */
function startMonster(){
  const floor = state.player.floor || 1;
  const names = ['Goblin','Skeleton','Bandit','Orc','Troll','Shadow Beast'];
  const name = rChoice(names);
  state.currentEnemy = { name, hp: 8 + floor*6, atk: 2 + Math.floor(floor*1.1), status:[], isBoss:false };
  state.inCombat = true; log(`⚔️ ${name} appears!`); fullSave(); renderAll();
}
function startBoss(){
  const floor = state.player.floor || 1;
  const boss = rChoice(BOSSES);
  // create deep clone for phases usage
  const phases = boss.phases.map(p=> Object.assign({},p));
  state.currentEnemy = { bossId: boss.id, name: boss.name, phases, phaseIndex:0, hp: phases[0].hp, atk: phases[0].atk, moves: phases[0].moves.slice(), isBoss:true, status:[], rewardRelicId: boss.rewardRelicId };
  state.inCombat = true;
  cineShow(`🔥 ${boss.name} appears — ${phases[0].text}`, 1200).then(()=>{ log(`🔥 Boss: ${boss.name} (Phase 1)`); fullSave(); renderAll(); });
}

/* ---------- Combat: player actions ---------- */
function playerAttack(){
  if(!state.inCombat || !state.currentEnemy) return;
  derivePlayer();
  const p = state.player; const atk = p.attack || 0;
  const r = rInt(1,6); const dmg = Math.max(1, r + atk - Math.floor((state.currentEnemy.atk||0)/3));
  // nullify chance relic
  if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic nullified your attack!'); }
  else {
    state.currentEnemy.hp = Math.max(0, (state.currentEnemy.hp||0) - dmg);
    log(`⚔️ You attack for ${dmg} damage.`);
    if(state.lifeSteal){ const heal = Math.max(1, Math.round(dmg * state.lifeSteal)); state.player.hp = Math.min(maxHpLocal(), state.player.hp + heal); log(`💉 Lifesteal: +${heal} HP.`); }
  }
  beep(420,0.05,0.04);
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

/* spells */
function showSpellMenu(){ $('spellMenu').classList.remove('hidden'); renderSpellButtons(); }
function hideSpellMenu(){ $('spellMenu').classList.add('hidden'); }
function castSpell(spell){
  if(!state.inCombat || !state.currentEnemy) return;
  const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3};
  const discount = state.spellDiscount || 0; const cost = Math.max(0, (costMap[spell]||0) - discount);
  if(state.player.mp < cost){ log('Not enough MP.'); return; }
  state.player.mp -= cost;
  if(spell === 'Firebolt'){ const dmg = 5 + state.player.floor; const bonus = state.fireBonus? Math.round(dmg*state.fireBonus):0; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - (dmg+bonus)); log(`🔥 Firebolt ${dmg + (bonus?(' +'+bonus):'')} dmg.`); }
  else if(spell === 'Ice Shard'){ const dmg = 3 + Math.floor(state.player.mag/4); state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - dmg); state.currentEnemy.atk = Math.max(1, state.currentEnemy.atk - 1); log(`❄️ Ice Shard ${dmg} dmg, -1 ATK.`); }
  else if(spell === 'Heal'){ const h = 5 + Math.floor(state.player.mag/3); state.player.hp = Math.min(maxHpLocal(), state.player.hp + h); log(`💚 Heal +${h} HP.`); }
  else if(spell === 'Lightning Strike'){ if(rnd() < 0.6){ const d = 8 + state.player.floor; state.currentEnemy.hp = Math.max(0, state.currentEnemy.hp - d); log(`⚡ Lightning hits ${d}!`); } else log('⚡ Lightning missed!'); }
  else if(spell === 'Shield'){ state.player.tempDef = (state.player.tempDef||0)+3; log('🛡️ Shield +3 DEF for next hit.'); }
  hideSpellMenu();
  if(state.currentEnemy.hp <= 0) return onVictory();
  enemyTurn(); fullSave(); renderAll();
}

/* items */
function useItemCombat(){
  const p = state.player;
  if(p.potions > 0){ p.potions--; const heal = rInt(6,12); p.hp = Math.min(maxHpLocal(), p.hp + heal); log(`🧴 Potion +${heal} HP.`); }
  else if(p.ethers > 0){ p.ethers--; const m = rInt(4,8); p.mp = Math.min(p.maxMp || 10, p.mp + m); log(`🔮 Ether +${m} MP.`); }
  else log('No items.');
  enemyTurn(); fullSave(); renderAll();
}
function attemptRun(){ if(!state.inCombat) return; if(rnd() < 0.5){ log('🏃 You escape.'); state.inCombat=false; state.currentEnemy=null; renderAll(); fullSave(); } else { log('✋ Escape failed.'); enemyTurn(); fullSave(); } }

/* enemy turn & statuses */
function tickStatus(entity){
  if(!entity || !entity.status) return;
  const remaining=[]; for(const s of entity.status){ if(s.k==='poison'){ entity.hp = Math.max(0, entity.hp - (s.p||1)); log(`${entity.name||'You'} suffers ${(s.p||1)} poison.`); } if(s.k === 'burn'){ entity.hp = Math.max(0, entity.hp - (s.p||2)); log(`${entity.name||'You'} burns for ${(s.p||2)}.`); } s.t = (s.t||1)-1; if(s.t>0) remaining.push(s); } entity.status = remaining;
}

function enemyTurn(){
  if(!state.currentEnemy) return;
  tickStatus(state.currentEnemy);
  if(state.currentEnemy.hp <= 0) return onVictory();
  const e = state.currentEnemy;
  // boss special moves for multi-phase
  if(e.isBoss && e.phases){
    // choose move from current moves
    const move = rChoice(e.moves || e.phases[e.phaseIndex].moves);
    // interpret moves simply
    if(move === 'Siphon'){ const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); e.hp = Math.max(0, e.hp + Math.min(6, Math.floor(dmg/2))); log(`🖤 ${e.name} uses Siphon — deals ${dmg} and heals.`); }
    else if(move === 'Dark Slash'){ const dmg = Math.max(1, e.atk + rInt(-1,1) - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`🔪 ${e.name} uses Dark Slash — ${dmg} dmg.`); }
    else if(move === 'Abyss Nova'){ const dmg = Math.max(2, e.atk + 4 - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`💥 ${e.name} unleashes Abyss Nova — ${dmg} dmg.`); }
    else if(move === 'Venom Spit'){ state.player.status = state.player.status || []; state.player.status.push({k:'poison',t:3,p:2}); log('🕷️ Venom Spit poisons you.'); }
    else if(move === 'Web Bind'){ state.player.tempDef = Math.max(0, (state.player.tempDef||0) - 1); log('🕸️ Web binds — your next defense reduced.'); }
    else if(move === 'Blood Lash'){ const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`🩸 Blood Lash — ${dmg} dmg.`); }
    else if(move === 'Obliterate'){ const dmg = Math.max(4, e.atk + 6 - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`☠️ Obliterate — ${dmg} dmg.`); }
    else { const dmg = Math.max(1, e.atk - (state.player.defense||0)); state.player.hp = Math.max(0, state.player.hp - dmg); log(`${e.name} attacks for ${dmg}.`); }
  } else {
    // regular enemy
    const dmg = Math.max(1, (state.currentEnemy.atk || 2) + rInt(-1,1) - (state.player.defense||0) - (state.player.tempDef||0));
    state.player.tempDef = 0;
    // relic null chance
    if(state.nullChance && rnd() < state.nullChance){ log('✖️ A relic blocked the enemy attack!'); }
    else { state.player.hp = Math.max(0, state.player.hp - dmg); log(`💥 ${state.currentEnemy.name} hits for ${dmg}.`); }
  }
  tickStatus(state.player);
  if(state.player.hp <= 0){ log('💀 You died. Run ends.'); onRunEnd(); }
  // after enemy hit, check boss phase transition
  if(state.currentEnemy && state.currentEnemy.isBoss) checkBossPhase();
}

/* ---------- Boss phase logic ---------- */
function checkBossPhase(){
  const e = state.currentEnemy;
  if(!e || !e.phases) return;
  const curPhase = e.phaseIndex;
  if(e.hp <= 0 && curPhase < e.phases.length - 1){
    // transition to next phase
    e.phaseIndex++;
    const np = e.phases[e.phaseIndex];
    e.hp = np.hp; e.atk = np.atk; e.moves = np.moves.slice();
    cineShow(`${e.name} collapses and reforms — ${np.text}`, 1200).then(()=>{ log(`⚠️ ${e.name} shifts to Phase ${e.phaseIndex+1}`); renderAll(); fullSave(); });
  }
}

/* ---------- Victory ---------- */
function onVictory(){
  const e = state.currentEnemy; const isBoss = !!e && !!e.isBoss;
  const extra = state.relics.some(r=>r.id==='crown' /* example */) ? 1 : 0;
  const goldGain = rInt(8,16) + (state.player.floor||1)*3 + extra + (isBoss?18:0);
  state.player.gold = (state.player.gold||0) + goldGain;
  log(`🏆 Defeated ${e.name}! +${goldGain} gold.`);
  if(isBoss){
    // award boss relic based on boss template
    const bossTemplate = BOSSES.find(b=>b.name === e.name || b.id === e.bossId);
    if(bossTemplate){
      const relicId = bossTemplate.rewardRelicId;
      const relic = RELIC_POOL.find(r=>r.id === relicId);
      if(relic){ state.relics.push({ id: relic.id, name: relic.name }); log(`🎁 Boss relic: ${relic.name}`); applyRelicEffects(); }
    }
    // grant a strong equipment drop
    const pool = equipmentPool(); const reward = rChoice(pool); state.player.inventory = state.player.inventory || []; state.player.inventory.push(reward); state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12);
    log(`🎁 Boss drop: ${reward.rarity} ${reward.baseName}`);
  } else {
    if(rnd() < 0.28){ state.player.potions = (state.player.potions||0)+1; log('🧴 Found a potion.'); }
    else if(rnd() < 0.2){ const pool = equipmentPool(); const it = rChoice(pool); state.player.inventory.push(it); log(`🎁 Drop: ${it.rarity} ${it.baseName}`); }
  }
  // xp & level
  const xpGain = 5 + (state.player.floor||1);
  state.player.xp = (state.player.xp||0) + xpGain; checkLevel();
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

/* ---------- Chest / Shop / Events (expanded) ---------- */
function openChest(){ if(!state.player) return; if(rnd() < 0.55){ const pool = equipmentPool(); const it = rChoice(pool); state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`🎁 Chest: Found ${it.rarity} ${it.baseName}`); } else { const g = rInt(6,26) + (state.player.floor||1)*2; state.player.gold = (state.player.gold||0)+g; log(`💰 Chest: +${g} gold.`); } fullSave(); renderAll(); }

let lastShop = [];
function openShop(){ if(state.inCombat){ log('Cannot shop during combat.'); return; } const pool = equipmentPool(); lastShop = []; for(let i=0;i<3;i++) lastShop.push(rChoice(pool)); lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8 }); lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6 });
  let html = `<div class="small">Merchant's Wares</div><div class="shop-list" style="margin-top:8px">`;
  lastShop.forEach((it,idx)=>{ html += `<div class="item-row"><div>${it.nameHtml || it.baseName}${it.rarity?` <span class="small muted">(${it.rarity})</span>`:''}</div><div><span class="small">${it.cost}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`; });
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html; log('🏪 Merchant appears.'); fullSave();
}
function buy(idx){ const it = lastShop[idx]; if(!it) return; if(!state.player){ log('Start a run first'); return; } if(state.player.gold < it.cost){ log('Not enough gold.'); return; } state.player.gold -= it.cost; if(it.type==='consumable'){ if(it.baseName==='Potion') state.player.potions=(state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers=(state.player.ethers||0)+1; log(`Bought ${it.baseName}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`Bought ${it.rarity||''} ${it.baseName}`); } fullSave(); renderAll(); }
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

/* Events: expanded pool */
const EVENTS = [
  { id:'whisper_door', text:'A door hums with whispers. Speak your name into it or remain silent?', choices:[
      { label:'Speak (gain XP, lose HP)', func: s=>{ s.player.xp=(s.player.xp||0)+5; s.player.hp = Math.max(1, s.player.hp - 5); log('The door answers — +5 XP, -5 HP.'); } },
      { label:'Silent (chance relic)', func: s=>{ if(rnd()<0.35){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); log(`The silence rewards you: relic ${r.name}`); } else log('Silence brings nothing.'); } }
  ]},
  { id:'cursed_fountain', text:'A cursed fountain bubbles. Drink to heal but risk a curse?', choices:[
      { label:'Drink', func: s=>{ if(rnd()<0.5){ s.player.hp = Math.min(maxHpLocal(), s.player.hp + 12); log('It heals you...'); } else { s.player.status = s.player.status||[]; s.player.status.push({k:'poison',t:3,p:2}); log('A curse! Poisoned.'); } } },
      { label:'Pass', func: s=>{ log('You pass the fountain.'); } }
  ]},
  { id:'wandering_merchant', text:'A hooded merchant offers a relic for gold (rare chance). Buy or bargain?', choices:[
      { label:'Buy (20g)', func: s=>{ if(s.player.gold < 20){ log('Not enough gold.'); return; } s.player.gold -= 20; if(rnd()<0.30){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); log(`They hand you ${r.name}.`); } else { const pool = equipmentPool(); s.player.inventory.push(rChoice(pool)); log('You bought a trinket (item).'); } } },
      { label:'Bargain (gain 6g)', func: s=>{ s.player.gold += 6; log('You haggle and gain 6 gold.'); } }
  ]},
  { id:'fallen_knight', text:'A fallen knight holds a broken blade — take it (rare weapon) or bury them?', choices:[
      { label:'Take (gain item, lose HP)', func: s=>{ const pool = equipmentPool(); const it = rChoice(pool); s.player.inventory.push(it); s.player.hp = Math.max(1, s.player.hp - 10); log(`You take ${it.rarity} ${it.baseName}, but lose 10 HP.`); } },
      { label:'Bury (gain honor)', func: s=>{ s.honor = (s.honor||0) + 1; log('You bury the knight. Honor increases.'); } }
  ]},
  { id:'sudden_trap', text:'A pressure tile clicks — try to disarm or dash through?', choices:[
      { label:'Disarm (skill check)', func: s=>{ if(rnd()<0.5){ log('You disarm it.'); } else { const d = rInt(4,10); s.player.hp = Math.max(0, s.player.hp - d); log(`Trap triggers — ${d} damage.`); } } },
      { label:'Dash', func: s=>{ if(rnd()<0.6){ log('You dash through untouched.'); } else { const d = rInt(6,12); s.player.hp = Math.max(0, s.player.hp - d); log(`You stumble — ${d} damage.`); } } }
  ]},
  { id:'blood_altar', text:'A blood altar offers power for a price — sacrifice HP for gold?', choices:[
      { label:'Offer 8 HP (gain 20g)', func: s=>{ if(s.player.hp > 8){ s.player.hp -= 8; s.player.gold += 20; log('The altar feeds — +20g, -8 HP.'); } else log('Too weak to sacrifice.'); } },
      { label:'Refuse', func: s=>{ log('You refuse the altar.'); } }
  ]},
  { id:'obsidian_mirror', text:'An obsidian mirror shows a possible future — view it (gain intel) or not?', choices:[
      { label:'View (gain next-room hint)', func: s=>{ const floor = s.player.floor || 1; const f = genFloor(floor); const next = f.rooms[f.pointer] || {type:'none'}; s.nextHint = next.type; log(`The mirror shows a glimmer: next room may be ${next.type}.`); } },
      { label:'Avoid', func: s=>{ log('You avert your gaze.'); } }
  ]},
  { id:'bloodied_banner', text:'A tattered banner flutters — claim it (temporary buff) or leave?', choices:[
      { label:'Claim', func: s=>{ s.tempBanner = (s.tempBanner||0)+1; log('You claim the banner — minor morale buff.'); } },
      { label:'Leave', func: s=>{ log('You leave the banner.'); } }
  ]},
  { id:'wandering_song', text:'A haunting song passes — listen (gain MP) or cover ears?', choices:[
      { label:'Listen', func: s=>{ s.player.mp = Math.min(s.player.maxMp || 10, s.player.mp + rInt(3,6)); log('The song restores some MP.'); } },
      { label:'Cover', func: s=>{ log('You keep your focus.'); } }
  ]},
  { id:'mire_path', text:'A misty path splits — choose the narrow or wide way?', choices:[
      { label:'Narrow (more treasures, more risk)', func: s=>{ if(rnd()<0.5){ const pool = equipmentPool(); s.player.inventory.push(rChoice(pool)); log('Treasure found in the narrow way.'); } else { s.player.hp = Math.max(0, s.player.hp - rInt(4,10)); log('A hidden spike cuts you.'); } } },
      { label:'Wide (safer)', func: s=>{ if(rnd()<0.7) { s.player.gold += rInt(6,14); log('You find coins on the wide path.'); } else log('The wide path yields nothing.'); } }
  ]},
  { id:'ancient_scroll', text:'A damp scroll contains a ritual — learn spell (chance) or trade for gold?', choices:[
      { label:'Study', func: s=>{ if(rnd()<0.35){ s.player.spells = s.player.spells || []; s.player.spells.push('Arcane Burst'); log('You learn Arcane Burst!'); } else log('The text is faded — nothing learned.'); } },
      { label:'Sell', func: s=>{ s.player.gold += 18; log('You sell the scroll for 18g.'); } }
  ]},
  { id:'tomb_whisper', text:'A voice from a tomb offers a relic in exchange for a favor — agree or refuse?', choices:[
      { label:'Agree (chance at rare relic)', func: s=>{ if(rnd()<0.25){ const r = rChoice(RELIC_POOL); s.relics.push({id:r.id,name:r.name}); applyRelicEffects(); log(`The tomb grants relic: ${r.name}`); } else { s.player.hp = Math.max(0,s.player.hp - rInt(6,12)); log('The bargain drains you.'); } } },
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
function equipItem(idx){ const it = state.player.inventory[idx]; if(!it) return; if(!['weapon','armor','accessory'].includes(it.type)){ log('Not equippable.'); return; } const slot = it.type; if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName}`); } state.player.equip[slot]=it; state.player.inventory.splice(idx,1); log(`🛡️ Equipped ${it.rarity} ${it.baseName}`); derivePlayer(); fullSave(); renderAll(); }
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity} ${it.baseName}\nATK:${it.atk}\nDEF:${it.def}\nHP:${it.hp}\nValue:${it.cost}g`); }

/* ---------- Helpers ---------- */
function totalDefLocal(){ return (state.player.baseDef || 0) + (state.player.equip?.armor?.def || 0); }
function maxHpLocal(){ return (state.player.baseHp || 0) + (state.player.equip?.accessory?.hp || 0) + (state.player.equip?.armor?.hp || 0) + (state.baseHpBonus || 0 || 0); }

/* ---------- Export / Leaderboard ---------- */
function exportLog(){ const txt = $('log').innerText; const blob = new Blob([txt],{type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`dim_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); }
function showLeaderboard(){ const lb = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]'); if(lb.length===0){ alert('No runs recorded.'); return; } lb.sort((a,b)=> b.floor - a.floor); let txt = 'Local Leaderboard\n'; lb.slice(0,10).forEach((e,i)=> txt += `${i+1}. Floor ${e.floor} • Gold ${e.gold} • Class ${e.class}\n`); alert(txt); }

/* ---------- Spell UI ---------- */
function renderSpellButtons(){ const container = $('spellRow'); if(!container) return; container.innerHTML = ''; if(!state.player) return; const spells = state.player.spells || []; const costMap = {'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3}; spells.forEach(s=>{ const b = document.createElement('button'); b.className='secondary'; const cost = Math.max(0,(costMap[s]||0)-(state.spellDiscount||0)); b.textContent = `${s} (${cost})`; b.onclick = ()=>{ castSpell(s); $('spellMenu').classList.add('hidden'); }; container.appendChild(b); }); }

/* ---------- Render ---------- */
function renderRelicsUI(){
  const el = $('relicRow'); if(!el) return; el.innerHTML = ''; if(!state.relics || state.relics.length===0){ el.innerText = 'Relics: —'; return; }
  for(const r of state.relics){ const pill = document.createElement('div'); pill.className='relic-pill'; pill.innerText = (r.name||r.id); el.appendChild(pill); }
}
function renderAll(){
  if(state.player){
    $('playerName').innerText = state.player.name || '—';
    $('playerClass').innerText = state.classKey || '—';
    $('hp').innerText = Math.max(0, state.player.hp || 0);
    $('maxhp').innerText = maxHpLocal();
    $('mp').innerText = state.player.mp || 0;
    $('maxmp').innerText = state.player.maxMp || 10;
    derivePlayer();
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
  renderSpellButtons(); renderRelicsUI(); fullSave();
}

/* ---------- UI bindings ---------- */
function wireUI(){
  $('btnNew').addEventListener('click', ()=>{ const cls = prompt('New run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls || !CLASSES[cls]){ alert('Invalid class'); return; } newRun(cls,false,false); });
  $('btnReset').addEventListener('click', resetAll);
  $('btnEnterRoom').addEventListener('click', enterRoom);
  $('btnShop').addEventListener('click', openShop);
  $('btnRest').addEventListener('click', ()=>{ if(!state.player){ alert('Start a run first'); return; } if(state.player.gold < 5){ log('Not enough gold to rest.'); return; } state.player.gold -= 5; state.player.hp = Math.min(maxHpLocal(), state.player.hp + 12); state.player.mp = Math.min(state.player.maxMp || 10, state.player.mp + 6); log('You rest at camp (5g) — HP & MP recovered.'); renderAll(); fullSave(); });
  $('btnInventory').addEventListener('click', openInventory);
  $('btnCodex').addEventListener('click', ()=> alert('Codex coming soon — collect lore while exploring.'));
  $('btnLeaderboard').addEventListener('click', showLeaderboard);
  $('btnExport').addEventListener('click', exportLog);
  $('btnAttack').addEventListener('click', playerAttack);
  $('btnSpell').addEventListener('click', ()=>{ $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
  $('btnItem').addEventListener('click', useItemCombat);
  $('btnRun').addEventListener('click', ()=>{ if(confirm('Attempt to flee?')) attemptRun(); });
  $('btnSpellBack').addEventListener('click', ()=> $('spellMenu').classList.add('hidden'));
}

/* ---------- Boot: gameInit called by index.html after seed chosen ---------- */
function gameInit(seedString){
  state.seed = seedString || String(Date.now());
  initSeed(state.seed);
  if(fullLoad()){
    // loaded existing save; ensure seed matches or keep loaded seed
    if(state.seed !== window.CURRENT_SEED){ initSeed(state.seed); }
    log('Loaded save on boot.');
  } else {
    log('No save found — create a New Run (top-left). Seed: ' + state.seed);
    fullSave();
  }
  wireUI(); renderAll();
}

/* expose */
window.gameInit = gameInit;

/* if index.html set INIT_SEED earlier */
if(window.INIT_SEED) gameInit(window.INIT_SEED);
