import assert from 'node:assert/strict';
import * as C from './core.mjs';

const p=C.profile();
let states=0;
for(const [index,ch] of C.CHAPTERS.entries()){
  assert.equal(C.unlocked(p),index);
  const queue=[{s:C.create(index),actions:[]}], visited=new Set();
  let perfect;
  while(queue.length){
    const {s,actions}=queue.shift();
    const key=s.tide+'|'+s.done.slice().sort().join(',');
    if(visited.has(key))continue;
    visited.add(key);states++;
    if(s.cleared){
      if(s.stars===3)perfect??=actions;
      continue;
    }
    for(let t=0;t<3;t++){
      const next=structuredClone(s);
      if(C.setTide(next,t))queue.push({s:next,actions:[...actions,t]});
    }
    for(const point of ch.points){
      const next=structuredClone(s);
      const local=C.profile({best:p.best,relics:C.CHAPTERS.map((_,i)=>i===index&&s.done.includes('relic'))});
      const result=C.interact(next,point.id,local);
      if(result.ok)queue.push({s:next,actions:[...actions,point.id]});
      else assert.deepEqual(next,s);
    }
  }
  assert.ok(perfect,ch.name+' is solvable with its keepsake');
  let s=C.create(index);
  for(const action of perfect){
    if(typeof action==='number')assert.equal(C.setTide(s,action),true);
    else assert.equal(C.interact(s,action,p).ok,true);
    s=C.restore(JSON.parse(JSON.stringify(s)),p);
  }
  assert.equal(s.stars,3);
  assert.equal(C.setTide(s,(s.tide+1)%3),false);
  assert.equal(C.interact(s,ch.points.find(x=>x.finish).id,p).ok,false);
  assert.ok(p.relics[index]);
  s=C.create(index);
  assert.ok(C.guide(s));
  for(const action of perfect){
    if(typeof action==='number')C.setTide(s,action);
    else C.interact(s,action,p);
  }
  assert.equal(s.stars,2);
  assert.equal(p.best[index],3);
}
assert.deepEqual(p.best,[3,3,3,3,3,3]);
const corrupt=C.restore({index:5,tide:999,done:['mount','lamp','lens','lens','alien']},p);
assert.equal(corrupt.cleared,false);
assert.deepEqual(corrupt.done,['lens']);
assert.equal(C.setTide(corrupt,1.5),false);
const merged=C.mergeProfile({...p,mute:true},{rewards:{like:true},best:[0,0,0,1]});
assert.deepEqual(merged.best,p.best);
assert.equal(merged.mute,true);
assert.equal(merged.rewards.like,true);
console.log('PASS '+states+' reachable states, six perfect routes, save restoration, no duplicate clears and profile merge.');
