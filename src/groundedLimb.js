// Two-bone IK for quadrupeds. Solves in the animal's local Y/Z plane so
// hooves stay on the height field even when the body follows a hillside.
export function solveGroundedLeg(hipY,hipZ,footY,footZ,upper,lower,bend=1,out={}) {
  if(![hipY,hipZ,footY,footZ,upper,lower,bend].every(Number.isFinite)
    ||upper<=0||lower<=0)throw new RangeError('Invalid leg dimensions');
  const dy=footY-hipY,dz=footZ-hipZ;
  const distance=Math.max(1e-8,Math.hypot(dy,dz));
  const reach=Math.max(Math.abs(upper-lower)+1e-5,
    Math.min(distance,upper+lower-1e-5));
  const uy=dy/distance,uz=dz/distance;
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
  const offset=Math.sqrt(Math.max(0,upper*upper-along*along))*(bend>=0?1:-1);
  out.kneeY=hipY+uy*along-uz*offset;
  out.kneeZ=hipZ+uz*along+uy*offset;
  out.ankleY=hipY+uy*reach;
  out.ankleZ=hipZ+uz*reach;
  out.clamped=Math.abs(distance-reach)>1e-4;
  return out;
}

export function quadrupedGait(t,rate,offset=0,out={}) {
  const phase=((t*rate+offset)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  out.swing=phase<Math.PI;
  out.progress=out.swing?phase/Math.PI:(phase-Math.PI)/Math.PI;
  out.lift=out.swing?Math.sin(phase):0;
  return out;
}

// A single mutable foot contact is retained in world coordinates throughout
// the stance phase. Replant only after swing, or if unreachable after a jump.
export function shouldReplantFoot(wasPlanted,worldDistance,maxReach){
  return !wasPlanted||!Number.isFinite(worldDistance)||worldDistance>maxReach;
}
