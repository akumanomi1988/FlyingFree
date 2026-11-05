import {quadrupedGait,shouldReplantFoot,solveGroundedLeg} from './groundedLimb.js';

// Each actor owns four mutable contacts; meshes and geometry are created once.
// This controller is shared across actors and reuses its scratch vectors.
export function createQuadrupedLegRig(THREE,{create,legGeo,sphere,terrainHeight,seed}) {
  const up=new THREE.Vector3(0,1,0);
  const direction=new THREE.Vector3(),hipWorld=new THREE.Vector3();
  const footWorld=new THREE.Vector3(),footLocal=new THREE.Vector3();

  function addLeg(actor,side,z,type,coat,hoofMaterial) {
    const deer=type==='deer';
    const hipY=deer?1.08:.47;
    const upperLength=deer?.55:.24,lowerLength=deer?.56:.25;
    const hipX=side*(deer?.30:.25),width=deer?.70:.48;
    const upper=create(actor,legGeo,coat,hipX,hipY-upperLength*.5,z,width,upperLength,width);
    const lower=create(actor,legGeo,coat,hipX,.23,z,width*.78,lowerLength,width*.78);
    const hoof=create(actor,sphere,hoofMaterial,hipX,.075,z,
      deer?.14:.10,deer?.072:.055,deer?.19:.14);
    upper.userData.leg={side,z};
    const chain={upper,lower,hoof,hipX,hipY,hipZ:z,upperLength,lowerLength,width,
      planted:false,worldFoot:new THREE.Vector3(),gait:{},solution:{},footError:0};
    actor.userData.legs.push(upper);
    actor.userData.limbs.push(chain);
    return chain;
  }

  function orientSegment(mesh,x,fromY,fromZ,toY,toZ,width) {
    mesh.position.set(x,(fromY+toY)*.5,(fromZ+toZ)*.5);
    direction.set(0,toY-fromY,toZ-fromZ);
    const length=Math.max(.0001,direction.length());
    mesh.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));
    mesh.scale.set(width,length,width);
  }

  function pose(actor,t,running) {
    const type=actor.userData.state.type;
    const stride=type==='deer'?.32:.25;
    const frequency=type==='deer'?4.4:7;
    const scale=actor.scale.x;
    actor.updateWorldMatrix(true,false);
    let grounded=0;

    for(const chain of actor.userData.limbs) {
      const offset=actor.userData.state.seed+
        (chain.hipX<0?Math.PI:0)+(chain.hipZ>0?Math.PI:0);
      const gait=quadrupedGait(t,frequency,offset,chain.gait);
      const swinging=running&&gait.swing;
      hipWorld.set(chain.hipX,chain.hipY,chain.hipZ);
      actor.localToWorld(hipWorld);
      const separation=Math.hypot(hipWorld.x-chain.worldFoot.x,
        hipWorld.z-chain.worldFoot.z);

      if(swinging) {
        // Foot moves rear-to-front during swing, and is raised clear of grass.
        footWorld.set(chain.hipX,0,chain.hipZ+stride*(.5-gait.progress));
        actor.localToWorld(footWorld);
        footWorld.y=terrainHeight(footWorld.x,footWorld.z,seed)+.026*scale+
          gait.lift*(type==='deer'?.16:.14)*scale;
        chain.planted=false;
      } else {
        // Hold the touchdown position in WORLD coordinates during stance.
        if(shouldReplantFoot(chain.planted,separation,stride*scale*.85)) {
          footWorld.set(chain.hipX,0,chain.hipZ-stride*.18);
          actor.localToWorld(footWorld);
          footWorld.y=terrainHeight(footWorld.x,footWorld.z,seed)+.026*scale;
          chain.worldFoot.copy(footWorld);
          chain.planted=true;
        }
        footWorld.copy(chain.worldFoot);
        grounded++;
      }

      footLocal.copy(footWorld);
      actor.worldToLocal(footLocal);
      const ik=solveGroundedLeg(chain.hipY,chain.hipZ,footLocal.y,footLocal.z,
        chain.upperLength,chain.lowerLength,chain.hipZ<0?1:-1,chain.solution);
      orientSegment(chain.upper,chain.hipX,chain.hipY,chain.hipZ,
        ik.kneeY,ik.kneeZ,chain.width);
      orientSegment(chain.lower,chain.hipX,ik.kneeY,ik.kneeZ,
        ik.ankleY,ik.ankleZ,chain.width*.78);
      chain.hoof.position.set(footLocal.x,footLocal.y,footLocal.z);
      chain.footError=Math.hypot(ik.ankleY-footLocal.y,ik.ankleZ-footLocal.z);
    }
    actor.userData.groundedFeet=grounded;
  }

  return {addLeg,pose};
}
