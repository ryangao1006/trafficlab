import { Simulation, SIDES } from './engine.js';
import { HOTSPOTS } from './draw.js';
import { routeKey } from './conflicts.js';
import { TownView, FlatView } from './town.js';
import { translate, sideName, localRoute, localEvent } from './i18n.js';

const $=id=>document.getElementById(id), sim=new Simulation({},'smart');
let lang='en';
try{if(localStorage.getItem('trafficlab.language')==='zh')lang='zh';}catch{}
const t=(key,params)=>translate(lang,key,params), name=side=>sideName(lang,side), route=key=>localRoute(lang,key);
const sec=n=>t('seconds',{n});
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const signalText=state=>t(state==='green'?'greenState':state==='amber'?'amberState':'red');
const strokes={
 fly:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
 film:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14m10-14v14M3 10h4m-4 4h4m10-4h4m-4 4h4"/>',
 stats:'<path d="M4 20h16M6 16v-4m6 4V6m6 10v-7"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
 street:'<path d="m4 21 5-18m11 18-5-18m-3 3v3m0 4v3m0 3v2"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.2-3 4M12 17h.01"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
 car:'<path d="M5 16v2m14-2v2M3 15v-3l2-5h14l2 5v3zm0-3h18M6 14h2m8 0h2"/>',
 person:'<circle cx="12" cy="5" r="2.2"/><path d="m7 12 5-3 4 3 3 1m-7-4-1 6-4 5m4-5 5 5"/>',
 spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
 lanes:'<path d="M5 3v18M19 3v18M12 3v4m0 3v4m0 3v4"/>',
 play:'<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
 pause:'<path d="M8 5v14m8-14v14" stroke-width="3"/>',
 reset:'<path d="M5 8a8 8 0 1 1-.7 8m.7-8V3m0 5h5"/>',
 routes:'<path d="M4 19V8a3 3 0 0 1 3-3h10m-4-4 4 4-4 4M10 19h9m-3-3 3 3-3 3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 top:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
 orbit:'<path d="M4 9a8 8 0 1 1 .5 7M4 9V4m0 5h5"/><circle cx="12" cy="12" r="2"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 signals:'<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M12 6h.01m-.01 6h.01m-.01 6h.01" stroke-width="3.5"/>',
 log:'<path d="M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="white"/><circle cx="15" cy="17" r="2.5" fill="white"/>'
};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${strokes[k]}</svg>`;
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=icon(el.dataset.icon);
const fieldLabels={minGreen:'minGreen',maxGreen:'maxGreen',amber:'amberTime',allRed:'allRedTime',walk:'walkTime',pedestrianClear:'pedestrianClear'};
$('timing-inputs').innerHTML=Object.entries(fieldLabels).map(([key,label])=>`<label><span data-i18n="${label}"></span><input type="number" name="${key}" min="1" max="120" step="1" value="${sim.timings[key]}" required></label>`).join('');
$('car-inputs').innerHTML=SIDES.map(d=>`<button data-car="${d}"><span class="arrow"></span><strong></strong><small></small></button>`).join('');
$('ped-inputs').innerHTML=SIDES.map(d=>`<button data-ped="${d}"><strong></strong><span>${'NS'.includes(d)?'↔':'↕'}</span></button>`).join('');
$('signal-board').innerHTML=SIDES.map(d=>`<div class="signal-card"><strong id="entry-${d}"></strong><span id="light-${d}-straight" class="signal-light"><i></i><span>↑</span></span><span id="light-${d}-left" class="signal-light"><i></i><span>↰</span></span><span id="light-${d}-ped" class="signal-light"><i></i><span></span></span></div>`).join('');
$('map-pins').innerHTML=HOTSPOTS.map(h=>`<button class="map-pin" data-kind="${h.kind}" data-side="${h.side}">${icon(h.kind==='car'?'car':'person')}<span class="pin-side"></span><span class="plus">+</span></button>`).join('');
const pins=[...document.querySelectorAll('.map-pin')];
const htmlCache=new WeakMap();
function text(el,value){const node=typeof el==='string'?$(el):el;const str=String(value);if(node.textContent!==str)node.textContent=str;}
function html(el,value){const node=typeof el==='string'?$(el):el;if(htmlCache.get(node)!==value){node.innerHTML=value;htmlCache.set(node,value);}}
function attr(el,key,value){const v=String(value);if(el.getAttribute(key)!==v)el.setAttribute(key,v);}
function pressed(el,value){attr(el,'aria-pressed',value);}
function hide(el,value){if(el.hidden!==value)el.hidden=value;}
const straightTo={N:'S',E:'W',S:'N',W:'E'}, leftTo={N:'E',E:'S',S:'W',W:'N'}, arrow={N:'↓',E:'←',S:'↑',W:'→'};
let running=false,speed=1,showPaths=true,sceneName='manual',movement='straight',selection=null;
let frameId=0,previous=0,cameraPrevious=0,accumulator=0,lastUI=0,toastTimer;
const sceneTimes={day:['skyDay','14:00'],golden:['skyGolden','18:30'],blue:['skyBlue','19:40'],night:['skyNight','23:00']};
let sceneTime='golden',sceneWeather='clear',sceneQuality='balanced',savedCity='cinematic';
try{
  const savedTime=localStorage.getItem('trafficlab.sceneTime');
  const savedWeather=localStorage.getItem('trafficlab.sceneWeather');
  const savedQuality=localStorage.getItem('trafficlab.sceneQuality');
  if(localStorage.getItem('trafficlab.city')==='westminster')savedCity='westminster';
  if(['performance','balanced','cinematic'].includes(savedQuality))sceneQuality=savedQuality;
  if(Object.hasOwn(sceneTimes,savedTime))sceneTime=savedTime;
  if(['clear','clouds','rain'].includes(savedWeather))sceneWeather=savedWeather;
}catch{}
const mobileLayout=matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 550px) and (max-width: 1024px)');
const sheet=$('mobile-sheet'), sidebar=$('sidebar'), sidebarHome=sidebar.parentElement;
const runTools=$('mobile-run-tools'), transport=$('transport'), simControls=transport.parentElement;
const signalBoard=$('signal-board'), stats=$('stats'), reset=$('reset'), runSpeed=$('run-speed');
function syncMobileLayout(){
  const mobile=mobileLayout.matches;
  document.body.classList.toggle('mobile-layout',mobile);
  hide($('mobile-controls'),!mobile);
  if(mobile){
    $('sheet-scroll').prepend(sidebar);
    runTools.append(signalBoard,stats,reset,runSpeed);
  }else{
    if(sheet.open)sheet.close();
    sidebarHome.append(sidebar);
    simControls.prepend(signalBoard,stats);
    transport.insertBefore(reset,$('quick-demo'));
    transport.append(runSpeed);
  }
}
mobileLayout.addEventListener('change',syncMobileLayout);
syncMobileLayout();
$('mobile-controls').onclick=()=>{
  $('sky-controls').open=false;
  $('sheet-scroll').scrollTop=0;
  sheet.showModal();
};
$('mobile-close').onclick=()=>sheet.close();
sheet.addEventListener('click',e=>{
  if(e.target!==sheet)return;
  const rect=sheet.getBoundingClientRect();
  if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)sheet.close();
});

const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion=motionPreference.matches;
motionPreference.addEventListener('change',e=>{reducedMotion=e.matches;invalidate();});
function invalidate(){if(!frameId)frameId=requestAnimationFrame(frame);}
function frame(now){
  frameId=0;
  const cameraDelta=cameraPrevious?Math.min(now-cameraPrevious,50):0;
  cameraPrevious=now;
  if(running){
    const delta=previous?Math.min((now-previous)/1000,.12):0;previous=now;accumulator+=delta*speed;
    while(accumulator>=.05){sim.step(.05);accumulator-=.05;}
    if(now-lastUI>=160){refresh();lastUI=now;}
  }
  const alpha=running?accumulator/.05:1;
  const motionTime=Math.max(0,sim.time-.05*(1-alpha));
  view.director?.advance(cameraDelta,running,reducedMotion);
  const flying=view.advanceFree?.(cameraDelta);
  refreshCameraControls();
  view.render(sim,alpha,{paths:showPaths,reducedMotion,vehicleMovement:movement,now,motionTime});
  if(running||flying||(view.director?.move&&!view.director.tour)||(sceneWeather==='rain'&&!view.fallback&&!reducedMotion))invalidate();
  if(!frameId)cameraPrevious=0;
}
let view;
try{view=new TownView($('junction'),$('viewport'),pins,invalidate,pick=>{selection=pick;view.select(pick);refreshInspector();});}
catch(error){
  console.warn('3D view unavailable:',error.message);
  const canvas=$('junction').cloneNode(false);$('junction').replaceWith(canvas);
  view=new FlatView(canvas,$('viewport'),pins,invalidate);
}
$('viewport').dataset.renderer=view.fallback?'flat':'3d';
function refreshViewHint(){
  text('view-hint',t(view.fallback?'fallback':mobileLayout.matches?'touchHint':'orbitHint'));
}
mobileLayout.addEventListener('change',refreshViewHint);
function setRunning(value){running=value;previous=0;cameraPrevious=0;accumulator=0;document.body.classList.toggle('running',running);refresh();invalidate();}
function setMovement(value){movement=value;updateInputs();invalidate();}
function updateInputs(){
  hide($('movement-controls'),sim.mode==='straight');
  for(const b of document.querySelectorAll('[data-movement]'))pressed(b,b.dataset.movement===movement);
  for(const b of document.querySelectorAll('[data-car]')){
    const d=b.dataset.car;text(b.querySelector('.arrow'),movement==='left'?'↰':arrow[d]);text(b.querySelector('strong'),name(d));
    text(b.querySelector('small'),t('to',{side:name((movement==='left'?leftTo:straightTo)[d])}));
    const label=`${t('addCar',{side:name(d)})} · ${t(movement==='left'?'left':'through')}`;attr(b,'aria-label',label);attr(b,'title',label);
  }
  for(const b of document.querySelectorAll('[data-ped]')){text(b.querySelector('strong'),name(b.dataset.ped));attr(b,'aria-label',t('addPed',{side:name(b.dataset.ped)}));}
  for(const b of pins){
    const d=b.dataset.side;const label=b.dataset.kind==='car'?`${t('addCar',{side:name(d)})} · ${t(movement==='left'?'left':'through')}`:t('addPed',{side:name(d)});
    text(b.querySelector('.pin-side'),lang==='zh'?name(d):d);attr(b,'aria-label',label);attr(b,'title',label);
  }
}
function syncOptions(){
  // Only these explicit control changes touch the scenario and select widgets.
  for(const b of document.querySelectorAll('[data-scenario]'))pressed(b,b.dataset.scenario===sceneName);
  $('junction-mode').value=sim.mode;$('auto').checked=sim.auto;
  text('mode-note',t(sim.mode==='smart'?'modeSmart':sim.mode==='straight'?'modeStraight':'modeProtected'));updateInputs();
  for(const d of SIDES)hide($(`light-${d}-left`),sim.mode==='straight');
}
function refreshSky(){
  const [label,clock]=sceneTimes[sceneTime];
  text('sky-title',t(label));
  text('sky-clock',clock);
  for(const button of document.querySelectorAll('[data-sky]'))pressed(button,button.dataset.sky===sceneTime);
  $('sky-weather').value=sceneWeather;
  $('scene-quality').value=sceneQuality;
}
function applySky(){
  view.setAtmosphere?.(sceneTime,sceneWeather);
  refreshSky();
  invalidate();
}
for(const button of document.querySelectorAll('[data-sky]')){
  button.onclick=()=>{
    sceneTime=button.dataset.sky;
    try{localStorage.setItem('trafficlab.sceneTime',sceneTime);}catch{}
    applySky();
  };
}
$('sky-weather').onchange=()=>{
  sceneWeather=$('sky-weather').value;
  try{localStorage.setItem('trafficlab.sceneWeather',sceneWeather);}catch{}
  applySky();
};
$('scene-quality').onchange=()=>{
  sceneQuality=$('scene-quality').value;
  try{localStorage.setItem('trafficlab.sceneQuality',sceneQuality);}catch{}
  view.setQuality?.(sceneQuality);
};
let cityRequest=0,cityStatus='',failedCity;
function refreshCity(){
  const active=view.city??'cinematic';
  $('viewport').dataset.city=active;
  if(cityStatus!=='cityLoading')$('scene-city').value=active;
  text('city-status',cityStatus?t(cityStatus):'');
  hide($('city-status'),!cityStatus);
  hide($('city-retry'),!failedCity);
  hide($('map-credit'),active!=='westminster');
  hide($('map-data'),active!=='westminster');
}
async function selectCity(name){
  if(view.fallback)return;
  const request=++cityRequest;
  failedCity=null;
  cityStatus='cityLoading';
  $('scene-city').value=name;
  refreshCity();
  try{
    if(!await view.setCity(name)||request!==cityRequest)return;
    cityStatus='';
    try{localStorage.setItem('trafficlab.city',name);}catch{}
  }catch(error){
    if(request!==cityRequest)return;
    console.warn('City load failed:',error.message);
    failedCity=name;
    cityStatus='cityError';
  }
  refreshCity();
  invalidate();
}
$('scene-city').onchange=()=>selectCity($('scene-city').value);
$('city-retry').onclick=()=>selectCity(failedCity);
hide($('sky-controls'),!!view.fallback);
view.setQuality?.(sceneQuality);
applySky();
function refreshCameraControls(){
  const tour=view.director?.tour,free=!!view.director?.free,label=$('tour-status');
  pressed($('camera-tour'),!!tour);
  pressed($('free-view'),free);
  hide(label,!tour&&!free);
  if(free)text(label,t(mobileLayout.matches?'freeTouch':'freeKeys'));
  if(tour)text(label,t(['tourStreet','tourTurn','tourTop'][tour.index])+(running?'':` · ${t('tourPaused')}`));
}

function applyLanguage(){
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  document.title=lang==='zh'?'TrafficLab — 3D 路口实验室':'TrafficLab — 3D Intersection Studio';
  for(const el of document.querySelectorAll('[data-i18n]'))text(el,t(el.dataset.i18n));
  for(const el of document.querySelectorAll('[data-label]'))attr(el,'aria-label',t(el.dataset.label));
  for(const el of document.querySelectorAll('[data-tip]'))attr(el,'title',t(el.dataset.tip));
  for(const b of document.querySelectorAll('[data-lang]'))pressed(b,b.dataset.lang===lang);
  for(const d of SIDES){text(`entry-${d}`,t('entry',{side:name(d)}));text($(`light-${d}-ped`).lastElementChild,`${t('walk')} ${'NS'.includes(d)?'↔':'↕'}`);}
  text('view-badge',t(view.fallback?'view2d':'view3d'));refreshViewHint();hide($('camera-tools'),!!view.fallback);
  hide($('map-toast'),true);refreshSky();refreshCity();refreshCameraControls();syncOptions();refresh();invalidate();
}
function signalValue(d,kind){return kind==='ped'?sim.pedestrianSignal(d):sim.vehicleSignal(d,kind);}
function refreshSignals(){
  for(const d of SIDES)for(const kind of ['straight','left','ped']){
    const el=$(`light-${d}-${kind}`),state=signalValue(d,kind),key=kind==='ped'?`P_${d}`:routeKey(d,kind);
    attr(el,'data-signal',state);attr(el,'title',`${route(key)} · ${signalText(state)}`);attr(el,'aria-label',`${route(key)} · ${signalText(state)}`);
  }
}
function phaseInfo(){
  const st=sim.state,smart=sim.mode==='smart';
  if(st==='GREEN'){
    if(smart){
      const routes=[...sim.activeRoutes],{min,max}=sim.smartGreenLimits();
      const summary=routes.map(route).join(' + ');
      const description=sim.elapsed>=min?`${summary} · ${t('greenExtended')}`:summary;
      return {title:t('smartGreen',{n:routes.length}),tag:t('smartTag',{n:routes.length}),description,duration:max};
    }
    const turn=sim.current.endsWith('_LEFT');
    return {title:t(turn?'protectedGreen':'straightGreen',{route:route(sim.current)}),tag:t('greenState'),description:turn?t('modeProtected'):t('modeStraight'),duration:sim.timings.maxGreen};
  }
  const phases={IDLE:['idle','idleDesc',0,'idleTag'],AMBER:['amber','amberDesc',sim.timings.amber,'amberState'],ALL_RED:['allRed','allRedDesc',sim.timings.allRed,'idleTag'],WALK:['pedGreen','walkDesc',sim.timings.walk,'greenState'],PED_CLEAR:['pedClear','pedClearDesc',sim.timings.pedestrianClear,'idleTag']};
  const [title,description,duration,tag]=phases[st];return {title:t(title),description:t(description),tag:t(tag),duration};
}
function refreshPhase(){
  const p=phaseInfo(),st=sim.state,green=st==='GREEN'||st==='WALK',remaining=Math.max(0,p.duration-sim.elapsed);
  const held=p.duration>0&&remaining===0&&['ALL_RED','PED_CLEAR'].includes(st)&&sim.junctionOccupied();
  text('phase-tag',p.tag);$('phase-tag').classList.toggle('green',green);$('phase-tag').classList.toggle('amber',st==='AMBER');
  const phase=$('phase-overview'),progress=$('phase-progress');
  const stateChanged=phase.dataset.state!==st;
  attr(phase,'data-state',st);text('phase-title',p.title);text('phase-description',p.description);
  if(stateChanged&&!reducedMotion){
    $('phase-copy').getAnimations().forEach(animation=>animation.cancel());
    $('phase-copy').animate([{opacity:.45,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:210,easing:'ease-out'});
  }
  text('phase-seconds',held?t('hold'):p.duration?sec(Math.ceil(remaining)):'—');
  text('phase-limit',t(held?'occupied':!p.duration?'noTimer':green?'maxLeft':'minLeft'));
  const width=p.duration?100*remaining/p.duration:0;
  progress.classList.toggle('phase-reset',stateChanged||width>parseFloat(progress.style.width));
  progress.style.width=`${width}%`;
}
function refreshQueue(){
  const smart=sim.mode==='smart',next=sim.selectGroup(),rows=[];
  for(const key of sim.groups){
    const n=sim.routeCount(key),overflow=sim.overflowCount(key);
    const countLabel=t('requestCount',{n})+(overflow?` · ${t('overflowCount',{n:overflow})}`:'');
    const age=sim.requests.has(key)?sim.time-sim.requests.get(key):null;
    const active=sim.signal(key)==='green';
    if(!n&&age==null&&!active)continue;
    const blocker=smart&&sim.state==='GREEN'&&!active?sim.blockedBy(key):null;
    const status=active?t('active'):blocker?t('blocked',{route:route(blocker)}):age!=null?t('pending'):t('approaching');
    rows.push(`<div class="request${active?' active':''}${key===next?' next':''}"><strong>${route(key)}</strong><span class="age">${age==null?'—':sec(age.toFixed(1))}</span><small>${countLabel}</small><small>${status}</small></div>`);
  }
  html('requests',rows.join('')||`<p class="empty-note">${t('noRequests')}</p>`);
  text('pending-count',sim.requests.size);
  const decision=next?t(smart?'nextDemand':next!==sim.nextGroup()?'nextPair':'nextPriority',{route:route(next),n:sim.routeCount(next)}):smart&&sim.state==='GREEN'?t('joinHint'):t('addHint');
  text('decision',decision);
}
function refreshLog(){
  if(!$('log-panel').open)return;
  html('events',sim.events.slice(0,10).map(e=>`<div class="event"><time>${fmt(e.time)}</time><span>${localEvent(lang,e)}</span></div>`).join('')||`<p class="empty-note">${t('noLog')}</p>`);
}
function refreshInspector(){
  let title,detail;
  if(selection?.kind==='signal'){
    const {side,movement:m}=selection;title=t('signal');detail=`${route(m==='ped'?`P_${side}`:routeKey(side,m))} · ${signalText(signalValue(side,m))}`;
  }else if(selection?.kind==='car'){
    const c=sim.cars.find(a=>a.id===selection.id);if(c){title=t('car');detail=`${route(routeKey(c.direction,c.movement))} · ${t(c.served?'moving':c.s>=285&&sim.vehicleSignal(c.direction,c.movement)!=='green'?'stopped':'approaching')}`;}
  }else if(selection?.kind==='ped'){
    const p=sim.pedestrians.find(a=>a.id===selection.id);if(p){title=t('ped');detail=`${route(`P_${p.side}`)} · ${t(p.crossing?'walkMoving':'walkWaiting')}`;}
  }
  hide($('map-inspector'),!title);
  if(title){text('inspect-title',title);text('inspect-detail',detail);}
  else if(selection){selection=null;view.select(null);}
}
function updateCount(id,value){
  const el=$(id),increased=value>Number(el.textContent);
  text(el,value);
  if(increased&&!reducedMotion){
    el.getAnimations().forEach(animation=>animation.cancel());
    el.animate([{color:'#8be7ca',transform:'translateY(-2px)'},{color:'#edf6ff',transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
  }
}
function refresh(){
  text('time',fmt(sim.time));text('run-status',t(running?'running':'paused'));text('play-label',t(running?'pause':'play'));html('play-icon',icon(running?'pause':'play'));
  updateCount('cars-served',sim.servedCars);updateCount('people-served',sim.servedPeople);
  for(const [kind,id] of [['vehicle','vehicle-wait'],['pedestrian','pedestrian-wait']]){const avg=sim.average(kind);text(id,avg==null?'—':sec(avg.toFixed(1)));}
  refreshPhase();refreshSignals();refreshQueue();refreshLog();refreshInspector();
}
function resetScene(name='manual',autoPlay=false){
  view.director?.cancel();
  sceneName=name;selection=null;view.select(null);view.resetActors();sim.loadScenario(name);hide($('map-toast'),true);syncOptions();setRunning(autoPlay);
}
function toast(message){text('map-toast',message);hide($('map-toast'),false);clearTimeout(toastTimer);toastTimer=setTimeout(()=>hide($('map-toast'),true),2100);}
function add(kind,side){
  const ok=kind==='car'?sim.addCar(side,movement):sim.addPedestrian(side);
  const key=kind==='car'?routeKey(side,movement):`P_${side}`;
  toast(ok?t(kind==='car'?'addedCar':'addedPed',{route:route(key)})+(running?'':t('pressPlay')):t('invalidArrival'));refresh();invalidate();
}
for(const b of document.querySelectorAll('[data-lang]'))b.onclick=()=>{lang=b.dataset.lang;try{localStorage.setItem('trafficlab.language',lang);}catch{}applyLanguage();};
for(const b of document.querySelectorAll('[data-scenario]'))b.onclick=()=>{
  resetScene(b.dataset.scenario,b.dataset.scenario!=='manual');
  if(sheet.open)sheet.close();
};
for(const b of document.querySelectorAll('[data-car]'))b.onclick=()=>add('car',b.dataset.car);
for(const b of document.querySelectorAll('[data-ped]'))b.onclick=()=>add('ped',b.dataset.ped);
for(const b of pins)b.onclick=()=>add(b.dataset.kind,b.dataset.side);
for(const b of document.querySelectorAll('[data-movement]'))b.onclick=()=>setMovement(b.dataset.movement);
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);for(const x of document.querySelectorAll('[data-speed]'))pressed(x,x===b);};
$('junction-mode').onchange=()=>{sim.setMode($('junction-mode').value);movement='straight';resetScene();};
$('auto').onchange=()=>{sim.auto=$('auto').checked;sim.log(sim.auto?'Automatic arrivals enabled.':'Automatic arrivals disabled.',sim.auto?'logAutoOn':'logAutoOff');refresh();};
$('start').onclick=()=>setRunning(!running);
$('reset').onclick=()=>{resetScene();if(sheet.open)sheet.close();};
$('quick-demo').onclick=()=>resetScene('simultaneous',true);
$('paths-toggle').onclick=()=>{showPaths=!showPaths;pressed($('paths-toggle'),showPaths);invalidate();};
$('zoom-in').onclick=()=>view.zoomBy(1.18);
$('zoom-out').onclick=()=>view.zoomBy(1/1.18);
for(const [id,shot] of [['street-view','street'],['top-view','top'],['view-reset','orbit']]){
  $(id).onclick=()=>view.setShot?.(shot,reducedMotion);
}
$('river-view').onclick=()=>{
  $('sky-controls').open=false;
  view.setShot?.('river',reducedMotion);
  $('sky-controls').querySelector('summary').focus({preventScroll:true});
};
$('free-view').onclick=()=>{
  view.setFree?.(!view.director.free);
  refreshCameraControls();
};
$('camera-tour').onclick=()=>{
  const director=view.director;
  if(director.tour)director.cancel();
  else director.startTour(running,reducedMotion);
  refreshCameraControls();
};
$('hud-toggle').onclick=()=>{
  const visible=$('hud').hidden;
  hide($('hud'),!visible);
  document.body.classList.toggle('hud-hidden',!visible);
  pressed($('hud-toggle'),visible);
  if(!visible)$('junction').focus({preventScroll:true});
};
$('inspect-close').onclick=()=>{selection=null;view.select(null);refreshInspector();};
$('help').onclick=()=>{setRunning(false);$('guide').showModal();};
$('timings').onclick=()=>{
  setRunning(false);text('settings-error','');$('settings').showModal();
};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('log-panel').addEventListener('toggle',refreshLog);
$('settings-form').onsubmit=e=>{
  e.preventDefault();const values=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,Number(v)]));
  if(Object.values(values).some(v=>!Number.isInteger(v)||v<1||v>120)||values.maxGreen<values.minGreen){text('settings-error',t('timingError'));return;}
  sim.timings=values;$('settings').close();resetScene();
};
$('export').onclick=async()=>{
  setRunning(false);
  const rows=[['record_type','simulation_seconds','kind','waiting_seconds','message'],['configuration',0,'mode','',sim.mode],...sim.waitSamples.map(r=>['served',r.time.toFixed(2),r.kind,r.wait.toFixed(2),'']),...sim.events.map(e=>['event',e.time.toFixed(2),'','',localEvent(lang,e)]),['pending',sim.time.toFixed(2),'vehicles','',sim.vehicleGroups.reduce((n,key)=>n+sim.routeCount(key),0)],['pending',sim.time.toFixed(2),'pedestrians','',sim.routeCount('PED')]];
  const csv=(lang==='zh'?'\uFEFF':'')+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  if(window.trafficLab){
    try{if(await window.trafficLab.saveTestData(csv,lang)){sim.log('Test data saved as CSV.','saved');toast(t('saved'));refreshLog();}}
    catch{sim.log('Could not save the CSV.','saveFailed');toast(t('saveFailed'));refreshLog();}return;
  }
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='trafficlab-test-data.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)setRunning(false);});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(view.director?.free)view.setFree(false);
    else view.director?.cancel();
  }
  if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();setRunning(!running);}
});
applyLanguage();
if(savedCity==='westminster'&&!view.fallback)selectCity(savedCity);
