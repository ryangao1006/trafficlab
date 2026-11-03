import { vehiclePose, routeLength } from './routes.js';
import { queueLayout, queueViewSpan } from './queue-layout.js';
export const HOTSPOTS = [
  {kind:'car',side:'N',x:560,y:98,w:112,h:42,label:'+ CAR ↓'},
  {kind:'car',side:'E',x:889,y:560,w:112,h:42,label:'+ CAR ←'},
  {kind:'car',side:'S',x:440,y:902,w:112,h:42,label:'+ CAR ↑'},
  {kind:'car',side:'W',x:110,y:440,w:112,h:42,label:'+ CAR →'},
  {kind:'ped',side:'N',x:263,y:306,w:116,h:35,label:'+ PERSON →'},
  {kind:'ped',side:'E',x:737,y:306,w:116,h:35,label:'+ PERSON ↓'},
  {kind:'ped',side:'S',x:737,y:694,w:116,h:35,label:'+ PERSON ←'},
  {kind:'ped',side:'W',x:263,y:694,w:116,h:35,label:'+ PERSON ↑'}
];
export function hitTest(x,y) { return HOTSPOTS.find(h=>Math.abs(x-h.x)<=h.w/2&&Math.abs(y-h.y)<=h.h/2); }
const light={red:'#f7836e',amber:'#f4c561',green:'#b4ee91'};
export function drawJunction(canvas,sim,{alpha=1,paths=true,hover=null,effects=[],reducedMotion=false,vehicleMovement='straight',markers=true,layout=queueLayout(sim,alpha),span=queueViewSpan(layout.reach)}={}) {
 const c=canvas.getContext('2d'); c.clearRect(0,0,canvas.width,canvas.height);
 const margin=(span-1000)/2;
 c.save();c.scale(canvas.width/span,canvas.height/span);c.translate(margin,margin);
 const withTurns=sim.mode!=='straight';
 const time=sim.time, pulse=reducedMotion?.5:(Math.sin(time*3)+1)/2;
 const rect=(x,y,w,h,fill,r=0)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
 const line=(x,y,xx,yy,color,width=2,dash=[])=>{c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();c.setLineDash([]);};
 const circle=(x,y,r,fill)=>{c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const text=(s,x,y,size=14,color='#71856e',weight=600)=>{c.font=`${weight} ${size}px -apple-system, sans-serif`;c.fillStyle=color;c.textAlign='center';c.fillText(s,x,y);};
 const shadow=(f,blur=10)=>{c.save();c.shadowColor='#173e3025';c.shadowBlur=blur;c.shadowOffsetY=4;f();c.restore();};
 rect(-margin,-margin,span,span,'#e9efdf');
 if(margin){
  rect(343,-margin,314,span,'#f1efe2');rect(-margin,343,span,314,'#f1efe2');
  rect(370,-margin,260,span,'#55645f');rect(-margin,370,span,260,'#55645f');
  line(500,-margin,500,1000+margin,'#d1d9c7',2,[16,18]);
  line(-margin,500,1000+margin,500,'#d1d9c7',2,[16,18]);
 }
 // Layered park islands, paths and foliage give the street a model-town feel.
 for(const [x,y] of [[18,18],[672,18],[18,672],[672,672]]){
  rect(x,y,310,310,'#d7e3c7',28);rect(x+10,y+10,290,290,'#e1eacb',22);
  line(x+38,y+247,x+268,y+247,'#edf0da',15);line(x+248,y+45,x+248,y+249,'#edf0da',15);
 }
 const tree=(x,y,r)=>{shadow(()=>{circle(x,y,r,'#96b582');circle(x-8,y-7,r*.8,'#aecb91');circle(x+8,y-12,r*.65,'#bfd9a2');},8);};
 [[86,91,30],[160,70,22],[266,156,25],[785,95,30],[893,164,24],[725,230,22],[82,753,28],[217,854,32],[134,921,22],[749,847,31],[871,755,28],[908,912,22]].forEach(a=>tree(...a));
 function building(x,y,w,h){shadow(()=>rect(x,y,w,h,'#c1cbbd',8));rect(x+4,y+4,w-8,h-12,'#f5f2e5',6);rect(x+14,y+13,w-28,h-28,'#e6e3d4',3);rect(x+w/2-12,y+h-27,24,10,'#bbcfc8',2);for(let i=0;i<3;i++)rect(x+17+i*22,y+17,12,15,'#c3d8d2',2);}
 building(72,177,105,64);building(800,229,110,63);building(73,815,98,59);building(785,696,116,62);
 text('NORTH GARDENS',163,52,10,'#95a584');text('RIVERSIDE WALK',838,923,10,'#95a584');
 // Raised pavement and road edging.
 rect(336,0,328,1000,'#c6d0bd');rect(0,336,1000,328,'#c6d0bd');
 rect(343,0,314,1000,'#f1efe2');rect(0,343,1000,314,'#f1efe2');
 for(let n=0;n<1000;n+=25){line(345,n,366,n,'#e3e2d4',1);line(634,n,655,n,'#e3e2d4',1);line(n,345,n,366,'#e3e2d4',1);line(n,634,n,655,'#e3e2d4',1);}
 rect(370,0,260,1000,'#55645f');rect(0,370,1000,260,'#55645f');
 // Fine texture is deterministic, keeping frames stable.
 for(let i=0;i<180;i++){const x=(i*137+33)%1000,y=(i*239+11)%1000;if((x>370&&x<630)||(y>370&&y<630))circle(x,y,.8,'#6d7c733a');}
 line(374,0,374,328,'#91a090',2);line(626,0,626,328,'#91a090',2);line(374,672,374,1000,'#91a090',2);line(626,672,626,1000,'#91a090',2);
 for(const [a,b] of [[0,310],[690,1000]]){line(500,a,500,b,'#d1d9c7',2,[16,18]);line(a,500,b,500,'#d1d9c7',2,[16,18]);}
 if(withTurns)for(const [a,b] of [[0,310],[690,1000]])for(const divider of [445,555]){
  line(divider,a,divider,b,'#becab07a',1.5,[10,13]);line(a,divider,b,divider,'#becab07a',1.5,[10,13]);
 }
 // Trace the exact routes used by movement, including protected curved exits.
 if(paths)for(const direction of ['N','E','S','W'])for(const movement of (withTurns?['straight','left']:['straight'])){
  const axis=['N','S'].includes(direction)?'NS':'EW',g=axis+(movement==='left'?'_LEFT':'');
  if(sim.vehicleSignal(direction,movement)!=='green')continue;
  const actor={direction,movement};
  const route=()=>{c.beginPath();for(let distance=50;distance<=routeLength(actor)-50;distance+=10){const p=vehiclePose(actor,distance,sim.mode);if(distance===50)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}};
  c.save();c.strokeStyle=movement==='left'?'#9de9d8':'#bbf297';c.lineWidth=withTurns?32:38;c.globalAlpha=.1+pulse*.035;route();c.stroke();c.restore();
  c.save();c.lineWidth=3;c.strokeStyle=movement==='left'?'#bdf6e3bb':'#d0f5aa88';c.setLineDash([5,30]);c.lineDashOffset=-time*48;route();c.stroke();c.restore();
 }
 const pedGreen=sim.signal('PED')==='green';
 const crossingColor=side=>sim.pedestrianSignal(side)==='green'?'#d8f1ba':sim.pedestrians.some(p=>p.side===side&&p.crossing)?'#f4d99c':'#eeeee1';
 for(let i=0;i<7;i++){
  rect(377+i*36,337,23,24,crossingColor('N'),2);rect(377+i*36,639,23,24,crossingColor('S'),2);
  rect(337,377+i*36,24,23,crossingColor('W'),2);rect(639,377+i*36,24,23,crossingColor('E'),2);
 }
 if(paths)for(const [side,route] of Object.entries({N:[335,349,665,349],S:[665,651,335,651],E:[650,335,650,665],W:[350,665,350,335]})){
  const green=sim.pedestrianSignal(side)==='green',clearing=sim.pedestrians.some(p=>p.side===side&&p.crossing);
  if(green||clearing){c.save();c.globalAlpha=.35+pulse*.2;c.lineDashOffset=-time*32;line(...route,green?'#92df70':'#edc775',5,[8,9]);c.restore();}
 }
 line(377,325,491,325,'#f5f3e8',5);line(509,675,623,675,'#f5f3e8',5);line(325,509,325,623,'#f5f3e8',5);line(675,377,675,491,'#f5f3e8',5);
 const arrow=(x,y,r,left=false)=>{c.save();c.translate(x,y);c.rotate(r);line(0,16,0,-12,'#a8b6a9',3);if(left){line(0,-12,-12,-12,'#a8b6a9',3);line(-12,-12,-6,-18,'#a8b6a9',3);line(-12,-12,-6,-6,'#a8b6a9',3);}else{line(0,-12,-8,-4,'#a8b6a9',3);line(0,-12,8,-4,'#a8b6a9',3);}c.restore();};
 for(const direction of ['N','E','S','W'])for(const movement of (withTurns?['straight','left']:['straight'])){const p=vehiclePose({direction,movement},170,sim.mode);arrow(p.x,p.y,p.r,movement==='left');}
 text('NORTH',500,37,12,'#d6e0ce');text('SOUTH',500,977,12,'#d6e0ce');
 c.save();c.translate(27,500);c.rotate(-Math.PI/2);text('WEST',0,0,12,'#d6e0ce');c.restore();c.save();c.translate(973,500);c.rotate(Math.PI/2);text('EAST',0,0,12,'#d6e0ce');c.restore();
 // Detection zones glow and scan when a vehicle reaches the virtual sensor.
 for(const dir of ['N','S','E','W'])for(const movement of (withTurns?['straight','left']:['straight'])){
  const p=vehiclePose({direction:dir,movement},282,sim.mode),w=withTurns?46:86;
  const on=sim.cars.some(a=>a.direction===dir&&(a.movement??'straight')===movement&&!a.served&&a.s>=240);
  c.save();c.translate(p.x,p.y);c.rotate(p.r);rect(-w/2,-22,w,44,on?'#b6ed942b':'#b6ed940c',5);c.strokeStyle=on?'#b6ed94':'#94b19788';c.lineWidth=1.5;c.setLineDash([4,5]);c.strokeRect(-w/2,-22,w,44);c.setLineDash([]);
  if(on){const scan=-20+(time*32%40);line(-w/2+3,scan,w/2-3,scan,'#b6ed94',2);}
  c.restore();
 }
 // Large lenses, halos and labels remove ambiguity around signal state.
 function signal(x,y,direction,turn=false){const active=sim.vehicleSignal(direction,turn?'left':'straight');shadow(()=>rect(x-17,y-43,34,92,'#233f35',11),6);
  ['red','amber','green'].forEach((color,i)=>{const yy=y-27+i*28;const on=active===color;if(on){c.save();c.shadowColor=light[color];c.shadowBlur=14+5*pulse;circle(x,yy,10,light[color]);c.restore();if(turn)text('↰',x,yy+5,15,'#244735',800);else circle(x-2,yy-2,3,'#ffffff70');}else circle(x,yy,9,'#425a4a');});line(x,y+49,x,y+63,'#8b9b85',4);}
 signal(348,286,'N');signal(652,714,'S');signal(714,348,'E');signal(286,652,'W');
 if(withTurns)for(const [x,y,g] of [[348,175,'N'],[652,825,'S'],[825,348,'E'],[175,652,'W']]){signal(x,y,g,true);text('LEFT',x+27,y+4,8,'#638169',700);}
 const locations={N:[320,350],E:[650,320],S:[680,650],W:[350,680]};
 function personIcon(x,y,on){circle(x,y-7,3,on);line(x,y-3,x,y+5,on,2);line(x,y,x-5,y+3,on,2);line(x,y+4,x-4,y+10,on,2);line(x,y+4,x+4,y+10,on,2);}
 for(const [side,[x,y]] of Object.entries(locations)){shadow(()=>rect(x-12,y-21,24,43,'#29483b',7),5);if(sim.pedestrianSignal(side)==='green')personIcon(x,y,light.green);else{rect(x-6,y-10,12,3,light.red,2);rect(x-1.5,y-14,3,12,light.red,2);}}
 // The junction badge describes the phase without covering any traffic lanes.
 if(!withTurns){rect(461,476,78,48,'#40574bd9',9);text(sim.state==='WALK'?'WALK':sim.state==='GREEN'?sim.current.replace('_LEFT',' ↰'):sim.state==='AMBER'?'WAIT':'CLEAR',500,505,13,sim.state==='GREEN'||pedGreen?'#d6f3ad':'#d7decf');}
 const paint=['#e8bb66','#7fb6c2','#eee8ce','#d58f78','#9fb1da'];
 function car(x,y,r,a){c.save();c.translate(x,y);c.rotate(r);shadow(()=>rect(-20,-29,40,58,paint[a.id%paint.length],9),8);
  rect(-17,-21,34,41,'#ffffff17',7);rect(-14,-15,28,12,'#325561',4);rect(-13,-14,26,3,'#b7dde1a0',2);rect(-14,11,28,10,'#52767a',3);rect(-17,-1,34,2,'#fff2',1);
  rect(-23,-17,4,12,'#293c36',2);rect(19,-17,4,12,'#293c36',2);rect(-23,13,4,10,'#293c36',2);rect(19,13,4,10,'#293c36',2);
  rect(-18,-6,4,6,paint[a.id%paint.length],1);rect(14,-6,4,6,paint[a.id%paint.length],1);
  c.save();c.shadowColor='#ffeab5';c.shadowBlur=9;rect(-15,-29,8,4,'#fff0bb',2);rect(7,-29,8,4,'#fff0bb',2);c.restore();
  if(a.movement==='left'){text('↰',0,8,14,'#2b554f',800);if(Math.floor(time*3)%2===0){rect(-21,-21,4,7,'#ffd172',1);rect(-21,18,4,7,'#ffd172',1);}}
  const brake=(a.v??0)<35&&!a.served;rect(-15,25,7,4,brake?'#ff6a61':'#ad7461',1);rect(8,25,7,4,brake?'#ff6a61':'#ad7461',1);c.restore();}
 for(const a of sim.cars){const pos=(a.previousS??a.s)+(a.s-(a.previousS??a.s))*alpha;const p=vehiclePose(a,pos,sim.mode);car(p.x,p.y,p.r,a);}
 for(const {car:actor,x,y,r} of layout.cars)car(x,y,r,actor);
 // People use the same positions as the 3D view.
 for(const {person:p,x,y,r:rot} of [...layout.people,...layout.waitingPeople]){
  const swing=p.crossing&&!reducedMotion?Math.sin(time*13+p.id)*4:0;c.save();c.translate(x,y);c.rotate(rot);c.scale(1.3,1.3);circle(2,4,9,'#163a3025');line(-3,3,-3+swing,10,'#334e4d',3);line(3,3,3-swing,10,'#334e4d',3);line(-5,-2,-8,-swing,'#e2bc90',3);line(5,-2,8,swing,'#e2bc90',3);rect(-5,-5,10,12,['#5c9aa4','#d89b65','#8f83b2'][p.id%3],4);circle(0,-8,4.5,'#f0c99c');circle(0,-10,3,'#66554b');c.restore();
 }
 // In-canvas controls are fully paired with accessible HTML buttons in the sidebar.
 if(markers)for(const h of HOTSPOTS){const isHover=hover===h;shadow(()=>rect(h.x-h.w/2,h.y-h.h/2,h.w,h.h,isHover?'#e7f7d6':'#fffffff0',h.h/2),7);text(h.kind==='car'&&vehicleMovement==='left'?'+ LEFT ↰':h.label,h.x,h.y+4,h.kind==='car'?12:10,isHover?'#17674b':'#3c6955',700);}
 for(const e of effects){const age=(performance.now()-e.created)/1000;if(age<1){c.save();c.globalAlpha=(1-age)*.6;c.strokeStyle='#7bc493';c.lineWidth=3;c.beginPath();c.arc(e.x,e.y,18+age*48,0,Math.PI*2);c.stroke();c.restore();}}
 c.restore();
}
