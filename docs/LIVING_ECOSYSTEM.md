# VUELO — Ecosistema visible, riberas y GPU

## Por qué no se observaban más animales

La población terrestre original tenía 24 actores con IA, pero el generador los
distribuía habitualmente a kilómetros del sujeto; además, todas las aves
secundarias eran gaviotas orbitando a unos 4,6 km de la isla.
El motor renderizaba esas criaturas pero la cámara casi nunca las veía.

## Arquitectura desarrollada

### Fauna con detalle según distancia

- `src/ecosystem.js` conserva cuadrúpedos articulados, comportamiento de
  alimentación/alerta/persecución y LOD. La población terrestre pasa a **48**
  individuos de tres tipos, repartidos en terrenos compatibles; una fracción
  importante se ubica cerca del inicio de observación para que sean visibles.
- `src/regionalBirds.js` genera bandos de aves secundarios en celdas del
  mundo, con semilla determinista. Utiliza **tres InstancedMesh** para
  cuerpo/cabeza/alas y un **shader de aleteo en GPU**. Las matrices de vuelo
  se actualizan como máximo a 8 Hz; al cambiar de celda se crea solo el
  inventario local, no una jerarquía de meshes por pájaro.
- El conjunto incluye aves marinas, aves pequeñas de bosque/pradera y
  planeadoras a diferentes alturas. No equivale todavía a rig anatómico por
  especie para toda la población: el protagonista mantiene el modelo detallado.

### Río con vida

- `src/tropicalRivers.js` mantiene un cauce trazado con la misma semilla y
  sistema de alturas del relieve. El agua usa UV longitudinales, brillo
  especular y un shader para corriente, ondulaciones y espuma en márgenes.
  El parámetro temporal es **un uniforme**, no un recalculo por CPU de
  miles de vértices.
- `src/riverEcosystem.js` añade piedras, cantos, juncos y arbustos en las dos
  orillas de cada cauce, con geometrías y materiales reutilizados en
  **cuatro InstancedMesh**. La vegetación tiene ligera oscilación en el
  vertex shader.
- Los peces aparecen en pequeños grupos deterministas, bajo el agua y dentro
  del corredor fluvial. Su nado se actualiza a unos 6 Hz **solo cuando están
  cerca del observador**; los demás conservan su estado espacial sin subir sus
  matrices al renderer.

### Responsabilidades CPU y GPU

**CPU:** decisiones, biome selection, trayectoria de mamíferos, búsqueda de
alimento, posición de peces visibles y construcción inicial del mapa.

**GPU/WebGL2:** representación instanciada de poblaciones y riberas,
iluminación, agua fluvial, aleteo secundario y oscilación de juncos. No se ha
introducido WebGPU ni cálculos de IA en compute shaders: para estas
cantidades no compensaría la sincronización ni la incompatibilidad de
navegadores.

### Presupuestos y control de calidad

- Bandos de aves: tres draw calls principales instanciados; límite de
  población por vecindario y actualización espacial periódica.
- Riberas: cuatro draw calls instanciados; recursos generados con semilla y
  geometría compartida.
- Detalle zoológico: LOD de los cuadrúpedos y distancia máxima para
  animaciones finas y piezas pequeñas.
- `tests/livingRiversAndFlocks.test.js` controla número de animales y
  recursos, determinismo, shaders, presupuesto de dibujo y ausencia de
  teleportación. `tests/browser.mjs` verifica las nuevas métricas reales
  del renderer en Chromium/WebGL2.
- Telemetría: `__FLYINGFREE_STATUS__.fauna`, `regionalBirds` y
  `riverLife`. En una instalación pública la revisión exacta se confirma
  mediante `build-info.json`.

## Limitaciones pendientes

La fauna secundaria tiene comportamiento de bandada simplificado y no ha
adquirido aún territorialidad, crianza ni ecosistemas tróficos completos.
Los peces son cardúmenes procedurales visibles, no presas simuladas
individualmente con economía de recursos y captura física. Las rocas y la
vegetación mejoran el aspecto de ribera, pero faltan erosión hidrológica,
volúmenes de agua reales, sedimentación, cascadas y conectividad entre
poblaciones. La tasa de FPS final depende de la GPU real; una ejecución
correcta de Chromium con SwiftShader no prueba 60 FPS en todos los equipos.
