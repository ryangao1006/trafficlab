import * as T from '../vendor/three/three.module.js';

export function polygonShape(rings){
  const path=(p,ring)=>{
    p.moveTo(ring[0][0],-ring[0][1]);
    for(const [x,z] of ring.slice(1))p.lineTo(x,-z);
    p.closePath();
    return p;
  };
  const shape=path(new T.Shape(),rings[0]);
  for(const ring of rings.slice(1))shape.holes.push(path(new T.Path(),ring));
  return shape;
}

export function polygonSurface(rings){
  return new T.ShapeGeometry(polygonShape(rings)).rotateX(-Math.PI/2);
}

export function polygonBuilding(rings,height){
  return new T.ExtrudeGeometry(polygonShape(rings),{depth:height,bevelEnabled:false}).rotateX(-Math.PI/2);
}

export function roadGeometry(points,width){
  const positions=[];
  const edges=points.map(([x,z],i)=>{
    const [a,b]=points[Math.max(0,i-1)],[c,d]=points[Math.min(points.length-1,i+1)];
    const length=Math.hypot(c-a,d-b)||1;
    const ox=(b-d)*width/(2*length),oz=(c-a)*width/(2*length);
    return [[x+ox,0,z+oz],[x-ox,0,z-oz]];
  });
  for(let i=1;i<edges.length;i++){
    const [a,b]=edges[i-1],[c,d]=edges[i];
    positions.push(...a,...c,...b,...b,...c,...d);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

