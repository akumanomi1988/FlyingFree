# VUELO — continuidad de sesión

**Fecha:** 2026-11-05  
**Repositorio:** https://github.com/akumanomi1988/FlyingFree  
**Sitio público:** https://akumanomi1988.github.io/FlyingFree/  
**Rama canónica:** `main`  
**Último HEAD previo a la iteración de modelos:** `0166159d61ace99d2a4b6769ab25072bac732d84` (`main`).  
**Stack:** JavaScript ES modules, Three.js 0.180.0, Vite 6.3.5, tests Node y Playwright.

## Estado verificado

- La PR #9 consolida trabajo de las PR #5, #6 y #7 sobre la versión de música adaptativa #8, sin sustituir código reciente por copias antiguas.
- GitHub Actions `Visual and browser QA` de la integración: **success**, ejecución https://github.com/akumanomi1988/FlyingFree/actions/runs/42051053512.
- Se completaron tests Node, build Vite y escenarios Playwright/WebGL para la integración.
- PR #5, #6 y #7 están cerradas como **superseded by #9**, no como merges independientes. Sus ramas históricas pueden permanecer como evidencia; no volver a fusionarlas.
- La publicación corre por `.github/workflows/pages.yml` desde `main`. Antes de afirmar que se ve en la URL pública, comprobar la última ejecución de ese workflow y el commit desplegado.
- No hay benchmark validado de FPS P95/P99, GPU, memoria prolongada ni ejecución 8/24 h en hardware físico.

## Cambios integrados

1. Aterrizaje al buscar refugio, transición `shelter -> landing -> rest`, regresiones para búho y cernícalo.
2. Densidad de flores/arbustos: `foliageDensity` admite nombres singulares y plurales, compatibles con el generador y sus tests.
3. Entrada con permiso explícito de geolocalización, alternativa sin ubicación, recuperación silenciosa restringida a contextos TV/emisión, errores de permisos y refresco meteorológico periódico.
4. Escala física coherente en aves, árboles, fauna, insectos y vegetación; envergaduras por especie, distancias de cámara calibradas, nueva documentación y tests de escala.
5. Música generativa adaptada al clima y la fase solar, con ciclo de silencio consistente en desktop/TV; preservada durante la consolidación.

## Riesgos y límites

- Geometría del terreno relativamente gruesa cerca de puntos de aterrizaje: revisar tessellation/collision y la distancia de cámara.
- Las aves siguen siendo procedurales y estilizadas; falta detalle anatómico próximo y LOD visual avanzado.
- La vegetación más presente cerca del suelo puede incrementar fill-rate, triángulos y draw calls.
- No se ha verificado operación 24/7 en Smart TV ni supervisor OBS/RTMP.
- Los tests browser CI son pruebas funcionales y visuales básicas, no validación perceptual completa ni benchmarks.
- Revisar condiciones comerciales y atribución de Open-Meteo antes de monetización.

## Próxima iteración

1. Verificar el último deploy de GitHub Pages para el HEAD de `main`, y comprobar la URL pública con capturas comparativas.
2. Establecer una línea base de P50/P95/P99 de frame time, GPU cuando se pueda, draw calls, triángulos y memoria.
3. Probar las doce especies y aterrizajes con semillas reproducibles y escenas diurnas/nocturnas.
4. Optimizar LOD de modelos de aves y geometría cercana, manteniendo las proporciones físicas normalizadas.
5. Ejecutar pruebas prolongadas de 30 minutos / 2 horas y ampliar progresivamente según evidencias.

**Regla:** GitHub Actions verde no demuestra por sí solo calidad visual ni estabilidad prolongada. No declarar una mejora desplegada sin comprobar el workflow de Pages del commit correspondiente.

## Iteración: geometría orgánica y LOD (PR #10)

- Rama: `feature/organic-birds-fauna-trees-20261105` — https://github.com/akumanomi1988/FlyingFree/pull/10.
- Aves protagonistas: malla de ala curvada subdividida, plumas contorneadas, proporciones por especie y detalles propios de búho, buitre, garza, colibrí, golondrina y martín pescador. Conservar escalas de `worldScale.js`.
- Aves secundarias: gaviotas con `THREE.LOD`; silueta 3D cercana y malla mínima lejana.
- Fauna: anatomía suavizada de ciervos, zorros, conejos y delfines; detalles faciales de mamíferos desactivables a distancia, con histéresis.
- Árboles: `treeDetail.js` añade ramas/cúmulos vegetales mediante tres `InstancedMesh` reutilizados, desvanecimiento geométrico 100–145 m, máximo 48 individuos en escritorio y 29 en móvil, animación por viento de las copas próximas.
- Evitar fugas al cambiar de especie: se liberan geometrías/materiales anteriores sin destruir recursos compartidos del resto de la escena.
- Pruebas: `tests/organicModels.test.js` para 12 escalas de aves, geometría de alas, pool de árboles, fauna y LOD. `tests/browser.mjs` comprueba exposición de capa LOD y telemetría inicializada.
- Validación: la primera revisión de la PR pasó tests, compilación y Playwright; una revisión posterior detectó que el estado de LOD se publicaba demasiado tarde en GPU por software. Corregido inicializando el estado antes del primer frame. **La revisión definitiva debe pasar CI antes de fusionarla**.
- Pendiente: establecer base P50/P95/P99 en Chrome con GPU real y capturas comparativas, comprobar 12 especies desde varias distancias y mantener una prueba de estabilidad prolongada para TV.
- PR #10 fusionada en `main` mediante squash commit `078d31b0b3926810eabe73d71a524f23dea5d484`. Despliegue Pages aún requiere verificación de workflow.

## Iteración: continuidad, plumaje y LOD estable (PR #11)

- Rama: `feature/bird-continuity-batched-plumage-20261105`, PR: https://github.com/akumanomi1988/FlyingFree/pull/11.
- Corrección de continuidad: `createBirdBrain` acepta estado inicial validado y expone `snapshot`. El selector de especies conserva posición, dirección, velocidad y necesidades fisiológicas. No reinstanciar el ave en otro lugar.
- Optimización de modelo: `meshBatch.js` fusiona geometrías rígidas compatibles por material para reducir draw calls del plumaje. Alas principales y puntas siguen con grupos y animación independiente; datos UV de plumas compatibles con el merge.
- Color anatómico: `speciesAppearance.js` define paletas de cabeza, pecho, primarias, alas y marcas faciales para las doce especies. No usa recursos con restricciones de licencia.
- Arbolado: `treeDetail.js` recalcula LOD a intervalos cortos bajo movimiento y reduce el radio de fade cuando el pool de 48 árboles está saturado. Evita detalles cercanos emergiendo abruptamente al alcanzar el límite de pool.
- Telemetría: `status.birdDrawCallsSaved` permite conocer el ahorro de draw calls por ave; no equivale a una medición directa de tiempo de GPU.
- Pruebas: `tests/birdContinuity.test.js`, `tests/organicModels.test.js` y `tests/browser.mjs` validan continuidad, número de llamadas ahorradas, cotas geométricas, paletas por especie y WebGL.
- Gate: exigir Node tests, build Vite y Playwright/WebGL del commit HEAD antes de integrar a `main`; comprobar después GitHub Pages y comparar P95 de hardware real.
