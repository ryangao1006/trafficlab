// Coordinates are in scene units. Distances run outwards from the model junction.
// Each section turns at a constant rate so offsets and headings stay continuous.
const streets={
  N:{dx:0,dz:-1,start:3210,bends:[[850,-.78],[670,.46],[1650,.22]]},
  E:{dx:1,dz:0,start:2130,bends:[[880,.85],[625,-.52],[1420,.13]]},
  S:{dx:0,dz:1,start:2110,bends:[[850,.98],[700,-.59],[1520,.12]]},
  W:{dx:-1,dz:0,start:2160,bends:[[915,-.91],[660,.64],[1550,-.19]]},
};

function advance(length,angle,rate){
  if(rate===0)return [length*Math.cos(angle),length*Math.sin(angle)];
  const end=angle+rate*length;
  return [(Math.sin(end)-Math.sin(angle))/rate,(Math.cos(angle)-Math.cos(end))/rate];
}
function course(bends,distance=0){
  let forward=distance,sideways=0,angle=0;
  const sections=bends.map(([length,turn])=>{
    const rate=turn/length;
    const section={distance,forward,sideways,angle,rate};
    const [step,shift]=advance(length,angle,rate);
    distance+=length;forward+=step;sideways+=shift;angle+=turn;
    return section;
  });
  return {sections,end:{distance,forward,sideways,angle}};
}
for(const street of Object.values(streets)){
  Object.assign(street,course(street.bends,street.start));
}

// Very long queues keep following gentle bends past the built-up districts.
const tail=course([[770,.19],[770,-.19],[770,-.19],[770,.19]]);
function along(sections,distance){
  const section=sections.findLast(section=>section.distance<=distance);
  const length=distance-section.distance;
  const [step,shift]=advance(length,section.angle,section.rate);
  return {forward:section.forward+step,sideways:section.sideways+shift,
    angle:section.angle+length*section.rate};
}

export const approachStarts={N:2980,E:2130,S:2110,W:2160};
export const streetSides=Object.keys(streets);

export function streetPose(side,distance,offset=0){
  const {dx,dz,start,sections,end}=streets[side];
  if(distance<=start)return {x:dx*distance-dz*offset,z:dz*distance+dx*offset,angle:0};
  let center;
  if(distance<end.distance){
    center=along(sections,distance);
  }else{
    const length=distance-end.distance;
    const loops=Math.floor(length/tail.end.distance);
    const local=along(tail.sections,length-loops*tail.end.distance);
    const alongTail=local.forward+loops*tail.end.forward;
    const cos=Math.cos(end.angle),sin=Math.sin(end.angle);
    center={forward:end.forward+alongTail*cos-local.sideways*sin,
      sideways:end.sideways+alongTail*sin+local.sideways*cos,angle:end.angle+local.angle};
  }
  const {angle}=center;
  const forward=center.forward-offset*Math.sin(angle);
  const sideways=center.sideways+offset*Math.cos(angle);
  return {x:dx*forward-dz*sideways,z:dz*forward+dx*sideways,angle};
}

const pedestrianArm={N:'W',E:'N',S:'E',W:'S'};

export function streetActor(x,y,r,side){
  const {dx,dz,start}=streets[side];
  const distance=(x-500)*dx+(y-500)*dz;
  if(distance<=start)return {x:x-500,z:y-500,r};
  const pose=streetPose(side,distance,(y-500)*dx-(x-500)*dz);
  return {x:pose.x,z:pose.z,r:r+pose.angle};
}

export const streetPedestrian=(x,y,r,side)=>streetActor(x,y,r,pedestrianArm[side]);

// A side street meets one side of the main road, leaving staggered junctions.
export const sideStreets=[
  {side:'S',distance:2885,bank:1,length:390},
  {side:'E',distance:2735,bank:-1,length:420},
  {side:'E',distance:3345,bank:1,length:350},
  {side:'W',distance:2845,bank:1,length:365},
  {side:'W',distance:3505,bank:-1,length:400},
];

export function sideStreetPose(branch,distance,offset=0){
  const a=streetPose(branch.side,branch.distance,branch.bank*distance);
  const b=streetPose(branch.side,branch.distance+1);
  const c=streetPose(branch.side,branch.distance);
  return {x:a.x+(b.x-c.x)*offset,z:a.z+(b.z-c.z)*offset};
}

// Sample corridors once for the city builder. The extra padding covers gaps between samples.
const roadSamples=streetSides.flatMap(side=>Array.from({length:232},(_,i)=>streetPose(side,155+i*52)));
const branchSamples=sideStreets.flatMap(branch=>Array.from({length:10},(_,i)=>
  sideStreetPose(branch,130+i*branch.length/9)));
const within=(p,x,z,width,depth,padding)=>Math.hypot(Math.max(0,Math.abs(p.x-x)-width/2),
  Math.max(0,Math.abs(p.z-z)-depth/2))<padding;

export function touchesStreet(x,z,width,depth,clearance=171){
  return roadSamples.some(p=>within(p,x,z,width,depth,clearance+27))||
    branchSamples.some(p=>within(p,x,z,width,depth,70));
}

export function streetBounds(arms){
  let left=-180,right=180,near=180,far=-180;
  for(const side of streetSides){
    const end=arms[side];
    for(let distance=0;distance<end+500;distance+=500){
      const {x,z}=streetPose(side,Math.min(distance,end));
      left=Math.min(left,x-180);right=Math.max(right,x+180);
      far=Math.min(far,z-180);near=Math.max(near,z+180);
    }
  }
  return {left,right,far,near};
}
