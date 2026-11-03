import * as T from '../vendor/three/three.module.js';
import { vehiclePose, routeLength } from './routes.js';
import { HOTSPOTS, drawJunction } from './draw.js';
import { Atmosphere } from './atmosphere.js';
import { CameraDirector } from './camera.js';
import { CityBloom } from './bloom.js';
import { River, riverSections } from './river.js';
import { LocalSurfaces } from './materials.js';
import { queueLayout, queueViewSpan } from './queue-layout.js';
import { terrace, londonLandmarks, streetMaterial, bus, cityFrontage, facadeMaterial, districtMaterial } from './london.js';
import { approachStarts, streetPose, streetActor, streetPedestrian, streetBounds, touchesStreet, sideStreets, sideStreetPose } from './city-streets.js';
import { buildCinematicDistricts } from './city-districts.js';
import { buildWestminster } from './westminster.js';
import { makeMapStreets } from './map-streets.js';

const cinematicStreets={pose:streetPose,actor:streetActor,pedestrian:streetPedestrian,
  bounds:streetBounds,starts:approachStarts,branches:sideStreets};
const westminsterShots={
  street:{azimuth:-1.34,elevation:.105,distance:1280,target:[610,317,130]},
  river:{azimuth:1.04,elevation:.37,distance:5250,target:[3020,195,-1180]},
};
const SIDES=['N','E','S','W'];
const FLIGHT_KEYS=new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
const CARS=['#f1ad46','#58a8b8','#e98471','#7587cf','#e9dfbd','#73a98c'];
const SHIRTS=['#ffb33d','#4a9baf','#e78686','#817ab9','#6ba57b'];
const SIGNAL={red:'#fb715c',amber:'#ffbf47',green:'#8ee973'};
const box=new T.BoxGeometry(1,1,1), sphere=new T.SphereGeometry(1,12,8), ico=new T.IcosahedronGeometry(1,1), cyl=new T.CylinderGeometry(1,1,1,12);
const part=(geo,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0)=>({geo,x,y,z,sx,sy,sz,color,rx,ry,rz});
const cube=(x,y,z,w,h,d,col)=>part(box,x,y,z,w,h,d,col);
const ball=(x,y,z,w,h,d,col)=>part(sphere,x,y,z,w,h,d,col);
const column=(x,y,z,r,h,col)=>part(cyl,x,y,z,r,h,r,col);
const shade=new T.MeshStandardMaterial({vertexColors:true,roughness:.84});
const surface=new T.MeshStandardMaterial({vertexColors:true,roughness:.96});
const sourceCache=new WeakMap();
function combined(parts,material=shade){
  const uv=[],tileSpan=material.userData.tileSpan,kind=material.userData.textureKind;
  const pos=[],norm=[],cols=[],dummy=new T.Object3D(),normal=new T.Matrix3(),p=new T.Vector3(),n=new T.Vector3(),color=new T.Color();
  for(const b of parts){
    if(!sourceCache.has(b.geo))sourceCache.set(b.geo,b.geo.index?b.geo.toNonIndexed():b.geo);
    const g=sourceCache.get(b.geo);dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(b.rx,b.ry,b.rz);dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();normal.getNormalMatrix(dummy.matrix);color.set(b.color);
    for(let i=0;i<g.attributes.position.count;i++){
      p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(dummy.matrix);n.fromBufferAttribute(g.attributes.normal,i).applyNormalMatrix(normal);
      pos.push(p.x,p.y,p.z);norm.push(n.x,n.y,n.z);cols.push(color.r,color.g,color.b);
      if(tileSpan){
        if(kind!=='stone'||Math.abs(n.y)>.55)uv.push(p.x/tileSpan,-p.z/tileSpan);
        else if(Math.abs(n.x)>Math.abs(n.z))uv.push(-Math.sign(n.x)*p.z/tileSpan,p.y/tileSpan);
        else uv.push(Math.sign(n.z)*p.x/tileSpan,p.y/tileSpan);
      }
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.computeBoundingSphere();
  if(tileSpan)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  return new T.Mesh(geo,material);
}
function rounded(w,h,d,r){
  const g=new T.BoxGeometry(w,h,d,5,5,5),a=g.attributes.position;
  const core=new T.Vector3(w/2-r,h/2-r,d/2-r),p=new T.Vector3(),inner=new T.Vector3();
  for(let i=0;i<a.count;i++){
    p.fromBufferAttribute(a,i);inner.set(T.MathUtils.clamp(p.x,-core.x,core.x),T.MathUtils.clamp(p.y,-core.y,core.y),T.MathUtils.clamp(p.z,-core.z,core.z));
    p.sub(inner).normalize().multiplyScalar(r).add(inner);a.setXYZ(i,p.x,p.y,p.z);
  }
  g.computeVertexNormals();return g;
}
const bevelCar=rounded(39,16,57,6),bevelCabin=rounded(32,16,31,5),bevelRoof=rounded(30,6,26,2.5);
const plate=(x,z,w,d,col,y=1.55)=>cube(x,y,z,w,.5,d,col);
function makeApproaches(scene,road,streets){
  const asphaltTint=new T.Color('#53565b');
  const paving=new T.MeshStandardMaterial({color:'#ada696',roughness:.96});
  const paint=new T.MeshStandardMaterial({color:'#acb2a8',roughness:.96});
  const terrain=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:'#839081',roughness:.96}));
  terrain.rotation.x=-Math.PI/2;
  terrain.position.y=-6.5;
  terrain.visible=false;
  scene.add(terrain);

  function strip(side,start,end,left,right,y,material,dashed=false){
    const positions=[],normals=[],colors=[];
    for(let distance=start;distance<end;distance+=dashed?47:44){
      const next=Math.min(end,distance+(dashed?17:44));
      const a=streets.pose(side,distance,left),b=streets.pose(side,distance,right);
      const c=streets.pose(side,next,left),d=streets.pose(side,next,right);
      for(const point of [a,b,c,b,d,c]){
        positions.push(point.x,y,point.z);
        normals.push(0,1,0);
        if(material===road)colors.push(asphaltTint.r,asphaltTint.g,asphaltTint.b);
      }
      if(material===paving){
        for(const [from,to] of [[a,c],[d,b]]){
          const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);
          if(length===0)continue;
          positions.push(from.x,y,from.z,to.x,y,to.z,from.x,-5.9,from.z,
            to.x,y,to.z,to.x,-5.9,to.z,from.x,-5.9,from.z);
          for(let i=0;i<6;i++)normals.push(dz/length,0,-dx/length);
        }
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    if(material===road)geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);
    mesh.receiveShadow=true;
    scene.add(mesh);
    return mesh;
  }

  function pavementSections(side,bank,start,end){
    const meshes=[];
    const branches=streets.branches.filter(branch=>branch.side===side&&branch.bank===bank&&
      branch.distance>start&&branch.distance<end);
    const left=bank<0?-169:130,right=bank<0?-130:169;
    for(const branch of branches){
      meshes.push(strip(side,start,branch.distance-34,left,right,8.67,paving));
      start=branch.distance+34;
    }
    meshes.push(strip(side,start,end,left,right,8.67,paving));
    return meshes;
  }

  function extend(side,start,end){
    return [strip(side,start,end,-131,131,1.02,road),
      ...[-1,1].flatMap(bank=>pavementSections(side,bank,start,end)),
      strip(side,start,end,-.95,.95,1.09,paint,true)];
  }

  const arms=SIDES.map(side=>{
    const baseEnd=streets.ends?.[side]??6140;
    extend(side,streets.starts[side],baseEnd);
    // The pavement doubles as the extended pedestrian waiting area.
    if(streets.starts[side]>500)strip(side,500,streets.starts[side],134,166,8.68,paving);
    return {side,baseEnd,end:baseEnd,extras:[]};
  });
  return {
    update(layout,coverage){
      for(const arm of arms){
        const {baseEnd}=arm;
        const end=layout.armReach[arm.side]+90<=baseEnd?baseEnd:Math.ceil((layout.armReach[arm.side]+90)/600)*600;
        if(end===arm.end)continue;
        for(const mesh of arm.extras){scene.remove(mesh);mesh.geometry.dispose();}
        arm.extras=end>baseEnd?extend(arm.side,baseEnd,end):[];
        arm.end=end;
      }
      terrain.visible=coverage>11200;
      if(terrain.visible)terrain.scale.set(coverage*2.8,coverage*2.8,1);
    },
  };
}
function makeTown(scene,mapData){
  const ground=[],asphalt=[],brick=[],build=[],lit=[],foliage=[],mark=[],extra=[];
  const slate=[],masonry=[],paving=[],farDetail=[],farLights=[];
  const road='#4c5057',pave='#b8b1a4';
  const kit={cube,part,box,column,ball,cyl,brick,trim:build,lit,slate,masonry,paving,farDetail,farLights};
  ground.push(cube(0,-12,0,mapData?42000:25000,12,mapData?42000:25000,mapData?'#777872':'#858377'));
  asphalt.push(cube(0,-2,0,260,6,260,road),cube(0,-2,-315,260,6,370,road),cube(0,-2,315,260,6,370,road),cube(-315,-2,0,370,6,260,road),cube(315,-2,0,370,6,260,road));
  for(const sx of [-1,1])for(const sz of [-1,1]){
    if(!mapData)ground.push(cube(sx*315,0,sz*315,370,15,370,pave),cube(sx*332,7.5,sz*332,316,5,316,'#a9bf91'));
    paving.push(cube(sx*147,8.1,sz*314,27,1,357,'#d8d7ce'),cube(sx*314,8.1,sz*147,357,1,27,'#d8d7ce'));
    for(let j=0;j<10;j++){
      const q=165+j*33;
      ground.push(plate(sx*147,sz*q,26,.8,'#bac4b3',8.8),plate(sx*q,sz*147,.8,26,'#bac4b3',8.8));
    }
  }
  for(const sign of [-1,1])for(let d=199;d<500;d+=36){
    mark.push(plate(0,sign*d,2,16,'#bac8bb'),plate(sign*d,0,16,2,'#bac8bb'));
    for(const l of [-55,55])extra.push(plate(l,sign*d,1.6,13,'#879690'),plate(sign*d,l,13,1.6,'#879690'));
  }
  for(const q of [-111,-74,-37,0,37,74,111])for(const sign of [-1,1]){
    mark.push(plate(q,sign*151,23,28,'#efebda'),plate(sign*151,q,28,23,'#efebda'));
  }
  mark.push(plate(-65,-175,116,5,'#f2efdf'),plate(65,175,116,5,'#f2efdf'),plate(175,-65,5,116,'#f2efdf'),plate(-175,65,5,116,'#f2efdf'));
  const tree=(x,z,r=22,h=63,shade='#73a873')=>{
    foliage.push(column(x,13+h*.26,z,3.3,h*.55,'#8b765e'));
    foliage.push(part(ico,x,13+h*.72,z,r,h*.43,r,shade),part(ico,x-r*.38,13+h*.75,z+r*.23,r*.75,h*.32,r*.7,'#90bb82'),part(ico,x+r*.36,13+h*.91,z-r*.18,r*.61,h*.25,r*.65,'#a9ca8b'));
  };
  const shrub=(x,z,col)=>foliage.push(part(ico,x,16,z,12,8,10,col));
  if(!mapData){
    terrace(kit,{x:-326,z:-344,width:221,depth:103,height:91,count:4,shop:true,seed:1});
    terrace(kit,{x:333,z:-337,width:218,depth:96,height:103,angle:-Math.PI/2,count:4,shop:true,seed:3});
    terrace(kit,{x:345,z:348,width:210,depth:105,height:86,count:4,seed:2});
    // Red telephone kiosk and Underground-style roundel at opposite corners.
    build.push(cube(-169,31,-194,17,46,17,'#ad302c'),cube(-169,55,-194,19,4,19,'#cd463a'));
    for(const x of [-174,-164])build.push(cube(x,33,-185.1,4.8,28,1,'#547986'));
    for(let y=23;y<48;y+=6)build.push(cube(-169,y,-184.4,16,1.2,1,'#bc3d35'));
    build.push(cube(-169,48,-184.5,13,3,.8,'#f4e4c8'));
    const roundel=new T.TorusGeometry(9,2.2,8,24);
    build.push(column(169,33,-197,1.5,47,'#39464a'),part(roundel,169,55,-197,1,1,1,'#c6493d'));
    build.push(cube(169,55,-195,23,4.4,3.4,'#263f70'));
    // Low iron railings define the garden square without blocking the footways.
    for(let i=0;i<=14;i++){
      const p=189+i*19;
      build.push(column(-p,15,184,1.25,14,'#354543'),column(-184,15,p,1.25,14,'#354543'));
    }
    build.push(cube(-322,21,184,268,1.6,1.6,'#354543'),cube(-184,21,322,1.6,1.6,268,'#354543'));
    ground.push(plate(-347,349,187,177,'#bcd1a2',10.1),column(-341,10.8,353,55,1.4,'#72aeb2'),column(-342,11.6,354,46,1,'#87bfc0'),plate(-339,270,24,161,'#ddd9bb',10.3));
    for(const [x,z,r,h] of [[-454,-434,24,70],[-446,-266,24,69],[-236,-435,21,64],[-220,-310,23,67],[442,-438,22,62],[236,-416,21,70],[442,-239,22,67],[246,-238,24,66],[-440,438,25,70],[-433,261,23,62],[-244,414,22,66],[-231,277,23,63],[442,447,22,59],[231,425,23,64],[441,244,20,62],[244,246,23,68]])tree(x,z,r,h);
    for(const [x,z] of [[-275,-242],[-402,-219],[307,-238],[405,-236],[-414,400],[-410,381],[-286,406],[419,261],[296,243]])shrub(x,z,'#81ad7b');
    function bench(x,z){
      build.push(cube(x-12,16,z,4,11,10,'#647b6f'),cube(x+12,16,z,4,11,10,'#647b6f'),cube(x,22,z,32,3,11,'#b48f6d'),cube(x,28,z+5,32,7,3,'#bd9b72'));
    }
    bench(-380,280);bench(-302,435);bench(296,246);
  }
  const streetLights=[];
  const glowCanvas=document.createElement('canvas');
  glowCanvas.width=glowCanvas.height=64;
  const glowContext=glowCanvas.getContext('2d');
  const gradient=glowContext.createRadialGradient(32,32,1,32,32,32);
  gradient.addColorStop(0,'#fff1d4e8');
  gradient.addColorStop(.17,'#ffd6a175');
  gradient.addColorStop(.49,'#ffbd6f29');
  gradient.addColorStop(1,'#ffae5500');
  glowContext.fillStyle=gradient;
  glowContext.fillRect(0,0,64,64);
  const glowTexture=new T.CanvasTexture(glowCanvas);
  glowTexture.colorSpace=T.SRGBColorSpace;
  const glowMaterial=new T.SpriteMaterial({map:glowTexture,transparent:true,opacity:0,
    depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
  function lamp(x,z){
    build.push(column(x,29,z,1.9,41,'#3c4946'),column(x,10,z,3.4,8,'#46534d'));
    build.push(cube(x,51,z,9,4,9,'#3c4946'),cube(x,43,z,7,2,7,'#3c4946'));
    build.push(cube(x,47,z,6.5,8,6.5,'#d9bf8c'));
    lit.push(cube(x,47,z,6.9,7.3,6.9,'#ffd99d'));
    const halo=new T.Sprite(glowMaterial);
    halo.position.set(x,47,z);
    halo.scale.set(29,29,1);
    scene.add(halo);
    if(Math.abs(x)+Math.abs(z)<420){
      const light=new T.PointLight('#ffbd79',0,163,2);
      light.position.set(x,48,z);
      scene.add(light);
      streetLights.push(light);
    }
  }
  for(const [x,z] of [[-146,-238],[146,238],[238,-146],[-238,146],[-146,-444],[146,444],[444,-146],[-444,146]])lamp(x,z);
  const districtLamps={value:0},districtDetail={value:1};
  const facades=districtMaterial(districtLamps,districtDetail,mapData?2.2:1);
  const streets=mapData?makeMapStreets(mapData.paths):cinematicStreets;
  const river=mapData?buildWestminster(scene,mapData,{kit,asphalt,ground,combined,facades,roadTint:'#545457'}):
    addDistrict(scene,ground,asphalt,mark,tree,road,kit,facades);
  if(!mapData){
    cityFrontage(scene,kit,ground,mark);
    londonLandmarks(kit);
    bus(kit);
  }
  for(const group of [ground,mark,build,foliage]){
    const mesh=combined(group,group===ground||group===mark?surface:shade);
    mesh.receiveShadow=true;
    mesh.castShadow=group===build||group===foliage;
    scene.add(mesh);
  }
  const materials=[facadeMaterial('stone'),facadeMaterial('slate'),facadeMaterial('paving')];
  for(const [parts,material] of [[brick,streetMaterial(true)],[masonry,materials[0]],[slate,materials[1]],[paving,materials[2]]]){
    const face=combined(parts,material);
    face.castShadow=true;
    face.receiveShadow=true;
    scene.add(face);
  }
  const roadMaterial=streetMaterial();
  roadMaterial.userData.reflectors.value=streetLights.map(light=>light.position);
  const pavement=combined(asphalt,roadMaterial);
  pavement.receiveShadow=true;
  scene.add(pavement);
  const approaches=makeApproaches(scene,roadMaterial,streets);
  const windows=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false});
  const glowing=combined(lit,windows);
  scene.add(glowing);
  const distant=[combined(farDetail),combined(farLights,windows)];
  scene.add(...distant);
  const lanes=combined(extra,surface);
  lanes.receiveShadow=true;
  scene.add(lanes);
  return {lanes,roadMaterial,windows,streetLights,glowMaterial,approaches,river,distant,materials,districtLamps,districtDetail,streets};
}
function streetFrontages(kit,asphalt,ground){
  const {masonry,trim}=kit;
  for(const branch of sideStreets){
    const center=sideStreetPose(branch,130+branch.length/2);
    const toward=sideStreetPose(branch,140);
    const start=sideStreetPose(branch,130);
    const angle=-Math.atan2(toward.z-start.z,toward.x-start.x);
    asphalt.push(part(box,center.x,-.8,center.z,branch.length+5,3.4,68,'#575758',0,angle));
    for(const side of [-1,1]){
      const walk=sideStreetPose(branch,137+branch.length/2,side*41);
      ground.push(part(box,walk.x,.35,walk.z,branch.length-12,1.7,15,'#a39b8e',0,angle));
    }
  }
  for(const [index,side] of SIDES.entries()){
    const first=side==='N'?3375:approachStarts[side]+100;
    for(const sign of [-1,1]){
      for(let i=0;i<10;i++){
        const distance=first+i*178;
        if(sideStreets.some(branch=>branch.side===side&&branch.bank===sign&&Math.abs(branch.distance-distance)<110))continue;
        const depth=58+(i*11+index)%12;
        const at=streetPose(side,distance,sign*(184+depth/2));
        const before=streetPose(side,distance-1),after=streetPose(side,distance+1);
        const yaw=-Math.atan2(after.z-before.z,after.x-before.x)+(sign>0?Math.PI:0);
        const corner=side==='S'&&i===3&&sign===-1;
        const shop=i<5&&(side==='S'||(i+index)%2===0);
        terrace(kit,{...at,width:148+(i%3)*7,depth,height:shop?86+(i%3)*15:67+(i%2)*15,
          angle:yaw,count:shop?3:4,shop,seed:index+i+(sign===1?2:0),stone:corner||shop&&i%3===1});
        const forecourt=streetPose(side,distance,sign*(173+depth/2));
        ground.push(part(box,forecourt.x,1.45,forecourt.z,151+(i%3)*7,14.9,depth+25,'#ada595',0,yaw));
        if(corner){
          // Recessed, chamfered shop entrance at the outside of the southern curve.
          const front=streetPose(side,distance,sign*181);
          const bevel=new T.CylinderGeometry(1,1,1,8);
          masonry.push(part(bevel,front.x,30,front.z,23,43,18,'#bdab92',0,yaw+Math.PI/8));
          trim.push(part(bevel,front.x,49,front.z,24,4,19,'#82735f',0,yaw+Math.PI/8));
          const entry=streetPose(side,distance,sign*171);
          trim.push(part(box,entry.x,20,entry.z,14,23,1.4,'#374844',0,yaw));
        }
      }
    }
  }
}
function neighbourhoodLandmarks(kit){
  const {trim,masonry,slate}=kit;
  const steeple=new T.ConeGeometry(1,1,4);
  for(const [x,z,height] of [[935,2960,174],[-2575,800,186],[2915,-770,153]]){
    const stone='#a89983',roof='#575d63';
    masonry.push(cube(x,41,z,42,77,38,stone),cube(x,22,z-47,78,45,90,stone));
    trim.push(cube(x,81,z,47,6,43,'#b8ab98'));
    slate.push(part(steeple,x,(height+84)/2,z,29,height-84,29,roof,0,Math.PI/4));
    for(const side of [-1,1]){
      trim.push(cube(x,64,z+side*19.2,12,18,.9,'#514c45'));
      trim.push(cube(x+side*21.2,64,z,.9,18,12,'#514c45'));
    }
    for(const side of [-1,1])for(const xOffset of [-22,0,22]){
      trim.push(cube(x+xOffset,24,z-47+side*45.2,11,20,.65,'#556065'));
    }
  }
}

function addDistrict(scene,ground,asphalt,mark,tree,road,kit,facades){
  // Decorative city blocks extend the scene beyond the simulated intersection.
  const wallColors=['#ae7665','#b6a99a','#a56e62','#81979c','#aa9988','#9a7569'];
  asphalt.push(cube(0,-4,0,4800,7,4800,'#5a5d60'));
  for(const side of SIDES){
    const end=side==='N'?2360:approachStarts[side],start=500;
    const mid=streetPose(side,(start+end)/2);
    const vertical=side==='N'||side==='S';
    asphalt.push(cube(mid.x,-2,mid.z,vertical?260:end-start,6,vertical?end-start:260,road));
    for(let distance=522;distance<end-9;distance+=42){
      const pose=streetPose(side,distance);
      mark.push(plate(pose.x,pose.z,vertical?2:19,vertical?19:2,'#bac8bb'));
    }
  }
  buildCinematicDistricts(scene,{kit,asphalt,ground,tree,combined,facades});
  streetFrontages(kit,asphalt,ground);
  neighbourhoodLandmarks(kit);
  const river=new River();
  scene.add(river);
  const {trim,lit,paving,masonry,farDetail,farLights}=kit;
  // Connect the backdrop to the embankments with streets behind the waterfront.
  for(const side of [-1,1]){
    ground.push(cube(side*2875,-3,-4410,5400,7,2880,'#565d61'));
    for(const z of [-3175,-3430,-3650,-3880,-4110,-4480,-4900]){
      ground.push(cube(side*2640,.6,z,4900,1.4,38,'#454d53'));
    }
    for(let x=410;x<4550;x+=426){
      ground.push(cube(side*x,.58,-4200,29,1.3,2370,'#454d53'));
    }
    paving.push(cube(side*1485,.65,-2193,2610,1.6,144,'#b9b4a9'));
    ground.push(cube(side*1485,1.55,-2138,2610,1,23,'#555a60'));
  }
  // Carry the river into the distance between two staggered neighbourhoods.
  for(let i=3;i<riverSections.length;i++){
    const [x,z]=riverSections[i],[lastX,lastZ]=riverSections[i-1];
    const dx=x-lastX,dz=z-lastZ,length=Math.hypot(dx,dz);
    const cx=(x+lastX)/2,cz=(z+lastZ)/2,angle=-Math.atan2(dz,dx);
    const outer=(offset,y,w,h,d,color)=>part(box,cx,y,cz+offset,w,h,d,color,0,angle);
    for(const side of [-1,1]){
      trim.push(outer(side*336,0,length+9,9,5,'#817b6b'),
        outer(side*356,1,length+10,7,40,'#969184'),
        outer(side*402,-1,length+20,5,49,'#4a5359'));
      if(i>=riverSections.length-2)continue;
      for(let row=0;row<3;row++){
        for(let bay=0;bay<Math.floor(dx/97);bay++){
          const seed=i*47+row*29+bay*13+side*37;
          const bx=lastX+51+bay*96+seed%19;
          const bz=lastZ+(bx-lastX)*dz/dx+side*(470+row*166+seed%31);
          // Existing north-bank blocks already occupy this band.
          if(side===-1&&bx<4050&&bz< -3280)continue;
          const h=35+seed%61+(row&&seed%8===0?77:0);
          const w=54+seed%33,d=65+seed%28;
          const tone=wallColors[seed%wallColors.length];
          trim.push(cube(bx,h/2-2,bz,w,h,d,tone));
          farDetail.push(cube(bx,h-1,bz,w+3,4,d+3,'#626869'));
          if(seed%3!==0)farDetail.push(cube(bx-9,h+4,bz,w*.62,12,d*.68,'#6e6c66'));
          for(let level=15;level<h-7;level+=16){
            for(const offset of [-.28,0,.28]){
              if((seed+level+Math.round(offset*100))%7<4){
                farLights.push(cube(bx+offset*w,level,bz-side*(d*.5+.12),4.5,5,.24,'#dbb486'),
                  cube(bx-w*.5-.12,level,bz+offset*d,.24,5,4.5,'#be9b7c'));
              }
            }
          }
        }
      }
    }
  }
  // Waterfront walks are set back from the northbound traffic corridor.
  for(const side of [-1,1]){
    for(const [shore,front] of [[-2292,-1],[-2974,1]]){
      paving.push(cube(side*1450,2,shore-front*24,2550,9,49,'#d2c9b7'));
      masonry.push(cube(side*1450,0,shore+front*1.4,2550,12,5,'#a29681'));
      trim.push(cube(side*1450,6.4,shore+front*1.4,2550,2,7,'#aba393'));
      const rail='#414a4b';
      for(let x=215;x<2650;x+=21){
        if(Math.abs(x-740)<32)continue;
        trim.push(column(side*x,10.3,shore+front*.8,.84,9,rail));
        if(Math.abs(x+10-740)>39)trim.push(cube(side*(x+10.5),15,shore+front*.8,21,1.1,1.4,rail));
      }
      // Broad stone steps connect the promenade to a small landing.
      for(let step=0;step<6;step++){
        paving.push(cube(side*740,5.9-step*.95,shore+front*(step*3.4+4),57,1,4.2,'#c2b4a0'));
      }
      trim.push(cube(side*740,1.6,shore+front*32,77,2.5,28,'#82776a'));
      for(const offset of [-31,31])trim.push(column(side*740+offset,4,shore+front*40,1.5,8,'#4d4f4b'));
      for(let x=265;x<2500;x+=175){
        const pole=shore-front*7;
        trim.push(column(side*x,19,pole,1.35,26,'#46515a'),cube(side*x,33,pole,7,3.2,7,'#596264'));
        lit.push(cube(side*x,31.4,pole,5.1,3.2,5.1,'#ffd8a4'));
      }
    }
    for(let z=-2350;z>=-2910;z-=112){
      trim.push(column(side*168,23,z,1.8,25,'#4f5b61'),cube(side*168,37,z,8,2.7,8,'#555e61'));
      lit.push(cube(side*168,33.6,z,6.1,5.3,6.1,'#ffd99e'));
      masonry.push(cube(side*163,2,z,21,9,14,'#a49785'));
    }
  }
  // A second bridge farther downriver frames the far-bank skyline.
  const farBridge=1640;
  trim.push(cube(farBridge,12,-2633,70,13,677,'#665f59'),
    cube(farBridge,20,-2633,74,3,677,'#a9a18c'));
  const turretRoof=new T.ConeGeometry(1,1,4);
  for(const z of [-2485,-2780]){
    masonry.push(cube(farBridge,10,z,98,20,58,'#a29686'));
    for(const side of [-1,1]){
      const x=farBridge+side*35;
      masonry.push(cube(x,67,z,30,107,42,'#c6b59c'),cube(x,122,z,34,6,46,'#d0bea4'));
      for(const y of [31,60,111]){
        masonry.push(cube(x,y,z,32,3.6,44,'#bba98e'));
      }
      kit.slate.push(part(turretRoof,x,143,z,22,37,27,'#50595e',0,Math.PI/4));
      trim.push(column(x,163,z,1.45,8,'#b9a38a'));
      for(const face of [-1,1]){
        trim.push(cube(x,86,z+face*21.1,13,32,.45,'#4f4946'));
        lit.push(cube(x,93,z+face*21.4,9,15,.4,'#e7be83'));
        for(const edge of [-1,1])masonry.push(cube(x+edge*8,88,z+face*22.8,3,33,4,'#c6b59c'));
      }
    }
  }
  for(const side of [-1,1]){
    const x=farBridge+side*35;
    trim.push(cube(x,95,-2633,4,5,300,'#688894'),
      cube(x,107,-2633,3.6,2.7,291,'#7a9aa2'),
      cube(x,23,-2633,3.2,2.7,672,'#67828d'));
    lit.push(cube(x,92,-2633,1.6,1.3,284,'#dfb985'));
    for(let i=0;i<16;i++){
      const z=-2501-i*17.5;
      trim.push(cube(x,101,z,2,13,2,'#829ca2'),
        part(cyl,x,101,z-8.75,1.6,Math.hypot(11,17.5),1.6,
          '#6e909b',Math.atan2(i%2?17.5:-17.5,11)));
    }
    for(let i=0;i<24;i++){
      const z=-2313-i*27.5;
      trim.push(column(x,24,z,1.45,13,'#566d77'));
      if(i%3===0)lit.push(cube(x,31,z,3.6,4,3.6,'#f4cc95'));
    }
    let prev;
    for(let i=0;i<=12;i++){
      const z=-2485-i*295/12,y=55+46*((z+2632.5)/147.5)**2;
      trim.push(cube(x,y/2+10,z,1.4,y-20,1.4,'#85999f'));
      lit.push(cube(x+side*.6,23,z,1.4,1.5,12,'#f4cc95'));
      if(prev){
        const dy=y-prev.y,dz=z-prev.z;
        trim.push(part(cyl,x,(y+prev.y)/2,(z+prev.z)/2,1.5,Math.hypot(dy,dz),1.5,
          '#8d9d9f',Math.atan2(dz,dy)));
      }
      prev={y,z};
    }
  }
  for(const [x,z,w] of [[-810,-2543,130],[510,-2763,160]]){
    trim.push(cube(x,3.5,z,w,6,35,'#414b51'),cube(x,8,z,w*.87,5,29,'#c3b6a1'),
      cube(x-8,15,z,w*.58,12,23,'#56636b'),cube(x-8,22,z,w*.63,3,25,'#cfc2ab'));
    for(let dx=-w*.23;dx<=w*.23;dx+=15){
      lit.push(cube(x-8+dx,15,z+11.8,9,4,.6,'#ffd7a4'),cube(x-8+dx,15,z-11.8,9,4,.6,'#ffd7a4'));
    }
  }
  for(const side of [-1,1]){
    ground.push(cube(side*1500,-1,-2297,2660,12,32,'#858481'),
      cube(side*1600,-2,-2990,2860,13,48,'#858481'));
    ground.push(cube(side*149,2.8,-2640,35,5.6,720,'#a39d8e'),
      cube(side*169,8,-2640,5,10,720,'#a9a396'),cube(side*169,13.2,-2640,8,2.2,720,'#d1c5ad'));
    for(let z=-2320;z>=-2980;z-=82)ground.push(cube(side*169,10,z,10,17,11,'#bfb5a2'));
  }
  asphalt.push(cube(0,-1.98,-2689,260,5.96,622,road));
  for(let z=-2360;z>=-2980;z-=42)mark.push(plate(0,z,2,19,'#bac8bb'));
  return river;
}
const signalSites={N:[348,280,348,173,321,350,Math.PI],E:[721,348,826,348,650,321,Math.PI/2],S:[652,721,652,826,679,650,0],W:[280,652,173,652,350,679,-Math.PI/2]};
function signalModel(scene,side,kind){
  const [x,z,tx,tz,px,pz,rot]=signalSites[side],g=new T.Group(),walk=kind==='ped',turn=kind==='left';
  g.position.set((walk?px:turn?tx:x)-500,5,(walk?pz:turn?tz:z)-500);g.rotation.y=rot;
  const high=walk?36:53;
  g.add(combined([column(0,high*.41,0,2.4,high*.84,'#617a70'),cube(0,high,0,walk?13:14,walk?15:28,9,'#253e39'),cube(0,high+(walk?8:14),0,walk?15:16,3,11,'#2e4e43')]));
  const lensMat=[],states=walk?['red','green']:['red','amber','green'];
  for(const [i,key] of states.entries()){
    const m=new T.MeshBasicMaterial({color:'#3d554e'}),lens=new T.Mesh(sphere,m);
    lens.position.set(0,high+(walk?3.6:8.4)-i*(walk?7.2:8.4),4.9);lens.scale.set(3.6,3.6,1.7);g.add(lens);lensMat.push({key,m});
  }
  const capMat=new T.MeshBasicMaterial({color:SIGNAL.red}),cap=new T.Mesh(box,capMat);cap.scale.set(10,1.3,6);cap.position.set(0,high+(walk?10:16),0);g.add(cap);
  if(turn){const a=combined([cube(-1,0,0,5,1.3,1.2,'#cce2cf'),cube(2,-1.7,0,1.3,4.5,1.2,'#cce2cf'),part(box,-3.7,1.2,0,3,1.1,1.2,'#cce2cf',0,0,-.78),part(box,-3.7,-1.2,0,3,1.1,1.2,'#cce2cf',0,0,.78)]);a.position.set(0,32,5);g.add(a);}
  g.userData.pick={kind:'signal',side,movement:kind};scene.add(g);
  return {g,update(state){if(this.state===state)return;this.state=state;capMat.color.set(SIGNAL[state]);for(const {key,m} of lensMat)m.color.set(key===state?SIGNAL[state]:'#435951');}};
}
const carModels=new Map();
const paintMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.13});
const wheelRadius=6.7;
const wheelGeometry=combined([
  part(cyl,0,0,0,wheelRadius,5.8,wheelRadius,'#252a30',0,0,Math.PI/2),
  ...[-1,1].flatMap(sign=>[
    part(cyl,sign*3,0,0,4.4,.5,4.4,'#a5b2bc',0,0,Math.PI/2),
    part(cyl,sign*3.3,0,0,3.5,.25,3.5,'#414951',0,0,Math.PI/2),
    ...[0,Math.PI/3,2*Math.PI/3].map(angle=>part(box,sign*3.5,0,0,.3,7.3,.9,'#bac5cb',angle)),
  ]),
]).geometry;
function carShell(id){
  const paint=CARS[id%CARS.length],tall=Math.floor(id/2)%2===1,key=paint+String(tall);
  if(!carModels.has(key)){
    const height=tall?3:0,center=tall?4:0;
    const parts=[
      part(bevelCar,0,12,0,1,1,1,paint),
      part(bevelCabin,0,24+height*.5,center,1,1+height/16,tall?1.15:1,'#355064'),
      part(bevelRoof,0,30+height,center,1,1,tall?1.14:1,paint),
      cube(0,9,-27,29,3,4,'#aeb7b5'),cube(0,9,27,30,3,4,'#444f55'),
      cube(0,12,-28.2,13,3,1.5,'#263138'),cube(0,11,29.1,8,2.7,1,'#efd295'),
    ];
    for(const side of [-1,1]){
      parts.push(cube(side*15.9,24,center,1.2,9+height,2.2,'#212f37'));
      parts.push(cube(side*17.9,18.2,center+4,1.7,1,3.4,'#dae1dd'));
      parts.push(ball(side*18.3,23,-9,3.5,1.8,3.3,paint));
    }
    carModels.set(key,combined(parts,paintMaterial).geometry);
  }
  return new T.Mesh(carModels.get(key),paintMaterial);
}
const disc=new T.CircleGeometry(1,20);disc.rotateX(-Math.PI/2);
const shadowMat=new T.MeshBasicMaterial({color:'#101a24',transparent:true,opacity:.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
const selectedMat=new T.MeshBasicMaterial({color:'#fff4b6',transparent:true,opacity:.9,depthWrite:false});
const ring=new T.RingGeometry(.85,1,24);ring.rotateX(-Math.PI/2);
function actorShadow(g,w,d,y=1.95){const m=new T.Mesh(disc,shadowMat);m.scale.set(w,1,d);m.position.y=y;g.add(m);}
const lampGeometry=new T.SphereGeometry(1,10,6);
function makeCar(car){
  const g=new T.Group(),body=new T.Group(),wheels=[];
  const headlights=new T.MeshStandardMaterial({color:'#d5dace',emissive:'#fff2c8'});
  const tailLights=new T.MeshStandardMaterial({color:'#7b232e',emissive:'#ff202f'});
  const blinkMaterial=new T.MeshBasicMaterial({color:'#ffb640'});
  const blink=new T.Group();
  body.add(carShell(car.id));
  for(const x of [-18.3,18.3])for(const z of [-17,17]){
    const axle=new T.Group(),wheel=new T.Mesh(wheelGeometry,shade);
    axle.position.set(x,wheelRadius,z);
    axle.add(wheel);g.add(axle);
    wheels.push({axle,wheel,front:z<0});
  }
  for(const x of [-12.8,12.8]){
    for(const [z,material] of [[-27.5,headlights],[27.5,tailLights]]){
      const lens=new T.Mesh(lampGeometry,material);
      lens.position.set(x,15,z);lens.scale.set(4.3,2.3,2.1);body.add(lens);
    }
  }
  for(const z of [-25,25]){
    const indicator=new T.Mesh(lampGeometry,blinkMaterial);
    indicator.position.set(-17,15,z);indicator.scale.set(2.8,1.5,2.7);blink.add(indicator);
  }
  actorShadow(g,25,34);
  g.add(body);body.add(blink);
  Object.assign(g.userData,{body,wheels,headlights,tailLights,blink,blinkMaterial,pick:{kind:'car',id:car.id}});
  return g;
}
function animateCar(g,car,distance,mode,lighting,time,reducedMotion){
  const pose=vehiclePose(car,distance,mode);
  g.position.set(pose.x-500,1,pose.y-500);g.rotation.y=-pose.r;
  const {body,wheels,headlights,tailLights,blink}=g.userData;
  const ahead=vehiclePose(car,distance+26,mode),behind=vehiclePose(car,distance-12,mode);
  const turn=behind.r-ahead.r;
  const brake=car.v<5&&!car.served&&distance>5;
  for(const {wheel,axle,front} of wheels){
    wheel.rotation.x=reducedMotion?0:-distance/wheelRadius;
    axle.rotation.y=front?turn:0;
  }
  body.rotation.z=reducedMotion?0:turn*Math.min(1,car.v/85)*.18;
  headlights.emissiveIntensity=.12+lighting*1.4;
  tailLights.emissiveIntensity=brake?1.15:.08+lighting*.43;
  blink.visible=car.movement==='left'&&(reducedMotion||Math.floor(time*3)%2===0);
}

const walkerModels=new Map(),armModels=new Map();
function walkerBody(id){
  const variant=id%15;
  if(!walkerModels.has(variant)){
    const shirt=SHIRTS[id%SHIRTS.length],skin=['#eab792','#ba8764','#f5ceaa'][id%3],hair=['#523e37','#6b5144','#413d37'][id%3];
    const a=[ball(0,28,0,7.1,7.3,6.7,skin),ball(0,32.5,1.2,6.9,4.4,6.2,hair),ball(0,18,0,6.1,7.2,4.4,shirt),cube(0,12.5,0,8.5,4.5,6.3,'#455669')];
    for(const x of [-2.4,2.4])a.push(ball(x,28.5,-5.9,.7,.8,.7,'#3d3d38'));
    if(variant%3===0)a.push(ball(0,33.8,-.8,7.6,3.6,6.9,'#e5a553'),cube(0,32.4,-6.1,13,1.6,6,'#e5a553'));
    if(variant%3===1)a.push(ball(0,19,4.8,4.5,5.8,2.8,'#9f654d'));
    walkerModels.set(variant,combined(a).geometry);
  }
  return new T.Mesh(walkerModels.get(variant),shade);
}
const legLength=6.8;
const trouser=combined([ball(0,-3.25,0,2.18,4.1,1.95,'#455669')]).geometry;
const shoe=combined([cube(0,-.3,-1.15,4.4,2.5,6,'#e5dfd4'),cube(0,-1.53,-1.15,4.5,.7,6.15,'#8e938e')]).geometry;
function makeWalker(person){
  const g=new T.Group(),body=new T.Group(),limbs=[];g.add(body);body.add(walkerBody(person.id));actorShadow(g,7,8,.15);
  const skin=['#eab792','#ba8764','#f5ceaa'][person.id%3],shirt=SHIRTS[person.id%SHIRTS.length];
  const armKey=shirt+skin;
  if(!armModels.has(armKey))armModels.set(armKey,[
    combined([ball(0,-2,0,2,3.4,1.95,shirt)]).geometry,
    combined([ball(0,-1.75,0,1.55,2.65,1.55,skin),ball(0,-3.8,0,1.65,1.8,1.55,skin)]).geometry,
  ]);
  const [sleeve,forearm]=armModels.get(armKey);
  for(const side of [-1,1]){
    const arm=new T.Mesh(sleeve,shade),elbow=new T.Mesh(forearm,shade);
    arm.position.set(side*5.9,21,0);arm.rotation.z=side*.11;elbow.position.y=-4.4;arm.add(elbow);body.add(arm);
    const hip=new T.Mesh(trouser,shade),knee=new T.Mesh(trouser,shade),foot=new T.Mesh(shoe,shade);
    hip.position.set(side*2.45,12.3,0);knee.position.y=-legLength;foot.position.y=-legLength;
    hip.add(knee);knee.add(foot);body.add(hip);
    limbs.push({side,arm,elbow,hip,knee,foot});
  }
  Object.assign(g.userData,{body,limbs,pick:{kind:'ped',id:person.id}});return g;
}
function animateWalker(g,distance,weight,time){
  const cycle=distance/34, bob=Math.sin(cycle*4*Math.PI)*.48*weight;
  const {body,limbs}=g.userData;
  body.position.y=bob;
  body.rotation.y=Math.sin(cycle*2*Math.PI)*.12*weight;
  for(const {side,arm,elbow,hip,knee,foot} of limbs){
    const phase=(cycle+(side===1?.5:0))%1,swing=phase>=.55;
    const t=swing?(phase-.55)/.45:phase/.55;
    const z=(swing?Math.cos(t*Math.PI):2*t-1)*7.4*weight;
    const lift=swing?Math.sin(t*Math.PI)*3.9*weight:0;
    const stand=2.8*(1-weight);
    hip.position.y=12.3+stand;
    const down=10.4+stand+bob-lift;
    const bend=Math.acos(Math.min(1,Math.hypot(z,down)/(2*legLength)));
    hip.rotation.x=Math.atan2(-z,down)+bend;knee.rotation.x=-2*bend;
    foot.rotation.x=-hip.rotation.x-knee.rotation.x;
    arm.rotation.x=z*.074;
    elbow.rotation.x=.18+Math.max(0,arm.rotation.x)*.55;
  }
  if(!weight)body.rotation.y=Math.sin(time*1.4)*.12;
}
function makeStreetLife(scene){
  // These loops are outside the simulated lanes and crossings.
  const walkers=[
    {id:31,x:-328,z:-211,half:91,offset:40,speed:42},
    {id:35,x:-328,z:-211,half:91,offset:217,speed:42},
    {id:38,x:369,z:-211,half:69,offset:123,speed:36},
  ].map(spec=>{
    const model=makeWalker(spec);
    scene.add(model);
    return {...spec,model};
  });
  const cars=[
    {id:6,z:-1023,offset:400,side:1,speed:115},
    {id:9,z:-1023,offset:2930,side:1,speed:115},
    {id:11,z:-1071,offset:1830,side:-1,speed:100},
  ].map(spec=>{
    const model=makeCar(spec);
    model.userData.blink.visible=false;
    scene.add(model);
    return {...spec,model};
  });
  return {walkers,cars};
}
function sidewalkPose(distance,half,radius){
  const span=half*2,arc=Math.PI*radius;
  let s=distance%(2*(span+arc));
  if(s<span)return [-half+s,-radius,-Math.PI/2];
  s-=span;
  if(s<arc){
    const a=s/radius;
    return [half+radius*Math.sin(a),-radius*Math.cos(a),-Math.PI/2+a];
  }
  s-=arc;
  if(s<span)return [half-s,radius,Math.PI/2];
  const a=(s-span)/radius;
  return [-half-radius*Math.sin(a),radius*Math.cos(a),Math.PI/2+a];
}
function animateStreetLife(streetLife,time,lighting,reducedMotion){
  for(const {model,x,z,half,offset,speed} of streetLife.walkers){
    const distance=offset+(reducedMotion?0:time*speed);
    const [dx,dz,heading]=sidewalkPose(distance,half,6);
    model.position.set(x+dx,10.7,z+dz);
    model.rotation.y=heading;
    animateWalker(model,distance,reducedMotion?0:1,0);
  }
  for(const {model,z,offset,side,speed} of streetLife.cars){
    const distance=offset+(reducedMotion?0:time*speed);
    const {wheels,headlights,tailLights}=model.userData;
    model.position.set(side*(distance%4800-2400),.65,z);
    model.rotation.y=-side*Math.PI/2;
    for(const {wheel} of wheels)wheel.rotation.x=reducedMotion?0:-distance/wheelRadius;
    headlights.emissiveIntensity=.12+lighting*1.4;
    tailLights.emissiveIntensity=.08+lighting*.43;
  }
}

// Queue bodies use one draw call per kind, even when the line extends beyond the city.
function makeQueueActors(scene){
  const parked=combined([
    cube(0,12,0,36,14,55,'#f2f2f2'),
    cube(0,23,1,28,11,27,'#8194a5'),
    cube(0,29,1,30,3,29,'#f0f0f0'),
    ...[-17,17].flatMap(x=>[-17,17].map(z=>part(cyl,x,6.5,z,6.5,7,6.5,'#343941',0,0,Math.PI/2))),
    ...[-12,12].map(x=>cube(x,14,28,7,3,1,'#cc665b')),
  ]).geometry;
  const waiting=combined([
    ball(0,28,0,7,7,6.7,'#eab792'),
    ball(0,32,1,6.9,4,6.2,'#806b63'),
    ball(0,18,0,6.1,7.2,4.4,'#f0e8d7'),
    ...[-2.7,2.7].map(x=>cube(x,7.4,0,3.9,12,4.5,'#455669')),
    ...[-2.7,2.7].map(x=>cube(x,1.4,-1.5,4.3,2.8,6,'#e5dfd4')),
  ]).geometry;
  const transform=new T.Object3D(),color=new T.Color();
  function batch(geometry){
    let mesh,capacity=0;
    return (entries,colors,y,streets)=>{
      if(!entries.length){if(mesh)mesh.count=0;return;}
      if(entries.length>capacity){
        if(mesh){scene.remove(mesh);mesh.dispose();}
        capacity=2**Math.ceil(Math.log2(Math.max(16,entries.length)));
        mesh=new T.InstancedMesh(geometry,shade,capacity);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.frustumCulled=false;
        scene.add(mesh);
      }
      for(const [i,entry] of entries.entries()){
        const actor=entry.car??entry.person;
        const {x,z,r}=entry.car?streets.actor(entry.x,entry.y,entry.r,actor.direction):
          streets.pedestrian(entry.x,entry.y,entry.r,actor.side);
        transform.position.set(x,y,z);
        transform.rotation.y=-r;
        transform.updateMatrix();
        mesh.setMatrixAt(i,transform.matrix);
        mesh.setColorAt(i,color.set(colors[actor.id%colors.length]));
      }
      mesh.count=entries.length;
      mesh.instanceMatrix.needsUpdate=true;
      mesh.instanceColor.needsUpdate=true;
    };
  }
  const cars=batch(parked),people=batch(waiting);
  return {update(layout,streets){cars(layout.cars,CARS,1,streets);people(layout.waitingPeople,SHIRTS,8.8,streets);}};
}
function ribbon(points,width,color,opacity,y=2.6){
  const coords=[];
  const edges=points.map(([x,z],i)=>{
    const [ax,az]=points[Math.max(0,i-1)], [bx,bz]=points[Math.min(points.length-1,i+1)];
    const length=Math.hypot(bx-ax,bz-az)||1;
    const ox=(az-bz)*width/(2*length),oz=(bx-ax)*width/(2*length);
    return [[x+ox,y,z+oz],[x-ox,y,z-oz]];
  });
  for(let i=1;i<edges.length;i++){
    const [a,b]=edges[i-1],[c,d]=edges[i];
    coords.push(...a,...b,...c,...b,...d,...c);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
  return new T.Mesh(g,new T.MeshBasicMaterial({color,opacity,transparent:true,side:T.DoubleSide,depthWrite:false}));
}
function createRoutes(scene){
  const all=[];
  for(const mode of ['straight','left-turns'])for(const direction of SIDES)for(const movement of (mode==='straight'?['straight']:['straight','left'])){
    const car={direction,movement},points=[];
    for(let s=48;s<routeLength(car)-80;s+=9){const p=vehiclePose(car,s,mode);points.push([p.x-500,p.y-500]);}
    const path=ribbon(points,30,movement==='left'?'#81e6c6':'#a4e880',.2);scene.add(path);
    const dash=new T.InstancedMesh(box,new T.MeshBasicMaterial({color:movement==='left'?'#b7f2db':'#d9f4a8'}),23);dash.count=0;dash.frustumCulled=false;scene.add(dash);
    all.push({mode,direction,movement,path,dash});
  }
  const walks={N:[[-165,-151],[165,-151]],E:[[150,-165],[150,165]],S:[[165,151],[-165,151]],W:[[-150,165],[-150,-165]]};
  for(const side of SIDES){const path=ribbon(walks[side],23,'#b1e68b',.46,3);scene.add(path);all.push({side,path});}
  return all;
}
function makeSensors(scene){
  const result=[];
  for(const mode of ['straight','left-turns'])for(const direction of SIDES)for(const movement of (mode==='straight'?['straight']:['straight','left'])){
    const p=vehiclePose({direction,movement},270,mode),w=mode==='straight'?62:43;
    const m=new T.MeshBasicMaterial({color:'#6da895',transparent:true,opacity:.25,depthWrite:false});
    const g=new T.Group();g.position.set(p.x-500,2.2,p.y-500);g.rotation.y=-p.r;
    for(const [x,z,width,depth] of [[0,-22,w,1.8],[0,22,w,1.8],[-w/2,0,1.8,44],[w/2,0,1.8,44]]){
      const b=new T.Mesh(box,m);b.position.set(x,0,z);b.scale.set(width,.45,depth);g.add(b);
    }
    scene.add(g);result.push({mode,direction,movement,g,m});
  }return result;
}
export class TownView{
  constructor(canvas,viewport,markers,onChange,onPick){
    this.canvas=canvas;this.viewport=viewport;this.markers=markers;this.onChange=onChange;this.onPick=onPick;
    this.renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.15));this.renderer.setClearColor(0x000000,0);
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
    this.scene=new T.Scene();
    this.scene.fog=new T.Fog('#c5dbd6',1280,4500);
    this.camera=new T.PerspectiveCamera(49,1,4,14000);
    const fill=new T.HemisphereLight('#fff5df','#779b92',2.18);
    this.scene.add(fill);
    const sun=new T.DirectionalLight('#fff0d6',2.42);sun.position.set(-600,1080,480);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-770,right:770,top:770,bottom:-770,near:20,far:2500});sun.shadow.bias=-.0003;sun.shadow.normalBias=1.6;this.scene.add(sun);
    this.sun=sun;
    this.cities=new Map();
    const town=this.buildCity('cinematic');
    this.attachCity('cinematic',town);
    this.queueReach=500;
    this.queueActors=makeQueueActors(this.scene);
    this.atmosphere=new Atmosphere(this.scene,this.renderer,sun,fill,town);
    this.routes=createRoutes(this.scene);this.sensors=makeSensors(this.scene);
    this.lights=SIDES.flatMap(side=>['straight','left','ped'].map(kind=>({side,kind,...signalModel(this.scene,side,kind)})));
    this.streetLifeGroup=new T.Group();
    this.scene.add(this.streetLifeGroup);
    this.streetLife=makeStreetLife(this.streetLifeGroup);
    this.actors=new Map();this.focus=new T.Mesh(ring,selectedMat);this.focus.visible=false;this.scene.add(this.focus);
    this.projector=new T.Vector3();this.tmp=new T.Object3D();this.ray=new T.Raycaster();this.camera.up.set(0,1,0);
    canvas.addEventListener('webglcontextrestored',()=>{this.renderer.shadowMap.needsUpdate=true;this.river.invalidateReflection();this.onChange();});
    this.flyKeys=new Set();
    this.director=new CameraDirector(this.camera,onChange);this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(viewport);this.resize();this.bind();
  }
  buildCity(name,data){
    const group=new T.Group();
    const town={...makeTown(group,data),group};
    town.surfaces=new LocalSurfaces(town.materials,()=>{
      town.river.invalidateReflection();
      if(this.city===name)this.onChange();
    });
    this.cities.set(name,town);
    return town;
  }
  attachCity(name,town){
    if(this.activeTown){
      this.scene.remove(this.activeTown.group);
      this.activeTown.river.setQuality('balanced');
    }
    this.scene.add(town.group);
    this.city=name;
    this.activeTown=town;
    for(const key of ['lanes','river','distant','districtDetail','surfaces','approaches','streets']){
      this[key]=town[key];
    }
  }
  async setCity(name){
    const request=this.cityRequest=(this.cityRequest??0)+1;
    if(name===this.city)return true;
    let town=this.cities.get(name);
    if(!town){
      const url=new URL('../assets/maps/westminster.js',import.meta.url);
      if(this.mapLoadFailed)url.searchParams.set('retry',request);
      let data;
      try{({default:data}=await import(url.href));}
      catch(error){this.mapLoadFailed=true;throw error;}
      if(request!==this.cityRequest)return false;
      town=this.buildCity(name,data);
    }
    this.attachCity(name,town);
    this.atmosphere.useTown(town);
    this.setAtmosphere(...this.lastAtmosphere);
    this.applyTownQuality();
    this.streetLifeGroup.visible=name==='cinematic';
    this.director.shots=name==='westminster'?westminsterShots:{};
    this.setShot('orbit',true);
    this.onChange();
    return true;
  }
  applyTownQuality(){
    this.river.setQuality(this.quality);
    this.surfaces.setQuality(this.quality,this.renderer.capabilities.getMaxAnisotropy());
    const performance=this.quality==='performance';
    for(const mesh of this.distant)mesh.visible=!performance;
    this.districtDetail.value=performance?0:1;
    this.renderer.shadowMap.needsUpdate=true;
  }
  resize(){
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight;if(!w||!h)return;
    if(this.width===w&&this.height===h)return;this.width=w;this.height=h;this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;
    this.director.apply();
    this.bloom?.resize();
  }
  setShot(name,cut){
    this.director.cancel();
    let fit;
    if(name==='top'&&this.queueReach>500){
      const {left,right,far,near}=this.streets.bounds(this.armReach);
      const span=Math.max(near-far,(right-left)/this.camera.aspect);
      fit={distance:span*.61/Math.tan(T.MathUtils.degToRad(this.camera.fov/2)),
        target:[(right+left)/2,0,(near+far)/2]};
    }
    this.director.setShot(name,cut,fit);
  }
  setFree(active){
    this.flyKeys.clear();
    this.director.setFree(active);
    if(active)this.canvas.focus({preventScroll:true});
  }
  fly(forward,right,up){
    const limit=Math.max(this.city==='westminster'?16000:11200,this.queueReach+500);
    this.director.fly(forward,right,up,limit,Math.max(8500,this.queueReach*3.2));
  }
  advanceFree(delta){
    const keys=this.flyKeys;
    if(!this.director.free||!keys.size)return false;
    const held=(...codes)=>Number(codes.some(code=>keys.has(code)));
    const forward=held('KeyW','ArrowUp')-held('KeyS','ArrowDown');
    const right=held('KeyD','ArrowRight')-held('KeyA','ArrowLeft');
    const up=held('KeyE')-held('KeyQ');
    const length=Math.hypot(forward,right,up);
    if(!length)return false;
    const speed=held('ShiftLeft','ShiftRight')?1600:450;
    const step=delta/1000*speed/length;
    this.fly(forward*step,right*step,up*step);
    return true;
  }
  zoomBy(factor){
    const d=this.director;
    if(d.free){this.fly(Math.log(factor)*780,0,0);return;}
    d.cancel();
    const limit=Math.max(this.city==='westminster'?14000:5100,this.queueReach*3.2);
    d.distance=T.MathUtils.clamp(d.distance/factor,170,Math.max(limit,d.distance));
    d.orbit();
  }
  setQuality(quality){
    if(this.quality===quality)return;
    this.quality=quality;
    const cinematic=quality==='cinematic',performance=quality==='performance';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,cinematic?1.5:performance?.8:1.15));
    this.applyTownQuality();
    const shadow=this.sun.shadow;
    shadow.map?.dispose();shadow.map=null;
    shadow.mapSize.setScalar(cinematic?2048:performance?512:1024);
    this.renderer.shadowMap.needsUpdate=true;
    if(cinematic&&this.renderer.extensions.has('EXT_color_buffer_float')){
      this.bloom??=new CityBloom(this.renderer);
      this.bloom.resize();
    }else if(this.bloom){
      this.bloom.dispose();this.bloom=null;
    }
    this.onChange();
  }
  setAtmosphere(time,weather){
    this.lastAtmosphere=[time,weather];this.atmosphere.set(time,weather);this.onChange();}
  resetActors(){for(const g of this.actors.values())this.disposeActor(g);this.actors.clear();this.focus.visible=false;this.onChange();}
  disposeActor(g){this.scene.remove(g);const {headlights,tailLights,blinkMaterial}=g.userData;
    headlights?.dispose();tailLights?.dispose();blinkMaterial?.dispose();}
  select(pick){this.selected=pick;this.onChange();}
  bind(){
    const c=this.canvas,view=this.director,touches=new Map();
    let drag=null;
    const pan=(dx,dy)=>{
      const scale=2*view.distance*Math.tan(T.MathUtils.degToRad(this.camera.fov)/2)/this.height;
      const angle=view.azimuth,limit=Math.max(3400,this.queueReach);
      view.target.x=T.MathUtils.clamp(view.target.x-scale*(Math.cos(angle)*dx+Math.sin(angle)*dy),-limit,limit);
      view.target.z=T.MathUtils.clamp(view.target.z+scale*(Math.sin(angle)*dx-Math.cos(angle)*dy),-limit,limit);
    };
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{
      if((e.button!==0&&e.button!==2)||touches.size===2)return;
      if(view.free)c.focus({preventScroll:true});
      touches.set(e.pointerId,[e.clientX,e.clientY]);
      c.setPointerCapture(e.pointerId);
      if(touches.size===2){view.cancel();drag=null;return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pan:e.shiftKey||e.button===2};
      c.classList.add('dragging');
    });
    c.addEventListener('pointermove',e=>{
      const old=touches.get(e.pointerId);
      if(!old)return;
      touches.set(e.pointerId,[e.clientX,e.clientY]);
      const dx=e.clientX-old[0],dy=e.clientY-old[1];
      if(touches.size===2){
        const other=[...touches.entries()].find(([id])=>id!==e.pointerId)[1];
        const before=Math.hypot(old[0]-other[0],old[1]-other[1]);
        const after=Math.hypot(e.clientX-other[0],e.clientY-other[1]);
        if(before>6&&after>6)this.zoomBy(after/before);
        if(view.free){
          const scale=T.MathUtils.clamp(view.position.y*.006,1,14);
          this.fly(0,-dx*scale,dy*scale);
        }else{
          pan(dx/2,dy/2);
          view.orbit();
        }
        return;
      }
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4)return;
      const movedX=e.clientX-drag.x,movedY=e.clientY-drag.y;
      drag.x=e.clientX;drag.y=e.clientY;drag.moved=true;
      if(view.free){
        view.lookFree(movedX,movedY);
        return;
      }
      view.cancel();
      if(drag.pan||e.shiftKey)pan(movedX,movedY);
      else{
        view.azimuth-=movedX*.008;
        view.elevation=T.MathUtils.clamp(view.elevation+movedY*.005,.08,1.52);
      }
      view.orbit();
    });
    const finish=(e,pick)=>{
      if(!touches.delete(e.pointerId))return;
      if(!touches.size){
        c.classList.remove('dragging');
        if(pick&&drag?.id===e.pointerId&&!drag.moved&&!drag.pan)this.pick(e.clientX,e.clientY);
        drag=null;
      }else{
        const [[id,[x,y]]]=touches;
        drag={id,x,y,moved:true,pan:false};
      }
    };
    c.addEventListener('pointerup',e=>finish(e,true));c.addEventListener('pointercancel',e=>finish(e,false));c.addEventListener('lostpointercapture',e=>finish(e,false));
    c.addEventListener('wheel',e=>{e.preventDefault();const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.height:1);this.zoomBy(Math.exp(-T.MathUtils.clamp(d,-180,180)*.0022));},{passive:false});
    const releaseKeys=()=>this.flyKeys.clear();
    c.addEventListener('blur',releaseKeys);
    window.addEventListener('blur',releaseKeys);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseKeys();});
    c.addEventListener('keyup',e=>{if(this.flyKeys.delete(e.code))this.onChange();});
    c.addEventListener('keydown',e=>{
      if(view.free&&FLIGHT_KEYS.has(e.code)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
        e.preventDefault();
        if(!this.flyKeys.has(e.code)){
          this.flyKeys.add(e.code);
          this.onChange();
        }
        return;
      }
      const turn={
        ArrowLeft:[.14,0],ArrowRight:[-.14,0],ArrowUp:[0,.1],ArrowDown:[0,-.1],
      }[e.key];
      if(turn){
        e.preventDefault();view.cancel();
        view.azimuth+=turn[0];view.elevation=T.MathUtils.clamp(view.elevation+turn[1],.08,1.52);
        view.orbit();
      }else if(['+','=','-','Home'].includes(e.key)){
        e.preventDefault();
        if(e.key==='Home')this.setShot('orbit',matchMedia('(prefers-reduced-motion: reduce)').matches);
        else this.zoomBy(e.key==='-'?1/1.15:1.15);
      }
    });
  }
  pick(x,y){
    const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera({x:(x-r.left)*2/r.width-1,y:1-(y-r.top)*2/r.height},this.camera);
    const targets=[...this.actors.values(),...this.lights.filter(l=>l.g.visible).map(l=>l.g)];
    const hit=this.ray.intersectObjects(targets,true)[0];let obj=hit?.object;
    while(obj&&!obj.userData.pick)obj=obj.parent;
    this.onPick(obj?.userData.pick??null);
  }
  render(sim,alpha,{paths=true,reducedMotion=false,now=0,motionTime=sim.time}={}){
    if(!this.width||!this.height)return;
    const mode=sim.mode==='straight'?'straight':'left-turns';this.lanes.visible=mode!=='straight';
    for(const l of this.lights){l.g.visible=l.kind!=='left'||mode!=='straight';l.update(l.kind==='ped'?sim.pedestrianSignal(l.side):sim.vehicleSignal(l.side,l.kind));}
    for(const sensor of this.sensors){
      sensor.g.visible=sensor.mode===mode;if(!sensor.g.visible)continue;
      const on=sim.cars.some(c=>c.direction===sensor.direction&&(c.movement??'straight')===sensor.movement&&!c.served&&c.s>=240);
      sensor.m.color.set(on?'#b9eb8b':'#6c9d94');sensor.m.opacity=on?.86:.43;
    }
    for(const item of this.routes){
      const s=item.side?sim.pedestrianSignal(item.side):sim.vehicleSignal(item.direction,item.movement);
      item.path.visible=paths&&s==='green'&&(!item.mode||item.mode===mode);
      if(item.dash){
        item.dash.visible=item.path.visible;if(!item.dash.visible)continue;
        const car={direction:item.direction,movement:item.movement};let i=0;
        for(let distance=56+(reducedMotion?0:sim.time*67%42);distance<routeLength(car)-100&&i<23;distance+=42){
          const p=vehiclePose(car,distance,mode);this.tmp.position.set(p.x-500,2.8,p.y-500);this.tmp.rotation.set(0,-p.r,0);this.tmp.scale.set(4,.5,9);this.tmp.updateMatrix();item.dash.setMatrixAt(i++,this.tmp.matrix);
        }
        item.dash.count=i;item.dash.instanceMatrix.needsUpdate=true;
      }
    }
    const layout=queueLayout(sim,alpha);
    this.queueReach=layout.reach;
    this.armReach=layout.armReach;
    this.approaches.update(layout,Math.max(layout.reach,this.director.distance*.95+
      Math.max(Math.abs(this.camera.position.x),Math.abs(this.camera.position.z))));
    this.queueActors.update(layout,this.streets);
    const lighting=this.atmosphere.lamps.opacity;
    animateStreetLife(this.streetLife,motionTime,lighting,reducedMotion);
    for(const {model} of this.streetLife.cars)model.visible=layout.reach<970;
    const keep=new Set();
    for(const car of sim.cars){
      const k=`c${car.id}`;keep.add(k);if(!this.actors.has(k)){const g=makeCar(car);this.actors.set(k,g);this.scene.add(g);}
      const g=this.actors.get(k),previous=car.previousS??car.s;
      animateCar(g,car,T.MathUtils.lerp(previous,car.s,alpha),mode,lighting,motionTime,reducedMotion);
    }
    for(const {person:p,x,y:z,r,progress} of layout.people){
      const k=`p${p.id}`;keep.add(k);if(!this.actors.has(k)){const g=makeWalker(p);this.actors.set(k,g);this.scene.add(g);}
      const g=this.actors.get(k);
      const rise=7*T.MathUtils.clamp((Math.min(Math.abs(x-500),Math.abs(z-500))-123)/15,0,1);
      const pose=this.streets.pedestrian(x,z,r,p.side);
      g.position.set(pose.x,1.6+rise,pose.z);g.rotation.y=-pose.r;
      const stride=p.crossing&&!reducedMotion?Math.min(1,progress*24):0;
      animateWalker(g,progress*330,stride,reducedMotion?0:motionTime+p.id);
    }
    for(const [k,g] of this.actors)if(!keep.has(k)){this.disposeActor(g);this.actors.delete(k);}
    const sel=this.selected,selected=sel?.kind==='car'?this.actors.get(`c${sel.id}`):sel?.kind==='ped'?this.actors.get(`p${sel.id}`):null;
    this.focus.visible=!!selected;if(selected){this.focus.position.copy(selected.position);this.focus.position.y=3.5;this.focus.scale.setScalar(sel.kind==='car'?36:12);}
    const distance=this.director.distance;
    const far=Math.max(this.city==='westminster'?37000:14000,distance+layout.reach*2.5+3500);
    const near=Math.max(4,this.camera.position.y*.008);
    if(this.camera.far!==far||this.camera.near!==near){
      this.camera.far=far;this.camera.near=near;this.camera.updateProjectionMatrix();
    }
    this.atmosphere.update(this.camera,now,reducedMotion);
    this.river.material.uniforms.time.value=reducedMotion?0:motionTime;
    const overhead=Math.max(0,this.camera.position.y-900);
    const airScale=this.city==='westminster'?1.8:1;
    this.scene.fog.near=this.atmosphere.fogNear*airScale+overhead;
    this.scene.fog.far=this.atmosphere.fogFar*airScale+overhead*1.65;
    if(this.bloom)this.bloom.render(this.scene,this.camera);
    else this.renderer.render(this.scene,this.camera);
    this.projectMarkers();
  }
  projectMarkers(){
    for(const [i,marker] of this.markers.entries()){
      const spot=HOTSPOTS[i],p=this.projector.set(spot.x-500,13,spot.y-500).project(this.camera),x=(p.x*.5+.5)*this.width,y=(.5-p.y*.5)*this.height;
      marker.hidden=p.z< -1||p.z>1||x<18||x>this.width-18||y<22||y>this.height-20;
      if(!marker.hidden)marker.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
    }
  }
}
export class FlatView{
  constructor(canvas,viewport,markers,onChange){
    this.canvas=canvas;this.viewport=viewport;this.markers=markers;this.onChange=onChange;this.fallback=true;canvas.classList.add('flat-canvas');
    canvas.width=1000;canvas.height=1000;this.observer=new ResizeObserver(onChange);this.observer.observe(viewport);
  }
  resetActors(){} select(){} zoomBy(){}
  render(sim,alpha,opts){
    const layout=queueLayout(sim,alpha),span=queueViewSpan(layout.reach),offset=(span-1000)/2;
    drawJunction(this.canvas,sim,{...opts,alpha,layout,span,markers:false});
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight,s=Math.min(w,h);
    for(const [i,m] of this.markers.entries()){const p=HOTSPOTS[i];m.hidden=false;m.style.transform=`translate(${(w-s)/2+(p.x+offset)*s/span}px,${(h-s)/2+(p.y+offset)*s/span}px) translate(-50%,-50%)`;}
  }
}
