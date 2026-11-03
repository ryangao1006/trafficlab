import { streetSides } from './city-streets.js';

const axes={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const walkingArm={N:'W',E:'N',S:'E',W:'S'};
const blend=(a,b,t)=>a+(b-a)*t;

export function makeMapStreets(paths){
  const tracks={};
  for(const side of streetSides){
    const line=paths[side];
    let distance=0;
    tracks[side]=line.map(([x,z],i)=>{
      const before=line[Math.max(0,i-1)],after=line[Math.min(i+1,line.length-1)];
      const azimuth=Math.atan2(after[1]-before[1],after[0]-before[0]);
      if(i)distance+=Math.hypot(x-before[0],z-before[1]);
      return {x,z,distance,azimuth};
    });
  }
  const starts={N:500,E:500,S:500,W:500};
  const ends=Object.fromEntries(streetSides.map(side=>[side,tracks[side].at(-1).distance]));

  function pose(side,distance,offset=0){
    const [dx,dz]=axes[side];
    if(distance<=starts[side])return {x:dx*distance-dz*offset,z:dz*distance+dx*offset,angle:0};
    const track=tracks[side];
    let lo=0,hi=track.length-1;
    while(lo+1<hi){
      const mid=(lo+hi)>>1;
      if(track[mid].distance<=distance)lo=mid;else hi=mid;
    }
    const a=track[lo],b=track[hi];
    const t=Math.min(1,(distance-a.distance)/(b.distance-a.distance));
    const delta=Math.atan2(Math.sin(b.azimuth-a.azimuth),Math.cos(b.azimuth-a.azimuth));
    const azimuth=a.azimuth+delta*t;
    const tail=Math.max(0,distance-ends[side]);
    const cos=Math.cos(azimuth),sin=Math.sin(azimuth);
    return {x:blend(a.x,b.x,t)+tail*cos-offset*sin,z:blend(a.z,b.z,t)+tail*sin+offset*cos,
      angle:azimuth-Math.atan2(dz,dx)};
  }

  function actor(x,y,r,side){
    const [dx,dz]=axes[side];
    const distance=(x-500)*dx+(y-500)*dz;
    const at=pose(side,distance,(y-500)*dx-(x-500)*dz);
    return {x:at.x,z:at.z,r:r+at.angle};
  }

  function bounds(arms){
    let left=-180,right=180,far=-180,near=180;
    for(const side of streetSides){
      const stops=tracks[side].filter(p=>p.distance<arms[side]);
      stops.push(pose(side,arms[side]));
      for(const {x,z} of stops){
        left=Math.min(left,x-180);right=Math.max(right,x+180);
        far=Math.min(far,z-180);near=Math.max(near,z+180);
      }
    }
    return {left,right,far,near};
  }

  return {pose,actor,bounds,starts,ends,branches:[],
    pedestrian:(x,y,r,side)=>actor(x,y,r,walkingArm[side])};
}
