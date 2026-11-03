import * as T from '../vendor/three/three.module.js';

const MAPS=[['map','diff'],['normalMap','nor_gl'],['roughnessMap','rough']];

export class LocalSurfaces {
  constructor(materials,change){
    this.materials=materials;
    this.change=change;
    this.loader=new T.TextureLoader().setCrossOrigin(undefined);
  }

  replace(material,textures){
    for(const [slot] of MAPS)material[slot]?.dispose();
    for(const [i,[slot]] of MAPS.entries())material[slot]=textures?.[i]??null;
    material.needsUpdate=true;
  }

  setQuality(quality,anisotropy){
    this.quality=quality;
    for(const material of this.materials){
      if(quality==='performance')this.replace(material);
      else void this.load(material,quality,anisotropy);
    }
  }

  async load(material,quality,anisotropy){
    const {textureKind}=material.userData,size=quality==='cinematic'?'2k':'1k';
    const pending=await Promise.allSettled(MAPS.map(([,id])=>
      this.loader.loadAsync(new URL(`../assets/surfaces/${textureKind}-${id}-${size}.jpg`,import.meta.url).href)));
    const textures=pending.map(result=>result.status==='fulfilled'?result.value:null);
    if(this.quality!==quality||textures.some(texture=>!texture)){
      for(const texture of textures)texture?.dispose();
      return;
    }
    for(const [i,texture] of textures.entries()){
      texture.wrapS=texture.wrapT=T.RepeatWrapping;
      texture.anisotropy=Math.min(anisotropy,quality==='cinematic'?8:4);
      if(i===0)texture.colorSpace=T.SRGBColorSpace;
    }
    this.replace(material,textures);
    this.change();
  }
}
