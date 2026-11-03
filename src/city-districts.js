import * as T from '../vendor/three/three.module.js';
import { polygonSurface,polygonBuilding,roadGeometry } from './city-mesh.js';
import { streetPose,touchesStreet } from './city-streets.js';
import { riverSections } from './river.js';
import { terrace } from './london.js';

const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const shade=['#936353','#aa795e','#a88c72','#82645d','#ba9c80','#996653','#ac8d72'];
const slate=['#45494d','#50545a','#565259','#565955','#61594f'];
const streets=[
  // Soho market spine, two dog-leg lanes and a short market court.
  {type:'shop',width:80,points:[[-1490,128],[-1540,260],[-1450,460],[-1175,685],[-785,940],[-510,1180],[-390,1580],[-550,2040],[-860,2350],[-1190,2430],[-1620,2750]]},
  {type:'shop',width:53,points:[[-1290,935],[-1120,1080],[-825,1305],[-510,1180]]},
  {type:'shop',width:59,points:[[-1390,1350],[-1080,1560],[-790,1680],[-415,1650]]},
  {type:'shop',width:51,points:[[-1730,1750],[-1440,1875],[-1210,2070],[-860,2350]]},
  {type:'shop',width:53,points:[[395,1720],[690,1500],[890,1480],[1230,1550],[1600,1710]]},
  // Residential crescent and garden with narrower approach streets.
  {type:'home',width:65,points:[[-660,-640],[-918,-842],[-1230,-938],[-1530,-910],[-1750,-785],[-1875,-510],[-1860,-260],[-1680,-165],[-1370,-170],[-1040,-225],[-715,-407],[-660,-640]]},
  {type:'home',width:49,points:[[-660,-640],[-510,-689],[-310,-716],[-130,-708]]},
  {type:'home',width:54,points:[[-1230,-938],[-1400,-1280],[-1600,-1520],[-1770,-1900]]},
  {type:'home',width:51,points:[[-1750,-785],[-2060,-910],[-2240,-1130],[-2530,-1210]]},
  {type:'home',width:63,points:[[-1040,-225],[-1270,-490],[-1280,-693]]},
  // Warehouses on a bent embankment and lanes from the quay.
  {type:'wharf',width:76,points:[[126,-2060],[299,-2080],[560,-2090],[830,-2020],[1260,-2030],[1640,-1900],[2010,-1950],[2450,-2040],[2670,-2130]]},
  {type:'wharf',width:59,points:[[1260,-2030],[1145,-1640],[1190,-1300],[1420,-1030],[1470,-780],[1340,-520],[1050,-300]]},
  {type:'wharf',width:53,points:[[2010,-1950],[1920,-1700],[1930,-1450],[2060,-1120],[2120,-800]]},
  {type:'wharf',width:48,points:[[1190,-1300],[1460,-1400],[1710,-1380],[1930,-1450]]},
  {type:'wharf',width:53,points:[[1420,-1030],[1630,-1060],[2060,-1120]]},
];

function noise(n){
  const x=Math.sin(n*127.1+31.7)*43758.5453;
  return x-Math.floor(x);
}
function center(points){
  return points.reduce(([x,z],p)=>[x+p[0]/points.length,z+p[1]/points.length],[0,0]);
}
function distanceToSegment(p,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
}
function wet(x,z){
  const i=riverSections.findIndex(([rx])=>rx>x);
  if(i<1)return Math.abs(z+2633)<520;
  const [ax,az]=riverSections[i-1],[bx,bz]=riverSections[i];
  return Math.abs(z-az-(bz-az)*(x-ax)/(bx-ax))<(x>2710&&x<8250?850:465);
}
function bounds(points){
  const x=points.map(p=>p[0]),z=points.map(p=>p[1]);
  const w=Math.max(...x)-Math.min(...x),d=Math.max(...z)-Math.min(...z);
  return [Math.min(...x)+w/2,Math.min(...z)+d/2,w,d];
}
function intersect(a,b){
  for(const poly of [a,b]){
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],normal=[q[1]-p[1],p[0]-q[0]];
      const u=a.map(p=>dot(p,normal)),v=b.map(p=>dot(p,normal));
      if(Math.max(...u)<Math.min(...v)||Math.max(...v)<Math.min(...u))return false;
    }
  }
  return true;
}
function clip(poly,normal,limit){
  const result=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],x=dot(a,normal)-limit,y=dot(b,normal)-limit;
    if(x<=0)result.push(a);
    if((x<0&&y>0)||(x>0&&y<0))result.push(mix(a,b,x/(x-y)));
  }
  return result;
}
function garden(ground,kit,tree){
  const outline=[[-923,-290],[-1112,-319],[-1268,-452],[-1510,-381],[-1736,-318],[-1785,-534],
    [-1633,-723],[-1402,-792],[-1170,-807],[-949,-722],[-764,-580]];
  ground.push(kit.part(polygonSurface([outline]),0,2.1,0,1,1,1,'#849473'));
  for(const [x,z] of [[-914,-571],[-1030,-630],[-1490,-535],[-1510,-660],[-1670,-525],[-1220,-570],[-1380,-505]]){
    tree(x,z,20,57,'#637f5d');
  }
  ground.push(kit.cube(-1250,1.85,-550,570,1,20,'#b3a68c'),kit.cube(-1160,1.9,-596,21,1,170,'#b3a68c'));
  return outline;
}

export function buildCinematicDistricts(group,{kit,asphalt,ground,tree,combined,facades}){
  const sectors=new Map(),occupied=[],localRoads=new Set();
  function sector(x,z){
    const id=`${Math.floor(x/2300)}:${Math.floor(z/2300)}`;
    if(!sectors.has(id))sectors.set(id,{walls:[],tops:[]});
    return sectors.get(id);
  }
  const segments=streets.flatMap(street=>street.points.slice(1).map((p,i)=>({a:street.points[i],b:p,...street})));
  const square=garden(ground,kit,tree);
  function clear(poly,edge=null){
    const [x,z,w,d]=bounds(poly);
    if(poly.some(([px,pz])=>wet(px,pz)||Math.max(Math.abs(px),Math.abs(pz))<510)||
      touchesStreet(x,z,w,d,edge?179:207))return false;
    if(z< -2230&&z> -7350&&Math.abs(x)<5400)return false;
    if(intersect(poly,square))return false;
    if(segments.some(seg=>seg!==edge&&poly.some(p=>distanceToSegment(p,seg.a,seg.b)<seg.width*.52+6)))return false;
    return !occupied.some(other=>Math.abs(other.x-x)<(other.w+w)/2&&Math.abs(other.z-z)<(other.d+d)/2&&intersect(poly,other.poly));
  }

  function house(poly,type,seed,front,far){
    const [x,z,w,d]=bounds(poly);
    occupied.push({x,z,w,d,poly});
    const cell=sector(x,z);
    const floors=(type==='shop'?4:type==='wharf'?3:3)+Math.floor(noise(seed+5)*(type==='shop'?3:2));
    const height=floors*(type==='wharf'?20:17)+noise(seed+25)*7;
    const color=shade[Math.floor(noise(seed)*shade.length)];
    const roof=slate[Math.floor(noise(seed+3)*slate.length)];
    const midpoint=center(poly);
    const slope=poly.map(p=>mix(midpoint,p,.70));
    cell.walls.push(kit.part(polygonBuilding([poly],height),0,1,0,1,1,1,color));
    if(type!=='wharf'&&noise(seed+31)>.39){
      const [a,b,c,d]=poly;
      const xyz=(point,y)=>[point[0],y,point[1]];
      const e=xyz(mix(a,d,.50),height+14),f=xyz(mix(b,c,.50),height+14);
      const A=xyz(a,height),B=xyz(b,height),C=xyz(c,height),D=xyz(d,height);
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute([
        ...A,...B,...e,...B,...f,...e,...D,...e,...C,...C,...e,...f,...A,...e,...D,...B,...C,...f,
        ...e,...B,...A,...e,...f,...B,...C,...e,...D,...f,...e,...C,...D,...e,...A,...f,...C,...B,
      ],3));
      geometry.computeVertexNormals();
      cell.tops.push(kit.part(geometry,0,1,0,1,1,1,roof));
    }else{
      cell.tops.push(kit.part(polygonBuilding([slope],type==='wharf'?9:14),0,height+.9,0,1,1,1,roof));
      cell.tops.push(kit.part(polygonSurface([poly]),0,height+1.2,0,1,1,1,roof));
    }
    if(!far){
      const [cx,cz]=mix(midpoint,poly[2],.32);
      cell.tops.push(kit.cube(cx,height+17,cz,7,19,8,color),kit.cube(cx,height+27,cz,8,3,9,'#b3a58e'));
    }
    if(front&&type==='shop'){
      const [a,b]=front,p=mix(a,b,.5);
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      const nx=(p[0]-midpoint[0]),nz=(p[1]-midpoint[1]),n=Math.hypot(nx,nz);
      const fx=p[0]+nx/n*.9,fz=p[1]+nz/n*.9;
      const shop=['#37433c','#59443f','#465360','#3d3b38'][Math.floor(noise(seed+6)*4)];
      kit.trim.push(kit.part(kit.box,fx,13,fz,length*.88,22,2,shop,0,yaw),
        kit.part(kit.box,fx,27,fz,length*.87,5.5,3,shop,0,yaw));
      kit.lit.push(kit.part(kit.box,fx+nx/n*1.2,13,fz+nz/n*1.2,length*.61,12,1.1,'#ffcb91',0,yaw));
    }
  }

  for(const [index,seg] of segments.entries()){
    const {a,b,width,type}=seg;
    ground.push(kit.part(roadGeometry([a,b],width+28),0,-.1,0,1,1,1,'#a29a8a'));
    asphalt.push(kit.part(roadGeometry([a,b],width),0,.45,0,1,1,1,'#555456'));
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[(a[1]-b[1])/length,(b[0]-a[0])/length];
    for(const side of [-1,1]){
      let at=22;
      for(let n=0;at<length-59;n++){
        const seed=index*71+n*19+side*109;
        const end=Math.min(length-20,at+37+noise(seed)*38);
        const front=width/2+13;
        const depth=43+noise(seed+4)*35+(type==='wharf'?19:0);
        function point(distance,offset){
          const p=mix(a,b,distance/length);
          return [p[0]+normal[0]*offset*side,p[1]+normal[1]*offset*side];
        }
        const poly=[point(at,front),point(end-1.2,front),
          point(end-3-noise(seed+12)*9,front+depth),point(at+noise(seed+16)*9,front+depth)];
        if(clear(poly,seg))house(poly,type,seed,poly.slice(0,2),false);
        at=end+(n%7===5?11:1.4);
      }
    }
  }

  // Keep varied, short streets at the edge of the teaching intersection.
  for(const side of ['N','E','S','W'])for(const sign of [-1,1])for(let i=0;i<8;i++){
    if(side==='N'&&sign===-1&&i>5)continue;
    const d=634+i*175;
    const at=streetPose(side,d,sign*(210+i%3*3));
    const next=streetPose(side,d+1);
    const yaw=-Math.atan2(next.z-streetPose(side,d).z,next.x-streetPose(side,d).x)+(sign>0?Math.PI:0);
    const x=at.x,z=at.z,w=122+(i%3)*8;
    const poly=[[-w/2,-40],[w/2,-40],[w/2,40],[-w/2,40]].map(([u,v])=>
      [x+u*Math.cos(yaw)+v*Math.sin(yaw),z-u*Math.sin(yaw)+v*Math.cos(yaw)]);
    if(occupied.some(item=>Math.abs(item.x-x)<110&&Math.abs(item.z-z)<110&&intersect(poly,item.poly)))continue;
    occupied.push({x,z,w:150,d:150,poly});
    const pad=poly.map(p=>mix([x,z],p,1.15));
    ground.push(kit.part(polygonBuilding([pad],14),0,-5,0,1,1,1,'#a59c90'));
    terrace(kit,{x,z,width:w,depth:75,height:65+(i%4)*13,angle:yaw,count:3,
      shop:i<3&&side!=='N',seed:i+(sign>0?2:0),stone:i===2});
  }

  // Irregular distant streets follow the edges of locally spaced lots.
  const seeds=[];
  for(let row=-16;row<=16;row++)for(let col=-16;col<=16;col++){
    const seed=(row+17)*67+col+17;
    const x=col*715+(row%2)*270+(noise(seed)-.5)*655;
    const z=row*715+(noise(seed+91)-.5)*635;
    if(Math.hypot(x,z)<14000)seeds.push([x,z,seed]);
  }
  const border=12050;
  for(const p of seeds){
    const [x,z,seed]=p;
    if(wet(x,z)||Math.max(Math.abs(x),Math.abs(z))>border||
       (z< -2180&&z> -7360&&Math.abs(x)<5380))continue;
    let cell=[[-border,-border],[border,-border],[border,border],[-border,border]];
    for(const q of seeds){
      const normal=[q[0]-x,q[1]-z];
      if(q===p||dot(normal,normal)>2350**2)continue;
      cell=clip(cell,normal,dot([(x+q[0])/2,(z+q[1])/2],normal));
      if(cell.length<3)break;
    }
    if(cell.length<3)continue;
    const far=Math.max(Math.abs(x),Math.abs(z))>4900;
    if(!far&&!touchesStreet(x,z,0,0,440)&&!segments.some(seg=>distanceToSegment(p,seg.a,seg.b)<270)){
      for(let edge=0;edge<cell.length;edge++){
        const a=cell[edge],b=cell[(edge+1)%cell.length],mid=mix(a,b,.5);
        const key=[a,b].map(point=>point.map(value=>Math.round(value)).join(',')).sort().join(':');
        if(localRoads.has(key)||[a,b,mid].some(([x,z])=>wet(x,z)||touchesStreet(x,z,0,0,161)||
          Math.max(Math.abs(x),Math.abs(z))<520||segments.some(seg=>distanceToSegment([x,z],seg.a,seg.b)<seg.width/2)))continue;
        localRoads.add(key);
        ground.push(kit.part(roadGeometry([a,b],54),0,-.16,0,1,1,1,'#999181'));
        asphalt.push(kit.part(roadGeometry([a,b],34),0,.25,0,1,1,1,'#515153'));
      }
    }
    const origin=center(cell);
    cell=cell.map(point=>mix(origin,point,.90));
    for(let edge=0;edge<cell.length;edge++){
      const a=cell[edge],b=cell[(edge+1)%cell.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<116)continue;
      const count=Math.max(1,Math.floor(length/(far?142:105)));
      for(let i=0;i<count;i++){
        const t=(i+.24)/count,u=(i+.93)/count;
        const A=mix(a,b,t),B=mix(a,b,u);
        const depth=(far?80:60)+noise(seed*7+edge*37+i)*48;
        const inward=(q)=>mix(q,origin,Math.min(.49,depth/Math.hypot(q[0]-origin[0],q[1]-origin[1])));
        const poly=[A,B,inward(B),inward(A)];
        if(!clear(poly))continue;
        house(poly,far?'home':seed%8===0?'wharf':'home',seed*37+edge*13+i,null,far);
      }
    }
  }
  for(const {walls,tops} of sectors.values()){
    const mesh=combined(walls,facades);
    mesh.receiveShadow=true;
    group.add(mesh,combined(tops));
  }
}
