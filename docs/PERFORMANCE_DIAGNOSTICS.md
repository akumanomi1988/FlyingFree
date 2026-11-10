# P0 — Diagnóstico de tirones y render en GPU física

## Qué se ha corregido

- Los fotogramas de 250–2000 ms se conservan en P95/P99 y ya no se clasifican erróneamente como pausas del navegador. Solo se excluyen intervalos superiores a 2000 ms (suspensión prolongada).
- El LOD de árboles cercanos utiliza un índice espacial fijo de celdas de 256 metros, en vez de recorrer los 4400 registros de vegetación en cada actualización. Mantiene el mismo radio, el mismo pool de mallas, la selección 3D y los tres draw calls.
- El shader del océano omite cuatro muestras adicionales de gradiente de batimetría si el píxel no pertenece a la franja costera; no altera foam ni agua cerca de la costa, porque ese factor ya era exactamente cero en mar abierto. El ahorro de GPU aún no está medido en hardware.
- El estado `window.__FLYINGFREE_STATUS__.performance` expone P95 de tiempo de simulación, actualizaciones de escena, subgrupo de vegetación y tiempo de la llamada `renderer.render`; también intenta identificar renderer/vendor mediante `WEBGL_debug_renderer_info`.
- Estos son **tiempos de CPU** (incluyendo esperas que pueda provocar el driver), no consultas de tiempo real de ejecución en GPU. No afirmar que una tarjeta dedicada se utiliza si `graphicsBackend.verifiedHardware` es falso.

## Captura reproducible en ordenador del usuario

Abrir VUELO con `?seed=1988&bird=kingfisher&h=12.5&weather=clear&broadcast=1`. Esperar al menos 30 segundos con la pestaña visible. Desde DevTools Console:

```js
const s = window.__FLYINGFREE_STATUS__;
console.log(JSON.stringify({
  fps: s.fps,
  performance: s.performance,
  adaptiveQuality: s.adaptiveQuality,
  physics: s.physics,
  treeDetail: s.treeDetail,
  forestVisibility: s.forestVisibility,
  bird: s.bird,
  weather: s.weather,
  resolution: [innerWidth, innerHeight, devicePixelRatio],
  userAgent: navigator.userAgent
}, null, 2));
```

Interpreta conjuntamente los valores:
- `graphicsBackend.renderer` indica SwiftShader/llvmpipe en caso de software; si es `unknown`, no confirma GPU dedicada.
- `simulationP95Ms` elevado: presupuesto de IA, reloj fijo o Rapier. Comprobar `physics.lastStepMs` y `physics.buildMs` ante picos.
- `sceneP95Ms` elevado: actualizaciones de cielo, cámara, fauna, agua y vegetación; contrastar con `treeUpdatesP95Ms`.
- `renderCallP95Ms` elevado: coste de enviar la escena a Three/WebGL, posible bloqueo del driver o sobrecarga de objetos; no equivale a GPU time.
- `p95/p99` superiores a 33,3 ms señalan fotogramas incompatibles con un objetivo de 30 FPS. `renderScale` bajará si la media/P95 incumple el presupuesto.
- El tamaño de VRAM (8 GB) no identifica modelo de GPU, aceleración WebGL activa, resolución real ni rendimiento CPU; no utilizarlo como único criterio de calidad.

## Evidencia y límites

CI con SwiftShader comprueba que las métricas existen y que no hay regresiones funcionales, pero el benchmark físico requiere repetir la escena **en el equipo del usuario**. Comparar P50/P95/P99, draw calls, triángulos, `renderScale` y subtiempos CPU con la misma resolución y semilla antes/después. No ajustar distancias de bioma, población ni velocidad ecológica para conseguir FPS ficticios.
