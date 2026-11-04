import { HOTSPOTS, drawJunction } from './draw.js';
import { queueLayout, queueViewSpan } from './queue-layout.js';

export class FlatView{
  constructor(canvas,viewport,markers,onChange){
    this.canvas=canvas;this.viewport=viewport;this.markers=markers;this.onChange=onChange;this.fallback=true;canvas.classList.add('flat-canvas');
    canvas.width=1000;canvas.height=1000;this.observer=new ResizeObserver(onChange);this.observer.observe(viewport);
  }
  resetActors(){} select(){} zoomBy(){}
  render(sim,alpha,opts){
    const layout=queueLayout(sim,alpha),span=queueViewSpan(layout.reach),offset=(span-1000)/2;
    drawJunction(this.canvas,sim,{...opts,alpha,layout,span,markers:false});
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight,s=Math.min(w,h);
    for(const [i,m] of this.markers.entries()){const p=HOTSPOTS[i];m.hidden=false;m.style.transform=`translate(${(w-s)/2+(p.x+offset)*s/span}px,${(h-s)/2+(p.y+offset)*s/span}px) translate(-50%,-50%)`;}
  }
}
