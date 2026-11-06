import {TROPICAL_WORLD,tropicalTerrainHeight} from './tropicalTerrain.js';

// A bounded signed height field, in metres, encoded as one 8-bit texture
// channel. Only the near-sea range is needed by the water shader; mountains
// are clamped intentionally. Uint8 + linear filtering works on WebGL 1 & 2,
// avoiding float-texture extension requirements on TVs and integrated GPUs.
export const COAST_HEIGHT_MIN=-96;
export const COAST_HEIGHT_MAX=96;
export const COAST_HEIGHT_SIZE=320;

export function encodeCoastHeight(height){
  if(!Number.isFinite(height))throw new RangeError('Invalid terrain elevation');
  const t=Math.max(0,Math.min(1,(height-COAST_HEIGHT_MIN)/(COAST_HEIGHT_MAX-COAST_HEIGHT_MIN)));
  return Math.round(t*255);
}
export function decodeCoastHeight(value){
  return COAST_HEIGHT_MIN+value/255*(COAST_HEIGHT_MAX-COAST_HEIGHT_MIN);
}

// The pixels follow the same X/Z world coordinates as the island: -extent/2
// to +extent/2. Shader UV has no hardcoded centre, phase, or coast outline.
export function createCoastHeightData(seed=1988,size=COAST_HEIGHT_SIZE,extent=TROPICAL_WORLD.extent){
  if(!Number.isInteger(size)||size<8||size>2048||!(extent>0))throw new RangeError('Invalid coast texture size');
  const data=new Uint8Array(size*size*4),half=extent/2;
  for(let z=0;z<size;z++){
    const wz=(z+.5)/size*extent-half;
    for(let x=0;x<size;x++){
      const wx=(x+.5)/size*extent-half;
      const byte=encodeCoastHeight(tropicalTerrainHeight(wx,wz,seed));
      const i=(z*size+x)*4;
      data[i]=byte;data[i+1]=byte;data[i+2]=byte;data[i+3]=255;
    }
  }
  return {seed,size,extent,data,minHeight:COAST_HEIGHT_MIN,maxHeight:COAST_HEIGHT_MAX};
}
export function sampleCoastData(map,x,z){
  const u=Math.max(0,Math.min(map.size-1,Math.floor((x/map.extent+.5)*map.size)));
  const v=Math.max(0,Math.min(map.size-1,Math.floor((z/map.extent+.5)*map.size)));
  return decodeCoastHeight(map.data[(v*map.size+u)*4]);
}
export function coastWaterFactors(height,seaLevel=TROPICAL_WORLD.seaLevel){
  // Only water-covered shallows should glow turquoise and produce surf. The
  // world render's depth test masks land above sea level.
  const depth=seaLevel-height;
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  return {depth,
    shallow:1-smooth(7,68,depth),
    foam:smooth(-6,1,depth)*(1-smooth(2.5,17,depth)),
    reef:smooth(3,7,depth)*(1-smooth(23,55,depth))};
}
