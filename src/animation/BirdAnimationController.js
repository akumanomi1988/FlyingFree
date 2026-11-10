// VE-06: presentation-only kingfisher skeleton. BirdBrain owns every decision.
// Animation time is addressed by the VE-02 simulation clock, never by wall-clock FPS.
import * as THREE from 'three';

export const BIRD_CLIPS=Object.freeze(['flap','glide','takeoff','landing','perch','rest']);
const BONES=Object.freeze([
  'Wing_L','Wing_R','WingTip_L','WingTip_R','Head','Tail',
  'Body','Leg_L','Leg_R','Foot_L','Foot_R'
]);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const easing=x=>{const t=clamp(x);return t*t*(3-2*t);};
const blendDuration=Object.freeze({
  flap:.32,glide:.48,takeoff:.22,landing:.34,perch:.44,rest:.68
});
// 10 Hz is the biological reference, but 5 visually readable strokes/s
// avoids severe temporal aliasing on 15 FPS displays. All FPS sample
// exactly the same deterministic waveform at the same simulation time.
const CLIP_RATES=Object.freeze({flap:5,glide:1,takeoff:5,landing:1.2,perch:.8,rest:.6});
const TWO_PI=Math.PI*2;
const FRACTION=1/12;

function pose(name,u){
  const wave=Math.sin(u*TWO_PI-.45);
  const lag=Math.sin(u*TWO_PI-1.02);
  const breath=Math.sin(u*TWO_PI)*.009;
  const fold=name==='perch'||name==='rest';
  const landing=name==='landing';
  const takeoff=name==='takeoff';
  const flap=name==='flap'||takeoff;
  // Kingfisher: one continuous shoulder and one wrist joint per physical wing.
  // Both sides share a phase but bend in opposite directions.
  const amplitude=name==='flap'?.50:takeoff?.64:landing?.19:.015;
  const stroke=flap?amplitude*(wave+(takeoff?.16:0)):
    landing?amplitude*Math.sin(Math.PI*u):amplitude*Math.sin(u*TWO_PI);
  const folded=fold?1:0;
  const w=folded?.11:-stroke;
  const wrist=folded?.04:-lag*(flap?.17:landing?.08:.018);
  const leg=folded?.18:landing?.38:takeoff?-.57:-.88;
  const head=name==='rest'?.038+breath:name==='perch'?.02+breath:
    landing?-.08:takeoff?-.055:.025+breath;
  const tail=landing?.20+Math.sin(Math.PI*u)*.11:
    takeoff?-.11+wave*.045:folded?-.06+breath:lag*.055;
  return {
    Wing_L:[-.02,folded?1.30:0,w],
    Wing_R:[-.02,folded?-1.30:0,-w],
    WingTip_L:[0,folded?.20:0,wrist],
    WingTip_R:[0,folded?-.20:0,-wrist],
    Head:[head,Math.sin(u*TWO_PI)*.018,0],
    Tail:[tail,0,lag*.025],
    Body:[breath*.4,0,0],
    Leg_L:[leg,0,0],Leg_R:[leg,0,0],
    Foot_L:[folded?-.09:landing?-.22:.08,0,0],
    Foot_R:[folded?-.09:landing?-.22:.08,0,0]
  };
}

export function makeKingfisherClips(){
  return BIRD_CLIPS.map(name=>{
    const times=Array.from({length:13},(_,i)=>i*FRACTION);
    const values=new Map(BONES.map(b=>[b,[]]));
    const quaternion=new THREE.Quaternion();
    const euler=new THREE.Euler();
    for(const u of times){
      const rotations=pose(name,u);
      for(const bone of BONES){
        euler.set(...rotations[bone],'XYZ');
        quaternion.setFromEuler(euler).normalize();
        values.get(bone).push(quaternion.x,quaternion.y,quaternion.z,quaternion.w);
      }
    }
    const tracks=BONES.map(b=>new THREE.QuaternionKeyframeTrack(
      b+'.quaternion',times,values.get(b)
    ));
    const clip=new THREE.AnimationClip(name,1,tracks);
    clip.optimize();
    return clip;
  });
}

export function chooseBirdAnimation(action={},seconds=0){
  // This mapping is invoked once per ecological tick, not each render frame.
  const state=action.state||'patrol';
  if(state==='takeoff')return 'takeoff';
  if(state==='landing')return 'landing';
  if(state==='rest'&&action.grounded&&action.restSite?.kind==='branch')return 'perch';
  if(state==='rest'||action.grounded&&action.resting)return 'rest';
  if(state==='feed'&&!action.aerialFeeding)return 'perch';
  if(state==='aerial_rest')return 'glide';
  if(state==='approach'||state==='return'||state==='shelter')return 'glide';
  // In a kingfisher the normal wing beat dominates; short glides break up
  // the machine-like metronome without adding random render-side decisions.
  if(state==='patrol'&&action.speed>12&&seconds%8.4>6.6)return 'glide';
  return 'flap';
}

function findRig(root){
  const bones=new Map();
  root.traverse(node=>{if(node.isBone)bones.set(node.name,node);});
  for(const name of BONES)if(!bones.has(name))throw new Error(
    'VE-06 missing anatomical GLB bone: '+name
  );
  return bones;
}
function weightsAt(now,start,from,to,duration){
  const f=easing((now-start)/duration);
  return Object.fromEntries(BIRD_CLIPS.map(name=>[
    name,(from[name]||0)*(1-f)+(name===to?f:0)
  ]));
}
function cleanWeights(weights){
  const total=Object.values(weights).reduce((a,b)=>a+b,0);
  if(total<=1e-8)return Object.fromEntries(BIRD_CLIPS.map(n=>[n,n==='flap'?1:0]));
  return Object.fromEntries(BIRD_CLIPS.map(n=>[n,(weights[n]||0)/total]));
}

export class BirdAnimationController{
  constructor(lod,{query=null}={}){
    if(!lod?.levels?.length)throw new TypeError('VE-06 requires a GLB LOD');
    this.lod=lod;
    this.query=query;
    this.clips=makeKingfisherClips();
    this.levels=lod.levels.map(level=>{
      const bones=findRig(level.object);
      const mixer=new THREE.AnimationMixer(level.object);
      const actions=new Map();
      for(const clip of this.clips){
        const action=mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat,Infinity);
        action.enabled=true;
        action.setEffectiveTimeScale(CLIP_RATES[clip.name]);
        action.setEffectiveWeight(clip.name==='flap'?1:0);
        action.play();
        actions.set(clip.name,action);
      }
      return {root:level.object,mixer,actions,bones,
        footRest:Object.fromEntries(['L','R'].map(side=>[
          side,bones.get('Foot_'+side).position.clone()
        ]))};
    });
    this.current='flap';
    this.from=cleanWeights({flap:1});
    this.to='flap';
    this.transitionAt=0;
    this.duration=.32;
    this.lastTick=-Infinity;
    this.lastRender=-Infinity;
    this.lastContact={active:false,offset:0,feet:0,penetration:0};
    this.disposed=false;
  }
  sync(action,seconds){
    if(this.disposed)throw new Error('VE-06 controller disposed');
    if(!Number.isFinite(seconds)||seconds<this.lastTick-1e-8)
      throw new RangeError('VE-06 requires monotonically increasing fixed-tick time');
    const next=chooseBirdAnimation(action,seconds);
    if(next!==this.to){
      this.from=cleanWeights(weightsAt(
        seconds,this.transitionAt,this.from,this.to,this.duration
      ));
      this.current=this.to;
      this.to=next;
      this.transitionAt=seconds;
      this.duration=blendDuration[next];
    }
    this.lastTick=seconds;
  }
  render(seconds,{position=null,heading=0,brain=null,query=this.query}={}){
    if(this.disposed)throw new Error('VE-06 controller disposed');
    if(!Number.isFinite(seconds))throw new RangeError('Invalid animation time');
    // Absolute addressable time prevents render FPS, dropped frames and resume
    // from accumulating phase drift. 60s is an exact multiple of every 1s clip.
    const weights=cleanWeights(weightsAt(
      seconds,this.transitionAt,this.from,this.to,this.duration
    ));
    const time=((seconds%60)+60)%60;
    for(const level of this.levels){
      for(const name of BIRD_CLIPS)
        level.actions.get(name).setEffectiveWeight(weights[name]);
      level.mixer.setTime(time);
    }
    this.applyContacts({position,heading,brain,query,weights});
    this.lastRender=seconds;
    return this.snapshot;
  }
  applyContacts({position,heading,brain,query,weights}){
    const state=brain?.state||'patrol';
    const isLanding=state==='landing';
    const wantsGround=(brain?.grounded||brain?.resting&&state==='rest'||
      state==='feed'&&!brain?.aerialFeeding||isLanding)&&!brain?.floating;
    const sumFold=weights.perch+weights.rest+weights.landing;
    if(!wantsGround||!position||!query?.sampleSurface||sumFold<.001){
      this.lastContact={active:false,offset:0,feet:0,penetration:0};
      for(const level of this.levels){
        level.root.position.y=0;
        for(const side of ['L','R'])level.bones.get('Foot_'+side).position.copy(level.footRest[side]);
      }
      return;
    }
    // The brain's roost is an explicit branch record. WorldQuery intentionally
    // does not include animated foliage, so do not substitute the ground below.
    const branch=brain?.restSite?.kind==='branch'?brain.restSite:null;
    const surface=branch?
      {y:branch.branchY,normal:{x:0,y:1,z:0},kind:'branch'}:
      query.sampleSurface(position.x,position.z);
    if(!surface){
      this.lastContact={active:false,offset:0,feet:0,penetration:0};
      for(const level of this.levels){
        level.root.position.y=0;
        for(const side of ['L','R'])level.bones.get('Foot_'+side).position.copy(level.footRest[side]);
      }
      return;
    }
    const clearance=position.y-surface.y;
    const contactEase=branch?1:isLanding?
      easing((.5-clearance)/.36):1;
    const influence=clamp(sumFold*contactEase);
    // The behavioral clearance is shared across species (min .18m), whereas
    // this 26cm animal has a ~43mm thorax-to-ankle distance.
    const offset=clamp(clearance-.043,0,.15)*influence;
    // One pair of surface samples serves *both* LODs; the IK does not
    // double BVH work merely because the renderer keeps two skeletons.
    const footHits={};
    for(const side of ['L','R']){
      const lateral=(side==='L'?-1:1)*.010;
      footHits[side]=branch?surface:query.sampleSurface(
        position.x+Math.cos(heading)*lateral,
        position.z-Math.sin(heading)*lateral
      )??surface;
    }
    let feet=0,maxPenetration=0;
    // VE-05 GLB coordinates are already metres. Runtime cancels the procedural
    // rig scale on the LOD parent, so a second inverse scale displaces the
    // whole skeleton metres below ground when the bird perches.
    for(const level of this.levels){
      level.root.position.y=-offset;
      for(const side of ['L','R']){
        const leg=level.bones.get('Leg_'+side);
        const foot=level.bones.get('Foot_'+side);
        const hit=footHits[side];
        const normal=hit?.normal||surface.normal;
        // A bounded ankle correction aligns toes to the sloped triangle.
        // No rigid-body feedback and no changes to BirdBrain coordinates.
        const slope=Math.atan2(
          normal.z*Math.cos(heading)+normal.x*Math.sin(heading),
          Math.max(.35,normal.y)
        );
        const pitch=clamp(slope,-.32,.32)*influence;
        leg.rotation.x+=pitch*.22;
        foot.rotation.x-=pitch;
        const heightDifference=clamp(surface.y-(hit?.y??surface.y),-.012,.012);
        foot.position.copy(level.footRest[side]);
        foot.position.y+=heightDifference*influence;
        const sole=position.y-offset-.043+heightDifference*influence;
        maxPenetration=Math.max(maxPenetration,Math.max(0,(hit?.y??surface.y)-sole));
        feet++;
      }
    }
    this.lastContact={active:influence>.01,offset,feet,
      penetration:maxPenetration,kind:surface.kind};
  }
  get snapshot(){
    const weight=cleanWeights(weightsAt(
      Number.isFinite(this.lastRender)?this.lastRender:this.lastTick,
      this.transitionAt,this.from,this.to,this.duration
    ));
    return {mode:this.to,weights:weight,levels:this.levels.length,
      mixers:this.levels.length,clipCount:this.clips.length,
      bones:this.levels[0].bones.size,contact:{...this.lastContact},
      simulatedSeconds:this.lastTick,renderSeconds:this.lastRender};
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    for(const level of this.levels){
      level.mixer.stopAllAction();
      level.mixer.uncacheRoot(level.root);
      level.root.position.y=0;
    }
    this.levels.length=0;
  }
}
