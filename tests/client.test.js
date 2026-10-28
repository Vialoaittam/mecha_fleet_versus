const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Solo gli elementi usati dal client: i test verificano eventi e messaggi,
// senza simulare il layout o il rendering di un browser.
function client() {
  const elements = new Map();
  function element() {
    let html = "";
    return {
      textContent: "", value: "Pilota", disabled: false, style: {}, children: [],
      classList: { add() {}, remove() {} },
      get innerHTML() { return html; },
      set innerHTML(value) { html = value; this.children = []; },
      appendChild(child) { this.children.push(child); },
      querySelectorAll() { return this.children; },
      click() { if (!this.disabled) this.onclick?.(); }
    };
  }
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], element());
  const get = id => elements.get(id);
  const canvas = get("board");
  Object.assign(canvas, {
    width: 800, height: 800, clientWidth: 400, clientHeight: 400, clientLeft: 1, clientTop: 1,
    getContext: () => new Proxy({}, { get: () => () => {} }),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 402, height: 402 }),
    addEventListener: (event, handler) => { canvas[event] = handler; }
  });
  class Socket {
    static OPEN = 1;
    readyState = 0;
    messages = [];
    constructor() { Socket.instance = this; }
    send(message) { this.messages.push(JSON.parse(message)); }
  }
  const context = vm.createContext({
    document: { getElementById: get, createElement: element },
    location: { protocol: "http:", host: "localhost:8080" }, WebSocket: Socket
  });
  for (const file of ["movement.js", "factions.js", "rules.js", "client.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public", file), "utf8"), context);
  }
  const ws = Socket.instance;
  const receive = data => ws.onmessage({ data: JSON.stringify(data) });
  const open = () => { ws.readyState = Socket.OPEN; ws.onopen(); };
  const clickCell = (x, y) => canvas.click({ clientX: 11 + (x + 0.5) * 20, clientY: 21 + (y + 0.5) * 20 });
  return { get, ws, receive, open, clickCell, read: expression => vm.runInContext(expression, context) };
}

function started(client) {
  client.open();
  client.receive({ type: "joined", playerId: 1 });
  const state = {
    started: true, activePlayer: 1, round: 1, winner: null, log: [],
    units: [1, 2].map(id => ({
      id: `p${id}-m1`, owner: id, type: "mech", name: "Mech 1", x: id + 1, y: 1,
      hp: 110, maxHp: 110, en: 100, maxEn: 100, ammo: 12, maxAmmo: 12,
      vt: 100, moved: false, acted: false, move: 4, color: "#5aa9ff"
    }))
  };
  const players = [{ id: 1, name: "Uno", connected: true }, { id: 2, name: "Due", connected: true }];
  client.receive({ type: "state", state, players });
  return { state, players };
}

test("ingresso disabilitato senza connessione e ripetibile dopo un rifiuto", () => {
  const c = client();
  assert.equal(c.get("join").disabled, true);
  c.open();
  assert.equal(c.get("join").disabled, false);
  c.get("join").click();
  assert.equal(c.get("join").disabled, true);
  c.receive({ type: "error", message: "Stanza piena" });
  assert.equal(c.get("join").disabled, false);
  assert.equal(c.get("lobbyStatus").textContent, "Stanza piena");
});

test("selezione su canvas scalato e istruzioni visibili nella partita", () => {
  const c = client();
  started(c);
  c.clickCell(2, 1);
  assert.equal(c.read("selected"), "p1-m1");
  c.get("actions").children.find(b => b.textContent.includes("Muovi")).click();
  assert.match(c.get("actionStatus").textContent, /casella/);
  c.clickCell(2, 0);
  assert.deepEqual(c.ws.messages.at(-1), { action: "move", unitId: "p1-m1", x: 2, y: 0 });
});

test("un cambio turno annulla il bersaglio pendente e permette di selezionare", () => {
  const c = client();
  const { state, players } = started(c);
  c.clickCell(2, 1);
  c.get("actions").children.find(b => b.textContent.includes("Laser")).click();
  state.activePlayer = 2;
  c.receive({ type: "state", state, players });
  c.clickCell(3, 1);
  assert.equal(c.read("selected"), "p2-m1");
  assert.equal(c.get("actions").children.length, 0);
});

test("disconnessione disabilita tutte le azioni", () => {
  const c = client();
  started(c);
  c.clickCell(2, 1);
  c.ws.readyState = 3;
  c.ws.onclose();
  assert.equal(c.get("endTurn").disabled, true);
  assert.equal(c.get("join").disabled, true);
  assert.equal(c.get("start").disabled, true);
  assert.equal(c.get("actions").children.length, 0);
  assert.match(c.get("actionStatus").textContent, /ricarica/i);
});

test("bersaglio non valido mostra il motivo e l'azione si può annullare", () => {
  const c = client();
  started(c);
  c.clickCell(2, 1);
  c.get("actions").children.find(b => b.textContent.includes("Laser")).click();
  c.clickCell(3, 1);
  assert.equal(c.ws.messages.length, 0);
  assert.match(c.get("actionStatus").textContent, /distanza 2–5/);
  c.clickCell(2, 1);
  c.clickCell(3, 1);
  assert.equal(c.read("selected"), "p2-m1");
});

test("il difensore sceglie la reazione anche durante il turno avversario", () => {
  const c=client();
  const {state,players}=started(c);
  state.activePlayer=2;
  state.pendingAttack={attackerId:"p2-m1",targetId:"p1-m1",defenderOwner:1,weapon:"laser"};
  c.receive({type:"state",state,players});
  const defend=c.get("reactionPanel").children.find(x=>x.textContent.includes("Defend"));
  assert.ok(defend);
  defend.click();
  assert.equal(c.ws.messages.at(-1).action,"react");
  assert.equal(c.ws.messages.at(-1).response,"defend");
  assert.equal(c.get("endTurn").disabled,true);
});

test("le skill personali consumano un comando dedicato e le speciali richiedono VT", () => {
  const c=client();
  const {state,players}=started(c);
  state.units[0].sp=100;
  state.units[0].maxSp=100;
  state.units[0].status={aim:false,flash:false,invincible:false};
  state.units[0].special={name:"Beam Burst",damage:7000,vt:120,en:40,min:2,max:6};
  c.receive({type:"state",state,players});
  c.clickCell(2,1);
  const special=c.get("actions").children.find(x=>x.textContent.includes("Beam Burst"));
  assert.equal(special.disabled,true);
  c.get("actions").children.find(x=>x.textContent.includes("Aim")).click();
  assert.equal(c.ws.messages.at(-1).action,"skill");
  assert.equal(c.ws.messages.at(-1).skill,"aim");
});
