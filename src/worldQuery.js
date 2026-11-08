import * as THREE from 'three';
import {MeshBVH, CENTER, estimateMemoryInBytes} from 'three-mesh-bvh';
import {habitatAt as classifyHabitat} from './ecology.js';
import {TROPICAL_WORLD} from './tropicalTerrain.js';
import {oceanSurfaceHeight} from './oceanMotion.js';

// VE-03: read-only spatial truth. The *rendered triangles*, not the procedural
// height function, determine contacts, normals, and mountain occlusion.
// Only finite, static terrain / riverbed / river-water meshes own a BVH.
// Instanced and wind-animated vegetation deliberately remains outside it.
const DOWN=new THREE.Vector3(0,-1,0);
const vec=value=>new THREE.Vector3(value.x,value.y,value.z);
const finitePoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);

export class WorldQuery {
  constructor({terrain,riverbed=null,riverWater=null,seed=1988,seaLevel=TROPICAL_WORLD.seaLevel}={}) {
    this.seed=seed;
    this.seaLevel=seaLevel;
    this.sources=[];
    this.disposed=false;
    this.queries=0;
    this.buildMs=0;
    this.bvhBytes=0;
    this._top=0;
    this.surfaceRevision=0;
    this.replaceSurfaces({terrain,riverbed,riverWater});
  }

  // Atomic replacement for a future deterministic chunk switch: no queries
  // can see a mixture of old and new collision triangles.
  replaceSurfaces({terrain,riverbed=null,riverWater=null}={}) {
    if(this.disposed)throw new Error('WorldQuery is disposed');
    if(!terrain?.isMesh)throw new TypeError('WorldQuery requires a terrain Mesh');
    const started=performance.now();
    const next=[];
    let bytes=0,top=-Infinity;
    for(const [kind,mesh] of [['terrain',terrain],['riverbed',riverbed],['river-water',riverWater]]){
      if(!mesh?.isMesh||!mesh.geometry?.getAttribute('position'))continue;
      const geometry=mesh.geometry;
      if(geometry.getIndex()?.count===0||geometry.getAttribute('position').count===0)continue;
      mesh.updateWorldMatrix(true,false);
      geometry.computeBoundingBox();
      const bounds=geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      const bvh=new MeshBVH(geometry,{strategy:CENTER,maxLeafTris:16,indirect:true});
      next.push({kind,mesh,bvh,bounds,inverse:mesh.matrixWorld.clone().invert()});
      bytes+=estimateMemoryInBytes(bvh);
      top=Math.max(top,bounds.max.y);
    }
    if(!next.some(s=>s.kind==='terrain'))throw new Error('Missing queryable terrain triangles');
    this.sources=next;
    this.surfaceRevision++;
    this.bvhBytes=bytes;
    this._top=top+10;
    this.buildMs=performance.now()-started;
    this.queries=0;
    return this.stats;
  }

  _cast(origin,direction,maxDistance=Infinity,includeWater=false) {
    const worldRay=new THREE.Ray(vec(origin),vec(direction).normalize());
    let best=null;
    for(const source of this.sources) {
      if(!includeWater&&source.kind==='river-water')continue;
      const localRay=worldRay.clone().applyMatrix4(source.inverse);
      const hit=source.bvh.raycastFirst(localRay,THREE.DoubleSide);
      if(!hit)continue;
      const point=hit.point.clone().applyMatrix4(source.mesh.matrixWorld);
      const distance=point.distanceTo(worldRay.origin);
      if(distance>maxDistance+1e-6||best&&distance>=best.distance)continue;
      const normal=hit.face?.normal?.clone().transformDirection(source.mesh.matrixWorld)??new THREE.Vector3(0,1,0);
      if(normal.y<0)normal.negate();
      best={x:point.x,y:point.y,z:point.z,distance,
        point:{x:point.x,y:point.y,z:point.z},
        normal:{x:normal.x,y:normal.y,z:normal.z},
        material:source.kind==='riverbed'?'sediment':source.kind==='river-water'?'river-water':'terrain',
        kind:source.kind,faceIndex:hit.faceIndex??null};
    }
    this.queries++;
    return best;
  }

  // Segment and direction raycasts share one BVH query implementation.
  // Water is excluded by default so river beds remain solid for contacts.
  raycast(origin,direction,{maxDistance=Infinity,includeWater=false}={}) {
    if(this.disposed)throw new Error('WorldQuery is disposed');
    if(!finitePoint(origin)||!finitePoint(direction)||vec(direction).lengthSq()===0)
      throw new TypeError('raycast requires finite origin and nonzero direction');
    return this._cast(origin,direction,maxDistance,includeWater);
  }

  sampleSurface(x,z,{includeWater=false,time=0,rain=0}={}) {
    if(this.disposed)throw new Error('WorldQuery is disposed');
    if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Invalid surface position');
    const ground=this._cast({x,y:this._top,z},DOWN,Infinity,false);
    if(!ground)return null; // Outside rendered terrain: never invent a collider.
    let hit=ground;
    if(includeWater){
      const river=this.sources.some(s=>s.kind==='river-water')?
        this._cast({x,y:this._top,z},DOWN,Infinity,true):ground;
      if(river&&river.kind==='river-water'&&river.y>ground.y+.01)hit=river;
      if(ground.y<this.seaLevel){
        const y=oceanSurfaceHeight(x,z,time,rain);
        if(y>hit.y)hit={x,y,z,distance:this._top-y,point:{x,y,z},
          normal:{x:0,y:1,z:0},material:'ocean-water',kind:'ocean-water',faceIndex:null};
      }
    }
    const habitat=classifyHabitat(x,z,this.seed);
    // The classification is seeded and stable; height and slope are geometric.
    const slope=Math.hypot(hit.normal.x,hit.normal.z)/Math.max(.001,hit.normal.y);
    habitat.height=hit.y;habitat.slope=slope;
    if(hit.kind==='ocean-water')habitat.type='ocean';
    else if(hit.kind==='river-water')habitat.type='wetland';
    return {...hit,habitat,water:hit.kind==='river-water'||hit.kind==='ocean-water'};
  }

  heightAt(x,z,options={}) {
    if(this.disposed)throw new Error('WorldQuery is disposed');
    if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Invalid surface position');
    if(options.includeWater)return this.sampleSurface(x,z,options)?.y??null;
    return this._cast({x,y:this._top,z},DOWN)?.y??null;
  }
  normalAt(x,z){return this.sampleSurface(x,z)?.normal??null;}
  materialAt(x,z){return this.sampleSurface(x,z)?.material??null;}
  habitatAt(x,z){return this.sampleSurface(x,z)?.habitat??null;}

  lineOfSight(from,to,{clearance=0,includeWater=false}={}) {
    if(!finitePoint(from)||!finitePoint(to))throw new TypeError('Invalid sight segment');
    const dir=vec(to).sub(vec(from));
    const length=dir.length();
    if(length<=1e-8)return true;
    dir.multiplyScalar(1/length);
    // Ignore self-intersection at a bird's feet or the camera's near plane.
    const epsilon=Math.min(.03,length*.01);
    const start=vec(from).addScaledVector(dir,epsilon);
    start.y+=Math.max(0,clearance);
    return !this.raycast(start,dir,{
      maxDistance:Math.max(0,length-epsilon-.03),includeWater
    });
  }

  get stats(){
    return {sources:this.sources.map(s=>s.kind),bvhBytes:this.bvhBytes,
      buildMs:+this.buildMs.toFixed(2),queries:this.queries};
  }

  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    // Geometry and GPU buffers belong to the scene adapter, not WorldQuery.
    this.sources.length=0;
    this.bvhBytes=0;
  }
}

export function createWorldQuery(options){return new WorldQuery(options);}
