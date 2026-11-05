// World-space dimensions use metres: 1 scene unit = 1 metre.
// Bird meshes are authored in local procedural units; only this conversion
// controls their physical size. No camera-dependent or species-specific cheats.
export const WORLD_METRES_PER_UNIT = 1;

// The mesh's outer primary-feather tips extend 2.265 * profile.wings
// from each wing pivot, which is 0.29 units from the centre.
export function birdRigScale(profile){
  if(!Number.isFinite(profile.wingspan)||profile.wingspan<=0)throw new RangeError('Invalid bird wingspan');
  return profile.wingspan/(0.58+4.53*profile.wings);
}
export function birdCameraDistance(profile){
  return Math.max(0.55,profile.wingspan*3.6);
}

// Approximate full-height mature species models, before 0.78–1.28
// age/individual variation. Applied directly by createForest.
export const TREE_HEIGHT_M = Object.freeze({
  pine:30,oak:22,cypress:24,olive:8,birch:21
});
export const FAUNA_SCALE = Object.freeze({
  deer:0.58,fox:0.43,rabbit:0.35,dolphin:0.82,
  gull:1,butterfly:0.052
});
export const GROUND_DETAIL_SCALE = Object.freeze({
  grass:0.13,flowers:0.15,shrubs:0.28
});
