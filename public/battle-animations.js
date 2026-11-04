// Animazioni locali: il server continua a decidere esito, danni e contrattacchi.
// Sprite pixel-art procedurali: nessuna immagine esterna o dipendenza.
(function(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MechBattle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root) {
  function hash(value) {
    let h = 2166136261;
    for (const ch of String(value)) {
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    }
    return h >>> 0;
  }

  // Sagome originali ispirate ai ruoli dei venti mezzi: palette, testa,
  // spalle, ali e armi sono scelte per unità, non dal solo hash del nome.
  const profiles = {
    ptolemaios:["ship","#d9e5ef","#f49c46","wide"],
    exia:["mecha","#e7edf7","#51b6e7","blade"],
    virtue:["heavy","#e9ecef","#d7a64b","cannon"],
    dynames:["mecha","#62b891","#f0f4f6","rifle"],
    kyrios:["flight","#f4a63e","#f0f4f6","wings"],
    damocles:["ship","#b5a4b9","#e2a3db","fortress"],
    gekkoei:["mecha","#292d47","#ba79db","blade"],
    guren:["mecha","#c64147","#222938","claw"],
    lancelot:["mecha","#e9e5db","#cda64e","blade"],
    "sutherland sieg":["heavy","#795f8f","#d9bd5d","cannon"],
    "macross quarter":["ship","#d1e3f1","#5ca7e4","carrier"],
    "vf-25f messiah":["flight","#e8e8ef","#dc454a","wings"],
    "vf-25g messiah":["flight","#6590bc","#e7e8ef","rifle"],
    "vb-6 könig monster":["heavy","#657e79","#c8c3a3","cannon"],
    "queadluun-rhea":["flight","#b84d68","#f1b2a6","wings"],
    "white base":["ship","#e9e9e9","#d9574d","carrier"],
    "rx-78-2 gundam":["mecha","#e5edf3","#d44949","vfin"],
    guncannon:["heavy","#c64c43","#e6d8c4","cannon"],
    guntank:["tank","#627c9c","#e0d0a0","cannon"],
    "core booster":["flight","#e5e9f1","#d94748","wings"]
  };
  function profile(unit) {
    const name=String(unit?.name||"").toLowerCase().trim();
    return profiles[name] || profiles[Object.keys(profiles).find(k=>name.includes(k))] ||
      [unit?.type==="ship"?"ship":"mecha","#83b9d9","#efbf68","blade"];
  }
  function spriteSvg(unit, headOnly=false) {
    const [kind,base,accent,gear]=profile(unit);
    const name=String(unit?.name||"").toLowerCase().trim();
    const dark="#101c30", metal="#52627b", light="#f5f6e6", glow="#80ffdc";
    const blocks=[];
    const rect=(x,y,w,h,fill)=>blocks.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>');
    const poly=(points,fill)=>blocks.push('<polygon points="'+points+'" fill="'+fill+'"/>');
    const group=cls=>blocks.push('<g class="'+cls+'">');
    const end=()=>blocks.push('</g>');
    // Piastre a gradini: bordo scuro, fianco in ombra e riflesso di un pixel.
    function plate(x,y,w,h,color=base) {
      poly(`${x+3},${y} ${x+w-3},${y} ${x+w},${y+3} ${x+w},${y+h-3} ${x+w-3},${y+h} ${x},${y+h} ${x},${y+3}`,dark);
      rect(x+2,y+3,w-4,h-5,color);
      rect(x+3,y+1,w-6,2,light);
      rect(x+w-4,y+4,2,h-7,metal);
      rect(x+3,y+h-3,w-7,1,dark);
    }
    function vent(x,y,w) { for(let i=0;i<3;i++)rect(x,y+i*3,w,1,dark); }
    function engine(x,y) {
      plate(x,y,9,14,metal);
      group("spriteThruster");
      poly(`${x+2},${y+12} ${x+8},${y+12} ${x+6},${y+26} ${x+3},${y+21}`,accent);
      rect(x+4,y+13,2,8,light); end();
    }
    if(kind==="ship") {
      // Profilo da incrociatore: ponte, scafi laterali, hangar e batterie.
      const fortress=gear==="fortress", carrier=gear==="carrier";
      engine(9,52); engine(24,59);
      poly(fortress?"8,33 31,20 76,20 92,42 75,66 27,69 6,54":"4,42 24,31 68,29 93,44 77,62 24,63 4,54",dark);
      poly(fortress?"11,35 32,24 74,24 87,42 73,61 27,64 10,52":"7,43 26,35 68,33 87,44 75,57 25,58 7,51",base);
      poly("9,51 72,51 87,44 75,59 25,61 9,54",metal);
      rect(24,36,47,3,light); rect(26,46,49,4,accent);
      plate(36,25,24,18);plate(41,17,13,12,accent);
      rect(43,19,9,3,glow);rect(46,9,2,9,metal);rect(40,11,13,1,light);
      for(let i=0;i<6;i++){rect(26+i*7,52,4,2,dark);rect(27+i*7,52,2,1,glow);}
      for(let i=0;i<4;i++){plate(14+i*15,39,10,6);rect(18+i*15,37,2,5,metal);}
      if(carrier){plate(13,61,57,10);rect(21,64,39,2,accent);vent(17,63,3);}
      if(fortress){plate(18,17,14,16,accent);plate(65,17,14,16,accent);vent(22,22,6);vent(69,22,6);}
      if(name==="ptolemaios"){plate(15,27,18,8,accent);poly("65,31 82,22 77,37",base);}
      if(name==="white base"){plate(8,27,22,10);plate(64,27,22,10);rect(28,27,5,9,accent);}
      if(name==="macross quarter"){plate(62,58,12,21);rect(66,62,5,14,accent);}
      group("spriteWeapon");plate(69,36,11,8,metal);rect(78,37,15,3,light);rect(88,37,5,2,dark);end();
    } else if(name==="core booster") {
      // Intercettore con doppia gondola: nessun corpo umanoide.
      engine(18,58);engine(51,58);
      poly("14,25 29,30 46,13 57,31 76,26 71,44 92,61 59,64 49,75 37,65 5,62 23,43",dark);
      poly("17,30 29,35 46,18 56,36 72,31 67,45 85,58 57,60 49,69 38,60 12,59 28,44",base);
      poly("29,39 7,57 35,54 44,34",accent);
      poly("56,39 84,57 58,54 49,34",accent);
      plate(25,40,13,29);plate(53,40,13,29);
      plate(37,30,19,29);plate(41,22,12,17,metal);
      rect(44,23,6,11,glow);rect(44,24,2,6,light);
      for(const x of [27,55]){vent(x,46,7);rect(x+2,57,3,6,accent);}
      group("spriteWeapon");
      for(const x of [31,58]){plate(x,26,7,16,metal);rect(x+2,18,3,14,light);rect(x+1,17,5,3,dark);}
      end();
      for(let i=0;i<5;i++){rect(15+i*3,55-i*2,2,1,metal);rect(67+i*3,49+i*2,2,1,metal);}
    } else {
      const heavy=kind==="heavy", flight=kind==="flight", tank=kind==="tank";
      // Ali, propulsori e attrezzatura dietro la silhouette.
      if(flight){
        poly("31,35 7,13 12,49 33,55",dark);poly("29,35 11,19 17,46 32,50",accent);
        poly("57,34 80,12 75,51 58,55",dark);poly("60,35 76,18 71,47 59,50",base);
        rect(13,28,2,11,light);rect(71,27,2,14,accent);
      }
      engine(25,40);engine(56,42);
      if(name==="queadluun-rhea"){plate(9,31,20,28,accent);plate(66,31,20,28,accent);}
      if(name==="sutherland sieg"){plate(5,38,25,32,accent);plate(65,38,25,32,accent);}
      group("spriteLegs");
      if(tank){
        plate(12,68,65,20,metal);
        for(let i=0;i<7;i++){plate(16+i*8,77,7,8,dark);rect(18+i*8,79,3,3,metal);}
        plate(22,63,46,13,accent);
      } else {
        for(const [x,offset] of [[31,0],[50,-3]]){
          plate(x,59+offset,13,16,metal);plate(x-1,70+offset,15,17);
          plate(x,70+offset,13,7,accent);plate(x-4,85+offset,23,7,accent);
          rect(x+2,79+offset,3,6,light);rect(x+9,80+offset,2,5,dark);
        }
      }
      end();
      plate(heavy?27:30,34,heavy?39:31,26);
      poly("34,38 46,42 60,37 57,49 37,49",accent);
      rect(44,42,7,5,glow);rect(46,43,3,3,light);
      vent(34,40,6);vent(53,40,6);
      plate(34,57,25,9,metal);plate(30,62,14,9);plate(49,62,14,9);
      rect(43,58,6,5,accent);
      // Casco sfaccettato, guance, ottiche e antenne.
      plate(34,13,25,20);
      poly("34,18 40,10 53,10 59,18 54,18 51,15 41,15 38,19",base);
      rect(37,22,19,5,dark);rect(39,23,6,2,glow);rect(49,23,5,2,glow);
      poly("45,24 49,24 52,31 42,31",light);rect(46,29,3,3,accent);
      rect(34,27,5,4,metal);rect(54,27,5,4,metal);
      if(gear==="vfin"||name==="exia"||name==="lancelot"){
        poly("45,17 26,4 30,4 46,12 63,3 67,3 50,17",accent);rect(45,11,5,7,accent);
      } else if(gear==="claw"||name==="gekkoei"){
        poly("35,18 31,3 39,11 43,17",accent);poly("53,16 62,6 59,21",accent);
      } else {rect(39,7,2,12,accent);rect(50,11,5,5,accent);}
      group("spriteArm");
      plate(heavy?15:21,33,heavy?20:15,17,accent);
      plate(21,48,12,12,metal);plate(17,55,16,15);vent(21,59,7);
      plate(59,33,heavy?21:15,16,accent);plate(62,47,12,12,metal);
      plate(62,54,14,14);rect(66,64,9,6,dark);
      if(gear==="claw"){
        plate(66,47,19,26,metal);poly("78,49 89,45 85,55 82,58 87,64 84,75 77,70",light);
        rect(71,54,6,10,accent);
      }
      end();
      group("spriteWeapon");
      if(gear==="cannon"){
        for(const x of [23,62]){plate(x,16,8,29,metal);rect(x+2,8,4,24,light);rect(x+1,7,6,4,dark);}
        plate(58,51,28,11,metal);rect(80,52,13,5,dark);rect(61,52,16,2,accent);
      } else if(gear==="blade"||gear==="vfin"){
        poly("75,61 90,19 93,16 92,28 80,65",dark);
        poly("77,60 91,20 90,29 79,62",light);rect(71,61,13,3,accent);rect(75,65,3,8,metal);
      } else {
        plate(66,49,21,10,metal);rect(82,50,12,4,dark);rect(70,50,12,2,light);
        if(gear==="rifle"){rect(73,53,21,5,metal);rect(80,48,14,3,light);rect(75,44,7,5,dark);rect(77,44,3,2,glow);}
      }
      end();
      if(name==="dynames"){plate(17,38,9,25,base);rect(18,40,2,19,accent);}
      if(name==="rx-78-2 gundam"){plate(64,38,13,25,accent);rect(69,43,3,15,light);rect(65,49,10,3,light);rect(35,36,23,4,"#557eb7");}
      if(name==="virtue"){plate(26,49,10,18);plate(59,49,10,18);}
      if(name==="vf-25g messiah"){rect(56,20,8,5,dark);rect(60,21,3,2,accent);}
    }
    const view=headOnly===true && kind!=="ship" && kind!=="tank" && name!=="core booster"?"28 2 36 32":"0 0 96 96";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'" aria-hidden="true" shape-rendering="crispEdges">'+blocks.join("")+'</svg>';
  }

  function attackStyle(event) {
    const slot=Object.keys(event.attacker?.weapons||{}).find(key=>event.attacker.weapons[key].label===event.weapon);
    return {melee:"melee",gun:"ballistic",laser:"beam",special:"salvo"}[slot]||"beam";
  }

  function eventsFromStates(previous, current) {
    const pending = previous?.pendingAttack;
    if (!pending || !current?.started || current.pendingAttack) return [];
    const attacker = previous.units?.find(u => u.id === pending.attackerId);
    const defender = previous.units?.find(u => u.id === pending.targetId);
    if (!attacker || !defender) return [];
    const before = previous.log || [], after = current.log || [];
    const stop = before.length ? after.indexOf(before[0]) : -1;
    const fresh = (stop >= 0 ? after.slice(0, stop) : after.slice(0, 5)).reverse();
    const events = [];
    for (const line of fresh) {
      for (const [source, target, counter] of [[attacker, defender, false], [defender, attacker, true]]) {
        const hitPrefix = source.name + " usa ";
        const missPrefix = target.name + " evita ";
        const hitEnd = " su " + target.name + ": ";
        const missEnd = " di " + source.name + " (";
        if (line.startsWith(hitPrefix) && line.includes(hitEnd)) {
          const damage = /:\s*(\d+) danni\./.exec(line);
          if (damage) events.push({
            attacker: source, defender: target, counter, hit: true,
            weapon: line.slice(hitPrefix.length, line.indexOf(hitEnd)), damage: Number(damage[1])
          });
          break;
        }
        if (line.startsWith(missPrefix) && line.includes(missEnd)) {
          events.push({
            attacker: source, defender: target, counter, hit: false,
            weapon: line.slice(missPrefix.length, line.indexOf(missEnd)), damage: 0
          });
          break;
        }
      }
    }
    return events;
  }

  let queue = [], active = false, timeout = null, overlay = null;
  function finish() {
    if (timeout !== null) root.clearTimeout(timeout);
    timeout = null;
    overlay?.remove();
    overlay = null;
    active = false;
    playNext();
  }
  function playNext() {
    if (active || !queue.length || typeof document === "undefined") return;
    active = true;
    const event = queue.shift();
    const reduced = !!root.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    overlay = document.createElement("div");
    overlay.className = "battleOverlay battleStyle-" + attackStyle(event) + (event.hit ? " battleHit" : " battleMiss");
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    // Solo markup statico; nomi e descrizioni vengono assegnati con textContent.
    overlay.innerHTML =
      '<div class="battleScene"><div class="battleTop"><span class="battleTag">MECHA FLEET · COMBAT</span>' +
      '<button class="battleSkip" type="button">Salta animazione</button></div>' +
      '<div class="battleDuel"><div class="battleActor battleAttacker"><div class="battleSprite"></div><strong></strong></div>' +
      '<div class="battleProjectile"><i></i><i></i><i></i></div><div class="battleImpact"></div><div class="battleActor battleDefender"><div class="battleSprite"></div><strong></strong></div></div>' +
      '<div class="battleOutcome"></div><div class="battleWeapon"></div></div>';
    const [left, right] = overlay.querySelectorAll(".battleActor");
    left.querySelector(".battleSprite").innerHTML = spriteSvg(event.attacker);
    right.querySelector(".battleSprite").innerHTML = spriteSvg(event.defender);
    left.querySelector("strong").textContent = event.attacker.name;
    right.querySelector("strong").textContent = event.defender.name;
    overlay.querySelector(".battleWeapon").textContent =
      (event.counter ? "CONTRATTACCO · " : "ATTACCO · ") + event.weapon;
    overlay.querySelector(".battleOutcome").textContent =
      event.hit ? event.damage + " DANNI" : "COLPO EVITATO";
    overlay.querySelector(".battleSkip").addEventListener("click", finish);
    document.body.appendChild(overlay);
    if (!reduced) {
      root.requestAnimationFrame?.(() => overlay?.classList.add("battlePlaying"));
    } else {
      overlay.classList.add("battlePlaying");
    }
    timeout = root.setTimeout(finish, reduced ? 250 : 2400);
  }
  function onState(previous, current) {
    for (const event of eventsFromStates(previous, current)) {
      if (queue.length < 8) queue.push(event);
    }
    playNext();
  }
  function reset() {
    queue = [];
    if (active) finish();
  }
  return {hash, profile, spriteSvg, attackStyle, eventsFromStates, onState, reset};
});
