// Regole condivise tra server e client. Il server rimane autorevole.
(function(root,factory){
  const rules=factory();
  if(typeof module==="object"&&module.exports)module.exports=rules;
  else root.MechRules=rules;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const skills={
    aim:{label:"Aim",cost:25,target:"self"},
    flash:{label:"Flash",cost:20,target:"self"},
    invincible:{label:"Invincible",cost:35,target:"self"},
    foresight:{label:"Foresight",cost:45,target:"other"},
    trust:{label:"Trust",cost:25,target:"other"},
    gain:{label:"Gain",cost:25,target:"self"}
  };
  const weapons={
    melee:{label:"Attacca melee",damage:2800,accuracy:.92,min:1,max:1,en:0,ammo:0,vt:0},
    gun:{label:"Fucile (2 ammo)",damage:4200,accuracy:.82,min:2,max:5,en:0,ammo:2,vt:0},
    laser:{label:"Laser (25 EN)",damage:5000,accuracy:.85,min:2,max:5,en:25,ammo:0,vt:0}
  };
  function weapon(unit,id){
    if(id==="special"&&unit.special)return {
      label:unit.special.name,damage:unit.special.damage,accuracy:unit.special.accuracy||.8,
      min:unit.special.min||2,max:unit.special.max||6,en:unit.special.en||40,
      ammo:0,vt:unit.special.vt||120
    };
    return Object.prototype.hasOwnProperty.call(weapons,id)?weapons[id]:null;
  }
  function canFire(unit,id,distance){
    const w=weapon(unit,id);
    return !!w&&unit.hp>0&&distance>=w.min&&distance<=w.max&&unit.en>=w.en&&unit.ammo>=w.ammo&&unit.vt>=w.vt;
  }
  return {skills,weapons,weapon,canFire};
});
