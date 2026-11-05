# Physical scale contract (VUELO)

**1 world unit = 1 metre.** Distances, camera clearances, terrain elevation and flight speed use this contract. Objects do not become larger based on the camera distance.

- Bird wingspans are in `BIRDS[].wingspan` (metres), 0.11 m for a hummingbird, 2.20 m for a golden eagle and 3.20 m for an albatross.
- `birdRigScale(profile)` converts procedural local wing geometry to the wingspan; do not use a global "visualScale" multiplier.
- Tree height references in `src/worldScale.js`: pine 30 m, oak 22 m, cypress 24 m, olive 8 m, birch 21 m. Existing vegetation generation adds 0.78–1.28 individual variation.
- Terrestrial animal, butterfly, gull and dolphin meshes use the same metric coordinates; avoid multiplying entire models to make them visible from a distant camera.
- Grass, flowers, shrubs and pollinators stay small. Fine detail is shown only near the observer.

## Camera implications

The protagonist can be tiny in a physically consistent world. Keep the camera **closer**, and have it inherit the bird's translation every frame, rather than enlarging birds or zooming everything. Panoramic shots deliberately break away to show the landscape. Near-ground camera clearance should be tested separately.

## Validation

Run `npm run check` and `npm run test:browser`. Unit tests check modeled wingspans and animal bounds. Browser screenshot scenarios are especially important for:
1. Eagle flying by a pine canopy (tree tens of metres; eagle only about 2.2 m from wingtip to wingtip).
2. Hummingbird among flowers (macro shot without exaggerated giant flowers or insects).
3. Landing and feeding without camera-ground clipping.
4. Long shots, close-up transitions, 16:9 broadcast and mobile screens.

These sizes are representative adult averages, **not** exact morphology for every population or age. Real ground contact remains limited by the current coarse terrain mesh; near-ground terrain tessellation/collision precision should be evaluated before considering landings fully realistic.
