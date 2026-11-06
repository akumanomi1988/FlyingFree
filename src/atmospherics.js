// Decorative pollen/firefly point clouds were distracting, appeared in
// clusters and were not causally tied to fauna. They are intentionally disabled.
// Rain, marine foam, real insects and wildlife continue to render separately.
export function createAtmospherics(){
 return {
  update(){},
  get activeCount(){return 0;},
  get enabled(){return false;}
 };
}

/**
 * Night-sky transparency after clouds and precipitation occlude the stars.
 * Deliberately a pure function: real-world and simulated weather use the
 * same logic, and CI can test the atmosphere without booting WebGL.
 */
export function starOpacityAt(altitude,cloudCoverage=0,precipitation=0){
 const clamp=(v)=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
 const ease=(a,b,v)=>{
  const t=clamp((v-a)/(b-a));
  return t*t*(3-2*t);
 };
 const alt=Number.isFinite(altitude)?altitude:0;
 const darkness=ease(-.045,-.19,alt);
 const rain=clamp(precipitation);
 const cover=clamp(cloudCoverage);
 const obstruction=ease(.24,.82,Math.max(cover,rain*.85));
 return darkness*.97*(1-obstruction)*(1-rain*.4);
}
