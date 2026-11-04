import * as T from '../vendor/three/three.module.js';

// Scene presets are local art direction, independent of the traffic clock.
const LIGHT = {
  day: {
    zenith:'#548ec8', horizon:'#d1e4ec', glow:'#ffe4a9', mist:'#c4d9e7',
    sun:'#fff0d6', direction:[-620,1060,-380], strength:2.75,
    fill:'#dceaff', ground:'#94766b', ambient:1.55, lamps:.04, disk:1,
  },
  golden: {
    zenith:'#6187b7', horizon:'#f5c8a7', glow:'#fcb076', mist:'#d5b6a9',
    sun:'#ffb361', direction:[-530,161,-950], strength:3.15,
    fill:'#b4c5ec', ground:'#a78677', ambient:1.43, lamps:.62, disk:1,
  },
  blue: {
    zenith:'#142744', horizon:'#67839f', glow:'#db9793', mist:'#526277',
    sun:'#a3baff', direction:[-850,380,-590], strength:.57,
    fill:'#a7bedb', ground:'#6d748a', ambient:1.5, lamps:1, disk:0, twilight:.92,
  },
  night: {
    zenith:'#0e173c', horizon:'#4f6287', glow:'#8fa9db', mist:'#415579',
    sun:'#9cb9ff', direction:[-740,690,-540], strength:.37,
    fill:'#7a9fde', ground:'#505a81', ambient:.94, lamps:1, disk:.45,
  },
};
const WEATHER = {
  clear:{cover:.17, sun:1, fogNear:3500, fogFar:11300, grey:0, wet:0},
  clouds:{cover:.69, sun:.54, fogNear:2450, fogFar:8500, grey:.29, wet:0},
  rain:{cover:.90, sun:.24, fogNear:2550, fogFar:10300, grey:.24, wet:1},
};

const skyVertex = /* glsl */ `
varying vec3 direction;
void main() {
  direction = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const skyFragment = /* glsl */ `
uniform vec3 zenith, horizon, glow, lightDirection, distantAir;
uniform float coverage, disk, twilight;
varying vec3 direction;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 f=fract(p), i=floor(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
void main() {
  vec3 ray=normalize(direction);
  float elevation=max(ray.y,0.0);
  float alignment=max(dot(ray,lightDirection),0.0);
  vec3 color=mix(horizon,zenith,pow(smoothstep(0.,.55,elevation),.55));
  color=mix(color,glow,pow(alignment,9.)*(.35+.31*disk)*(1.-coverage*.55));
  vec2 uv=ray.xz/max(.18,elevation+.29);
  uv=uv*vec2(3.9,7.6)+vec2(14.1,1.8);
  float clouds=noise(uv)*.57+noise(uv*2.18+3.2)*.27+noise(uv*5.3)*.16;
  float opacity=smoothstep(.67-coverage*.34-twilight*.12,.91-coverage*.34,clouds);
  opacity*=smoothstep(.004,.11,elevation);
  vec3 cloud=mix(horizon*.73,mix(zenith,horizon,.69),.55);
  float dusk=twilight*smoothstep(.025,.28,elevation)*(1.-smoothstep(.42,.71,elevation));
  cloud=mix(cloud,glow,pow(alignment,5.)*.34*disk+dusk*(.37+.32*clouds));
  color=mix(color,cloud,opacity*.89);
  color+=glow*smoothstep(.99948,.99982,alignment)*disk*(1.-opacity)*1.65;
  color=mix(distantAir,color,smoothstep(-.025,.065,ray.y));
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
}
`;

function rainField(){
  const positions=[];
  const count=1050;
  const random=(i,seed)=>T.MathUtils.euclideanModulo(Math.sin((i+1)*17.37+seed*78.23)*43758.54,1);
  for(let i=0;i<count;i++){
    const x=(random(i,1)-.5)*2150;
    const y=random(i,2)*680;
    const z=(random(i,3)-.5)*2150;
    positions.push(x,y,z,x+4,y+20,z+1);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{seconds:{value:0},strength:{value:.34}},
    vertexShader:`
      uniform float seconds;
      varying float distanceToView;
      void main(){
        vec3 p=position;
        p.y=mod(p.y-float(gl_VertexID%2)*20.0-seconds*370.0,680.0)
          +float(gl_VertexID%2)*20.0;
        p.x+=mod(seconds*60.0,120.0);
        vec4 viewPosition=modelViewMatrix*vec4(p,1.);
        distanceToView=-viewPosition.z;
        gl_Position=projectionMatrix*viewPosition;
      }
    `,
    fragmentShader:`
      uniform float strength;
      varying float distanceToView;
      out vec4 rainColor;
      void main(){
        float fade=smoothstep(16.,80.,distanceToView)*(1.-smoothstep(650.,1500.,distanceToView));
        rainColor=vec4(.7,.81,.98,strength*fade);
      }
    `,
    glslVersion:T.GLSL3,
  });
  const lines=new T.LineSegments(geometry,material);
  lines.frustumCulled=false;
  lines.visible=false;
  return lines;
}

export class Atmosphere {
  constructor(scene,renderer,sun,fill,town){
    this.scene=scene;
    this.renderer=renderer;
    this.sun=sun;
    this.fill=fill;
    this.useTown(town);
    this.uniforms={
      zenith:{value:new T.Color()},horizon:{value:new T.Color()},glow:{value:new T.Color()},
      distantAir:{value:scene.fog.color},lightDirection:{value:new T.Vector3()},coverage:{value:0},disk:{value:0},twilight:{value:0},
    };
    this.sky=new T.Mesh(new T.SphereGeometry(12000,32,18),new T.ShaderMaterial({
      vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:this.uniforms,
      side:T.BackSide,depthWrite:false,toneMapped:false,fog:false,
    }));
    this.sky.renderOrder=-100;
    this.rain=rainField();
    scene.add(this.sky,this.rain);
  }

  useTown({roadMaterial,windows,streetLights,glowMaterial,river,districtLamps}){
    this.road=roadMaterial;
    this.lamps=windows;
    this.streetLights=streetLights;
    this.glowMaterial=glowMaterial;
    this.river=river;
    this.districtLamps=districtLamps;
  }

  set(time,weather){
    const light=LIGHT[time], air=WEATHER[weather];
    const {zenith,horizon,glow,lightDirection,coverage,disk,twilight}=this.uniforms;
    const grey=new T.Color('#8799b2');
    zenith.value.set(light.zenith).lerp(grey,air.grey);
    horizon.value.set(light.horizon).lerp(grey,air.grey*.75);
    glow.value.set(light.glow);
    lightDirection.value.fromArray(light.direction).normalize();
    coverage.value=air.cover;
    disk.value=light.disk*(weather==='rain'?0:1);
    twilight.value=(light.twilight??0)*(weather==='rain'?.27:1);
    this.scene.fog.color.set(light.mist).lerp(horizon.value,.62);
    this.fogNear=air.fogNear;
    this.fogFar=air.fogFar;
    this.sun.color.set(light.sun);
    this.sun.position.fromArray(light.direction).normalize().multiplyScalar(1230);
    this.sun.intensity=light.strength*air.sun;
    this.fill.color.set(light.fill);
    this.fill.groundColor.set(light.ground);
    this.fill.intensity=light.ambient+(weather==='clouds'?.12:0);
    this.renderer.shadowMap.needsUpdate=true;
    this.road.roughness=air.wet?.46:.94;
    this.road.metalness=air.wet?.10:.02;
    this.road.userData.wet.value=air.wet;
    this.road.userData.skyTint.value.copy(horizon.value);
    this.lamps.opacity=Math.min(1,light.lamps+(weather==='rain'?.28:0));
    this.districtLamps.value=this.lamps.opacity;
    this.lamps.color.setScalar(1+this.lamps.opacity*.24);
    this.road.userData.warmth.value=this.lamps.opacity;
    this.river.setLight(horizon.value,this.lamps.opacity);
    for(const lamp of this.streetLights)lamp.intensity=this.lamps.opacity*4200;
    this.glowMaterial.opacity=this.lamps.opacity*.64;
    this.rain.visible=weather==='rain';
  }

  update(camera,now,reducedMotion){
    this.sky.position.copy(camera.position);
    if(this.rain.visible){
      this.rain.material.uniforms.seconds.value=reducedMotion?0:now/1000;
      this.rain.material.uniforms.strength.value=reducedMotion?.23:.43;
    }
  }
}
