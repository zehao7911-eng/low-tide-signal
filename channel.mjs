const kinds={shoal:'Hold · Clear the shoal',bridge:'Release · Duck the bridge',buoy:'Hold · Ring the buoy'};
const make=(name,speed,pattern)=>({name,speed,gates:pattern.map(([kind,x])=>({kind,x,label:kinds[kind]}))});
export const COURSES=[
  make('Ferry Run',2.2,[['shoal',4],['bridge',8],['buoy',12],['shoal',16],['bridge',20]]),
  make('Bellwater',2.4,[['bridge',3.8],['shoal',7],['buoy',9.7],['bridge',13],['shoal',17],['bridge',21]]),
  make('Net Race',2.6,[['shoal',4],['shoal',7],['bridge',10.1],['buoy',13.4],['bridge',16.6],['shoal',20],['bridge',23.6]]),
  make('Salt Channel',2.75,[['buoy',4],['bridge',6.8],['shoal',9.8],['bridge',13],['buoy',16.1],['shoal',19.3],['bridge',22.5]]),
  make('Mill Rush',3,[['shoal',4],['bridge',6.9],['shoal',9.8],['buoy',12.5],['bridge',15.5],['shoal',18.4],['bridge',21.5],['shoal',24.7]]),
  make('Last Light Sprint',3.25,[['bridge',4],['shoal',7.2],['bridge',10.4],['buoy',13.4],['shoal',16.2],['bridge',19.2],['shoal',22.2],['bridge',25.2],['buoy',28.4]])
];
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export const runUnlocked=p=>Math.min(COURSES.length-1,Math.max(0,p.runs.indexOf(0)<0?COURSES.length-1:p.runs.indexOf(0)));
export const runEnd=i=>COURSES[i].gates.at(-1).x+1.8;
export function newRun(i=0){
  return {i,x:0,water:.14,g:0,hits:0,bells:0,chain:0,bestChain:0,points:0,slow:0,phase:'ready'};
}
export function restoreRun(raw,profile){
  if(!raw||!Number.isInteger(raw.i)||raw.i<0||raw.i>runUnlocked(profile))return newRun(runUnlocked(profile));
  const s=newRun(raw.i), course=COURSES[s.i];
  const read=(key,max)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])?limit(raw[key],0,max):s[key];
  s.x=read('x',runEnd(s.i));
  s.water=read('water',1);
  s.g=course.gates.filter(g=>g.x<=s.x).length;
  for(const key of ['hits','bells','chain','bestChain','points'])s[key]=Math.floor(read(key,key==='points'?9999:course.gates.length));
  s.slow=read('slow',.48);
  s.phase=s.hits>=2?'wreck':raw.phase==='clear'&&s.x>=runEnd(s.i)?'clear':s.x>0?'paused':'ready';
  return s;
}
export function stepRun(s,dt,held){
  if(s.phase!=='run')return null;
  const course=COURSES[s.i];
  const height=held ? .94 : .13;
  s.water+=(height-s.water)*(1-Math.exp(-dt*(held?3.65:4.25)));
  s.slow=Math.max(0,s.slow-dt);
  s.x=Math.min(runEnd(s.i),s.x+dt*course.speed*(s.slow>.001 ? .55 : 1));
  const gate=course.gates[s.g];
  if(gate&&s.x>=gate.x){
    s.g++;
    const hit=gate.kind==='bridge'?s.water>.47:gate.kind==='shoal'?s.water<.6:false;
    if(hit){
      s.hits++;s.chain=0;s.slow=.48;
      if(s.hits>=2){s.phase='wreck';return {type:'wreck',kind:gate.kind};}
      return {type:'bump',kind:gate.kind};
    }
    if(gate.kind==='buoy'&&s.water<.64)return {type:'miss'};
    if(gate.kind==='buoy')s.bells++;
    s.chain++;
    s.bestChain=Math.max(s.bestChain,s.chain);
    const trim=gate.kind==='bridge'?s.water>=.19&&s.water<=.34:gate.kind==='shoal'&&s.water>=.68&&s.water<=.83;
    s.points+=100+Math.min(5,s.chain-1)*25+(gate.kind==='buoy'?100:0)+(trim?75:0);
    return {type:gate.kind==='buoy'?'bell':trim?'trim':'pass',chain:s.chain};
  }
  if(s.x>=runEnd(s.i)){s.phase='clear';return {type:'finish'};}
  return null;
}
export function runStars(s){
  const possible=COURSES[s.i].gates.filter(g=>g.kind==='buoy').length;
  return 1+Number(s.hits<=1)+Number(s.hits===0&&s.bells===possible);
}
