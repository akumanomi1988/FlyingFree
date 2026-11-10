# VE-06 — Piloto de animación esquelética (martín pescador)

Estado: **PR #45 en validación**. El checkbox VE-06 de `ROADMAP.md`
permanece sin marcar hasta aceptación visual de cuatro minutos y CI verde
del último HEAD. VE-07 queda expresamente fuera de alcance.

## Contrato y decisiones

- Entrada: GLB original VE-05, exactamente dos alas físicas, 12 huesos,
  LOD0 y LOD1. No se descargan modelos ni se añaden dependencias.
- `BirdBrain.update` conserva locomoción, hambre, descanso, suelo,
  posaderos y navegación. Su acción se consume en el tick fijo de VE-02,
  nunca se recalcula en `renderBird`.
- `BirdAnimationController.sync(action,t)` se llama por tick 1/30 s.
  `render(t, ...)` interpola canales `THREE.AnimationMixer` a tiempo
  absoluto de simulación, sin integrar `frameDt` ni energía ecológica.
  La reproducción a 15, 30 y 60 FPS ve el mismo esqueleto en el mismo
  instante de simulación. Pausa y reanudación no acumulan tiempo perdido.
- Seis clips: `flap`, `glide`, `takeoff`, `landing`, `perch`, `rest`.
  Transiciones mediante pesos normalizados con easing C1 y memoria de los
  pesos intermedios para cambiar el estado antes de completar un fade.
  LODs animados con mezcladores independientes y clips compartidos.
- La variación rítmica de flap/glide se elige en el tick usando estado,
  velocidad y tiempo de simulación; no contiene `Math.random`,
  `Date.now` ni dependencias del render. La fase de los clips no se reinicia.
- Ajuste cercano del GLB: `WorldQuery.sampleSurface` para suelo y normales,
  más el `restSite.branchY` explícito de `BirdBrain` para ramas (las
  ramas animadas no forman parte del BVH estático). Se corrige la altura
  visual de los pies y el ángulo del tobillo dentro de límites anatómicos.
  Ni el origen del individuo, ni su `y`, ni sus decisiones físicas se mutan.
  En vuelo o flotación el solver de contacto está desactivado.
- El rig procedural se sigue actualizando pero sus meshes se ocultan solo
  cuando ambos GLB se han cargado y el controlador ha validado huesos;
  fallo de fetch/bones -> procedural. `?assets=procedural` permite A/B.
- Cada cambio de especie y `dispose()` desmonta el mixer, las acciones,
  las skeletons clonadas y la instancia. Se conserva la caché acotada de VE-05.

## QA reproducible

```bash
npm test
npm run build
npm run test:browser
```

`tests/birdAnimation.test.js`: seis clips, canales únicos,
normalización y blending bajo cambios bruscos, secuencia a 15/30/60 FPS,
pausa, contactos rama/suelo, replay lógico de 7.200 ticks (4 minutos),
estabilidad de número de mallas/huesos y `dispose`.

`tests/browser.mjs`: doce capturas reales del GLB en
`artifacts/visual/VE06-<clip>-<front|side>.png`, seis poses y dos ángulos,
además de las 24 escenas VE-05 y regresiones preexistentes. El visor
`asset-preview.html?view=side&clip=landing&phase=.25&lod=0`
permite la comparación ortográfica con el modelo VE-05 estático.

**Limitaciones de aceptación que no se deben ocultar:**
- Replay lógico de cuatro minutos no equivale a una grabación visual
  continua de 240 s del mundo ni demuestra que BirdBrain visite
  naturalmente todos los estados en ese período.
- Capturas SwiftShader de la CI necesitan revisión perceptiva humana,
  incluyendo continuidad de pata/ala, interpenetración con ramas,
  velocidad aparente y ausencia de temblores; el controller no añade
  una rodilla real y no resuelve contacto de dedos individuales.
- No hay datos de GPU física, dispositivos TV ni P95/P99 del nuevo mixer.
  `renderer.info.memory` es un indicador WebGL, no una medida de VRAM.
- El contacto local es un ajuste acotado de presentación, no convierte
  ramas/terreno en nuevos colliders físicos Rapier.

## Aceptación pendiente y rollback

Verificar CI del **HEAD final** de PR #45, revisar contact sheets,
grabar y revisar cuatro minutos continuos con despegue, vuelo,
planeo, aterrizaje y reposo; repetir en 15, 30 y 60 FPS reales
(además de la prueba sintética) y comprobar GPU/TV. Sin estas
evidencias, no fusionar ni marcar VE-06 como completado.

Rollback: revertir PR #45; como mitigación inmediata usar
`?assets=procedural` sin alterar las otras once especies.
