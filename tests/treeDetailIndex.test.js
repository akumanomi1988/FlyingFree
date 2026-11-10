import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTreeDetail,TREE_DETAIL_RADIUS} from '../src/treeDetail.js';

test('nearby detailed trees query a spatial index instead of the complete island',()=>{
  const records=[];
  for(let ix=-40;ix<40;ix++)
    for(let iz=-40;iz<40;iz++)
      records.push({x:ix*100,z:iz*100,y:0,height:20,angle:0,kind:'oak'});
  const scene=new THREE.Scene();
  const detail=createTreeDetail(THREE,scene,records,1);
  const position={x:0,y:30,z:0};
  detail.update(position,0);
  assert.ok(detail.active>0,'The local canopy disappeared');
  assert.ok(detail.scannedCandidates<400,
    'Camera still scans the entire 6400-tree island: '+detail.scannedCandidates);
  assert.ok(detail.scannedCandidates<records.length/10);
  assert.ok(detail.spatialCells>100);
  assert.equal(detail.updateCount,1);
  detail.update(position,.1);
  assert.equal(detail.updateCount,1,'Repeated stationary frame rebuilt detailed trees');
  const changed={x:1200,y:30,z:800};
  detail.update(changed,1);
  assert.equal(detail.updateCount,2);
  assert.ok(detail.active>0,'Trees disappeared after crossing spatial buckets');
  assert.ok(detail.scannedCandidates<400);
  assert.equal(scene.children.length,3,'Spatial optimization must not add draw calls');
  assert.equal(TREE_DETAIL_RADIUS,680);
  detail.dispose();
  assert.equal(scene.children.length,0);
});

test('empty vegetation cells keep instanced buffers safely empty',()=>{
  const scene=new THREE.Scene();
  const detail=createTreeDetail(THREE,scene,[{x:0,z:0,y:0,height:22,angle:0,kind:'oak'}]);
  detail.update({x:9000,z:9000,y:50},0);
  assert.equal(detail.active,0);
  assert.equal(detail.scannedCandidates,0);
  detail.update({x:0,z:0,y:40},1);
  assert.ok(detail.active>0);
  detail.dispose();
});
