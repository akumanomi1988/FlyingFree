import {tropicalRiverPoint,tropicalTerrainHeight,TROPICAL_WORLD} from './tropicalTerrain.js';

// Three source-to-coast river courses are derived from the same seed and
// valley carving as the terrain. A single mesh (three groups) adds < 1000 tris.
export function createTropicalRivers(THREE,scene,seed=1988){
  const positions=[],indices=[],colors=[],uvs=[];
  let visibleSegments=0;
  const left={};const right={};const center={};
  for(let channel=0;channel<TROPICAL_WORLD.riverCount;channel++){
    const count=156;
    let last=null;
    for(let i=0;i<=count;i++){
      const t=.085+i/count*.947;
      tropicalRiverPoint(channel,t,seed,center);
      const surface=tropicalTerrainHeight(center.x,center.z,seed);
      // Stop water surface exactly as it reaches the ocean; the ocean mesh
      // takes over at the coastline. t is seed-specific and extends offshore.
      if(surface<TROPICAL_WORLD.seaLevel){last=null;continue;}
      tropicalRiverPoint(channel,Math.min(.99,t+.002),seed,right);
      tropicalRiverPoint(channel,Math.max(.01,t-.002),seed,left);
      const dx=right.x-left.x,dz=right.z-left.z;
      const size=Math.hypot(dx,dz)||1;
      const nx=-dz/size,nz=dx/size;
      const width=9+20*t+Math.sin(t*19+channel)*2;
      const y=surface+.45;
      const base=positions.length/3;
      positions.push(center.x-nx*width,y,center.z-nz*width,
        center.x+nx*width,y,center.z+nz*width);
      const tone=.77+.18*(1-t);
      colors.push(.065*tone,.43*tone,.47*tone,
        .065*tone,.43*tone,.47*tone);
      // Longitudinal UVs follow the seeded flow, not the world axes.
      uvs.push(0,t*75,1,t*75);
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
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.21,metalness:.08,
    transparent:true,opacity:.91,side:THREE.DoubleSide,depthWrite:true
  });
  // Flow, shallow-water caustics and bank foam use one GPU shader uniform
  // instead of rebuilding water geometry on every animation frame.
  const flowTime={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uRiverFlowTime=flowTime;
    shader.vertexShader=shader.vertexShader.replace('void main() {',
      'varying vec2 vRiverFlowUV;\nvoid main() {\n vRiverFlowUV=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('void main() {',
      'varying vec2 vRiverFlowUV;\nuniform float uRiverFlowTime;\nvoid main() {');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
      float streamPhase=vRiverFlowUV.y*2.7-uRiverFlowTime*1.7;
      float waves=sin(streamPhase+sin(vRiverFlowUV.x*13.0+uRiverFlowTime*.8)*1.6);
      waves+=.45*sin(streamPhase*2.2+vRiverFlowUV.x*17.0-uRiverFlowTime*.6);
      float ripples=waves*.5+.5;
      float bankFoam=pow(abs(vRiverFlowUV.x*2.0-1.0),7.0);
      float spray=smoothstep(.78,.97,ripples)*bankFoam;
      diffuseColor.rgb*=.87+.15*ripples;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.91,.88),spray*.48);
      `);
  };
  material.customProgramCacheKey=()=> 'river-flow-v1';
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='seeded-tropical-river-water';
  mesh.frustumCulled=false;
  scene.add(mesh);
  return {mesh,channels:TROPICAL_WORLD.riverCount,segments:visibleSegments,
    update(time){flowTime.value=Number.isFinite(time)?time:0;},
    get flowTime(){return flowTime.value;},
    dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
