const {test} = require("node:test");
const assert = require("node:assert/strict");
const {spriteSvg, eventsFromStates, attackStyle} = require("../public/battle-animations.js");
const {factions, buildRoster} = require("../public/factions.js");

test("sprite 2D riproducibili e diversi per tutte le 20 unità", () => {
  const units = factions.flatMap(f => buildRoster(f.id));
  const images = units.map(unit => spriteSvg(unit));
  assert.equal(units.length, 20);
  assert.equal(new Set(images).size, 20);
  assert.equal(spriteSvg(units[0]), spriteSvg(units[0]));
  for (const svg of images) {
    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 96 96"/);
  }
});

test("nomi non fidati non finiscono nel markup SVG", () => {
  const svg = spriteSvg({name: '<img src=x onerror=alert(1)>', role: "striker"});
  assert.doesNotMatch(svg, /<img|onerror|alert/);
});

test("un attacco risolto produce animazione colpo e contrattacco in ordine", () => {
  const attacker = {id:"a",name:"Exia",role:"striker"};
  const defender = {id:"b",name:"Guren",role:"heavy"};
  const start = "Exia attacca Guren: il difensore sceglie Counter, Defend o Evade.";
  const previous = {
    started:true, pendingAttack:{attackerId:"a",targetId:"b",weapon:"melee"},
    units:[attacker,defender], log:[start]
  };
  const current = {
    started:true,pendingAttack:null,units:[attacker,defender],
    log:["Guren usa Radiant Blade su Exia: 70 danni.",
      "Exia usa GN Sword su Guren: 120 danni.",start]
  };
  assert.deepEqual(eventsFromStates(previous,current).map(e=>[e.attacker.name,e.defender.name,e.damage,e.counter]),
    [["Exia","Guren",120,false],["Guren","Exia",70,true]]);
});

test("schivata, assenza di risoluzione e snapshot iniziale", () => {
  const a={id:"a",name:"Dynames"}, b={id:"b",name:"Lancelot"};
  const previous={started:true,pendingAttack:{attackerId:"a",targetId:"b"},units:[a,b],log:[]};
  const waiting={...previous,log:["Dynames attacca Lancelot"]};
  assert.deepEqual(eventsFromStates(null,waiting),[]);
  assert.deepEqual(eventsFromStates(previous,waiting),[]);
  const current={...waiting,pendingAttack:null,
    log:["Lancelot evita GN Sniper Rifle di Dynames (42%)."]};
  const result=eventsFromStates(previous,current);
  assert.equal(result.length,1);
  assert.equal(result[0].hit,false);
  assert.equal(result[0].weapon,"GN Sniper Rifle");
  assert.equal(result[0].damage,0);
});

test("icone della mappa mostrano il volto e sagome delle navi", () => {
  const head = spriteSvg({name:"Exia"},true);
  const ship = spriteSvg({name:"Ptolemaios",type:"ship"},true);
  assert.match(head,/viewBox="28 2 36 32"/);
  assert.match(ship,/viewBox="0 0 96 96"/);
  assert.notEqual(spriteSvg({name:"Guren"}),spriteSvg({name:"Lancelot"}));
  assert.notEqual(spriteSvg({name:"VF-25F Messiah"}),spriteSvg({name:"VF-25G Messiah"}));
});


test("le armi selezionano assalto, raffica, raggio e salva", () => {
  const unit = buildRoster("gundam00")[1];
  for (const [slot,style] of [["melee","melee"],["gun","ballistic"],["laser","beam"],["special","salvo"]]) {
    assert.equal(attackStyle({attacker:unit,weapon:unit.weapons[slot].label}),style);
  }
  assert.equal(attackStyle({attacker:unit,weapon:"arma sconosciuta"}),"beam");
});

test("sprite articolati con dettagli di armatura e crop esplicito", () => {
  for (const faction of factions) for (const unit of buildRoster(faction.id)) {
    const svg = spriteSvg(unit);
    assert.match(svg, /class="spriteThruster"/);
    assert.match(svg, /class="spriteWeapon"/);
    assert.equal(spriteSvg(unit,1),svg); // Array.map index must never crop full-body sprites.
  }
});

test("RX-78-2 usa la propria palette e Core Booster resta un velivolo", () => {
  const {profile} = require("../public/battle-animations.js");
  assert.deepEqual(profile({name:"RX-78-2 Gundam"}),["mecha","#e5edf3","#d44949","vfin"]);
  assert.doesNotMatch(spriteSvg({name:"Core Booster"}),/spriteLegs|spriteArm/);
  assert.match(spriteSvg({name:"Core Booster"},true),/viewBox="0 0 96 96"/);
});

test("riproduzione, salto, contrattacco, reset e movimento ridotto", () => {
  const fs=require("node:fs"), vm=require("node:vm");
  for(const reduced of [false,true]) {
    const overlays=[],timers=new Map(); let sequence=0;
    function node() {
      const children=new Map();
      return {textContent:"",innerHTML:"",className:"",classList:{add(){}},setAttribute(){},
        querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},
        querySelectorAll(){return [this.querySelector("left"),this.querySelector("right")];},
        addEventListener(event,fn){this[event]=fn;},remove(){overlays.splice(overlays.indexOf(this),1);}};
    }
    const context=vm.createContext({document:{createElement:node,body:{appendChild(el){overlays.push(el);}}},
      setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,ms});return id;},
      clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){fn();},matchMedia(){return {matches:reduced};}});
    vm.runInContext(fs.readFileSync(require.resolve("../public/battle-animations.js"),"utf8"),context);
    const a={...buildRoster("gundam00")[1],id:"a"},b={...buildRoster("codegeass")[2],id:"b"};
    const previous={started:true,pendingAttack:{attackerId:"a",targetId:"b"},units:[a,b],log:[]};
    const current={started:true,pendingAttack:null,units:[a,b],log:[
      "Guren usa Slash Harken Rush su Exia: 1200 danni.","Exia usa GN Sword su Guren: 4200 danni."]};
    context.MechBattle.onState(previous,current);
    assert.equal(overlays.length,1);
    assert.match(overlays[0].className,/battleStyle-melee/);
    assert.equal([...timers.values()][0].ms,reduced?250:2400);
    overlays[0].querySelector(".battleSkip").click();
    assert.equal(overlays.length,1);
    assert.match(overlays[0].className,/battleStyle-ballistic/);
    assert.match(overlays[0].querySelector(".battleWeapon").textContent,/CONTRATTACCO/);
    context.MechBattle.reset();
    assert.equal(overlays.length,0);
    assert.equal(timers.size,0);
    context.MechBattle.onState(previous,current);
    const timer=[...timers.values()][0];timer.fn();
    assert.match(overlays[0].className,/battleStyle-ballistic/);
    context.MechBattle.reset();
  }
});
