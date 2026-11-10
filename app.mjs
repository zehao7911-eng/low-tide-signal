import * as C from './core.mjs';
import {HarborView} from './art.mjs';
import {HarborAudio} from './audio.mjs';
import {bridge} from './sdk.mjs';
import * as R from './channel.mjs';
import {ChannelView} from './channel-view.mjs';

const $=id=>document.getElementById(id);
const KEY='low-tide-signal-v1';
let raw;
try{raw=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
let profile=C.profile(raw?.profile);
let state=C.restore(raw?.state,profile);
let mode=raw?.mode==='story'?'story':'race';
let run=R.restoreRun(raw?.run,profile);
let view,host,frame=0,last=0,guidePoint=null;
let raceView,raceFallback=false,racePointer=null,raceKey=false,raceBank=0,checkpoint=0,raceFeedback=null;
let buttons=new Map();
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const audio=new HarborAudio(profile.mute);

function persist(){
  try{localStorage.setItem(KEY,JSON.stringify({v:1,profile,state,run,mode}));}catch{}
}
function attach(){
  host=bridge({
    read:()=>C.profile(profile),
    write(value,merge){
      profile=merge?C.mergeProfile(profile,value):C.profile(value);
      persist();if(mode==='race')refreshRace();else refresh();
      if($('panel').open&&$('panel').dataset.kind==='log')drawLog();
    },
    changed(event){
      if(event.type==='reward'){
        setNote('HARBOR LOG',event.kind==='like'?'Copper lanterns unlocked.':'The signal flag is flying.');
        audio.cue('take');
      }
      if($('panel').open&&$('panel').dataset.kind==='log')drawLog();
    }
  });
}
function chapter(){return C.CHAPTERS[state.index];}
function setNote(tag,line){$('tag').textContent=tag;$('line').textContent=line;}
function allowAudio(){audio.wake();audio.surf(!document.hidden&&!$('panel').open);}
function openPoints(){
  buttons=new Map();
  $('points').replaceChildren();
  for(const point of chapter().points){
    const button=document.createElement('button'),icon=document.createElement('i'),label=document.createElement('span');
    button.type='button';button.className='point';button.dataset.point=point.id;
    icon.setAttribute('aria-hidden','true');
    label.textContent=point.name;
    button.append(icon,label);
    button.addEventListener('click',()=>tapPoint(point.id));
    $('points').append(button);buttons.set(point.id,{button,icon});
  }
}
function refresh(){
  const ch=chapter();
  $('district').textContent=ch.district.toUpperCase();
  $('chapter').textContent=ch.name;
  $('tide-label').textContent=C.TIDES[state.tide].toUpperCase()+' TIDE';
  $('sound').setAttribute('aria-pressed',String(!profile.mute));
  $('signal').hidden=!state.cleared;
  $('guide').disabled=state.cleared;
  for(const button of document.querySelectorAll('[data-tide]')){
    button.setAttribute('aria-pressed',String(Number(button.dataset.tide)===state.tide));
    button.disabled=state.cleared;
  }
  const tools=ch.points.filter(p=>p.take&&state.done.includes(p.id)).map(p=>p.name.toUpperCase());
  $('inventory').textContent=tools.join(' · ')||'NO TOOLS';
  $('progress').textContent=profile.rewards.comment?'⚑ · '+(state.index+1)+' / 6':(state.index+1)+' / 6';
  for(const point of ch.points){
    const entry=buttons.get(point.id);
    if(!entry)continue;
    const done=state.done.includes(point.id),wet=point.tide!==null&&point.tide!==state.tide;
    entry.button.dataset.done=String(done);
    entry.button.dataset.wet=String(wet);
    entry.button.dataset.guide=String(guidePoint===point.id);
    entry.button.hidden=state.cleared;
    entry.button.disabled=done;
    entry.icon.textContent=done?'✓':wet?'≋':point.relic?'✦':'◇';
  }
}
function effect(button){
  if(!button)return;
  const box=$('scene').getBoundingClientRect(),at=button.getBoundingClientRect();
  const x=at.left-box.left+at.width*.5,y=at.top-box.top+at.height*.5;
  $('fx').replaceChildren();
  for(let i=0;i<14;i++){
    const el=document.createElement('b'),angle=i*Math.PI/7,r=27+i%4*12;
    el.className='spark';
    el.style.setProperty('--x',x+'px');el.style.setProperty('--y',y+'px');
    el.style.setProperty('--dx',Math.cos(angle)*r+'px');el.style.setProperty('--dy',Math.sin(angle)*r+'px');
    $('fx').append(el);el.addEventListener('animationend',()=>el.remove(),{once:true});
  }
}
function commitTide(value){
  if(!C.setTide(state,value))return;
  allowAudio();audio.cue('tide');host.start();
  const ready=chapter().points.filter(p=>p.tide===value&&!state.done.includes(p.id)&&C.inspect(state,p.id).ok);
  setNote('WATERLINE',ready.length?ready.map(p=>p.name).join(' and ')+' now within reach.':C.TIDES[value]+' tide. Look for a marked object.');
  persist();refresh();
}
function tapPoint(id){
  const result=C.interact(state,id,profile);
  allowAudio();
  if(!result.ok){setNote('NOT YET',result.text);audio.cue('wrong');return;}
  host.start();
  if(guidePoint===id)guidePoint=null;
  effect(buttons.get(id)?.button);
  setNote(state.cleared?'SIGNAL RESTORED':result.point.relic?'KEEPSAKE FOUND':result.point.take?'RECOVERED':'MECHANISM SET',
    state.cleared?chapter().ending:result.text);
  audio.cue(state.cleared?'clear':'take');
  persist();
  if(state.cleared)host.end();
  if(state.cleared||result.point.relic)host.save();
  refresh();
}
function newChapter(index){
  if(index>C.unlocked(profile))return;
  if(!state.cleared)host.end();
  host.prepare();state=C.create(index);guidePoint=null;
  $('panel').close();
  openPoints();setNote('FIELD NOTE',chapter().opening);allowAudio();persist();refresh();
}
function makeButton(text,action,primary=false){
  const b=document.createElement('button');b.type='button';b.textContent=text;
  if(primary)b.className='primary';
  b.addEventListener('click',action);return b;
}
function content(kicker,title,body){
  const root=$('panel-content');
  root.innerHTML='<div class="panel-kicker"></div><h2 id="dialog-title"></h2><p></p>';
  root.firstChild.textContent=kicker;root.children[1].textContent=title;root.children[2].textContent=body;
  return root;
}
function drawLog(){
  const racing=mode==='race';
  const total=(racing?profile.runs:profile.best).reduce((a,b)=>a+b,0),found=profile.relics.filter(Boolean).length;
  const root=content('HARBOR ARCHIVE',racing?'Tide Run':'The logbook',total+' / 18 stars'+(racing?' across six courses':' · '+found+' / 6 keepsakes'));
  const modes=document.createElement('div');modes.className='panel-actions mode-switch';
  modes.append(makeButton('Tide Run',()=>selectMode('race'),racing),makeButton('Story puzzles',()=>selectMode('story'),!racing));root.append(modes);
  const list=document.createElement('div');list.className='log-grid';root.append(list);
  (racing?R.COURSES:C.CHAPTERS).forEach((ch,i)=>{
    const b=makeButton('',()=>{
      if(racing){if(i===run.i&&!runEnded())close();else resetRace(i);}
      else if(i===state.index&&!state.cleared)close();else newChapter(i);
    });
    b.disabled=i>(racing?R.runUnlocked(profile):C.unlocked(profile));
    const best=racing?profile.runs[i]:profile.best[i];
    for(const text of [String(i+1).padStart(2,'0'),ch.name,b.disabled?'LOCKED':'★'.repeat(best)+'☆'.repeat(3-best)]){
      const span=document.createElement('span');span.textContent=text;b.append(span);
    }
    list.append(b);
  });
  const support=host.support();
  if(support.like||support.comment){
    const p=document.createElement('p'),tasks=[];
    if(support.like)tasks.push(profile.rewards.like?'Copper lanterns unlocked.':'Like this game in GameWave to unlock copper lanterns.');
    if(support.comment)tasks.push(profile.rewards.comment?'Signal flag unlocked.':'Leave a direct GameWave comment to unlock the signal flag.');
    p.textContent=tasks.join(' ')+' Optional; rewards are saved with this game.';root.append(p);
  }
  const actions=document.createElement('div');actions.className='panel-actions';
  actions.append(makeButton('Back to harbor',close,true));root.append(actions);
}
function drawResult(){
  const all=profile.best.every(Boolean);
  const root=content('SIGNAL RESTORED',chapter().name,chapter().ending);
  const stars=document.createElement('div');stars.className='stars';stars.textContent='★'.repeat(state.stars)+'☆'.repeat(3-state.stars);
  stars.setAttribute('aria-label',state.stars+' out of 3 stars');root.append(stars);
  const p=document.createElement('p');
  p.textContent=(state.guided?'Used a hint. ':'Solved without a hint. ')+(profile.relics[state.index]?'Keepsake logged.':'A keepsake remains.')+(all?' All six signals restored.':'');
  root.append(p);
  const actions=document.createElement('div');actions.className='panel-actions';root.append(actions);
  if(state.index<C.CHAPTERS.length-1)actions.append(makeButton('Next signal ›',()=>newChapter(state.index+1),true));
  else actions.append(makeButton('Harbor log',showLog,true));
  actions.append(makeButton('Replay',()=>newChapter(state.index)),makeButton('Back',close));
}
function show(kind,draw){
  if(mode==='race')pauseRace();
  $('panel').dataset.kind=kind;draw();
  if(!$('panel').open)$('panel').showModal();
  audio.silence();
}
function showLog(){show('log',drawLog);}
function close(){$('panel').close();allowAudio();}

function selectMode(next){
  if(mode===next)return;
  host.end();host.prepare();
  mode=next;
  syncMode();
  drawLog();persist();restartFrame();
}
function syncMode(){
  const racing=mode==='race';
  $('storyControls').hidden=racing;
  $('raceControls').hidden=!racing;
  $('points').hidden=racing;
  $('channel').hidden=!racing||raceFallback;
  $('world').hidden=racing||!view;
  $('raceCue').hidden=!racing;
  $('gateTrack').hidden=!racing;
  $('raceFallback').hidden=!racing||!raceFallback;
  $('scene').classList.toggle('fallback',!racing&&!view);
  if(racing){
    if(!raceView&&!raceFallback)try{raceView=new ChannelView($('channel'));}catch{enableRaceFallback();}
    raceView?.resize();
    refreshRace();
  }else{
    view?.resize();refresh();
  }
}
function held(){return racePointer!==null||raceKey;}
function runEnded(){return run.phase==='clear'||run.phase==='wreck';}
function refreshRace(){
  const course=R.COURSES[run.i],target=course.gates[run.g];
  $('district').textContent='TIDE RUN · '+String(run.i+1).padStart(2,'0')+' / 06';
  $('chapter').textContent=course.name;
  $('raceScore').textContent=run.points.toLocaleString('en');
  $('raceChain').textContent=run.chain+'×';
  $('raceBells').textContent=run.bells+'/'+course.gates.filter(g=>g.kind==='buoy').length;
  $('raceProgress').style.transform='scaleX('+run.x/R.runEnd(run.i)+')';
  $('waterFill').style.transform='scaleX('+run.water+')';
  $('raise').dataset.held=String(held());
  $('raise').disabled=runEnded();
  $('raiseText').textContent=run.phase==='ready'?'HOLD TO LAUNCH':run.phase==='paused'?'HOLD TO RESUME':run.phase==='clear'?'FINISH LINE':run.phase==='wreck'?'RUN ENDED':held()?'RISING TIDE':'FALLING TIDE';
  const cue=$('raceCue'),showing=raceFeedback&&performance.now()<raceFeedback.until;
  cue.textContent=showing?raceFeedback.text:target?target.label:'Finish ahead';
  cue.dataset.tone=runEnded()?'clear':showing?raceFeedback.type:target?.kind||'pass';
  const travel=target?(target.x-run.x)/(target.x-(course.gates[run.g-1]?.x||0)):0;
  $('gateFill').style.transform='scaleX('+Math.max(0,1-travel)+')';
  $('gateTrack').hidden=runEnded();
  $('trimZone').hidden=runEnded()||!target||target.kind==='buoy';
  $('trimZone').style.left=target?.kind==='bridge'?'19%':'68%';
  $('trimZone').style.width='15%';
  $('raceNote').textContent=run.phase==='paused'?'Paused · Hold to resume':run.hits===1?'One bump left · Watch the next crossing':'Hold to rise · Release to sink';
  $('signal').hidden=!runEnded();
  if(raceFallback){
    $('fallbackBoat').style.bottom=(run.water*63)+'%';
    $('fallbackGate').textContent=target?.kind==='bridge'?'▬':target?.kind==='buoy'?'✦':'▲';
  }
}
function enableRaceFallback(){
  raceFallback=true;raceView=null;
  $('channel').hidden=true;
  $('raceFallback').hidden=false;
}
function launchRace(){
  if(mode!=='race'||$('panel').open||runEnded())return;
  if(run.phase!=='run'){
    run.phase='run';raceBank=0;last=0;
    host.start();allowAudio();persist();
  }
  refreshRace();
}
function pauseRace(){
  racePointer=null;raceKey=false;raceBank=0;
  if(run.phase==='run'){run.phase='paused';persist();}
  if(mode==='race')refreshRace();
}
function resetRace(index=run.i){
  if(index>R.runUnlocked(profile))return;
  if(!runEnded())host.end();
  host.prepare();run=R.newRun(index);raceFeedback=null;
  racePointer=null;raceKey=false;raceBank=0;
  close();persist();refreshRace();
}
function raceResult(){
  const stars=R.runStars(run),course=R.COURSES[run.i];
  if(run.phase==='wreck'){
    const root=content('BACK TO THE DOCK',course.name,'Two bumps ended the run. Watch the next crossing and change the water level before the boat reaches it.');
    const actions=document.createElement('div');actions.className='panel-actions';root.append(actions);
    actions.append(makeButton('Try again ›',()=>resetRace(),true),makeButton('Harbor log',showLog));
    return;
  }
  const root=content('FINISH LINE',course.name,run.points.toLocaleString('en')+' points · Best chain '+run.bestChain+'× · '+run.hits+' bumps');
  const row=document.createElement('div');row.className='stars';row.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);root.append(row);
  const actions=document.createElement('div');actions.className='panel-actions';root.append(actions);
  if(run.i<R.COURSES.length-1)actions.append(makeButton('Next course ›',()=>resetRace(run.i+1),true));
  else actions.append(makeButton('Harbor log',showLog,true));
  actions.append(makeButton('Replay',()=>resetRace()),makeButton('Back',close));
}
function raceEvent(event){
  if(event.type==='wreck'){
    host.end();persist();audio.cue('wrong');return;
  }
  if(event.type==='finish'){
    profile.runs[run.i]=Math.max(profile.runs[run.i],R.runStars(run));
    profile.scores[run.i]=Math.max(profile.scores[run.i],run.points);
    host.end();host.save();persist();audio.cue('clear');return;
  }
  const labels={pass:'Clear · '+run.chain+'× chain',trim:'Perfect tide · +75',bump:'Bump · Chain lost',bell:'Bell rung · +100',miss:'Buoy missed'};
  raceFeedback={text:labels[event.type],type:event.type,until:performance.now()+480};
  if(event.type!=='miss')audio.cue(event.type==='bump'?'wrong':['bell','trim'].includes(event.type)?'take':'tide');
  if(event.type==='bump'&&!reduce.matches)try{navigator.vibrate?.(28);}catch{}
  persist();
}
function updateRace(now,dt){
  if(run.phase==='run'){
    raceBank+=dt;
    while(raceBank>=1/90&&run.phase==='run'){
      raceBank-=1/90;
      const event=R.stepRun(run,1/90,held());
      if(event)raceEvent(event);
    }
    if(now-checkpoint>=185){checkpoint=now;persist();}
  }
  refreshRace();
  raceView?.renderRun(run,C.CHAPTERS[run.i],R.COURSES[run.i],R.runEnd(run.i),dt,reduce.matches,profile.rewards);
}

function placePoints(){
  const scene=$('scene'), w=scene.clientWidth, h=scene.clientHeight;
  const layout=chapter().points.map(point=>{
    const {button}=buttons.get(point.id);
    const [x,y]=view.project(point);
    return {button,x:x*w/100,y:y*h/100,wide:button.offsetWidth,tall:button.offsetHeight};
  }).sort((a,b)=>a.y-b.y);
  const placed=[];
  for(const item of layout){
    const {button,wide,tall}=item;
    const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const x=bound(item.x,wide/2+5,w-wide/2-5);
    const candidates=[-26,27,-80,81,-134,135].map(n=>bound(item.y+n,78,h-tall/2-6));
    const y=candidates.find(v=>placed.every(other=>
      Math.abs(x-other.x)>(wide+other.wide)/2+6||Math.abs(v-other.y)>(tall+other.tall)/2+6
    ))??candidates[0];
    placed.push({x,y,wide,tall});
    button.style.left=x+'px';
    button.style.top=y+'px';
  }
}
function render(now){
  frame=0;
  if(document.hidden)return;
  if(last&&now-last<29){frame=requestAnimationFrame(render);return;}
  const dt=last?Math.min(.075,(now-last)/1000):.016;
  last=now;
  if(mode==='race')updateRace(now,dt);
  else if(view){
    view.draw(chapter(),state,dt,reduce.matches,profile.rewards);
    if(!state.cleared)placePoints();
  }
  frame=requestAnimationFrame(render);
}
function restartFrame(){if(!frame){last=0;frame=requestAnimationFrame(render);}}
function fallback(){
  view=null;
  if(mode==='story')$('scene').classList.add('fallback');
  $('world').hidden=true;
}
try{view=new HarborView($('world'));}catch{fallback();}
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(mode==='race')raceView?.resize();else view?.resize();}).observe($('scene'));
$('channel').addEventListener('webglcontextlost',event=>{event.preventDefault();enableRaceFallback();});
const raise=$('raise');
raise.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0||runEnded())return;
  racePointer=event.pointerId;
  raise.setPointerCapture(event.pointerId);launchRace();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])raise.addEventListener(name,event=>{
  if(event.pointerId===racePointer)racePointer=null;
});
raise.addEventListener('click',event=>{if(event.detail===0&&run.phase!=='run')launchRace();});
$('raceReset').addEventListener('click',()=>{
  if(run.phase==='ready'||runEnded()){resetRace();return;}
  show('restart',()=>{
    const root=content('FRESH RUN','Restart this course?','Your best score and stars stay in the logbook.');
    const actions=document.createElement('div');actions.className='panel-actions';root.append(actions);
    actions.append(makeButton('Restart',()=>resetRace(),true),makeButton('Back',close));
  });
});
document.querySelectorAll('[data-tide]').forEach(button=>button.addEventListener('click',()=>commitTide(Number(button.dataset.tide))));
$('guide').addEventListener('click',()=>{
  const hint=C.guide(state);
  if(!hint)return;
  guidePoint=hint.id;setNote('FIELD HINT',hint.text);persist();refresh();
});
$('book').addEventListener('click',showLog);
$('signal').addEventListener('click',()=>show('result',mode==='race'?raceResult:drawResult));
$('sound').addEventListener('click',()=>{
  profile.mute=!profile.mute;audio.muted=profile.mute;
  if(profile.mute)audio.silence();else allowAudio();
  persist();if(mode==='race')refreshRace();else refresh();
});
$('panel').addEventListener('close',()=>{$('panel').dataset.kind='';});
document.addEventListener('keydown',event=>{
  if($('panel').open||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(mode==='race'){
    if(event.code==='Space'&&(event.target===raise||!event.target.closest?.('button'))){
      event.preventDefault();raceKey=true;launchRace();
    }
    return;
  }
  if(['1','2','3'].includes(event.key)){event.preventDefault();commitTide(Number(event.key)-1);}
});
document.addEventListener('keyup',event=>{if(event.code==='Space')raceKey=false;});
window.addEventListener('blur',()=>{if(mode==='race'){pauseRace();audio.silence();}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(mode==='race')pauseRace();audio.silence();persist();}
  else{restartFrame();audio.surf(!profile.mute&&!$('panel').open);}
});
window.addEventListener('pagehide',()=>{if(mode==='race')pauseRace();persist();audio.silence();host.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted)attach();restartFrame();});
openPoints();
if(state.cleared)setNote('SIGNAL RESTORED',chapter().ending);
else if(state.moves)setNote('FIELD NOTE','Your waterline and recovered tools are where you left them.');
else setNote('FIELD NOTE',chapter().opening);
attach();syncMode();restartFrame();
