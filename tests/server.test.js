const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const http = require("node:http");
const path = require("node:path");
const WebSocket = require("ws");

async function room(t) {
  let port;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."), env: { ...process.env, PORT: "0" }
  });
  const peers = [];
  let errors = "";
  child.stderr.on("data", chunk => { errors += chunk; });
  t.after(async () => {
    for (const peer of peers) peer.ws.terminate();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", chunk => {
      const match = chunk.toString().match(/http:\/\/localhost:(\d+)/);
      if (match) { port = Number(match[1]); resolve(); }
    });
    child.once("error", reject);
    child.once("exit", () => reject(new Error(errors || "Server terminato")));
  });
  async function connect(name) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages = [];
    const peer = { ws, id: null, state: null };
    ws.on("message", raw => {
      const message = JSON.parse(raw);
      if (message.type === "state") peer.state = message.state;
      messages.push(message);
    });
    peer.next = predicate => new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`Messaggio non ricevuto. ${errors}`)), 2000);
      function finish(error, message) {
        clearTimeout(timer);
        ws.off("message", check);
        ws.off("close", closed);
        if (error) reject(error); else resolve(message);
      }
      function check() {
        const index = messages.findIndex(predicate);
        if (index >= 0) finish(null, messages.splice(0, index + 1).at(-1));
      }
      function closed() { finish(new Error(`Connessione chiusa. ${errors}`)); }
      ws.on("message", check);
      ws.on("close", closed);
      check();
    });
    peer.send = message => ws.send(JSON.stringify(message));
    peer.update = () => peer.next(message => message.type === "state");
    peer.close = async () => { ws.close(); await once(ws, "close"); };
    peers.push(peer);
    await peer.next(message => message.type === "hello");
    if (name) {
      peer.send({ type: "join", name });
      peer.id = (await peer.next(message => message.type === "joined")).playerId;
      await peer.update();
    }
    return peer;
  }
  async function start(count = 2) {
    const pilots = [];
    for (let i = 0; i < count; i++) pilots.push(await connect(`Pilota ${i + 1}`));
    pilots[0].send({ action: "start" });
    await pilots[0].next(message => message.type === "state" && message.state?.started);
    for (const pilot of pilots.slice(1)) await pilot.next(message => message.type === "state" && message.state?.started);
    return pilots;
  }
  async function act(peer, action) {
    peer.send(action);
    return (await peer.update()).state;
  }
  async function cycle(first, second) {
    await act(first, { action: "endTurn" });
    await second.next(message => message.type === "state" && message.state?.activePlayer === second.id);
    await act(second, { action: "endTurn" });
    await first.next(message => message.type === "state" && message.state?.activePlayer === first.id);
  }
  function request(url) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: "127.0.0.1", port, path: url }, res => {
        let body = "";
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
      }).on("error", reject);
    });
  }
  return { connect, start, act, cycle, request };
}

test("HTTP serve il gioco e gestisce URL malformati senza terminare", { timeout: 8000 }, async t => {
  const game = await room(t);
  const page = await game.request("/");
  assert.equal(page.status, 200);
  assert.match(page.body, /client.js/);
  assert.match((await game.request("/client.js")).headers["content-type"], /javascript/);
  assert.equal((await game.request("/assente")).status, 404);
  assert.equal((await game.request("/../package.json")).status, 403);
  assert.equal((await game.request("/%ZZ")).status, 400);
  assert.equal((await game.request("/%00")).status, 400);
  assert.equal((await game.request("/")).status, 200);
});

test("lobby: limiti, solo host, posto liberato e nuovo host", { timeout: 10000 }, async t => {
  const game = await room(t);
  const first = await game.connect("Primo");
  first.send({ action: "start" });
  assert.match((await first.next(m => m.type === "error")).message, /almeno 2/);
  const second = await game.connect("Secondo");
  const third = await game.connect("Terzo");
  const fourth = await game.connect();
  fourth.send({ type: "join", name: "Quarto" });
  assert.match((await fourth.next(m => m.type === "error")).message, /piena/);
  second.send({ action: "start" });
  assert.match((await second.next(m => m.type === "error")).message, /host/);
  await first.close();
  const lobby = await second.next(m => m.type === "state" && m.players.length === 2);
  assert.deepEqual(lobby.players.map(p => p.id), [second.id, third.id]);
  fourth.send({ type: "join", name: "Quarto" });
  await fourth.next(m => m.type === "joined");
  second.send({ action: "start" });
  const started = await second.next(m => m.type === "state" && m.state?.started);
  assert.equal(started.state.units.length, 15);
  assert.equal(started.state.activePlayer, second.id);
});

test("movimento autorevole: turni, blocchi, limiti e una sola mossa", { timeout: 8000 }, async t => {
  const game = await room(t);
  const [first, second] = await game.start();
  const unitId = `p${first.id}-m1`;
  const initial = structuredClone(first.state.units);
  second.send({ action: "move", unitId, x: 2, y: 0 });
  first.send({ action: "move", unitId, x: 3, y: 1 });
  first.send({ action: "move", unitId, x: 5, y: 1 });
  first.send({ action: "move", unitId, x: -1, y: 0 });
  first.send({ action: "move", unitId, x: 2.5, y: 0 });
  first.send({ action: "move", unitId: `p${first.id}-ship`, x: 0, y: 0 });
  // Una mossa valida funge anche da barriera per i comandi precedenti.
  const moved = await game.act(first, { action: "move", unitId, x: 2, y: 0 });
  const unit = moved.units.find(u => u.id === unitId);
  assert.deepEqual({ x: unit.x, y: unit.y, moved: unit.moved }, { x: 2, y: 0, moved: true });
  assert.deepEqual(moved.units.filter(u => u.id !== unitId), initial.filter(u => u.id !== unitId));
  first.send({ action: "move", unitId, x: 3, y: 0 });
  const ended = await game.act(first, { action: "endTurn" });
  assert.equal(ended.units.find(u => u.id === unitId).x, 2);
  assert.equal(ended.activePlayer, second.id);
  await second.next(m => m.type === "state" && m.state?.activePlayer === second.id);
  await game.act(second, { action: "endTurn" });
  const next = await first.next(m => m.type === "state" && m.state?.activePlayer === first.id);
  assert.equal(next.state.round, 2);
  assert.equal(next.state.units.find(u => u.id === unitId).moved, false);
});

test("messaggi WebSocket non validi non interrompono la partita", { timeout: 8000 }, async t => {
  const game = await room(t);
  const [first, second] = await game.start();
  first.ws.send("non-json");
  for (const message of [null, [], 42, "test", {}]) first.send(message);
  const state = await game.act(first, { action: "endTurn" });
  assert.equal(state.activePlayer, second.id);
});

test("flotte a fazioni, skill, risorse e scadenza Flash", { timeout: 10000 }, async t => {
  const game=await room(t);
  const [first,second]=await game.start();
  const mine=()=>first.state.units.filter(u=>u.owner===first.id);
  assert.equal(mine().length,5);
  assert.equal(mine().filter(u=>u.type==="ship").length,1);
  assert.equal(mine().filter(u=>u.type==="mech").length,4);
  assert.equal(mine()[0].name,"Ptolemaios");
  assert.equal(mine()[1].name,"Exia");
  assert.ok(mine()[2].armor>mine()[3].armor);
  assert.ok(mine()[4].evasion>mine()[2].evasion);
  const id=`p${first.id}-m1`,ally=`p${first.id}-m2`;
  let s=await game.act(first,{action:"skill",unitId:id,skill:"aim"});
  assert.equal(s.units.find(u=>u.id===id).status.aim,true);
  assert.equal(s.units.find(u=>u.id===id).sp,75);
  s=await game.act(first,{action:"skill",unitId:id,skill:"flash"});
  assert.equal(s.units.find(u=>u.id===id).status.flash,true);
  s=await game.act(first,{action:"skill",unitId:id,skill:"foresight",targetId:ally});
  assert.equal(s.units.find(u=>u.id===ally).status.aim,true);
  assert.equal(s.units.find(u=>u.id===ally).status.flash,true);
  assert.equal(s.units.find(u=>u.id===id).sp,10);
  s=await game.act(first,{action:"endTurn"});
  assert.equal(s.units.find(u=>u.id===id).status.flash,true);
  await second.next(m=>m.type==="state"&&m.state?.activePlayer===second.id);
  await game.act(second,{action:"endTurn"});
  s=(await first.next(m=>m.type==="state"&&m.state?.activePlayer===first.id)).state;
  assert.equal(s.units.find(u=>u.id===id).status.flash,false);
  assert.equal(s.units.find(u=>u.id===ally).status.flash,false);
  assert.equal(s.units.find(u=>u.id===ally).status.aim,true);
});

test("attacco attende la scelta del difensore e Defend applica armor prima del 25%", { timeout: 20000 }, async t => {
  const game=await room(t);
  const [first,second]=await game.start();
  const id=`p${first.id}-m1`,targetId=`p${second.id}-m3`;
  for(const [x,y] of [[2,0],[6,0],[10,0],[14,0],[14,4],[14,8],[14,12],[14,16]]){
    await game.act(first,{action:"move",unitId:id,x,y});
    await game.cycle(first,second);
  }
  let target=first.state.units.find(u=>u.id===targetId);
  const before=target.hp;
  const attacker=first.state.units.find(u=>u.id===id);
  assert.ok(Math.abs(attacker.x-target.x)+Math.abs(attacker.y-target.y)<=5);
  await game.act(first,{action:"skill",unitId:id,skill:"aim"});
  let s=await game.act(first,{action:"attack",unitId:id,targetId,weapon:"laser"});
  assert.ok(s.pendingAttack);
  assert.equal(s.units.find(u=>u.id===targetId).hp,before);
  // Il difensore può rispondere fuori dal proprio turno; l'attacco con Aim colpisce.
  second.send({action:"react",response:"defend"});
  s=(await second.next(m=>m.type==="state"&&m.state?.pendingAttack===null&&m.state?.units.find(u=>u.id===targetId).hp<before)).state;
  target=s.units.find(u=>u.id===targetId);
  const weapon=require("../public/rules").weapon(attacker,"laser");
  const dealt=before-target.hp;
  const lower=Math.round(Math.max(0,Math.round(weapon.damage*.96)-target.armor)*.75);
  const upper=Math.round(Math.max(0,Math.round(weapon.damage*1.04)-target.armor)*.75);
  assert.ok(dealt>=lower-1&&dealt<=upper+1,`Danno ${dealt}, atteso ${lower}..${upper}`);
  assert.equal(s.pendingAttack,null);
  assert.equal(s.units.find(u=>u.id===id).en,75);
  await game.cycle(first,second);
  // Counter consuma le risorse del difensore anche fuori dal suo turno.
  const another=`p${second.id}-m4`;
  const ammoBefore=first.state.units.find(u=>u.id===another).ammo;
  await game.act(first,{action:"attack",unitId:id,targetId:another,weapon:"laser"});
  second.send({action:"react",response:"counter",weapon:"gun"});
  const countered=(await second.next(m=>m.type==="state"&&m.state?.pendingAttack===null
    &&m.state?.units.find(u=>u.id===another).ammo===ammoBefore-2)).state;
  assert.equal(countered.units.find(u=>u.id===another).ammo,ammoBefore-2);
});

test("disconnessione: resa, salto turno e stanza nuovamente disponibile", { timeout: 10000 }, async t => {
  const game = await room(t);
  const [first, second, third] = await game.start(3);
  await first.close();
  const forfeited = await second.next(m => m.type === "state" && m.state?.activePlayer === second.id);
  assert.ok(forfeited.state.units.filter(u => u.owner === first.id).every(u => u.hp === 0));
  assert.equal(forfeited.state.winner, null);
  await second.close();
  const won = await third.next(m => m.type === "state" && m.state?.winner === third.id);
  assert.equal(won.state.winner, third.id);
  await third.close();
  const replacement = await game.connect("Nuova partita");
  assert.equal(replacement.state, null);
  const other = await game.connect("Altro pilota");
  replacement.send({ action: "start" });
  const restarted = await replacement.next(m => m.type === "state" && m.state?.started);
  assert.deepEqual(restarted.players.map(p => p.id), [replacement.id, other.id]);
});


test("Capital Ship: movimento lento consentito una volta per turno", {timeout:8000}, async t => {
  const game = await room(t);
  const [first, second] = await game.start();
  const id = `p${first.id}-ship`;
  const start = first.state.units.find(u => u.id === id);
  assert.equal(start.move, 1);
  const moved = await game.act(first, {action:"move",unitId:id,x:0,y:1});
  assert.deepEqual([moved.units.find(u=>u.id===id).x,moved.units.find(u=>u.id===id).y],[0,1]);
  first.send({action:"move",unitId:id,x:0,y:0});
  const after = await game.act(first,{action:"endTurn"});
  assert.deepEqual([after.units.find(u=>u.id===id).x,after.units.find(u=>u.id===id).y],[0,1]);
  await second.next(m=>m.type==="state"&&m.state?.activePlayer===second.id);
  await game.act(second,{action:"endTurn"});
  const reset = await first.next(m=>m.type==="state"&&m.state?.activePlayer===first.id);
  assert.equal(reset.state.units.find(u=>u.id===id).moved,false);
});

test("fazioni esplicite: uniche, valide e rispettate in partita",{timeout:10000},async t=>{
  const game=await room(t);
  const first=await game.connect();
  first.send({type:"join",name:"A",faction:"codegeass"});
  first.id=(await first.next(m=>m.type==="joined")).playerId;
  await first.update();
  const second=await game.connect();
  second.send({type:"join",name:"B",faction:"codegeass"});
  assert.match((await second.next(m=>m.type==="error")).message,/già scelta/i);
  second.send({type:"join",name:"B",faction:"invalid"});
  assert.match((await second.next(m=>m.type==="error")).message,/non valida/i);
  second.send({type:"join",name:"B",faction:"macross"});
  second.id=(await second.next(m=>m.type==="joined")).playerId;
  const lobby=await second.update();
  assert.deepEqual(lobby.players.map(p=>p.faction),["codegeass","macross"]);
  first.send({action:"start"});
  const started=await first.next(m=>m.type==="state"&&m.state?.started);
  const firstNames=started.state.units.filter(u=>u.owner===first.id).map(u=>u.name);
  const secondNames=started.state.units.filter(u=>u.owner===second.id).map(u=>u.name);
  assert.deepEqual(firstNames,["Damocles","Gekkoei","Guren","Lancelot","Sutherland Sieg"]);
  assert.deepEqual(secondNames,["Macross Quarter","VF-25F Messiah","VF-25G Messiah","VB-6 König Monster","Queadluun-Rhea"]);
  assert.equal(new Set(started.state.units.map(u=>u.name)).size,10);
});

test("le armi sono specifiche per unità e non accettano identificatori arbitrari",()=>{
  const factions=require("../public/factions"),rules=require("../public/rules");
  assert.equal(factions.factions.length,4);
  for(const faction of factions.factions){
    const units=factions.buildRoster(faction.id);
    assert.equal(units.length,5);
    assert.equal(units.filter(u=>u.type==="ship").length,1);
    const labels=[];
    for(const unit of units){
      assert.deepEqual(Object.keys(unit.weapons),["melee","gun","laser","special"]);
      labels.push(...Object.values(unit.weapons).map(w=>w.label));
      assert.equal(rules.weapon({...unit,hp:unit.hp,en:100,ammo:16,vt:100},"special").vt,120);
      assert.equal(rules.canFire({...unit,hp:unit.hp,en:100,ammo:16,vt:100},"special",3),false);
      assert.equal(rules.canFire({...unit,hp:unit.hp,en:100,ammo:16,vt:120},"special",3),true);
    }
    assert.equal(new Set(labels).size,20);
  }
  assert.equal(rules.weapon({weapons:{gun:{label:"Test"}}},"__proto__"),null);
});
