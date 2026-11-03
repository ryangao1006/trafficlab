import * as T from '../vendor/three/three.module.js';

export const riverSections=[
  [-9000,-2633],[-2700,-2633],[2700,-2633],[3100,-2615],[3500,-2525],
  [3950,-2350],[4450,-2115],[5050,-1920],[5700,-1840],[6400,-1870],
  [7200,-2010],[8250,-2290],[9800,-2500],
];

function riverSurface(){
  const positions=[],indices=[];
  for(const [x,z] of riverSections){
    positions.push(x,-(z+333),0,x,-(z-333),0);
  }
  for(let i=0;i<positions.length/3-2;i+=2){
    indices.push(i,i+2,i+1,i+1,i+2,i+3);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  return geometry;
}


const vertex=`
  uniform mat4 reflectionCamera;
  varying vec3 world;
  varying vec4 reflected;
  #include <fog_pars_vertex>
  void main(){
    vec4 positionWorld=modelMatrix*vec4(position,1.);
    world=positionWorld.xyz;
    reflected=reflectionCamera*positionWorld;
    vec4 mvPosition=viewMatrix*positionWorld;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const fragment=`
  uniform vec3 waterTint, skyTint;
  uniform float time, lamps, quality, decorativeLights;
  uniform sampler2D mirror;
  varying vec3 world;
  varying vec4 reflected;
  #include <fog_pars_fragment>
  void main(){
    vec2 p=world.xz;
    float swell=sin(dot(p,vec2(.021,.037))+time*.83);
    float crossWave=sin(dot(p,vec2(-.056,.091))+swell*1.6-time*1.17);
    float ripples=.55*swell+.45*crossWave;
    float detail=0.;
    if(quality>.5){
      float width=max(length(dFdx(p)),length(dFdy(p)));
      detail=sin(dot(p,vec2(.231,.174))+crossWave*1.8+time*2.1)*(1.-smoothstep(2.,12.,width));
    }
    vec3 view=normalize(cameraPosition-world);
    float fresnel=.024+.976*pow(1.-clamp(view.y,0.,1.),3.2);
    vec3 color=mix(waterTint,skyTint,.055+.39*fresnel)*(1.+ripples*.049+detail*.019);
    if(quality>.5&&decorativeLights>.5){
      float shore=exp(-min(abs(p.y+2303.),abs(p.y+2967.))*.031);
      float bridge=exp(-abs(abs(p.x)-168.)*.048);
      float path=abs(mod(abs(p.x)-265.+87.5+crossWave*5.,175.)-87.5);
      float lantern=abs(mod(p.y+2406.+swell*6.,112.)-56.);
      float quay=1.-smoothstep(2440.,2710.,abs(p.x));
      float lights=shore*quay*exp(-path*.19)*.12+bridge*exp(-lantern*.095)*.10;
      color+=vec3(1.,.51,.20)*lights*lamps*(.62+detail*.19);
    }
    if(quality>1.5&&reflected.w>0.){
      vec2 uv=reflected.xy/reflected.w*.5+.5;
      uv+=vec2(crossWave*.0021+detail*.0015,swell*.0014+detail*.00065);
      vec2 border=min(uv,1.-uv);
      float edge=smoothstep(0.,.026,min(border.x,border.y));
      vec3 image=texture2D(mirror,clamp(uv,0.,1.)).rgb;
      color=mix(color,image,edge*(.23+.49*fresnel));
    }
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class River extends T.Mesh {
  constructor(geometry=riverSurface(),decorativeLights=true){
    const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{
      waterTint:{value:new T.Color('#23353e')},skyTint:{value:new T.Color('#8da8bb')},
      time:{value:0},lamps:{value:0},quality:{value:1},mirror:{value:null},
      decorativeLights:{value:decorativeLights?1:0},
      reflectionCamera:{value:new T.Matrix4()},
    }]);
    super(geometry,new T.ShaderMaterial({
      uniforms,vertexShader:vertex,fragmentShader:fragment,fog:true,
    }));
    this.rotation.x=-Math.PI/2;
    this.position.y=-.25;
    this.reflectedCamera=new T.PerspectiveCamera();
    this.direction=new T.Vector3();
    this.look=new T.Vector3();
    this.normal=new T.Vector3(0,1,0);
    this.plane=new T.Plane();
    this.clip=new T.Vector4();
    this.corner=new T.Vector4();
    this.lastCamera=new T.Matrix4();
    this.lastProjection=new T.Matrix4();
    this.invalidateReflection();
  }

  setQuality(quality){
    const cinematic=quality==='cinematic';
    this.material.uniforms.quality.value=cinematic?2:quality==='performance'?0:1;
    if(cinematic&&!this.buffer){
      this.buffer=new T.WebGLRenderTarget(896,504);
      this.invalidateReflection();
      this.material.uniforms.mirror.value=this.buffer.texture;
    }else if(!cinematic&&this.buffer){
      this.material.uniforms.mirror.value=null;
      this.buffer.dispose();
      this.buffer=null;
    }
  }

  invalidateReflection(){this.lastTime=Infinity;}

  setLight(sky,lamps){
    this.material.uniforms.skyTint.value.copy(sky);
    this.material.uniforms.lamps.value=lamps;
    this.invalidateReflection();
  }

  onBeforeRender(renderer,scene,camera){
    if(!this.buffer||camera.position.y<=this.position.y)return;
    const time=this.material.uniforms.time.value;
    // Reuse the same view between a few waves of motion. Any change of camera
    // or lighting takes effect immediately, including while the simulation is paused.
    if(Math.abs(time-this.lastTime)<.095&&this.lastCamera.equals(camera.matrixWorld)&&
      this.lastProjection.equals(camera.projectionMatrix))return;
    this.lastTime=time;
    this.lastCamera.copy(camera.matrixWorld);
    this.lastProjection.copy(camera.projectionMatrix);
    const reflected=this.reflectedCamera,y=this.position.y;
    reflected.position.copy(camera.position);
    reflected.position.y=2*y-camera.position.y;
    camera.getWorldDirection(this.direction).reflect(this.normal);
    reflected.up.set(0,1,0).applyQuaternion(camera.quaternion).reflect(this.normal);
    reflected.lookAt(this.look.copy(reflected.position).add(this.direction));
    reflected.far=camera.far;
    reflected.updateMatrixWorld();
    const projection=reflected.projectionMatrix.copy(camera.projectionMatrix);
    this.material.uniforms.reflectionCamera.value.multiplyMatrices(projection,reflected.matrixWorldInverse);

    // Clip the mirrored camera at the waterline so the riverbed cannot cover the reflections.
    this.plane.setFromNormalAndCoplanarPoint(this.normal,this.position).applyMatrix4(reflected.matrixWorldInverse);
    const {normal,constant}=this.plane,p=projection.elements;
    this.clip.set(normal.x,normal.y,normal.z,constant);
    this.corner.set((Math.sign(this.clip.x)+p[8])/p[0],(Math.sign(this.clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
    this.clip.multiplyScalar(2/this.clip.dot(this.corner));
    p[2]=this.clip.x;p[6]=this.clip.y;p[10]=this.clip.z+1-.002;p[14]=this.clip.w;

    const target=renderer.getRenderTarget();
    this.visible=false;
    try{
      renderer.setRenderTarget(this.buffer);
      renderer.state.buffers.depth.setMask(true);
      renderer.render(scene,reflected);
    }finally{
      renderer.setRenderTarget(target);
      this.visible=true;
    }
  }
}
