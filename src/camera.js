import * as T from '../vendor/three/three.module.js';

const SHOTS={
  orbit:{azimuth:.26,elevation:.38,distance:850,target:[0,20,0]},
  street:{azimuth:.16,elevation:.14,distance:450,target:[0,22,0]},
  turn:{azimuth:.28,elevation:.27,distance:307,target:[14,12,0]},
  river:{azimuth:-1.12,elevation:.28,distance:2050,target:[410,123,-2650]},
  top:{azimuth:0,elevation:1.52,distance:1230,target:[0,0,0]},
};
const TOUR=[['street',2300],['turn',4800],['top',4200]];
const ease=t=>t*t*(3-2*t);

export class CameraDirector {
  constructor(camera,change){
    this.camera=camera;
    this.change=change;
    this.shots={};
    this.free=false;
    this.target=new T.Vector3();
    this.position=new T.Vector3();
    this.offset=new T.Vector3();
    this.setShot('orbit',true);
  }

  sync(){
    this.offset.subVectors(this.position,this.target);
    this.distance=this.offset.length();
    this.azimuth=Math.atan2(this.offset.x,this.offset.z);
    this.elevation=Math.atan2(this.offset.y,Math.hypot(this.offset.x,this.offset.z));
    this.apply();
  }

  apply(){
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.change();
  }

  orbit(){
    const radius=this.distance*Math.cos(this.elevation);
    this.position.set(this.target.x+radius*Math.sin(this.azimuth),this.target.y+this.distance*Math.sin(this.elevation),
      this.target.z+radius*Math.cos(this.azimuth));
    this.apply();
  }

  setFree(active){
    if(this.free===active)return;
    this.cancel();
    this.free=active;
    this.change();
  }

  lookFree(dx,dy){
    this.azimuth-=dx*.004;
    this.elevation=T.MathUtils.clamp(this.elevation+dy*.004,-1.55,1.55);
    const radius=this.distance*Math.cos(this.elevation);
    this.target.set(this.position.x-radius*Math.sin(this.azimuth),
      this.position.y-this.distance*Math.sin(this.elevation),this.position.z-radius*Math.cos(this.azimuth));
    this.apply();
  }

  fly(forward,right,up,limit,maxHeight){
    const {azimuth,position,target}=this;
    const sin=Math.sin(azimuth),cos=Math.cos(azimuth);
    const x=T.MathUtils.clamp(position.x+right*cos-forward*sin,-limit,limit);
    const y=T.MathUtils.clamp(position.y+up,18,maxHeight);
    const z=T.MathUtils.clamp(position.z-right*sin-forward*cos,-limit,limit);
    if(x===position.x&&y===position.y&&z===position.z)return;
    target.add(this.offset.set(x-position.x,y-position.y,z-position.z));
    position.set(x,y,z);
    this.apply();
  }

  setShot(name,cut=false,fit){
    this.setFree(false);
    const {azimuth,elevation,distance:defaultDistance,target}=this.shots[name]??SHOTS[name];
    const distance=Math.max(defaultDistance,fit?.distance??0);
    const focus=new T.Vector3(...(fit?.target??target)),radius=distance*Math.cos(elevation);
    const end=new T.Vector3(radius*Math.sin(azimuth),distance*Math.sin(elevation),radius*Math.cos(azimuth)).add(focus);
    if(cut||this.position.distanceToSquared(end)<.01){
      this.move=null;
      this.position.copy(end);
      this.target.copy(focus);
      this.sync();
      return;
    }
    const start=this.position.clone();
    // Stay in the road corridor for low shots. Otherwise cross above the roofs.
    const corridor=['x','z'].some(axis=>Math.max(Math.abs(start[axis]),Math.abs(end[axis]))<120);
    const altitude=Math.max(350,start.y,end.y);
    this.move={name,start,end,focus,from:this.target.clone(),altitude:!corridor&&Math.min(start.y,end.y)<220?altitude:0,elapsed:0};
    this.change();
  }

  startTour(running,reducedMotion){
    this.setFree(false);
    this.tour={index:0,elapsed:0};
    this.setShot(TOUR[0][0],!running||reducedMotion);
  }

  cancel(){
    if(!this.tour&&!this.move)return;
    this.tour=null;
    this.move=null;
    this.change();
  }

  advance(delta,running,reducedMotion){
    if(this.tour){
      if(!running)return;
      const tour=this.tour;
      tour.elapsed+=delta;
      if(tour.elapsed>=TOUR[tour.index][1]){
        tour.elapsed=0;
        tour.index++;
        if(tour.index===TOUR.length){this.tour=null;return;}
        this.setShot(TOUR[tour.index][0],reducedMotion);
      }
    }
    if(!this.move)return;
    const move=this.move;
    move.elapsed+=delta;
    const t=reducedMotion?1:Math.min(1,move.elapsed/(move.altitude?1050:720));
    this.target.lerpVectors(move.from,move.focus,ease(t));
    if(move.altitude){
      const travel=ease(T.MathUtils.clamp((t-.25)/.5,0,1));
      this.position.lerpVectors(move.start,move.end,travel);
      this.position.y=t<.25?T.MathUtils.lerp(move.start.y,move.altitude,ease(t*4)):
        t>.75?T.MathUtils.lerp(move.altitude,move.end.y,ease((t-.75)*4)):move.altitude;
    }else this.position.lerpVectors(move.start,move.end,ease(t));
    this.sync();
    if(t===1)this.move=null;
  }
}
