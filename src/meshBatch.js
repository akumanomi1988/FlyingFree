import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Collapses rigid child meshes sharing a material into one indexed draw call.
// Only run when constructing a rig. Animated joints stay as separate Groups.
export function batchStaticMeshes(THREE,parent) {
  const buckets=new Map();
  for(const mesh of parent.children){
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.morphTargetInfluences||Array.isArray(mesh.material))continue;
    const geometry=mesh.geometry;
    if(!geometry?.index)continue;
    const attrs=Object.keys(geometry.attributes).sort().map(k=>k+':'+geometry.getAttribute(k).itemSize).join(',');
    const key=mesh.material.uuid+'|'+attrs;
    let bucket=buckets.get(key);
    if(!bucket){bucket=[];buckets.set(key,bucket);}
    bucket.push(mesh);
  }
  let before=0,after=0;
  for(const group of buckets.values()){
    before+=group.length;
    if(group.length<2){after+=group.length;continue;}
    const temporary=[];
    for(const mesh of group){
      mesh.updateMatrix();
      temporary.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
    }
    const merged=mergeGeometries(temporary,false);
    for(const geo of temporary)geo.dispose();
    if(!merged){after+=group.length;continue;}
    const combined=new THREE.Mesh(merged,group[0].material);
    combined.name='rigid-plumage-batch';
    for(const mesh of group)parent.remove(mesh);
    parent.add(combined);
    after++;
  }
  return {before,after,drawCallsSaved:before-after};
}
