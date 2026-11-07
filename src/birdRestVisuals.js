// The active subject can land on a branch associated with an actual tree.
// This geometry supplements a specific instanced canopy; it is never a
// free-floating perch chosen independently of the tree records.
export function createBirdRestVisuals(THREE,scene){
 const root=new THREE.Group();root.name='bird-contact-perch';
 const bark=new THREE.MeshStandardMaterial({color:0x756149,roughness:1});
 const leaf=new THREE.MeshStandardMaterial({color:0x568c5c,roughness:1,side:THREE.DoubleSide});
 const wood=new THREE.CylinderGeometry(.12,.21,1,9);
 const foliage=new THREE.SphereGeometry(1,8,6);
 const branch=new THREE.Mesh(wood,bark),buds=[];
 root.add(branch);
 for(let i=0;i<3;i++){
  const m=new THREE.Mesh(foliage,leaf);
  m.scale.set(.23,.09,.42);root.add(m);buds.push(m);
 }
 scene.add(root);root.visible=false;
 const start=new THREE.Vector3(),end=new THREE.Vector3(),vec=new THREE.Vector3();
 const midpoint=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 let lastKey='';
 function update(action,cameraPosition=null){
  const site=action?.restSite;
  const same=site?.kind==='branch'&&Number.isFinite(site.anchorX)&&
   Number.isFinite(site.anchorY)&&Number.isFinite(site.anchorZ)&&
   Number.isFinite(site.branchY);
  const close=site&&Math.hypot(action.x-site.x,action.z-site.z)<180;
  const cameraNear=Boolean(site&&(!cameraPosition||
    Math.hypot(cameraPosition.x-site.x,cameraPosition.z-site.z)<240));
  root.visible=Boolean(same&&close&&cameraNear);
  if(!root.visible)return {visible:false,kind:site?.kind??null};
  const key=[site.x,site.y,site.z,site.anchorX,site.anchorY,site.anchorZ].join(':');
  if(lastKey!==key){
   lastKey=key;
   start.set(site.anchorX,site.anchorY,site.anchorZ);
   end.set(site.x,site.branchY,site.z);
   vec.subVectors(end,start);
   const length=Math.max(.01,vec.length());
   midpoint.copy(start).addScaledVector(vec,.5);
   branch.position.copy(midpoint);
   branch.quaternion.setFromUnitVectors(up,vec.multiplyScalar(1/length));
   branch.scale.set(Math.min(2,length*.22),length,Math.min(2,length*.22));
   for(let i=0;i<buds.length;i++){
    const v=(i+1)/4;
    buds[i].position.copy(start).lerp(end,v);
    buds[i].position.x+=(i%2?1:-1)*.3;
    buds[i].position.y+=.11;
    buds[i].rotation.set(0,i*1.78,Math.sin(i*2)*.32);
   }
  }
  return {visible:true,kind:'branch',length:start.distanceTo(end)};
 }
 return {root,update,dispose(){
  scene.remove(root);wood.dispose();foliage.dispose();bark.dispose();leaf.dispose();
 }};
}
