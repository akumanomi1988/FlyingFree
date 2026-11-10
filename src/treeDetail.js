// High-detail tree layer, pooled and updated at low frequency.
// Original instanced trunks/canopies remain as the stable far LOD.
// Nearby branches and crown clusters scale in over 30 metres, avoiding hard popping.
export const TREE_DETAIL_RADIUS=680;
export const TREE_DETAIL_FADE_START=440;
export const TREE_DETAIL_POOL=240;

export function treeDetailWeight(distance,near=TREE_DETAIL_FADE_START,far=TREE_DETAIL_RADIUS){
  if(!Number.isFinite(distance)||distance>=far)return 0;
  if(distance<=near)return 1;
  const t=(far-distance)/(far-near);
  return t*t*(3-2*t);
}

export function createTreeDetail(THREE,scene,records,quality=1,windField=null){
  const maxTrees=Math.max(12,Math.round(TREE_DETAIL_POOL*quality));
  const stemCount=6,clusterCount=7;
  const branches=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.13,.24,1,8,2),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),maxTrees*stemCount);
  const broad=new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1,2),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:.97,flatShading:false}),maxTrees*clusterCount);
  const needles=new THREE.InstancedMesh(
    new THREE.ConeGeometry(1,2.5,12,3),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:false}),maxTrees*clusterCount);
  if(windField){
    windField.apply(broad.material,{amplitude:.19,height:2,frequency:.82});
    windField.apply(needles.material,{amplitude:.13,height:2.4,frequency:.69});
  }
  const up=new THREE.Vector3(0,1,0),start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3();
  const obj=new THREE.Object3D(),c=new THREE.Color();
  for(const mesh of [branches,broad,needles]){
    mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
  }
  // Immutable 2D buckets avoid scanning every tree on frequent close-up
  // camera updates. The selected set and LOD are still evaluated in 3D.
  const cellSize=256,cellIndex=new Map();
  for(let i=0;i<records.length;i++){
    const r=records[i],key=Math.floor(r.x/cellSize)+','+Math.floor(r.z/cellSize);
    let bucket=cellIndex.get(key);
    if(!bucket){bucket=[];cellIndex.set(key,bucket);}
    bucket.push(i);
  }
  let scannedCandidates=0;
  let lastTime=-Infinity,lastX=Infinity,lastY=Infinity,lastZ=Infinity,active=0,fadeDistance=TREE_DETAIL_RADIUS,refreshes=0;

  function update(position,t){
    const dx=position.x-lastX,dy=position.y-lastY,dz=position.z-lastZ;
    // Avoid rebuilding all instance matrices every 0.12 s while stationary.
    // Refresh sooner when the cinematic camera moves at flight speed.
    const movedSq=dx*dx+dy*dy+dz*dz;
    if(movedSq<9&&t-lastTime<3)return;
    if(t-lastTime<.10)return;
    lastX=position.x;lastY=position.y;lastZ=position.z;lastTime=t;
    refreshes++;
    const visible=[];
    scannedCandidates=0;
    const minX=Math.floor((position.x-TREE_DETAIL_RADIUS)/cellSize);
    const maxX=Math.floor((position.x+TREE_DETAIL_RADIUS)/cellSize);
    const minZ=Math.floor((position.z-TREE_DETAIL_RADIUS)/cellSize);
    const maxZ=Math.floor((position.z+TREE_DETAIL_RADIUS)/cellSize);
    for(let ix=minX;ix<=maxX;ix++){
      for(let iz=minZ;iz<=maxZ;iz++){
        const bucket=cellIndex.get(ix+','+iz);
        if(!bucket)continue;
        for(const index of bucket){
          scannedCandidates++;
          const record=records[index];
          const x=record.x-position.x,z=record.z-position.z,
            y=record.y+record.height*.6-position.y;
          const d2=x*x+y*y+z*z;
          if(d2<TREE_DETAIL_RADIUS*TREE_DETAIL_RADIUS)visible.push({record,d2,index});
        }
      }
    }
    // Keep the old stable tie-breaker when two trees are equidistant.
    visible.sort((a,b)=>a.d2-b.d2||a.index-b.index);
    let nBranches=0,nBroad=0,nNeedles=0;
    const limit=Math.min(visible.length,maxTrees);
    // Under dense foliage the pool fills before the 145 m outer radius.
    // Fade each tree before that moving pool boundary to prevent abrupt swaps.
    fadeDistance=visible.length>maxTrees
      ?Math.min(TREE_DETAIL_RADIUS,Math.sqrt(visible[maxTrees-1].d2))
      :TREE_DETAIL_RADIUS;
    const fadeStart=Math.max(0,fadeDistance-220);
    let detailedCount=0;
    for(let index=0;index<limit;index++){
      const {record:r,d2}=visible[index];
      const weight=treeDetailWeight(Math.sqrt(d2),fadeStart,fadeDistance);
      // Palm fronds already use their own instanced crown; a second spherical
      // LOD layer would make tropical palms look like broadleaf trees.
      if(weight<=.001||r.kind==='palm')continue;
      detailedCount++;
      const evergreen=['pine','cypress'].includes(r.kind);
      const crownY=r.kind==='cypress'?.55:r.kind==='pine'?.63:r.kind==='olive'?.67:.70;
      const spread=r.kind==='cypress'?.12:r.kind==='pine'?.23:r.kind==='olive'?.34:.31;
      const palette=r.kind==='pine'?0x557c56:r.kind==='cypress'?0x376d50:
        r.kind==='olive'?0x929f74:r.kind==='mangrove'?0x3b7750:r.kind==='birch'?0x539b66:0x418a55;
      // Radial branch spokes, anchored on the trunk and ending in crown volumes.
      for(let j=0;j<stemCount;j++){
        const az=r.angle+j*Math.PI*2/stemCount;
        const level=.40+(j%3)*.095;
        const rad=r.height*spread*(.75+(j%2)*.22)*weight;
        start.set(r.x,r.y+r.height*level,r.z);
        end.set(r.x+Math.cos(az)*rad,r.y+r.height*(level+.09*weight),r.z+Math.sin(az)*rad);
        direction.subVectors(end,start);
        const len=direction.length();
        obj.position.copy(start).add(end).multiplyScalar(.5);
        obj.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/Math.max(.001,len)));
        obj.scale.set(Math.max(.05,r.height*.012)*weight,len,Math.max(.05,r.height*.012)*weight);
        obj.updateMatrix();branches.setMatrixAt(nBranches,obj.matrix);
        c.setHex(r.kind==='birch'?0xc2bfae:r.kind==='olive'?0x777063:0x645346);
        branches.setColorAt(nBranches++,c);
      }
      for(let j=0;j<clusterCount;j++){
        const az=r.angle+j*2.399963229728653;
        const height=crownY+(j%3-1)*.10;
        const radius=r.height*spread*(.72+(j%3)*.17);
        const mesh=evergreen?needles:broad;
        obj.position.set(r.x+Math.cos(az)*radius,r.y+r.height*height,r.z+Math.sin(az)*radius);
        obj.quaternion.identity();
        if(evergreen){
          const size=r.height*(r.kind==='cypress'?.075:.105)*weight;
          obj.scale.set(size,size*2.0,size);
        }else{
          const size=r.height*(r.kind==='olive'?.12:.15)*weight;
          obj.scale.set(size*(1+j%2*.15),size*.76,size);
        }
        obj.updateMatrix();
        const slot=evergreen?nNeedles++:nBroad++;
        mesh.setMatrixAt(slot,obj.matrix);
        c.setHex(palette).multiplyScalar(.81+(j%4)*.075);
        mesh.setColorAt(slot,c);
      }
    }
    branches.count=nBranches;broad.count=nBroad;needles.count=nNeedles;
    for(const mesh of [branches,broad,needles]){
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    active=detailedCount;
  }
  return {
    update,
    get active(){return active;},
    get drawCalls(){return 3;},
    get poolCapacity(){return maxTrees;},
    get fadeDistance(){return fadeDistance;},
    get updateCount(){return refreshes;},
    get scannedCandidates(){return scannedCandidates;},
    get spatialCells(){return cellIndex.size;},
    dispose(){
      for(const mesh of [branches,broad,needles]){
        scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
      }
    }
  };
}
