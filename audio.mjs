export class HarborAudio {
  constructor(muted){this.muted=muted;this.voices=new Set();this.beat=0;}
  wake(){
    if(this.muted)return;
    try{
      if(!this.context){
        const Context=window.AudioContext||window.webkitAudioContext;
        if(!Context)return;
        this.context=new Context();
        this.bus=this.context.createGain();
        this.bus.gain.value=.62;
        this.bus.connect(this.context.destination);
      }
      this.context.resume().catch(()=>{});
    }catch{}
  }
  tone(hz,length,level,shape='sine',delay=0,end=hz){
    if(this.muted||!this.context||this.voices.size>=18)return;
    const a=this.context,t=a.currentTime+delay,osc=a.createOscillator(),gain=a.createGain();
    osc.type=shape;
    osc.frequency.setValueAtTime(hz,t);
    osc.frequency.exponentialRampToValueAtTime(end,t+length);
    gain.gain.setValueAtTime(.001,t);
    gain.gain.linearRampToValueAtTime(level,t+.024);
    gain.gain.exponentialRampToValueAtTime(.001,t+length);
    osc.connect(gain);gain.connect(this.bus);
    this.voices.add(osc);
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices.delete(osc);};
    osc.start(t);osc.stop(t+length+.01);
  }
  surf(active){
    if(!active||this.muted||!this.context){
      if(this.loop){try{this.loop.stop();}catch{}this.loop=null;}
      if(this.timer){clearInterval(this.timer);this.timer=null;}
      return;
    }
    if(this.loop)return;
    const a=this.context;
    if(!this.wave){
      this.wave=a.createBuffer(1,a.sampleRate*4,a.sampleRate);
      const samples=this.wave.getChannelData(0);
      let smoothed=0;
      for(let i=0;i<samples.length;i++){
        smoothed=smoothed*.94+(Math.random()*2-1)*.06;
        samples[i]=smoothed*(.39+.23*Math.sin(i/samples.length*Math.PI*4));
      }
    }
    const source=a.createBufferSource(),gain=a.createGain();
    gain.gain.value=.34;source.buffer=this.wave;source.loop=true;
    source.connect(gain);gain.connect(this.bus);
    source.onended=()=>{source.disconnect();gain.disconnect();};
    source.start();this.loop=source;
    this.timer=setInterval(()=>{
      const notes=[146.8,220,164.8,196,130.8,196,146.8,174.6];
      const n=notes[this.beat++%notes.length];
      this.tone(n,1.74,.039,'triangle');
      this.tone(n*2,.83,.017,'sine',.12);
    },1450);
  }
  cue(type){
    if(type==='tide')this.tone(104,.52,.14,'sine',0,63);
    if(type==='wrong')this.tone(170,.16,.065,'triangle',0,110);
    if(type==='take'){
      this.tone(620,.22,.10,'sine');
      this.tone(941,.39,.073,'sine',.074);
    }
    if(type==='clear'){
      [196,293.66,392,587.33].forEach((n,i)=>this.tone(n,1.4,.083,'triangle',i*.10));
    }
  }
  silence(){
    this.surf(false);
    for(const voice of this.voices)try{voice.stop();}catch{}
    this.voices.clear();
  }
}
