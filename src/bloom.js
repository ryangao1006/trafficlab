import * as T from '../vendor/three/three.module.js';

const vertex=`
  varying vec2 screenUV;
  void main(){
    screenUV=uv;
    gl_Position=vec4(position.xy,0.,1.);
  }
`;
const extract=`
  uniform sampler2D image;
  varying vec2 screenUV;
  void main(){
    vec3 source=texture2D(image,screenUV).rgb;
    float energy=max(source.r,max(source.g,source.b));
    gl_FragColor=vec4(source*smoothstep(.95,1.60,energy),1.);
  }
`;
const composite=`
  uniform sampler2D image, highlights;
  uniform vec2 pixel;
  varying vec2 screenUV;
  void main(){
    vec3 halo=vec3(0.);
    for(int x=-1;x<=1;x++){
      for(int y=-1;y<=1;y++){
        vec2 offset=vec2(float(x),float(y));
        halo+=texture2D(highlights,screenUV+offset*pixel*2.).rgb/(1.+dot(offset,offset));
      }
    }
    vec2 edge=abs(screenUV*2.-1.);
    float vignette=1.-.12*smoothstep(.65,1.35,length(edge));
    gl_FragColor=vec4((texture2D(image,screenUV).rgb+halo*.039)*vignette,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class CityBloom {
  constructor(renderer){
    this.renderer=renderer;
    this.size=new T.Vector2();
    const gl=renderer.getContext();
    const supported=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);
    const samples=supported.includes(4)?4:supported.includes(2)?2:0;
    this.image=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples});
    this.highlights=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
    this.camera=new T.Camera();
    this.scene=new T.Scene();
    this.geometry=new T.PlaneGeometry(2,2);
    this.extract=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:extract,depthTest:false,depthWrite:false,
      toneMapped:false,uniforms:{image:{value:this.image.texture}}});
    this.composite=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:composite,depthTest:false,depthWrite:false,
      uniforms:{image:{value:this.image.texture},highlights:{value:this.highlights.texture},pixel:{value:new T.Vector2()}}});
    this.screen=new T.Mesh(this.geometry,this.extract);
    this.screen.frustumCulled=false;
    this.scene.add(this.screen);
  }

  resize(){
    this.renderer.getDrawingBufferSize(this.size);
    const {x,y}=this.size;
    const w=Math.max(1,Math.ceil(x/5)),h=Math.max(1,Math.ceil(y/5));
    this.image.setSize(x,y);
    this.highlights.setSize(w,h);
    this.composite.uniforms.pixel.value.set(1/w,1/h);
  }

  render(scene,camera){
    const renderer=this.renderer;
    renderer.setRenderTarget(this.image);
    renderer.render(scene,camera);
    renderer.setRenderTarget(this.highlights);
    this.screen.material=this.extract;
    renderer.render(this.scene,this.camera);
    renderer.setRenderTarget(null);
    this.screen.material=this.composite;
    renderer.render(this.scene,this.camera);
  }

  dispose(){
    this.image.dispose();this.highlights.dispose();
    this.geometry.dispose();this.extract.dispose();this.composite.dispose();
  }
}
