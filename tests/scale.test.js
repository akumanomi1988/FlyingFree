import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BIRDS} from '../src/core.js';
import {createBirdRig} from '../src/flight.js';
import {createEcosystem} from '../src/ecosystem.js';
import {foliageDensity} from '../src/ecology.js';
import {birdRigScale,birdCameraDistance,TREE_HEIGHT_M,FAUNA_SCALE,WORLD_METRES_PER_UNIT} from '../src/worldScale.js';

test('one world unit equals one metre and all 12 species have biological wingspans',()=>{
  assert.equal(WORLD_METRES_PER_UNIT,1);
  assert.equal(BIRDS.length,12);
  const ids=new Set();
  for(const bird of BIRDS){
    assert.ok(!ids.has(bird.id));ids.add(bird.id);
    assert.ok(Number.isFinite(bird.wingspan)&&bird.wingspan>=.1&&bird.wingspan<=3.5,bird.id);
    assert.ok(Number.isFinite(birdRigScale(bird))&&birdRigScale(bird)>0,bird.id);
  }
});

test('bird procedural rig bounding-box wingspan matches its real-world profile',()=>{
  for(const bird of BIRDS){
    const rig=createBirdRig(THREE,bird);
    const bounds=new THREE.Box3().setFromObject(rig);
    const width=bounds.max.x-bounds.min.x;
    assert.ok(Math.abs(width-bird.wingspan)/bird.wingspan<.18,
      bird.id+': physical span '+width+' m vs expected '+bird.wingspan+' m');
    assert.ok(birdCameraDistance(bird)>=.55&&birdCameraDistance(bird)<=13,bird.id);
  }
});

test('trees are tens of metres tall while olive trees stay naturally small',()=>{
  assert.ok(TREE_HEIGHT_M.pine>=25&&TREE_HEIGHT_M.pine<=35);
  assert.ok(TREE_HEIGHT_M.olive>=5&&TREE_HEIGHT_M.olive<=10);
  assert.ok(TREE_HEIGHT_M.oak>=15&&TREE_HEIGHT_M.oak<=30);
  assert.ok(TREE_HEIGHT_M.birch>=15&&TREE_HEIGHT_M.birch<=25);
  assert.ok(TREE_HEIGHT_M.cypress>=15&&TREE_HEIGHT_M.cypress<=30);
  // Even the largest protagonist must be far smaller than a mature pine.
  assert.ok(Math.max(...BIRDS.map(b=>b.wingspan))<TREE_HEIGHT_M.pine*.15);
});

test('secondary fauna has plausible dimensions in the same coordinate system',()=>{
  const scene=new THREE.Scene(),ecosystem=createEcosystem(THREE,scene,1988,1);
  const bounds=new THREE.Box3(),size=new THREE.Vector3();
  const heights={};
  for(const type of ['deer','fox','rabbit']){
    const animal=ecosystem.actors.find(a=>a.userData.state.type===type);
    bounds.setFromObject(animal).getSize(size);
    heights[type]=size.y;
  }
  assert.ok(heights.deer>1.1&&heights.deer<2.2,'deer: '+heights.deer);
  assert.ok(heights.fox>.35&&heights.fox<.85,'fox: '+heights.fox);
  assert.ok(heights.rabbit>.28&&heights.rabbit<.75,'rabbit: '+heights.rabbit);
  bounds.setFromObject(ecosystem.dolphins[0].group).getSize(size);
  assert.ok(size.z>=2&&size.z<=5,'dolphin length: '+size.z);
  assert.ok(FAUNA_SCALE.butterfly<.1);
});

test('flowers and shrubs are actually populated for plural geometry layer names',()=>{
  const forest={type:'forest'},meadow={type:'meadow'};
  assert.ok(foliageDensity(forest,'shrubs')>0);
  assert.ok(foliageDensity(meadow,'flowers')>0);
  assert.equal(foliageDensity({type:'ocean'},'flowers'),0);
});
