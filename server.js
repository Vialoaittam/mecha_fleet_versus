const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");
const reachableCells = require("./public/movement");
const MechRules = require("./public/rules");

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
  const ships = [
    {name:"Yamato",special:"Wave Motion Gun",damage:11500},
    {name:"Nadesico",special:"Gravity Blast",damage:10500},
    {name:"Macross",special:"Daedalus Attack",damage:11000}
  ];
  const supers = [
    ["Mazinger Z","Breast Fire"],["Getter Robo","Getter Beam"],
    ["Grendizer","Space Thunder"],["Combattler V","Choudenji Spin"],
    ["Daitarn 3","Sun Attack"],["Gaogaigar","Hell and Heaven"]
  ];
  const reals = [
    ["RX-78 Gundam","Beam Saber Burst"],["Zeta Gundam","Hyper Mega Launcher"],
    ["Nu Gundam","Fin Funnel Barrage"],["Wing Zero","Twin Buster Rifle"],
    ["Strike Freedom","Full Burst"],["Exia","Trans-Am Slash"],
    ["L-Gaim","Buster Launcher"],["Dunbine","Aura Slash"],
    ["Valkyrie VF-1","Missile Storm"],["Scopedog","Arm Punch"],
    ["F91 Gundam","VSBR"],["Aerial","GUND-BIT"]
  ];
  const supports = [
    ["Methuss","Repair Beam"],["Boss Borot","Borot Punch"],["Ra Cailum Escort","Escort Cannon"]
  ];
  // Assegnazione casuale senza ripetizioni tra le flotte della stessa partita.
  for (const pool of [ships,supers,reals,supports])
    for (let i=pool.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }
  const units=[];
  players.forEach((p,idx)=>{
    const d=teamDefs[idx], ship=ships[idx];
    const roster=[
      {type:"ship",name:ship.name,special:ship.special,damage:ship.damage,hp:28000,armor:1500,evasion:.06,accuracy:.04,move:1},
      ...supers.slice(idx*2,idx*2+2).map(([name,special])=>({type:"super",name,special,damage:8500,hp:15000,armor:1150,evasion:.07,accuracy:.04,move:4})),
      ...reals.slice(idx*4,idx*4+4).map(([name,special])=>({type:"real",name,special,damage:7200,hp:7500,armor:300,evasion:.27,accuracy:.08,move:4})),
      {type:"support",name:supports[idx][0],special:supports[idx][1],damage:3900,hp:9000,armor:500,evasion:.12,accuracy:.05,move:3}
    ];
    const offsets=[[0,0],[1,0],[0,1],[2,0],[0,2],[2,1],[1,2],[3,0]];
    roster.forEach((r,i)=>{
      const [ox,oy]=offsets[i];
      const x=d.x+d.dx*ox,y=d.y+d.dy*oy;
      units.push({
        id:i===0?`p${p.id}-ship`:`p${p.id}-m${i}`,
        owner:p.id,team:idx,type:r.type,name:r.name,x,y,
        hp:r.hp,maxHp:r.hp,armor:r.armor,evasion:r.evasion,accuracy:r.accuracy,
        en:100,maxEn:100,ammo:16,maxAmmo:16,sp:100,maxSp:100,vt:100,
        moved:false,acted:false,color:d.color,move:r.move,
        special:{name:r.special,damage:r.damage,vt:120,en:40,min:2,max:r.type==="ship"?8:6},
        status:{aim:false,flash:false,invincible:false}
      });
    });
  });
  return {started:true,turn:0,activePlayer:players[0].id,round:1,units,
    log:["Partita iniziata: 2 Super, 4 Real, 1 Support e 1 Capital Ship per pilota."],
    pendingAttack:null,winner:null};
}
function currentPlayer() { return players.find(p => p.id === state?.activePlayer); }
function unitById(id) { return state?.units.find(u => u.id === id); }
function log(msg) { state.log.unshift(msg); state.log = state.log.slice(0,10); }
function dist(a,b) { return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function occupied(x,y,except) { return state.units.some(u=>u.hp>0 && u.id!==except && u.x===x && u.y===y); }
function validActor(p,u) { return state && state.started && !state.winner && state.activePlayer===p.id && u && u.owner===p.id && u.hp>0; }
function defeatShip(target) {
  if(target.type!=="ship"||target.hp>0)return;
  for(const unit of state.units.filter(u=>u.owner===target.owner))unit.hp=0;
  const alive=players.filter(p=>state.units.some(u=>u.owner===p.id&&u.type==="ship"&&u.hp>0));
  if(alive.length===1){state.winner=alive[0].id;log(`${alive[0].name} vince: Capital Ship nemica distrutta!`);}
  else log(`Capital Ship di ${players.find(p=>p.id===target.owner)?.name||"un avversario"} distrutta!`);
}
function strike(attacker,target,weaponId,defense) {
  if(!attacker||!target||attacker.hp<=0||target.hp<=0)return false;
  if(!MechRules.canFire(attacker,weaponId,dist(attacker,target)))return false;
  const w=MechRules.weapon(attacker,weaponId);
  attacker.en-=w.en;attacker.ammo-=w.ammo;
  const aimed=!!attacker.status.aim && state.activePlayer===attacker.owner;
  if(aimed)attacker.status.aim=false;
  const flashed=!!target.status.flash;
  if(flashed)target.status.flash=false;
  let chance=Math.max(.05,Math.min(.95,w.accuracy+(attacker.accuracy||0)-(target.evasion||0)+(attacker.vt-100)/500));
  if(defense==="evade")chance=Math.max(.02,chance-.25);
  if(aimed)chance=1;
  if(flashed)chance=aimed?.5:0;
  const hit=Math.random()<chance;
  let damage=0;
  if(hit){
    damage=Math.max(0,Math.round(w.damage+(attacker.vt-100)*18)-(target.armor||0));
    if(defense==="defend")damage=Math.round(damage*.75);
    if(target.status.invincible && damage>0){damage=Math.min(damage,10);target.status.invincible=false;}
    target.hp=Math.max(0,target.hp-damage);
    log(`${attacker.name} usa ${w.label} su ${target.name}: ${damage} danni.`);
  }else log(`${target.name} evita ${w.label} di ${attacker.name} (${Math.round(chance*100)}%).`);
  attacker.vt=Math.min(150,attacker.vt+8);
  target.vt=Math.min(150,target.vt+5);
  defeatShip(target);
  return true;
}
function endTurn(p) {
  if(state.activePlayer!==p.id||state.pendingAttack)return;
  for(const u of state.units.filter(u=>u.owner===p.id&&u.hp>0)){
    u.moved=false;u.acted=false;
    u.en=Math.min(u.maxEn,u.en+8);
    u.sp=Math.min(u.maxSp,u.sp+10);
  }
  const alive=players.filter(pl=>state.units.some(u=>u.owner===pl.id&&u.type==="ship"&&u.hp>0));
  if(alive.length<=1){state.winner=alive[0]?.id||null;publish();return;}
  const idx=players.findIndex(pl=>pl.id===p.id);
  let next=null;
  for(let step=1;step<=players.length;step++){
    const candidate=players[(idx+step)%players.length];
    if(alive.some(a=>a.id===candidate.id)){next=candidate;break;}
  }
  if(!next)return;
  if(players.findIndex(pl=>pl.id===next.id)<=idx)state.round++;
  state.activePlayer=next.id;
  // Flash scade al ritorno del turno del proprietario, non alla fine del turno di lancio.
  for(const u of state.units.filter(u=>u.owner===next.id))u.status.flash=false;
  log(`Turno di ${next.name}.`);
  publish();
}
function resolveReaction(p,msg) {
  const pending=state.pendingAttack;
  if(!pending||p.id!==pending.defenderOwner)return;
  if(!["defend","evade","counter"].includes(msg.response))return;
  const attacker=unitById(pending.attackerId),target=unitById(pending.targetId);
  if(!attacker||!target||attacker.hp<=0||target.hp<=0){state.pendingAttack=null;publish();return;}
  if(msg.response==="counter"&&!MechRules.canFire(target,msg.weapon,dist(target,attacker)))return;
  state.pendingAttack=null;
  strike(attacker,target,pending.weapon,msg.response);
  if(msg.response==="counter"&&target.hp>0&&!state.winner)strike(target,attacker,msg.weapon,"normal");
  publish();
}
function handleAction(p,msg) {
  if(!state||!state.started||state.winner)return;
  if(msg.action==="react"){resolveReaction(p,msg);return;}
  if(state.pendingAttack)return;
  if(msg.action==="endTurn"){endTurn(p);return;}
  const u=unitById(msg.unitId);
  if(!validActor(p,u))return;
  if(msg.action==="move"){
    if(u.moved||u.move<=0)return;
    const x=Number(msg.x),y=Number(msg.y);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=20||y<0||y>=20||occupied(x,y,u.id))return;
    if(!reachableCells(u,state.units).some(cell=>cell.x===x&&cell.y===y))return;
    u.x=x;u.y=y;u.moved=true;log(`${u.name} si sposta.`);publish();return;
  }
  if(msg.action==="skill"){
    const skill=MechRules.skills[msg.skill];
    if(!skill||u.sp<skill.cost)return;
    const target=skill.target==="self"?u:unitById(msg.targetId);
    if(!target||target.hp<=0||target.owner!==p.id)return;
    if(skill.target==="other"&&target.id===u.id)return;
    if(msg.skill==="aim")u.status.aim=true;
    if(msg.skill==="flash")u.status.flash=true;
    if(msg.skill==="invincible")u.status.invincible=true;
    if(msg.skill==="foresight"){target.status.aim=true;target.status.flash=true;}
    if(msg.skill==="trust"||msg.skill==="gain")
      target.hp=Math.min(target.maxHp,target.hp+Math.ceil(target.maxHp*.25));
    u.sp-=skill.cost;
    log(`${u.name} usa ${skill.label}${target.id===u.id?"":` su ${target.name}`}.`);
    publish();return;
  }
  if(msg.action==="attack"){
    const target=unitById(msg.targetId);
    if(u.acted||!target||target.owner===p.id||target.hp<=0)return;
    if(!MechRules.canFire(u,msg.weapon,dist(u,target)))return;
    u.acted=true;
    state.pendingAttack={attackerId:u.id,targetId:target.id,defenderOwner:target.owner,weapon:msg.weapon};
    log(`${u.name} attacca ${target.name}: il difensore sceglie Counter, Defend o Evade.`);
    publish();return;
  }
  if(msg.action==="resupply"||msg.action==="repair"){
    if(u.acted||(u.type!=="support"&&u.type!=="ship"))return;
    const target=unitById(msg.targetId);
    if(!target||target.owner!==p.id||target.hp<=0||dist(u,target)>2||target.id===u.id)return;
    if(msg.action==="resupply"){
      target.en=Math.min(target.maxEn,target.en+45);
      target.ammo=Math.min(target.maxAmmo,target.ammo+6);
      log(`${u.name} rifornisce ${target.name}.`);
    }else{
      target.hp=Math.min(target.maxHp,target.hp+2500);
      log(`${u.name} ripara ${target.name}.`);
    }
    u.acted=true;publish();
  }
}
wss.on("connection", ws => {
  sockets.set(ws, null);
  send(ws,{type:"hello",version:"0.2.0"});
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
      if(state.pendingAttack && (state.pendingAttack.defenderOwner===id || state.activePlayer===id)) state.pendingAttack=null;
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
