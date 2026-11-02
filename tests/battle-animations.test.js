const {test} = require("node:test");
const assert = require("node:assert/strict");
const {spriteSvg, eventsFromStates} = require("../public/battle-animations.js");
const {factions, buildRoster} = require("../public/factions.js");

test("sprite 2D riproducibili e diversi per tutte le 20 unità", () => {
  const units = factions.flatMap(f => buildRoster(f.id));
  const images = units.map(spriteSvg);
  assert.equal(units.length, 20);
  assert.equal(new Set(images).size, 20);
  assert.equal(spriteSvg(units[0]), spriteSvg(units[0]));
  for (const svg of images) {
    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 64 64"/);
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
