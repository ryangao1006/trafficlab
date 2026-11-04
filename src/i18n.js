const TEXT={
 en:{
  sceneMenu:'Scene', cameraMenu:'Camera', tabScenarios:'Scenarios', tabTraffic:'Traffic', tabResults:'Results',
  compare:'Live comparison', fixedTiming:'Fixed timing', oneSided:'One busy approach', walkPeak:'Pedestrian peak',
  raceCustom:'Custom', race2d:'2D overhead', race3d:'3D London', raceSmartMap:'Smart routes junction', raceFixedMap:'Fixed timing junction',
  raceReady:'Ready to race', raceRunning:'Both junctions are running', raceTie:'Tie · Both junctions cleared together',
  raceWinner:'{policy} cleared first · {time}', raceGap:'{time} apart', raceCleared:'Junction clear', raceTimeout:'Did not clear within 30 minutes',
  raceGreen:'Green · {routes}', raceAllRed:'All red', raceCounts:'Admitted {admitted} · Waiting {waiting}',
  raceArrivalType:'Movement', raceApproach:'Approach / crossing', raceQuantity:'Quantity', raceAt:'Arrival time (s)',
  raceAddBoth:'Add to both', raceClear:'Clear schedule', raceSchedule:'{n} of {max} arrivals scheduled',
  raceAdded:'Added {n} to both junctions.', raceInvalid:'Check the quantity, arrival time and {max}-arrival limit.',
  race3DLoading:'Loading both 3D junctions…', race3DFailed:'3D is unavailable. Both junctions are shown in 2D.',
  compareRun:'Replay', compareCsv:'Download comparison CSV', compareMean:'Average wait', compareP95:'95th percentile wait',
  compareServed:'Admitted by 120 s', compareQueued:'Still waiting at 120 s', compareUnserved:'Still waiting at 30 min',
  compareIntro:'The first junction to clear all scheduled and added traffic wins. Fixed timing rotates through north–south through and left turns, east–west through and left turns, then pedestrians.',
  compareMethod:'Classroom baseline · 10 s vehicle green and 4 s walk. The 120 s snapshot counts traffic arriving before 120 s. Average and p95 measure arrival to admission over the full race.',

  studio:'INTERSECTION STUDIO', lab:'3D TRAFFIC LAB', title:'Traffic in motion.', subtitle:'Explore a miniature junction and see who gets the next green.', clock:'SIMULATION TIME', running:'Running', paused:'Paused', help:'How to use', language:'Language',
  junction:'Junction 01', sandbox:'Interactive model', view3d:'3D VIEW', view2d:'2D VIEW', fallback:'3D is unavailable on this device. You can still run the simulation.', orbitHint:'Drag to rotate · scroll to zoom', canvasLabel:'Interactive junction. Drag to rotate, scroll to zoom, or use the arrow keys.',
  city:'City', cityCinematic:'Cinematic London', cityWestminster:'Westminster Map',
  cityLoading:'Preparing the city…', cityError:'City could not load. The current scene is still available.',
  cityRetry:'Retry', mapData:'Download map extract · 1 Nov 2026', mapAdaptation:'Classroom junction adapted',
  sceneTime:'Scene time', sceneWeather:'Weather', skyDay:'Daylight', skyGolden:'Golden hour', skyBlue:'Blue hour', skyNight:'Night', skyClear:'Clear', skyClouds:'Overcast', skyRain:'Rain', controls:'Controls', streetView:'Street view', zoomIn:'Zoom in', zoomOut:'Zoom out', top:'Top view · fit queues', viewReset:'Reset view', paths:'Routes', pathsTip:'Show or hide permitted routes', close:'Close', inspect:'Selected on the map',
  freeView:'Free view', freeKeys:'WASD / arrows to fly · Q / E down / up · Shift faster · drag to look · Esc to exit', freeTouch:'Drag to look · pinch to fly · drag with two fingers to move sideways or change height',
  tour:'Cinematic Tour', tourPaused:'Paused · Play to continue', tourStreet:'01 / 03 · High street', tourTurn:'02 / 03 · The junction', tourTop:'03 / 03 · From above',
  quality:'Graphics quality', performance:'Performance', balanced:'Balanced', cinematic:'Cinematic', riverView:'Riverside view', statistics:'Run statistics',
  mobileControls:'Traffic controls', touchHint:'Drag to orbit · pinch to zoom · two-finger drag to pan',
  play:'Play', pause:'Pause', reset:'Reset run', demo:'Try demo', speed:'Speed',
  scenarios:'Scenarios', scenarioIntro:'Pick a scene to start.', manual:'Empty junction', quiet:'Quiet roads', pedestrian:'Walk first', busy:'Rush hour', simultaneous:'Shared green', quietHint:'Light traffic', pedestrianHint:'People waiting', busyHint:'Continuous arrivals', simultaneousHint:'See routes share green', manualHint:'Build your own scene',
  mode:'Traffic rules', smart:'Smart routes', straight:'Straight only', protected:'Protected left turns', modeSmart:'Long queues get priority and can hold green longer. Long waits get priority at the next safe change.', modeStraight:'Original through traffic and parallel walks.', modeProtected:'Left turns use a separate green.', auto:'Auto arrivals', autoTip:'Generate vehicles and pedestrians automatically',
  add:'Add traffic', car:'Vehicle', cars:'Vehicles', ped:'Pedestrian', people:'Pedestrians', through:'Straight', left:'Left turn', movement:'Vehicle movement', entry:'{side} entry', walk:'Walk', crossing:'{side} crossing',
  addCar:'Add {side} vehicle', addPed:'Add pedestrian at {side} crossing', addedCar:'Vehicle added · {route}', addedPed:'Pedestrian added · {route}', pressPlay:' · Press Play to move', invalidArrival:'This movement is unavailable in the selected mode.', to:'To {side}',
  next:'Waiting routes', noRequests:'No waiting routes.', blocked:'Waits for {route}', pending:'Waiting', approaching:'Approaching', active:'Green', clearing:'Clearing', requestCount:'{n} waiting or approaching', overflowCount:'{n} in the extended queue', nextDemand:'Next priority: {route} · {n} waiting or approaching.',
  nextPriority:'Next priority: {route}.', nextPair:'Next: {route} with a parallel walk.', joinHint:'Compatible arrivals can join this green.', addHint:'Choose a scenario or add traffic to begin.',
  served:'Vehicles served', crossed:'People crossed', carWait:'Avg. vehicle wait', pedWait:'Avg. pedestrian wait', carWaitTip:'Stopped time and time in the extended queue for vehicles that have entered. Excludes vehicles still waiting.', pedWaitTip:'Time from arrival to crossing permission. Excludes people still waiting.',
  idle:'Waiting for traffic', idleTag:'ALL RED', idleDesc:'Pick a scene or use the map’s + buttons.', green:'Shared green', amber:'Amber · close entry', allRed:'All red · clear the junction', pedGreen:'Pedestrians crossing', pedClear:'Finish crossing',
  greenExtended:'Extended for waiting traffic', smartGreen:'Shared green · {n} routes', smartTag:'{n} ROUTES OPEN', straightGreen:'{route} + parallel walk', protectedGreen:'{route} · protected', amberDesc:'New vehicles stop. Traffic already inside keeps moving.', allRedDesc:'The next green waits for the junction to clear.', walkDesc:'All pedestrian crossings are open.', pedClearDesc:'Anyone already walking can finish.',
  noTimer:'No active phase', maxLeft:'Maximum remaining', minLeft:'Minimum remaining', hold:'HOLD', occupied:'Junction still occupied', seconds:'{n} s',
  log:'Decision log', export:'Export CSV', settings:'Phase timings', footer:'Classroom simulator · runs offline', settingsIntro:'Times are in simulation seconds. Applying changes starts a new run.', apply:'Apply and reset', timingError:'Enter 1–120 seconds. Maximum green must be at least minimum green.',
  minGreen:'Minimum vehicle green',maxGreen:'Maximum vehicle green',amberTime:'Amber',allRedTime:'Minimum all red',walkTime:'Pedestrian-only green',pedestrianClear:'Pedestrian clearance',
  helpTitle:'Explore the junction', help1:'Start a scene. Choose a scenario card to run it immediately, or use Empty junction to create your own.', help2:'Move the camera. Drag to rotate, scroll or pinch to zoom, and Shift-drag or two-finger drag to pan. Use Street view or Top view to change the angle. Cinematic Tour runs through three views. Drag, zoom, or press Esc to take over. Controls hides or restores the simulation panels.', help3:'Interact with traffic. Use the map’s + buttons or the side panel to add vehicles and pedestrians. Click a model or traffic light to inspect it.', help4:'Watch the decisions. Smart routes opens compatible movements together, weighs queue size and waiting time, and waits for traffic to clear before a conflicting green.', help5:'Compare traffic rules. The three modes use the same model. Switching modes starts a fresh run. You can pause with Space and use arrow keys on the map.', helpNote:'This model has through traffic, left turns and pedestrian crossings. It is designed for classroom demonstrations.',
  moving:'Moving', stopped:'Waiting at the light', walkMoving:'Crossing', walkWaiting:'Waiting to cross', signal:'Traffic light', red:'Red', amberState:'Amber', greenState:'Green',
  noLog:'No decisions yet.', saved:'Test data saved as CSV.', saveFailed:'Could not save the CSV. Try another location.',
  logReady:'All signals red. Ready for a request.', logGroup:'{route} selected · {why} ({wait}).', oldest:'longest pending request', parallel:'shares the oldest pedestrian request',
  logWalk:'{sides} crossings · {n} pedestrians admitted.', logSmart:'Green: {routes}. Priority: {route} ({n} waiting or approaching).', logJoin:'Compatible routes join: {routes}. Timer unchanged.', logClose:'Vehicle greens close through amber; walk signals turn red.', logWalkClose:'Walk signals close. Admitted pedestrians finish crossing.', logClear:'Clearance: admitted traffic finishes crossing.', logAmber:'{route} changes to amber.', logPedClear:'Pedestrian clearance. Vehicles remain red.', logScenario:'Scene: {scene} · {mode}.', logAutoOn:'Automatic arrivals enabled.',logAutoOff:'Automatic arrivals disabled.'
 },
 zh:{
  sceneMenu:'街景', cameraMenu:'镜头', tabScenarios:'场景', tabTraffic:'交通', tabResults:'结果',
  compare:'实时对比', fixedTiming:'固定配时', oneSided:'单边车流', walkPeak:'行人高峰',
  raceCustom:'自定义', race2d:'2D 俯视', race3d:'3D 伦敦', raceSmartMap:'智能路线的路口', raceFixedMap:'固定配时的路口',
  raceReady:'准备开始', raceRunning:'两个路口同时运行', raceTie:'平局 · 两个路口同时清空',
  raceWinner:'{policy}先清空 · {time}', raceGap:'相差 {time}', raceCleared:'路口已清空', raceTimeout:'30 个模拟分钟内未清空',
  raceGreen:'绿灯 · {routes}', raceAllRed:'全红', raceCounts:'已放行 {admitted} · 等待中 {waiting}',
  raceArrivalType:'通行类型', raceApproach:'来车方向 / 过街位置', raceQuantity:'数量', raceAt:'到达时间（秒）',
  raceAddBoth:'两边同时添加', raceClear:'清空安排', raceSchedule:'已安排 {n} / {max} 个到达',
  raceAdded:'两边各加入 {n} 个。', raceInvalid:'请检查数量、到达时间和 {max} 个到达的上限。',
  race3DLoading:'正在加载两个 3D 路口…', race3DFailed:'3D 无法加载，两个路口均以 2D 显示。',
  compareRun:'重新运行', compareCsv:'下载对比 CSV', compareMean:'平均等待', compareP95:'第 95 百分位等待',
  compareServed:'120 秒内放行', compareQueued:'120 秒时仍在等待', compareUnserved:'30 分钟时仍在等待',
  compareIntro:'先让全部已安排和途中添加的车辆、行人离开路口的一侧获胜。固定配时依次放行南北直行、南北左转、东西直行、东西左转和行人。',
  compareMethod:'课堂对照设定为车辆绿灯 10 秒、行人放行 4 秒。120 秒快照只统计此前已到达的交通。平均值和 p95 按整场比赛从到达至获准通行的时间计算。',

  studio:'路口实验室', lab:'3D 交通模拟', title:'让路口动起来。', subtitle:'探索微缩路口，看看下一轮绿灯会放行谁。', clock:'模拟时间', running:'运行中', paused:'已暂停', help:'使用帮助', language:'语言',
  junction:'01 号路口', sandbox:'互动模型', view3d:'3D 视图', view2d:'2D 视图', fallback:'此设备无法使用 3D，仍可以运行模拟。', orbitHint:'拖动旋转 · 滚动缩放', canvasLabel:'互动路口。拖动旋转、滚动缩放，也可使用方向键。',
  city:'街景', cityCinematic:'电影伦敦', cityWestminster:'真实地图 · Westminster',
  cityLoading:'正在准备街景…', cityError:'街景加载失败。可以继续使用当前场景。',
  cityRetry:'重试', mapData:'下载地图数据 · 2026 年 11 月 1 日', mapAdaptation:'课堂路口已局部调整',
  sceneTime:'场景时间', sceneWeather:'天气', skyDay:'白天', skyGolden:'黄金时刻', skyBlue:'蓝调时刻', skyNight:'夜晚', skyClear:'晴朗', skyClouds:'阴天', skyRain:'下雨', controls:'控制面板', streetView:'街景视角', zoomIn:'放大', zoomOut:'缩小', top:'俯视 · 显示整条队伍', viewReset:'重置视角', paths:'通行路线', pathsTip:'显示或隐藏当前允许通行的路线', close:'关闭', inspect:'地图选中对象',
  freeView:'自由视角', freeKeys:'WASD / 方向键移动 · Q / E 下降 / 上升 · Shift 加速 · 拖动转向 · Esc 退出', freeTouch:'单指拖动转向 · 双指捏合前后移动 · 双指拖动平移或升降',
  tour:'电影巡游', tourPaused:'已暂停 · 按开始继续', tourStreet:'01 / 03 · 伦敦街景', tourTurn:'02 / 03 · 路口转弯', tourTop:'03 / 03 · 城市俯视',
  quality:'画质', performance:'流畅', balanced:'平衡', cinematic:'电影画质', riverView:'河岸视角', statistics:'通行统计',
  mobileControls:'交通控制', touchHint:'单指旋转 · 双指缩放和平移',
  play:'开始', pause:'暂停', reset:'重置模拟', demo:'试试演示', speed:'速度',
  scenarios:'交通场景', scenarioIntro:'点击场景即可开始。', manual:'空路口', quiet:'车流稀少', pedestrian:'行人先到', busy:'车流高峰', simultaneous:'共享绿灯', quietHint:'少量车辆', pedestrianHint:'行人等待过街', busyHint:'车辆持续到来', simultaneousHint:'看不同路线一起走', manualHint:'自己布置场景',
  mode:'交通规则', smart:'智能路线', straight:'原版直行', protected:'独立左转', modeSmart:'长队优先，可延长绿灯。等得太久的路线会优先安排在下一轮。', modeStraight:'直行车辆与平行行人一起走。', modeProtected:'左转使用单独的绿灯阶段。', auto:'自动来车和行人', autoTip:'自动生成车辆和行人',
  add:'添加车和行人', car:'车辆', cars:'车辆', ped:'行人', people:'行人', through:'直行', left:'左转', movement:'车辆行驶方向', entry:'{side}侧入口', walk:'行人', crossing:'{side}侧斑马线',
  addCar:'添加{side}侧车辆', addPed:'在{side}侧斑马线添加行人', addedCar:'已添加车辆 · {route}', addedPed:'已添加行人 · {route}', pressPlay:' · 点击开始让他们移动', invalidArrival:'当前模式不支持这个行驶方向。', to:'去{side}侧',
  next:'等待路线', noRequests:'暂无等待路线。', blocked:'避让{route}', pending:'等待中', approaching:'正在接近', active:'绿灯', clearing:'清空中', requestCount:'{n} 个正在等待或接近', overflowCount:'{n} 个排在延长队列', nextDemand:'下一轮优先：{route} · {n} 个正在等待或接近。',
  nextPriority:'下一轮优先：{route}。', nextPair:'下一轮：{route}与平行行人。', joinHint:'兼容的新请求可以加入当前绿灯。', addHint:'选择场景，或添加车辆和行人。',
  served:'已放行车辆', crossed:'已过街行人', carWait:'车辆平均等待', pedWait:'行人平均等待', carWaitTip:'已进入路口的车辆在画面内外排队等待的时间，不含仍在等待的车辆。', pedWaitTip:'从到达至获准过街的时间，不含仍在等待的行人。',
  idle:'等待交通请求', idleTag:'全红灯', idleDesc:'选择场景，或点击地图上的＋按钮。', green:'共享绿灯', amber:'黄灯 · 停止进入', allRed:'全红 · 清空路口', pedGreen:'行人通行', pedClear:'行人过完斑马线',
  greenExtended:'为等待队列延长绿灯', smartGreen:'共享绿灯 · {n} 条路线', smartTag:'{n} 条路线通行', straightGreen:'{route}＋平行行人', protectedGreen:'{route} · 左转专用', amberDesc:'新车辆停下，已进入路口的人和车继续走。', allRedDesc:'路口清空后，再开放下一轮绿灯。', walkDesc:'四条斑马线均开放。', pedClearDesc:'已经进入斑马线的行人继续走完。',
  noTimer:'暂无活动阶段', maxLeft:'最长剩余', minLeft:'至少还需', hold:'等待', occupied:'路口尚未清空', seconds:'{n} 秒',
  log:'放行记录', export:'导出 CSV', settings:'信号灯计时', footer:'课堂模拟器 · 可离线运行', settingsIntro:'单位为模拟秒数。应用后重新开始模拟。', apply:'应用并重置', timingError:'请输入 1–120 秒，最长绿灯不能短于最短绿灯。',
  minGreen:'最短车辆绿灯',maxGreen:'最长车辆绿灯',amberTime:'黄灯',allRedTime:'最短全红',walkTime:'独立行人绿灯',pedestrianClear:'行人清空',
  helpTitle:'探索这个路口', help1:'开始场景。点击卡片立即运行，或选择「空路口」自己添加交通。', help2:'移动镜头。拖动旋转，滚动或双指缩放，按 Shift 拖动或双指拖动平移。可以切换街景或俯视，也可以用「电影巡游」看三个镜头。拖动、缩放或按 Esc 可接管镜头。右上角的控制面板按钮可隐藏或恢复模拟控件。', help3:'与交通互动。用地图上的＋按钮或右侧面板添加车辆和行人。点击模型或信号灯可查看状态。', help4:'观察放行决定。「智能路线」让互不冲突的路线一起走，同时考虑排队数量和等待时间，并在冲突路线放行前等路口清空。', help5:'比较交通规则。三种模式使用同一个路口模型。切换模式会开始新一轮；空格键可暂停，地图上可以用方向键旋转。', helpNote:'这是课堂模型，包含直行、左转和行人过街。',
  moving:'行驶中', stopped:'等红灯', walkMoving:'正在过街', walkWaiting:'等待过街', signal:'信号灯', red:'红灯', amberState:'黄灯', greenState:'绿灯',
  noLog:'暂无放行记录。', saved:'已保存 CSV 测试数据。', saveFailed:'无法保存 CSV，请尝试其他位置。',
  logReady:'信号灯全红，等待交通请求。', logGroup:'放行{route} · {why}（{wait}）。', oldest:'等待时间最长', parallel:'兼顾最早等待的行人',
  logWalk:'{sides}侧斑马线 · {n} 位行人获准过街。', logSmart:'放行：{routes}。优先路线：{route}（{n} 个正在等待或接近）。', logJoin:'兼容路线加入：{routes}。计时不重置。', logClose:'车辆绿灯转为黄灯，行人灯转红。', logWalkClose:'行人绿灯关闭，已进入的行人继续走完。', logClear:'清空路口：已进入的人和车继续走。', logAmber:'{route}转为黄灯。', logPedClear:'等待行人走完，车辆保持红灯。', logScenario:'场景：{scene} · {mode}。', logAutoOn:'已开启自动到达。',logAutoOff:'已关闭自动到达。'
 }
};
const DIRECTIONS={en:{N:'North',E:'East',S:'South',W:'West'},zh:{N:'北',E:'东',S:'南',W:'西'}};
export const sideName=(lang,side)=>DIRECTIONS[lang]?.[side]??side;
export const translate=(lang,key,params={})=>(TEXT[lang]?.[key]??TEXT.en[key]??key).replace(/\{(\w+)\}/g,(_,k)=>params[k]??'');
export const modeName=(lang,mode)=>translate(lang,mode==='left-turns'?'protected':mode);
export function localRoute(lang,key){
  const paired={NS:['North–South vehicles','南北车辆'],EW:['East–West vehicles','东西车辆'],NS_LEFT:['North–South left turns','南北左转'],EW_LEFT:['East–West left turns','东西左转'],PED:['Pedestrians','行人']};
  if(paired[key])return paired[key][lang==='zh'?1:0];
  if(key.startsWith('P_'))return translate(lang,'crossing',{side:sideName(lang,key[2])});
  const side=sideName(lang,key[0]);
  return lang==='zh'?`${side}侧${translate(lang,key.endsWith('_L')?'left':'through')}`:`${side} ${key.endsWith('_L')?'left':'through'}`;
}
export function localEvent(lang,event){
  if(!event.code)return event.message;
  const p={...event.data};
  if(p.side)p.side=sideName(lang,p.side);
  if(p.sides)p.sides=p.sides.map(s=>sideName(lang,s)).join('/');
  if(p.route)p.route=localRoute(lang,p.route);
  if(p.routes)p.routes=p.routes.map(r=>localRoute(lang,r)).join(' + ');
  if(p.mode)p.mode=modeName(lang,p.mode);
  if(p.scene)p.scene=translate(lang,p.scene);
  if(p.why)p.why=translate(lang,p.why);
  if(p.wait!=null)p.wait=translate(lang,'seconds',{n:p.wait});
  return translate(lang,event.code,p);
}
