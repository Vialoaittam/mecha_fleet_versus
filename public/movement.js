function reachableCells(unit, units) {
  const blocked = new Set(units.filter(u=>u.hp>0 && u.id!==unit.id).map(u=>`${u.x},${u.y}`));
  const visited = new Set([`${unit.x},${unit.y}`]);
  const queue = [{x:unit.x,y:unit.y,steps:0}];
  for (let i=0; i<queue.length; i++) {
    const cell=queue[i];
    if (cell.steps>=unit.move) continue;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=cell.x+dx, y=cell.y+dy, key=`${x},${y}`;
      if (x<0 || x>=20 || y<0 || y>=20 || blocked.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({x,y,steps:cell.steps+1});
    }
  }
  return queue.slice(1).map(({x,y})=>({x,y}));
}

if (typeof module!=="undefined") module.exports=reachableCells;
