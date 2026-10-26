
const $ = id => document.getElementById(id);
const canvas=$("board"), ctx=canvas.getContext("2d");
let ws=null, myId=null, players=[], state=null, selected=null, joined=false, joining=false, obstacles=[];
const TILE=40, SIZE=20;

function connect(){
  const proto=location.protocol==="https:"?"wss:":"ws:";
  ws=new WebSocket(`${proto}//${location.host}`);
  ws.onopen=()=>{
    $("connection").textContent="Connesso";
    $("connection").style.color="#68d391";
    renderAll();
  };
  ws.onclose=()=>{
    $("connection").textContent="Disconnesso";
    $("connection").style.color="#ff7272";
    joining=false;
    mode=null;
    renderAll();
    $("lobbyStatus").textContent="Connessione persa. Ricarica la pagina per entrare in una nuova partita.";
    $("actionStatus").textContent="Connessione persa. Ricarica la pagina; la flotta si arrende alla disconnessione.";
  };
  ws.onerror=()=>{$("connection").textContent="Errore connessione"};
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.type==="joined"){
      myId=m.playerId;
      joined=true;
      joining=false;
      $("lobbyStatus").textContent="Sei nella stanza. Aspetta gli altri piloti.";
    }
    if(m.type==="state"){
      if(state?.activePlayer!==m.state?.activePlayer || m.state?.winner || !m.state){
        mode=null;
        $("actionStatus").textContent="Seleziona un'unità e scegli un'azione.";
      }
      state=m.state;
      players=m.players||[];
      renderAll();
    }
    if(m.type==="error"){
      joining=false;
      renderAll();
      $("lobbyStatus").textContent=m.message;
    }
  };
  renderAll();
}

function send(obj){
  if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));
}

$("join").onclick=()=>{
  if(joined||joining||ws?.readyState!==WebSocket.OPEN)return;
  joining=true;
  send({type:"join",name:$("name").value.trim()||"Pilota"});
  $("join").disabled=true;
};
$("start").onclick=()=>send({action:"start"});
$("endTurn").onclick=()=>send({action:"endTurn"});

function renderAll(){
  const connected=ws?.readyState===WebSocket.OPEN;
  $("players").innerHTML=players.map((p,i)=>
    `<div class="playerRow"><span>${i===0?"★ ":""}${esc(p.name)}${p.id===myId?" (tu)":""}</span><span>${p.connected?"● online":"○ disconnesso"}</span></div>`
  ).join("");

  $("start").disabled=!(connected&&players[0]?.id===myId&&players.length>=2&&!state?.started);
  $("join").disabled=!connected||joining||joined||players.length>=3||!!state?.started;

  if(state?.started){
    $("lobby").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("turnInfo").textContent=state.winner
      ?`${players.find(p=>p.id===state.winner)?.name||"Un giocatore"} ha vinto!`
      :state.activePlayer===myId
        ?`Round ${state.round} · È il tuo turno`
        :`Round ${state.round} · Turno di ${players.find(p=>p.id===state.activePlayer)?.name||"avversario"}`;

    $("endTurn").disabled=!connected||state.activePlayer!==myId||!!state.winner||!!state.pendingAttack;
    draw();
    renderUnit();
    renderFleet();
    renderReaction();
    $("log").innerHTML=state.log.map(x=>`<div>${esc(x)}</div>`).join("");
  }else{
    $("lobby").classList.remove("hidden");
    $("game").classList.add("hidden");
    selected=null;
    $("reactionPanel")?.classList.add("hidden");
  }
}

// Pannello opzionale della flotta.
function renderFleet(){
  const panel=$("fleet")||$("fleetList")||$("fleetInfo")||$("units");
  if(!panel||!state||!Array.isArray(state.units))return;

  const mine=state.units.filter(u=>u.owner===myId);
  panel.innerHTML=mine.map(u=>`
    <div class="playerRow">
      <span>
        <strong>${esc(u.name||(u.type==="ship"?"Capital Ship":u.type==="support"?"Supporto":"Mecha "+u.id))}</strong>
        <br>HP: ${u.hp}/${u.maxHp}
      </span>
      <span>${u.hp>0?(u.acted?"Agito":"Disponibile"):"Distrutto"}</span>
    </div>
  `).join("");
}

function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function draw(){
  ctx.clearRect(0,0,800,800);
  ctx.fillStyle="#0a121b";
  ctx.fillRect(0,0,800,800);

  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    ctx.fillStyle=((x+y)%2)?"#111e2a":"#142332";
    ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
    ctx.strokeStyle="#253748";
    ctx.strokeRect(x*TILE,y*TILE,TILE,TILE);

    if((x*7+y*13)%37===0){
      ctx.fillStyle="#243b4b";
      ctx.fillRect(x*TILE+13,y*TILE+13,14,14);
    }
  }

  if(!state)return;
  const units=state.units;

  if(selected){
    const u=units.find(z=>z.id===selected);
    if(u&&u.hp>0&&u.owner===myId&&state.activePlayer===myId&&!state.winner&&u.move>0&&!u.moved){
      ctx.fillStyle="#68b5ff22";
      for(const {x,y} of reachableCells(u,units)){
        ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }
    }
  }

  for(const u of units){
    if(u.hp<=0)continue;
    const x=u.x*TILE,y=u.y*TILE,own=u.owner===myId;
    ctx.fillStyle=u.color;
    ctx.strokeStyle=own?"#bde3ff":"#ffd0d0";
    ctx.lineWidth=2;

    if(u.type==="ship"){
      ctx.beginPath();
      ctx.moveTo(x+20,y+4);
      ctx.lineTo(x+35,y+31);
      ctx.lineTo(x+20,y+26);
      ctx.lineTo(x+5,y+31);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }else if(u.type==="support"){
      ctx.fillRect(x+9,y+9,22,22);
      ctx.strokeRect(x+9,y+9,22,22);
      ctx.fillStyle="#e9f7ff";
      ctx.fillRect(x+18,y+12,4,16);
      ctx.fillRect(x+12,y+18,16,4);
    }else{
      ctx.fillRect(x+11,y+7,18,26);
      ctx.fillRect(x+6,y+12,7,15);
      ctx.fillRect(x+27,y+12,7,15);
      ctx.strokeRect(x+11,y+7,18,26);
    }

    if(u.id===selected){
      ctx.strokeStyle="#ffe082";
      ctx.lineWidth=3;
      ctx.strokeRect(x+2,y+2,36,36);
    }

    ctx.fillStyle="#05090e";
    ctx.fillRect(x+4,y+34,32,4);
    ctx.fillStyle="#65d995";
    ctx.fillRect(x+4,y+34,32*(u.hp/u.maxHp),4);

    ctx.fillStyle="#e8f0fa";
    ctx.font="10px system-ui";
    ctx.textAlign="center";
    ctx.fillText(
      u.type==="ship"?"CS":
      u.type==="support"?"SUP":
      String(u.id.match(/m(\d+)/)?.[1]||"M"),
      x+20,y+5
    );

    if(u.acted){
      ctx.fillStyle="#111827aa";
      ctx.fillRect(x+1,y+1,38,38);
    }
  }
}

function renderUnit(){
  const box=$("unitInfo"),actions=$("actions");
  actions.innerHTML="";
  const u=state?.units.find(z=>z.id===selected&&z.hp>0);
  if(!u){box.innerHTML='<span class="muted">Seleziona un’unità sulla mappa.</span>';return;}
  const statuses=Object.entries(u.status||{}).filter(([,active])=>active).map(([name])=>name).join(", ")||"nessuno";
  box.innerHTML=`
    <strong>${esc(u.name)}</strong> · ${u.owner===myId?"Alleata":"Nemica"} · ${esc(u.type)}
    <div class="stat"><div class="statTop"><span>HP</span><span>${u.hp}/${u.maxHp}</span></div>
      <div class="bar hp"><i style="width:${100*u.hp/u.maxHp}%"></i></div></div>
    <div class="stat"><div class="statTop"><span>Energia</span><span>${u.en}/${u.maxEn}</span></div>
      <div class="bar en"><i style="width:${100*u.en/u.maxEn}%"></i></div></div>
    <div class="stat"><div class="statTop"><span>Munizioni</span><span>${u.ammo}/${u.maxAmmo}</span></div>
      <div class="bar"><i style="width:${100*u.ammo/u.maxAmmo}%"></i></div></div>
    <div class="stat"><div class="statTop"><span>Volontà</span><span>${u.vt}/150</span></div>
      <div class="bar vt"><i style="width:${100*u.vt/150}%"></i></div></div>
    <div class="stat"><div class="statTop"><span>SP</span><span>${u.sp??0}/${u.maxSp??100}</span></div>
      <div class="bar"><i style="width:${100*(u.sp??0)/(u.maxSp||100)}%"></i></div></div>
    <small class="muted">Armor: ${u.armor||0} · Evasione: ${Math.round(100*(u.evasion||0))}%
    · Stati: ${esc(statuses)}<br>${u.moved?"Movimento usato":"Movimento disponibile"} ·
    ${u.acted?"Azione usata":"Azione disponibile"}</small>
  `;
  if(ws?.readyState!==WebSocket.OPEN||u.owner!==myId||state.activePlayer!==myId||state.winner||state.pendingAttack)return;
  const add=(label,action,disabled=false)=>{
    const b=document.createElement("button");
    b.textContent=label;b.disabled=disabled;
    b.onclick=()=>armMode(action);
    actions.appendChild(b);
  };
  if(u.move>0&&!u.moved)add("Muovi: scegli casella","armMove");
  if(!u.acted){
    for(const id of ["melee","gun","laser","special"]){
      const w=MechRules.weapon(u,id);
      if(!w)continue;
      add(w.label+(id==="special"?` (VT ${w.vt}, ${w.en} EN)`:""),"armAttack:"+id,
        u.en<w.en||u.ammo<w.ammo||u.vt<w.vt);
    }
  }
  if((u.type==="support"||u.type==="ship")&&!u.acted){
    add("Rifornisci alleato","armResupply");
    add("Ripara alleato","armRepair");
  }
  for(const [id,skill] of Object.entries(MechRules.skills)){
    if((u.sp||0)<skill.cost)continue;
    const b=document.createElement("button");
    b.textContent=`${skill.label} (${skill.cost} SP)`;
    b.onclick=()=>{
      if(skill.target==="self"){
        send({action:"skill",unitId:u.id,skill:id});
        mode=null;$("actionStatus").textContent=`${skill.label} inviato.`;
      }else armMode("armSkill:"+id);
    };
    actions.appendChild(b);
  }
}
function renderReaction(){
  const panel=$("reactionPanel");
  if(!panel)return;
  panel.innerHTML="";
  const pending=state?.pendingAttack;
  if(!pending||pending.defenderOwner!==myId||state.winner){
    panel.classList.add("hidden");return;
  }
  const attacker=state.units.find(u=>u.id===pending.attackerId);
  const defender=state.units.find(u=>u.id===pending.targetId);
  if(!attacker||!defender)return;
  panel.classList.remove("hidden");
  const label=document.createElement("p");
  label.textContent=`${attacker.name} attacca ${defender.name} con ${MechRules.weapon(attacker,pending.weapon)?.label||pending.weapon}. Scegli la difesa:`;
  panel.appendChild(label);
  function button(text,response,weapon){
    const b=document.createElement("button");
    b.textContent=text;
    b.onclick=()=>send({action:"react",response,weapon});
    panel.appendChild(b);
  }
  button("Defend (-25% danno dopo armor)","defend");
  button("Evade (+25% evasione)","evade");
  for(const id of ["melee","gun","laser","special"]){
    if(MechRules.canFire(defender,id,Math.abs(defender.x-attacker.x)+Math.abs(defender.y-attacker.y)))
      button("Counter: "+MechRules.weapon(defender,id).label,"counter",id);
  }
}
function armMode(m){
  mode=m;
  const names={
    armMove:"Clicca una casella valida per muovere.",
    armResupply:"Clicca un alleato entro 2 caselle.",
    armRepair:"Clicca un alleato da riparare entro 2 caselle."
  };
  if(m.startsWith("armAttack:")){
    const u=state?.units.find(z=>z.id===selected);
    const w=u&&MechRules.weapon(u,m.slice(10));
    $("actionStatus").textContent=`Clicca un nemico a distanza ${w?.min||1}–${w?.max||5}. Riclicca l'unità per annullare.`;
  }else if(m.startsWith("armSkill:")){
    $("actionStatus").textContent="Clicca un'altra unità alleata per applicare la skill.";
  }else $("actionStatus").textContent=(names[m]||"Scegli un bersaglio.")+" Riclicca l'unità selezionata per annullare.";
}
let mode=null;

canvas.addEventListener("click",e=>{
  if (!state || !state.started || state.winner || state.pendingAttack) return;

  // Converte correttamente il clic in coordinate della griglia.
  const rect = canvas.getBoundingClientRect();

  const x = Math.floor(
    ((e.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth) / TILE
  );

  const y = Math.floor(
    ((e.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight) / TILE
  );

  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;

  const clicked = state.units.find(
    u => u.hp > 0 && u.x === x && u.y === y
  );

  const canAct =
    ws?.readyState === WebSocket.OPEN && state.activePlayer === myId && !state.winner;

  if (mode!==null && clicked?.id===selected) {
    mode=null;
    $("actionStatus").textContent="Azione annullata. Seleziona un'unità e scegli un'azione.";
    return;
  }

  // La selezione deve funzionare anche durante il turno avversario.
  if (mode === null) {
    if (clicked) {
      selected = clicked.id;
      draw();
      renderUnit();

      if (typeof renderFleet === "function") {
        renderFleet();
      }

      $("actionStatus").textContent =
        clicked.owner === myId
          ? "Unità alleata selezionata."
          : "Unità nemica selezionata.";

    } else {
      selected = null;
      draw();
      renderUnit();
    }

    return;
  }

  // Da qui in poi sono consentite solo azioni durante il proprio turno.
  if (!canAct) {
    $("actionStatus").textContent = "Non è il tuo turno.";
    return;
  }

  const unit = state.units.find(
    u => u.id === selected && u.hp > 0
  );

  if (!unit || unit.owner !== myId) {
    mode = null;
    $("actionStatus").textContent =
      "Seleziona prima una tua unità.";
    return;
  }

  if (mode === "armMove") {
    if (unit.move <= 0 || unit.moved) {
      $("actionStatus").textContent =
        "Questa unità non può più muoversi.";
      return;
    }

    if (clicked) {
      $("actionStatus").textContent =
        "La casella è occupata.";
      return;
    }

    if (!reachableCells(unit,state.units).some(cell=>cell.x===x && cell.y===y)) {
      $("actionStatus").textContent =
        "Casella fuori portata o percorso bloccato.";
      return;
    }

    send({
      action: "move",
      unitId: unit.id,
      x: x,
      y: y
    });

    mode = null;
    $("actionStatus").textContent = "Movimento inviato.";
    return;
  }

  if (!clicked) {
    $("actionStatus").textContent =
      "Clicca su un'unità valida.";
    return;
  }

  const distance=Math.abs(unit.x-clicked.x)+Math.abs(unit.y-clicked.y);
  if(mode.startsWith("armAttack:")){
    const weapon=mode.slice(10);
    const w=MechRules.weapon(unit,weapon);
    if(clicked.owner===myId||!MechRules.canFire(unit,weapon,distance)){
      $("actionStatus").textContent=w
        ?`Scegli un nemico a distanza ${w.min}–${w.max}, con risorse e VT sufficienti.`
        :"Arma non valida.";
      return;
    }
    send({action:"attack",unitId:unit.id,targetId:clicked.id,weapon});
  }else if(mode.startsWith("armSkill:")){
    if(clicked.owner!==myId||clicked.id===unit.id){
      $("actionStatus").textContent="Scegli un'altra unità alleata.";return;
    }
    send({action:"skill",unitId:unit.id,targetId:clicked.id,skill:mode.slice(9)});
  }else{
    if(clicked.owner!==myId||clicked.id===unit.id||distance>2){
      $("actionStatus").textContent="Scegli un'altra unità alleata entro 2 caselle.";return;
    }
    if(mode==="armResupply")send({action:"resupply",unitId:unit.id,targetId:clicked.id});
    else if(mode==="armRepair")send({action:"repair",unitId:unit.id,targetId:clicked.id});
  }

  mode = null;
  $("actionStatus").textContent = "Azione inviata.";
});

connect();
