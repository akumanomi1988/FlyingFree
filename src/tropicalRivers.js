import {
  tropicalRiverFrame,tropicalTerrainHeight,TROPICAL_WORLD
} from './tropicalTerrain.js';

// A river is a cross-section cut into the SAME relief used by collision,
// flora and animal placement, not a two-vertex colored ribbon floating in air.
// The immutable 3D channel bed and the moving water layer use 2 draw calls.
export function createTropicalRivers(THREE,scene,seed=1988){
 const waterPositions=[],waterColors=[],waterUV=[],waterRapid=[],waterIndices=[];
 const bedPositions=[],bedColors=[],bedUV=[],bedIndices=[];
 const waterBands=[-1,-.92,-.72,-.4,0,.4,.72,.92,1];
 const bedBands=[-2.18,-1.67,-1.31,-1.095,-.99,-.84,-.53,0,.53,.84,.99,1.095,1.31,1.67,2.18];
 const sample={},waterSegments=310;
 let visibleSegments=0,bankSegments=0,gradientSum=0,maxSlope=0;
 function pushVertex(positions,x,y,z){positions.push(x,y,z);}
 function quad(indices,prev,base,bands){
  for(let b=0;b<bands-1;b++){
   const a=prev+b,bb=prev+b+1,c=base+b,d=base+b+1;
   indices.push(a,c,bb,bb,c,d);
  }
 }
 // Avoid cracks: no triangles connect discontinuous river sections or
 // sections that have already entered the sea.
 for(let channel=0;channel<TROPICAL_WORLD.riverCount;channel++){
  let lastWater=null,lastBed=null;
  for(let i=0;i<=waterSegments;i++){
   const t=.105+(1.02-.105)*i/waterSegments;
   tropicalRiverFrame(channel,t,seed,sample);
   const centerLand=tropicalTerrainHeight(sample.x,sample.z,seed);
   if(sample.waterY<=TROPICAL_WORLD.seaLevel+.21||
      centerLand<TROPICAL_WORLD.seaLevel-1.5){
    lastWater=null;lastBed=null;continue;
   }
   const half=sample.halfWidth,dy=sample.waterY,depth=sample.bedDepth;
   const longitudinal=t*(TROPICAL_WORLD.extent/2)/48;
   // Water is a smoothly sampled polygon strip, with banks following the
   // actual channel width and three levels of shallow-water coloration.
   const wi=waterPositions.length/3;
   for(const band of waterBands){
    const dist=band*half,edge=Math.abs(band);
    const x=sample.x+sample.nx*dist,z=sample.z+sample.nz*dist;
    pushVertex(waterPositions,x,dy+.028*(1-edge),z);
    const shallows=Math.pow(edge,3.2);
    const jitter=.028*Math.sin(t*155+band*12+seed*.017);
    waterColors.push(.048+.092*shallows+jitter*.20,
      .275+.135*shallows+jitter,.275+.09*shallows+jitter*.68);
    waterUV.push((band+1)*.5,longitudinal);
    waterRapid.push(sample.slope);
   }
   if(lastWater!==null){quad(waterIndices,lastWater,wi,waterBands.length);visibleSegments++;}
   lastWater=wi;
   gradientSum+=sample.slope;maxSlope=Math.max(maxSlope,sample.slope);
   const bi=bedPositions.length/3;
   for(const band of bedBands){
    const edge=Math.abs(band),dist=band*half;
    const x=sample.x+sample.nx*dist,z=sample.z+sample.nz*dist;
    const ground=tropicalTerrainHeight(x,z,seed);
    let y;
    if(edge<=.99){
     y=dy-depth*(1-Math.pow(edge,1.7))-.07;
    }else if(edge<=1.095){
     y=dy-.065+(edge-.99)/.105*.35;
    }else{
     const blend=Math.min(1,(edge-1.095)/1.085);
     const eased=blend*blend*(3-2*blend);
     // Ridges remain part of the actual terrain, but a continuous
     // sediment shoulder conceals 48 m cells cutting through the banks.
     y=(dy+.285)*(1-eased)+Math.max(ground+.09,dy+.2*(1-eased))*eased;
    }
    pushVertex(bedPositions,x,y,z);
    let r,g,b;
    if(edge<.88){r=.19;g=.215;b=.168;} // dark submerged stones
    else if(edge<1.075){r=.35;g=.34;b=.255;} // wet gravel
    else if(edge<1.33){r=.45;g=.405;b=.288;} // sand and pebbles
    else{r=.235;g=.32;b=.23;} // planted banks
    const variation=1+.085*Math.sin(t*389+band*17+channel*2.3)+
      .045*Math.cos(t*93+band*31+seed);
    bedColors.push(r*variation,g*variation,b*variation);
    bedUV.push((band+2.18)/4.36,longitudinal);
   }
   if(lastBed!==null){quad(bedIndices,lastBed,bi,bedBands.length);bankSegments++;}
   lastBed=bi;
  }
 }
 function geometry(positions,colors,uvs,indices,rapid=null){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if(rapid)g.setAttribute('riverRapid',new THREE.Float32BufferAttribute(rapid,1));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
 }
 const bedGeometry=geometry(bedPositions,bedColors,bedUV,bedIndices);
 const bedMaterial=new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide
 });
 const bed=new THREE.Mesh(bedGeometry,bedMaterial);
 bed.name='natural-riverbed-and-banks';bed.frustumCulled=false;
 scene.add(bed);
 const waterGeometry=geometry(waterPositions,waterColors,waterUV,waterIndices,waterRapid);
 const flowTime={value:0};
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.29,metalness:.05,
  transparent:false,side:THREE.DoubleSide,depthWrite:true
 });
 material.onBeforeCompile=shader=>{
  shader.uniforms.uRiverFlowTime=flowTime;
  shader.vertexShader=shader.vertexShader.replace('void main() {',
   'attribute float riverRapid;\nvarying vec2 vRiverFlowUV;\nvarying float vRiverRapid;\nvoid main() {\n vRiverFlowUV=uv; vRiverRapid=riverRapid;');
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',
   'varying vec2 vRiverFlowUV;\nvarying float vRiverRapid;\nuniform float uRiverFlowTime;\nvoid main() {');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   `#include <color_fragment>
    // Flow follows the river's lengthwise UV; micro-ripples run along the
    // current and shallows show smaller, faster patterns than deep pools.
    float v=vRiverFlowUV.y, u=vRiverFlowUV.x;
    float drift=uRiverFlowTime;
    float longWave=sin(v*3.9-drift*1.65+sin(u*23.0+v*.37)*1.4);
    float crossWave=sin(v*8.4-drift*2.9+u*35.0)*.25;
    float fine=sin(v*18.6-drift*4.2+u*71.0)*.12;
    float eddy=sin(u*15.0+v*2.8-drift*.92);
    float sparkle=.5+.5*(longWave*.56+crossWave+fine);
    float bankFoam=pow(abs(u*2.0-1.0),8.0);
    float rapid=clamp(vRiverRapid*11.0,0.0,1.0);
    float streak=smoothstep(.64,.90,sparkle+.15*eddy);
    float foam=bankFoam*.045+rapid*streak*.53;
    diffuseColor.rgb*=.82+.24*sparkle;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.84,.72),foam);
   `);
 };
 material.customProgramCacheKey=()=> 'hydrologic-river-flow-v2';
 const mesh=new THREE.Mesh(waterGeometry,material);
 mesh.name='hydrologic-flowing-river-water';
 mesh.frustumCulled=false;
 scene.add(mesh);
 return {mesh,bed,channels:TROPICAL_WORLD.riverCount,segments:visibleSegments,
  bankSegments,stats:{waterVertices:waterPositions.length/3,
   bankVertices:bedPositions.length/3,waterTriangles:waterIndices.length/3,
   bankTriangles:bedIndices.length/3,drawCalls:2,
   meanSlope:visibleSegments?+(gradientSum/Math.max(1,visibleSegments)).toFixed(4):0,
   maxSlope:+maxSlope.toFixed(4)},
  update(time){flowTime.value=Number.isFinite(time)?time:0;},
  get flowTime(){return flowTime.value;},
  dispose(){
   scene.remove(mesh);scene.remove(bed);
   waterGeometry.dispose();bedGeometry.dispose();
   material.dispose();bedMaterial.dispose();
  }};
}
