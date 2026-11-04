import * as T from '../vendor/three/three.module.js';
import { touchesStreet } from './city-streets.js';

const roofProfile=new T.Shape();
roofProfile.moveTo(-.5,0);
roofProfile.lineTo(0,1);
roofProfile.lineTo(.5,0);
roofProfile.closePath();
const pitchedRoof=new T.ExtrudeGeometry(roofProfile,{depth:1,bevelEnabled:false});
pitchedRoof.translate(0,0,-.5);
pitchedRoof.rotateY(Math.PI/2);

export function streetMaterial(brick=false){
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});
  const wet={value:0};
  const skyTint={value:new T.Color('#bdd3ea')};
  const reflectors={value:[]},warmth={value:0};
  material.userData={wet,skyTint,reflectors,warmth};
  material.customProgramCacheKey=()=>brick?'london-brick':'london-asphalt';
  material.onBeforeCompile=shader=>{
    shader.uniforms.wet=wet;
    shader.uniforms.skyTint=skyTint;
    shader.uniforms.reflectors=reflectors;
    shader.uniforms.warmth=warmth;
    shader.vertexShader='varying vec3 vStreetPosition;\nvarying vec3 vStreetNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vStreetPosition=position;
      vStreetNormal=normal;
    `);
    shader.fragmentShader=`
      varying vec3 vStreetPosition, vStreetNormal;
      uniform float wet;
      uniform vec3 skyTint;
      uniform vec3 reflectors[4];
      uniform float warmth;
      float streetNoise(vec2 p){return fract(sin(dot(p,vec2(23.17,88.41)))*41758.34);}
      float smoothNoise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(streetNoise(i),streetNoise(i+vec2(1.,0.)),u.x),
          mix(streetNoise(i+vec2(0.,1.)),streetNoise(i+vec2(1.,1.)),u.x),u.y);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',brick?`
      #include <color_fragment>
      vec2 wall=vec2(abs(vStreetNormal.x)>.5?vStreetPosition.z:vStreetPosition.x,vStreetPosition.y);
      float row=floor(wall.y/4.6);
      vec2 brickUV=vec2(wall.x/10.5+mod(row,2.)*.5,wall.y/4.6);
      vec2 edge=min(fract(brickUV),1.-fract(brickUV));
      float mortar=1.-smoothstep(.017,.049,min(edge.x,edge.y));
      float varied=.82+streetNoise(floor(brickUV))*.32;
      diffuseColor.rgb*=varied;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.24,.20),mortar*.36);
    `:`
      #include <color_fragment>
      vec2 street=vStreetPosition.xz;
      float grain=streetNoise(floor(street*2.4));
      float aggregate=streetNoise(floor(street*.33));
      float laneDistance=min(abs(abs(street.x)-82.),abs(abs(street.y)-82.));
      float track=(1.-smoothstep(4.,17.,laneDistance))*.05;
      diffuseColor.rgb*=.89+.16*grain+.075*aggregate-track;
      diffuseColor.rgb*=1.-wet*.30;
    `);
    if(!brick){
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        if(wet>.01 && vStreetNormal.y>.9){
          float lowAngle=pow(1.-abs(dot(normalize(vViewPosition),normal)),3.);
          vec2 roadUV=vStreetPosition.xz*vec2(.029,.017);
          float patches=smoothNoise(roadUV)*.68+smoothNoise(roadUV*2.7+9.)*.32;
          vec2 curb=abs(abs(vStreetPosition.xz)-129.);
          float gutter=(1.-smoothstep(0.,9.,min(curb.x,curb.y)))*.3;
          float puddle=smoothstep(.53,.79,patches+gutter);
          outgoingLight+=skyTint*(.008+.18*lowAngle)*(.08+.92*puddle)*wet;
          float reflection=0.;
          for(int i=0;i<4;i++){
            vec3 lamp=reflectors[i];
            float eyeHeight=max(2.,cameraPosition.y-vStreetPosition.y);
            vec2 center=mix(cameraPosition.xz,lamp.xz,eyeHeight/(eyeHeight+lamp.y));
            vec2 axis=normalize(lamp.xz-cameraPosition.xz+vec2(.001));
            vec2 gap=vStreetPosition.xz-center;
            float width=dot(gap,vec2(-axis.y,axis.x));
            float along=dot(gap,axis);
            reflection+=exp(-abs(width)*.115-abs(along)*.026);
          }
          float streak=streetNoise(floor(vStreetPosition.xz*vec2(.61,.19)));
          outgoingLight+=vec3(1.,.50,.20)*reflection*(.08+.59*puddle)*warmth*wet*(.47+.53*streak);
        }
        #include <opaque_fragment>
      `);
    }
  };
  return material;
}

export function facadeMaterial(kind){
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.93});
  material.normalScale.setScalar(kind==='paving'?.67:.8);
  material.userData.textureKind=kind;
  material.userData.tileSpan={stone:88,slate:130,paving:125}[kind];
  material.customProgramCacheKey=()=>`facade-${kind}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 facadePoint, facadeNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      facadePoint=position;
      facadeNormal=normal;
    `);
    shader.fragmentShader=`
      varying vec3 facadePoint, facadeNormal;
      float masonryGrain(vec2 p){return fract(sin(dot(p,vec2(23.17,88.41)))*41758.34);}
    `+shader.fragmentShader;
    const pattern=kind==='slate'?`
      vec2 surface=vec2(facadePoint.x+facadePoint.z,facadePoint.y);
      vec2 courses=vec2(surface.x/8.+mod(floor(surface.y/3.),2.)*.5,surface.y/3.);
    `:`
      float along=abs(facadeNormal.x)>.5?facadePoint.z:facadePoint.x;
      vec2 surface=vec2(along,facadePoint.y);
      vec2 courses=vec2(along/14.+mod(floor(surface.y/6.),2.)*.5,surface.y/6.);
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
      vec3 albedo=texture2D(map,vMapUv).rgb;
      float tone=dot(albedo,vec3(.2126,.7152,.0722));
      vec3 colorDetail=mix(vec3(tone),albedo,.42);
      diffuseColor.rgb*=mix(vec3(1.12),colorDetail*2.1,${kind==='slate'?'.53':'.62'});
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      #ifndef USE_MAP
      ${pattern}
      vec2 edge=min(fract(courses),1.-fract(courses));
      float seam=1.-smoothstep(.01,.046,min(edge.x,edge.y));
      float grit=masonryGrain(floor(surface*2.1));
      float tile=masonryGrain(floor(courses));
      diffuseColor.rgb*=.90+.10*grit+.12*tile-.14*seam;
      #endif
    `);
  };
  return material;
}

// Procedural windows keep distant façades legible without adding a mesh for each pane.
export function districtMaterial(lamps,detail,scale=1){
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.87});
  material.customProgramCacheKey=()=> `london-district-${scale}`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.districtLamps=lamps;
    shader.uniforms.districtDetail=detail;
    shader.vertexShader='varying vec3 districtPoint, districtNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      districtPoint=position;
      districtNormal=normal;
    `);
    shader.fragmentShader=`
      varying vec3 districtPoint, districtNormal;
      uniform float districtLamps, districtDetail;
      float districtHash(vec3 p){
        return fract(sin(dot(p,vec3(32.47,92.13,64.19)))*42586.24);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 facadeAxis=districtNormal.xz/max(.001,length(districtNormal.xz));
      float along=dot(districtPoint.xz,vec2(-facadeAxis.y,facadeAxis.x));
      float wall=floor(dot(districtPoint.xz,facadeAxis)+.35);
      vec2 bays=vec2(along/${(12.5*scale).toFixed(2)}+districtHash(vec3(wall,1.,0.)),
        (districtPoint.y-3.)/${(15*scale).toFixed(2)});
      vec2 edge=abs(fract(bays)-vec2(.5,.53));
      vec2 aa=clamp(fwidth(bays)*.7,vec2(.012),vec2(.24));
      float visibility=(1.-smoothstep(.15,.59,max(aa.x,aa.y)))*(1.-abs(districtNormal.y));
      vec2 trim=1.-smoothstep(vec2(.30,.37)-aa,vec2(.30,.37)+aa,edge);
      vec2 pane=1.-smoothstep(vec2(.22,.29)-aa,vec2(.22,.29)+aa,edge);
      float recess=pane.x*pane.y*visibility;
      float lintel=(1.-smoothstep(.06,.09,abs(fract(bays.y)-.84)))*trim.x*visibility;
      float sill=(1.-smoothstep(.045,.08,abs(fract(bays.y)-.21)))*trim.x*visibility;
      float shadow=(1.-smoothstep(.02,.065,abs(fract(bays.y)-.28)))*pane.x*visibility;
      float litStep=step(.76,districtHash(vec3(floor(bays),floor(wall))));
      float glass=1.-smoothstep(.014-aa.x,.014+aa.x,edge.x);
      if(districtDetail>.5)diffuseColor.rgb*=.96+.07*districtHash(vec3(floor(along/7.),floor(districtPoint.y/3.5),wall));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.37,.32,.26),trim.x*trim.y*visibility*.62*districtDetail);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.058,.083,.104),recess*(1.-glass*.42));
      diffuseColor.rgb*=1.-.36*shadow*districtDetail;
      diffuseColor.rgb+=vec3(.13,.11,.08)*(lintel+sill)*districtDetail;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      outgoingLight+=vec3(.83,.45,.19)*recess*litStep*districtLamps*.66;
      #include <opaque_fragment>
    `);
  };
  return material;
}

const districtBrick=['#8d4f42','#925d52','#a27862','#80625a','#b59b80','#8b5f50','#a39381','#805b52'];
const districtSlate=['#4e5358','#555258','#66645f','#4f5d62','#635551'];

export function districtBlock(kit,walls,roofs,{x,z,w,d,base,seed,far=false}){
  const {cube,part,box}=kit;
  function building(bx,bz,width,depth,ordinal,angle=0,corner=false){
    const style=seed+ordinal*23;
    const floors=3+style%2+(corner&&style%11===0?3:0);
    const h=15*floors;
    const wall=districtBrick[style%districtBrick.length];
    const roof=districtSlate[style%districtSlate.length];
    walls.push(part(box,bx,base+h/2,bz,width,h,depth,wall,0,angle));
    if(style%5<3){
      const rise=depth*(style%3===0?.38:.24);
      roofs.push(part(pitchedRoof,bx,base+h,bz,width+2,rise,depth+3,roof,0,angle));
      if(!far){
        const chimney=width*.24;
        roofs.push(cube(bx+chimney*Math.cos(angle),base+h+rise+2,bz-chimney*Math.sin(angle),7,10,7,wall));
      }
    }else{
      roofs.push(part(box,bx,base+h,bz,width+2,4,depth+2,roof,0,angle));
      roofs.push(part(box,bx,base+h+6,bz,width*.64,11,depth*.58,roof,0,angle));
    }
  }
  // Rows hug the street and leave a narrow interior court for rear buildings.
  const frontDepth=Math.min(70,d*.24);
  for(const side of [-1,1]){
    const bz=z+side*(d-frontDepth)/2;
    const count=far?3:5;
    let edge=x-w/2;
    for(let i=0;i<count;i++){
      const end=i===count-1?x+w/2:x-w/2+w*(i+1)/count+((seed+i*13+side*7)%11-5)*1.8;
      building((edge+end)/2,bz,end-edge-1.5,frontDepth,(side+1)*5+i,0,i===0||i===count-1);
      edge=end;
    }
    if(!far||seed%3===0){
      building(x+side*(w-62)/2,z,d-frontDepth*2-13,62,side+13,Math.PI/2);
    }
  }
}

export function terrace(kit,block){
  const {cube,part,brick,trim,lit,slate,masonry}=kit;
  const {x,z,width,depth,height,angle=0,count=3,shop=false,seed=0,stone:stoneFront=false}=block;
  const fronts=['#9c5344','#bd8264','#a36b55','#b78062','#864e46'];
  const doors=['#29483e','#483943','#365464','#744439'];
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const place=(list,geo,lx,y,lz,w,h,d,color)=>{
    list.push(part(geo,x+lx*cos+lz*sin,y,z-lx*sin+lz*cos,w,h,d,color,0,angle));
  };
  const body=(list,lx,y,lz,w,h,d,color)=>{
    const local=cube(lx,y,lz,w,h,d,color);
    place(list,local.geo,lx,y,lz,w,h,d,color);
  };
  const bay=width/count,detail=Math.abs(x)<500&&Math.abs(z)<500;
  for(let i=0;i<count;i++){
    const lx=(i-(count-1)/2)*bay;
    const h=height+((i*13+seed*7)%4)*3.5;
    const facade=fronts[(seed+i)%fronts.length];
    const stone='#d7c7af';
    const roof='#3f4b56';
    const door=doors[(seed+i)%doors.length];
    const front=depth/2;
    body(stoneFront?masonry:brick,lx,9+h/2,0,bay-.8,h,depth,stoneFront?'#bdae99':facade);
    body(trim,lx,13,0,bay,8,depth+2,'#8a8280');
    body(trim,lx,h+8,0,bay+2,4,depth+5,stone);
    place(detail?slate:trim,pitchedRoof,lx,h+10,0,bay+1,depth*.24,depth+2,roof);
    if(detail){
      body(trim,lx,h+depth*.24+10,0,bay+2,2,2.5,'#424c52');
      body(trim,lx,h+6,depth/2+2,bay+1,2.5,2.5,'#484746');
      body(trim,lx+bay*.42,h/2+10,depth/2+2.6,1.4,h-7,1.5,'#545752');
    }
    body(brick,lx+bay*.28,h+depth*.20+12,-depth*.06,9,25,10,facade);
    body(trim,lx+bay*.28,h+depth*.20+26,-depth*.06,11,3,12,stone);
    body(trim,lx,h+depth*.10+11,front*.51,13,15,9,roof);
    body(trim,lx,h+depth*.10+12,front*.51+5,8,9,1,stone);
    body(trim,lx,h+depth*.10+12,front*.51+5.7,5,6,1,'#526a79');

    function window(wx,wy,face,glass){
      if(detail){
        body(trim,wx,wy,face+.55,10,15,1.2,'#344752');
        body(trim,wx,wy,face+1.26,8,13,.4,glass);
        if((Math.round(wy)+seed+i)%4!==0)body(lit,wx,wy,face+1.51,7.7,12.6,.18,'#ffcc91');
        for(const direction of [-1,1]){
          body(masonry,wx+direction*5.4,wy,face+2.4,2,17,4.8,stone);
          body(masonry,wx,wy+direction*7.9,face+2.5,11,1.8,5,stone);
        }
        body(trim,wx,wy,face+1.74,1,13.4,.4,stone);
        body(trim,wx,wy,face+1.74,9,1,.4,stone);
      }else{
        body(trim,wx,wy,face,12,18,2.2,stone);
        body(trim,wx,wy,face+1.3,9,14,1.4,glass);
        if((Math.round(wy)+seed+i)%4!==0)body(lit,wx,wy,face+2.05,8.4,13.5,.3,'#ffc481');
        body(trim,wx,wy,face+2.3,1,14,1.2,stone);
        body(trim,wx,wy,face+2.3,9,1.2,1.2,stone);
      }
      body(trim,wx,wy+9.2,face+.9,14,2.4,3,stone);
      body(trim,wx,wy-9.2,face+1.2,15,2.4,4,stone);
    }
    for(let y=43;y<h-3;y+=23){
      for(const offset of [-.24,.24])window(lx+bay*offset,y,front,'#516575');
      if(i===0||i===count-1){
        const sign=i===0?-1:1;
        const side=lx+sign*bay/2;
        for(const offset of [-.22,.22]){
          const at=offset*depth;
          body(trim,side+sign*.8,y,at,1.8,17,12,stone);
          body(trim,side+sign*1.85,y,at,1,13.5,9,'#546771');
          if((Math.round(y)+i)%3===0)body(lit,side+sign*2.42,y,at,.25,12.8,8.4,'#ffc78b');
          body(trim,side+sign*2.62,y,at,1,1.1,9,stone);
          body(trim,side+sign*1.5,y-8.7,at,3.5,2,14,stone);
        }
      }
    }
    if(shop&&i!==count-1){
      body(trim,lx,23,front+1,bay-5,27,3,door);
      body(trim,lx-3,23,front+3,bay-18,15,1.5,'#668085');
      body(lit,lx-3,detail?27:23,front+3.84,bay-19,detail?6:14,.25,'#e5b688');
      if(detail){
        body(trim,lx-3,20,front+4,bay-19,6,.35,'#56564a');
        body(trim,lx-3,17.3,front+4.6,bay-19,1.1,1.8,'#84664e');
        for(const offset of [-.26,.26]) {
          body(lit,lx-3+(bay-18)*offset,27,front+4.8,3.2,1.9,.85,'#ffe0ab');
          body(trim,lx-3+(bay-18)*offset,29.5,front+4.8,.42,3,.6,'#323734');
        }
      }
      if(detail){
        body(masonry,lx,15,front+2,bay-8,4,4,stone);
        for(const edge of [-1,1])body(masonry,lx+edge*(bay-8)/2,24,front+4,3,21,4,stone);
        for(let item=-2;item<=2;item++)body(trim,lx-3+item*3.6,18.7,front+4.4,2.4,2+Math.abs(item),.6,door);
      }
      for(const off of [-.26,0,.26])body(trim,lx+off*(bay-18)-3,23,front+4.5,1.2,16,1,door);
      body(trim,lx,37,front+3,bay-5,7,3,'#303b39');
      body(trim,lx,37,front+4.7,bay*.49,1.2,.5,'#d3ad6c');
      for(let stripe=0;stripe<7;stripe++){
        body(trim,lx+(stripe-3)*(bay-5)/7,32,front+6,(bay-5)/7,2.7,9,stripe%2?stone:door);
      }
    }else{
      body(trim,lx-bay*.22,22,front+1,13,27,3,stone);
      body(trim,lx-bay*.22,21,front+3,9,23,1.3,door);
      body(trim,lx-bay*.22,16,front+3,12,2.7,6,'#aaa096');
      body(trim,lx-bay*.22+2.9,20,front+3.8,1.2,1.2,.8,'#cfb46b');
      window(lx+bay*.23,24,front,'#516575');
    }
  }
}

export function londonLandmarks(kit){
  const {cube,column,ball,part,trim,masonry,slate,paving,lit,farDetail,farLights,cyl}=kit;
  // The tower shares a riverside terrace with Parliament, beside the bridge approach.
  const x=-264,z=-2227;
  const stone='#c9b08f',deep='#514741',trimStone='#e0c9a1';
  const block=cube(0,0,0,1,1,1,stone).geo;
  paving.push(cube(-435,4,-2221,516,10,143,'#c6c0b4'));
  masonry.push(cube(-478,54,z,382,90,91,stone));
  masonry.push(cube(-478,100,z,386,7,95,trimStone));
  slate.push(part(pitchedRoof,-478,103,z-2,375,21,82,'#6e7275'));
  trim.push(cube(-478,124,z-2,376,2.8,2,'#4b5055'));
  for(let i=0;i<16;i++){
    const px=-653+i*23;
    for(const side of [-1,1]){
      masonry.push(cube(px,55,z+side*47,3.3,85,6,trimStone),
        cube(px,103,z+side*48,8,7,5,stone));
      for(const y of [29,53,78]){
        const wx=px+9,face=z+side*45.8;
        trim.push(cube(wx,y,face,6.4,14,1.1,deep));
        if((i+Math.floor(y/20))%3!==0)lit.push(cube(wx,y,face+side*.66,4.4,9,.22,'#d8a264'));
        for(const edge of [-1,1]){
          masonry.push(cube(wx+edge*3.9,y,face+side,1.3,15.6,3.1,trimStone));
          trim.push(part(block,wx+edge*1.9,y+7.7,face+side,5,1.45,2.3,trimStone,0,0,-edge*.65));
        }
        masonry.push(cube(wx,y-7.6,face+side*1.4,9,1.5,3,trimStone));
      }
    }
  }
  for(const px of [-657,-480,-306]){
    trim.push(cube(px,113,z+34,20,23,19,stone),cube(px,126,z+34,23,4,22,trimStone));
  }

  masonry.push(cube(x,106,z,52,194,52,stone));
  trim.push(cube(x,15,z,63,12,63,trimStone),cube(x,203,z,65,8,65,trimStone),
    cube(x,228,z,62,45,62,deep),cube(x,251,z,67,6,67,trimStone),cube(x,260,z,52,15,52,stone));
  const spire=new T.ConeGeometry(1,1,4);
  slate.push(part(spire,x,288,z,34,52,34,'#64696e',0,Math.PI/4));
  trim.push(column(x,320,z,2.5,17,trimStone),ball(x,327,z,3.6,3.6,3.6,'#b89965'));
  trim.push(cube(x,306,z,11,.9,1,'#c9ac77'));
  for(const sx of [-1,1])for(const sz of [-1,1]){
    trim.push(cube(x+sx*25,127,z+sz*25,6,216,6,trimStone));
    trim.push(cube(x+sx*28,259,z+sz*28,7,23,7,trimStone));
    trim.push(part(spire,x+sx*28,275,z+sz*28,6,13,6,deep,0,Math.PI/4));
  }

  const clockDark='#33383b',clockY=227;
  const clockDisc=new T.CylinderGeometry(1,1,1,32);
  clockDisc.rotateX(Math.PI/2);
  const box=block;
  for(let side=0;side<4;side++){
    const angle=side*Math.PI/2,sin=Math.sin(angle),cos=Math.cos(angle);
    const put=(list,geo,u,y,depth,w,h,d,color,rz=0)=>{
      list.push(part(geo,x+u*cos+depth*sin,y,z-u*sin+depth*cos,w,h,d,color,0,angle,rz));
    };
    for(const y of [54,92,130,166]){
      put(trim,box,0,y,26.3,8,20,.9,deep);
      for(const u of [-4.7,4.7]){
        put(masonry,box,u,y,27.4,2,21,3.1,trimStone);
        put(masonry,box,u*.55,y+10.7,27.4,6,1.8,2.6,trimStone,-Math.sign(u)*.67);
      }
      put(masonry,box,0,y-10.7,27.9,11,2,4,trimStone);
      if(y>90)put(lit,box,0,y,27,4.3,13,.2,'#bd8d5e');
    }
    for(const y of [194,248,259]){
      for(const u of [-23,-15,-7,0,7,15,23]){
        put(masonry,box,u,y,28.5,2.2,9,3,trimStone);
      }
    }
    for(const y of [246,267]){
      for(const u of [-17,-9,0,9,17])put(lit,box,u,y,y===246?30.9:26.3,2,3,.45,'#c69256');
    }
    put(trim,clockDisc,0,clockY,31.5,20.3,20.3,2,trimStone);
    put(trim,clockDisc,0,clockY,32.8,17.3,17.3,1.6,'#f6dda8');
    put(lit,clockDisc,0,clockY,33.8,16.8,16.8,.4,'#ffe0a3');
    put(trim,box,0,clockY+5.5,34.3,1.8,11,.7,clockDark);
    put(trim,box,4.4,clockY-2.2,34.3,10,1.8,.7,clockDark,-.43);
    for(let tick=0;tick<12;tick++){
      const a=tick*Math.PI/6;
      put(trim,box,14.5*Math.sin(a),clockY+14.5*Math.cos(a),34.3,1.2,2.7,.6,clockDark,-a);
    }
  }

  // A dome and a wheel add distinct silhouettes behind the terrace roofs.
  const dx=-1070,dz=-3115;
  trim.push(cube(dx,60,dz,230,120,170,'#bbb5a9'),column(dx,132,dz,72,55,stone));
  trim.push(ball(dx,161,dz,69,64,69,'#688384'),column(dx,230,dz,10,29,stone),column(dx,256,dz,2.5,24,deep));
  for(let i=-4;i<=4;i++)trim.push(column(dx+i*22,90,dz+87,5,61,'#d0c3b0'));

  const wx=1030,wy=234,wz=-2980,r=168;
  trim.push(cube(wx,3,wz-31,430,8,89,'#9b978d'));
  const rim=new T.TorusGeometry(r,4.1,7,48);
  trim.push(part(rim,wx,wy,wz,1,1,1,'#e1ddd1'),part(rim,wx,wy,wz+14,1,1,1,'#b6c0c3'));
  for(let i=0;i<20;i++){
    const angle=i*Math.PI/10;
    const px=Math.cos(angle),py=Math.sin(angle);
    trim.push(part(cyl,wx+px*r/2,wy+py*r/2,wz+7,1.25,r,1.25,'#b7c6cc',0,0,angle-Math.PI/2));
    trim.push(ball(wx+px*r,wy+py*r,wz+7,8,5,11,'#aab9c2'));
  }
  for(const sign of [-1,1]){
    trim.push(part(cyl,wx+sign*36,wy/2,wz+7,4,208,4,'#c2c5c1',0,0,sign*.36));
  }

  // Layer low riverside warehouses in front of glass towers and distant blocks.
  const windowPlane=new T.PlaneGeometry(1,1);
  const stoneTones=['#82796c','#9b8f7c','#6d7780','#967d6d','#78848a'];
  // Break up the rear skyline with shorter blocks between the main roofs.
  for(let row=0;row<4;row++)for(let i=0;i<32;i++){
    const seed=i*29+row*71;
    const x=(i-15.5)*242+(row%2)*116+seed%32;
    const z=-4130-row*348-seed%102;
    const h=43+seed%128+(seed%9===0?71:0);
    const w=105+seed%82,d=88+seed%67;
    if(touchesStreet(x,z,w+8,d+87))continue;
    const tone=stoneTones[(seed+row)%stoneTones.length];
    trim.push(cube(x,h/2,z,w,h,d,tone));
    farDetail.push(cube(x,h+2,z,w+4,4,d+4,'#565c63'));
    const roofHeight=7+seed%22;
    if(seed%3===0){
      farDetail.push(part(pitchedRoof,x,h+2,z,w,roofHeight,d,'#51575f'));
    }else{
      farDetail.push(cube(x-w*.15,h+roofHeight/2,z-d*.09,w*.48,roofHeight,d*.68,tone));
    }
    if(seed%4!==0){
      const wing=48+seed%15, wingHeight=h*.46;
      trim.push(cube(x+w*.19,wingHeight/2,z-d/2-21,wing,wingHeight,44,tone));
    }
    for(let y=21;y<h-8;y+=23){
      for(let bay=-2;bay<=2;bay++){
        const px=x+bay*w*.16;
        farDetail.push(part(windowPlane,px,y,z+d/2+.2,w*.084,8,1,'#455766'));
        if((seed+y+bay*3)%11<4){
          farLights.push(part(windowPlane,px,y,z+d/2+.5,w*.06,5,1,'#ceac83'));
        }
      }
    }
  }

  // Low outer districts fill the gaps behind the skyline without competing with the towers.
  for(let row=0;row<5;row++)for(let i=0;i<37;i++){
    const seed=i*47+row*61;
    const x=(i-18)*296+(row%2)*105+seed%57;
    const z=-5530-row*345-seed%142;
    const w=123+seed%123,d=100+seed%117,h=32+seed%77;
    if(touchesStreet(x,z,w+8,d+8))continue;
    const tone=stoneTones[(i+row*2)%stoneTones.length];
    trim.push(cube(x,h/2,z,w,h,d,tone));
    farDetail.push(cube(x+w*.16,h+5,z-d*.08,w*.47,10+seed%17,d*.58,'#5e656a'));
    for(let bay=-3;bay<=3;bay++){
      if((seed+bay*3)%13>5)continue;
      farLights.push(part(windowPlane,x+bay*w*.124,h*.67,z+d/2+.24,5.5,4.3,1,'#c4a27c'));
    }
  }

  // A continuous frontage behind the embankment, with gaps at the bridges and Palace.
  for(const [index,x] of [-2210,-1940,-1670,-1400,-1130,-880,358,655,930,1205,1430,1875,2140,2400].entries()){
    terrace(kit,{x,z:-2200+(index%3)*6,width:194+index*23%43,depth:63+index*11%17,
      height:42+index*13%25,angle:Math.PI,count:4,seed:index});
  }
  for(let row=0;row<4;row++)for(let i=0;i<26;i++){
    const x=(i-12.5)*222+(row%2)*61+(i*59+row*23)%42-21;
    if(Math.abs(x)<165||(!row&&Math.abs(x-1030)<260))continue;
    if(row===0){
      const frontage=(i-12.5)*222;
      const phase=i%5;
      for(let bay=-1;bay<=1;bay++){
        const bx=frontage+bay*63,bz=-3050-(i*17+bay*5)%13;
        const h=51+(i*7+bay*11+30)%34,d=83+phase*6;
        if(touchesStreet(bx,bz,65,d+8))continue;
        const face=bz+d/2;
        masonry.push(cube(bx,h/2,bz,62,h,d,stoneTones[(i+bay+5)%5]));
        trim.push(cube(bx,h,bz,64,3,d+3,'#ab9d87'));
        if((i+bay)%3!==0)slate.push(part(pitchedRoof,bx,h+1,bz,64,13+phase*2,d+3,'#555e63'));
        else trim.push(cube(bx,h+3,bz,61,5,d,'#827c70'),cube(bx+18,h+8,bz-14,8,15,8,'#886f60'));
        for(let y=13;y<h-5;y+=15){
          for(const u of [-21,-8,8,21]){
            const px=bx+u;
            farDetail.push(part(windowPlane,px,y,face+.25,6.5,8,1,'#313c42'));
            farDetail.push(cube(px,y-4.4,face+.9,8,1.2,1.6,'#b3a18a'));
            if((i+y+u+bay)%5<3)farLights.push(part(windowPlane,px,y,face+.46,4.8,6.7,1,'#e5b982'));
          }
        }
      }
      continue;
    }
    const z=-3065-row*198-(i*37)%69;
    const seed=i*19+row*43;
    const w=102+seed%70,d=77+seed%49;
    if(touchesStreet(x,z,w+8,d+8))continue;
    const h=36+seed%71+row*(17+seed%23);
    trim.push(cube(x,h/2,z,w,h,d,stoneTones[seed%stoneTones.length]));
    farDetail.push(cube(x,h+2,z,w+4,4,d+5,'#565d62'));
    for(let y=14;y<h-7;y+=15){
      farDetail.push(cube(x,y-3,z+d/2+.12,w*.88,1,.4,'#a49d88'));
      for(let offset=-w/2+12;offset<w/2-8;offset+=13){
        farDetail.push(part(windowPlane,x+offset,y,z+d/2+.25,6.5,7,1,'#506371'));
        if((y+Math.round(offset)+seed)%7<3){
          farLights.push(part(windowPlane,x+offset,y,z+d/2+.5,5.6,5.8,1,(seed+y)%3?'#e4a968':'#bdd4e2'));
        }
      }
      for(let offset=-d/2+12;offset<d/2-8;offset+=15){
        if((y+Math.round(offset)+seed)%7<2){
          for(const sign of [-1,1])farLights.push(part(windowPlane,x+sign*(w/2+.4),y,z+offset,5,5.5,1,
            '#d6ac77',0,sign*Math.PI/2));
        }
      }
    }
  }
  for(const [bx,bz,w,d,h,color,top] of [
    [-2140,-3720,130,128,338,'#59717d',.58],[-1690,-3430,116,102,295,'#6a8190',.91],
    [-1420,-3660,145,126,408,'#4d6c80',.70],[-920,-3770,143,105,345,'#698794',.76],
    [240,-3730,124,115,515,'#52748b',.06],[470,-3460,115,100,295,'#8296a0',.84],
    [1280,-3510,152,135,383,'#537488',.56],[1650,-3420,137,110,400,'#668298',.80],
    [1970,-3660,139,109,295,'#7d929a',.85],[2330,-3820,141,116,355,'#6f8997',.64],
  ]){
    if(touchesStreet(bx,bz,w+8,d+8))continue;
    const profile=new T.CylinderGeometry(top,1,1,4);
    profile.rotateY(Math.PI/4);
    trim.push(part(profile,bx,h*.5,bz,w/Math.SQRT2,h,d/Math.SQRT2,color));
    for(let level=0;level<34;level++){
      const y=h*(level+.45)/34;
      const scale=1-(1-top)*y/h;
      for(const face of [0,1,-1]){
        const across=face?d:w;
        const fx=face?bx+face*(w*scale/2+.85):bx;
        const fz=face?bz:bz+d*scale/2+.85;
        const angle=face*Math.PI/2;
        farDetail.push(part(windowPlane,fx,y,fz,across*scale*.94,1.6,1,'#839eae',0,angle));
        for(let bay=-3;bay<=3;bay++){
          const choice=(Math.abs(bx)+level*17+bay*7+face*23)%19;
          if(choice>6)continue;
          const offset=bay*across*scale*.125;
          farLights.push(part(windowPlane,fx+(face?face*.3:offset),y+2.8,fz+(face?offset:.3),
            across*scale*.079,2.5,1,choice<4?'#e4ba82':'#9db9cc',0,angle));
        }
      }
    }
    farLights.push(cube(bx,h+1,bz,4,4,4,'#f06049'));
  }

}

export function bus(kit){
  const {cube,part,trim,cyl}=kit;
  const x=-133,z=-749;
  const red='#b83036';
  trim.push(cube(x,30.5,z,33,46,104,red),cube(x,54,z,31,4,100,'#ca4544'));
  trim.push(cube(x,12,z+52.7,33,3,1.2,'#873238'));
  for(const side of [-1,1]){
    trim.push(cube(x+side*16.75,34,z,.6,1.8,102,'#8d2529'),
      cube(x+side*16.9,19,z+37,.65,21,16,'#403f3b'),
      cube(x+side*17.3,20,z+37,.3,13,11,'#506978'),
      cube(x+side*17.5,19,z+37,.3,21,.8,'#222932'));
  }
  trim.push(cube(x,8,z,35,5,106,'#293735'));
  for(const level of [23,43]){
    trim.push(cube(x,level,z+52,27,13,1.8,'#324b59'));
    for(const sign of [-1,1])for(let i=0;i<6;i++){
      trim.push(cube(x+sign*16.6,level,z+(i-2.5)*15,.75,12,12,'#3f5b65'));
    }
  }
  for(const sign of [-1,1]){
    for(const offset of [-32,31]){
      trim.push(part(cyl,x+sign*16.1,7,z+offset,7,4.5,7,'#253132',0,0,Math.PI/2));
      trim.push(part(cyl,x+sign*18.5,7,z+offset,3.5,.7,3.5,'#9ba9a9',0,0,Math.PI/2));
    }
    trim.push(cube(x+sign*12,13,z+52.4,5,3,1,'#eee0b7'));
  }
  trim.push(cube(x,33,z+52.5,23,5.5,1.2,'#2b3438'),cube(x,33,z+53.2,16,1.8,.6,'#e0bd80'));
}

export function cityFrontage(scene,kit,ground,mark){
  const {cube,part,column,trim,masonry,lit}=kit;
  const paving='#a7a199',iron='#303a41',stone='#bfb4a1';
  const box=cube(0,0,0,1,1,1,stone).geo;
  // The commercial corner faces the junction. Keep its footprint behind the footway.
  const x=428,z=-236,w=86,d=89;
  masonry.push(cube(x,69,z,w,120,d,stone));
  trim.push(cube(x,22,z,w+3,26,d+3,'#60564d'));
  for(const y of [35,41,100,130]){
    trim.push(cube(x,y,z,w+5,2.5,d+5,'#dfd5bf'));
  }
  trim.push(cube(x,134,z,w+3,7,d+3,'#897f71'),cube(x,141,z-11,49,11,39,'#79766f'));
  for(const side of [-1,1]){
    for(let offset=-30;offset<=30;offset+=20){
      for(const y of [22,54,75,94,113]){
        const frame=y===22?'#393f45':'#e0d4bf',glass=y===22?'#516675':'#617580';
        trim.push(cube(x+offset,y,z+side*(d/2+.5),13,17,2,frame));
        trim.push(cube(x+offset,y,z+side*(d/2+1.65),10,13,.8,glass));
        trim.push(cube(x+side*(w/2+.5),y,z+offset,2,17,13,frame));
        trim.push(cube(x+side*(w/2+1.65),y,z+offset,.8,13,10,glass));
        if((offset+y+side)%3!==0){
          lit.push(cube(x+offset,y,z+side*(d/2+2.1),9.6,12.7,.2,'#ffbe83'));
          lit.push(cube(x+side*(w/2+2.1),y,z+offset,.2,12.7,9.6,'#ffbe83'));
        }
        trim.push(cube(x+offset,y,z+side*(d/2+2.3),.9,13,.9,frame));
        trim.push(cube(x+side*(w/2+2.3),y,z+offset,.9,13,.9,frame));
      }
    }
  }

  const signCanvas=document.createElement('canvas');
  signCanvas.width=512;signCanvas.height=256;
  const ctx=signCanvas.getContext('2d');
  const signs=[
    ['BAKERY','#233b45',-298.4,37,-287.3,0,43,7],
    ['BOOKS','#3b3747',-353.6,37,-287.3,0,43,7],
    ['CORNER MARKET','#35463c',x,35,z+d/2+3.3,0,69,8],
    ['BUS STOP','#96383f',-166,42,-644,0,15,5],
  ];
  const signTexture=new T.CanvasTexture(signCanvas);
  signTexture.colorSpace=T.SRGBColorSpace;
  const signMaterial=new T.MeshStandardMaterial({map:signTexture,roughness:.82,side:T.DoubleSide});
  for(const [index,[label,color,sx,y,sz,rotation,width,height]] of signs.entries()){
    const top=index*64;
    ctx.fillStyle=color;ctx.fillRect(0,top,512,64);
    ctx.strokeStyle='#c9ad77';ctx.lineWidth=2;ctx.strokeRect(8,top+6,496,52);
    ctx.fillStyle='#fff0cb';ctx.font='600 36px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,256,top+34,470);
    const geom=new T.PlaneGeometry(width,height),uv=geom.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,(3-index+uv.getY(i))*.25);
    const face=new T.Mesh(geom,signMaterial);
    face.position.set(sx,y,sz);face.rotation.y=rotation;scene.add(face);
  }

  // Paved shop forecourts with a café, planters and street furniture.
  for(const side of [-1,1]){
    const cx=side*331;
    ground.push(cube(cx,9.8,-222,276,1.6,126,paving));
    for(let j=0;j<7;j++){
      ground.push(cube(cx,10.7,-168-j*17,273,.2,.65,'#837f7c'));
      for(let i=0;i<10;i++)ground.push(cube(cx-123+i*27+(j%2)*9,10.7,-176-j*17,.6,.2,16,'#837f7c'));
    }
    for(const dx of [-103,102]){
      trim.push(cube(cx+dx,15,-182,20,9,13,'#6d6458'),cube(cx+dx,20,-182,22,2,15,'#96887a'));
      for(let i=0;i<3;i++)trim.push(column(cx+dx+(i-1)*5,22+i%2*1.5,-182,3.5,5,'#557456'));
    }
    for(const dx of [-73,62]){
      trim.push(column(cx+dx,17,-189,3.7,13,iron),column(cx+dx,24,-189,4.1,2,'#8c8572'));
      trim.push(cube(cx+dx,22,-183,10,3,1.3,'#ceb283'));
    }
  }
  const parasol=new T.ConeGeometry(1,1,12);
  for(const [i,cx] of [-314,-369].entries()){
    const cz=-241;
    trim.push(column(cx,20,cz,10,2,'#846959'),column(cx,25,cz,1.1,29,iron));
    trim.push(part(parasol,cx,40,cz,16,7,16,i===0?'#b15246':'#456c73'));
    for(const offset of [-15,15]){
      trim.push(cube(cx+offset,16,cz,6,2,7,'#b59778'),cube(cx+offset,20,cz+3.6,6,8,1.6,iron));
      for(const leg of [-2,2])trim.push(cube(cx+offset+leg,13,cz,1,6,5,iron));
    }
  }
  // Street-facing market awning and recessed thresholds, clear of walking routes.
  for(let i=0;i<15;i++){
    const bx=x+(i-7)*5.05;
    const cloth=i%2===0?'#3b6357':'#d3c7a6';
    trim.push(part(box,bx,32,z+d/2+8,5.05,1.3,13,cloth,.18));
    trim.push(cube(bx,30,z+d/2+14.2,5.05,2.5,.9,cloth));
  }
  for(const dx of [-29,29])trim.push(cube(x+dx,11.5,z+d/2+5,14,2.2,8,stone));

  // Bus shelter, post box and bike stands sit clear of the simulation lanes.
  ground.push(cube(-149,3.4,-678,36,8,126,paving));
  for(const zz of [-654,-700])for(const xx of [-161,-144])trim.push(column(xx,21,zz,1.3,28,iron));
  trim.push(cube(-152,36,-677,24,3.3,53,'#52606a'),cube(-162,20,-677,1.7,22,46,'#7998a6'));
  trim.push(cube(-158,13,-677,7,2.2,35,'#8b6f5c'),column(-166,27,-644,1.2,30,iron));
  trim.push(cube(-145,22,-697,1.5,19,9,'#325764'),cube(-144.1,22,-697,.4,15,7,'#ead7a1'));
  lit.push(cube(-152,34.2,-677,14,.3,41,'#ffdd9c'));
  trim.push(column(188,19,-248,5.6,20,'#a93039'),column(188,30,-248,6.1,3,'#b93e42'));
  trim.push(cube(188,25,-242.3,5,1.6,1,iron));
  const rack=new T.TorusGeometry(5,1.05,6,16,Math.PI);
  for(const dx of [0,15,30]){
    trim.push(part(rack,257+dx,13,-201,1,1,1,iron,0,Math.PI/2));
    for(const dz of [-5,5])trim.push(column(257+dx,12,-201+dz,1,5,iron));
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){
    // Kerb stones break up the pavement edge and terminate before each crossing.
    for(let distance=186;distance<500;distance+=23){
      const tone=distance%3===0?'#c3baa8':'#b5aea1';
      ground.push(cube(sx*132,5.2,sz*distance,4.5,6,22.3,tone),
        cube(sx*distance,5.2,sz*132,22.3,6,4.5,tone));
    }
    mark.push(cube(sx*119,1.29,sz*261,9,.35,18,'#39434a'),
      cube(sx*261,1.29,sz*119,18,.35,9,'#39434a'));
    for(let bar=-7;bar<=7;bar+=2){
      mark.push(cube(sx*119,1.52,sz*261+bar,7,.16,.64,'#929592'),
        cube(sx*261+bar,1.52,sz*119,.64,.16,7,'#929592'));
    }
  }
  for(const side of [-1,1]){
    for(const lane of [124,128]){
      for(const [lo,hi] of [[184,486],[504,950]]){
        const middle=side*(lo+hi)*.5,span=hi-lo;
        mark.push(cube(lane,1.33,middle,1.1,.28,span,'#b99d60'),cube(-lane,1.33,middle,1.1,.28,span,'#b99d60'));
        mark.push(cube(middle,1.33,lane,span,.28,1.1,'#b99d60'),cube(middle,1.33,-lane,span,.28,1.1,'#b99d60'));
      }
    }
    for(const p of [146,153,160]){
      mark.push(cube(side*p,8.8,-148,5,.32,18,'#c8a16c'),cube(side*p,8.8,148,5,.32,18,'#c8a16c'));
      mark.push(cube(148,8.8,side*p,18,.32,5,'#c8a16c'),cube(-148,8.8,side*p,18,.32,5,'#c8a16c'));
    }
  }
}
