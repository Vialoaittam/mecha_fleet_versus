// Catalogo delle fazioni e degli armamenti. Nessuna dipendenza dal browser.
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.MechFactions=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  // Nome, ruolo tattico, quattro attacchi nell'ordine: corpo a corpo, tiro, energia, speciale.
  const factions=[
    {id:"gundam00",name:"Gundam 00",units:[
      ["Ptolemaios","carrier",["GN Point Defense","GN Missile Salvo","GN Main Cannon","Trans-Am Tactical Volley"]],
      ["Exia","striker",["GN Sword","GN Vulcan","GN Beam Dagger","Trans-Am Seven Sword"]],
      ["Virtue","heavy",["GN Field Ram","GN Missile Pods","GN Bazooka","Nadleeh Trial Burst"]],
      ["Dynames","sniper",["GN Beam Saber","GN Pistols","GN Sniper Rifle","Precision GN Full Snipe"]],
      ["Kyrios","agile",["GN Shield Claw","GN Machinegun","GN Beam Submachine Gun","Trans-Am Aerial Assault"]]
    ]},
    {id:"codegeass",name:"Code Geass",units:[
      ["Damocles","carrier",["Fortress Close Defense","Escort Missile Battery","Heavy Turret Volley","FLEIJA Strategic Strike"]],
      ["Gekkoei","striker",["Radiant Blade","Slash Harken","Energy Rifle","Gekkoei Overdrive"]],
      ["Guren","heavy",["Claw Strike","Slash Harken Rush","Radiation Burst","Radiant Wave Surger"]],
      ["Lancelot","agile",["MVS Twin Slash","VARIS Burst","Blaze Luminous Shot","Albion Full Assault"]],
      ["Sutherland Sieg","artillery",["Armor Ram","Missile Barrage","Siege Energy Cannon","Heavy Fortress Salvo"]]
    ]},
    {id:"macross",name:"Macross Frontier",units:[
      ["Macross Quarter","carrier",["Point Defense Turrets","Missile Screen","Macross Cannon","Quarter Formation Attack"]],
      ["VF-25F Messiah","agile",["Pinpoint Barrier Punch","Micro Missile Volley","Gunpod Burst","Super Pack Full Assault"]],
      ["VF-25G Messiah","sniper",["Close Combat Blade","Gunpod Cover Fire","Precision Sniper Shot","Long Range Pinpoint Snipe"]],
      ["VB-6 König Monster","artillery",["Monster Crush","Missile Rack","Railgun Battery","Monster Siege Barrage"]],
      ["Queadluun-Rhea","striker",["Power Claw","Micro Missile Swarm","Particle Cannon","Quadruple Cannon Rush"]]
    ]},
    {id:"universalcentury",name:"Gundam Universal Century",units:[
      ["White Base","carrier",["Anti-Air Defense","Missile Launchers","Mega Particle Gun","White Base Full Barrage"]],
      ["RX-78-2 Gundam","striker",["Beam Saber","Head Vulcan","Beam Rifle","Last Shooting"]],
      ["Guncannon","artillery",["Guncannon Tackle","Missile Launchers","Shoulder Cannon","Double Cannon Barrage"]],
      ["Guntank","heavy",["Tracked Ram","Arm Rocket Launchers","120mm Twin Cannons","Guntank Full Suppression"]],
      ["Core Booster","agile",["Close Flyby","Air-to-Air Missiles","Mega Particle Cannon","High Speed Assault"]]
    ]}
  ];
  const roles={
    carrier:{type:"ship",hp:26000,armor:1350,evasion:.06,accuracy:.04,move:1,damage:[2600,3900,5300,10400]},
    striker:{type:"mech",hp:8900,armor:470,evasion:.21,accuracy:.08,move:4,damage:[3500,4100,4900,8500]},
    heavy:{type:"mech",hp:13000,armor:1050,evasion:.09,accuracy:.03,move:3,damage:[3600,4200,5500,9500]},
    sniper:{type:"mech",hp:7400,armor:310,evasion:.27,accuracy:.12,move:4,damage:[2100,4300,5600,8900]},
    agile:{type:"mech",hp:7700,armor:290,evasion:.33,accuracy:.09,move:5,damage:[3200,4000,4800,8100]},
    artillery:{type:"mech",hp:10500,armor:760,evasion:.12,accuracy:.05,move:3,damage:[2500,4700,6200,9800]}
  };
  const slotStats={
    melee:{accuracy:.92,min:1,max:1,en:0,ammo:0,vt:0},
    gun:{accuracy:.83,min:2,max:5,en:0,ammo:2,vt:0},
    laser:{accuracy:.85,min:2,max:6,en:25,ammo:0,vt:0},
    special:{accuracy:.80,min:2,max:6,en:40,ammo:0,vt:120}
  };
  function getFaction(id){return factions.find(f=>f.id===id)||null;}
  function buildRoster(id){
    const faction=getFaction(id);
    if(!faction)return null;
    return faction.units.map(([name,role,names],i)=>{
      const s=roles[role],slots=["melee","gun","laser","special"],weapons={};
      slots.forEach((slot,j)=>{
        weapons[slot]={...slotStats[slot],label:names[j],damage:s.damage[j]};
        if(slot==="special"&&s.type==="ship")weapons[slot].max=8;
      });
      return {name,type:s.type,role,hp:s.hp,armor:s.armor,evasion:s.evasion,
        accuracy:s.accuracy,move:s.move,weapons,special:{
          name:names[3],damage:s.damage[3],accuracy:weapons.special.accuracy,
          vt:120,en:40,min:2,max:weapons.special.max
        },faction:faction.id,factionName:faction.name,slot:i};
    });
  }
  return {factions,getFaction,buildRoster};
});
