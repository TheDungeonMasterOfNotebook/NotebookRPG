/* Phase 10 — Full Merge
   Epic Text RPG — The Descent Within
   Text-only, seeded RNG, autosave, rarity, trait prefixes/suffixes,
   dungeon node maps, legacy meta progression, class mastery, sanity/dreams.
*/

/* ---------- tiny helpers ---------- */
const $ = id => document.getElementById(id);
const now = () => (new Date()).toLocaleTimeString();
function log(msg){ const l = $('log'); if(l) l.innerHTML = `<div>[${now()}] ${msg}</div>` + l.innerHTML; }

/* ---------- RNG & Seed ---------- */
let RNG_STATE = null;
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function initSeed(seed){
  let s=0; for(let i=0;i<seed.length;i++) s=(s*131 + seed.charCodeAt(i))>>>0;
  if(s===0) s = Date.now() & 0xffffffff;
  RNG_STATE = mulberry32(s);
  window.CURRENT_SEED = seed;
}
function rnd(){ return RNG_STATE ? RNG_STATE() : Math.random(); }
function rInt(a,b){ return Math.floor(rnd()*(b-a+1))+a; }
function rChoice(arr){ return arr[Math.floor(rnd()*arr.length)]; }

/* ---------- persistence keys ---------- */
const SAVE_KEY = 'epictextrpg_v10_save';
const META_KEY = 'epictextrpg_v10_meta';
const LEADER_KEY = 'epictextrpg_v10_leader';

/* ---------- rarity tiers ---------- */
const RARITY_TIERS = [
  { id:'Common', name:'Common', color:'#bdbdbd', chance:50, mul:1.0, tag:'[C]' },
  { id:'Uncommon', name:'Uncommon', color:'#3fa34d', chance:25, mul:1.2, tag:'[UC]' },
  { id:'Rare', name:'Rare', color:'#2979ff', chance:15, mul:1.4, tag:'[R]' },
  { id:'Epic', name:'Epic', color:'#a020f0', chance:7, mul:1.7, tag:'[E]' },
  { id:'Legendary', name:'Legendary', color:'#ffd700', chance:2, mul:2.2, tag:'[L]' },
  { id:'Mythic', name:'Mythic', color:'#ff4040', chance:1, mul:2.8, tag:'[M]' }
];
function rollRarityBias(bias=0){
  const pool = RARITY_TIERS.map(r=>({ ...r, weight: Math.max(1, r.chance + (r.chance>=15? bias : Math.floor(bias/2)) ) }));
  const total = pool.reduce((s,p)=>s+p.weight,0); let roll = rnd()*total;
  for(const p of pool){ if(roll <= p.weight) return p; roll -= p.weight; }
  return pool[0];
}

/* ---------- class data & skill trees ---------- */
const CLASS_DATA = {
  Warrior: { name:'Warrior', passive:'+10% damage', ability:{id:'Power Slash',desc:'Deal 150% damage'}, skills:[
    {level:2,choices:[{id:'hp+6',label:'+6 HP'},{id:'atk+2',label:'+2 ATK'}]},
    {level:4,choices:[{id:'shield_bash',label:'Shield Bash (stun)'},{id:'crit+5',label:'+5% Crit'}]}
  ], mastery:{Shield:['Shield Wall','Fortify'],Sword:['Berserk','Precision']}},
  Mage: { name:'Mage', passive:'+2 MP / turn', ability:{id:'Fireball',desc:'Deal heavy fire'}, skills:[
    {level:2,choices:[{id:'mp+6',label:'+6 MP'},{id:'mag+2',label:'+2 MAG'}]},
    {level:4,choices:[{id:'arcane_surge',label:'Arcane Surge (+20% magic dmg)'},{id:'freeze_master',label:'Frost Bolt (freeze)'}]}
  ], mastery:{Fire:['Flameheart','Combustion'],Frost:['Iceshroud','Glacier']}},
  Rogue: { name:'Rogue', passive:'+10% crit', ability:{id:'Backstab',desc:'Double damage if first strike'}, skills:[
    {level:2,choices:[{id:'crit+5',label:'+5% Crit'},{id:'atk+2',label:'+2 ATK'}]},
    {level:4,choices:[{id:'evasion+6',label:'+6% Evasion'},{id:'poison_edge',label:'Poison on hit'}]}
  ], mastery:{Shadow:['Evasion','Cloak'],Poison:['Toxicology','Bleedmaster']}}
};

/* ---------- prefixes & suffixes (traits) ---------- */
const PREFIXES = [
  {id:'blazing',label:'Blazing',effect:{fireDmg:1},rarityBias:1},
  {id:'vorpal',label:'Vorpal',effect:{crit:6},rarityBias:2},
  {id:'ancient',label:'Ancient',effect:{atk:2,def:1},rarityBias:3},
  {id:'vampiric',label:'Vampiric',effect:{lifesteal:5},rarityBias:3},
  {id:'void',label:'Void',effect:{voidDmg:3},rarityBias:4}
];
const SUFFIXES = [
  {id:'of_fury',label:'of Fury',effect:{atk:2}},
  {id:'of_stability',label:'of Stability',effect:{def:2}},
  {id:'of_the_night',label:'of the Night',effect:{crit:4}},
  {id:'of_whispers',label:'of Whispers',effect:{xpBoost:5}},
  {id:'of_ages',label:'of Ages',effect:{hp:8}}
];

/* ---------- item pools ---------- */
const WEAPONS = {
  Common:[{name:'Short Sword',effect:{atk:1}}],Uncommon:[{name:'Iron Sword',effect:{atk:2}}],Rare:[{name:"Knight's Blade",effect:{atk:4}}],Epic:[{name:'Bloodfang',effect:{atk:5,lifesteal:true}}],Legendary:[{name:'Shadow Reaver',effect:{atk:8,doubleStrike:25}}],Mythic:[{name:'Abyssal Edge',effect:{atk:12,voidDmg:6}}]
};
const ARMOR = {
  Common:[{name:'Leather Tunic',effect:{def:1}}],Uncommon:[{name:'Chainmail',effect:{def:2}}],Rare:[{name:'Plate Mail',effect:{def:4}}],Epic:[{name:'Wraith Armor',effect:{def:5,poisonImmune:true}}],Legendary:[{name:'Armor of the Fallen King',effect:{def:7,atk:3}}],Mythic:[{name:'Celestial Carapace',effect:{def:10,reflect:6}}]
};
const RELICS = {
  Common:[{name:'Old Coin',effect:{gold:5}}],Uncommon:[{name:'Soul Charm',effect:{xpBoost:10}}],Rare:[{name:'Heart of Cinders',effect:{postHeal:5}}],Epic:[{name:'Infernal Sigil',effect:{spellBoost:25}}],Legendary:[{name:'Tome of the Void',effect:{unlockSpell:'Voidstrike'}}],Mythic:[{name:'Worldseed',effect:{mythicRipple:true}}]
};

/* ---------- monsters & bosses ---------- */
const MONSTERS = {
  Common:[ {name:'Ratling',hp:10,atk:3,def:1,xp:5,gold:3,flavor:'A small, quick vermin.'}, {name:'Slime',hp:8,atk:2,def:0,xp:4,gold:2,flavor:'A gelatinous ignoramus.'} ],
  Uncommon:[ {name:'Shadow Wolf',hp:18,atk:6,def:2,xp:14,gold:10,flavor:'Silent predator.'} ],
  Rare:[ {name:'Grave Knight',hp:35,atk:10,def:4,xp:28,gold:20,flavor:'A blade-bound revenant.'} ],
  Epic:[ {name:'Vampire Lord',hp:60,atk:15,def:5,xp:60,gold:45,flavor:'Hunger in a crown.'} ],
  Legendary:[ {name:'The Hollow King',hp:150,atk:20,def:8,xp:250,gold:120,flavor:'Throne of bones.'} ],
  Mythic:[ {name:'World Serpent',hp:500,atk:45,def:18,xp:1000,gold:500,flavor:'Terrible, vast, eternal.'} ]
};

const BOSSES = [
  { id:'hollowking', name:'The Hollow King', hp:150, phases:[
      {hpPct:0.75, action:'Summon Shades'}, {hpPct:0.45, action:'Dark Nova'}, {hpPct:0.18, action:'Enrage'}
    ], drops:['Crown of Eternity','Tome of the Void'] },
  { id:'eclipsedragon', name:'Eclipse Dragon', hp:200, phases:[
      {hpPct:0.75,action:'Shadow Breath'}, {hpPct:0.35,action:'Wings of Night'}
    ], drops:['Dragon Heart','Shadow Reaver'] }
];

/* ---------- statuses ---------- */
const STATUS = {
  burn: { id:'burn', name:'Burn', tick:2, desc:'Takes burn damage per turn' },
  poison: { id:'poison', name:'Poison', tick:3, desc:'Takes poison damage per turn' },
  freeze: { id:'freeze', name:'Freeze', skip:true, desc:'Skip next turn' },
  weaken: { id:'weaken', name:'Weaken', mul:0.75, desc:'Reduced attack' }
};

/* ---------- DREAMS ---------- */
const DREAMS = [
  { id:'memory_child', title:'A Childhood Memory', text:`You stand at a soot-smudged window.\nA small hand knocks — it is yours.\nDo you reach?`, choices:[
      {label:'Reach', san:5, reward: s=>{ addJournal('You touched the memory and felt warmth.'); s.player.gold=(s.player.gold||0)+8; log('Dream: +8 gold'); }},
      {label:'Pull away', san:-6, reward: s=>{ addJournal('You recoiled; the image shattered.'); applyStatus(s.player,'poison',2); log('Dream: lingering pain'); }}
    ]},
  { id:'ruined_throne', title:'The Throne Dream', text:`A throne of bone and moss whispers your name.\nIt offers power in exchange for sight.`, choices:[
      {label:'Take the offer', san:-10, reward: s=>{ s.meta.fragments=(s.meta.fragments||0)+2; addJournal('You accepted a bargain in a dream — +2 fragments.'); log('Dream bargain: +2 fragments'); }},
      {label:'Refuse', san:6, reward: s=>{ addJournal('You refused the hollow seat; clarity returns.'); log('Refusal steadies you'); }}
    ]},
  { id:'echo_valley', title:'Echo Valley', text:`Voices echo — some familiar, some not.\nYou hear a phrase: "Remember the blade."`, choices:[
      {label:'Remember', san:-4, reward: s=>{ s.player.potions=(s.player.potions||0)+1; addJournal('A memory yields a potion.'); log('Dream: found a potion'); }},
      {label:'Forget', san:3, reward: s=>{ addJournal('You let it pass; the echo fades.'); log('You cleared your mind'); }}
    ]}
];

/* ---------- state ---------- */
let state = {
  seed:null, runId:Date.now(), player:null, floorMap:{}, currentEnemy:null, inCombat:false,
  relics:[], legacyRelics:[], journal:[], meta:{fragments:0,upgrades:[],legacyPts:0,unlockedClasses:[]}, achievements:{}, stats:{kills:0,relics:0,bosses:0,floors:0}, shop:{tier:1}
};
/* sanity defaults (0..100) */
state.sanity = state.sanity ?? 100;
state.sanityDecay = 3;
state.sanityRecoverRest = 10;
state.sanityThresholds = { stable:70, uneasy:40, fragile:15 };

/* ---------- save/load ---------- */
function showSaveToast(){ const el=$('saveToast'); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function fullSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); localStorage.setItem(META_KEY, JSON.stringify(state.meta)); showSaveToast(); }catch(e){ console.warn('save failed',e); } }
function fullLoad(){ const s = localStorage.getItem(SAVE_KEY); if(!s) return false; try{ state = JSON.parse(s); state.meta = JSON.parse(localStorage.getItem(META_KEY)||'{}')||state.meta; if(state.seed) initSeed(state.seed); derivePlayer(); renderAll(); log('📂 Save loaded'); return true; }catch(e){ console.warn('load fail', e); return false; } }
function resetAll(){ if(!confirm('Reset all saves and meta?')) return; localStorage.removeItem(SAVE_KEY); localStorage.removeItem(META_KEY); state={seed:null,runId:Date.now(),player:null,floorMap:{},currentEnemy:null,inCombat:false,relics:[],legacyRelics:[],journal:[],meta:{fragments:0,upgrades:[],legacyPts:0,unlockedClasses:[]},achievements:{},stats:{kills:0,relics:0,bosses:0,floors:0},shop:{tier:1}}; state.sanity=100; fullSave(); renderAll(); log('🔁 Reset done'); }

/* ---------- derived player ---------- */
function applyRelicEffects(){ state.goldMult=1; state.xpMult=1; state.spellBoost=0; for(const r of state.relics.concat(state.legacyRelics||[])){ if(r.name==='Old Coin') state.goldMult+=0.10; if(r.name==='Soul Charm') state.xpMult+=0.10; if(r.name==='Infernal Sigil') state.spellBoost+=0.25; if(r.name==='Worldseed') state.meta.upgrades.push('worldseed'); } }
function derivePlayer(){
  if(!state.player) return;
  applyRelicEffects();
  const p=state.player;
  p.maxHp = (p.baseHp || 0) + (p.equip?.weapon?.effect?.hp||0) + (p.equip?.armor?.effect?.hp||0) + (state.meta?.upgrades?.includes('hp_boost')?5:0);
  p.attack = (p.baseAtk || 0) + (p.equip?.weapon?.effect?.atk||0) + (p.attackBonus||0);
  p.defense = (p.baseDef || 0) + (p.equip?.armor?.effect?.def||0);
  p.maxMp = Math.max(5, (p.mag || 0) + 3);
  if(typeof p.hp === 'undefined' || p.hp === null) p.hp = p.maxHp;
  if(typeof p.mp === 'undefined' || p.mp === null) p.mp = p.maxMp;
  if(p.hp>p.maxHp) p.hp=p.maxHp;
  if(p.mp>p.maxMp) p.mp=p.maxMp;
}

/* ---------- naming & trait generation ---------- */
function rollPrefix(chanceBias=0){ if(rnd() < 0.35 + chanceBias*0.05) return rChoice(PREFIXES); return null; }
function rollSuffix(chanceBias=0){ if(rnd() < 0.35 + chanceBias*0.05) return rChoice(SUFFIXES); return null; }
function makeNamedItem(base, rarity){
  const bias = (RARITY_TIERS.findIndex(r=>r.id===rarity) || 0);
  const pre = rollPrefix(bias);
  const suf = rollSuffix(bias);
  const nameParts = [];
  if(pre) nameParts.push(pre.label);
  nameParts.push(base.name);
  if(suf) nameParts.push(suf.label);
  const finalName = nameParts.join(' ');
  const effect = Object.assign({}, base.effect || {});
  if(pre) Object.assign(effect, pre.effect);
  if(suf) Object.assign(effect, suf.effect);
  return { baseName: base.name, name: finalName, rarity, color: RARITY_TIERS.find(r=>r.id===rarity).color, effect, prefix:pre?.id||null, suffix:suf?.id||null };
}

/* ---------- new run ---------- */
function generateDailySeedForDate(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}${m}${day}`; }
window.generateDailySeed = ()=> generateDailySeedForDate(new Date());

function newRun(classKey, seed, daily=false){
  state.seed = seed || String(Date.now());
  initSeed(state.seed);
  const starterInv = [{ id:'starter_potion', name:'Potion', type:'consumable' }];
  const p = {
    name: classKey,
    classKey,
    baseHp: classKey==='Warrior'?30: classKey==='Mage'?20:24,
    baseAtk: classKey==='Warrior'?7: classKey==='Mage'?3:5,
    baseDef: classKey==='Warrior'?2:1,
    mag: classKey==='Mage'?8:4,
    hp:null, mp:null, xp:0, level:1, gold:25, potions:1, ethers:1,
    equip:{weapon:null,armor:null,accessory:null},
    inventory: starterInv, spells: classKey==='Mage'?['Firebolt','Ice Shard','Heal'] : (classKey==='Rogue'?['Ice Shard','Firebolt']:['Shield']),
    skills:[], tempDef:0, status:[], floor:1, daily:!!daily, trophies:[], attackBonus:0
  };
  state.player = p;
  derivePlayer();
  state.player.hp = state.player.maxHp;
  state.player.mp = state.player.maxMp;
  state.relics=[]; state.currentEnemy=null; state.inCombat=false; state.floorMap={};
  state.sanity = 100;
  if(!daily) cineShow(`Seed ${state.seed} — The descent begins...`,900).then(()=>{ log('New Run: '+classKey); fullSave(); renderAll(); });
  if(daily) { log('Daily run started'); fullSave(); renderAll(); }
}

/* ---------- floor/node generation ---------- */
function genFloor(n){
  if(state.floorMap['f'+n]) return state.floorMap['f'+n];
  // create branching nodes list (array of node objects). Each node: {type,desc}
  const nodes=[];
  const total = 4 + Math.min(8, n);
  for(let i=0;i<total;i++){
    const r=rnd();
    if(r<0.45) nodes.push({type:'monster'});
    else if(r<0.65) nodes.push({type:'treasure'});
    else if(r<0.80) nodes.push({type:'event'});
    else if(r<0.92) nodes.push({type:'shop'});
    else nodes.push({type:'rest'});
  }
  nodes.push({type:'stairs'});
  if(n%3===0) nodes.push({type:'boss'});
  // pointer selects next available node index; we present choices (2) to player each time
  state.floorMap['f'+n] = { nodes, pointer:0 };
  return state.floorMap['f'+n];
}

/* ---------- enter a node (player chooses from map) ---------- */
function enterRoom(){
  if(!state.player){ alert('Start a run first'); return; }
  if(state.inCombat){ log('Finish combat first.'); return; }
  const floor = state.player.floor||1;
  const fobj = genFloor(floor);
  if(fobj.pointer >= fobj.nodes.length){
    descendFloor(); fullSave(); return;
  }
  // present options: show up to 2 next nodes to choose
  const options = [];
  for(let i=fobj.pointer;i<Math.min(fobj.pointer+2,fobj.nodes.length);i++) options.push({idx:i, node:fobj.nodes[i]});
  // build choices UI
  let html = `<div class="small">Choose your path (Floor ${floor})</div><div style="margin-top:8px">`;
  options.forEach(o=> html += `<div class="item-row"><div><strong>${o.node.type.toUpperCase()}</strong> <div class="small muted">${nodeFlavor(o.node.type)}</div></div><div><button class="secondary" onclick="chooseNode(${o.idx})">Enter</button></div></div>`);
  html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`;
  $('shopPanel').innerHTML = html;
  window.chooseNode = function(idx){
    fobj.pointer = idx+1; // move pointer past chosen
    const room = fobj.nodes[idx];
    log(`➡ You traverse: ${room.type}`);
    if(room.type==='monster') startMonster();
    else if(room.type==='treasure') openChest();
    else if(room.type==='shop') openShop();
    else if(room.type==='rest') useFountain();
    else if(room.type==='event') runEvent();
    else if(room.type==='boss') startBoss();
    renderAll(); fullSave();
  };
}

/* small descriptive text for node types */
function nodeFlavor(t){
  if(t==='monster') return 'Danger: foes await';
  if(t==='treasure') return 'Glimmering chest';
  if(t==='shop') return 'A peddler waits';
  if(t==='rest') return 'A quiet pool';
  if(t==='event') return 'A choice, unknown cost';
  if(t==='boss') return 'A challenge looms';
  return '';
}

/* ---------- descend ---------- */
function descendFloor(){
  if(!state.player) return;
  state.player.floor = (state.player.floor||1)+1;
  derivePlayer();
  state.player.hp = Math.min(state.player.maxHp, (state.player.hp||0) + 10);
  state.player.mp = Math.min(state.player.maxMp, (state.player.mp||0) + 6);
  state.stats.floors = Math.max(state.stats.floors, state.player.floor);
  cineShow(`⬇️ Descend to Floor ${state.player.floor}...`,900).then(()=>{
    log('Descended to floor '+state.player.floor);
    // sanity strain on descent
    applySanityChange(-Math.floor(state.sanityDecay/2), 'Descent strain');
    if(state.player.floor % 3 === 0) enterTown();
    maybeTriggerDreamAfterFloor();
    fullSave(); renderAll();
  });
}

/* ---------- monster generation & combat ---------- */
function getAdjustedWeights(floor){
  const w={Common:60,Uncommon:25,Rare:10,Epic:4,Legendary:1,Mythic:0};
  if(floor>4){ w.Rare+=5; w.Uncommon-=3; }
  if(floor>8){ w.Epic+=3; w.Rare+=3; w.Common-=5;}
  if(floor>14){ w.Legendary+=1; w.Epic+=2; w.Common-=4;}
  Object.keys(w).forEach(k=>{ if(w[k]<1) w[k]=1; });
  return w;
}
function weightedChoiceObj(weights){
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  let roll = rnd()*total;
  for(const k of Object.keys(weights)){ if(roll <= weights[k]) return k; roll -= weights[k]; }
  return Object.keys(weights)[0];
}
function getRandomMonsterForFloor(floor){
  const weights=getAdjustedWeights(floor);
  const rarityKey = weightedChoiceObj(weights);
  const tier = RARITY_TIERS.find(t=>t.id===rarityKey) || RARITY_TIERS[0];
  const pool = MONSTERS[rarityKey] || MONSTERS.Common;
  const base = rChoice(pool);
  const mult = tier.mul;
  const hp = Math.max(1, Math.round(base.hp * mult + floor*2));
  const atk = Math.max(1, Math.round(base.atk * mult + Math.floor(floor/3)));
  const def = Math.max(0, Math.round((base.def||0) * mult + Math.floor(floor/6)));
  const xp = Math.max(1, Math.round(base.xp * mult));
  const gold = Math.max(0, Math.round(base.gold * mult));
  const patterns = ['Aggressive','Defensive','Trickster'];
  const pattern = rChoice(patterns);
  const name = `${tier.tag} ${base.name}`;
  return { name, baseName:base.name, rarity:tier.id, color:tier.color, hp, currentHp:hp, atk, def, xp, gold, flavor:base.flavor, pattern };
}

function startMonster(){ const floor=state.player.floor||1; const enemy = getRandomMonsterForFloor(floor); state.currentEnemy = {...enemy, status:[], isBoss:false}; state.inCombat=true; generateEnemyIntent(); log(`⚔️ ${enemy.rarity} ${enemy.baseName} appears! ${enemy.flavor || ''}`); fullSave(); renderAll(); }
function startBoss(){ const floor=state.player.floor||1; const tpl = rChoice(BOSSES); const boss = JSON.parse(JSON.stringify(tpl)); boss.currentHp = boss.hp + floor*6; boss.status=[]; boss.isBoss=true; boss.name = `${boss.name}`; state.currentEnemy = boss; state.inCombat=true; cineShow(`🔥 Boss: ${boss.name} emerges!`,1200).then(()=>{ log('Boss: '+boss.name); generateEnemyIntent(); fullSave(); renderAll(); }); }

/* ---------- intents ---------- */
function generateEnemyIntent(){
  if(!state.currentEnemy) return;
  const e = state.currentEnemy;
  let intent = { type:'Attack', val: Math.max(1, e.atk + rInt(-1,2)) };
  if(e.pattern === 'Aggressive' && rnd()>0.6) intent = {type:'Smash', val: Math.max(1, e.atk + 3 + rInt(0,3))};
  if(e.pattern === 'Defensive' && rnd()>0.5) intent = {type:'Guard', val: 0};
  if(e.pattern === 'Trickster' && rnd()>0.5){ const t = ['Poison','Burn','Weaken']; intent = { type: rChoice(t), val: 2 }; }
  e._intent = intent;
  if($('enemyIntent')) $('enemyIntent').innerText = `Intent: ${intent.type}${intent.val?(' ('+intent.val+')'):''}`;
}

/* ---------- combat actions ---------- */
function playerAttack(){ if(!state.inCombat || !state.currentEnemy) return; derivePlayer(); const p=state.player; const atk = p.attack || 0; const roll = rInt(1,6); const dmg = Math.max(1, roll + atk - Math.floor((state.currentEnemy.def||0)/2)); state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - dmg); showFloating(`-${dmg}`,'hit'); log(`⚔️ You strike for ${dmg}`); if(state.player.poisonOnHit && rnd()<0.25) applyStatus(state.currentEnemy,'poison',3); if(state.currentEnemy.currentHp<=0) return onVictory(); doEnemyIntent(); fullSave(); renderAll(); }

function useSkill(skillId){ if(!state.inCombat || !state.currentEnemy) return; const p=state.player; if(skillId==='Power Slash'){ const dmg=Math.max(1, Math.round(p.attack*1.5)); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); log(`Power Slash deals ${dmg}`); showFloating(`-${dmg}`,'hit'); } else if(skillId==='Backstab'){ const dmg=Math.max(1,p.attack*2); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); log(`Backstab deals ${dmg}`); showFloating(`-${dmg}`,'hit'); } else if(skillId==='Shield Bash'){ const dmg=Math.max(1, p.attack - 1); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); applyStatus(state.currentEnemy,'weaken',2); log(`Shield Bash deals ${dmg} and weakens`); showFloating(`-${dmg}`,'hit'); } hideSkillMenu(); if(state.currentEnemy.currentHp<=0) return onVictory(); doEnemyIntent(); fullSave(); renderAll(); }

function castSpell(spell){ if(!state.inCombat || !state.currentEnemy) return; const costMap={'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Voidstrike':7}; const cost = costMap[spell]||3; if(state.player.mp < cost){ log('Not enough MP'); return; } state.player.mp -= cost; if(spell==='Firebolt'){ const d=5 + state.player.floor; state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - d); log(`🔥 Firebolt ${d}`); showFloating(`-${d}`,'hit'); } else if(spell==='Ice Shard'){ const d=4 + Math.floor(state.player.mag/3); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-d); if(rnd()<0.25) applyStatus(state.currentEnemy,'freeze',1); log(`❄️ Ice ${d}`); showFloating(`-${d}`,'hit'); } else if(spell==='Heal'){ const h=6 + Math.floor(state.player.mag/3); state.player.hp=Math.min(state.player.maxHp, state.player.hp + h); log(`💚 Healed ${h}`); showFloating(`+${h}`,'heal'); } else if(spell==='Voidstrike'){ const d=12 + Math.floor(state.player.mag/2); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-d); log(`Voidstrike ${d}`); showFloating(`-${d}`,'hit'); } hideSpellMenu(); if(state.currentEnemy.currentHp<=0) return onVictory(); doEnemyIntent(); fullSave(); renderAll(); }

function useItemCombat(){ const p=state.player; if(p.potions>0){ p.potions--; const heal=rInt(6,12); p.hp=Math.min(p.maxHp,p.hp+heal); log(`🧴 Potion +${heal}`); showFloating(`+${heal}`,'heal'); } else if(p.ethers>0){ p.ethers--; const m=rInt(4,8); p.mp=Math.min(p.maxMp,p.mp+m); log(`🔮 Ether +${m}`); showFloating(`+${m} MP`,'heal'); } else log('No items'); doEnemyIntent(); fullSave(); renderAll(); }
function attemptRun(){ if(!state.inCombat) return; if(rnd()<0.5){ log('🏃 You escape'); state.inCombat=false; state.currentEnemy=null; renderAll(); fullSave(); } else { log('✋ Escape failed'); doEnemyIntent(); fullSave(); } }

/* ---------- status effects ---------- */
function applyStatus(target, key, duration=2){ target.status = target.status || []; const existing = target.status.find(s=>s.k===key); if(existing){ existing.t = Math.max(existing.t,duration); } else target.status.push({k:key,t:duration}); }
function tickStatus(entity){
  if(!entity || !entity.status) return;
  const rem=[]; for(const s of entity.status){
    if(s.k==='burn'){ entity.currentHp = Math.max(0, entity.currentHp - STATUS.burn.tick); log(`${entity.name || 'Target'} suffers burn`); showFloating(`-${STATUS.burn.tick}`,'hurt'); }
    if(s.k==='poison'){ entity.currentHp = Math.max(0, entity.currentHp - STATUS.poison.tick); log(`${entity.name || 'Target'} suffers poison`); showFloating(`-${STATUS.poison.tick}`,'hurt'); }
    s.t--; if(s.t>0) rem.push(s);
  } entity.status = rem;
}

/* ---------- enemy intent execution ---------- */
function doEnemyIntent(){
  if(!state.currentEnemy) return;
  const e = state.currentEnemy;
  const intent = e._intent || {type:'Attack', val: e.atk || 2};
  const p = state.player;
  if(intent.type === 'Attack' || intent.type === 'Smash'){
    const dmg = Math.max(1, intent.val - (p.defense||0) - (p.tempDef||0));
    p.hp = Math.max(0, p.hp - dmg);
    showFloating(`-${dmg}`,'hurt', true);
    log(`💥 ${e.name} hits for ${dmg}`);
  } else if(intent.type==='Guard'){
    e.tempDef = (e.tempDef||0) + 3;
    log(`${e.name} braces to reduce damage.`);
  } else if(['Poison','Burn','Weaken'].includes(intent.type)){
    const key = intent.type.toLowerCase();
    applyStatus(p, key, intent.val || 2);
    log(`${e.name} applies ${intent.type} to you.`);
  }
  tickStatus(p); tickStatus(e);
  if(p.hp<=0){ log('💀 You died. Run ends.'); onRunEnd(); return; }
  generateEnemyIntent();
}

/* ---------- victory & loot ---------- */
function onVictory(){ const e=state.currentEnemy; if(!e) return; const isBoss = !!e.isBoss; const goldGain = Math.max(1, Math.round(((e.gold||5) + (state.player.floor||1)*2) * (state.goldMult||1))); state.player.gold = (state.player.gold||0) + goldGain; log(`🏆 Defeated ${e.name}! +${goldGain} gold.`); state.stats.kills = (state.stats.kills||0) + 1; if(isBoss) state.stats.bosses = (state.stats.bosses||0) + 1;
  // loot
  const drop = generateLootForEnemy(e.rarity || 'Common', state.player.floor || 1);
  if(drop){ if(drop.type==='relic'){ state.relics.push({name:drop.name, rarity:drop.rarity, color:drop.color}); state.stats.relics++; log(`🎁 Relic: ${drop.rarity} ${drop.name}`); addJournal(`Found relic: ${drop.rarity} ${drop.name} — ${flavorForRelic(drop.name)}`); if(drop.rarity==='Mythic') applySanityChange(-8,'Glimpse of the Mythic'); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(drop); log(`🎁 Item: ${drop.rarity} ${drop.name}`); addJournal(`Found item: ${drop.rarity} ${drop.name}`); } } else { if(rnd()<0.25){ state.player.potions=(state.player.potions||0)+1; log('🧴 Found a potion'); } }
  const xpGain = Math.max(1, Math.round((e.xp||5) * ({Common:1,Uncommon:1.25,Rare:1.5,Epic:2,Legendary:3,Mythic:5})[e.rarity||'Common'])); state.player.xp = (state.player.xp||0) + xpGain; checkLevel(); state.currentEnemy=null; state.inCombat=false; derivePlayer(); fullSave(); renderAll(); }

/* ---------- loot generation ---------- */
function generateLootForEnemy(enemyRarity, floor){
  const categories=['weapon','armor','relic'];
  const category=rChoice(categories);
  const bias=Math.floor(Math.max(0,floor/6));
  const tier = rollRarityBias(bias);
  let pool = [];
  if(category==='weapon') pool = WEAPONS[tier.id] || WEAPONS.Common;
  else if(category==='armor') pool = ARMOR[tier.id] || ARMOR.Common;
  else pool = RELICS[tier.id] || RELICS.Common;
  const base = rChoice(pool);
  if(!base) return null;
  const item = makeNamedItem(base, tier.id);
  item.type = category;
  item.rarity = tier.id;
  item.cost = Math.max(3, Math.round((tier.mul*10) + floor));
  return item;
}

/* ---------- leveling & skill modal ---------- */
function checkLevel(){ const p=state.player; if(!p) return; const xpTo = 8 + p.level * 6; while(p.xp >= xpTo){ p.xp -= xpTo; p.level++; log(`⬆️ Level ${p.level}`); showLevelModal(p); derivePlayer(); fullSave(); } }

function showLevelModal(player){
  const modal = $('levelModal'); const choices = CLASS_DATA[player.classKey].skills.find(s=>s.level===player.level);
  $('levelTitle').innerText = `Level ${player.level} — Choose Reward`;
  const container = $('levelChoices'); container.innerHTML = '';
  const generic = choices ? choices.choices : [{id:'hp+5',label:'+5 HP'},{id:'atk+1',label:'+1 ATK'}];
  generic.forEach(opt=>{
    const b = document.createElement('button'); b.className='secondary'; b.innerText = opt.label; b.onclick = ()=>{ applySkillChoice(player, opt); modal.classList.add('hidden'); renderAll(); fullSave(); }; container.appendChild(b);
  });
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  $('levelClose').onclick = ()=>{ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); };
}

function applySkillChoice(player, choice){
  if(!choice) return;
  if(choice.id==='hp+5' || choice.id==='hp+6') player.baseHp += parseInt(choice.id.split('+')[1] || '5');
  if(choice.id==='atk+1' || choice.id==='atk+2') player.baseAtk += parseInt(choice.id.split('+')[1] || '1');
  if(choice.id==='crit+5') player.crit = (player.crit||0) + 5;
  if(choice.id==='mp+5' || choice.id==='mp+6') player.mp += parseInt(choice.id.split('+')[1] || '5');
  if(choice.id==='mag+1' || choice.id==='mag+2') player.mag += parseInt(choice.id.split('+')[1] || '1');
  if(choice.id==='shield_bash') player.skills = (player.skills||[]).concat('Shield Bash');
  if(choice.id==='arcane_surge') player.spellBoost = (player.spellBoost||0) + 0.20;
  if(choice.id==='poison_edge') player.poisonOnHit = true;
  addJournal(`Gained skill/upgrade: ${choice.label || choice.id}`);
}

/* ---------- chest / shop / events / town ---------- */
function openChest(){ if(!state.player) return; if(rnd() < 0.55){ const drop = generateLootForEnemy('Common', state.player.floor||1); if(drop.type==='relic'){ state.relics.push({name:drop.name, rarity:drop.rarity, color:drop.color}); state.stats.relics++; log(`🎁 Chest: Relic ${drop.rarity} ${drop.name}`); addJournal(`Chest: Relic ${drop.rarity} ${drop.name}`); if(drop.rarity==='Legendary') applySanityChange(-4,'Glimpse of Legend'); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(drop); log(`🎁 Chest: Item ${drop.rarity} ${drop.name}`); addJournal(`Chest: Item ${drop.rarity} ${drop.name}`); } } else { const g = rInt(6,26) + (state.player.floor||1)*2; state.player.gold = (state.player.gold||0) + Math.round(g * (state.goldMult||1)); log(`💰 Chest: +${Math.round(g * (state.goldMult||1))} gold.`); } fullSave(); renderAll(); }

let lastShop = [];
function openShop(){ if(state.inCombat){ log('Cannot shop during combat'); return; } const pool = equipmentPoolPreview(); lastShop = []; for(let i=0;i<3;i++){ lastShop.push(makeNamedItem(rChoice(pool), rollRarityBias(state.shop.tier).id)); } lastShop.push({ baseName:'Potion', type:'consumable', name:'Potion', cost:5}); lastShop.push({ baseName:'Ether', type:'consumable', name:'Ether', cost:5}); let html = `<div class="small">Merchant's Wares (Tier ${state.shop.tier})</div><div class="shop-list" style="margin-top:8px">`; lastShop.forEach((it,idx)=>{ const rarityClass = `rarity-${(it.rarity||'Common').toLowerCase()}`; html += `<div class="item-row"><div><strong style="color:${it.color||'#bdbdbd'}">${it.name || it.baseName}</strong><div class="small muted">${it.type||''} ${it.rarity?` • ${it.rarity}`:''}</div></div><div><span class="small">${it.cost||Math.max(3,Math.round(10*(it.effect?.atk||1))) }g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; log('🏪 Merchant appears'); fullSave(); }

function buy(idx){ const it = lastShop[idx]; if(!it) return; if(!state.player){ log('Start run first'); return; } if(state.player.gold < (it.cost||5)){ log('Not enough gold'); return; } state.player.gold -= (it.cost||5); if(it.type==='consumable'){ if(it.baseName==='Potion') state.player.potions=(state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers=(state.player.ethers||0)+1; log(`Bought ${it.baseName}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`Bought ${it.rarity||''} ${it.name||it.baseName}`); addJournal(`Bought ${it.rarity||''} ${it.name||it.baseName}`); } fullSave(); renderAll(); }
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

function equipmentPoolPreview(){ const pool=[]; Object.keys(WEAPONS).forEach(r=> WEAPONS[r].forEach(i=> pool.push(i))); Object.keys(ARMOR).forEach(r=> ARMOR[r].forEach(i=> pool.push(i))); return pool; }

/* events */
const EVENTS = [
  { id:'whisper_door', text:'A door hums with whispers. Speak or remain silent?', choices:[ {label:'Speak', func:s=>{ s.player.xp=(s.player.xp||0)+5; s.player.hp=Math.max(1,s.player.hp-5); addJournal('You whispered to the Door — a fragment answered.'); applySanityChange(-2,'Whisper Door'); log('+5 XP, -5 HP'); } }, {label:'Silent', func:s=>{ if(rnd()<0.35){ const r=rChoice(Object.values(RELICS).flat()); s.relics.push({name:r.name, rarity:'Common'}); addJournal('Silence rewarded with a relic.'); log(`Silence: ${r.name}`); } else log('Nothing happened'); } } ] },
  { id:'cursed_fountain', text:'A cursed fountain bubbles. Drink to heal but risk a curse?', choices:[ {label:'Drink', func:s=>{ if(rnd()<0.5){ s.player.hp=Math.min(s.player.maxHp, s.player.hp+12); addJournal('Fountain healed you'); applySanityChange(-1,'Fountain'); log('Healed by fountain'); } else { applyStatus(s.player,'poison',3); applySanityChange(-4,'Cursed Fountain'); addJournal('Fountain cursed you'); log('Poisoned by fountain'); } } }, {label:'Pass', func:s=>{ addJournal('You pass the fountain'); log('Passed fountain'); } } ] }
];

function runEvent(){ if(!state.player) return; const ev=rChoice(EVENTS); log('❓ Event: '+ev.text); let html=`<div class="small">${ev.text}</div><div class="shop-list" style="margin-top:8px">`; ev.choices.forEach((c, idx)=>{ html += `<div class="item-row"><div>${c.label}</div><div><button class="secondary" onclick="chooseEvent(${idx})">Choose</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; window.chooseEvent = function(idx){ ev.choices[idx].func(state); renderAll(); fullSave(); closeShopPanel(); }; }

/* ---------- inventory & equip ---------- */
function openInventory(){ if(!state.player) return; if(state.inCombat){ log('Finish combat first'); return; } const inv = state.player.inventory || []; let html = `<div class="small">Inventory</div><div class="inv-list">`; if(inv.length===0) html += `<div class="small">— empty —</div>`; inv.forEach((it, idx)=>{ const stats = `${it.effect?(it.effect.atk?`ATK+${it.effect.atk} `:'')+(it.effect.def?`DEF+${it.effect.def} `:''):''}`; html+= `<div class="item-row"><div><strong style="color:${it.color||'#bdbdbd'}">${it.name}</strong><div class="small muted">${it.rarity?it.rarity:''}</div><div class="small muted">${stats}</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; }

function equipItem(idx){ const it = state.player.inventory[idx]; if(!it) return; if(!['weapon','armor','accessory'].includes(it.type) && !['weapon','armor'].includes(it.type)){ log('Not equippable'); return; } const slot = (it.type==='weapon')?'weapon':(it.type==='armor'?'armor':'accessory'); if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName || state.player.equip[slot].name}`); } state.player.equip[slot]=it; state.player.inventory.splice(idx,1); log(`🛡️ Equipped ${it.rarity || ''} ${it.name}`); derivePlayer(); fullSave(); renderAll(); }
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity || 'Common'} ${it.name}\n${it.effect?Object.entries(it.effect).map(e=> `${e[0]}:${e[1]}`).join('\n'):''}\nValue:${it.cost||0}g`); }

/* ---------- helpers ---------- */
function maxHpLocal(){ return (state.player?.baseHp||0) + (state.player?.equip?.armor?.effect?.hp||0) + (state.player?.equip?.accessory?.effect?.hp||0); }
function totalDefLocal(){ return (state.player?.baseDef||0) + (state.player?.equip?.armor?.effect?.def||0); }

/* ---------- floating text ---------- */
function showFloating(text, cls='hit', absolute=false){
  const area = $('battleArea');
  const el = document.createElement('div');
  el.className = `floating ${cls}`;
  el.innerText = text;
  if(absolute){
    const pop = document.createElement('div'); pop.className='damage-pop'; pop.innerText = text; area.appendChild(pop);
    pop.style.animation = 'popFloat 900ms ease-out forwards';
    setTimeout(()=>pop.remove(),900);
  } else {
    area.appendChild(el);
    setTimeout(()=>el.remove(),900);
  }
}

/* ---------- journal & achievements ---------- */
function addJournal(text){ state.journal = state.journal || []; state.journal.push({time:Date.now(),text}); fullSave(); }
const ACHIEVEMENTS = [
  {id:'slayer',name:'Monster Slayer',cond:()=> state.stats.kills>=100},
  {id:'collector',name:'Relic Collector',cond:()=> state.stats.relics>=10},
  {id:'deep',name:'Deep Delver',cond:()=> state.stats.floors>=10},
  {id:'bosskiller',name:'Boss Killer',cond:()=> state.stats.bosses>=1}
];
function checkAchievements(){ ACHIEVEMENTS.forEach(a=>{ if(a.cond() && !state.achievements[a.id]){ state.achievements[a.id]=true; showAchievement(a.name); fullSave(); } }); }
function showAchievement(name){ alert(`🏆 Achievement Unlocked: ${name}`); log(`Achievement: ${name}`); }
function renderAchievements(){ const el=$('achContent'); if(!el) return; let html=''; ACHIEVEMENTS.forEach(a=> html+=`<div class="item-row"><div><strong>${a.name}</strong></div><div>${state.achievements[a.id] ? '<span class="small muted">Unlocked</span>' : '<span class="small muted">Locked</span>'}</div></div>`); el.innerHTML = html; }

/* ---------- run end & meta ---------- */
function onRunEnd(){ const floors = state.player?.floor || 1; const legacy = Math.max(1,Math.floor(floors/2)); state.meta.legacyPts = (state.meta.legacyPts||0) + legacy; const entry = {floor:floors,gold:state.player?.gold||0,class:state.player?.classKey||'Unknown',seed:state.seed}; const lb = JSON.parse(localStorage.getItem(LEADER_KEY)||'[]'); lb.push(entry); localStorage.setItem(LEADER_KEY, JSON.stringify(lb)); state.player=null; state.floorMap={}; state.currentEnemy=null; state.inCombat=false; log(`Run ended. Legacy Points earned: ${legacy}`); fullSave(); renderAll(); }

/* ---------- flavor ---------- */
function flavorForRelic(name){ return `An odd relic: ${name}. It hums with forgotten memory.`; }

/* ---------- render UI ---------- */
function renderRelicsUI(){ const el=$('relicRow'); if(!el) return; el.innerHTML=''; const combined = (state.relics||[]).concat(state.legacyRelics||[]); if(combined.length===0){ el.innerText='Relics: —'; return; } for(const r of combined){ const pill=document.createElement('div'); pill.className='relic-pill'; pill.innerText = `${r.rarity?('['+r.rarity+'] '):''}${r.name}`; pill.style.borderColor = r.color || '#673'; el.appendChild(pill); } }

function renderSpellButtons(){ const container=$('spellRow'); if(!container) return; container.innerHTML=''; if(!state.player) return; const spells = state.player.spells||[]; const costMap={'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Voidstrike':7}; spells.forEach(s=>{ const b=document.createElement('button'); b.className='secondary'; const cost = costMap[s]||3; b.textContent = `${s} (${cost})`; b.onclick=()=>{ castSpell(s); $('spellMenu').classList.add('hidden'); }; container.appendChild(b); }); }
function renderSkillButtons(){ const container=$('skillRow'); if(!container) return; container.innerHTML=''; if(!state.player) return; const skills = state.player.skills||[]; const classAbility = CLASS_DATA[state.player.classKey].ability; const btn = document.createElement('button'); btn.className='secondary'; btn.textContent = `${classAbility.id}`; btn.onclick = ()=> useSkill(classAbility.id); container.appendChild(btn); skills.forEach(s=>{ const b=document.createElement('button'); b.className='secondary'; b.textContent = s; b.onclick = ()=> useSkill(s); container.appendChild(b); }); }

/* ---------- meta shop ---------- */
function renderMeta(){ const el=$('metaContent'); if(!el) return; const offers = [ {id:'hp_boost',name:'Vital Essence',cost:6,desc:'+5 Max HP permanently'}, {id:'loot_boost',name:'Lucky Soul',cost:10,desc:'+5% rare drop chance'}, {id:'unlock_class',name:'Blood Oath',cost:12,desc:'Spend to unlock a class for next runs'} ]; let html=`<div class="small">Legacy Points: <strong>${state.meta.legacyPts||0}</strong></div><div style="margin-top:8px">`; offers.forEach((o,idx)=> html += `<div class="item-row"><div><strong>${o.name}</strong><div class="small muted">${o.desc}</div></div><div><button class="secondary" onclick="buyMeta(${idx})">Buy (${o.cost})</button></div></div>`); html+=`</div>`; el.innerHTML = html; }
function buyMeta(idx){ const offers=[{id:'hp_boost',name:'Vital Essence',cost:6,apply:()=>{ state.meta.upgrades.push('hp_boost'); state.player && (state.player.baseHp += 5); }},{id:'loot_boost',name:'Lucky Soul',cost:10,apply:()=>{ state.meta.upgrades.push('loot_boost'); }},{id:'unlock_class',name:'Blood Oath',cost:12,apply:()=>{ // unlock a random class if any remain
  const all = Object.keys(CLASS_DATA); const unlocked = state.meta.unlockedClasses || []; const remaining = all.filter(c=>!unlocked.includes(c)); if(remaining.length>0){ const pick = rChoice(remaining); state.meta.unlockedClasses = (state.meta.unlockedClasses||[]).concat(pick); addJournal(`Unlocked class ${pick} for future runs`); } }}]; const o=offers[idx]; if(!o) return; if(state.meta.legacyPts < o.cost){ alert('Not enough Legacy Points'); return; } state.meta.legacyPts -= o.cost; o.apply(); fullSave(); renderMeta(); renderAll(); log('Meta purchased: '+o.name); }

/* ---------- SANITY & DREAMS ---------- */
function applySanityChange(amount, reason){
  if(typeof amount !== 'number') return;
  state.sanity = Math.max(0, Math.min(100, (state.sanity||100) + Math.round(amount)));
  log(`🧠 Sanity ${amount>0?'+':' '}${amount} — ${reason||'unknown'}`);
  if(Math.abs(amount) >= 6) addJournal(`Sanity ${amount>0?'+':' '}${amount} (${reason||'event'})`);
  checkSanityEffects();
  renderSanityUI();
  fullSave();
}
function renderSanityUI(){
  const bar = $('sanityFill'); const label = $('sanityLabel'); const hint = $('sanityHint');
  if(!bar || typeof state.sanity === 'undefined') return;
  const pct = Math.round(state.sanity);
  bar.style.width = pct + '%';
  $('sanityBar').title = `${pct}`;
  if(pct >= state.sanityThresholds.stable){ label.innerText = 'Stable'; hint.innerText = 'Clear thoughts.'; bar.style.background = 'linear-gradient(90deg,#3fa34d,#ffd700)'; $('sanityBar').classList.remove('sanity-low'); document.body.classList.remove('hallucinate'); }
  else if(pct >= state.sanityThresholds.uneasy){ label.innerText = 'Uneasy'; hint.innerText = 'Shadows move at the corner of your sight.'; bar.style.background = 'linear-gradient(90deg,#ffd700,#ff8f4d)'; $('sanityBar').classList.remove('sanity-low'); document.body.classList.remove('hallucinate'); }
  else if(pct >= state.sanityThresholds.fragile){ label.innerText = 'Fragile'; hint.innerText = 'Whispers grow louder.'; bar.style.background = 'linear-gradient(90deg,#ff8f4d,#ff4040)'; $('sanityBar').classList.add('sanity-low'); document.body.classList.add('hallucinate'); }
  else { label.innerText = 'Mad'; hint.innerText = 'Reality slips — expect hallucinations.'; bar.style.background = 'linear-gradient(90deg,#ff4040,#8a0022)'; $('sanityBar').classList.add('sanity-low'); document.body.classList.add('hallucinate'); }
}
function checkSanityEffects(){
  const s = state.sanity || 0;
  if(s <= state.sanityThresholds.fragile){
    if(rnd() < 0.35) { triggerHallucination(); }
  }
  if(s < state.sanityThresholds.uneasy && state.player){
    state.player.attackBonus = (state.player.attackBonus||0) - 1;
  } else if(state.player){
    state.player.attackBonus = Math.max(0, state.player.attackBonus||0);
  }
}
function triggerHallucination(){
  const halluc = [
    ()=>{ addJournal('A shadow reached for you; it left only a cold mark.'); applySanityChange(-2,'Shadow reach'); log('A hallucination scratches at your mind.'); },
    ()=>{ addJournal('You imagined a fellow traveler — then you remembered you travel alone.'); applySanityChange(-3,'Lonely memory'); log('Lonely vision fades.'); },
    ()=>{ addJournal('You saw coins pouring from the ceiling — they were pebbles.'); const g=rInt(2,6); state.player.gold = (state.player.gold||0)+g; log(`Hallucination: found ${g} gold (illusory?)`); }
  ];
  rChoice(halluc)();
  renderAll();
}

/* Dream modal with typing */
let dreamTypingInterval = null;
function triggerDream(dreamId){
  const candidate = dreamId ? DREAMS.find(d=>d.id===dreamId) : rChoice(DREAMS);
  if(!candidate) return;
  const modal = $('dreamModal'); const body = $('dreamBody'); const title = $('dreamTitle'); const ch = $('dreamChoices');
  title.innerText = candidate.title || 'Dream';
  body.innerText = ''; ch.innerHTML = '';
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  const text = candidate.text;
  let i=0;
  dreamTypingInterval && clearInterval(dreamTypingInterval);
  dreamTypingInterval = setInterval(()=>{
    i++; body.innerText = text.slice(0,i);
    if(i>=text.length){ clearInterval(dreamTypingInterval); dreamTypingInterval=null;
      candidate.choices.forEach((c, idx)=>{
        const b = document.createElement('button'); b.className='secondary'; b.innerText = c.label;
        b.onclick = ()=>{ applySanityChange(c.san || 0, 'Dream choice'); try{ c.reward && c.reward(state); }catch(e){console.warn(e);} closeDream(); renderAll(); };
        ch.appendChild(b);
      });
    }
  }, 18 + Math.round(12 * (1 - (state.sanity||100)/100)));
}
function closeDream(){ const modal = $('dreamModal'); modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); dreamTypingInterval && clearInterval(dreamTypingInterval); }

/* maybe trigger dream after descent */
function maybeTriggerDreamAfterFloor(){
  if(rnd() < 0.18 + Math.max(0, (20 - (state.sanity||100))/200) ){ triggerDream(); }
}

/* integrate rest/shrine */
function useInn(){
  if(state.player.gold < 8){ alert('Not enough gold'); return; }
  state.player.gold -= 8;
  state.player.hp = state.player.maxHp;
  state.player.mp = state.player.maxMp;
  applySanityChange( state.sanityRecoverRest, 'Rest at Inn' );
  log('You rest at the inn — healed and steadied.');
  renderAll(); fullSave();
}
function openShrine(){
  const pick = prompt('Shrine: 1) Reroll relic (cost 2g) 2) Respec skills (cost 4g) 3) Meditate (+8 Sanity for 2 fragments)','3');
  if(pick==='1'){ if(state.player.gold<2){ alert('Not enough gold'); return; } state.player.gold -= 2; if(state.relics.length>0){ const r = state.relics.pop(); const newRel = rChoice(Object.values(RELICS).flat()); state.relics.push({name:newRel.name}); log('Rerolled relic'); } else log('No relic to reroll'); }
  else if(pick==='2'){ if(state.player.gold<4){ alert('Not enough gold'); return; } state.player.gold -= 4; state.player.skills = []; log('You respec your skills'); }
  else if(pick==='3'){ if((state.meta.fragments||0) < 2){ alert('Not enough fragments'); return; } state.meta.fragments -= 2; applySanityChange(8,'Meditation'); log('Meditation at shrine calms you.'); }
  renderAll(); fullSave();
}

/* ---------- UI wiring ---------- */
function wireUI(){
  $('btnNew').addEventListener('click', ()=>{ const cls = prompt('New run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls || !CLASS_DATA[cls]){ alert('Invalid'); return; } const s = prompt('Enter seed (or leave blank for random)',''); const seed = s||String(Math.floor(Math.random()*900000+100000)); newRun(cls, seed, false); });
  $('btnReset').addEventListener('click', resetAll);
  $('btnEnterRoom').addEventListener('click', enterRoom);
  $('btnShop').addEventListener('click', openShop);
  $('btnRest').addEventListener('click', ()=>{ if(!state.player){ alert('Start run first'); return; } if(state.player.gold < 5){ log('Not enough gold to rest'); return; } state.player.gold -= 5; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 12); state.player.mp = Math.min(state.player.maxMp, state.player.mp + 6); applySanityChange(4,'Short Rest'); log('You rest (5g)'); renderAll(); fullSave(); });
  $('btnInventory').addEventListener('click', openInventory);
  $('btnJournal').addEventListener('click', ()=>{ $('journalModal').classList.remove('hidden'); $('journalModal').setAttribute('aria-hidden','false'); renderJournal(); });
  $('btnAchievements').addEventListener('click', ()=>{ $('achievementsModal').classList.remove('hidden'); $('achievementsModal').setAttribute('aria-hidden','false'); renderAchievements(); });
  $('btnExport').addEventListener('click', ()=>{ const txt=$('log').innerText; const blob=new Blob([txt],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`epic_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); });
  $('btnAttack').addEventListener('click', playerAttack);
  $('btnSkill').addEventListener('click', ()=>{ $('skillMenu').classList.toggle('hidden'); renderSkillButtons(); });
  $('btnSpell').addEventListener('click', ()=>{ $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
  $('btnItem').addEventListener('click', useItemCombat);
  $('btnRun').addEventListener('click', ()=>{ if(confirm('Attempt to flee?')) attemptRun(); });
  $('btnMeta').addEventListener('click', ()=>{ $('metaModal').classList.remove('hidden'); $('metaModal').setAttribute('aria-hidden','false'); renderMeta(); });
  $('btnDaily').addEventListener('click', ()=>{ const seed=generateDailySeedForDate(new Date()); const cls = prompt('Daily run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls||!CLASS_DATA[cls]){ alert('Invalid'); return; } newRun(cls, seed, true); });
  $('btnCredits').addEventListener('click', ()=>{ $('creditsModal').classList.remove('hidden'); $('creditsModal').setAttribute('aria-hidden','false'); });
  $('closeCredits').addEventListener('click', ()=>{ $('creditsModal').classList.add('hidden'); $('creditsModal').setAttribute('aria-hidden','true'); });
  window.closeMeta = ()=>{ $('metaModal').classList.add('hidden'); $('metaModal').setAttribute('aria-hidden','true'); };
  window.closeJournal = ()=>{ $('journalModal').classList.add('hidden'); $('journalModal').setAttribute('aria-hidden','true'); };
  window.closeAchievements = ()=>{ $('achievementsModal').classList.add('hidden'); $('achievementsModal').setAttribute('aria-hidden','true'); };
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ ['metaModal','journalModal','achievementsModal','creditsModal','dreamModal','levelModal'].forEach(id=>{ const el=$(id); if(el && !el.classList.contains('hidden')){ el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); } }); }});
}

/* ---------- render all ---------- */
function renderAll(){
  if(state.player){
    $('playerName').innerText = state.player.name || '—';
    $('playerClass').innerText = state.player.classKey || '—';
    derivePlayer();
    $('hp').innerText = Math.max(0, state.player.hp||0);
    $('maxhp').innerText = state.player.maxHp||0;
    $('mp').innerText = state.player.mp||0;
    $('maxmp').innerText = state.player.maxMp||0;
    $('atk').innerText = state.player.attack||0;
    $('def').innerText = totalDefLocal();
    $('mag').innerText = state.player.mag||0;
    $('floor').innerText = state.player.floor||1;
    $('gold').innerText = state.player.gold||0;
    $('xp').innerText = state.player.xp||0;
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? (state.player.equip.weapon.name) : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? (state.player.equip.armor.name) : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? (state.player.equip.accessory.name) : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${(state.player.inventory||[]).length}`;
  } else {
    $('playerName').innerText = '—';
  }

  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = `${state.currentEnemy.name}`;
    $('enemyHP').innerText = Math.max(0, state.currentEnemy.currentHp||0);
    $('enemyATK').innerText = state.currentEnemy.atk||0;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length)? state.currentEnemy.status.map(s=>s.k).join(','): '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = state.currentEnemy.isBoss ? 'Boss battle — focus and survive.' : 'Battle — choose your action.';
    const ba = $('battleArea'); ba.innerHTML = '';
    const name = document.createElement('div'); name.className = `enemy ${state.currentEnemy.rarity||'Common'}`; name.innerText = `${state.currentEnemy.name}`; name.style.color = state.currentEnemy.color || '#fff';
    ba.appendChild(name);
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore nodes, fight monsters, collect relics.';
    $('battleArea').innerHTML = '';
  }

  renderRelicsUI();
  renderJournal();
  renderMeta();
  if($('fragments')) $('fragments').innerText = state.meta.fragments||0;
  if($('seedDisplay')) $('seedDisplay').innerText = state.seed||'—';
  if($('legacyPts')) $('legacyPts').innerText = state.meta.legacyPts||0;
  renderSanityUI();
  checkAchievements();
  fullSave();
}

/* ---------- cinematic ---------- */
function cineShow(text,ms=900){ return new Promise(resolve=>{ const el=document.createElement('div'); el.className='cine-overlay'; el.innerHTML = `<div class="cine-text">${text}</div>`; document.body.appendChild(el); setTimeout(()=>{ el.remove(); resolve(); }, ms); }); }

/* ---------- boot ---------- */
function gameInit(seedString, cls){
  state.seed = seedString || String(Date.now());
  initSeed(state.seed);
  if(fullLoad()){
    if(state.seed !== window.CURRENT_SEED) initSeed(state.seed);
    log('Save loaded on boot.');
  } else {
    log('No save — start a new run. Seed: ' + state.seed);
    fullSave();
  }
  wireUI(); renderAll();
  if(cls) newRun(cls, state.seed, false);
}
window.gameInit = gameInit;

/* auto-run if seed in global */
if(window.INIT_SEED) gameInit(window.INIT_SEED);

// expose helpers for console
window.getState = () => state;
