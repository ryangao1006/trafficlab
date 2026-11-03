import * as T from '../vendor/three/three.module.js';
import { River } from './river.js';
import { polygonShape,polygonSurface,polygonBuilding,roadGeometry } from './city-mesh.js';

const roofs=['#4d5054','#69645d','#515d63','#76695f','#5d5b59'];
const walls=['#ad9780','#90705f','#ad8c73','#91756c','#b0a490','#968474','#967866'];
const iron='#64786e', limestone='#c1ac87';

function landmarks(data,kit){
  const {cube,part,column,ball,cyl,masonry,slate,trim,lit,farDetail}=kit;
  const [x,z]=data.landmarks['Big Ben'];
  const towerHeight=1076;
  const turret=new T.ConeGeometry(1,1,4);
  masonry.push(cube(x,383,z,132,766,132,limestone),cube(x,811,z,139,129,139,limestone));
  for(const y of [74,654,754,872,921])masonry.push(cube(x,y,z,146,15,146,'#d0b992'));
  slate.push(part(turret,x,976,z,91,151,91,'#4d5055',0,Math.PI/4));
  trim.push(column(x,1061,z,4,30,'#c5ae73'),ball(x,towerHeight,z,6,7,6,'#bca05b'));
  const circle=new T.CylinderGeometry(1,1,1,32);
  for(let face=0;face<4;face++){
    const angle=face*Math.PI/2,dx=Math.sin(angle),dz=Math.cos(angle);
    const surface=(offset,y,w,h,d,color)=>part(kit.box,x+dx*offset,y,z+dz*offset,w,h,d,color,0,angle);
    for(const y of [192,340,518,692]){
      trim.push(surface(66.4,y,13,84,2,'#554f45'));
      masonry.push(surface(67,y-43,22,4,7,'#ccb28b'));
    }
    trim.push(surface(70,824,116,113,4,'#4c463b'));
    lit.push(part(circle,x+dx*73,824,z+dz*73,42,1.8,42,'#ffe2a4',Math.PI/2,0,angle));
    trim.push(surface(75,830,2.8,37,2,'#4b402e'));
    trim.push(surface(76,822,23,3.1,2,'#4b402e'));
    for(let i=0;i<12;i++){
      const t=i*Math.PI/6,px=Math.sin(t)*35,py=Math.cos(t)*35;
      trim.push(part(kit.box,x+dx*75+dz*px,824+py,z+dz*75-dx*px,2.2,4.5,2,
        '#675034',0,angle,-t));
    }
  }
  for(const dx of [-1,1])for(const dz of [-1,1]){
    masonry.push(cube(x+dx*63,406,z+dz*63,10,816,10,'#c5b08b'));
    masonry.push(cube(x+dx*59,905,z+dz*59,15,60,15,limestone));
    slate.push(part(turret,x+dx*59,946,z+dz*59,13,32,13,'#4c5058',0,Math.PI/4));
  }
  // Stone parapets and ribs on the actual Westminster Bridge alignment.
  const [bx,bz]=data.landmarks['Westminster Bridge'];
  const a=[bx-1410,bz-77],b=[bx+1410,bz+77],yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  for(const side of [-1,1]){
    const zz=bz+side*163;
    trim.push(part(kit.box,bx,12,zz,2816,12,8,iron,0,yaw));
    for(let i=-9;i<=9;i++){
      const px=bx+i*151,pz=zz+i*151*.055;
      trim.push(cube(px,14,pz,10,24,10,'#57726b'),column(px,30,pz,3,20,iron));
      if(i%2===0)lit.push(cube(px,43,pz,9,9,9,'#f0cc92'));
    }
  }
  for(let i=-3;i<=3;i++){
    masonry.push(cube(bx+i*367,-20,bz+i*20,50,42,350,'#a69a83'));
  }
  // The Eye follows the South Bank and faces along the river.
  const [ex,ez]=data.landmarks['London Eye'],radius=667,ey=712;
  const wheelYaw=1.43,cs=Math.cos(wheelYaw),sn=Math.sin(wheelYaw);
  const torus=new T.TorusGeometry(radius,6,6,72);
  trim.push(part(torus,ex,ey,ez,1,1,1,'#d4d8d5',0,wheelYaw));
  for(let i=0;i<32;i++){
    const t=i*Math.PI/16,h=Math.cos(t)*radius,along=Math.sin(t)*radius;
    const px=ex+along*cs,pz=ez-along*sn;
    trim.push(part(ball(0,0,0,1,1,1,'#ffffff').geo,px,ey+h,pz,20,12,15,'#a1bac3'));
    farDetail.push(part(cyl,ex+along*cs*.5,ey+h*.5,ez-along*sn*.5,2,radius,2,
      '#a7b3b8',Math.atan2(-along*sn,h),0,Math.atan2(-along*cs,h)));
  }
  for(const offset of [-1,1])trim.push(part(cyl,ex+offset*120,ey/2,ez+135,12,ey+70,12,'#bac1bd',-.36,0,offset*.33));
  trim.push(ball(ex,ey,ez,29,29,29,'#b3c0c1'));
}

export function buildWestminster(group,data,{kit,asphalt,ground,combined,facades,roadTint}){
  const sectors=new Map();
  function zone(x,z){
    const key=`${Math.floor(x/4200)}:${Math.floor(z/4200)}`;
    if(!sectors.has(key))sectors.set(key,{walls:[],roofs:[]});
    return sectors.get(key);
  }
  const [clockX,clockZ]=data.landmarks['Big Ben'];
  const [wheelX,wheelZ]=data.landmarks['London Eye'];
  for(const [rings,height,base,tint,id] of data.buildings){
    const [x,z]=rings[0][0],seed=id%19;
    const footprint=rings[0];
    if(footprint.every(([px,pz])=>Math.abs(px-clockX)<104&&Math.abs(pz-clockZ)<104))continue;
    const wheelPart=footprint.every(([px,pz])=>Math.abs(px-wheelX)<185&&Math.abs(pz-wheelZ)<755)||
      base>24&&footprint.every(([px,pz])=>Math.hypot(px-wheelX,pz-wheelZ)<865);
    if(wheelPart)continue;
    const near=Math.hypot(x,z)<3600;
    const palette=typeof tint==='string'&&/^#[a-f\d]{6}$/i.test(tint)?
      new T.Color(tint).lerp(new T.Color(walls[seed%walls.length]),.57):walls[seed%walls.length];
    const cell=zone(x,z);
    cell.walls.push(kit.part(polygonBuilding(rings,height-base),0,base,0,1,1,1,palette));
    cell.roofs.push(kit.part(polygonSurface(rings),0,height+.4,0,1,1,1,roofs[seed%roofs.length]));
    if(near&&base===0&&height>135&&height<300&&seed%3===0){
      cell.roofs.push(kit.cube(x+6,height+5,z+5,7,10,7,'#866e5a'));
    }
  }
  for(const {walls,roofs} of sectors.values()){
    const wall=combined(walls,facades),roof=combined(roofs);
    wall.castShadow=true;
    wall.receiveShadow=roof.receiveShadow=true;
    group.add(wall,roof);
  }
  for(const [points,width,bridge,kind] of data.roads){
    const y=bridge?.66:kind==='path'?.21:.48;
    const road=roadGeometry(points,width);
    const tint=bridge?'#55575a':roadTint;
    (kind==='path'?ground:asphalt).push(kit.part(road,0,y,0,1,1,1,kind==='path'?'#a69f8d':tint));
    if(bridge&&width>46)ground.push(kit.part(road,0,-2.8,0,1,1,1,'#79776d'));
  }
  for(const rings of data.green){
    ground.push(kit.part(polygonSurface(rings),0,-.35,0,1,1,1,'#879776'));
  }
  const water=new River(new T.ShapeGeometry(data.water.map(polygonShape)),false);
  group.add(water);
  landmarks(data,kit);
  return water;
}
