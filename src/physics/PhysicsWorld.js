// VE-04: Rapier is a bounded contact solver, not the owner of ecological motion.
// Sources are the same visible static triangles indexed by WorldQuery (VE-03).
export const PHYSICS_LIMITS=Object.freeze({
  activateDistance:145,deactivateDistance:185,patchRadius:345,
  patchShift:105,maxBodies:12,contactOffset:0.015
});
const sizes=Object.freeze({
  deer:{radius:.26,halfHeight:.40},
  fox:{radius:.16,halfHeight:.18},
  rabbit:{radius:.13,halfHeight:.12},
  bird:{radius:.13,halfHeight:.12}
});
const now=()=>performance.now();
const distanceSq=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
let rapierPromise=null;
// The compat WASM is lazy-loaded once, and its first decode is never repeated
// for world regeneration. A rejected initialization is retryable.
async function loadRapier(){
  if(!rapierPromise)rapierPromise=import('@dimforge/rapier3d-compat')
    .then(async mod=>{const rapier=mod.default??mod;await rapier.init();return rapier;})
    .catch(error=>{rapierPromise=null;throw error;});
  return rapierPromise;
}
export async function createPhysicsWorld({query,limits={},rapier=null}={}){
  const library=rapier??await loadRapier();
  return new PhysicsWorld({rapier:library,query,limits});
}
function collisionMeshes(query){
  if(query?.disposed||!Array.isArray(query?.sources))throw new TypeError('A live WorldQuery is required');
  return query.sources.filter(s=>s.kind==='terrain'||s.kind==='riverbed').map(s=>s.mesh);
}
// A cache of world-space vertices avoids re-transforming each vertex every
// time the observer changes patch. No copies of visual GPU geometry are changed.
function prepareMeshes(query){
  return collisionMeshes(query).map(mesh=>{
    mesh.updateWorldMatrix(true,false);
    const attr=mesh.geometry.getAttribute('position'),index=mesh.geometry.getIndex();
    const vertices=new Float32Array(attr.count*3),array=index?.array??null;
    const m=mesh.matrixWorld.elements;
    for(let i=0;i<attr.count;i++){
      const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i),j=i*3;
      vertices[j]=m[0]*x+m[4]*y+m[8]*z+m[12];
      vertices[j+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
      vertices[j+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
    }
    return {vertices,indices:array};
  });
}
// Exact terrain/riverbed triangles; water is not a solid wall. Sea and river
// surfaces remain queried with WorldQuery.sampleSurface(includeWater,time,rain).
export function extractLocalTriangles(prepared,center,radius){
  const output=[],radiusSq=radius*radius;
  for(const {vertices:v,indices} of prepared){
    const verts=[],triangles=[],count=indices?.length??v.length/3;
    for(let i=0;i<count;i+=3){
      const a=(indices?indices[i]:i)*3,b=(indices?indices[i+1]:i+1)*3,c=(indices?indices[i+2]:i+2)*3;
      const minX=Math.min(v[a],v[b],v[c]),maxX=Math.max(v[a],v[b],v[c]);
      const minZ=Math.min(v[a+2],v[b+2],v[c+2]),maxZ=Math.max(v[a+2],v[b+2],v[c+2]);
      const dx=Math.max(minX-center.x,0,center.x-maxX),dz=Math.max(minZ-center.z,0,center.z-maxZ);
      if(dx*dx+dz*dz>radiusSq)continue;
      const n=verts.length/3;
      verts.push(v[a],v[a+1],v[a+2],v[b],v[b+1],v[b+2],v[c],v[c+1],v[c+2]);
      triangles.push(n,n+1,n+2);
    }
    if(triangles.length)output.push({vertices:new Float32Array(verts),
      indices:new Uint32Array(triangles),triangles:triangles.length/3});
  }
  return output;
}
export class PhysicsWorld{
  constructor({rapier,query,limits={}}){
    if(!rapier?.World)throw new TypeError('Rapier WASM must be initialized');
    this.R=rapier;this.query=query;this.limits={...PHYSICS_LIMITS,...limits};
    this.world=new rapier.World({x:0,y:-9.81,z:0});
    this.controller=this.world.createCharacterController(this.limits.contactOffset);
    this.controller.enableSnapToGround(.35);
    this.controller.enableAutostep(.22,.08,false);
    this.entries=new Map();this.staticColliders=[];this.prepared=prepareMeshes(query);
    this.revision=query.surfaceRevision??0;
    this.patchCenter=null;this.patchTriangles=0;this.disposed=false;
    this.ticks=0;this.stepTotalMs=0;this.lastStepMs=0;this.buildTotalMs=0;
    this.maxStepMs=0;this.generatedPatches=0;this.contacts=0;
  }
  _assert(){if(this.disposed)throw new Error('PhysicsWorld has been disposed');}
  _patch(center){
    const started=now();
    for(const collider of this.staticColliders)this.world.removeCollider(collider,true);
    this.staticColliders.length=0;this.patchTriangles=0;
    const patches=extractLocalTriangles(this.prepared,center,this.limits.patchRadius);
    for(const mesh of patches){
      const desc=this.R.ColliderDesc.trimesh(mesh.vertices,mesh.indices);
      const collider=this.world.createCollider(desc);
      this.staticColliders.push(collider);this.patchTriangles+=mesh.triangles;
    }
    this.patchCenter={x:center.x,z:center.z};
    this.buildTotalMs+=now()-started;this.generatedPatches++;
  }
  _add(key,type,position){
    const size=sizes[type]??sizes.rabbit,offset=size.radius+size.halfHeight;
    const body=this.world.createRigidBody(
      this.R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x,position.y+offset,position.z)
    );
    const collider=this.world.createCollider(
      this.R.ColliderDesc.capsule(size.halfHeight,size.radius).setFriction(.9),body);
    const entry={body,collider,offset,type};
    this.entries.set(key,entry);return entry;
  }
  _remove(key){
    const entry=this.entries.get(key);
    if(!entry)return;
    this.world.removeRigidBody(entry.body);
    this.entries.delete(key);
  }
  replaceSurfaces(query){
    this._assert();
    for(const key of [...this.entries.keys()])this._remove(key);
    for(const collider of this.staticColliders)this.world.removeCollider(collider,true);
    this.staticColliders.length=0;
    this.query=query;this.prepared=prepareMeshes(query);
    this.revision=query.surfaceRevision??0;this.patchCenter=null;this.patchTriangles=0;
  }
  // Called exactly once per VE-02 fixed tick, after the ecological planner.
  // Renderer interpolation never advances Rapier a second time.
  step(actors,observer,dt,{bird=null,profile=null,time=0,rain=0}={}){
    this._assert();
    if(!valid(observer)||!Number.isFinite(dt)||dt<=0)throw new TypeError('Invalid fixed physics tick');
    if(Math.abs(dt-1/30)>1e-7)throw new RangeError('Physics expects VE-02 30 Hz timestep');
    if(this.query.surfaceRevision!==undefined&&this.query.surfaceRevision!==this.revision)
      this.replaceSurfaces(this.query);
    const started=now(),limits=this.limits;
    // Keep an existing collider until the farther hysteresis boundary.
    const candidates=actors.map((actor,index)=>({
      actor,key:actor,index,d2:distanceSq(actor.position,observer)
    })).filter(({actor,key,d2})=>
      valid(actor.position)&&d2<=(this.entries.has(key)?
        limits.deactivateDistance**2:limits.activateDistance**2)
    ).sort((a,b)=>a.d2-b.d2||a.index-b.index).slice(0,limits.maxBodies);
    const groundedBird=Boolean(bird&&profile&&bird.grounded&&!bird.floating&&
      bird.restSite?.kind==='ground'&&valid(bird));
    const birdKey='ground-bird';
    const wanted=new Set(candidates.map(c=>c.key));
    if(groundedBird)wanted.add(birdKey);
    for(const key of [...this.entries.keys()])if(!wanted.has(key))this._remove(key);
    if(wanted.size&&(!this.patchCenter||distanceSq(this.patchCenter,observer)>limits.patchShift**2))
      this._patch(observer);
    const movable=candidates.map(c=>({key:c.key,type:c.actor.userData.state.type,
      target:c.actor.position}));
    if(groundedBird)movable.push({key:birdKey,type:'bird',target:bird});
    const corrections=[];
    for(const item of movable){
      const surface=this.query.sampleSurface(item.target.x,item.target.z);
      if(!surface)continue;
      const target={x:item.target.x,y:item.target.y,z:item.target.z};
      // The rendered mesh is the authoritative floor, never an analytic heightfield.
      const minHeight=surface.y;
      if(target.y<minHeight)target.y=minHeight;
      let entry=this.entries.get(item.key);
      if(!entry)entry=this._add(item.key,item.type,target);
      const old=entry.body.translation(),desired={
        x:target.x-old.x,y:target.y+entry.offset-old.y,z:target.z-old.z
      };
      const travel=Math.hypot(desired.x,desired.y,desired.z);
      if(travel>8){
        // Reassignment from distant population is a new activation, not a
        // physically simulated long-distance teleport through mountains.
        entry.body.setTranslation({x:target.x,y:target.y+entry.offset,z:target.z},true);
        entry.body.setNextKinematicTranslation({x:target.x,y:target.y+entry.offset,z:target.z});
        corrections.push({item,position:target});
        continue;
      }
      this.controller.computeColliderMovement(entry.collider,desired);
      const corrected=this.controller.computedMovement();
      const targetBody={x:old.x+corrected.x,y:old.y+corrected.y,z:old.z+corrected.z};
      entry.body.setNextKinematicTranslation(targetBody);
      if(Math.abs(corrected.x-desired.x)+Math.abs(corrected.y-desired.y)+
        Math.abs(corrected.z-desired.z)>.001)this.contacts++;
      // Only commit the corrected pose after the single Rapier step.
      corrections.push({item,position:{x:targetBody.x,y:targetBody.y-entry.offset,z:targetBody.z}});
    }
    this.world.timestep=dt;
    this.world.step();
    for(const {item,position} of corrections){
      const ground=this.query.heightAt(position.x,position.z);
      if(ground===null)continue;
      const allowedAbove=item.type==='bird'?.25:item.type==='rabbit'?.40:.15;
      item.target.x=position.x;item.target.z=position.z;
      // Prevent geometrical penetrations and numerical hovering. Rabbit hop
      // is left to the ecological animation when its origin lifts from ground.
      item.target.y=item.type==='bird'?
        Math.max(item.target.y,ground,position.y):
        Math.max(ground,Math.min(position.y,ground+allowedAbove));
      if(item.type==='bird'&&bird){ // Ground contacts only; branches stay governed by the roost.
        const water=this.query.sampleSurface(bird.x,bird.z,{includeWater:true,time,rain});
        if(water?.water)bird.y=Math.max(bird.y,water.y);
      }
    }
    this.ticks++;this.lastStepMs=now()-started;
    this.stepTotalMs+=this.lastStepMs;this.maxStepMs=Math.max(this.maxStepMs,this.lastStepMs);
    return this.stats;
  }
  get stats(){
    return {enabled:!this.disposed,activeBodies:this.entries.size,maxBodies:this.limits.maxBodies,
      staticColliders:this.staticColliders.length,patchTriangles:this.patchTriangles,
      patches:this.generatedPatches,contacts:this.contacts,ticks:this.ticks,
      lastStepMs:+this.lastStepMs.toFixed(3),
      meanStepMs:+(this.stepTotalMs/Math.max(1,this.ticks)).toFixed(3),
      peakStepMs:+this.maxStepMs.toFixed(3),
      buildMs:+this.buildTotalMs.toFixed(3),
      estimatedPatchBytes:this.patchTriangles*48};
  }
  dispose(){
    if(this.disposed)return;
    for(const key of [...this.entries.keys()])this._remove(key);
    this.world.removeCharacterController(this.controller);
    this.staticColliders.length=0;this.prepared.length=0;
    this.world.free();this.disposed=true;
  }
}