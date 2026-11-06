// Ocean displacement shared with the flight controller. Keep the four sine
// terms synchronized with src/renderfx.js (ocean vertex shader).
// The ocean mesh has 190x190 triangles on a 17 km plane; sampling the same
// tessellation is necessary because an analytic point wave may lie ABOVE the
// rendered triangles, making floating birds appear submerged.
export const OCEAN_BASE_HEIGHT=-9;
export const OCEAN_PLANE_SIZE=17000;
export const OCEAN_SEGMENTS=300;

export function oceanWave(x,z,time,storm=0){
  return Math.sin(x*.011+time*.61)*2.0
    +Math.sin(z*.008-time*.50)*1.8
    +Math.sin((x+z)*.019+time*1.07)*(1.1+storm*1.0)
    +Math.sin(x*.027-z*.016+time*.81)*.45;
}

// Triangle interpolation follows PlaneGeometry's a-b-d / b-c-d indexing
// after rotateX(-PI/2). The float and the GPU mesh consequently touch at
// the same visible surface even for the coarser far-ocean geometry.
export function oceanSurfaceHeight(x,z,time,storm=0){
  const cell=OCEAN_PLANE_SIZE/OCEAN_SEGMENTS,half=OCEAN_PLANE_SIZE*.5;
  const u=Math.max(0,Math.min(OCEAN_SEGMENTS-1e-9,(x+half)/cell));
  const v=Math.max(0,Math.min(OCEAN_SEGMENTS-1e-9,(z+half)/cell));
  const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
  const x0=ix*cell-half,z0=iz*cell-half;
  const h00=oceanWave(x0,z0,time,storm);
  const h10=oceanWave(x0+cell,z0,time,storm);
  const h01=oceanWave(x0,z0+cell,time,storm);
  if(fx+fz<=1)
    return OCEAN_BASE_HEIGHT+h00*(1-fx-fz)+h10*fx+h01*fz;
  const h11=oceanWave(x0+cell,z0+cell,time,storm);
  return OCEAN_BASE_HEIGHT+h01*(1-fx)+h10*(1-fz)+h11*(fx+fz-1);
}

export function oceanFloatPose(x,z,time,storm=0,wingspan=1.2,out={}){
  const y=oceanSurfaceHeight(x,z,time,storm);
  const step=3;
  const gradX=(oceanSurfaceHeight(x+step,z,time,storm)-oceanSurfaceHeight(x-step,z,time,storm))/(2*step);
  const gradZ=(oceanSurfaceHeight(x,z+step,time,storm)-oceanSurfaceHeight(x,z-step,time,storm))/(2*step);
  // The hull of a floating bird is partially submerged, but the chest stays
  // above the surface. Small angular responses suggest buoyancy without
  // producing a boat-like roll or wild rocking under heavy weather.
  out.y=y+Math.max(.045,wingspan*.042);
  out.pitch=Math.max(-.085,Math.min(.085,-Math.atan(gradZ)*.42));
  out.roll=Math.max(-.085,Math.min(.085,Math.atan(gradX)*.42));
  return out;
}
