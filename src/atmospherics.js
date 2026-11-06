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
