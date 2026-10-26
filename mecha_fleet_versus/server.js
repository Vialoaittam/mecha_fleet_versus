const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");
const reachableCells = require("./public/movement");

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent((req.url || "/").split("?")[0]); }
  catch { res.writeHead(400); return res.end("Bad request"); }
  if (pathname.includes("\0")) { res.writeHead(400); return res.end("Bad request"); }
  if (pathname === "/") pathname = "/index.html";
  const target = path.normalize(path.join(PUBLIC, pathname));
  if (!target.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(target)] || "application/octet-stream", "Cache-Control":"no-store" });
    res.end(data);
  });
});
const wss = new WebSocket.Server({ server });
let players = [];
let state = null;
let nextPlayerId = 1;
const sockets = new Map();

function send(ws, obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function broadcast(obj) { for (const ws of wss.clients) send(ws, obj); }
function snapshot() {
  return { type:"state", state: state ? JSON.parse(JSON.stringify(state)) : null,
    players: players.map(p => ({id:p.id,name:p.name,team:p.team,connected:!!p.ws})) };
}
function publish() { broadcast(snapshot()); }
function createState() {
  const teamDefs = [
    {x:1,y:1,dx:1,dy:1,color:"#5aa9ff"},
    {x:18,y:18,dx:-1,dy:-1,color:"#ff6b6b"},
    {x:18,y:1,dx:-1,dy:1,color:"#c084fc"}
  ];
  const units = [];
  players.forEach((p, idx) => {
    const d = teamDefs[idx];
    units.push({id:`p${p.id}-ship`, owner:p.id, team:idx, type:"ship", name:"Capital Ship", x: d.x, y:d.y, hp:260, maxHp:260, en:100, maxEn:100, ammo:30, maxAmmo:30, vt:100, moved:false, acted:false, color:d.color, move:1});
    const offsets = [[1,0],[0,1],[2,0],[0,2],[2,1],[1,2]];
    offsets.forEach((o,i) => {
      const x = Math.max(0,Math.min(19,d.x + d.dx*o[0]));
      const y = Math.max(0,Math.min(19,d.y + d.dy*o[1]));
      units.push({id:`p${p.id}-m${i+1}`, owner:p.id, team:idx, type:i===5?"support":"mech", name:i===5?"Support":"Mech "+(i+1), x,y,
        hp:i===5?85:110, maxHp:i===5?85:110, en:100, maxEn:100, ammo:12, maxAmmo:12, vt:100, moved:false, acted:false, color:d.color, move:i===5?3:4});
    });
  });
  return { started:true, turn:0, activePlayer:players[0].id, round:1, units, log:["Partita iniziata. Elimina le Capital Ship avversarie."], winner:null };
}
function currentPlayer() { return players.find(p => p.id === state?.activePlayer); }
function unitById(id) { return state?.units.find(u => u.id === id); }
function log(msg) { state.log.unshift(msg); state.log = state.log.slice(0,10); }
function dist(a,b) { return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function occupied(x,y,except) { return state.units.some(u=>u.hp>0 && u.id!==except && u.x===x && u.y===y); }
function validActor(p,u) { return state && state.started && !state.winner && state.activePlayer===p.id && u && u.owner===p.id && u.hp>0; }
function endTurn(p) {
  if (state.activePlayer !== p.id) return;
  for (const u of state.units.filter(u=>u.owner===p.id && u.hp>0)) { u.moved=false; u.acted=false; u.en=Math.min(u.maxEn,u.en+8); }
  const alive = players.filter(pl => state.units.some(u=>u.owner===pl.id && u.type==="ship" && u.hp>0));
  if (alive.length <= 1) { state.winner = alive[0]?.id || null; log(state.winner ? `${alive[0].name} vince!` : "Pareggio."); publish(); return; }
  const idx = players.findIndex(pl=>pl.id===p.id);
  let next = null;
  for (let step=1; step<=players.length; step++) {
    const candidate = players[(idx+step)%players.length];
    if (alive.some(a=>a.id===candidate.id)) { next=candidate; break; }
  }
  if (!next) return;
  if (players.findIndex(pl=>pl.id===next.id) <= idx) state.round++;
  state.activePlayer = next.id;
  log(`Turno di ${next.name}.`);
  publish();
}
function handleAction(p, msg) {
  if (!state || !state.started || state.winner) return;
  if (msg.action === "endTurn") { endTurn(p); return; }
  const u = unitById(msg.unitId);
  if (!validActor(p,u)) return;
  if (msg.action === "move") {
    if (u.moved || u.move<=0) return;
    const x=Number(msg.x), y=Number(msg.y);
    if (!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=20||y<0||y>=20||occupied(x,y,u.id)) return;
    if (!reachableCells(u,state.units).some(cell=>cell.x===x && cell.y===y)) return;
    u.x=x; u.y=y; u.moved=true; log(`${u.name} si sposta.`); publish(); return;
  }
  if (msg.action === "attack") {
    if (u.acted) return;
    if (!["melee","gun","laser"].includes(msg.weapon)) return;
    const target=unitById(msg.targetId);
    if (!target || target.owner===p.id || target.hp<=0 || dist(u,target)>5) return;
    const melee = msg.weapon==="melee";
    if (melee && dist(u,target)>1) return;
    if (!melee && dist(u,target)<2) return;
    if (msg.weapon==="laser") { if(u.en<25) return; u.en-=25; }
    else if (msg.weapon==="gun") { if(u.ammo<2) return; u.ammo-=2; }
    const baseDamage = melee ? 32 + Math.floor(u.vt/25) : (msg.weapon==="laser"?42:25) + Math.floor(u.vt/30);
    const damage = u.type==="ship" ? Math.round(baseDamage*1.75) : baseDamage;
    target.hp=Math.max(0,target.hp-damage); u.acted=true;
    u.vt=Math.min(150,u.vt+8); target.vt=Math.min(150,target.vt+5);
    log(`${u.name} colpisce ${target.name}: ${damage} danni.`);
    if(target.type==="ship" && target.hp===0) {
      for (const defeated of state.units.filter(z=>z.owner===target.owner)) defeated.hp=0;
      const remaining=players.filter(pl=>state.units.some(z=>z.owner===pl.id&&z.type==="ship"&&z.hp>0));
      if(remaining.length===1){state.winner=remaining[0].id;log(`${remaining[0].name} vince: Capital Ship nemica distrutta!`);}
      else log(`Capital Ship di ${players.find(pl=>pl.id===target.owner)?.name||"un avversario"} distrutta!`);
    }
    publish(); return;
  }
  if (msg.action === "resupply" || msg.action === "repair") {
    if (u.acted || (u.type!=="support" && u.type!=="ship")) return;
    const target=unitById(msg.targetId);
    if (!target || target.owner!==p.id || target.hp<=0 || dist(u,target)>2 || target.id===u.id) return;
    if(msg.action==="resupply"){target.en=Math.min(target.maxEn,target.en+45);target.ammo=Math.min(target.maxAmmo,target.ammo+6);log(`${u.name} rifornisce ${target.name}.`);}
    else {target.hp=Math.min(target.maxHp,target.hp+30);log(`${u.name} ripara ${target.name}.`);}
    u.acted=true; publish();
  }
}
wss.on("connection", ws => {
  sockets.set(ws, null);
  send(ws,{type:"hello",version:"0.1.0"});
  send(ws,snapshot());
  ws.on("message", raw => {
    let msg; try { msg=JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg!=="object" || Array.isArray(msg)) return;
    if (msg.type==="join") {
      if (sockets.get(ws)) return;
      if (players.length>=3 || (state && state.started)) { send(ws,{type:"error",message:"Stanza piena o partita già iniziata."}); return; }
      const p={id:nextPlayerId++,name:String(msg.name||"Pilota").slice(0,18),team:players.length,ws};
      players.push(p); sockets.set(ws,p.id);
      send(ws,{type:"joined",playerId:p.id});
      log;
      publish(); return;
    }
    const id=sockets.get(ws), p=players.find(x=>x.id===id);
    if (!p) return;
    if(msg.action==="start") {
      if(players[0]?.id!==p.id){send(ws,{type:"error",message:"Solo l'host può avviare la partita."});return;}
      if(players.length<2){send(ws,{type:"error",message:"Servono almeno 2 giocatori."});return;}
      if(!state) { state=createState(); log(`${p.name} ha avviato la partita.`); publish(); }
      return;
    }
    handleAction(p,msg);
  });
  ws.on("close", () => {
    const id=sockets.get(ws); sockets.delete(ws);
    const p=players.find(x=>x.id===id);
    if (!p) return;
    p.ws=null;
    if (!state) {
      players=players.filter(x=>x.id!==id);
      players.forEach((player,idx)=>{player.team=idx;});
    } else if (!state.winner) {
      for (const unit of state.units.filter(u=>u.owner===id)) unit.hp=0;
      log(`${p.name} si è disconnesso: resa della flotta.`);
      const alive=players.filter(pl=>state.units.some(u=>u.owner===pl.id && u.type==="ship" && u.hp>0));
      if (alive.length===1) { state.winner=alive[0].id; log(`${alive[0].name} vince!`); }
      else if (state.activePlayer===id) endTurn(p);
    }
    if (players.every(player=>!player.ws)) { players=[]; state=null; }
    publish();
  });
});
server.listen(PORT,"0.0.0.0",()=>{
  const port=server.address().port;
  console.log(`Mecha Fleet Versus: http://localhost:${port}`);
  const nets=os.networkInterfaces();
  for(const list of Object.values(nets)) for(const n of (list||[])) if(n.family==="IPv4"&&!n.internal) console.log(`LAN: http://${n.address}:${port}`);
});
