import {HarborView} from './art.mjs';

const Three=globalThis.THREE;
const lineZ=1.2;
const waterY=n=>n*1.58-.5;

export class ChannelView extends HarborView {
  resize(){
    if(!this.renderer)return;
    const w=this.canvas.clientWidth||1,h=this.canvas.clientHeight||1;
    const width=Math.max(8.5,Math.min(16,w/h*6.6)),height=width*h/w;
    this.camera.left=-width/2;this.camera.right=width/2;
    this.camera.top=height/2;this.camera.bottom=-height/2;
    this.camera.position.set(6.5,12,24);this.camera.lookAt(1.1,.52,0);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.renderer.setSize(w,h,false);
  }
  buildRoute(s,ch,course){
    this.index=s.i;this.root.clear();
    const b=this.root;
    this.scene.background=new Three.Color(ch.sky);
    this.scene.fog=new Three.Fog(ch.sky,24,46);
    this.createWater(ch);
    this.gates=course.gates.map((gate,i)=>this.gate(gate,i));
    this.finish=new Three.Group();b.add(this.finish);
    this.box(this.finish,0,.02,0,.07,.13,4,'ivory');
    for(const z of [-1,3.5]){
      this.tube(this.finish,0,.68,z,.075,2.82,'iron');
      this.lantern(this.finish,0,2.18,z,'green');
    }
    for(let i=0;i<8;i++)this.box(this.finish,0,2.26,-1+i*.64,.13,.29,.57,i%2?'iron':'ivory');
    this.docks=[];
    for(let i=0;i<7;i++){
      const group=new Three.Group();b.add(group);
      const z=-4.15-(i%2)*.6;
      this.box(group,0,.23,z,4.2,1.32,3.1,'stone');
      this.box(group,0,.92,z,4.28,.13,3.23,'deck');
      const tall=1.4+(i%3)*.35;
      this.box(group,-.16,1.14+tall/2,z,2.71,tall,1.8,i%2?'wood':'roof');
      this.gable(group,-.16,tall+1.24,z,3.12,.63,2.1);
      for(const x of [-.89,.08,.99]){
        this.box(group,x,1.82,z+.918,.41,.46,.055,'iron');
        this.box(group,x,1.82,z+.96,.27,.31,.036,i%3?'glow':'bulbOff');
      }
      this.tube(group,1.67,1.52,z+1.22,.06,1.32,'iron');
      this.lantern(group,1.67,2.25,z+1.22);
      this.docks.push(group);
    }
    this.craft=this.boat(-1.52,lineZ,.56);
    this.wake=[];
    for(let i=0;i<11;i++){
      const group=new Three.Group();b.add(group);
      const trail=this.box(group,0,0,0,.24,.015,.023,'foam');trail.rotation.y=(i%2?-1:1)*.48;
      this.wake.push(group);
    }
    this.rain.visible=false;
    this.resize();
  }
  gate(gate,i){
    const g=new Three.Group();g.position.z=lineZ;this.root.add(g);
    const meta={g,gate,bob:null};
    if(gate.kind==='bridge'){
      for(const z of [-1.08,1.08]){
        this.box(g,0,.25,z,.36,1.85,.36,'iron');
        this.box(g,0,1.29,z,.54,.23,.54,'trim');
        this.lantern(g,0,1.56,z);
      }
      this.box(g,0,1.16,0,.41,.22,2.4,'red');
      for(let j=0;j<7;j++){
        const stripe=this.box(g,-.213,1.16,-.99+j*.33,.02,.095,.135,'ivory');
        stripe.rotation.x=.53;
      }
    }else if(gate.kind==='shoal'){
      for(let j=0;j<5;j++){
        const x=(j%2)*.23-.115,z=-.73+j*.37;
        this.tube(g,x,-.03,z,.31,.73+(j%2)*.13,'ledge',.59,5).rotation.y=i+j*.8;
        this.box(g,x,.34+(j%2)*.06,z,.19,.022,.18,'foam');
      }
      this.tube(g,-.25,.54,-1.09,.07,1.18,'iron');
      this.lantern(g,-.25,1.17,-1.09,'green');
    }else{
      meta.bob=new Three.Group();g.add(meta.bob);
      this.tube(meta.bob,0,.02,0,.26,.23,'copper',.67,10);
      this.lantern(meta.bob,0,.32,0);
      this.tube(g,0,.19,-.97,.05,1.67,'iron');
      this.box(g,0,1.02,-.72,.09,.06,.58,'copper');
    }
    return meta;
  }
  renderRun(s,ch,course,finish,dt,reduced,rewards){
    if(s.i!==this.index)this.buildRoute(s,ch,course);
    this.time+=reduced?0:dt;
    const t=this.time,y=waterY(s.water);
    this.water.position.y=y;
    this.water.material.uniforms.clock.value=t+s.x*.26;
    const impact=s.slow/.48;
    this.craft.position.y=y+.071;
    this.craft.rotation.z=impact*Math.sin(t*27)*.18+(reduced?0:Math.sin(t*2.1)*.044);
    for(const [i,prop] of this.gates.entries()){
      const x=prop.gate.x-s.x-1.52;
      prop.g.position.x=x;
      prop.g.visible=x>-8&&x<15;
      if(prop.bob){
        prop.bob.position.y=.76+.067*Math.sin(t*3+i);
        prop.bob.rotation.z=.13*Math.sin(t*3+i);
        prop.bob.visible=i>=s.g;
      }
    }
    for(const [i,d] of this.docks.entries())d.position.x=-15+i*4.7-(s.x*.44)%4.7;
    this.finish.position.x=finish-s.x-1.52;
    for(const [i,w] of this.wake.entries()){
      const wave=(s.x*.42+i/11)%1,side=i%2?1:-1;
      w.position.set(-2.02-wave*1.82,y+.024,lineZ+side*(.21+wave*.7));
      w.scale.setScalar(.52+wave*.7);
      w.visible=s.phase==='run';
    }
    this.materials.glow.color.setHex(rewards.like?0xff8f57:0xffcb79);
    this.renderer.render(this.scene,this.camera);
  }
}
