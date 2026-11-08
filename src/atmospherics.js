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

/** Opacity of the star field after cloud cover and precipitation block the sky. */
export function starOpacityAt(altitude,cloudCoverage=0,precipitation=0){
 const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
 const ease=(a,b,v)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
 const darkness=ease(-.045,-.19,Number.isFinite(altitude)?altitude:0);
 const cover=clamp01(cloudCoverage),rain=clamp01(precipitation);
 const obstruction=ease(.24,.82,Math.max(cover,rain*.85));
 return darkness*.97*(1-obstruction)*(1-rain*.4);
}
