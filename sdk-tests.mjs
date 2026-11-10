import assert from 'node:assert/strict';
import {bridge} from './sdk.mjs';
import * as C from './core.mjs';
let checks=0,now=0,next=0,tasks=new Map();const ok=(v,m)=>{assert(v,m);checks++;},schedule=(fn,ms)=>{let id=++next;tasks.set(id,{fn,at:now+ms});return id;},cancel=id=>tasks.delete(id),drain=async()=>{for(let i=0;i<12;i++)await Promise.resolve();},advance=async ms=>{let end=now+ms;for(let limit=0;limit<1000;limit++){let row=[...tasks.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!row)break;now=row[1].at;tasks.delete(row[0]);row[1].fn();await drain();}now=end;await drain();};
let host=null,p=C.profile(),claims=0,starts=0,ends=0,off=0,writes=[],like,comment,resolveLike;
const make=()=>bridge({host:()=>host,read:()=>p,write:(v,merge)=>p=merge?C.mergeProfile(p,v):C.profile(v),changed:e=>{if(e.type==='reward')claims++;},schedule,cancel,timeout:100});
let b=make();ok(!b.support().like,'absent host safe');b.start();await advance(13000);host={gameStart:()=>starts++,gameOver:()=>ends++,onLike:async cb=>(like=cb,{code:0,data:{unsubscribe:()=>off++}}),onComment:async cb=>(comment=cb,{code:0,data:{unsubscribe:()=>off++}}),loadUserGameState:async()=>({}),saveUserGameState:async data=>(writes.push(data),{code:0}),getGameViewport:()=>({width:390,height:844,density:3.5})};b.connect();await drain();ok(starts===1,'very late host receives already committed round once');b.start();b.connect();ok(starts===1,'start dedup');ok(b.viewport().width===390&&b.viewport().density===3.5,'density separate from logical viewport');
like({project_id:'long-id',status:false,count:99});like({project_id:' ',status:true});like({project_id:123,status:true});like({data:{project_id:'long-id',status:true}});comment({project_id:'long-id',data:{content:'nested'}});ok(claims===0,'unlike, numeric/blank ID, nested and malformed events rejected');like({project_id:'1234567890123456789',status:true,count:0});like({project_id:'1234567890123456789',status:true,count:100});comment({project_id:'1234567890123456789',content:'',count:0});comment({project_id:'1234567890123456789',content:'again',count:0});await drain();ok(claims===2&&p.rewards.like&&p.rewards.comment,'positive like and image-only direct comment deduped independent of count');b.save();await drain();ok(writes.length&&writes.at(-1).game==='low-tide-signal'&&!('active' in writes.at(-1)),'only own profile cloud envelope; local active owned separately');b.end();b.end();ok(ends===1,'one real end');b.stop();like({project_id:'new',status:true});ok(off===2&&claims===2,'cleanup and stale callback guard');
host={onLike:()=>new Promise(r=>resolveLike=r)};b=make();b.stop();resolveLike({code:0,data:{unsubscribe:()=>off++}});await drain();ok(off===3,'late successful registration after disposal unsubscribed');
host={onLike:async()=>({code:-6}),onComment:()=>{throw Error('unsupported');},gameStart:()=>Promise.reject(Error('start failure')),gameOver:()=>Promise.reject(Error('end failure'))};b=make();b.start();b.end();await drain();ok(!b.support().like&&!b.support().comment,'partial/throwing/rejected APIs safe');b.stop();
let expiredCallback,expiredOff=0;host={onLike:cb=>(expiredCallback=cb,new Promise(r=>resolveLike=r))};p=C.profile();b=make();await advance(150);resolveLike({code:0,data:{unsubscribe:()=>expiredOff++}});await drain();expiredCallback({project_id:'expired',status:true});ok(expiredOff===1&&!p.rewards.like,'timeout and late unsubscribe');b.stop();
let attempts=0;host={onLike:async()=>{attempts++;return{code:-6};}};b=make();await drain();for(let i=0;i<15;i++)b.connect();await drain();ok(attempts===1,'unsupported registration not retried on every input');b.stop();
let badSaves=0;host={loadUserGameState:async()=>({game:'another-game',v:1,profile:{stars:[3]}}),saveUserGameState:async()=>{badSaves++;return{code:0};}};b=make();b.save();await drain();ok(badSaves===0,'unrecognized cloud state never overwritten');b.stop();
let resolveLoad;host={loadUserGameState:()=>new Promise(r=>resolveLoad=r),saveUserGameState:()=>Promise.reject(Error('save failure'))};b=make();b.save();await advance(150);resolveLoad({});await drain();ok(true,'expired load result ignored without blocking runtime');b.stop();
let rejectedSaves=0;host={loadUserGameState:async()=>({}),saveUserGameState:()=>{rejectedSaves++;return Promise.reject(Error('save rejected'));}};b=make();await drain();b.save();await drain();ok(rejectedSaves===1,'actual asynchronous save rejection is handled');b.stop();
let failedSaves=0;host={loadUserGameState:async()=>({}),saveUserGameState:async()=>{failedSaves++;return{code:-6};}};b=make();await drain();b.save();await drain();ok(failedSaves===1,'nonzero save result does not erase local profile');b.stop();
let ownCloud;host={loadUserGameState:async()=>({game:'low-tide-signal',v:1,hostNote:'preserve',profile:{best:[2,3],rewards:{comment:true}}}),saveUserGameState:async v=>(ownCloud=v,{code:0})};p=C.profile({best:[3,1],mute:true});b=make();await drain();b.save();await drain();ok(p.best[0]===3&&p.best[1]===3&&p.mute,'recognized own cloud merges best progress, preserves local settings');ok(ownCloud.hostNote==='preserve'&&ownCloud.game==='low-tide-signal'&&ownCloud.profile.rewards.comment,'own host metadata and durable claim retained');b.stop();
let newLikes=0;host={onLike:async cb=>(like=cb,{code:0,data:{unsubscribe:()=>newLikes++}})};p=C.profile({rewards:{like:true}});b=make();await drain();like({project_id:'same',status:true});ok(claims===2,'already-claimed local/cloud flag guards new registration');host={onComment:async cb=>(comment=cb,{code:0,data:{unsubscribe:()=>newLikes++}})};b.connect();await drain();ok(newLikes===1,'host replacement cleans old listeners');b.stop();ok(newLikes===2,'replacement listener cleaned');
let pendingSave, saveAttempts=0;
host={
  loadUserGameState:async()=>({}),
  saveUserGameState:()=>++saveAttempts===1?new Promise(resolve=>pendingSave=resolve):Promise.resolve({code:0}),
};
b=make();await drain();b.save();await advance(120);b.connect();await drain();
ok(saveAttempts===1,'timed-out saves do not overlap a still-pending write');
pendingSave({code:0});await drain();ok(saveAttempts===2,'late settled save allows the newest local profile to flush');b.stop();
let endOnly=0;
host={gameOver:()=>endOnly++};b=make();b.start();b.end();b.end();
ok(endOnly===1,'end-only partial host gets the actual terminal event once');b.stop();
host={getGameViewport:()=>Promise.reject(Error('viewport failure'))};b=make();
ok(b.viewport()===null,'rejected asynchronous viewport falls back to browser dimensions');await drain();b.stop();
console.log(JSON.stringify({checks,scope:'SDK mock registration, persistence, failures and cleanup'}));



