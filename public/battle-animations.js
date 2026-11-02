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

  // Ogni nome produce dettagli differenti; i ruoli determinano la silhouette.
  // I rettangoli sono costruiti esclusivamente con numeri e colori predefiniti.
  function spriteSvg(unit) {
    const seed = hash(unit?.name || "Mecha");
    const role = unit?.role || (unit?.type === "ship" ? "carrier" : "striker");
    const palette = ["#5bc4eb", "#e9a44d", "#c58ff1", "#7bdca5", "#ee7d82", "#b7c8eb"];
    const base = palette[seed % palette.length];
    const accent = palette[(seed >>> 8) % palette.length];
    const dark = "#253448", light = "#f0f7ff", trim = "#12202e";
    const blocks = [];
    const rect = (x, y, w, h, fill) => blocks.push(
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>'
    );
    if (role === "carrier" || unit?.type === "ship") {
      rect(6, 28, 52, 12, dark);
      rect(12, 24, 40, 20, base);
      rect(20, 18, 24, 28, dark);
      rect(24, 12, 16, 30, base);
      rect(28, 8, 8, 10, light);
      rect(0, 32, 14, 8, accent); rect(50, 32, 14, 8, accent);
      rect(8, 20, 8, 10, dark); rect(48, 20, 8, 10, dark);
      rect(16 + (seed % 3) * 8, 46, 8, 6, accent);
    } else {
      const bulky = role === "heavy" || role === "artillery";
      const winged = role === "agile" || role === "sniper";
      if (winged) {
        rect(0, 22, 16, 6, accent); rect(48, 22, 16, 6, accent);
        rect(4, 14, 8, 16, dark); rect(52, 14, 8, 16, dark);
      }
      if (bulky) {
        rect(4, 19, 16, 19, dark); rect(44, 19, 16, 19, dark);
        rect(6, 21, 12, 13, accent); rect(46, 21, 12, 13, accent);
      }
      rect(22, 8, 20, 14, dark);
      rect(25, 10, 14, 10, base);
      rect(26, 15, 12, 4, light);
      rect(18, 22, 28, 24, dark);
      rect(22, 24, 20, 18, base);
      rect(26, 27, 12, 6, accent);
      rect(8, 26, 12, bulky ? 22 : 16, base);
      rect(44, 26, 12, bulky ? 22 : 16, base);
      rect(20, 44, 10, 16, dark); rect(34, 44, 10, 16, dark);
      rect(20, 52, 10, 10, base); rect(34, 52, 10, 10, base);
      if (role === "sniper" || role === "artillery") {
        rect(48, 10, 8, 32, trim); rect(50, 4, 4, 18, light);
      } else if (role === "striker") {
        rect(4, 10, 6, 25, light); rect(2, 8, 10, 6, accent);
      }
      rect(29 + (seed % 3) * 3, 4, 3, 7, accent);
    }
    // Firma geometrica a 8 bit: varia anche tra nomi dello stesso ruolo.
    for (let i = 0; i < 8; i++) {
      if ((seed >>> i) & 1) rect(12 + i * 5, 40, 3, 4, light);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges">' +
      blocks.join("") + '</svg>';
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
  return {hash, spriteSvg, eventsFromStates, onState, reset};
});
