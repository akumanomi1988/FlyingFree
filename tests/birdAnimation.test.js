import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BirdAnimationController,BIRD_CLIPS,makeKingfisherClips,
  chooseBirdAnimation} from '../src/animation/BirdAnimationController.js';

const NAMES=['Root','Body','Head','Tail','Wing_L','Wing_R',
  'WingTip_L','WingTip_R','Leg_L','Leg_R','Foot_L','Foot_R'];

function model(){
  const lod=new THREE.LOD();
  for(const distance of [0,8]){
    const group=new THREE.Group();
    const armature=new THREE.Bone();armature.name='Root';group.add(armature);
    const bones=new Map([['Root',armature]]);
    for(const name of NAMES.slice(1)){
      const bone=new THREE.Bone();bone.name=name;
      // Only one physical shoulder/wingtip per side (no duplicated wings).
      (name.startsWith('WingTip_')?
        bones.get('Wing_'+name.slice(-1)):
        name.startsWith('Foot_')?bones.get('Leg_'+name.slice(-1)):
          bones.get('Root')).add(bone);
      if(name.startsWith('Foot_'))bone.position.y=-.023;
      bones.set(name,bone);
    }
    group.add(new THREE.Mesh(
      new THREE.BoxGeometry(.03,.02,.07),new THREE.MeshBasicMaterial()
    ));
    lod.addLevel(group,distance);
  }
  return lod;
}
function angle(root,name){
  const bone=root.getObjectByName(name);
  assert.ok(bone?.isBone,'missing bone '+name);
  const q=bone.quaternion;
  return [q.x,q.y,q.z,q.w].map(v=>+v.toFixed(7));
}
function sample(controller,seconds,state,opts={}){
  controller.sync(state,seconds);
  return controller.render(seconds,{position:{x:0,y:.18,z:0},
    heading:0,brain:state,query:{sampleSurface:()=>({
      y:0,kind:'terrain',normal:{x:0,y:1,z:0}
    })},...opts});
}

test('VE-06: six anatomical clips, compatible skeleton and a single shoulder per side',()=>{
  assert.deepEqual(BIRD_CLIPS,['flap','glide','takeoff','landing','perch','rest']);
  const clips=makeKingfisherClips();
  for(const clip of clips){
    assert.equal(clip.duration,1);
    assert.equal(clip.tracks.length,11);
    assert.equal(new Set(clip.tracks.map(t=>t.name)).size,11,
      'Duplicate channels could drive phantom joints');
    for(const track of clip.tracks){
      assert.ok(track.name.endsWith('.quaternion'));
      assert.ok([...track.values].every(Number.isFinite));
    }
  }
  const controller=new BirdAnimationController(model());
  assert.equal(controller.snapshot.mixers,2);
  assert.equal(controller.snapshot.bones,12);
  controller.dispose();
});

test('VE-06: the behavior layer selects the clip; aerial rest is never a tree perch',()=>{
  assert.equal(chooseBirdAnimation({state:'takeoff'}),'takeoff');
  assert.equal(chooseBirdAnimation({state:'landing'}),'landing');
  assert.equal(chooseBirdAnimation({state:'rest',grounded:true,
    restSite:{kind:'branch'}}),'perch');
  assert.equal(chooseBirdAnimation({state:'rest',grounded:true}),'rest');
  assert.equal(chooseBirdAnimation({state:'feed',aerialFeeding:false}),'perch');
  assert.equal(chooseBirdAnimation({state:'aerial_rest'}),'glide');
  assert.equal(chooseBirdAnimation({state:'approach'}),'glide');
  assert.equal(chooseBirdAnimation({state:'patrol',speed:16},1),'flap');
});

test('VE-06: abrupt brain changes maintain normalized, smooth blends at both LODs',()=>{
  const lod=model(),controller=new BirdAnimationController(lod);
  const states=['rest','takeoff','patrol','aerial_rest','landing','feed','rest'];
  for(let i=0;i<states.length;i++){
    const state=states[i]==='feed'?
      {state:'feed',grounded:true,aerialFeeding:false}:
      {state:states[i],grounded:states[i]==='rest',resting:states[i]==='rest'};
    const t=i*1.25;
    const begin=sample(controller,t,state);
    assert.ok(Math.abs(Object.values(begin.weights).reduce((a,b)=>a+b,0)-1)<1e-9);
    for(const v of Object.values(begin.weights))assert.ok(v>=0&&v<=1);
    const a=controller.render(t+.015,{brain:state});
    assert.ok(a.weights[begin.mode]<1,'Crossfade must not snap to the target');
    const final=controller.render(t+1,{brain:state});
    assert.ok(final.weights[final.mode]>.9999,'Target animation must reach full weight');
    for(const level of lod.levels){
      for(const name of NAMES.slice(1)){
        const q=angle(level.object,name);
        assert.ok(Math.abs(q.reduce((n,v)=>n+v*v,0)-1)<.001);
      }
    }
  }
  controller.dispose();
});

test('VE-06: fixed ticks produce identical pose at 15, 30, 60 FPS',()=>{
  function replay(fps){
    const lod=model(),controller=new BirdAnimationController(lod);
    const ticks=[
      [0,{state:'rest',grounded:true,resting:true}],
      [20,{state:'takeoff',grounded:false}],
      [56,{state:'patrol',speed:17}],
      [115,{state:'aerial_rest'}],
      [150,{state:'landing'}],
      [188,{state:'rest',grounded:true,resting:true,restSite:{kind:'branch',branchY:0}}]
    ];
    const samples=[];
    let next=0;
    for(let frame=0;frame<=fps*8;frame++){
      const now=frame/fps;
      // Tick decisions are only read at fixed 30Hz, independent of render FPS.
      while(next/30<=now+1e-9&&next<=240){
        const activity=ticks.filter(([t])=>t<=next).at(-1)[1];
        controller.sync(activity,next/30);
        next++;
      }
      if(Math.abs(now-Math.round(now))<1e-9){
        const activity=ticks.filter(([t])=>t<=next-1).at(-1)[1];
        const snap=controller.render(now,{brain:activity});
        samples.push({pose:angle(lod.levels[0].object,'Wing_L'),
          foot:angle(lod.levels[1].object,'Foot_R'),
          mode:snap.mode,weights:Object.values(snap.weights).map(v=>+v.toFixed(7))});
      }
    }
    controller.dispose();
    return samples;
  }
  assert.deepEqual(replay(15),replay(30));
  assert.deepEqual(replay(60),replay(30));
});

test('VE-06: pause/resume freezes pose and no catch-up flapping or root drift',()=>{
  const lod=model(),controller=new BirdAnimationController(lod);
  sample(controller,1,{state:'takeoff'});
  const initial=angle(lod.levels[0].object,'Wing_L');
  for(let n=0;n<50;n++)controller.render(1,{brain:{state:'takeoff'}});
  assert.deepEqual(angle(lod.levels[0].object,'Wing_L'),initial);
  assert.equal(controller.snapshot.renderSeconds,1);
  sample(controller,1+1/30,{state:'patrol',speed:17});
  assert.ok(controller.snapshot.weights.takeoff>0,'Resume must preserve the previous takeoff pose');
  controller.dispose();
  assert.equal(controller.levels.length,0);
  assert.throws(()=>controller.render(2),/disposed/);
});

test('VE-06: ground and branch contacts use WorldQuery but never mutate BirdBrain',()=>{
  const lod=model(),queries=[];
  const query={sampleSurface:(x,z)=>{
    queries.push([x,z]);
    return {y:0,kind:'terrain',normal:{x:.1,y:.99,z:.08}};
  }};
  const controller=new BirdAnimationController(lod,{query});
  const brain={state:'rest',grounded:true,resting:true,
    restSite:{kind:'branch',branchY:0}};
  const frozen=JSON.stringify(brain);
  sample(controller,0,brain,{query});
  const result=controller.render(2,{position:{x:5,y:.18,z:9},
    heading:.4,brain,query,scale:1});
  assert.equal(result.contact.kind,'branch');
  assert.equal(result.contact.feet,4,'Both feet on both LODs');
  assert.ok(result.contact.offset>.1&&result.contact.offset<=.15);
  assert.equal(queries.length,0,'Branch contacts must not raycast through the tree');
  assert.equal(JSON.stringify(brain),frozen,'IK must not modify ecological state');
  const level=lod.levels[0].object;
  assert.ok(level.position.y<0);
  const foot=level.getObjectByName('Foot_L');
  assert.ok(Math.abs(foot.position.y+.023)<.005);
  const land={state:'landing',grounded:false,resting:false};
  controller.sync(land,3);
  const ground=controller.render(3.5,{position:{x:5,y:.19,z:9},
    heading:0,brain:land,query});
  assert.ok(queries.length>=2,'WorldQuery ground samples required');
  assert.ok(ground.contact.penetration<.025);
  controller.dispose();
});

test('VE-06: four simulated minutes across state changes do not grow rig resources',()=>{
  const lod=model(),controller=new BirdAnimationController(lod);
  const before=lod.levels.map(level=>{
    let meshes=0,bones=0,geometry=0;
    level.object.traverse(n=>{
      if(n.isMesh){meshes++;geometry++;}
      if(n.isBone)bones++;
    });return {meshes,bones,geometry};
  });
  for(let tick=0;tick<=7200;tick++){
    const t=tick/30;
    const phase=t%48;
    const action=phase<6?{state:'rest',grounded:true,resting:true}:
      phase<10?{state:'takeoff'}:phase<24?{state:'patrol',speed:17}:
      phase<35?{state:'aerial_rest'}:phase<42?{state:'landing'}:
      {state:'rest',grounded:true,resting:true,
        restSite:{kind:'branch',branchY:0}};
    controller.sync(action,t);
    if(tick%2===0){
      const snap=controller.render(t,{brain:action});
      assert.ok(Object.values(snap.weights).every(Number.isFinite));
    }
  }
  assert.equal(controller.snapshot.clipCount,6);
  for(let i=0;i<2;i++){
    let meshes=0,bones=0,geometry=0;
    lod.levels[i].object.traverse(n=>{
      if(n.isMesh){meshes++;geometry++;}
      if(n.isBone)bones++;
    });
    assert.deepEqual({meshes,bones,geometry},before[i],
      'Animation must not allocate scene objects over time');
  }
  controller.dispose();
});
