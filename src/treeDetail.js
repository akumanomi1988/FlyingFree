// High-detail tree layer, pooled and updated at low frequency.
// Original instanced trunks/canopies remain as the stable far LOD.
// Nearby branches and crown clusters scale in over 30 metres, avoiding hard popping.
export const TREE_DETAIL_RADIUS=145;
export const TREE_DETAIL_FADE_START=100;
export const TREE_DETAIL_POOL=48;

export function treeDetailWeight(distance,near=TREE_DETAIL_FADE_START,far=TREE_DETAIL_RADIUS){
  if(!Number.isFinite(distance)||distance>=far)return 0;
  if(distance<=near)return 1;
  const t=(far-distance)/(far-near);
  return t*t*(3-2*t);
}

export function createTreeDetail(THREE,scene,records,quality=1){
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
  const up=new THREE.Vector3(0,1,0),start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3();
  const obj=new THREE.Object3D(),c=new THREE.Color();
  for(const mesh of [branches,broad,needles]){
    mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
  }
  let lastTime=-Infinity,lastX=Infinity,lastY=Infinity,lastZ=Infinity,active=0;

  function update(position,t){
    const dx=position.x-lastX,dy=position.y-lastY,dz=position.z-lastZ;
    if(t-lastTime<.42&&(dx*dx+dy*dy+dz*dz)<225)return;
    lastX=position.x;lastY=position.y;lastZ=position.z;lastTime=t;
    const visible=[];
    for(const record of records){
      const x=record.x-position.x,z=record.z-position.z,y=record.y+record.height*.6-position.y;
      const d2=x*x+y*y+z*z;
      if(d2<TREE_DETAIL_RADIUS*TREE_DETAIL_RADIUS)visible.push({record,d2});
    }
    visible.sort((a,b)=>a.d2-b.d2);
    let nBranches=0,nBroad=0,nNeedles=0;
    const limit=Math.min(visible.length,maxTrees);
    for(let index=0;index<limit;index++){
      const {record:r,d2}=visible[index],weight=treeDetailWeight(Math.sqrt(d2));
      if(weight<=.001)continue;
      const evergreen=['pine','cypress'].includes(r.kind);
      const crownY=r.kind==='cypress'?.55:r.kind==='pine'?.63:r.kind==='olive'?.67:.70;
      const spread=r.kind==='cypress'?.12:r.kind==='pine'?.23:r.kind==='olive'?.34:.31;
      const palette=r.kind==='pine'?0x557c56:r.kind==='cypress'?0x376d50:
        r.kind==='olive'?0x929f74:r.kind==='birch'?0x8eae84:0x8baa70;
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
        const radius=r.height*spread*(.40+(j%3)*.21);
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
    active=limit;
  }
  return {
    update,
    get active(){return active;},
    get drawCalls(){return 3;},
    get poolCapacity(){return maxTrees;},
    dispose(){
      for(const mesh of [branches,broad,needles]){
        scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
      }
    }
  };
}
