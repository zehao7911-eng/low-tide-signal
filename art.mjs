const T = globalThis.THREE;
const SEA = [-.86,-.34,.19];
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));

function painted(a,b,c,seed) {
  const tile=document.createElement('canvas');
  tile.width=128;tile.height=128;
  const g=tile.getContext('2d');
  g.fillStyle=a;g.fillRect(0,0,128,128);
  let n=seed;
  const r=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  for(let i=0;i<360;i++){
    g.fillStyle=i%3===0?b:c;g.globalAlpha=.08+r()*.27;
    const x=r()*128,y=r()*128;
    g.fillRect(x,y,2+r()*35,1+r()*5);
  }
  g.globalAlpha=1;
  const tex=new T.CanvasTexture(tile);
  tex.encoding=T.sRGBEncoding;tex.magFilter=T.NearestFilter;
  return tex;
}

export class HarborView {
  constructor(canvas){
    this.canvas=canvas;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.outputEncoding=T.sRGBEncoding;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
    this.scene=new T.Scene();
    this.camera=new T.OrthographicCamera(-6,6,5,-5,.1,105);
    this.scene.add(new T.HemisphereLight(0xc3ddff,0x51475d,.86));
    const lantern=new T.DirectionalLight(0xffad65,1.09);
    lantern.position.set(-3,8,6);this.scene.add(lantern);
    const rim=new T.DirectionalLight(0x8ab3ff,.52);
    rim.position.set(5,4,-8);this.scene.add(rim);
    this.root=new T.Group();this.scene.add(this.root);
    this.index=-1;this.waterY=SEA[2];this.time=0;
    this.materials={};
    const m=(name,color,map,roughness=.83)=>{
      this.materials[name]=new T.MeshStandardMaterial({color,map:map||null,roughness});
    };
    m('stone',0xd2c6b5,painted('#676477','#a2948c','#3e4254',8));
    m('ledge',0xd4cfbd,painted('#6c7980','#8a9c8e','#48505e',12));
    m('wood',0xf6c1a5,painted('#685048','#a47755','#403745',10));
    m('deck',0xffd1a0,painted('#7a5649','#a87854','#4c3d45',28));
    m('roof',0xcda3a8,painted('#4c475a','#655973','#2c3547',44));
    m('iron',0x334453);m('trim',0x9b6550);m('ivory',0xf2d6a9);m('shadow',0x292838);
    m('copper',0xc68b53);m('red',0xb84d45);m('teal',0x39938d);m('blue',0x57c9e7);m('amber',0xffab4f);
    m('foam',0x96d8d7);m('shelf',0x9e8178);m('flag',0xf5c674);
    this.materials.glow=new T.MeshBasicMaterial({color:0xffcb79});
    this.materials.green=new T.MeshBasicMaterial({color:0x9bf5bf});
    this.materials.bulbOff=new T.MeshBasicMaterial({color:0x655a60});
    this.materials.mist=new T.MeshBasicMaterial({color:0x80bdd1,transparent:true,opacity:.19,depthWrite:false});
    this.materials.mist.opacity=.24;
    this.unit=new T.BoxGeometry(1,1,1);
    this.tubes=new Map();
    this.rain=this.makeRain();
    this.scene.add(this.rain);
    this.resize();
  }
  shape(parent,geometry,x,y,z,sx,sy,sz,mat){
    const mesh=new T.Mesh(geometry,this.materials[mat]);
    mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  box(parent,x,y,z,w,h,d,mat){return this.shape(parent,this.unit,x,y,z,w,h,d,mat);}
  tube(parent,x,y,z,w,h,mat,top=1,segments=12){
    const key=top+':'+segments;
    if(!this.tubes.has(key))this.tubes.set(key,new T.CylinderGeometry(top,1,1,segments));
    return this.shape(parent,this.tubes.get(key),x,y,z,w,h,w,mat);
  }
  wheel(parent,x,y,z,r,mat='copper',n=6){
    const g=new T.Group();g.position.set(x,y,z);parent.add(g);
    const segments=24,key='ring'+r;
    if(!this.tubes.has(key))this.tubes.set(key,new T.TorusGeometry(r,.048,6,segments));
    this.shape(g,this.tubes.get(key),0,0,0,1,1,1,mat);
    for(let i=0;i<n;i++){
      const arm=this.box(g,0,0,0,.07,2*r,.07,mat);arm.rotation.z=Math.PI*i/n;
    }
    const hub=this.tube(g,0,0,0,r*.2,.18,'iron');
    hub.rotation.x=Math.PI/2;return g;
  }
  lantern(parent,x,y,z,lampMat='glow'){
    this.box(parent,x,y-.13,z,.28,.11,.28,'iron');
    this.box(parent,x,y+.16,z,.28,.10,.28,'iron');
    const bulb=this.box(parent,x,y,z,.2,.23,.2,lampMat);
    for(const a of [-1,1])for(const b of [-1,1])this.box(parent,x+a*.113,y,z+b*.113,.028,.28,.028,'iron');
    return bulb;
  }
  gable(parent,x,y,z,w,h,d){
    for(const side of [-1,1]){
      const panel=this.box(parent,x+side*w*.24,y,z,w*.58,.12,d,'roof');
      panel.rotation.z=-side*Math.atan2(h,w*.49);
      for(let i=0;i<6;i++){
        const seam=this.box(parent,x+side*w*.24,y+.06,z-d*.44+i*d*.165,w*.58,.025,.027,'trim');
        seam.rotation.z=panel.rotation.z;
      }
    }
  }
  shed(x,z,w,d,tall=1.8){
    const b=this.root;
    this.box(b,x,tall/2+.52,z,w,tall,d,'wood');
    for(let i=0;i<Math.floor(w/.27);i++)this.box(b,x-w*.47+i*.27,tall/2+.52,z+d*.505,.026,tall,.025,'trim');
    this.box(b,x,.9,z+d*.52,.55,.76,.1,'iron');
    this.box(b,x+w*.28,1.53,z+d*.52,.48,.49,.1,'iron');
    this.box(b,x+w*.28,1.53,z+d*.58,.34,.35,.035,'glow');
    this.box(b,x+w*.28,1.53,z+d*.61,.045,.35,.045,'iron');
    this.gable(b,x,tall+.74,z,w+.34,.58,d+.43);
  }
  boat(x,z,scale=1){
    const g=new T.Group();g.scale.setScalar(scale);g.position.set(x,0,z);this.root.add(g);
    this.box(g,0,.04,0,2.6,.5,.93,'red');
    const bow=this.tube(g,1.29,.055,0,.47,.5,'red',1,5);bow.rotation.y=Math.PI*.3;
    this.box(g,0,.36,0,2.52,.16,1.01,'ivory');
    this.box(g,-.4,.7,0,1.12,.57,.73,'wood');
    this.box(g,-.4,1.02,0,1.27,.14,.84,'roof');
    this.box(g,-.42,.76,.378,.73,.23,.03,'glow');
    this.box(g,-.39,.76,.397,.055,.26,.05,'iron');
    this.tube(g,.74,.73,0,.048,1,'trim');
    this.lantern(g,.74,1.33,0);
    return g;
  }
  tower(x,z){
    const b=this.root;
    this.tube(b,x,1.65,z,.89,2.35,'stone',.62,10);
    for(const y of [1.02,1.82,2.49])this.tube(b,x,y,z,.86-(y-.5)*.12,.14,'red',.985,10);
    this.tube(b,x,2.91,z,.72,.17,'iron',1,10);
    this.tube(b,x,3.2,z,.54,.48,'bulbOff',1,10);
    this.towerLamp=b.children.at(-1);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;this.box(b,x+Math.sin(a)*.55,3.21,z+Math.cos(a)*.55,.055,.5,.055,'iron');
    }
    this.tube(b,x,3.55,z,.78,.33,'roof',.18,10);
    this.tube(b,x,3.79,z,.05,.25,'copper');
    this.beamGeometry=new T.ConeGeometry(.86,9,18,1,true);
    this.beam=this.shape(b,this.beamGeometry,x,3.22,z,1,1,1,'mist');this.beam.visible=false;
  }
  createWater(ch){
    if(this.water){
      this.scene.remove(this.water);this.water.geometry.dispose();this.water.material.dispose();
    }
    const geo=new T.PlaneGeometry(66,66,52,52);
    geo.rotateX(-Math.PI/2);
    const mat=new T.ShaderMaterial({
      uniforms:{clock:{value:0},tint:{value:new T.Color(ch.sea)},glint:{value:new T.Color(ch.light)}},
      vertexShader:`
        uniform float clock;
        varying vec3 world;
        void main(){vec3 p=position; p.y+=sin(p.x*2.1+p.z*.48+clock*1.2)*.035+sin(p.z*3.2-clock*1.7)*.022;
          world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}
      `,
      fragmentShader:`
        uniform float clock;
        uniform vec3 tint,glint;
        varying vec3 world;
        void main(){
          vec2 q=floor(world.xz*54.)/54.;
          float bands=sin(q.y*8.0+sin(q.x*1.48+clock*.42)*1.7+sin(q.y*.68+q.x*.39)*1.7-clock*1.25);
          float small=sin(q.x*7.2+q.y*11.0+clock*1.6);
          float crest=smoothstep(.83,1.,bands)*smoothstep(.16,.85,small);
          float wash=exp(-abs(q.x+1.65+sin(q.y*2.-clock)*.32)*1.25)*smoothstep(-7.,-2.,q.y);
          float breaks=smoothstep(-.45,.55,sin(q.y*17.0-clock*2.+q.x*.5));
          float shade=.41+.18*bands+.07*small;
          vec3 water=tint*shade*.69+vec3(.009,.018,.036)+vec3(.068,.13,.17)*crest+glint*wash*breaks*.22;
          gl_FragColor=vec4(water,1.);
          #include <encodings_fragment>
        }
      `
    });
    this.water=new T.Mesh(geo,mat);this.scene.add(this.water);
  }
  makeRain(){
    const a=new Float32Array(90*6);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(a,3));
    const m=new T.LineBasicMaterial({color:0x9fc4dc,transparent:true,opacity:.25,depthWrite:false});
    const rain=new T.LineSegments(geo,m);rain.frustumCulled=false;return rain;
  }
  build(index,ch,tide){
    this.flagGeometry?.dispose();
    this.beamGeometry?.dispose();
    this.beamGeometry=null;
    this.root.clear();this.index=index;this.props=new Map();this.boats=[];this.beam=null;this.towerLamp=null;
    this.scene.background=new T.Color(ch.sky);
    this.scene.fog=new T.Fog(ch.sky,25,48);
    this.waterY=SEA[tide];this.createWater(ch);
    const b=this.root;
    this.box(b,0,.02,-12,36,1.39,5,'stone');
    for(let i=0;i<12;i++){
      const height=.7+((i*13)%7)*.29;
      const x=-17+i*3.1;
      this.box(b,x,.7+height*.49,-12.1-(i%3),2.6,height,3.6,i%2?'roof':'stone');
      this.gable(b,x,.79+height,-12.1-(i%3),2.76,.4,3.79);
      for(const dx of [-.62,.62]){
        this.box(b,x+dx,1.1,-10.27-(i%3),.42,.45,.047,'iron');
        if((i+dx>4||i%3===0)&&i%4!==0)this.box(b,x+dx,1.1,-10.235-(i%3),.25,.31,.055,'glow');
      }
    }
    for(let i=0;i<8;i++){
      const x=-7.5+i*1.8;
      this.tube(b,x,0,-8.91,.11,1.65,'wood');
      this.box(b,x,.54,-9.1,1.74,.11,.67,'deck');
      if(i%3===0)this.lantern(b,x,.82,-9.1);
    }
    for(let i=0;i<7;i++){
      const x=-4.8+i*1.61;
      const z=7.35+Math.cos(i*.8)*.36;
      this.tube(b,x,-.16,z,.21,.83,'wood');
      this.tube(b,x,.28,z,.24,.085,'copper');
      if(i<6){
        const cross=this.box(b,x+.8,.09,z,.65+.98,.048,.05,'iron');
        cross.rotation.y=.13*Math.sin(i);
      }
    }
    this.box(b,0,-.25,-1.65,8.45,1.31,3.2,'stone');
    this.box(b,0,.47,-1.65,8.68,.18,3.39,'ledge');
    for(let i=0;i<22;i++)this.box(b,-4.19+i*.4,.593,-1.55,.375,.09,3.08,'deck');
    for(let i=0;i<19;i++){
      const brick=this.box(b,-4.05+i*.44,.09-(i%2)*.25,.025,.37,.18,.048,'shelf');
      brick.rotation.z=(i%3-1)*.047;
    }
    const walls=[[-3.6,-.1],[-1.95,-.1],[1.9,-.1],[3.7,-.1],[-3.9,-2.95],[3.9,-2.95]];
    for(const [x,z] of walls){
      this.tube(b,x,.81,z,.09,.56,'iron');
      this.tube(b,x,1.11,z,.115,.09,'copper');
      this.tube(b,x,-.3,z,.18,1.35,'wood');
    }
    for(const x of [-2.8,2.8])this.box(b,x,.99,-.1,1.79,.045,.07,'trim');
    for(let j=0;j<4;j++){
      const z=.39+j*.55,y=.3-j*.29;
      this.box(b,-2.82,y,z,1.61,.27,.53,'ledge');
      this.box(b,2.64,y,z+.42,1.67,.27,.51,'stone');
    }
    this.box(b,0,-.42,1.3,3.05,.32,1.76,'ledge');
    for(let i=0;i<9;i++)this.box(b,-1.36+i*.34,-.245,1.3,.32,.055,1.71,'deck');
    this.box(b,.06,-.96,2.62,6.9,.3,1.26,'stone');
    for(let i=0;i<9;i++){
      const rock=this.tube(b,-4.5+(i*1.43)%9,-.62,2.9+((i*7)%5)*.38,.19+(i%3)*.16,.31,'ledge',.75,5);
      rock.rotation.z=i*.4;
    }
    for(const [x,z] of [[-3.84,-1.1],[3.9,-1.2],[-1.2,-3.3]]){
      this.tube(b,x,1.42,z,.056,1.61,'iron');
      this.box(b,x+.16,2.12,z,.38,.06,.057,'copper');
      this.lantern(b,x+.33,1.94,z);
    }
    this.flag=new T.Group();this.flag.position.set(-3.55,2.09,-1.1);b.add(this.flag);
    const pennant=new T.Shape();
    pennant.moveTo(0,.22);pennant.lineTo(.72,.1);pennant.lineTo(0,-.11);pennant.closePath();
    this.flagGeometry=new T.ShapeGeometry(pennant);
    this.materials.flag.side=T.DoubleSide;
    this.shape(this.flag,this.flagGeometry,0,0,0,1,1,1,'flag');
    if(index<2){
      this.shed(-2.25,-2.5,2.6,1.58,1.46);
      this.boats.push({g:this.boat(3.5,2.72,1.05),x:3.5,z:2.72});
      this.boats.push({g:this.boat(-5.3,-3.6,.72),x:-5.3,z:-3.6});
    }else if(index<4){
      this.shed(-2.5,-2.45,2.43,1.55,1.99);
      this.shed(1.65,-2.62,2.82,1.4,1.55);
      this.boats.push({g:this.boat(-5.4,1.4,.83),x:-5.4,z:1.4});
      if(index===2){
        for(const x of [-1.26,1.05]){
          this.box(b,x,1.5,-.94,.08,1.84,.09,'iron');
          this.tube(b,x,2.43,-.94,.079,.08,'copper');
        }
        this.box(b,-.1,2.29,-.94,2.39,.064,.066,'iron');
        for(let i=0;i<9;i++){
          const thread=this.box(b,-1.03+i*.231,1.88,-.94,.019,.81,.025,'copper');
          thread.rotation.z=.38*Math.sin(i*.38);
        }
      }else{
        for(const x of [-3.65,3.62]){
          this.tube(b,x,1.03,-1.75,.43,.96,'teal',.91,12);
          for(const y of [.77,1.31])this.tube(b,x,y,-1.75,.46,.07,'iron');
          this.tube(b,x,1.53,-1.75,.405,.075,'copper');
        }
      }
    }else{
      this.shed(-2.02,-2.66,2.78,1.51,1.4);
      this.tower(2.78,-2.59);
      this.boats.push({g:this.boat(-4.9,3.3,.85),x:-4.9,z:3.3});
    }
    for(const [x,z] of [[-3.1,-1.1],[-.7,-2.7],[3.4,-2.1],[-4,-.85]]){
      this.box(b,x,.8,z,.47,.4,.49,'wood');
      for(const dx of [-.18,.18])this.box(b,x+dx,.8,z+.25,.046,.41,.028,'trim');
      const brace=this.box(b,x,.79,z+.252,.055,.53,.023,'trim');brace.rotation.z=.77;
    }
    for(const point of ch.points)this.makeProp(point);
    this.resize();
  }
  makeProp(p){
    const g=new T.Group();g.position.set(...p.pos);this.root.add(g);
    const item={g,point:p,rotor:null,active:null};
    this.props.set(p.id,item);
    if(p.take||p.relic){
      if(p.id==='weight'){
        this.tube(g,0,.05,0,.34,.28,'red',.69,10);
        this.tube(g,0,.2,0,.15,.15,'ivory',.57,9);
        this.lantern(g,0,.44,0);
      }else if(p.id==='spanner'){
        this.box(g,0,-.05,0,.53,.13,.38,'iron');
        this.box(g,0,.04,0,.34,.065,.26,'copper');
      }else if(p.id==='belt'){
        this.wheel(g,0,.09,0,.19,'trim',2).rotation.x=1.33;
      }else if(p.id==='key'){
        this.wheel(g,-.12,.07,0,.13,'copper',2).rotation.x=1.4;
        this.box(g,.15,.067,0,.28,.08,.068,'copper');
        this.box(g,.28,.055,.06,.075,.08,.16,'copper');
      }else{
        const mat=p.id==='blue'||p.id==='lens'?'blue':p.id==='amber'?'amber':'copper';
        this.tube(g,0,.06,0,.17,p.relic ? .09 : .21,mat,.85,10);
        this.tube(g,0,.18,0,.1,.046,'ivory',1,8);
      }
      return;
    }
    if(p.id==='gate'){
      this.box(g,0,.13,0,.52,.28,.53,'iron');
      item.rotor=this.wheel(g,0,.52,.07,.33);
      item.bridge=new T.Group();item.bridge.position.set(.65,-.055,.35);g.add(item.bridge);
      item.bridge.rotation.x=-Math.PI*.44;
      for(let i=0;i<9;i++)this.box(item.bridge,0,0,.13+i*.275,.81,.085,.258,'deck');
      for(const x of [-.39,.39]){
        this.box(item.bridge,x,.21,1.25,.047,.063,2.53,'copper');
        for(const z of [.19,.81,1.5,2.29])this.box(item.bridge,x,.103,z,.041,.24,.041,'iron');
      }
    }else if(p.id==='bell'){
      this.box(g,0,1.04,-.03,1.12,.13,.23,'wood');
      for(const x of [-.52,.52])this.box(g,x,.47,-.05,.12,1.14,.15,'wood');
      item.rotor=new T.Group();item.rotor.position.y=.83;g.add(item.rotor);
      this.tube(item.rotor,0,-.18,0,.31,.36,'copper',.48,14);
      this.tube(item.rotor,0,-.37,0,.35,.09,'trim',.95,14);
      this.tube(item.rotor,0,-.43,0,.052,.19,'iron');
    }else if(p.id==='mill'||p.id==='winch'){
      this.box(g,0,.23,0,.83,.51,.72,'wood');
      item.rotor=this.wheel(g,0,.67,.42,p.id==='mill'?.6:.36,'copper',6);
      this.box(g,0,.48,-.31,.16,.97,.15,'iron');
    }else{
      this.box(g,0,.22,0,.63,.55,.51,'iron');
      this.box(g,0,.51,0,.72,.085,.59,'copper');
      item.active=this.lantern(g,0,.67,0,'bulbOff');
      item.rotor=this.wheel(g,0,.38,.285,.18,'trim',3);
    }
  }
  resize(){
    const w=this.canvas.clientWidth||1,h=this.canvas.clientHeight||1,aspect=w/h;
    const half=Math.max(4.5,5.45/aspect);
    this.camera.left=-half*aspect;this.camera.right=half*aspect;
    this.camera.top=half;this.camera.bottom=-half;
    this.camera.position.set(10.37,12.54,23.63);this.camera.lookAt(0,.67,0);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.renderer.setSize(w,h,false);
  }
  draw(ch,s,dt,reduced,rewards){
    if(this.index!==s.index)this.build(s.index,ch,s.tide);
    this.time+=reduced?0:dt;
    const t=this.time;
    this.waterY+=(SEA[s.tide]-this.waterY)*Math.min(1,dt*3.8);
    if(reduced)this.waterY=SEA[s.tide];
    this.water.position.y=this.waterY;
    this.water.material.uniforms.clock.value=t;
    for(const b of this.boats){
      b.g.position.set(b.x+(s.cleared?Math.sin(t*.55)*.39:0),this.waterY+.22+Math.sin(t*1.7+b.x)*.052,b.z);
      b.g.rotation.z=Math.sin(t*1.2+b.x)*.045;
    }
    const a=this.rain.geometry.attributes.position.array;
    for(let i=0;i<90;i++){
      const x=((i*31.73)%14)-7,z=((i*11.27)%12)-5,y=6-((i*.37+t*4.3)%7);
      a.set([x,y,z,x-.07,y-.18,z+.04],i*6);
    }
    this.rain.geometry.attributes.position.needsUpdate=true;
    this.rain.visible=!reduced;
    for(const [id,o] of this.props){
      const done=s.done.includes(id);
      if(o.point.take||o.point.relic){
        o.g.visible=!done&&(o.point.tide===s.tide||id==='weight');
        if(id==='weight')o.g.position.y=this.waterY+.13;
        if(o.point.relic)o.g.rotation.y=t*.82;
      }
      if(o.rotor&&done)o.rotor.rotation.z=id==='bell'?Math.sin(t*5)*.19:-t*(id==='mill'?1.55:.63);
      if(o.active?.material===this.materials.bulbOff||o.active?.material===this.materials.green){
        o.active.material=done?this.materials.green:this.materials.bulbOff;
      }
      if(o.bridge){
        const angle=done?Math.asin(clamp((.59-(this.waterY+.58))/2.5,-.5,.5)):-Math.PI*.44;
        o.bridge.rotation.x+=(angle-o.bridge.rotation.x)*(reduced?1:Math.min(1,dt*4.9));
      }
    }
    if(this.towerLamp)this.towerLamp.material=s.cleared?this.materials.glow:this.materials.bulbOff;
    if(this.beam){
      const x=2.78,z=-2.59,a=.14+Math.sin(t*.56)*.9;
      this.beam.visible=s.cleared;
      this.beam.position.set(x+4.5*Math.sin(a),3.22,z+4.5*Math.cos(a));
      this.beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-Math.sin(a),0,-Math.cos(a)));
    }
    this.materials.glow.color.setHex(rewards.like?0xff8f57:0xffcb79);
    this.flag.visible=rewards.comment;
    this.flag.rotation.y=Math.sin(t*3)*.32;
    this.renderer.render(this.scene,this.camera);
  }
  project(point){
    const prop=this.props.get(point.id);
    const at=prop?.g.position||new T.Vector3(...point.pos);
    const v=at.clone();v.y+=point.take||point.relic ? .3 : .65;
    v.project(this.camera);
    return [clamp((v.x+1)*50,8,92),clamp((1-v.y)*50,12,88)];
  }
}
