const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const rules = require("../public/rules");

// Run the real server callbacks with deterministic state and no listening socket.
function game(count=3, active=1) {
  const filename=path.join(__dirname,"..","server.js");
  const server={listen(){}};
  const hub=new EventEmitter();
  hub.clients=new Set();
  const localRequire=createRequire(filename);
  const context=vm.createContext({
    require(id){
      if(id==="http")return {createServer:()=>server};
      if(id==="ws")return {Server:function(){return hub;},OPEN:1};
      return localRequire(id);
    },
    __dirname:path.dirname(filename),process,console,
    Math:Object.assign(Object.create(Math),{random:()=>0})
  });
  vm.runInContext(fs.readFileSync(filename,"utf8"),context);
  const peers=[];
  for(let i=1;i<=count;i++){
    const ws=new EventEmitter();
    ws.readyState=1;ws.send=()=>{};
    hub.clients.add(ws);hub.emit("connection",ws);
    ws.emit("message",JSON.stringify({type:"join",name:"Pilot "+i}));
    peers.push(ws);
  }
  peers[0].emit("message",JSON.stringify({action:"start"}));
  vm.runInContext(`state.activePlayer=${active};
    for(const u of state.units){u.x=u.owner*2;u.y=0;}`,context);
  return {
    send(id,msg){peers[id-1].emit("message",JSON.stringify(msg));},
    run(code){return vm.runInContext(code,context);},
    state(){return JSON.parse(vm.runInContext("JSON.stringify(state)",context));}
  };
}

const invalid=[{toString:null},{toString:{}},[],["aim"],["gun"],null,42,true,"__proto__","constructor"];
test("skill and attack reject malformed identifiers without mutation",()=>{
  const g=game();
  for(const value of invalid){
    const before=g.state();
    assert.doesNotThrow(()=>g.send(1,{action:"skill",unitId:"p1-m1",skill:value}));
    assert.deepEqual(g.state(),before);
    assert.doesNotThrow(()=>g.send(1,{action:"attack",unitId:"p1-m1",targetId:"p2-ship",weapon:value}));
    assert.deepEqual(g.state(),before);
    assert.equal(rules.weapon(before.units[0],value),null);
    assert.equal(rules.canFire(before.units[0],value,2),false);
  }
  g.send(1,{action:"skill",unitId:"p1-m1",skill:"aim"});
  assert.equal(g.state().units.find(u=>u.id==="p1-m1").sp,75);
  g.send(1,{action:"attack",unitId:"p1-m1",targetId:"p2-ship",weapon:"gun"});
  assert.ok(g.state().pendingAttack);
});
test("invalid counter weapon preserves pending attack and permits valid response",()=>{
  const g=game();
  g.send(1,{action:"attack",unitId:"p1-m1",targetId:"p2-ship",weapon:"gun"});
  for(const weapon of invalid){
    const before=g.state();
    assert.doesNotThrow(()=>g.send(2,{action:"react",response:"counter",weapon}));
    assert.deepEqual(g.state(),before);
  }
  g.send(2,{action:"react",response:"counter",weapon:"gun"});
  assert.equal(g.state().pendingAttack,null);
});
for(const [count,active,defender,next,round] of [[3,1,2,2,1],[3,3,1,1,2],[2,1,2,1,1]]){
  test(`lethal counter: ${count} players, active ${active}`,()=>{
    const g=game(count,active);
    g.run(`unitById("p${active}-ship").hp=1;
      unitById("p${next}-m1").status.flash=true;`);
    g.send(active,{action:"attack",unitId:`p${active}-ship`,targetId:`p${defender}-ship`,weapon:"gun"});
    g.send(defender,{action:"react",response:"counter",weapon:"gun"});
    const s=g.state();
    assert.equal(s.pendingAttack,null);
    assert.ok(s.units.filter(u=>u.owner===active).every(u=>u.hp===0));
    assert.equal(s.round,round);
    if(count===2){
      assert.equal(s.winner,defender);
      assert.equal(s.activePlayer,active);
    }else{
      assert.equal(s.winner,null);
      assert.equal(s.activePlayer,next);
      assert.equal(s.units.find(u=>u.id===`p${next}-m1`).status.flash,false);
      g.send(next,{action:"skill",unitId:`p${next}-m1`,skill:"aim"});
      assert.equal(g.state().units.find(u=>u.id===`p${next}-m1`).sp,75);
    }
  });
}
test("surviving attacker keeps its turn after a counter",()=>{
  const g=game();
  g.send(1,{action:"attack",unitId:"p1-ship",targetId:"p2-ship",weapon:"gun"});
  g.send(2,{action:"react",response:"counter",weapon:"gun"});
  assert.equal(g.state().activePlayer,1);
  assert.equal(g.state().winner,null);
});
