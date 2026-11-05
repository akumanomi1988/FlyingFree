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
- Fauna: cabeza de ciervos y zorros convertida en articulación jerárquica; ojos, hocico, orejas y astas acompañan su rotación. Evita artefactos al agacharse o mirar alrededor y mantiene los LOD faciales.
- Telemetría: `status.birdDrawCallsSaved` permite conocer el ahorro de draw calls por ave; no equivale a una medición directa de tiempo de GPU.
- Pruebas: `tests/birdContinuity.test.js`, `tests/organicModels.test.js` y `tests/browser.mjs` validan continuidad, número de llamadas ahorradas, cotas geométricas, paletas por especie y WebGL.
- Gate: exigir Node tests, build Vite y Playwright/WebGL del commit HEAD antes de integrar a `main`; comprobar después GitHub Pages y comparar P95 de hardware real.

## Estado de integración — 2026-11-05 (PR #11)

- **Fusionado en `main`:** PR #11 con commit squash `a122e3ef9b996f07b29aad242d7955c449a7e213`.
- **CI validada:** workflow "Visual and browser QA" #134, https://github.com/akumanomi1988/FlyingFree/actions/runs/42106023784, ejecutado sobre HEAD `1c05a7dd874dc13bec06837c30c29226b6599010`. Resultado: 47 pruebas Node, 0 fallos; build Vite y Playwright/WebGL correctos.
- **Impacto medido:** entre 58 y 72 draw calls de plumaje eliminadas en los siete escenarios de QA. Esto es ahorro de draw calls, NO una mejora en FPS demostrado en hardware real.
- **Detalles:** cambio de especie sin teletransporte, plumas agrupadas por materiales, doce paletas distintivas, cabeza articulada de ciervos/zorros, LOD arbóreo con fade por densidad y actualización reducida en cámara estacionaria.
- **Producción:** falta verificar que el workflow de GitHub Pages para `a122e3e` se haya desplegado correctamente y que la versión pública corresponda a ese SHA. No afirmar producción actualizada hasta confirmar.
- **Próxima prioridad:** benchmark comparativo P95/P99 en GPU de sobremesa/TV, capturas cercanas de las doce especies, y migración gradual de la fauna secundaria a LOD real con jerarquía articulada en móviles.

## Iteración: fauna terrestre y movimiento continuo (PR #12, 2026-11-05)

- **Main:** PR #12 fusionada mediante squash commit `6e1708f3c41e03e4b08f2326ed3826b4784adde3`.
- **Código:** `src/faunaLOD.js` introduce siluetas simplificadas cacheadas por especie/astas, instanciables mediante clones de geometría/material compartidos. `THREE.LOD` alterna entre malla cercana articulada y versión lejana agrupada por material. Máximo 3 draw calls por modelo lejano según pruebas de estructura. En fauna lejana se mantiene trayectoria y estado ecológico, omitiendo actualización de patas y otras articulaciones no visibles.
- **Movimiento:** `src/ecosystem.js` elimina discontinuidades de ángulo en los ciclos de descanso/desplazamiento, ancla la trayectoria en la posición inicial de cada animal, suaviza evasión/persecución, corrige la simetría de astas y añade inclinación de cuerpo en pendientes reales con muestreo limitado a cada 0,4 segundos.
- **Telemetría:** `window.__FLYINGFREE_STATUS__.faunaLOD` expone prototipos reutilizados, llamadas de dibujo por cada silueta lejana y número de esqueletos cercanos animados.
- **Validación:** `tests/faunaLOD.test.js`, regresión de `tests/motion.test.js` y `tests/browser.mjs`. CI **success** sobre HEAD de la PR `6e0f2fc45eddb197b1e85cee2265b79a7fb57b1b`: 53 tests Node, 0 fallos, Vite build y 7 escenarios Playwright/WebGL. https://github.com/akumanomi1988/FlyingFree/actions/runs/42108237388.
- **Restricción:** las pruebas certifican continuidad, estructura y ejecución WebGL, no calidad fotorrealista ni FPS/P95 en GPU física. No afirmar producción actualizada hasta verificar ejecución de `.github/workflows/pages.yml` y el artefacto desplegado.
- **Próximo ROI:** medir P95/P99 real y estabilidad en sesión larga; depurar escala/encuadre de animales en acercamientos; corregir articulaciones de rodillas/tobillos y contacto de patas con terreno; evaluar partición espacial/culling para las 2450 instancias de arbolado antes de aumentar la densidad.

## Iteración: contacto de patas y recuperación gráfica (PR #13, 2026-11-05)

- **`main`** contiene PR #13 mediante squash commit `1080de5d16b648c081cc9e7119bd845a16beae71`.
- **Animales:** `src/groundedLimb.js` resuelve rodilla en IK de dos segmentos y trayectoria de paso determinista. `src/faunaLegRig.js` implementa un controlador sin crear geometrías por fotograma: puntos de apoyo en coordenadas del mundo, pies proyectados sobre el terreno y elevación durante oscilación para ciervos y zorros. La jerarquía de LOD y escalas físicas se conserva.
- **Seed:** `src/ecosystem.js` ahora consulta `terrainHeight(px,pz,seed)` en lugar del seed implícito; evita diferencias de altura con semillas personalizadas.
- **TV/escala:** `src/adaptiveResolution.js` sustituye degradación unilateral por una regulación que reduce resolución durante FPS bajos y la restaura gradualmente tras estabilidad; histéresis, cooldown, P95 como freno de recuperación, respeto a DPR máximo y pausa de pestañas ocultas. `status.adaptiveQuality` disponible para QA.
- **Regresiones:** `tests/groundedLimb.test.js` (geometría de patas, alcance y dimensiones, apoyo world-space, posiciones iniciales por seed y referencias de GPU estables), `tests/adaptiveResolution.test.js` (recuperación, histéresis, pausas, límites de escala). `tests/browser.mjs` comprueba la disponibilidad y los límites de calidad adaptativa.
- **Evidencia:** sobre commit de la PR `0b033f2a40fb22cce6f05c0b97b4dd106085e01e`, GitHub Actions #168 (https://github.com/akumanomi1988/FlyingFree/actions/runs/42112060081) pasó 63 pruebas Node, build Vite y siete escenarios browser/WebGL. El último commit `6c643651367b156d5e62719aab05267f6bb31210` añadió únicamente una regresión de apoyo: tests Node + build verdes en el workflow #170, pero el paso Chromium todavía estaba en curso al fusionar; este último workflow no debe afirmarse completado sin verificarlo.
- **Siguiente objetivo:** revisar capturas cercanas de patas y pisadas, medir P95/P99 de frame-time en hardware físico, ampliar IK a saltos de conejo si añade calidad, comprobar Pages tras el deploy y evaluar estabilidad de TV durante 2+ horas.
