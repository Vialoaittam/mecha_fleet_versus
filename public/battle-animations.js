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
    "rx 78-2 gundam":["mecha","#e5edf3","#d44949","vfin"],
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
    const dark="#263447", light="#f4f6f7";
    const blocks=[];
    const rect=(x,y,w,h,fill)=>blocks.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>');
    const poly=(points,fill)=>blocks.push('<polygon points="'+points+'" fill="'+fill+'"/>');
    if(kind==="ship"){
      poly("32,5 43,24 58,34 51,48 13,48 6,34 21,24",dark);
      poly("32,10 40,27 53,35 47,43 17,43 11,35 24,27",base);
      rect(27,18,10,26,accent);rect(29,12,6,10,light);
      if(gear==="carrier"){rect(4,29,13,17,base);rect(47,29,13,17,base);rect(6,32,8,9,accent);rect(50,32,8,9,accent);}
      if(gear==="fortress"){rect(13,22,38,6,accent);rect(19,16,26,8,dark);}
      rect(20,49,8,9,accent);rect(36,49,8,9,accent);
    } else if(kind==="tank"){
      rect(7,40,50,16,dark);rect(11,38,42,12,base);
      rect(14,50,36,9,accent);rect(20,27,24,15,base);
      rect(27,9,10,23,dark);rect(29,3,6,30,light);
      rect(7,32,12,10,accent);rect(45,32,12,10,accent);
    } else {
      if(kind==="flight"){
        poly("22,24 2,13 7,35 23,42",accent);
        poly("42,24 62,13 57,35 41,42",accent);
      }
      if(kind==="heavy"){
        rect(2,20,20,25,dark);rect(42,20,20,25,dark);
        rect(5,23,14,17,accent);rect(45,23,14,17,accent);
      }
      rect(23,9,18,15,dark);rect(25,11,14,11,base);
      rect(27,17,10,3,accent);
      if(gear==="vfin"){poly("25,12 16,2 27,7 32,12 37,7 48,2 39,12",accent);}
      if(gear==="claw"){poly("21,12 13,3 17,19",accent);poly("43,12 51,3 47,19",accent);}
      rect(19,24,26,23,dark);rect(22,26,20,18,base);
      rect(26,29,12,7,accent);rect(7,27,13,19,base);rect(44,27,13,19,base);
      rect(20,46,11,16,dark);rect(33,46,11,16,dark);
      rect(21,53,9,8,base);rect(34,53,9,8,base);
      if(gear==="rifle"){rect(50,11,7,36,dark);rect(52,4,3,23,light);}
      if(gear==="cannon"){rect(11,4,8,29,dark);rect(45,4,8,29,dark);rect(13,2,4,18,accent);rect(47,2,4,18,accent);}
      if(gear==="blade"){rect(3,7,4,32,light);rect(1,30,9,5,accent);}
      if(gear==="wings"){poly("17,27 0,18 8,43 20,45",base);poly("47,27 64,18 56,43 44,45",base);}
    }
    const view=headOnly && kind!=="ship" && kind!=="tank"?"18 2 28 26":"0 0 64 64";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'" aria-hidden="true" shape-rendering="crispEdges">'+blocks.join("")+'</svg>';
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
    overlay.className = "battleOverlay" + (event.hit ? " battleHit" : " battleMiss");
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    // Solo markup statico; nomi e descrizioni vengono assegnati con textContent.
    overlay.innerHTML =
      '<div class="battleScene"><div class="battleTop"><span class="battleTag">MECHA FLEET · COMBAT</span>' +
      '<button class="battleSkip" type="button">Salta animazione</button></div>' +
      '<div class="battleDuel"><div class="battleActor battleAttacker"><div class="battleSprite"></div><strong></strong></div>' +
      '<div class="battleProjectile"></div><div class="battleActor battleDefender"><div class="battleSprite"></div><strong></strong></div></div>' +
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
    timeout = root.setTimeout(finish, reduced ? 250 : 1550);
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
  return {hash, profile, spriteSvg, eventsFromStates, onState, reset};
});
