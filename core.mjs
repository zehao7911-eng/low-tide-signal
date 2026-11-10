export const TIDES = ['Low', 'Slack', 'High'];
const tool = (id, name, pos, tide, description) => ({id, name, pos, tide, description, take:true});
const station = (id, name, pos, tide, description, needs=[], finish=false) =>
  ({id, name, pos, tide, description, needs, finish});
const relic = (name, pos, tide) => ({id:'relic',name,pos,tide,relic:true,description:'A keepsake for your harbor log.'});
export const CHAPTERS = [
  {
    name:'Last Ferry', district:'The outer pier', initial:2, sky:'#162136', sea:'#32586b', light:'#ffaf57',
    opening:'Lower the tide to find the key that fell off the ferry.',
    ending:'A bridge rolls over the gap. The ferry can leave.',
    points:[
      tool('key','Brass key',[-2.8,-.46,2.02],0,'The tide has exposed the missing key.'),
      station('gate','Bridge crank',[2.8,.65,-.4],null,'A key fits the crank that extends the boarding bridge.',['key'],true),
      relic('Ferry token',[.2,-.09,2.55],1)
    ]
  },
  {
    name:'Fog Bell', district:'The outer pier', initial:0, sky:'#233147', sea:'#3b6b74', light:'#ffbc73',
    opening:'A signal float has the missing bell weight. Raise it to the landing.',
    ending:'The fog bell rings across the harbor. A boat answers.',
    points:[
      tool('weight','Signal float',[-2.7,.33,1.15],2,'The floating weight is within reach.'),
      station('bell','Fog bell',[.9,.8,-1.2],1,'The bell rope hangs over the slack-water step.',['weight'],true),
      relic('Enamel badge',[2.6,-.63,2],0)
    ]
  },
  {
    name:'Net Loft', district:'The fishing quarter', initial:1, sky:'#22243c', sea:'#3e5268', light:'#ffa976',
    opening:'The raft covers the tool hatch. Catch it while it floats.',
    ending:'The net lift comes alive and draws the trawler clear.',
    points:[
      station('latch','Raft latch',[-2.8,.54,-.2],2,'At high water, the raft reaches the latch.'),
      {...tool('spanner','Tool hatch',[-.2,-.63,1.35],0,'The pinned raft leaves the hatch clear.'),needs:['latch']},
      station('winch','Net lift',[2.8,.75,-1.2],null,'The lift needs a spanner to release its lock.',['spanner'],true),
      relic('Glass bead',[2.3,-.05,2.25],1)
    ]
  },
  {
    name:'Saltworks', district:'The fishing quarter', initial:2, sky:'#312a44', sea:'#535b77', light:'#ff9e67',
    opening:'Two fuses are missing. Each washed onto a different ledge.',
    ending:'The green lamps come on. The salt sheds have power.',
    points:[
      tool('blue','Blue fuse',[-2.8,-.46,2.02],0,'The blue fuse lies on the bottom step.'),
      tool('amber','Amber fuse',[2.6,-.07,1.85],1,'A small shelf keeps the amber fuse just above slack water.'),
      station('power','Fuse cabinet',[0,.8,-1.15],null,'Both fuses are needed to power the cabinet.',['blue','amber'],true),
      relic('Salt stamp',[-.1,.53,2.55],2)
    ]
  },
  {
    name:'Floodmill', district:'North headland', initial:1, sky:'#142e41', sea:'#367380', light:'#ffd087',
    opening:'The mill stopped when its drive belt slipped into the channel.',
    ending:'The wheel catches the current and the sluice opens.',
    points:[
      tool('belt','Drive belt',[-2.5,-.61,1.55],0,'The drive belt is clear of the water.'),
      station('tension','Belt tensioner',[.1,.09,.65],1,'Fit the belt from the middle landing.',['belt']),
      station('mill','Mill wheel',[3.15,.8,-.85],2,'High water can turn the wheel once the belt is fitted.',['tension'],true),
      relic('Carved gull',[-.5,.46,2.6],2)
    ]
  },
  {
    name:'Last Light', district:'North headland', initial:2, sky:'#212341', sea:'#525e88', light:'#f8b272',
    opening:'The lighthouse is dark. Find its lens and set the generator.',
    ending:'The light sweeps the bay. The last ferry finds its way home.',
    points:[
      tool('lens','Glass lens',[-2.8,-.46,2.02],0,'The tide has revealed the lost lens.'),
      station('mount','Lens cradle',[.2,.08,1],1,'The cradle sits on the middle landing.',['lens']),
      station('lamp','Light switch',[2.75,.84,-1.5],2,'The generator needs high water and a mounted lens.',['mount'],true),
      relic('Captain’s pin',[2.9,-.1,2.25],1)
    ]
  }
];

const range = (v, max) => Number.isInteger(v) ? Math.max(0,Math.min(max,v)) : 0;
export function profile(raw={}) {
  raw ||= {};
  return {
    best:CHAPTERS.map((_,i)=>range(raw.best?.[i],3)),
    relics:CHAPTERS.map((_,i)=>raw.relics?.[i]===true),
    runs:CHAPTERS.map((_,i)=>range(raw.runs?.[i],3)),
    scores:CHAPTERS.map((_,i)=>range(raw.scores?.[i],9999)),
    mute:raw.mute===true,
    rewards:{like:raw.rewards?.like===true,comment:raw.rewards?.comment===true}
  };
}
export function mergeProfile(local, remote) {
  const a=profile(local), b=profile(remote);
  return profile({best:a.best.map((v,i)=>Math.max(v,b.best[i])),relics:a.relics.map((v,i)=>v||b.relics[i]),
    runs:a.runs.map((v,i)=>Math.max(v,b.runs[i])),scores:a.scores.map((v,i)=>Math.max(v,b.scores[i])),
    mute:a.mute,rewards:{like:a.rewards.like||b.rewards.like,comment:a.rewards.comment||b.rewards.comment}});
}
export function unlocked(p) {
  const open=p.best.findIndex(n=>n===0);
  return open<0?CHAPTERS.length-1:open;
}
export function create(index=0) {
  index=range(index,CHAPTERS.length-1);
  return {index,tide:CHAPTERS[index].initial,done:[],guided:false,cleared:false,moves:0,stars:0};
}
export function restore(raw,p) {
  if(!raw||!Number.isInteger(raw.index)||raw.index<0||raw.index>unlocked(p))return create(unlocked(p));
  const s=create(raw.index), points=CHAPTERS[s.index].points;
  if(Number.isInteger(raw.tide)&&raw.tide>=0&&raw.tide<=2)s.tide=raw.tide;
  if(Array.isArray(raw.done)){
    for(const id of raw.done){
      const point=points.find(x=>x.id===id);
      if(point&&!s.done.includes(id)&&(point.needs||[]).every(n=>s.done.includes(n)))s.done.push(id);
    }
  }
  s.guided=raw.guided===true;
  s.cleared=s.done.includes(points.find(x=>x.finish).id)&&p.best[s.index]>0;
  if(!s.cleared)s.done=s.done.filter(id=>!points.find(x=>x.id===id).finish);
  s.moves=range(raw.moves,9999);
  s.stars=s.cleared?range(raw.stars,3)||1:0;
  return s;
}
export function setTide(s,tide) {
  if(s.cleared||!Number.isInteger(tide)||tide<0||tide>2||tide===s.tide)return false;
  s.tide=tide;
  s.moves++;
  return true;
}
export function inspect(s,id) {
  const point=CHAPTERS[s.index].points.find(x=>x.id===id);
  if(!point||s.cleared||s.done.includes(id))return {ok:false,text:'Already handled.'};
  const blocked=(point.needs||[]).filter(n=>!s.done.includes(n));
  if(blocked.length){
    const names=blocked.map(n=>CHAPTERS[s.index].points.find(p=>p.id===n).name);
    return {ok:false,text:'Needs '+names.join(' and ')+'.'};
  }
  if(point.tide!==null&&point.tide!==s.tide)return {ok:false,text:'Set the tide to '+TIDES[point.tide].toLowerCase()+'.'};
  return {ok:true,point,text:point.description};
}
export function interact(s,id,p) {
  const result=inspect(s,id);
  if(!result.ok)return result;
  const {point}=result;
  s.done.push(id);
  s.moves++;
  if(point.relic)p.relics[s.index]=true;
  if(point.finish){
    s.cleared=true;
    s.stars=1+Number(!s.guided)+Number(p.relics[s.index]);
    p.best[s.index]=Math.max(p.best[s.index],s.stars);
  }
  return result;
}
export function guide(s) {
  if(s.cleared)return null;
  s.guided=true;
  const point=CHAPTERS[s.index].points.find(x=>!x.relic&&!s.done.includes(x.id)&&(x.needs||[]).every(n=>s.done.includes(n)));
  return point?{id:point.id,text:point.tide===null||s.tide===point.tide?'Inspect '+point.name+'.':'Set '+TIDES[point.tide].toLowerCase()+' tide, then inspect '+point.name+'.'}:null;
}
