/* Phase 7: Full integration (Classes, Statuses, Towns, Achievements, Bosses, Meta)
   Keep assets in assets/sprites.png and assets/monsters.png
*/

/* ---------- utilities ---------- */
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
const SAVE_KEY = 'epictextrpg_save_v7';
const META_KEY = 'epictextrpg_meta_v7';
const LEADER_KEY = 'epictextrpg_leader_v7';
const DAILY_KEY = 'epictextrpg_daily_v7';

/* ---------- base data ---------- */
const rarityWeightsBase = { Common:60, Uncommon:25, Rare:10, Epic:4, Legendary:1 };
function weightedChoice(weights){
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  let roll = rnd() * total;
  for(const k of Object.keys(weights)){
    if(roll < weights[k]) return k;
    roll -= weights[k];
  }
  return Object.keys(weights)[0];
}

/* ---------- Classes & skill trees ---------- */
const CLASS_DATA = {
  Warrior: {
    name:'Warrior', passive:'+10% damage', ability:{id:'Power Slash',desc:'Deal 150% damage'}, skills:[
      {level:2,choices:[{id:'hp+5',label:'+5 HP'},{id:'atk+1',label:'+1 ATK'}]},
      {level:4,choices:[{id:'shield_bash',label:'Shield Bash (stun)'},{id:'crit+5',label:'+5% Crit'}]}
    ]
  },
  Mage: {
    name:'Mage', passive:'+2 MP / turn', ability:{id:'Fireball',desc:'Deal 10 fire to enemy'}, skills:[
      {level:2,choices:[{id:'mp+5',label:'+5 MP'},{id:'mag+1',label:'+1 MAG'}]},
      {level:4,choices:[{id:'arcane_surge',label:'Arcane Surge (+20% magic dmg)'},{id:'freeze_master',label:'Frost Bolt (chance to freeze)'}]}
    ]
  },
  Rogue: {
    name:'Rogue', passive:'+10% crit', ability:{id:'Backstab',desc:'Double damage if first strike'}, skills:[
      {level:2,choices:[{id:'crit+5',label:'+5% Crit'},{id:'atk+1',label:'+1 ATK'}]},
      {level:4,choices:[{id:'evasion+5',label:'+5% Evasion'},{id:'poison_edge',label:'Poison on hit'}]}
    ]
  }
};

/* ---------- Items / equipment / relics (summary pools) ---------- */
const WEAPONS = { Common:[{name:'Rusted Sword',sprite:'sword',effect:{atk:1}}], Uncommon:[{name:'Iron Longsword',sprite:'sword',effect:{atk:2}}], Rare:[{name:"Knight's Greatsword",sprite:'sword',effect:{atk:4}}], Epic:[{name:'Bloodfang Blade',sprite:'sword',effect:{atk:5,lifesteal:true}}], Legendary:[{name:'Shadow Reaver',sprite:'sword',effect:{atk:8,doubleStrike:25}}] };
const ARMOR = { Common:[{name:'Leather Tunic',sprite:'chest',effect:{def:2}}], Uncommon:[{name:'Iron Plate',sprite:'chest',effect:{def:3}}], Rare:[{name:'Knight Shield',sprite:'shield',effect:{def:5}}], Epic:[{name:'Wraith Armor',sprite:'chest',effect:{def:4,poisonImmune:true}}], Legendary:[{name:'Armor of the Fallen King',sprite:'chest',effect:{def:6,atk:3}}] };
const RELICS = { Common:[{name:'Old Coin',sprite:'coin',effect:{gold:5}}], Uncommon:[{name:'Soul Charm',sprite:'amulet',effect:{xpBoost:10}}], Rare:[{name:'Heart of Cinders',sprite:'orb',effect:{postHeal:5}}], Epic:[{name:'Infernal Sigil',sprite:'orb',effect:{spellBoost:25}}], Legendary:[{name:'Tome of the Void',sprite:'scroll',effect:{unlockSpell:'Voidstrike'}}] };

/* ---------- monsters & bosses ---------- */
const MONSTERS = {
  Common:[ {name:'Ratling',sprite:'rat',hp:10,atk:3,def:1,xp:5,gold:3}, {name:'Slime',sprite:'slime',hp:8,atk:2,def:0,xp:4,gold:2} ],
  Uncommon:[ {name:'Shadow Wolf',sprite:'wolf',hp:18,atk:6,def:2,xp:14,gold:10} ],
  Rare:[ {name:'Grave Knight',sprite:'knight',hp:35,atk:10,def:4,xp:28,gold:20} ],
  Epic:[ {name:'Vampire Lord',sprite:'vampire',hp:60,atk:15,def:5,xp:60,gold:45} ],
  Legendary:[ {name:'The Hollow King',sprite:'hollowking',hp:150,atk:20,def:8,xp:250,gold:120,twoPhase:true} ]
};

const BOSSES = [
  { id:'hollowking', name:'The Hollow King', hp:150, phases:[
      {hpPct:0.7, action:'Summon Shades'}, {hpPct:0.4, action:'Dark Nova'}, {hpPct:0.15, action:'Enrage'}
    ], drops:['Crown of Eternity','Tome of the Void'], sprite:'hollowking' },
  { id:'eclipsedragon', name:'Eclipse Dragon', hp:200, phases:[
      {hpPct:0.75,action:'Shadow Breath'}, {hpPct:0.35,action:'Wings of Night'}
    ], drops:['Dragon Heart','Shadow Reaver'], sprite:'dragon' }
];

/* ---------- status effects ---------- */
const STATUS = {
  burn: { id:'burn', name:'Burn', tick:(t)=>{ t.currentHp = Math.max(0,t.currentHp - 2); }, desc:'Takes 2 burn damage per turn' },
  poison: { id:'poison', name:'Poison', tick:(t)=>{ t.currentHp = Math.max(0,t.currentHp - 3); }, desc:'Takes 3 poison damage per turn' },
  freeze: { id:'freeze', name:'Freeze', skip:true, desc:'Skip next turn' },
  bless: { id:'bless', name:'Bless', desc:'Temporary buff' },
  curse: { id:'curse', name:'Curse', desc:'Temporary debuff' }
};

/* ---------- monster sprite mapping ---------- */
const monsterSprites = { rat:"0 0", spider:"-16px 0", slime:"-32px 0", goblin:"-48px 0", wolf:"0 -16px", knight:"-48px -16px", vampire:"-48px -32px", hollowking:"0 -48px", dragon:"-16px -48px" };

/* ---------- state ---------- */
let state = {
  seed:null, runId:Date.now(), player:null, floorMap:{}, currentEnemy:null, inCombat:false, relics:[], legacyRelics:[], journal:[], meta:{fragments:0,upgrades:[]}, achievements:{}, stats:{kills:0,relics:0,bosses:0,floors:0}, options:{music:false}
};

/* ---------- helpers: save/load ---------- */
function showSaveToast(){ const el=$('saveToast'); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function fullSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); localStorage.setItem(META_KEY, JSON.stringify(state.meta)); showSaveToast(); }catch(e){ console.warn('save failed',e); } }
function fullLoad(){ const s = localStorage.getItem(SAVE_KEY); if(!s) return false; try{ state = JSON.parse(s); state.meta = JSON.parse(localStorage.getItem(META_KEY)||'{}')||state.meta; if(state.seed) initSeed(state.seed); derivePlayer(); renderAll(); log('📂 Save loaded'); return true; }catch(e){ console.warn('load fail', e); return false; } }
function resetAll(){ if(!confirm('Reset all saves and meta?')) return; localStorage.removeItem(SAVE_KEY); localStorage.removeItem(META_KEY); state={seed:null,runId:Date.now(),player:null,floorMap:{},currentEnemy:null,inCombat:false,relics:[],legacyRelics:[],journal:[],meta:{fragments:0,upgrades:[]},achievements:{},stats:{kills:0,relics:0,bosses:0,floors:0}}; fullSave(); renderAll(); log('🔁 Reset done'); }

/* ---------- derived & player setup ---------- */
function applyRelicEffects(){ state.goldMult=1; state.xpMult=1; state.spellBoost=0; for(const r of state.relics.concat(state.legacyRelics||[])){ if(r.name==='Old Coin') state.goldMult+=0.10; if(r.name==='Soul Charm') state.xpMult+=0.10; if(r.name==='Infernal Sigil') state.spellBoost+=0.25; } }
function derivePlayer(){ if(!state.player) return; applyRelicEffects(); const p=state.player; p.maxHp = p.baseHp + (p.equip.weapon?.effect?.hp||0) + (p.equip.armor?.effect?.hp||0); p.attack = p.baseAtk + (p.equip.weapon?.effect?.atk||0); p.defense = p.baseDef + (p.equip.armor?.effect?.def||0); p.maxMp = Math.max(5, p.mag + 3); if(p.hp>p.maxHp) p.hp=p.maxHp; if(p.mp>p.maxMp) p.mp=p.maxMp; }

/* ---------- new run ---------- */
function generateDailySeedForDate(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}${m}${day}`; }
window.generateDailySeed = ()=> generateDailySeedForDate(new Date());

function newRun(classKey, seed, daily=false){
  state.seed = seed || String(Date.now());
  initSeed(state.seed);
  const CL = CLASS_DATA[classKey] || CLASS_DATA.Warrior;
  const starterInv = [{ id:'starter_potion', name:'Potion', type:'consumable', sprite:'potion' }];
  const p = { name:classKey, classKey, baseHp: classKey==='Warrior'?30: classKey==='Mage'?20:24, hp:0, baseAtk: classKey==='Warrior'?7: classKey==='Mage'?3:5, baseDef: classKey==='Warrior'?2:1, mag: classKey==='Mage'?8:4, mp:10, xp:0, level:1, gold:15, potions:1, ethers:1, equip:{weapon:null,armor:null,accessory:null}, inventory: starterInv, spells: classKey==='Mage'?['Firebolt','Ice Shard','Heal'] : (classKey==='Rogue'?['Ice Shard','Firebolt']:['Shield']), skills:[], tempDef:0, status:[], floor:1, daily:!!daily, trophies:[] };
  state.player = p; derivePlayer(); state.relics=[]; state.currentEnemy=null; state.inCombat=false; state.floorMap={}; if(!daily) cineShow(`Seed ${state.seed} — The descent begins...`,900).then(()=>{ log('New Run: '+classKey); fullSave(); renderAll(); }); if(daily) { log('Daily run started'); fullSave(); renderAll(); }
}

/* ---------- floor generation & town logic ---------- */
function genFloor(n){ if(state.floorMap['f'+n]) return state.floorMap['f'+n]; const rooms=[]; const total=6 + Math.min(12,n); for(let i=0;i<total;i++){ const r=rnd(); if(r<0.50) rooms.push({type:'monster'}); else if(r<0.66) rooms.push({type:'treasure'}); else if(r<0.78) rooms.push({type:'event'}); else if(r<0.90) rooms.push({type:'shop'}); else rooms.push({type:'rest'}); } rooms.push({type:'stairs'}); if(n%5===0) rooms.push({type:'boss'}); state.floorMap['f'+n] = {rooms,pointer:0}; return state.floorMap['f'+n]; }
function enterRoom(){ if(!state.player){ alert('Start a run first'); return; } if(state.inCombat){ log('Finish combat first.'); return; } const floor=state.player.floor||1; const fobj=genFloor(floor); const idx=fobj.pointer; if(idx>=fobj.rooms.length){ // stairs
  descendFloor(); fullSave(); return;
} const room=fobj.rooms[idx]; fobj.pointer++; log(`➡ You enter: ${room.type}`); if(room.type==='monster') startMonster(); else if(room.type==='treasure') openChest(); else if(room.type==='shop') openShop(); else if(room.type==='rest') useFountain(); else if(room.type==='event') runEvent(); else if(room.type==='boss') startBoss(); renderAll(); fullSave(); }

/* ---------- descend ---------- */
function descendFloor(){ if(!state.player) return; state.player.floor = (state.player.floor||1)+1; derivePlayer(); state.player.hp = Math.min(state.player.maxHp, state.player.hp + 10); state.player.mp = Math.min(state.player.maxMp, state.player.mp + 6); state.stats.floors = Math.max(state.stats.floors, state.player.floor); // town after every 3 floors
  cineShow(`⬇️ Descend to Floor ${state.player.floor}...`,900).then(()=>{ log('Descended to floor '+state.player.floor); if(state.player.floor % 3 === 0) enterTown(); fullSave(); renderAll(); }); }

/* ---------- monster gen & combat ---------- */
function getAdjustedWeights(floor){ const w=Object.assign({},rarityWeightsBase); if(floor>4){ w.Rare+=5; w.Uncommon-=3; } if(floor>8){ w.Epic+=3; w.Rare+=3; w.Common-=5;} if(floor>14){ w.Legendary+=1; w.Epic+=2; w.Common-=4;} Object.keys(w).forEach(k=>{ if(w[k]<1) w[k]=1; }); return w; }
function getRandomMonsterForFloor(floor){ const weights=getAdjustedWeights(floor); const rarity=weightedChoice(weights); const pool=MONSTERS[rarity]||MONSTERS.Common; const template=rChoice(pool); const mult = ({Common:1,Uncommon:1.15,Rare:1.3,Epic:1.6,Legendary:2})[rarity]||1; const hp=Math.max(1, Math.round((template.hp||10) + floor*2) * mult); const atk=Math.max(1, Math.round((template.atk||2) + Math.floor(floor/2))); const def=Math.max(0, Math.round((template.def||0) + Math.floor(floor/4))); const xp=Math.max(1, Math.round((template.xp||5)*mult)); const gold=Math.max(0, Math.round((template.gold||3)*mult)); return Object.assign({}, template, {hp,atk,def,xp,gold,rarity}); }

function startMonster(){ const floor=state.player.floor||1; const enemy = getRandomMonsterForFloor(floor); state.currentEnemy = {...enemy, currentHp: enemy.hp, status:[], isBoss:false}; state.inCombat=true; log(`⚔️ ${enemy.rarity} ${enemy.name} appears!`); fullSave(); renderAll(); }
function startBoss(){ const floor=state.player.floor||1; const tpl = rChoice(BOSSES); const boss = JSON.parse(JSON.stringify(tpl)); boss.currentHp = boss.hp + floor*4; boss.status=[]; boss.isBoss=true; state.currentEnemy = boss; state.inCombat=true; cineShow(`🔥 Boss: ${boss.name} emerges!`,1200).then(()=>{ log('Boss: '+boss.name); fullSave(); renderAll(); }); }

/* ---------- combat actions ---------- */
function playerAttack(){ if(!state.inCombat || !state.currentEnemy) return; derivePlayer(); const p=state.player; const atk = p.attack || 0; const roll = rInt(1,6); const dmg = Math.max(1, roll + atk - Math.floor((state.currentEnemy.def||0)/2)); state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - dmg); showHitText(`-${dmg}`,'hit'); log(`⚔️ You attack for ${dmg}`); if(state.currentEnemy.currentHp<=0) return onVictory(); enemyTurn(); fullSave(); renderAll(); }

function showSkillMenu(){ $('skillMenu').classList.remove('hidden'); renderSkillButtons(); }
function hideSkillMenu(){ $('skillMenu').classList.add('hidden'); }
function useSkill(skillId){ if(!state.inCombat || !state.currentEnemy) return; const p=state.player; if(skillId==='Power Slash'){ const dmg=Math.max(1, Math.round(p.attack*1.5)); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); log(`Power Slash deals ${dmg}`); showHitText(`-${dmg}`,'hit'); } else if(skillId==='Backstab'){ const dmg=Math.max(1,p.attack*2); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); log(`Backstab deals ${dmg}`); showHitText(`-${dmg}`,'hit'); } else if(skillId==='Fireball'){ const dmg=10 + Math.floor(p.mag/2); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-dmg); log(`Fireball ${dmg}`); showHitText(`-${dmg}`,'fire'); } hideSkillMenu(); if(state.currentEnemy.currentHp<=0) return onVictory(); enemyTurn(); fullSave(); renderAll(); }

function showSpellMenu(){ $('spellMenu').classList.remove('hidden'); renderSpellButtons(); }
function hideSpellMenu(){ $('spellMenu').classList.add('hidden'); }
function castSpell(spell){ if(!state.inCombat || !state.currentEnemy) return; const costMap={'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Voidstrike':7}; const cost = costMap[spell]||3; if(state.player.mp < cost){ log('Not enough MP'); return; } state.player.mp -= cost; if(spell==='Firebolt'){ const d=5 + state.player.floor; state.currentEnemy.currentHp = Math.max(0, state.currentEnemy.currentHp - d); log(`🔥 Firebolt ${d}`); showHitText(`-${d}`,'fire'); } else if(spell==='Ice Shard'){ const d=4 + Math.floor(state.player.mag/3); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-d); if(rnd()<0.25) applyStatus(state.currentEnemy,'freeze',1); log(`❄️ Ice ${d}`); showHitText(`-${d}`,'ice'); } else if(spell==='Heal'){ const h=6 + Math.floor(state.player.mag/3); state.player.hp=Math.min(state.player.maxHp, state.player.hp + h); log(`💚 Healed ${h}`); showHitText(`+${h}`,'heal'); } else if(spell==='Voidstrike'){ const d=12 + Math.floor(state.player.mag/2); state.currentEnemy.currentHp=Math.max(0,state.currentEnemy.currentHp-d); log(`Voidstrike ${d}`); showHitText(`-${d}`,'arcane'); } hideSpellMenu(); if(state.currentEnemy.currentHp<=0) return onVictory(); enemyTurn(); fullSave(); renderAll(); }

function useItemCombat(){ const p=state.player; if(p.potions>0){ p.potions--; const heal=rInt(6,12); p.hp=Math.min(p.maxHp,p.hp+heal); log(`🧴 Potion +${heal}`); showHitText(`+${heal}`,'heal'); } else if(p.ethers>0){ p.ethers--; const m=rInt(4,8); p.mp=Math.min(p.maxMp,p.mp+m); log(`🔮 Ether +${m}`); showHitText(`+${m} MP`,'mp'); } else log('No items'); enemyTurn(); fullSave(); renderAll(); }
function attemptRun(){ if(!state.inCombat) return; if(rnd()<0.5){ log('🏃 You escape'); state.inCombat=false; state.currentEnemy=null; renderAll(); fullSave(); } else { log('✋ Escape failed'); enemyTurn(); fullSave(); } }

/* ---------- statuses ---------- */
function applyStatus(target, key, duration=2){ target.status = target.status || []; if(!target.status.find(s=>s.k===key)) target.status.push({k:key,t:duration}); }
function tickStatus(entity){ if(!entity || !entity.status) return; const rem=[]; for(const s of entity.status){ if(s.k==='burn'){ entity.currentHp = Math.max(0, entity.currentHp - 2); log(`${entity.name} suffers burn`); } if(s.k==='poison'){ entity.currentHp = Math.max(0, entity.currentHp - 3); log(`${entity.name} suffers poison`); } s.t--; if(s.t>0) rem.push(s); } entity.status = rem; }

/* ---------- enemy turn & behaviors ---------- */
function enemyTurn(){ if(!state.currentEnemy) return; tickStatus(state.currentEnemy); if(state.currentEnemy.currentHp<=0) return onVictory(); const e = state.currentEnemy; const p = state.player; // simple AI with elites and bosses special
  let dmg = Math.max(1, (e.atk||2) + rInt(-1,1) - (p.defense||0) - (p.tempDef||0));
  p.tempDef = 0;
  // boss phase triggers
  if(e.isBoss && e.phases){
    for(const ph of e.phases){ if(e.currentHp <= Math.round((ph.hpPct||0)*e.hp) && !ph.triggered){ ph.triggered=true; log(`${e.name} uses ${ph.action}!`); if(ph.action.includes('Summon')){ // spawn adds (simple)
      log('Shades join the battle!'); } if(ph.action.includes('Enrage')){ e.atk += 4; } } }
  }
  p.hp = Math.max(0, p.hp - dmg);
  showHitText(`-${dmg}`,'hurt'); log(`💥 ${e.name} hits for ${dmg}`);
  tickStatus(p);
  if(p.hp<=0){ log('💀 You died. Run ends.'); onRunEnd(); }
}

/* ---------- victory & drops ---------- */
function onVictory(){ const e=state.currentEnemy; const isBoss=!!e && !!e.isBoss; const goldGain = Math.max(1, Math.round(((e.gold||5) + (state.player.floor||1)*2) * (state.goldMult||1))); state.player.gold = (state.player.gold||0) + goldGain; log(`🏆 Defeated ${e.name}! +${goldGain} gold.`); state.stats.kills = (state.stats.kills||0) + 1; if(isBoss) state.stats.bosses = (state.stats.bosses||0) + 1; // loot
  const drop = generateLootForEnemy(e.rarity || 'Common', state.player.floor || 1);
  if(drop){ if(drop.type==='relic'){ state.relics.push({name:drop.name}); state.stats.relics++; log(`🎁 Relic: ${drop.name}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(drop); log(`🎁 Item: ${drop.rarity} ${drop.name}`); } } else { if(rnd()<0.25){ state.player.potions=(state.player.potions||0)+1; log('🧴 Found a potion'); } }
  const xpGain = Math.max(1, Math.round((e.xp||5) * ({Common:1,Uncommon:1.25,Rare:1.5,Epic:2,Legendary:3})[e.rarity||'Common'])); state.player.xp = (state.player.xp||0) + xpGain; checkLevel(); state.currentEnemy=null; state.inCombat=false; derivePlayer(); fullSave(); renderAll(); }

/* ---------- loot generation ---------- */
const rarityOrder = ['Common','Uncommon','Rare','Epic','Legendary'];
function weightedRarityRoll(baseRarity,bias=0){
  const idx = Math.max(0, rarityOrder.indexOf(baseRarity||'Common'));
  const weights={}; for(let i=0;i<rarityOrder.length;i++){ const dist = i-idx; let w=0; if(dist<=0) w = 50 - (Math.abs(dist)*12); else w = Math.max(1, 6 - dist*2); if(bias>0 && i>=idx) w += bias*(i-idx+1); weights[rarityOrder[i]] = Math.max(1,w); } return weightedChoice(weights);
}
function generateLootForEnemy(enemyRarity,floor){
  const categories=['weapon','armor','relic']; const category=rChoice(categories); const bias=Math.floor(Math.max(0,floor/6)); const chosenRarity = weightedRarityRoll(enemyRarity,bias);
  let pool = []; if(category==='weapon') pool = WEAPONS[chosenRarity]||WEAPONS.Common; else if(category==='armor') pool = ARMOR[chosenRarity]||ARMOR.Common; else pool = RELICS[chosenRarity]||RELICS.Common; const item = rChoice(pool); if(!item) return null; return Object.assign({type:category,rarity:chosenRarity},item);
}

/* ---------- leveling & skills ---------- */
function checkLevel(){ const p=state.player; if(!p) return; const xpTo = 8 + p.level * 6; while(p.xp >= xpTo){ p.xp -= xpTo; p.level++; log(`⬆️ Level ${p.level}`); // present two choices (via prompt for simplicity)
    const choices = CLASS_DATA[p.classKey].skills.find(s=>s.level===p.level);
    if(choices){ const a=choices.choices[0], b=choices.choices[1]; const pick = prompt(`Level ${p.level}! Choose:\n1) ${a.label}\n2) ${b.label}`,'1'); const sel = pick==='2'?b:a; // apply
      applySkillChoice(p, sel); log(`Skill acquired: ${sel.label}`); } derivePlayer(); fullSave(); } }

function applySkillChoice(player, choice){
  if(!choice) return;
  if(choice.id==='hp+5') player.baseHp += 5;
  if(choice.id==='atk+1') player.baseAtk += 1;
  if(choice.id==='crit+5') player.crit = (player.crit||0) + 5;
  if(choice.id==='mp+5') player.mp +=5;
  if(choice.id==='mag+1') player.mag +=1;
  if(choice.id==='shield_bash') player.skills = (player.skills||[]).concat('Shield Bash');
  if(choice.id==='arcane_surge') player.spellBoost = (player.spellBoost||0) + 0.20;
  if(choice.id==='poison_edge') player.poisonOnHit = true;
}

/* ---------- chest / shop / events / town ---------- */
function openChest(){ if(!state.player) return; if(rnd() < 0.55){ const drop = generateLootForEnemy('Common', state.player.floor||1); if(drop.type==='relic'){ state.relics.push({name:drop.name}); state.stats.relics++; log(`🎁 Chest: Relic ${drop.name}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(drop); log(`🎁 Chest: Item ${drop.rarity} ${drop.name}`); } } else { const g = rInt(6,26) + (state.player.floor||1)*2; state.player.gold = (state.player.gold||0) + Math.round(g * (state.goldMult||1)); log(`💰 Chest: +${Math.round(g * (state.goldMult||1))} gold.`); } fullSave(); renderAll(); }

let lastShop = [];
function openShop(){ if(state.inCombat){ log('Cannot shop during combat'); return; } const pool = equipmentPoolPreview(); lastShop = []; for(let i=0;i<3;i++) lastShop.push(rChoice(pool)); lastShop.push({ baseName:'Potion', type:'consumable', nameHtml:'Potion', cost:5, heal:8, sprite:'potion'}); lastShop.push({ baseName:'Ether', type:'consumable', nameHtml:'Ether', cost:5, mana:6, sprite:'potion'}); let html = `<div class="small">Merchant's Wares</div><div class="shop-list" style="margin-top:8px">`; lastShop.forEach((it,idx)=>{ const icon = getItemIcon(it); html += `<div class="item-row"><div class="item-cell"><span class="item-icon" data-rarity="${it.rarity||'Common'}"><img src="${icon}" alt="${it.baseName||it.name}" /></span><div>${it.nameHtml || it.baseName || it.name}${it.rarity?` <span class="small muted">(${it.rarity})</span>`:''}</div><div class="tooltip small muted">Cost: ${it.cost || 0}g</div></div><div><span class="small">${it.cost||5}g</span> <button class="secondary" onclick="buy(${idx})">Buy</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; log('🏪 Merchant appears'); fullSave(); }

function buy(idx){ const it = lastShop[idx]; if(!it) return; if(!state.player){ log('Start run first'); return; } if(state.player.gold < (it.cost||5)){ log('Not enough gold'); return; } state.player.gold -= (it.cost||5); if(it.type==='consumable'){ if(it.baseName==='Potion') state.player.potions=(state.player.potions||0)+1; else if(it.baseName==='Ether') state.player.ethers=(state.player.ethers||0)+1; log(`Bought ${it.baseName}`); } else { state.player.inventory = state.player.inventory||[]; state.player.inventory.push(it); log(`Bought ${it.rarity||''} ${it.baseName||it.name}`); } fullSave(); renderAll(); }
function closeShopPanel(){ $('shopPanel').innerHTML = `<div class="small">Shop & events appear while exploring.</div>`; renderAll(); }

function equipmentPoolPreview(){ const pool=[]; Object.keys(WEAPONS).forEach(r=> WEAPONS[r].forEach(i=> pool.push(Object.assign({rarity:r,type:'weapon'}, i)))); Object.keys(ARMOR).forEach(r=> ARMOR[r].forEach(i=> pool.push(Object.assign({rarity:r,type:'armor'}, i)))); return pool; }

/* events (short set) */
const EVENTS = [
  { id:'whisper_door', text:'A door hums with whispers. Speak your name or remain silent?', choices:[ {label:'Speak', func:s=>{ s.player.xp=(s.player.xp||0)+5; s.player.hp=Math.max(1,s.player.hp-5); addJournal('You whispered to the Door — a fragment answered.'); log('+5 XP, -5 HP'); } }, {label:'Silent', func:s=>{ if(rnd()<0.35){ const r=rChoice(Object.values(RELICS).flat()); s.relics.push({name:r.name}); addJournal('Silence rewarded with a relic.'); log(`Silence: ${r.name}`); } else log('Nothing happened'); } } ] },
  { id:'cursed_fountain', text:'A cursed fountain bubbles. Drink to heal but risk a curse?', choices:[ {label:'Drink', func:s=>{ if(rnd()<0.5){ s.player.hp=Math.min(maxHpLocal(), s.player.hp+12); addJournal('Fountain healed you'); log('Healed by fountain'); } else { applyStatus(s.player,'poison',3); addJournal('Fountain cursed you'); log('Poisoned by fountain'); } } }, {label:'Pass', func:s=>{ addJournal('You pass the fountain'); log('Passed fountain'); } } ] }
];

function runEvent(){ if(!state.player) return; const ev=rChoice(EVENTS); log('❓ Event: '+ev.text); let html=`<div class="small">${ev.text}</div><div class="shop-list" style="margin-top:8px">`; ev.choices.forEach((c, idx)=>{ html += `<div class="item-row"><div>${c.label}</div><div><button class="secondary" onclick="chooseEvent(${idx})">Choose</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; window.chooseEvent = function(idx){ ev.choices[idx].func(state); renderAll(); fullSave(); closeShopPanel(); }; }

/* ---------- inventory & equip ---------- */
function openInventory(){ if(!state.player) return; if(state.inCombat){ log('Finish combat first'); return; } const inv = state.player.inventory || []; let html = `<div class="small">Inventory</div><div class="inv-list">`; if(inv.length===0) html += `<div class="small">— empty —</div>`; inv.forEach((it, idx)=>{ const stats = `${it.effect?(it.effect.atk?`ATK+${it.effect.atk} `:'')+(it.effect.def?`DEF+${it.effect.def} `:''):''}`; const icon = getItemIcon(it); html+= `<div class="item-row"><div class="item-cell"><span class="item-icon" data-rarity="${it.rarity||'Common'}"><img src="${icon}" alt="${it.baseName||it.name}" /></span><div>${it.nameHtml || it.baseName || it.name}<div class="small muted">${stats}</div></div><div class="tooltip small muted">Equip / Inspect</div></div><div><button class="secondary" onclick="equipItem(${idx})">Equip</button> <button class="secondary" onclick="inspectItem(${idx})">Inspect</button></div></div>`; }); html += `</div><div style="margin-top:8px"><button class="secondary" onclick="closeShopPanel()">Close</button></div>`; $('shopPanel').innerHTML = html; }

function equipItem(idx){ const it = state.player.inventory[idx]; if(!it) return; if(!['weapon','armor','accessory'].includes(it.type) && !['weapon','armor'].includes(it.type)){ log('Not equippable'); return; } const slot = (it.type==='weapon')?'weapon':(it.type==='armor'?'armor':'accessory'); if(state.player.equip[slot]){ state.player.inventory.push(state.player.equip[slot]); log(`Unequipped ${state.player.equip[slot].baseName || state.player.equip[slot].name}`); } state.player.equip[slot]=it; state.player.inventory.splice(idx,1); log(`🛡️ Equipped ${it.rarity || ''} ${it.baseName || it.name}`); derivePlayer(); fullSave(); renderAll(); }
function inspectItem(idx){ const it = state.player.inventory[idx]; if(it) alert(`${it.rarity || 'Common'} ${it.baseName || it.name}\n${it.effect?Object.entries(it.effect).map(e=> `${e[0]}:${e[1]}`).join('\n'):''}\nValue:${it.cost||0}g`); }

/* ---------- helpers ---------- */
function maxHpLocal(){ return (state.player?.baseHp||0) + (state.player?.equip?.armor?.effect?.hp||0) + (state.player?.equip?.accessory?.effect?.hp||0); }
function totalDefLocal(){ return (state.player?.baseDef||0) + (state.player?.equip?.armor?.effect?.def||0); }

/* ---------- icon rendering small (dataURL placeholders) ---------- */
const ICON_CACHE = {};
function renderSpriteToDataURL(name, scale=3){
  // Very small procedural placeholders (fallback)
  const canvas = document.createElement('canvas'); canvas.width=8*scale; canvas.height=8*scale;
  const ctx = canvas.getContext('2d'); ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#8a0033'; ctx.fillRect(1*scale,1*scale,6*scale,6*scale);
  ctx.fillStyle='#fff'; ctx.fillText(name[0]||'?',2*scale,5*scale);
  return canvas.toDataURL();
}
function getItemIcon(item){
  const key = item.id || item.baseName || item.name || JSON.stringify(item);
  if(ICON_CACHE[key]) return ICON_CACHE[key];
  const spriteName = item.sprite || 'potion';
  const url = renderSpriteToDataURL(spriteName,3);
  ICON_CACHE[key] = url;
  return url;
}

/* ---------- monster sprite element ---------- */
function createMonsterSpriteEl(spriteKey){
  const el = document.createElement('div'); el.className='monster-sprite';
  const pos = monsterSprites[spriteKey] || '0 0'; el.style.backgroundPosition = pos;
  return el;
}

/* ---------- UI render ---------- */
function renderRelicsUI(){ const el=$('relicRow'); if(!el) return; el.innerHTML=''; const combined = (state.relics||[]).concat(state.legacyRelics||[]); if(combined.length===0){ el.innerText='Relics: —'; return; } for(const r of combined){ const pill=document.createElement('div'); pill.className='relic-pill'; pill.innerText = (r.name||r.id); el.appendChild(pill); } }

function renderJournal(){ const el=$('journalContent'); if(!el) return; el.innerHTML=''; const j=state.journal||[]; if(j.length===0) el.innerHTML=`<div class="small muted">— No entries yet —</div>`; j.forEach(entry=>{ const d = new Date(entry.time).toLocaleString(); el.innerHTML += `<div style="margin-bottom:8px"><div class="small muted">${d}</div><div>${entry.text}</div></div>`; }); }

function addJournal(text){ state.journal = state.journal || []; state.journal.push({time:Date.now(),text}); fullSave(); }

function renderMeta(){ const el=$('metaContent'); if(!el) return; const offers = [ {id:'hp_boost',name:'Vital Essence',cost:6,desc:'+5 Max HP permanently'}, {id:'loot_boost',name:'Lucky Soul',cost:10,desc:'+5% rare drop chance'} ]; let html=`<div class="small">Fragments: <strong>${state.meta.fragments||0}</strong></div><div style="margin-top:8px">`; offers.forEach((o,idx)=> html += `<div class="item-row"><div><strong>${o.name}</strong><div class="small muted">${o.desc}</div></div><div><button class="secondary" onclick="buyMeta(${idx})">Buy (${o.cost})</button></div></div>`); html+=`</div>`; el.innerHTML = html; }

function buyMeta(idx){ const offers=[{id:'hp_boost',name:'Vital Essence',cost:6,apply:()=>{ state.meta.upgrades.push('hp_boost'); state.player && (state.player.baseHp += 5); }},{id:'loot_boost',name:'Lucky Soul',cost:10,apply:()=>{ state.meta.upgrades.push('loot_boost'); /* store effect for loot gen usage */ }}]; const o=offers[idx]; if(!o) return; if(state.meta.fragments < o.cost){ alert('Not enough fragments'); return; } state.meta.fragments -= o.cost; o.apply(); fullSave(); renderMeta(); renderAll(); log('Meta purchased: '+o.name); }

/* ---------- town ---------- */
function enterTown(){ $('townModal').classList.remove('hidden'); $('townModal').setAttribute('aria-hidden','false'); const html = `<div class="small">You enter The Hollow Village — a safe respite.</div><div style="margin-top:8px"><div class="item-row"><div><strong>Inn</strong><div class="small muted">Heal fully for 8g</div></div><div><button class="secondary" onclick="useInn()">Rest (8g)</button></div></div><div class="item-row"><div><strong>Shop</strong><div class="small muted">Buy gear & consumables</div></div><div><button class="secondary" onclick="openShop()">Visit</button></div></div><div class="item-row"><div><strong>Forge</strong><div class="small muted">Upgrade equipment (1 upgrade per visit)</div></div><div><button class="secondary" onclick="openForge()">Forge</button></div></div><div class="item-row"><div><strong>Shrine</strong><div class="small muted">Reroll a relic or respec class</div></div><div><button class="secondary" onclick="openShrine()">Shrine</button></div></div></div>`; $('townContent').innerHTML = html; }

function useInn(){ if(state.player.gold < 8){ alert('Not enough gold'); return; } state.player.gold -= 8; state.player.hp = state.player.maxHp; state.player.mp = state.player.maxMp; log('You rest at the inn — fully healed'); renderAll(); fullSave(); }
function openForge(){ // simple: improve random equipped weapon if present
  if(!state.player.equip.weapon){ alert('Equip a weapon to upgrade'); return; } state.player.equip.weapon.effect.atk = (state.player.equip.weapon.effect.atk||0) + 1; log('Forged weapon: +1 ATK'); renderAll(); fullSave(); }
function openShrine(){ const pick = prompt('Shrine: 1) Reroll relic (cost 2g) 2) Respec skills (cost 4g)','1'); if(pick==='1'){ if(state.player.gold<2){ alert('Not enough gold'); return; } state.player.gold -= 2; if(state.relics.length>0){ const r = state.relics.pop(); const newRel = rChoice(Object.values(RELICS).flat()); state.relics.push({name:newRel.name}); log('Rerolled relic'); } else log('No relic to reroll'); } else if(pick==='2'){ if(state.player.gold<4){ alert('Not enough gold'); return; } state.player.gold -= 4; state.player.skills = []; log('You respec your skills'); } renderAll(); fullSave(); }

/* ---------- achievements ---------- */
const ACHIEVEMENTS = [
  {id:'slayer',name:'Monster Slayer',cond:()=> state.stats.kills>=100},
  {id:'collector',name:'Relic Collector',cond:()=> state.stats.relics>=10},
  {id:'deep',name:'Deep Delver',cond:()=> state.stats.floors>=10},
  {id:'bosskiller',name:'Boss Killer',cond:()=> state.stats.bosses>=1}
];
function checkAchievements(){ ACHIEVEMENTS.forEach(a=>{ if(a.cond() && !state.achievements[a.id]){ state.achievements[a.id]=true; showAchievement(a.name); fullSave(); } }); }
function showAchievement(name){ alert(`🏆 Achievement Unlocked: ${name}`); log(`Achievement: ${name}`); }
function renderAchievements(){ const el=$('achContent'); if(!el) return; let html=''; ACHIEVEMENTS.forEach(a=> html+=`<div class="item-row"><div><strong>${a.name}</strong></div><div>${state.achievements[a.id] ? '<span class="small muted">Unlocked</span>' : '<span class="small muted">Locked</span>'}</div></div>`); el.innerHTML = html; }

/* ---------- end run & record ---------- */
function onRunEnd(){ const floors = state.player?.floor || 1; const fragments = Math.max(1,Math.floor(floors/2)); state.meta.fragments = (state.meta.fragments||0) + fragments; const entry = {floor:floors,gold:state.player?.gold||0,class:state.player?.classKey||'Unknown',seed:state.seed}; const lb = JSON.parse(localStorage.getItem(LEADER_KEY)||'[]'); lb.push(entry); localStorage.setItem(LEADER_KEY, JSON.stringify(lb)); state.player=null; state.floorMap={}; state.currentEnemy=null; state.inCombat=false; log(`Run ended. Fragments earned: ${fragments}`); fullSave(); renderAll(); }

/* ---------- float text ---------- */
function showHitText(text, cls='hit'){ const area=$('battleArea'); const el=document.createElement('div'); el.className=`floating ${cls}`; el.innerText=text; el.style.position='relative'; area.appendChild(el); setTimeout(()=>el.remove(),900); }

/* ---------- UI bindings ---------- */
function renderSpellButtons(){ const container=$('spellRow'); if(!container) return; container.innerHTML=''; if(!state.player) return; const spells = state.player.spells||[]; const costMap={'Firebolt':3,'Ice Shard':4,'Heal':4,'Lightning Strike':5,'Shield':3,'Voidstrike':7}; spells.forEach(s=>{ const b=document.createElement('button'); b.className='secondary'; const cost = costMap[s]||3; b.textContent = `${s} (${cost})`; b.onclick=()=>{ castSpell(s); $('spellMenu').classList.add('hidden'); }; container.appendChild(b); }); }
function renderSkillButtons(){ const container=$('skillRow'); if(!container) return; container.innerHTML=''; if(!state.player) return; const skills = state.player.skills||[]; // player's acquired skills
  const classAbility = CLASS_DATA[state.player.classKey].ability; const btn = document.createElement('button'); btn.className='secondary'; btn.textContent = `${classAbility.id}`; btn.onclick = ()=> useSkill(classAbility.id); container.appendChild(btn); skills.forEach(s=>{ const b=document.createElement('button'); b.className='secondary'; b.textContent = s; b.onclick = ()=> useSkill(s); container.appendChild(b); }); }

/* ---------- UI wiring ---------- */
function wireUI(){
  $('btnNew').addEventListener('click', ()=>{ const cls = prompt('New run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls || !CLASS_DATA[cls]){ alert('Invalid'); return; } const s = prompt('Enter seed (or leave blank for random)',''); const seed = s||String(Math.floor(Math.random()*900000+100000)); newRun(cls, seed, false); });
  $('btnReset').addEventListener('click', resetAll);
  $('btnEnterRoom').addEventListener('click', enterRoom);
  $('btnShop').addEventListener('click', openShop);
  $('btnRest').addEventListener('click', ()=>{ if(!state.player){ alert('Start run first'); return; } if(state.player.gold < 5){ log('Not enough gold to rest'); return; } state.player.gold -= 5; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 12); state.player.mp = Math.min(state.player.maxMp, state.player.mp + 6); log('You rest (5g)'); renderAll(); fullSave(); });
  $('btnInventory').addEventListener('click', openInventory);
  $('btnJournal').addEventListener('click', ()=>{ $('journalModal').classList.remove('hidden'); $('journalModal').setAttribute('aria-hidden','false'); renderJournal(); });
  $('btnAchievements').addEventListener('click', ()=>{ $('achievementsModal').classList.remove('hidden'); $('achievementsModal').setAttribute('aria-hidden','false'); renderAchievements(); });
  $('btnExport').addEventListener('click', ()=>{ const txt=$('log').innerText; const blob=new Blob([txt],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`epic_log_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); });
  $('btnAttack').addEventListener('click', playerAttack);
  $('btnSkill').addEventListener('click', ()=>{ $('skillMenu').classList.toggle('hidden'); renderSkillButtons(); });
  $('btnSpell').addEventListener('click', ()=>{ $('spellMenu').classList.toggle('hidden'); renderSpellButtons(); });
  $('btnItem').addEventListener('click', useItemCombat);
  $('btnRun').addEventListener('click', ()=>{ if(confirm('Attempt to flee?')) attemptRun(); });
  $('btnSkillBack').addEventListener('click', ()=> $('skillMenu').classList.add('hidden'));
  $('btnSpellBack').addEventListener('click', ()=> $('spellMenu').classList.add('hidden'));
  $('btnMeta').addEventListener('click', ()=>{ $('metaModal').classList.remove('hidden'); $('metaModal').setAttribute('aria-hidden','false'); renderMeta(); });
  $('btnDaily').addEventListener('click', ()=>{ const seed=generateDailySeedForDate(new Date()); const cls = prompt('Daily run — choose class: Warrior, Mage, Rogue','Warrior'); if(!cls||!CLASS_DATA[cls]){ alert('Invalid'); return; } newRun(cls, seed, true); });
  $('btnCredits').addEventListener('click', ()=>{ $('creditsModal').classList.remove('hidden'); $('creditsModal').setAttribute('aria-hidden','false'); });
  $('closeCredits').addEventListener('click', ()=>{ $('creditsModal').classList.add('hidden'); $('creditsModal').setAttribute('aria-hidden','true'); });
  $('btnCopySeed')?.addEventListener('click', ()=>{ navigator.clipboard.writeText(location.href.split('?')[0] + '?seed=' + encodeURIComponent(state.seed)).then(()=> alert('Seed link copied')); });
  window.closeMeta = ()=>{ $('metaModal').classList.add('hidden'); $('metaModal').setAttribute('aria-hidden','true'); };
  window.closeJournal = ()=>{ $('journalModal').classList.add('hidden'); $('journalModal').setAttribute('aria-hidden','true'); };
  window.closeAchievements = ()=>{ $('achievementsModal').classList.add('hidden'); $('achievementsModal').setAttribute('aria-hidden','true'); };
  $('btnLeaveTown').addEventListener('click', ()=>{ $('townModal').classList.add('hidden'); $('townModal').setAttribute('aria-hidden','true'); renderAll(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ ['metaModal','journalModal','achievementsModal','creditsModal','townModal'].forEach(id=>{ const el=$(id); if(el && !el.classList.contains('hidden')){ el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); } }); }});
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
    $('slotWeapon').innerHTML = state.player.equip?.weapon ? (state.player.equip.weapon.baseName || state.player.equip.weapon.name) : 'None';
    $('slotArmor').innerHTML = state.player.equip?.armor ? (state.player.equip.armor.baseName || state.player.equip.armor.name) : 'None';
    $('slotAccessory').innerHTML = state.player.equip?.accessory ? (state.player.equip.accessory.baseName || state.player.equip.accessory.name) : 'None';
    $('invSummary').innerText = `Potions: ${state.player.potions||0} • Ethers: ${state.player.ethers||0} • Items: ${(state.player.inventory||[]).length}`;
  } else {
    $('playerName').innerText = '—';
  }

  if(state.inCombat && state.currentEnemy){
    $('combatUI').classList.remove('hidden');
    $('enemyName').innerText = `${state.currentEnemy.rarity || 'Common'} ${state.currentEnemy.name}`;
    $('enemyHP').innerText = Math.max(0, state.currentEnemy.currentHp||0);
    $('enemyATK').innerText = state.currentEnemy.atk||0;
    $('enemyStatus').innerText = (state.currentEnemy.status && state.currentEnemy.status.length)? state.currentEnemy.status.map(s=>s.k).join(','): '—';
    $('encounterTitle').innerText = state.currentEnemy.name;
    $('encounterText').innerText = state.currentEnemy.isBoss ? 'Boss battle — focus and survive.' : 'Battle — choose your action.';
    const ba = $('battleArea'); ba.innerHTML = '';
    const spr = createMonsterSpriteEl(state.currentEnemy.sprite || 'rat');
    ba.appendChild(spr);
    const name = document.createElement('div'); name.className = `enemy ${state.currentEnemy.rarity||'Common'}`; name.innerText = `${state.currentEnemy.rarity||'Common'} • ${state.currentEnemy.name}`; ba.appendChild(name);
  } else {
    $('combatUI').classList.add('hidden');
    $('encounterTitle').innerText = state.player ? `Floor ${state.player.floor}` : 'Welcome';
    $('encounterText').innerText = 'Explore rooms, fight monsters, collect relics.';
    $('battleArea').innerHTML = '';
  }

  renderRelicsUI();
  renderJournal();
  renderMeta();
  if($('fragments')) $('fragments').innerText = state.meta.fragments||0;
  if($('seedDisplay')) $('seedDisplay').innerText = state.seed||'—';
  checkAchievements();
  fullSave();
}

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

// expose some helpers for console
window.getItemIcon = getItemIcon;
