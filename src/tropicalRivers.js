import {tropicalRiverPoint,tropicalTerrainHeight,TROPICAL_WORLD} from './tropicalTerrain.js';

// Three source-to-coast river courses are derived from the same seed and
// valley carving as the terrain. A single mesh (three groups) adds < 1000 tris.
export function createTropicalRivers(THREE,scene,seed=1988){
  const positions=[],indices=[],colors=[];
  let visibleSegments=0;
  const left={};const right={};const center={};
  for(let channel=0;channel<TROPICAL_WORLD.riverCount;channel++){
    const count=116;
    let last=null;
    for(let i=0;i<=count;i++){
      const t=.085+i/count*.88;
      tropicalRiverPoint(channel,t,seed,center);
      const surface=tropicalTerrainHeight(center.x,center.z,seed);
      if(surface<TROPICAL_WORLD.seaLevel-1){last=null;continue;}
      tropicalRiverPoint(channel,Math.min(.99,t+.002),seed,right);
      tropicalRiverPoint(channel,Math.max(.01,t-.002),seed,left);
      const dx=right.x-left.x,dz=right.z-left.z;
      const size=Math.hypot(dx,dz)||1;
      const nx=-dz/size,nz=dx/size;
      const width=9+20*t+Math.sin(t*19+channel)*2;
      const y=surface+2.2;
      const base=positions.length/3;
      positions.push(center.x-nx*width,y,center.z-nz*width,
        center.x+nx*width,y,center.z+nz*width);
      const tone=.77+.18*(1-t);
      colors.push(.065*tone,.43*tone,.47*tone,
        .065*tone,.43*tone,.47*tone);
      if(last!==null){
        indices.push(last,last+1,base,last+1,base+1,base);
        visibleSegments++;
      }
      last=base;
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.21,metalness:.08,
    transparent:true,opacity:.91,side:THREE.DoubleSide,depthWrite:true
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='seeded-tropical-river-water';
  mesh.frustumCulled=false;
  scene.add(mesh);
  return {mesh,channels:TROPICAL_WORLD.riverCount,segments:visibleSegments,
    dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
