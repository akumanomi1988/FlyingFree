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

## Iteración: eliminar zumbido parecido a motor del audio (PR #14, 2026-11-06)

- **Fusionada en `main`:** PR #14, squash commit `7edc3f403f31eb712e3cd65760eab3687b45cbc4`.
- **Causa identificada en el código:** `src/musicDirector.js` mantenía notas fundamentales subgraves de 49–82 Hz durante todo el tiempo con dos bancos de pads; `src/audio.js` además generaba un ruido muy filtrado hacia graves que se repetía cada 4 segundos. En conjunto podía percibirse como motor/ventilador.
- **Correcciones:** voicings sostenidos ahora con nota inferior >=130 Hz y menor nivel; voces graves sinusoidales; filtro pasaaltos de pad a 130 Hz; viento por ruido amplio filtrado entre 250 y 1600 Hz, lluvia filtrada sobre 1100 Hz; reducción de nivel ambiental; buffer de 11 segundos con fundido de 12 ms en ambos extremos para evitar clics al cerrar el bucle; segundo armónico de campana sin detuning y de menor nivel.
- **Conservado:** melodía generativa, 7 perfiles armónicos, brillo musical condicionado a luz/clima, mute/unmute, crossfade entre armonías, interacción del usuario para iniciar audio, sin archivos musicales ni recursos externos.
- **Regresiones:** `tests/audio.test.js` verifica notas >=130 Hz, filtros y niveles del grafo, buffer de ambiente y continuidad en extremos, dinámica según clima y habilitación/deshabilitación.
- **QA verificada:** https://github.com/akumanomi1988/FlyingFree/actions/runs/42178278882, `success` con 67 pruebas Node, build Vite y 7 escenarios de navegador/WebGL.
- **Pendiente:** revisar auditivamente la mezcla en auriculares/televisor real y confirmar publicación de Pages del SHA de la corrección. Ningún test automatizado sustituye la verificación perceptiva.

## Iteración: isla tropical, navegación ecológica, cámara y alas (PR #16, 2026-11-06)

- **Fusionado en `main`:** PR #16, squash commit `0daf07eece00dcf00f0b4874ebb87b60cc92ffa6`.
- **Origen del defecto:** la cámara anterior alternaba cada 31 segundos con posiciones globales fijas, la isla era una malla radial fija de 4.3 km, la navegación de gaviotas/albatros usaba órbitas predefinidas y las cobertoras se prolongaban fuera del contorno natural del ala.
- **Terreno:** `src/tropicalTerrain.js` reemplaza la altura radial por un relieve volcánico reproducible a partir de semillas, 12 km de extensión, cordilleras rotadas según semilla, picos, valles erosionados, costa irregular y tres corredores de río integrados en el mismo campo de alturas. `src/tropicalRivers.js` construye tres superficies fluviales según la semilla. La semilla por defecto depende del día UTC pero pasa por hash; `?seed=1988` fija el terreno para reproducir capturas.
- **Vegetación:** `src/main.js` renderiza tierra a 250 subdivisiones, palmeras con frondas instanciadas, manglares y bosque de copa tropical en las tierras bajas. `src/treeDetail.js` evita representar palmeras como copas esféricas. `src/vegetation.js` usa la semilla del mundo en la vegetación cercana.
- **Ecología y aves:** `src/ecology.js` añade humedales, preferencias de bioma por las doce especies, recursos vinculados a agua dulce/costa/montaña; `src/behaviour.js` selecciona spawn y patrulla con puntuación de hábitat. `src/ecosystem.js` desplaza gaviotas y delfines secundarios a la costa real y los mamíferos a foothills y selva baja.
- **Cámara:** `src/cameraDirector.js` sustituye planos fijos por cinco encuadres relativos al ave y modo de aproximación, anticipación según velocidad, suavizado temporal, horizonte estable, muestreo de relieve en línea de visión y protección contra contacto con suelo. `status.cameraShot` permite verificarlo.
- **Alas:** `src/flight.js` recoloca cobertoras y primarias hacia la planform original para impedir que sobresalgan formando una segunda silueta. La jerarquía sigue siendo dos alas articuladas. `geometryVersion=4`.
- **Cielo nocturno:** luna direccional suave, gradación azul del cielo y mayor densidad de estrellas, para recuperar variedad visual sin claridad diurna.
- **Telemetría:** `status.world` informa `seed`, `extent`, `riverChannels` y `riverSegments`.
- **Pruebas:** `tests/tropicalWorld.test.js`, `tests/cameraDirector.test.js`, `tests/organicModels.test.js` y `tests/browser.mjs` comprueban variación por semilla, montañas, ríos, especies, cámara, geometrías y funcionamiento en siete escenas.
- **CI HEAD validada:** GitHub Actions https://github.com/akumanomi1988/FlyingFree/actions/runs/42190619653 `success`: **76 tests Node / 0 fallos, Vite build y 7 escenarios Playwright/WebGL**.
- **Publicación:** `.github/workflows/pages.yml` está configurado para push en main, corre npm test/npm run build/npm run test:browser antes de publicar. Es un workflow separado y aún no se ha confirmado su estado tras el merge; no declarar producción actualizada sin verificarlo.
- **Calidad pendiente:** no hay benchmark de GPU física ni captura de revisión humana a escala; la isla es una malla procedural amplia y única (12 km) con LOD de vegetación, no streaming infinito de tiles. Más adelante: render de costa con profundidad y bancos de coral basados en altura real, mejoras hidrológicas/erosión física y distribución de nueva fauna tropical.

## Iteración: Atlas como roadmap rector y verdad documental (PR #17, 2026-11-06)

- **`main` fusionó PR #17:** https://github.com/akumanomi1988/FlyingFree/pull/17, squash commit `21565959ad73a2cb0beec2b24b34fee54efcded7`.
- **Fuente de verdad estratégica:** `ROADMAP.md` es la directriz viva, con fases 00–04, dependencias P0/P1, pruebas de aceptación y limitaciones. El atlas original íntegro (HTML autónomo de ~83 KB, historia, decisiones, fases, brújula y medidor subjetivo del 39 %) está versionado en `public/roadmap/index.html`, publicado por Vite en `/FlyingFree/roadmap/` tras pasar Pages. Se enlaza desde README, ayuda de la app y footer no-TV. El atlas sigue siendo un **corte histórico del 06/11/2026**, no un dashboard sincronizado ni medición objetiva de progreso.
- **Dirección de cámara:** `src/cameraDirector.js` ya no cambia plano automáticamente cada 37 s. Selecciona según comportamiento, velocidad angular de giro, altura y relieve, aplica duración mínima de plano y estabilidad del acontecimiento. Exposición en `status.camera` (motivo, cortes, altura, relieve) y `status.cameraShot`. `?selftest=1&qaShot=profile` sirve para inspección reproducible sin interferir con el modo normal.
- **Ecología observada:** `src/habitatMonitor.js` registra bioma cada ~4 s de simulación usando la trayectoria real del protagonista, separa muestras volando/descansando, exporta distribución por océano/tierra y restablece al cambiar de especie. `src/main.js` expone `status.habitatUse`. `scripts/audit-habitats.mjs` reproduce las 12 especies durante una duración configurable y escribe JSON con porcentajes. El workflow documental permite por defecto 30 minutos simulados por especie y un gate --strict; **su ejecución prolongada queda pendiente**, no confundir con las pruebas de replay corto.
- **QA visual reproducible:** `scripts/capture-birds.mjs` captura 12 aves × 3 encuadres WebGL reales y genera un contact sheet HTML con manifest JSON. Workflow `.github/workflows/documentary-audit.yml` es **manual**, sube artefactos y preserva pruebas incluso si la auditoría ecológica detecta errores. El workflow manual completo aún no se ha ejecutado ni aprobado visualmente.
- **Trazabilidad de producción:** `scripts/write-build-info.mjs` genera `build-info.json` durante `npm run build`, con revision SHA, timestamp, ref, trigger y marca de candidato a Pages. Tras un despliegue, comparar `https://akumanomi1988.github.io/FlyingFree/build-info.json` con el commit publicado. El smoke test de CI verifica que existe, pero **no equivale a comprobar la URL pública**.
- **Validación HEAD PR:** https://github.com/akumanomi1988/FlyingFree/actions/runs/42208049563, `success`: **85 tests Node, 0 fallos, Vite build y 7 escenarios Playwright/WebGL**. Incluye contacto HTML del atlas servido, manifiesto, cámara por eventos y telemetría ecológica.
- **Siguientes prioridades reales:** comprobar SHA de Pages, ejecutar el workflow documental manual para seed 1988 + dos semillas adicionales, revisar contact sheet de 12 especies con el usuario, comparar trayectorias por 30–60 min, y reunir una secuencia de cuatro minutos sometida a aceptación visual/auditiva; después atacar terreno chunked/LOD e hidrología física. Medir P95/P99 en GPU física y 8–72 h en Smart TV antes de prometer estabilidad.

## Iteración: litoral físicamente ligado a la semilla y pesca real (PR #18 y #19, 2026-11-06)

### PR #18 — Costa y desembocaduras coherentes
- **Integrada en `main`:** https://github.com/akumanomi1988/FlyingFree/pull/18, squash SHA `5302fd08cb732332973737af7e11d22a727690cc`.
- **Defecto confirmado:** `src/renderfx.js` utilizaba una fórmula radial con `phase=0.5` para el color turquesa y espuma del mar, mientras el relieve y la costa real eran dependientes de la semilla. Arrecifes/olas se dibujaban sobre una costa no coincidente con la tierra.
- **Corrección:** `src/coastalBathymetry.js` hornea 320×320 alturas de la semilla real, codificadas en `Uint8Array`/RGBA normalizada, con filtrado lineal sin extensiones de texturas flotantes. El shader del océano ahora muestrea la profundidad real en coordenadas mundiales para aguas someras, espuma y arrecifes estilizados. El recurso GPU se libera mediante `dispose`; `status.world.coastSeed` y `coastResolution` verifican coherencia.
- **Ríos:** `src/tropicalTerrain.js` localiza la costa de cada semilla para las tres rutas fluviales, en lugar de distancias arbitrarias. El tallado de los corredores alcanza la desembocadura; `src/tropicalRivers.js` extiende las superficies a la costa y reduce su desplazamiento vertical de +2.2 m a +0.45 m. Sigue pendiente hidrología real con tributarios/erosión física.
- **QA:** https://github.com/akumanomi1988/FlyingFree/actions/runs/42209899595 — **89 Node / 0 fallos, build Vite y 7 WebGL correctos**. Comprueba 5 semillas de costa/riveras, textura y ciclo de vida del material.

### PR #19 — Alimentación pescadora vinculada a agua verdadera
- **Integrada en `main`:** https://github.com/akumanomi1988/FlyingFree/pull/19, squash SHA `f057f4e3f1514555af6da6fe066840771dafe32d`.
- **Defecto confirmado:** `resourcePoint` permitía devolver `kind:'fish'` en bosque o montaña si la búsqueda local no hallaba agua. Además, las aves pescadoras pasaban por `landing` y plegaban las alas sobre el lecho del río para alimentarse.
- **Corrección:** `src/ecology.js` delimita hábitats de pesca por especie (martín pescador/garza: humedales y orillas; águila pescadora: agua dulce y mar costero; gaviota/albatros: mar y costa). La selección considera cauces reales de la semilla y agua marina. Si no hay recursos devuelve `unavailable:true` y el cerebro continúa la búsqueda sin inventar presas. `src/behaviour.js` calcula un presupuesto de viaje proporcional a distancia y velocidad y permite pesca en vuelo en lugar de aterrizar sobre el agua.
- **QA larga:** `tests/longHabitatAudit.test.js` verifica **15 minutos simulados × 12 especies × 2 semillas**, con trayectorias finitas, uso de mar limitado para especies de interior, ocupación de mar para marinas y oportunidades de pesca para aves de agua dulce. Este replay es CPU sin renderizado físico ni una prueba de 15 minutos de GPU.
- **QA final sobre main actualizado con #18:** https://github.com/akumanomi1988/FlyingFree/actions/runs/42211629343 — **93 Node / 0 fallos, Vite y 7 escenarios Playwright/WebGL correctos**.
- **Roadmap:** `ROADMAP.md` marca como resueltos los defectos concretos de color de costa, desembocaduras principales, selección de sitios de pesca y replay de dos semillas. **No** marca como completos la hidrología real, peces visibles, 3+ semillas con evaluación artística, LOD geográfico por chunks, mezcla final de audio, benchmarks P95/P99 o sesiones 8/24/72 h.

### A continuación (orden recomendado)
1. Ejecutar el workflow documental manual para producir una contact sheet real de las 12 aves × 3 encuadres y una auditoría de 30 minutos, inspeccionando siluetas, proporciones, aterrizajes y escenas/semillas problemáticas. La mera presencia del script no certifica su ejecución.
2. Rediseñar terreno en chunks con niveles de detalle, topología coherente a escala cercana y política de streaming/caché. Mantener una única función de altura y bioma para física, render y navegación.
3. Convertir el objetivo de pesca en un evento visible: pez, aproximación, picado, contacto y salpicadura, con interacción y coste ecológico por especie.
4. Crear un fragmento de cuatro minutos sin controles para revisión artística; registrar audio real en TV y hardware P50/P95/P99; verificar `build-info.json` del despliegue público.
5. Pruebas de resistencia 8–72 h, fallo WebGL/context loss, memoria y operación de emisión/TV. No declarar el proyecto `100%` sin estas puertas de calidad.

## Iteración: cámara cinematográfica suave, alas plegadas y flotación en oleaje (PR #20, 2026-11-06)

- **Integrado en `main`:** https://github.com/akumanomi1988/FlyingFree/pull/20, squash SHA `282053948d72b8ec10c07a994fbda422ac9f9310`.
- **Causas identificadas:** la cámara interpolaba posición pero ejecutaba `camera.lookAt(smoothedTarget)` inmediatamente y copiaba el 100 % del desplazamiento del ave por frame; las alas replegadas usaban `rotation.z=±0.81`, elevándolas hacia el cielo; el reposo marino calculaba la altura con un -7 fijo mientras el agua GPU estaba animada cerca de -9 m.
- **Cámara:** `src/cameraDirector.js` suaviza el rumbo del ave con inercia limitada a 0.72 rad/s y 1.4 rad/s², filtra el movimiento directo de traslación (sobre todo rebotes verticales), aplica slerp de cuaterniones con velocidad máxima de 0.76 rad/s y conserva la orientación en los cambios de especie. El horizonte permanece con up=(0,1,0). `status.camera.turnSpeed` en rad/s para QA.
- **Anatomía en reposo:** `src/flight.js` gira alas hacia atrás (±1.42 rad en Y), baja ligeramente su ángulo lateral (en lugar de alzarlas 46°), atenúa banca, y mueve suavemente cuerpo/cola/cobertoras mientras el ave está quieta.
- **Aves acuáticas:** `src/oceanMotion.js` implementa en CPU las mismas cuatro funciones de ola que el shader, con interpolación sobre los triángulos físicos de `PlaneGeometry(17000,17000,190,190)`, evitando que la altura analítica no coincida con la malla GPU. `src/behaviour.js` hace flotar gaviotas y albatros durante el estado `rest`, corrige la aproximación a altura dinámica del agua y añade deriva suave y pitch/roll limitado a ±0.085 rad. El estado `floating=true,resting=true,grounded=false` diferencia flotar de posarse en tierra; `main.js` lo propaga a animación y telemetría.
- **Validación:** 100 pruebas Node, 0 fallos, `npm run build` y 7/7 escenarios WebGL/Playwright, [Actions #42214762136](https://github.com/akumanomi1988/FlyingFree/actions/runs/42214762136). Nuevas regresiones `tests/restingCameraWater.test.js`: giro repentino de 160°, cruce ±π, cambio de especie, amortiguación de impulso vertical, alas plegadas de cinco especies, interpolación exacta GPU/CPU y flotación en replay de 15 minutos de gaviota y albatros. `tests/browser.mjs` verifica límite de cámara y estado de flotación.
- **Pendiente:** no hay aceptación visual en televisor ni benchmark físico. Se mantiene el shader oceánico de cuatro olas y malla finita, no simulación de fluidos hidrodinámica. La garza es zancuda: no debe flotar; se representa vadeando humedal. Revisar mano/aleteo con contact sheets y secuencias de reposo. Comprobar `build-info.json` público para asegurar el despliegue del SHA correcto, sin confundir CI verde con producción publicada.


## Sesión: encuadre móvil, descanso aéreo y contratos (2026-11-06)

**Base:** `main@954c2048a184d1a8140cb1343870c4f282b9dbe1`. Trabajo en PR [#22](https://github.com/akumanomi1988/FlyingFree/pull/22); **rama pendiente de fusión** y parcialmente solapada con PR #21. No describir como integrado o publicado.

**Fallo reproducido:** [Actions #42260524030](https://github.com/akumanomi1988/FlyingFree/actions/runs/42260524030) falló `05-mobile-selector` (390×844, `?h=8&bird=hummingbird&weather=fog&seed=1988`) por imagen WebGL casi monocromática (2 colores cuantizados). La proyección real después obtenida fue `x=-0.593, y=-1.271, depth=0.885, distance=3.17m` ([Actions #42296980817](https://github.com/akumanomi1988/FlyingFree/actions/runs/42296980817)): `y<-1` confirma protagonista fuera del encuadre vertical. No bajar umbrales para aprobar sin reparar.

**Código desarrollado en esta rama:**
- `src/cameraDirector.js`: seguimiento X/Z completo para evitar retraso acumulativo; movimiento vertical continuo sigue al sujeto y los impulsos bruscos se amortiguan. FOV vertical adaptable hasta 80° en pantallas estrechas.
- `tests/cameraDirector.test.js`: regresiones proyectadas para colibrí a 15/30/60 FPS, incluidas trayectorias descendentes, conservando límites de giro y pruebas previas de suavizado vertical.
- `src/behaviour.js`, `src/flight.js`, `src/birdEcology.js`: el vencejo agotado pasa a `aerial_rest` y recupera energía planeando sin posarse incluso con lluvia; alimentación terrestre con movimiento de postura.
- `tests/aerialRecovery.test.js`: pruebas nuevas de reposo aéreo, animación sin aleteo, ausencia de aterrizaje y postura de alimentación.
- `src/main.js` expone `status.framing` (coordenadas proyectadas NDC, distancia, FOV y alturas; ninguna coordenada de localización del visitante). `tests/browser.mjs` mantiene la aserción de diversidad visual y añade comprobación explícita de encuadre móvil.
- `docs/ARCHITECTURE.md`, `docs/QUALITY_GATES.md`: contratos y validación. `README.md` corrige comandos; `ROADMAP.md` actualiza integración y bloqueo.

**Validación verificada intermedia:** 116 pruebas Node superadas y build Vite correcto en Actions #42296780091; fallo WebGL móvil persistente antes de los últimos ajustes de cámara. La CI del **último HEAD** debe comprobarse otra vez. No hay benchmarking GPU físico ni evaluación perceptiva ni despliegue público acreditado por estos cambios.

**Siguiente acción:** comprobar screenshot/telemetría móvil en el último SHA, solucionar cualquier fallo sin debilitar tests, comparar aportaciones únicas de PR21/22, fusionar solo con CI íntegra verde y SHA previsto, verificar Pages mediante `build-info.json`; después revisar audio y 4 minutos de documental.

## Iteración: etología observable, distancia de vegetación y control de isla (PR #24, 2026-11-07)

- **Fusionada en `main`**: https://github.com/akumanomi1988/FlyingFree/pull/24, squash commit `b4cd05c479482fe43bef172ce00f790e12cc426f`. CI final: https://github.com/akumanomi1988/FlyingFree/actions/runs/42355678458 con **124 Node tests, 0 fallos, Vite build y 7 escenarios Playwright/WebGL verdes**, incluido móvil.
- **Auditoría inicial importante**: HUD (energía/saciedad/sensaciones), minimapa ocultable, cambio de semilla por sesión, elección de hábitat distinto por ave, geolocalización consentida con zona horaria del proveedor meteorológico, acantilados y motas ambientales desactivadas **ya existían en `main`**. No duplicar estos sistemas ni volver a crear UI gratuita.
- **Nuevos comportamientos**: `src/behaviour.js` fuerza regreso/descanso cuando energía cae bajo .17 sin completar ruta kilométrica; si es vencejo cambia a reposo aéreo. Hummingbirds alimentan néctar a ~2.2 m sobre terreno y `swift/swallow` consumen insectos en vuelo, sin estado `grounded` ni alas plegadas en pleno vuelo. Se añade `aerialFeeding` a la acción observable. `src/birdEcology.js` sustituye estados imprecisos por `Agotada`, `Fatigada`, `Volviendo al posadero`, `Patrullando`. Referencias documentadas en `docs/BIRD_BEHAVIOR.md` (Cornell Lab + RSPB).
- **Popping**: `src/treeDetail.js` aumenta distancia máxima de detalle arbóreo de 310 a 680 m, suavizado de 220 m, pool de 80 a 240 árboles en escritorio, mientras en móvil se limita al 60 % (~144); la silueta/masa forestal lejana sigue siendo permanente. `status.treeDetail` expone capacidad, `fadeDistance` y radio. No confundir esta optimización con LOD completo de terreno por chunks ni con benchmark P95/P99 en hardware real.
- **Insectos**: `src/vegetation.js` reduce el presupuesto visual de 145 a 38 elementos × quality, con dispersión alrededor de flores, color menos opaco y visibilidad solo con cámara a menos de 40 m sobre el suelo. La capa de motas/partículas atmosféricas permanece desactivada. No eliminar polinizadores funcionales del ecosistema.
- **Mar**: `src/renderfx.js` calcula pendiente de costa tanto X como Z para espuma de acantilados en cualquier orientación y añade bandas animadas de rompiente dependientes de profundidad. Sigue siendo un shader estilizado sin hidrodinámica ni spray volumétrico.
- **Semillas y UI**: `index.html` elimina textos decorativos y añade `Generar nueva isla` dentro de Ayuda (sin barra permanente); `main.js` genera nueva semilla reproducible en URL mediante `sessionIslandSeed()`. Si `?seed=` falta, las sesiones ya eran aleatorias. Minimap permite descubrir semilla mediante título, conserva visibilidad opcional.
- **Tests**: `tests/documentaryBehaviour.test.js` cubre fatiga crítica por especie, néctar/insectos en vuelo, altura entre doseles y distancia de detalle; `tests/browser.mjs` valida transiciones y presupuesto móvil/escritorio.
- **No completado**: nidos y construcción de refugios modelados, reproducción/territorialidad, persecuciones con presas visibles, animación de patas sobre ramas mediante IK, diseño de picos/dedos específicos, espuma volumétrica, terreno chunked/streaming, revisión artística de clips de 4 minutos, audio real en TV, sesiones de resistencia y despliegue público SHA verificado.


## VE-01 — Runtime y orquestación separados (PR #40, 2026-11-08)

- Rama: `feat/VE-01-runtime-orchestration`. PR: https://github.com/akumanomi1988/FlyingFree/pull/40. Primera implementación: `670451f824127045e5ac4b87a051739e5f21779e`.
- `src/main.js` reducido a bootstrap, app inyectable y módulos de escena/mundo, UI, entorno, registro de eventos y RAF con `start/stop/dispose`.
- Primera CI: https://github.com/akumanomi1988/FlyingFree/actions/runs/42502027810 — 170 tests Node, build Vite y 7 escenarios de navegador/WebGL verdes. Capturas del primer HEAD: https://github.com/akumanomi1988/FlyingFree/actions/runs/42502027810/artifacts/13625788413. Baseline anterior: https://github.com/akumanomi1988/FlyingFree/actions/runs/42468944998.
- El HEAD final añade el constructor de mundo separado, teardown browser y documentación. **Confirmar checks del último HEAD antes de merge:** https://github.com/akumanomi1988/FlyingFree/pull/40/checks. No convertir esta nota en aprobación automática.
- Riesgos remanentes: sin GPU física, ni prueba TV larga, ni auditoría perceptiva de audio/cámara. VE-02 (paso fijo) sigue expresamente fuera de alcance. Rollback: revert PR #40. Despliegue solo acreditado mediante Pages y `build-info.json.revision` tras integración.
