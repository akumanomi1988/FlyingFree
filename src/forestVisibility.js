// Fixed-budget forest visibility: keep a dense canopy around the subject,
// while thinning distant trees without creating/removing GPU objects.
// Original instance matrices/colors are cached once. Repacking happens at
// most ~1 Hz and retains the same eight draw calls as the original forest.
import {clamp,terrainHeight} from './core.js';

export function forestDensity(distance,quality=1) {
 const q=clamp(quality,.45,1);
 if(distance<340)return 1;
 if(distance<780)return .78+.22*q;
 if(distance<1480)return .35+.40*q;
 return .12+.30*q;
}

export function createForestVisibility(meshes,records,seed=1988,{radius=2600}={}) {
 const entries=Object.entries(meshes).map(([name,mesh])=>{
  if(!mesh?.isInstancedMesh)throw new TypeError('Forest visibility expects instanced '+name);
  return {name,mesh,matrices:mesh.instanceMatrix.array.slice(),
   colors:mesh.instanceColor?.array.slice()??null,count:mesh.count,shown:0};
 });
 const byName=Object.fromEntries(entries.map(x=>[x.name,x]));
 const expected=['trunk','lower','upper','broad','cypress','olive','birch','palmLeaves'];
 for(const name of expected)if(!byName[name])throw new TypeError('Forest mesh missing '+name);
 let quality=1,lastX=Infinity,lastZ=Infinity,lastTime=-Infinity,
  lastRadius=0,lastVisible=records.length,refreshes=0;
 const randomForIndex=i=>((Math.imul(i+1234,2654435761)^seed)>>>0)/4294967296;
 // Copy whole matrix/color only when an instance survives. Never allocate
 // new buffer attributes, temporary matrices or colors while moving.
 function copy(name,sourceIndex,outputIndex) {
  const entry=byName[name],mi=sourceIndex*16,mo=outputIndex*16;
  const dest=entry.mesh.instanceMatrix.array,src=entry.matrices;
  for(let k=0;k<16;k++)dest[mo+k]=src[mi+k];
  if(entry.colors){
   const cd=entry.mesh.instanceColor.array,cs=entry.colors;
   const ci=sourceIndex*3,co=outputIndex*3;
   for(let k=0;k<3;k++)cd[co+k]=cs[ci+k];
  }
  entry.shown=outputIndex+1;
 }
 function refresh(camera,t=0){
  const x=camera.x,z=camera.z;
  const above=Math.max(0,camera.y-terrainHeight(x,z,seed));
  const activeRadius=radius*(.72+.28*quality)+Math.min(950,above*.38);
  const moved=Math.hypot(x-lastX,z-lastZ);
  if(t-lastTime<.70&&moved<70&&Math.abs(lastRadius-activeRadius)<130)
   return false;
  lastTime=t;lastX=x;lastZ=z;lastRadius=activeRadius;
  for(const entry of entries)entry.shown=0;
  let pines=0,deciduous=0,cypresses=0,olives=0,birches=0,palms=0,accepted=0;
  const r2=activeRadius*activeRadius;
  for(let i=0;i<records.length;i++){
   const tr=records[i],kind=tr.kind;
   const dx=tr.x-x,dz=tr.z-z,d2=dx*dx+dz*dz;
   const keep=d2<=r2&&randomForIndex(i)<forestDensity(Math.sqrt(d2),quality);
   if(keep){
    accepted++;
    copy('trunk',i,byName.trunk.shown);
    if(kind==='palm'){
     for(let j=0;j<7;j++)
      copy('palmLeaves',palms*7+j,byName.palmLeaves.shown);
    }else if(kind==='cypress')copy('cypress',cypresses,byName.cypress.shown);
    else if(kind==='olive')copy('olive',olives,byName.olive.shown);
    else if(kind==='birch')copy('birch',birches,byName.birch.shown);
    else if(kind==='oak'||kind==='mangrove')copy('broad',deciduous,byName.broad.shown);
    else{
     copy('lower',pines,byName.lower.shown);
     copy('upper',pines,byName.upper.shown);
    }
   }
   // The source indices must advance for invisible trees too.
   if(kind==='palm')palms++;
   else if(kind==='cypress')cypresses++;
   else if(kind==='olive')olives++;
   else if(kind==='birch')birches++;
   else if(kind==='oak'||kind==='mangrove')deciduous++;
   else pines++;
  }
  for(const entry of entries){
   entry.mesh.count=entry.shown;
   entry.mesh.instanceMatrix.needsUpdate=true;
   if(entry.colors)entry.mesh.instanceColor.needsUpdate=true;
  }
  refreshes++;lastVisible=accepted;
  return true;
 }
 return {
  update:refresh,
  setQuality(q){
   if(!Number.isFinite(q))return;
   const next=clamp(q,.45,1);
   if(Math.abs(next-quality)>.01){quality=next;lastTime=-Infinity;}
  },
  get stats(){return {visible:lastVisible,total:records.length,
   radius:Math.round(lastRadius),quality,refreshes,drawCalls:entries.length};}
 };
}
