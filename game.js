/* Notebook RPG — Full Stage A + B
   Features:
   - Enchantments, merchant, consumables
   - Aces currency (display-only)
   - Animated XP & Aces popups, particles
   - Parallax backgrounds per zone
   - Enchanted item rune overlays
   - Status effects (both player & monsters)
   - Summons / Companions
   - Daily rewards & streaks
   - Offline progression (generous: 1h => ~5 battles)
   - Persistence (localStorage)
*/
(() => {
  /* =====================
     Config & Data
     ===================== */
  const SAVE_KEY = "notebookrpg_full_v1";
  const RARITIES = ["Common","Uncommon","Rare","Super Rare","Epic","Most Def Epic","Powerful","Legendary","Mythic"];
  const BASE_RARITY_WEIGHTS = {"Common":500,"Uncommon":220,"Rare":120,"Super Rare":60,"Epic":30,"Most Def Epic":10,"Powerful":6,"Legendary":3,"Mythic":1};
  const MONSTER_TEMPLATES = [{id:"slime",name:"Slime"},{id:"goblin",name:"Goblin"},{id:"wolf",name:"Dire Wolf"},{id:"skeleton",name:"Skeleton"},{id:"mage",name:"Wandering Mage"},{id:"ogre",name:"Ogre"},{id:"wyrm",name:"Wyrm"},{id:"lich",name:"Lich"}];
  const ZONES = [
    {name:"Forest",monsterBoost:0, bg:{back:'#082016',mid:'#103027',front:'#163030'}},
    {name:"Cave",monsterBoost:1, bg:{back:'#101015',mid:'#11131b',front:'#16161a'}},
    {name:"Ruins",monsterBoost:2, bg:{back:'#1b1417',mid:'#24161a',front:'#2a1f24'}},
    {name:"Volcano",monsterBoost:3, bg:{back:'#2a0d06',mid:'#3b120a',front:'#5b1d0f'}},
    {name:"Abyss",monsterBoost:4, bg:{back:'#071024',mid:'#081232',front:'#0b1733'}}
  ];
  const MONSTERS_PER_ZONE = 6;
  const BOSS_EVERY = 10;
  const ACE_VALUES = {clubs:10, diamonds:25, hearts:50, spades:100};
  const COMPANION_POOL = [
    {id:"fire_sprite",name:"Fire Sprite",desc:"Burns enemies (DoT) every 3 turns",trigger:3,ability:"burn",power:6,cost:80},
    {id:"shield_familiar",name:"Shield Familiar",desc:"Blocks damage every 4 turns",trigger:4,ability:"shield",power:0.25,cost:100},
    {id:"ace_golem",name:"Ace Golem",desc:"Deals damage scaling with your Aces",trigger:2,ability:"ace_power",power:0,cost:150}
  ];
  const STATUS_TYPES = ["Poison","Burn","Freeze","Stun","Bleed","Regen"];

  /* =====================
     Utilities
     ===================== */
  const randInt = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function chooseWeighted(weights){
    const entries = Object.entries(weights);
    const total = entries.reduce((s,[_,w])=>s+w,0); let r = Math.random()*total;
    for(const [k,w] of entries){ if(r < w) return k; r -= w; } return entries[entries.length-1][0];
  }
  function nowMs(){ return Date.now(); }
  function rarityClass(r){ return r? r.toLowerCase().replace(/\s+/g,'-'):''; }
  function rollChance(pct){ return Math.random()*100 < pct; }

  /* =====================
     Persistence: load or default state
     ===================== */
  function tryLoad(){ try{ const raw = localStorage.getItem(SAVE_KEY); if(!raw) return null; return JSON.parse(raw); } catch(e){ console.warn("Load failed", e); return null; } }
  const loaded = tryLoad();
  const state = loaded || {
    player: { level:1, xp:0, xpToNext: xpForLevel(1), baseMaxHp:120, maxHp:120, hp:120, baseAttack:16, attack:16, crit:5, dodge:3, specialCooldown:0, skillPoints:0, skills:{attack:0,defense:0,luck:0}, _tempBuff:null },
    equipment:{}, loot:[], currentMonster:null, monsterQueue:[], zoneIndex:0, monstersClearedInZone:0, totalMonstersDefeated:0,
    aces:{clubs:0,diamonds:0,hearts:0,spades:0}, merchant:{inventory:[]},
    enchantments:{}, companions:[], companionLibrary:[], statusEffects:{player:[], monster:{}},
    daily:{lastLogin: null, streak: 0, lastClaim: null}, lastActive: nowMs(), lastSaved: nowMs()
  };

  /* =====================
     XP curve
     ===================== */
  function xpForLevel(level){ return Math.max(50, Math.floor(120 * Math.pow(level, 1.6))); }

  /* =====================
     DOM refs
     ===================== */
  const refs = {
    bgBack: document.getElementById("bg-back"),
    bgMid: document.getElementById("bg-mid"),
    bgFront: document.getElementById("bg-front"),
    monsterArea: document.getElementById("monster-area"),
    monsterQueue: document.getElementById("monster-queue"),
    lootList: document.getElementById("loot-list"),
    attackBtn: document.getElementById("attack-btn"),
    specialBtn: document.getElementById("special-btn"),
    fleeBtn: document.getElementById("flee-btn"),
    combatLog: document.getElementById("combat-log"),
    playerHpFill: document.querySelector("#player-hp .hp-fill"),
    playerHpSmall: document.getElementById("player-hp-small"),
    playerAttackValue: document.getElementById("player-attack-value"),
    playerLevel: document.getElementById("player-level"),
    playerXpText: document.getElementById("player-xp-text"),
    playerXpFill: document.querySelector("#player-xp-bar .xp-fill"),
    levelupBadge: document.getElementById("levelup-badge"),
    aceClubs: document.getElementById("ace-clubs"),
    aceDiamonds: document.getElementById("ace-diamonds"),
    aceHearts: document.getElementById("ace-hearts"),
    aceSpades: document.getElementById("ace-spades"),
    aceTotal: document.getElementById("ace-total"),
    slotWeapon: document.getElementById("slot-Weapon"),
    slotArmor: document.getElementById("slot-Armor"),
    slotAccessory: document.getElementById("slot-Accessory"),
    merchantInventory: document.getElementById("merchant-inventory"),
    merchantRefresh: document.getElementById("merchant-refresh"),
    openEnchantBtn: document.getElementById("open-enchant"),
    enchantModal: document.getElementById("enchant-modal"),
    enchantTarget: document.getElementById("enchant-target"),
    enchantOptions: document.getElementById("enchant-options"),
    enchantConfirm: document.getElementById("enchant-confirm"),
    enchantCancel: document.getElementById("enchant-cancel"),
    fxLayer: document.getElementById("fx-layer"),
    companionsList: document.getElementById("companions-list"),
    playerStatusList: document.getElementById("player-status-list"),
    merchantNote: document.getElementById("merchant-note"),
    dailyModal: document.getElementById("daily-modal"),
    dailyContent: document.getElementById("daily-content"),
    dailyClaim: document.getElementById("daily-claim"),
    recruitBtn: document.getElementById("recruit-companion")
  };

  /* =====================
     Parallax background
     ===================== */
  function applyZoneBackground(){
    const zone = ZONES[state.zoneIndex] || ZONES[0];
    refs.bgBack.style.background = `linear-gradient(180deg, ${shade(zone.bg.back, -6)}, ${zone.bg.mid})`;
    refs.bgMid.style.background = `linear-gradient(180deg, ${shade(zone.bg.mid, -6)}, ${zone.bg.front})`;
    refs.bgFront.style.background = `linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))`;
  }
  function shade(hex, amt){
    try {
      const c = hex.replace('#',''); const num = parseInt(c,16);
      let r=(num>>16)+amt, g=((num>>8)&0x00FF)+amt, b=(num&0x0000FF)+amt;
      r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
      return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
    } catch(e){ return hex; }
  }
  document.addEventListener("mousemove",(ev)=>{
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const dx = (ev.clientX - cx)/cx, dy = (ev.clientY - cy)/cy;
    refs.bgBack.style.transform = `translate3d(${dx*8}px,${dy*8}px,0) scale(1.12)`;
    refs.bgMid.style.transform = `translate3d(${dx*16}px,${dy*12}px,0) scale(1.08)`;
    refs.bgFront.style.transform = `translate3d(${dx*28}px,${dy*18}px,0) scale(1.03)`;
  });

  /* =====================
     FX: floating popup & particles
     ===================== */
  function showPopup(text,where='fx'){
    const el = document.createElement("div"); el.className = "float-popup"; el.textContent = text; refs.fxLayer.prepend(el);
    setTimeout(()=> el.classList.add("show"), 20);
    setTimeout(()=> { el.classList.remove("show"); setTimeout(()=> el.remove(), 600); }, 1600);
  }
  function spawnParticles(x,y,color='#ffd7a6',amount=14){
    for(let i=0;i<amount;i++){
      const p = document.createElement("div"); p.className="particle"; p.style.background=color;
      p.style.left=`${x}px`; p.style.top=`${y}px`; document.body.appendChild(p);
      const vx = randInt(-80,80), vy = randInt(-140,-40);
      p.style.transform = `translate(${vx}px, ${vy}px) scale(${Math.random()*1.2+0.4})`;
      p.style.opacity = 0; setTimeout(()=> p.style.opacity = 1, 20);
      setTimeout(()=> { p.style.opacity = 0; p.style.transform += " scale(0.2)"; }, 700+randInt(0,300));
      setTimeout(()=> p.remove(), 1400 + randInt(0,400));
    }
  }

  /* =====================
     Aces helpers
     ===================== */
  function totalAcesValue(){
    const a = state.aces;
    return a.clubs*ACE_VALUES.clubs + a.diamonds*ACE_VALUES.diamonds + a.hearts*ACE_VALUES.hearts + a.spades*ACE_VALUES.spades;
  }
  function coinsFromValue(value){
    const out={spades:0,hearts:0,diamonds:0,clubs:0}; let v=Math.max(0,Math.floor(value));
    const order=['spades','hearts','diamonds','clubs'];
    for(const k of order){ const val=ACE_VALUES[k]; out[k]=Math.floor(v/val); v=v%val; } return out;
  }
  function setAcesFromValue(value){ const c=coinsFromValue(value); state.aces.clubs=c.clubs; state.aces.diamonds=c.diamonds; state.aces.hearts=c.hearts; state.aces.spades=c.spades; }
  function addAcesValue(value){ setAcesFromValue(totalAcesValue()+Math.floor(value)); }
  function trySpendAces(value){ if(totalAcesValue() < value) return false; setAcesFromValue(totalAcesValue()-value); return true; }

  /* =====================
     Item creation (gear & consumables)
     ===================== */
  const PREFIXES = ["Burning","Frozen","Vicious","Blessed","Cursed","Ancient","Swift","Sturdy","Mystic"];
  const SUFFIXES = ["of Fury","of the Owl","of the Bear","of Swiftness","of Protection","of Power","of Woe"];
  function makeItem(rarity){
    const basePowerMap = {"Common": randInt(1,4),"Uncommon":randInt(3,7),"Rare":randInt(6,12),"Super Rare":randInt(10,18),"Epic":randInt(16,26),"Most Def Epic":randInt(22,34),"Powerful":randInt(28,42),"Legendary":randInt(40,60),"Mythic":randInt(60,95)};
    const basePower = basePowerMap[rarity] || 1;
    const slot = ["Weapon","Armor","Accessory"][randInt(0,2)];
    const prefix = randInt(1,100) <= 40 ? PREFIXES[randInt(0,PREFIXES.length-1)] + " " : "";
    const suffix = randInt(1,100) <= 45 ? " " + SUFFIXES[randInt(0,SUFFIXES.length-1)] : "";
    const name = `${prefix}${slot}${suffix}`.trim();
    return { id: Math.random().toString(36).slice(2,8), name, rarity, power: basePower, slot, level:1, type:"gear" };
  }
  function makeConsumable(rarity){
    const pool=[
      {key:"heal_small",name:"Healing Potion",desc:"Restore 30% HP",rarity:"Common",costValue:10},
      {key:"heal_big",name:"Greater Potion",desc:"Restore 60% HP",rarity:"Rare",costValue:50},
      {key:"power_tonic",name:"Power Tonic",desc:"+25% ATK next battle",rarity:"Uncommon",costValue:25},
      {key:"shield_brew",name:"Shield Brew",desc:"Reduce next 2 hits by 30%",rarity:"Rare",costValue:50},
      {key:"mythic_elixir",name:"Mythic Elixir",desc:"Full heal + buff",rarity:"Mythic",costValue:200}
    ];
    const candidates = pool.filter(p=> RARITIES.indexOf(p.rarity) <= Math.max(0, RARITIES.indexOf(rarity)));
    const pick = candidates.length ? candidates[randInt(0,candidates.length-1)] : pool[0];
    return { id: Math.random().toString(36).slice(2,8), name: pick.name, desc: pick.desc, rarity: pick.rarity, power:0, slot:null, level:1, type:"consumable", consumableKey: pick.key, costValue: pick.costValue };
  }

  /* =====================
     Loot roll & award Aces
     ===================== */
  function rollLoot(monster){
    const bias = Math.max(1, RARITIES.indexOf(monster.rarity) + 1);
    const rolls = randInt(0, Math.min(2, Math.floor(bias / 2)));
    const items=[];
    for(let i=0;i<=rolls;i++){
      const weights = {...BASE_RARITY_WEIGHTS}; const mIdx = RARITIES.indexOf(monster.rarity);
      for(const r of RARITIES){ const idx = RARITIES.indexOf(r); if(idx <= mIdx) weights[r] = Math.round(weights[r] * (1 + (idx / (mIdx + 1)) * 0.5)); }
      const lvl = state.player.level, luck = state.player.skills.luck || 0;
      RARITIES.forEach((r, idx)=>{ if(idx>=3) weights[r] += Math.round((lvl*0.02 + luck*0.04) * weights[r]); });
      const dropRarity = chooseWeighted(weights);
      if(randInt(1,100) <= 20) items.push(makeConsumable(dropRarity)); else items.push(makeItem(dropRarity));
    }
    if(items.length === 0) items.push(makeItem("Common"));
    return items;
  }
  function awardAcesForMonster(mon){
    const table = {
      "Common":[{k:"clubs",w:90},{k:"diamonds",w:10}],
      "Uncommon":[{k:"clubs",w:60},{k:"diamonds",w:30},{k:"hearts",w:10}],
      "Rare":[{k:"diamonds",w:50},{k:"hearts",w:40},{k:"spades",w:10}],
      "Super Rare":[{k:"hearts",w:60},{k:"spades",w:40}],
      "Epic":[{k:"hearts",w:45},{k:"spades",w:55}],
      "Most Def Epic":[{k:"hearts",w:35},{k:"spades",w:65}],
      "Powerful":[{k:"spades",w:80},{k:"hearts",w:20}],
      "Legendary":[{k:"spades",w:90},{k:"hearts",w:10}],
      "Mythic":[{k:"spades",w:100}]
    };
    const pool = table[mon.rarity] || table.Common;
    let num = 1 + (RARITIES.indexOf(mon.rarity) >= 6 ? randInt(0,1) : 0);
    const luck = state.player.skills.luck || 0;
    for(let i=0;i<num;i++){
      const wmap={}; pool.forEach(p=> wmap[p.k] = p.w + Math.round((RARITIES.indexOf(mon.rarity) * luck) * 0.8));
      const pick = chooseWeighted(wmap);
      state.aces[pick] = (state.aces[pick] || 0) + 1;
      showPopup(`+1 ${({clubs:"♣",diamonds:"♦",hearts:"♥",spades:"♠"})[pick]}`);
    }
    updateAcesUI();
  }

  /* =====================
     Status Effects System (apply to player & monsters)
     - effects stored: state.statusEffects.player = [{...}], state.statusEffects.monster[monsterId] = [{...}]
     - each effect: {type, duration, magnitude, source}
     ===================== */
  function addStatusTo(target, effect){
    // target: "player" or monster object with id
    if(target === "player"){
      state.statusEffects.player.push(effect);
    } else if(target && target.id){
      state.statusEffects.monster[target.id] = state.statusEffects.monster[target.id] || [];
      state.statusEffects.monster[target.id].push(effect);
    }
  }
  function removeExpiredStatuses(){
    state.statusEffects.player = state.statusEffects.player.filter(s => s.duration > 0);
    for(const mid of Object.keys(state.statusEffects.monster)){
      state.statusEffects.monster[mid] = state.statusEffects.monster[mid].filter(s => s.duration > 0);
      if(state.statusEffects.monster[mid].length === 0) delete state.statusEffects.monster[mid];
    }
  }
  function applyStatusesOnStartTurn(actor){
    // actor: "player" or monster object
    if(actor === "player"){
      const p = state.player;
      const arr = state.statusEffects.player || [];
      arr.forEach(e => {
        if(e.type === "Poison"){ const dmg = Math.max(1, Math.floor(p.maxHp * (e.magnitude || 0.05))); p.hp = Math.max(0, p.hp - dmg); log(`Poison deals ${dmg} to you.`); }
        if(e.type === "Bleed"){ const dmg = Math.max(1, Math.floor((e.magnitude || 2))); p.hp = Math.max(0, p.hp - dmg); log(`Bleed deals ${dmg} to you.`); }
        if(e.type === "Regen"){ const amt = Math.max(1, Math.floor(p.maxHp * (e.magnitude || 0.05))); p.hp = Math.min(p.maxHp, p.hp + amt); log(`Regen restores ${amt}.`); }
        // Freeze/Stun handled elsewhere (prevents action)
        e.duration--;
      });
    } else if(actor && actor.id){
      const arr = state.statusEffects.monster[actor.id] || [];
      arr.forEach(e=>{
        if(e.type === "Poison"){ const dmg = Math.max(1, Math.floor(actor.maximumHp * (e.magnitude || 0.05))); actor.hp = Math.max(0, actor.hp - dmg); log(`${actor.name} suffers Poison ${dmg}.`); }
        if(e.type === "Burn"){ const dmg = Math.max(1, Math.floor(actor.maximumHp * (e.magnitude || 0.04))); actor.hp = Math.max(0, actor.hp - dmg); log(`${actor.name} suffers Burn ${dmg}.`); }
        if(e.type === "Bleed"){ const dmg = Math.max(1, Math.floor((e.magnitude || 3))); actor.hp = Math.max(0, actor.hp - dmg); log(`${actor.name} bleeds ${dmg}.`); }
        if(e.type === "Regen"){ const amt = Math.max(1, Math.floor(actor.maximumHp*(e.magnitude||0.04))); actor.hp = Math.min(actor.maximumHp, actor.hp + amt); log(`${actor.name} regenerates ${amt}.`); }
        e.duration--;
      });
    }
    removeExpiredStatuses();
  }
  function hasStatus(target, type){
    if(target === "player") return state.statusEffects.player.some(s=>s.type===type);
    if(target && target.id) return (state.statusEffects.monster[target.id]||[]).some(s=>s.type===type);
    return false;
  }

  /* =====================
     Companions (summons)
     ===================== */
  function showCompanions(){
    if(state.companions.length === 0){ refs.companionsList.textContent = "None"; return; }
    refs.companionsList.innerHTML = state.companions.map(c => `${c.name} (acts every ${c.trigger}t)`).join(" • ");
  }
  function recruitRandomCompanion(){
    // cost-based: choose from COMPANION_POOL, player must pay
    const choice = COMPANION_POOL[randInt(0,COMPANION_POOL.length-1)];
    if(!trySpendAces(choice.cost)){ log("Not enough Aces to recruit " + choice.name); return; }
    const copy = JSON.parse(JSON.stringify(choice)); copy.id = choice.id + "-" + Math.random().toString(36).slice(2,6); copy.turnCounter = 0;
    state.companions.push(copy);
    log(`Recruited companion: ${copy.name}`);
    showCompanions(); saveState();
  }
  function companionTickTurn(){
    // called each player turn end: increment counters and trigger companions appropriately
    state.companions.forEach(c=>{
      c.turnCounter = (c.turnCounter || 0) + 1;
      if(c.turnCounter >= c.trigger){
        c.turnCounter = 0;
        // perform ability
        if(c.ability === "burn"){
          const mon = state.currentMonster;
          if(mon){
            const mag = (c.power || 6) / 100; // percent-based small burn
            addStatusTo(mon, {type:"Burn", duration:3, magnitude:0.02, source:"companion"});
            spawnParticles((refs.monsterArea.getBoundingClientRect().left + 80), (refs.monsterArea.getBoundingClientRect().top + 40), '#ffb18a', 8);
            log(`${c.name} applies Burn to ${mon.name}.`);
            // immediate small hit
            const hit = Math.max(1, Math.floor((totalAcesValue()/50) + 3));
            mon.hp = Math.max(0, mon.hp - hit);
          }
        } else if(c.ability === "shield"){
          const p = state.player; p._tempBuff = p._tempBuff || {}; p._tempBuff.shield = Math.max(p._tempBuff.shield||0, 1 + Math.floor(c.power*3));
          spawnParticles(refs.playerHpFill.getBoundingClientRect().left + 30, refs.playerHpFill.getBoundingClientRect().top+10, '#b6ffcf', 8);
          log(`${c.name} grants a shield for next hits.`);
        } else if(c.ability === "ace_power"){
          const mon = state.currentMonster;
          if(mon){
            const dmg = Math.max(2, Math.floor(totalAcesValue()/5));
            mon.hp = Math.max(0, mon.hp - dmg);
            spawnParticles((refs.monsterArea.getBoundingClientRect().left + 80), (refs.monsterArea.getBoundingClientRect().top + 40), '#ffd7a6', 8);
            log(`${c.name} deals ${dmg} damage (Ace-powered).`);
          }
        }
        saveState();
      }
    });
  }

  /* =====================
     Combat core: attack, special, monster turn
     - incorporates status checks (Freeze/Stun)
     - companion triggers
     ===================== */
  function playerAttack(isSpecial=false){
    const mon = state.currentMonster; if(!mon) return;
    // Start-of-turn statuses for player & monster
    applyStatusesOnStartTurn("player");
    applyStatusesOnStartTurn(mon);
    // check if player stunned/frozen
    if(hasStatus("player","Stun") || hasStatus("player","Freeze")){ log("You are unable to act due to status."); return; }
    disableControls(true);
    const p = state.player;
    let baseAtk = p.attack + Math.floor(p.skills.attack * 1.5) + randInt(-2,4);
    if(p._tempBuff && p._tempBuff.powerMult) baseAtk = Math.floor(baseAtk * p._tempBuff.powerMult);
    let dmg = baseAtk;
    const critChance = p.crit + (p.skills.luck * 0.8);
    if(rollChance(critChance)){ dmg = Math.floor(dmg * 1.9); log("Critical hit!"); }
    if(isSpecial){
      if(p.specialCooldown === 0){ dmg += Math.floor(p.attack * 1.5) + randInt(2,6); p.specialCooldown = Math.max(1, 3 - Math.floor(p.skills.attack/2)); log("Special attack!"); }
      else { log("Special not ready!"); }
    }
    const monD = clamp(2 + RARITIES.indexOf(mon.rarity) * 0.4, 0, 16);
    if(rollChance(monD)){ log(`${mon.name} dodged your attack!`); dmg = 0; }
    dmg = Math.max(0,dmg);
    // monster shield reduction effects apply on monster side too: if they have regen/shield statuses reduce differently (handled on their turn)
    applyMonsterDamage(mon, dmg);
    setTimeout(()=>{
      if(mon.hp > 0){
        // monster start-turn statuses before acting (they got tick earlier)
        monsterTurn(mon);
      } else handleMonsterDefeat(mon);
      // companion actions occur after monster turn & end of player's turn
      companionTickTurn();
      // decrement player's temp buff turn counters
      if(p._tempBuff && p._tempBuff.turns){ p._tempBuff.turns--; if(p._tempBuff.turns <= 0) delete p._tempBuff.powerMult; }
      if(p.specialCooldown > 0) p.specialCooldown--;
      updateUI(); disableControls(false); saveState();
    }, 420);
  }
  function applyMonsterDamage(mon, damage){
    mon.hp = Math.max(0, mon.hp - damage);
    log(`You hit ${mon.name} for ${damage}.`);
    if(mon._hpFill) mon._hpFill.style.width = `${(mon.hp / mon.maximumHp)*100}%`;
  }
  function monsterTurn(mon){
    // apply statuses at start of monster's action (ticks done in applyStatusesOnStartTurn called earlier)
    applyStatusesOnStartTurn(mon);
    if(mon.hp <= 0) return;
    // check freeze/stun on monster
    if(hasStatus(mon,"Stun") || hasStatus(mon,"Freeze")){
      log(`${mon.name} is unable to act due to status.`);
      return;
    }
    // ability chance
    if(mon.abilities && mon.abilities.length && randInt(1,100) <= (12 + RARITIES.indexOf(mon.rarity)*3 + (mon.isBoss?10:0))){
      const ability = mon.abilities[randInt(0,mon.abilities.length-1)];
      handleMonsterAbility(mon, ability);
      return;
    }
    // normal attack
    const p = state.player;
    if(rollChance(p.dodge + p.skills.defense * 0.5)){ log("You dodged the attack!"); return; }
    let dmg = mon.attack + randInt(-2,2);
    if(p._tempBuff && p._tempBuff.shield && p._tempBuff.shield > 0){
      const reduce = Math.floor(dmg * 0.30); dmg = Math.max(0, dmg - reduce); p._tempBuff.shield--; log("Your shield reduced damage!");
    }
    if(rollChance(6 + RARITIES.indexOf(mon.rarity))) { dmg = Math.floor(dmg * 2); log("Monster critical strike!"); }
    p.hp = Math.max(0, p.hp - dmg);
    log(`${mon.name} hits you for ${dmg}.`);
    updateUI();
    if(p.hp <= 0) handlePlayerDeath();
  }
  function handleMonsterAbility(mon, ability){
    if(ability === "heal"){ const amount = Math.floor(mon.maximumHp * 0.16); mon.hp = Math.min(mon.maximumHp, mon.hp + amount); log(`${mon.name} heals ${amount} HP.`); }
    else if(ability === "enrage"){ mon.attack = Math.floor(mon.attack * 1.22); log(`${mon.name} grows enraged!`); }
    else if(ability === "shield"){ const amt = Math.floor(mon.maximumHp * 0.12); mon.hp = Math.min(mon.maximumHp + amt, mon.maximumHp + Math.floor(mon.maximumHp * 0.2)); log(`${mon.name} raises a shield.`); }
    else if(ability === "double-hit"){ const p = state.player; if(rollChance(p.dodge + p.skills.defense*0.5)){ log("You dodged a double attack!"); return; } const d1=Math.max(1,mon.attack+randInt(-2,1)), d2=Math.max(1,mon.attack+randInt(-1,2)); p.hp=Math.max(0,p.hp-d1-d2); log(`${mon.name} hits twice for ${d1} and ${d2}.`); updateUI(); if(p.hp<=0) handlePlayerDeath(); }
    else log(`${mon.name} does something odd.`);
  }

  /* =====================
     Death / Defeat / Rewards
     ===================== */
  function handleMonsterDefeat(mon){
    log(`${mon.name} defeated!`);
    awardAcesForMonster(mon);
    const xp = calculateXpGain(mon); grantXp(xp);
    const drops = rollLoot(mon);
    drops.forEach(d => { state.loot.push(d); log(`Loot: ${d.name} (${d.rarity})`); });
    renderLoot();
    // particle burst near loot
    const lootRect = document.getElementById("loot-list").getBoundingClientRect();
    spawnParticles(lootRect.left + lootRect.width/2, lootRect.top + 20, '#ffd7a6', 18);
    state.totalMonstersDefeated = (state.totalMonstersDefeated || 0) + 1;
    state.monstersClearedInZone = (state.monstersClearedInZone || 0) + 1;
    if(state.monstersClearedInZone >= MONSTERS_PER_ZONE){ state.zoneIndex = Math.min(ZONES.length-1, state.zoneIndex + 1); state.monstersClearedInZone = 0; log(`You progress to zone: ${ZONES[state.zoneIndex].name}`); applyZoneBackground(); }
    setTimeout(()=>{
      state.currentMonster = null; renderMonster(null);
      if(state.totalMonstersDefeated % BOSS_EVERY === 0){
        const boss = generateMonster(true); state.currentMonster = boss; renderMonster(boss); log(`A BOSS appears: ${boss.name}!`);
      } else {
        state.monsterQueue.shift(); state.monsterQueue.push(generateMonster()); renderQueue(); spawnNextMonster();
      }
      updateUI(); saveState();
    }, 700);
  }

  /* =====================
     XP & leveling
     ===================== */
  function calculateXpGain(monster){ const base = Math.floor((monster.maximumHp*0.8) + (monster.attack*8)); const mult = {"Common":0.6,"Uncommon":0.9,"Rare":1.1,"Super Rare":1.4,"Epic":1.8,"Most Def Epic":2.2,"Powerful":2.8,"Legendary":3.8,"Mythic":5.0}[monster.rarity] || 1; return Math.max(5, Math.floor(base*mult/10)); }
  function grantXp(amount){ const p=state.player; p.xp+=amount; showPopup(`+${amount} XP`); log(`Gained ${amount} XP.`); while(p.xp >= p.xpToNext){ p.xp -= p.xpToNext; levelUp(); } updateUI(); saveState(); }
  function levelUp(){ const p=state.player; p.level+=1; p.skillPoints+=1; p.baseMaxHp += Math.floor(10 + p.level * 1.4); p.baseAttack += Math.floor(2 + p.level * 0.24); p.xpToNext = xpForLevel(p.level); recalcStats(); p.hp = p.maxHp; showLevelUp(); log(`Level up! Now level ${p.level}. +1 skill point.`); }
  function showLevelUp(){ const el = refs.levelupBadge; el.style.opacity = "1"; el.classList.remove("levelup-anim"); void el.offsetWidth; el.classList.add("levelup-anim"); setTimeout(()=> el.style.opacity = "0", 1200); }

  /* =====================
     Merchant & Enchanting
     ===================== */
  function refreshMerchant(){
    const inv = [];
    for(let i=0;i<6;i++){
      if(randInt(1,100) <= 45){ const c = makeConsumable(RARITIES[Math.max(0,Math.min(RARITIES.length-1,Math.floor(state.player.level/4)))]); c.price = Math.max(5, Math.floor((c.costValue||10)*(1+state.player.level*0.04))); inv.push(c); }
      else { const rarity = RARITIES[Math.min(RARITIES.length-1, Math.floor(state.player.level/3 + randInt(0,2)))]; const item = makeItem(rarity); item.price = Math.ceil((Math.max(10,Math.floor(item.power*(1+(RARITIES.indexOf(rarity)*0.12))*(1+state.player.level*0.03))))/5)*5; inv.push(item); }
    }
    state.merchant.inventory = inv; renderMerchant();
  }
  function renderMerchant(){
    refs.merchantInventory.innerHTML = "";
    state.merchant.inventory.forEach(it=>{
      const d = document.createElement("div"); d.className = "merchant-item " + (it.rarity? rarityClass(it.rarity):'');
      const left = document.createElement("div"); left.innerHTML = `<strong>${it.name}</strong><div class="small">${it.rarity || ''} ${it.desc?(' • '+it.desc):''}</div>`;
      const right = document.createElement("div"); right.innerHTML = `<div class="small">Price: ${it.price || it.costValue} value</div>`;
      const btn = document.createElement("button"); btn.textContent="Buy"; btn.addEventListener("click", ()=>{
        const price = it.price||it.costValue||10;
        if(trySpendAces(price)){ const copy = JSON.parse(JSON.stringify(it)); copy.id = Math.random().toString(36).slice(2,8); state.loot.push(copy); log(`Purchased ${it.name} for ${price} value.`); renderLoot(); updateUI(); saveState(); } else log("Not enough Aces.");
      });
      right.appendChild(btn); d.appendChild(left); d.appendChild(right); refs.merchantInventory.appendChild(d);
    });
  }

  /* Enchant system */
  const ENCHANT_COST = {"Common":10,"Uncommon":25,"Rare":50,"Super Rare":90,"Epic":150,"Most Def Epic":240,"Powerful":320,"Legendary":480,"Mythic":800};
  function openEnchant(){
    refs.enchantModal.classList.remove("hidden"); refs.enchantTarget.innerHTML = ""; refs.enchantOptions.innerHTML = "";
    const gear = state.loot.concat(Object.values(state.equipment).filter(Boolean)).filter(i=> i && i.type === "gear");
    if(gear.length === 0){ refs.enchantTarget.innerHTML = "<div class='small'>No gear available to enchant.</div>"; refs.enchantConfirm.disabled = true; return; }
    refs.enchantConfirm.disabled = false;
    gear.forEach(it=>{
      const row = document.createElement("div"); row.className = "merchant-item " + rarityClass(it.rarity);
      row.innerHTML = `<div><strong>${it.name}</strong><div class="small">${it.rarity} • lvl ${it.level}</div></div>`;
      row.addEventListener("click", ()=> selectEnchantTarget(it));
      refs.enchantTarget.appendChild(row);
    });
  }
  let _selectedEnchantTarget = null;
  function selectEnchantTarget(item){
    _selectedEnchantTarget = item;
    refs.enchantOptions.innerHTML = `<div class="small">Target: <strong>${item.name}</strong> — cost: ${ENCHANT_COST[item.rarity] || 50} value</div><div class="small">Possible bonuses (random):</div>`;
    const possible = rollEnchantOptionsForRarity(item.rarity);
    possible.forEach((o, idx)=>{
      const b = document.createElement("div"); b.className="small"; b.textContent = `${o.label}`;
      refs.enchantOptions.appendChild(b);
    });
  }
  function rollEnchantOptionsForRarity(rarity){
    const pool = [
      {k:'atk%',label:'+ATK %',range:[5,12]},
      {k:'crit',label:'+Crit %',range:[2,6]},
      {k:'regen',label:'+Regen %',range:[2,6]},
      {k:'dmg%',label:'+Damage %',range:[4,10]},
      {k:'def%',label:'+HP %',range:[4,10]}
    ];
    const idx = RARITIES.indexOf(rarity);
    return pool.map(p=>{
      const baseMin = p.range[0] + Math.floor(idx*0.6);
      const baseMax = p.range[1] + Math.floor(idx*1.2);
      const val = randInt(baseMin, baseMax);
      return {type:p.k,label:`${p.label} +${val}%`, value:val};
    }).slice(0,3);
  }
  function confirmEnchant(){
    if(!_selectedEnchantTarget){ log("Select an item first."); return; }
    const cost = ENCHANT_COST[_selectedEnchantTarget.rarity] || 50;
    if(!trySpendAces(cost)){ log("Not enough Aces value for enchant."); return; }
    const baseChance = clamp(48 + RARITIES.indexOf(_selectedEnchantTarget.rarity)*6, 55, 95);
    const success = rollChance(baseChance);
    if(!success){ log("Enchantment failed. Aces consumed."); saveState(); refs.enchantModal.classList.add("hidden"); return; }
    const picks = rollEnchantOptionsForRarity(_selectedEnchantTarget.rarity);
    const chosen = picks[randInt(0, picks.length-1)];
    state.enchantments[_selectedEnchantTarget.id] = state.enchantments[_selectedEnchantTarget.id] || [];
    state.enchantments[_selectedEnchantTarget.id].push(chosen);
    log(`Enchanted ${_selectedEnchantTarget.name}: ${chosen.label}`);
    renderLoot(); updateUI(); saveState(); refs.enchantModal.classList.add("hidden");
  }

  /* =====================
     Equip / Sell / Upgrade / Consumables
     ===================== */
  function equipItem(item){
    if(item.type === "consumable"){ useConsumable(item); return; }
    const old = state.equipment[item.slot];
    if(old && old.id === item.id){ delete state.equipment[item.slot]; log(`Unequipped ${item.name}.`); }
    else { state.equipment[item.slot] = item; log(`Equipped ${item.name}.`); }
    recalcStats(); renderLoot(); updateUI(); saveState();
  }
  function sellItem(item){
    const rarityMult = {Common:1,Uncommon:1.3,Rare:1.6,"Super Rare":2.0,Epic:2.6,"Most Def Epic":3.2,Powerful:3.8,Legendary:5.0,Mythic:8.0}[item.rarity] || 1;
    const base = (item.power || 1) * rarityMult;
    const sellValue = Math.max(5, Math.floor(base * 0.5));
    addAcesValue(sellValue);
    const idx = state.loot.findIndex(l => l.id === item.id); if(idx >= 0) state.loot.splice(idx,1);
    log(`Sold ${item.name} for ${sellValue} value (Aces).`); renderLoot(); updateUI(); saveState();
  }
  function upgradeItem(item){
    const rarityCostScale = {"Common":1,"Uncommon":2,"Rare":4,"Super Rare":8,"Epic":12,"Most Def Epic":18,"Powerful":22,"Legendary":40,"Mythic":80};
    const cost = (rarityCostScale[item.rarity] || 1) * item.level * 12;
    if(!trySpendAces(cost)){ log(`Need ${cost} value to upgrade.`); return false; }
    item.level += 1; item.power = Math.floor(item.power * (1 + 0.16 + Math.random()*0.12));
    log(`${item.name} upgraded to lvl ${item.level}. (-${cost} value)`); recalcStats(); renderLoot(); updateUI(); saveState(); return true;
  }
  function useConsumable(item){
    const p = state.player;
    if(item.consumableKey === "heal_small"){ const amount = Math.max(1, Math.floor(p.maxHp * 0.30)); p.hp = Math.min(p.maxHp, p.hp + amount); log(`Used ${item.name} — restored ${amount} HP.`); }
    else if(item.consumableKey === "heal_big"){ const amount = Math.max(1, Math.floor(p.maxHp * 0.60)); p.hp = Math.min(p.maxHp, p.hp + amount); log(`Used ${item.name} — restored ${amount} HP.`); }
    else if(item.consumableKey === "power_tonic"){ p._tempBuff = p._tempBuff || {}; p._tempBuff.powerMult = 1.25; p._tempBuff.turns = 1; log(`Used ${item.name} — +25% ATK next battle.`); }
    else if(item.consumableKey === "shield_brew"){ p._tempBuff = p._tempBuff || {}; p._tempBuff.shield = (p._tempBuff.shield || 0) + 2; log(`Used ${item.name} — shield ready.`); }
    else if(item.consumableKey === "mythic_elixir"){ p.hp = p.maxHp; p._tempBuff = p._tempBuff||{}; p._tempBuff.powerMult=1.3; p._tempBuff.turns=2; log(`Used ${item.name} — full heal and buff!`); }
    const idx = state.loot.findIndex(l=> l.id === item.id); if(idx>=0) state.loot.splice(idx,1);
    renderLoot(); updateUI(); saveState();
  }

  /* =====================
     Render functions (monster, loot, merchant)
     ===================== */
  function renderMonster(mon){
    refs.monsterArea.innerHTML = "";
    if(!mon) return;
    const card = document.createElement("div"); card.className="monster "+rarityClass(mon.rarity)+" spawn"; card.style.position="relative";
    const avatar = document.createElement("div"); avatar.className="avatar"; avatar.textContent = `${mon.name}${mon.isBoss? " (BOSS)":""}`; card.appendChild(avatar);
    const statusIcons = document.createElement("div"); statusIcons.className = "status-icons";
    // show monster statuses
    const arr = state.statusEffects.monster[mon.id] || [];
    arr.forEach(s => { const sp = document.createElement("div"); sp.className="small"; sp.textContent = s.type + (s.duration? ` (${s.duration})`: ''); statusIcons.appendChild(sp); });
    card.appendChild(statusIcons);
    const hpBar = document.createElement("div"); hpBar.className="hp-bar"; const fill = document.createElement("div"); fill.className="hp-fill"; fill.style.width = `${(mon.hp/mon.maximumHp)*100}%`; hpBar.appendChild(fill); card.appendChild(hpBar);
    const status = document.createElement("div"); status.className="small"; status.textContent = `${mon.hp} / ${mon.maximumHp} HP • ATK ${mon.attack} • ${mon.rarity}${mon.abilities && mon.abilities.length ? " • Ability":""}`; card.appendChild(status);
    refs.monsterArea.appendChild(card); mon._el = card; mon._hpFill = fill;
  }
  function renderQueue(){ refs.monsterQueue.innerHTML=""; state.monsterQueue.forEach(m=>{ const q=document.createElement("div"); q.className="queue-card "+rarityClass(m.rarity); q.textContent=`${m.name} (${m.rarity})`; refs.monsterQueue.appendChild(q); }); }

  function renderLoot(){
    refs.lootList.innerHTML = "";
    state.loot.slice().reverse().forEach(item=>{
      const div = document.createElement("div"); div.className = "item "+(item.rarity?rarityClass(item.rarity):'');
      let mid = `<div style="padding-left:54px"><strong>${item.name}</strong><div class="small">${item.rarity || ""} ${item.desc?('• '+item.desc):''} ${item.slot?('• '+item.slot):''}</div></div>`;
      div.innerHTML = `<div style="position:relative;">${mid}</div>`;
      const rune = document.createElement("canvas"); rune.className="rune"; rune.width=46; rune.height=46; rune.style.left="6px"; rune.style.top="6px"; rune.style.position="absolute";
      if(state.enchantments[item.id]){ div.classList.add("enchant-glow"); rune.classList.add("rune-anim"); }
      div.appendChild(rune);
      const actions = document.createElement("div"); actions.className="actions";
      const primaryBtn = document.createElement("button"); primaryBtn.textContent = item.type==="consumable" ? "Use" : "Equip"; primaryBtn.addEventListener("click", ()=> item.type==="consumable" ? useConsumable(item) : equipItem(item));
      const upgradeBtn = document.createElement("button"); upgradeBtn.textContent = "Upgrade"; upgradeBtn.addEventListener("click", ()=> upgradeItem(item));
      const sellBtn = document.createElement("button"); sellBtn.textContent = "Sell"; sellBtn.addEventListener("click", ()=> sellItem(item));
      actions.appendChild(primaryBtn); actions.appendChild(upgradeBtn); actions.appendChild(sellBtn);
      div.appendChild(actions); refs.lootList.appendChild(div);
      if(state.enchantments[item.id]) drawRunesOnCanvas(rune, state.enchantments[item.id]); else rune.remove();
    });
  }
  function drawRunesOnCanvas(canvas, enchants){
    try{
      const ctx = canvas.getContext("2d"); ctx.clearRect(0,0,canvas.width,canvas.height);
      const colorMap = { 'atk%':'#ffdd9c', 'crit':'#ffd4ff','regen':'#b6ffcf','dmg%':'#ffd7a6','def%':'#bcd4ff' };
      const c = enchants[0] || {type:'atk%', value:6}; const col = colorMap[c.type] || '#fff2cc';
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(23,23,18,0,Math.PI*2); ctx.stroke();
      for(let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(23,23); ctx.lineTo(23 + Math.cos(i/6*Math.PI*2)*12, 23 + Math.sin(i/6*Math.PI*2)*12); ctx.stroke(); }
    }catch(e){}
  }

  function updateAcesUI(){ refs.aceClubs.textContent = state.aces.clubs || 0; refs.aceDiamonds.textContent = state.aces.diamonds || 0; refs.aceHearts.textContent = state.aces.hearts || 0; refs.aceSpades.textContent = state.aces.spades || 0; refs.aceTotal.textContent = totalAcesValue(); }

  function updateUI(){
    const p = state.player; const hpPct = clamp((p.hp / p.maxHp)*100,0,100);
    refs.playerHpFill.style.width = `${hpPct}%`; refs.playerHpSmall.textContent = `${p.hp} / ${p.maxHp}`; refs.playerAttackValue.textContent = p.attack; refs.playerLevel.textContent = p.level; refs.playerXpText.textContent = `${p.xp} / ${p.xpToNext}`; refs.playerXpFill.style.width = `${clamp((p.xp / p.xpToNext)*100, 0, 100)}%`;
    document.getElementById("player-crit").textContent = `${Math.round(p.crit*10)/10}%`; document.getElementById("player-dodge").textContent = `${Math.round(p.dodge*10)/10}%`;
    refs.slotWeapon.querySelector("span").textContent = state.equipment.Weapon ? `${state.equipment.Weapon.name} (+${state.equipment.Weapon.power})` : "(empty)";
    refs.slotArmor.querySelector("span").textContent = state.equipment.Armor ? `${state.equipment.Armor.name} (+${state.equipment.Armor.power})` : "(empty)";
    refs.slotAccessory.querySelector("span").textContent = state.equipment.Accessory ? `${state.equipment.Accessory.name} (+${state.equipment.Accessory.power})` : "(empty)";
    document.getElementById("current-zone").textContent = ZONES[state.zoneIndex].name;
    applyZoneBackground(); updateAcesUI(); showCompanions(); renderPlayerStatuses();
  }
  function renderPlayerStatuses(){
    if(!state.statusEffects.player || state.statusEffects.player.length === 0){ refs.playerStatusList.textContent = "Healthy"; return; }
    refs.playerStatusList.innerHTML = state.statusEffects.player.map(s => `${s.type} (${s.duration})`).join(" • ");
  }

  /* =====================
     Queue/Spawn
     ===================== */
  function initQueue(){ state.monsterQueue = []; for(let i=0;i<5;i++) state.monsterQueue.push(generateMonster()); renderQueue(); }
  function spawnNextMonster(){ const next = state.monsterQueue[0]; state.currentMonster = next; renderMonster(next); log(`A ${next.rarity} ${next.name} appears!`); }
  function renderQueue(){ refs.monsterQueue.innerHTML = ""; state.monsterQueue.forEach(m=>{ const q=document.createElement("div"); q.className="queue-card "+rarityClass(m.rarity); q.textContent=`${m.name} (${m.rarity})`; refs.monsterQueue.appendChild(q); }); }

  /* =====================
     Monster generation (scaled)
     ===================== */
  function generateMonster(isBoss=false){
    const tmp = MONSTER_TEMPLATES[randInt(0,MONSTER_TEMPLATES.length-1)];
    const weights = rarityWeightsForPlayer(); const rarity = chooseWeighted(weights); const rIdx = RARITIES.indexOf(rarity);
    const zoneBoost = ZONES[state.zoneIndex].monsterBoost; const pl = state.player.level;
    const hpBase = (isBoss?180:28)+randInt(0,18)+rIdx*16+zoneBoost*12+Math.floor(pl*1.4)+(isBoss?90:0);
    const atkBase = (isBoss?26:6)+randInt(0,6)+Math.floor(rIdx*2.0)+Math.floor(zoneBoost*1.6)+Math.floor(pl*0.25)+(isBoss?10:0);
    const name = (isBoss? "Boss ":"") + tmp.name + (rIdx>=6? " " + ["of Doom","the Fierce","Alpha"][randInt(0,2)] : "");
    const abilities = []; if(isBoss || randInt(1,100) <= (12 + rIdx*3)) abilities.push(["heal","enrage","shield","double-hit"][randInt(0,3)]);
    return { id: tmp.id + "-" + Math.random().toString(36).slice(2,7), name, rarity, maximumHp:hpBase, hp:hpBase, attack:Math.max(1,atkBase), abilities, isBoss:!!isBoss };
  }
  function rarityWeightsForPlayer(){ const weights = {...BASE_RARITY_WEIGHTS}; const lvl = state.player.level; const luck = state.player.skills.luck||0; const levelFactor = 1 + Math.min(0.75, lvl*0.01); const luckFactor = 1 + luck*0.06; RARITIES.forEach((r, idx)=>{ if(idx>=2) weights[r] = Math.max(1, Math.round(weights[r] * (1 + (idx-1)*0.06*levelFactor*luckFactor))); else weights[r] = Math.max(1, Math.round(weights[r] / (1 + 0.02*lvl))); }); return weights; }

  /* =====================
     Stats recalculation & enchant application
     ===================== */
  function recalcStats(){
    const p = state.player; p.baseAttack = Math.floor(16 + p.skills.attack * 2 + p.level * 0.5); p.baseMaxHp = Math.floor(120 + p.skills.defense * 12 + p.level * 6);
    let bonusAtk = 0, bonusHp = 0;
    for(const s in state.equipment){ const it = state.equipment[s]; if(!it) continue; if(it.slot==="Weapon") bonusAtk += Math.floor(it.power * 0.6); if(it.slot==="Armor") bonusHp += Math.floor(it.power * 2.0); if(it.slot==="Accessory"){ bonusAtk += Math.floor(it.power * 0.3); bonusHp += Math.floor(it.power * 0.8); } }
    // enchantment percent bonuses on equipped items
    for(const s of Object.keys(state.equipment)){
      const it = state.equipment[s]; if(!it) continue;
      const ench = state.enchantments[it.id] || [];
      ench.forEach(e=>{
        if(e.type==='atk%') bonusAtk += Math.floor(p.baseAttack * (e.value/100));
        if(e.type==='def%') bonusHp += Math.floor(p.baseMaxHp * (e.value/100));
        if(e.type==='dmg%') bonusAtk += Math.floor(it.power * (e.value/100));
      });
    }
    p.attack = Math.max(1, Math.floor(p.baseAttack + bonusAtk)); p.maxHp = Math.max(1, Math.floor(p.baseMaxHp + bonusHp));
    p.crit = 5 + (p.skills.luck * 0.9); p.dodge = 3 + (p.skills.defense * 0.7); p.hp = clamp(p.hp, 0, p.maxHp);
  }

  /* =====================
     Logging & save wrappers
     ===================== */
  function log(txt){ const d=document.createElement("div"); d.textContent = txt; refs.combatLog.prepend(d); }
  function saveState(){ state.lastSaved = nowMs(); state.lastActive = nowMs(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

  /* =====================
     Controls binding
     ===================== */
  function bindControls(){
    refs.attackBtn.addEventListener("click", ()=> playerAttack(false));
    refs.specialBtn.addEventListener("click", ()=> playerAttack(true));
    refs.fleeBtn.addEventListener("click", ()=> { if(!state.currentMonster) return; log("You fled. Small penalty."); state.player.hp = Math.max(1, state.player.hp - randInt(4,10)); state.currentMonster = null; state.monsterQueue.shift(); state.monsterQueue.push(generateMonster()); renderQueue(); spawnNextMonster(); updateUI(); saveState(); });
    refs.merchantRefresh.addEventListener("click", ()=> { refreshMerchant(); log("Merchant refreshed."); saveState(); });
    refs.openEnchantBtn.addEventListener("click", ()=> openEnchant());
    refs.enchantCancel.addEventListener("click", ()=> refs.enchantModal.classList.add("hidden"));
    refs.enchantConfirm.addEventListener("click", ()=> confirmEnchant());
    refs.dailyClaim.addEventListener("click", ()=> claimDailyReward());
    refs.recruitBtn.addEventListener("click", ()=> recruitRandomCompanion());
  }

  /* =====================
     Disable controls helper
     ===================== */
  function disableControls(flag){ [refs.attackBtn, refs.specialBtn, refs.fleeBtn].forEach(b => b.disabled = !!flag); }

  /* =====================
     Idle / Offline progression (generous)
     - 1 hour => ~5 battles worth of rewards
     ===================== */
  function grantIdleRewardsFromSave(){
    const last = state.lastActive || state.lastSaved || nowMs();
    const elapsedHours = (nowMs() - last) / 3600000;
    if(elapsedHours < 0.016) return; // less than ~1 minute
    const battles = Math.floor(elapsedHours * 5); // generous: 1h ~= 5 battles
    if(battles <= 0) return;
    // simulate simple rewards: XP and aces proportional to battles
    const xpPerBattle = 30 + state.player.level * 6;
    const xpGain = battles * xpPerBattle;
    const acesGain = Math.max(0, Math.floor(battles * 0.5)); // average half an ace value per battle
    grantXp(xpGain);
    addAcesValue(acesGain * 10); // convert to simple value (10 units each)
    showPopup(`While you were away: +${xpGain} XP, +${acesGain} value`);
    spawnParticles(window.innerWidth/2, window.innerHeight/2, '#bde1ff', 26);
    log(`Idle: ${battles} battles simulated while away.`);
  }

  /* =====================
     Daily rewards & streak
     ===================== */
  function checkDailyOnLoad(){
    const today = new Date(); today.setHours(0,0,0,0);
    const last = state.daily.lastLogin ? new Date(state.daily.lastLogin) : null;
    if(!last || (new Date(last).setHours(0,0,0,0) < today.getTime())){
      // a new day
      // decide reward tier by streak
      const newStreak = (state.daily.lastLogin && ((today.getTime() - new Date(state.daily.lastLogin).setHours(0,0,0,0)) === 86400000)) ? (state.daily.streak + 1) : 1;
      state.daily.streak = newStreak;
      state.daily.pending = generateDailyReward(newStreak);
      // show modal
      openDailyModal(state.daily.pending, newStreak);
    } else {
      // same day or already claimed
      // nothing
    }
  }
  function generateDailyReward(streak){
    // simple mapping (can be expanded)
    if(streak >= 7) return {type:"ace",value:100,desc:"Epic reward! 2 ♥ or 1 ♠ equivalent"}; // big
    if(streak >= 5) return {type:"item", rarity:"Rare",desc:"Rare item"}; 
    if(streak >= 3) return {type:"ace",value:50,desc:"1 ♥ Ace value"};
    return {type:"ace",value:10,desc:"♣ Ace"};
  }
  function openDailyModal(reward, streak){
    refs.dailyContent.innerHTML = `<div class="small">Day ${streak} streak</div><div style="margin-top:8px">${reward.desc}</div>`;
    refs.dailyModal.classList.remove("hidden");
  }
  function claimDailyReward(){
    const r = state.daily.pending;
    if(!r){ refs.dailyModal.classList.add("hidden"); return; }
    if(r.type === "ace"){ addAcesValue(r.value); showPopup(`+${r.value} value (Daily)`); }
    else if(r.type === "item"){ const it = makeItem(r.rarity||"Rare"); state.loot.push(it); log(`Daily reward: ${it.name}`); }
    state.daily.lastClaim = nowMs();
    state.daily.lastLogin = nowMs();
    saveState(); refs.dailyModal.classList.add("hidden");
    renderLoot(); updateUI();
  }

  /* =====================
     Start / Init / helpers
     ===================== */
  function start(){
    recalcStats(); applyZoneBackground();
    if(!state.monsterQueue || state.monsterQueue.length === 0) initQueue();
    refreshMerchant(); renderQueue();
    if(!state.currentMonster) spawnNextMonster(); else renderMonster(state.currentMonster);
    renderLoot(); bindControls(); updateUI(); showCompanions();
    // grant idle rewards if away
    grantIdleRewardsFromSave();
    // daily check & modal
    checkDailyOnLoad();
    saveState();
    log("Game started — full build loaded.");
  }

  /* =====================
     Helper public & debug
     ===================== */
  window.NRPG = {
    state, saveState, refreshMerchant, trySpendAces, addAcesValue, recruitRandomCompanion
  };

  // Start the game
  start();

})();
