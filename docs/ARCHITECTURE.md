# VUELO — Arquitectura de la simulación (estado 2026-11-06)

## Objetivo

Un simulador audiovisual **autónomo** de naturaleza estilizada en el navegador. Three.js se ocupa del render; los agentes toman decisiones por reglas y necesidades sin servicios LLM ni backend por individuo. La pantalla funciona en modo observación o TV; los controles son opcionales.

## Módulos existentes

| Responsabilidad | Módulos | Contrato vigente / deuda |
| --- | --- | --- |
| Bootstrap y ciclo de vida | `src/main.js`, `src/runtime/app.js`, `src/runtime/frameLoop.js`, `src/runtime/eventScope.js` | Un único RAF y teardown explícito. VE-02 introduce reloj fijo 30 Hz, acumulador y snapshots observables. |
| Entorno y UI | `src/runtime/browserEnvironment.js`, `src/runtime/browserUI.js`, `src/localTime.js`, `index.html` | Reloj/viewport y servicios inyectables; controles DOM y selector sin lógica ecológica. |
| Escena y composición | `src/runtime/sceneAdapter.js`, `src/runtime/worldBuilder.js` | WebGL, luces, mundo sembrado y recursos definidos aparte del bootstrap; la simulación aún consume objetos Three para presentación. |
| Geografía y hábitat | `src/tropicalTerrain.js`, `src/core.js`, `src/ecology.js` | Compartir semilla y función de altura entre malla, IA, agua y colisiones. Terreno sigue siendo una única malla de 250×250 celdas |
| Agua y relieve costero | `src/renderfx.js`, `src/oceanMotion.js`, `src/coastalBathymetry.js`, `src/tropicalRivers.js`, `src/coastalCliffs.js` | Espuma/costa derivadas del relieve sembrado; shader y flotación CPU han de seguir sincronizados |
| Agentes de aves | `src/behaviour.js`, `src/birdEcology.js`, `src/flight.js`, `src/speciesAppearance.js` | Agente determinista con hambre, energía y rutas. Reglas por arquetipo, no zoología exacta. El HUD no gobierna la IA |
| Fauna secundaria | `src/ecosystem.js`, `src/faunaLOD.js`, `src/faunaLegRig.js` | Animaciones y LOD; aún faltan relaciones persistentes y consumos reales de recursos |
| Cámara documental | `src/cameraDirector.js` | Planes basados en eventos + continuidad angular, sujeto visible y despeje del terreno; medir encuadre y oclusiones |
| Vegetación y detalle | `src/vegetation.js`, `src/treeDetail.js`, `src/worldMotion.js` | Instancing y material de viento. Evitar sobrecoste de transparencias y pop-in de detalle |
| Audio, clima y meteorología | `src/audio.js`, `src/musicDirector.js`, `src/localClimate.js` | El sonido se activa tras gesto, ubicación opcional; proveedor sujeto a licencia comercial |
| QA | `tests/*.test.js`, `tests/browser.mjs`, `scripts/audit-*.mjs` | Node + Vite + WebGL, habitats y hojas de contacto; sin equivalencia a validación perceptiva |

## VE-01 · Diagrama real de dependencias (PR #40)

```text
src/main.js (bootstrap único)
 └─ runtime/app.js (ensamblaje, simulación y diagnóstico público)
     ├─ runtime/browserEnvironment.js → reloj de pared, performance, viewport, RAF
     ├─ runtime/frameLoop.js → un solo callback pendiente; stop/dispose
     ├─ runtime/eventScope.js → suscripciones DOM, teardown
     ├─ runtime/browserUI.js → controles, teclado, selector, consentimiento
     ├─ runtime/sceneAdapter.js → WebGLRenderer, Scene, cámara, luces, dispose
     ├─ runtime/worldBuilder.js → relieve, costa, bosque, nubes, estrellas (seed)
     ├─ behaviour/ecosystem/ecology → decisiones y agentes existentes
     └─ audio/localClimate/cameraDirector → servicios y adaptación existentes
```

`createFlyingFreeApplication({environment,seed,services})` admite inyección
de un reloj y planificador, semilla, sonido, clima, escena, UI y construcción
del mundo. `start()` es idempotente; `dispose()` cancela RAF y temporizadores,
libera suscripciones, sonido y recursos de escena. El diagnóstico
`window.__FLYINGFREE_STATUS__` permanece disponible, y
`window.__FLYINGFREE_RUNTIME__` expone snapshot/teardown para pruebas.
La presentación sigue utilizando Three.js; **no** se introduce simulación
a timestep fijo, BVH ni motor físico en este hito.

**Aceptación reproducible:** `npm test`, `npm run build`,
`npm run test:browser`; escenario fijo `?seed=1988&bird=kestrel&h=12.5&weather=clear&broadcast=1`
y pruebas del selector móvil, clima consentido y TV. Capturas antes:
[main anterior](https://github.com/akumanomi1988/FlyingFree/actions/runs/42468944998);
después: [checks PR #40](https://github.com/akumanomi1988/FlyingFree/pull/40/checks).
No se ha medido GPU física; no se afirma igualdad perceptiva por CI.
**Rollback:** revertir la PR #40 completa; no existe migración de datos.

## Reglas de diseño para la próxima iteración

**Determinismo por semilla.** El modo normal puede usar una nueva semilla por sesión; `?seed=1988` obliga a repetir topografía, navegación y fauna. Se registra la semilla en el diagnóstico. No se elige la semilla que pase un test: se repara la cámara o el mundo para que pasen las semillas problemáticas.

**Timestep.** El reloj VE-02 emplea `src/runtime/fixedClock.js`, timestep de 1/30 s, máximo ocho substeps por RAF y máximo 250 ms de entrada. Descarta exceso tras suspensión, resetea acumulador al ocultar/mostrar pestaña y permite pausar con K o `runtime.pause()/resume()`. El motor ecológico se actualiza en ticks; la cámara, los rig de aves y elementos escénicos interpolan entre dos poses. La hora real y el proveedor meteorológico continúan basándose en epoch, no en el reloj de simulación. Los snapshots de `runtime.simulationSnapshot()` son observaciones serializables para comparar replay, **no** restauración completa del estado RNG.

**Rendimiento.** Mantener `InstancedMesh`, geometrías/materiales compartidos, detalle según relevancia y controles de resolución con recuperación. Antes de más teselación, medir impacto real P95/P99 y memoria de GPU. Una malla enorme permanente no equivale a streaming.

**Agentes.** Preferir reglas locales de utilidad, recursos y estado; no un LLM por animal. La complejidad ecológica debe manifestarse como eventos que una cámara pueda mostrar. Introducir alimentación persistente/presas antes de añadir más especies.

**Cámara.** Separar traslación del sujeto (seguir XY horizontal sin retraso acumulativo), correcciones verticales, orientación y selección de planos. No usar saltos arbitrarios ni sustituir problemas de visibilidad por borrar una aserción. El indicador `window.__FLYINGFREE_STATUS__.framing` permite comprobar proyección efectiva del protagonista.

**Privacidad y operación.** La geolocalización requiere acción explícita y no aparece en pantalla; el clima simulado debe identificarse. GitHub Pages no ejecuta OBS ni supervisores; una futura emisión 24/7 requiere proceso externo y ensayo de resiliencia.

## Vertical slice recomendado

Una secuencia de cuatro minutos sin intervención: colibrí en sotobosque → costa/río con martín pescador → planeo sobre cordillera → fauna visible con desenlace de interacción. Debe funcionar con semilla fija antes de ampliar catálogo. Evaluar con contacto visual y audio real. La secuencia es un criterio futuro, **no contenido ya implementado**.

## Riesgos técnicos conocidos

1. La malla de terreno usa 250 segmentos por eje: la altura analítica puede diferir de la triangulación visible local, generando contacto/oclusión falsos. Antes de chunks, considerar muestreo de altura de malla interpolada donde deba existir colisión exacta.
2. Las ramas de PR #21 y #22 modifican simultáneamente comportamiento, HUD, terreno y sonido. No fusionar ambas a ciegas; rescatar cambios únicos con tests y marcar lo obsoleto.
3. El selector cambia el sujeto y reinicia su estado/posición: es una decisión de producto distinta de seguir al mismo individuo; se comunica como cambio de protagonista.
4. El catálogo mezcla aves que no constituyen una comunidad tropical biogeográficamente coherente. Tratarlo como catálogo de arquetipos hasta fijar una región y especies compatibles.
5. Los FPS de GitHub Actions con SwiftShader no demuestran rendimiento en hardware físico; las pruebas TV aún no están certificadas.

Este documento explica el estado actual y sus límites; la fuente de verdad para integrar cambios es la CI del último commit, no una descripción aspiracional.

## VE-03 · Consulta espacial unificada del terreno visible (PR #42)

`src/worldQuery.js` recibe los objetos `THREE.Mesh` **ya construidos por el renderer** (terreno 250×250 celdas, lecho y lámina fluvial), genera índices `MeshBVH` con `indirect:true` y los comparte. No se duplica el terreno analítico para colisionar y no se indexa vegetación con `InstancedMesh` ni la fauna dinámica. `replaceSurfaces` reconstruye los índices de forma atómica para una futura migración a chunks; `dispose` suelta referencias sin destruir buffers GPU cuyo propietario es el adaptador de escena.

La interfaz `sampleSurface(x,z, {includeWater,time,rain})` devuelve coordenadas, normal geométrica, clasificación de material y hábitat derivado de la semilla con altura y pendiente corregidas; `raycast(origin,direction,{maxDistance,includeWater})`, `lineOfSight(from,to)`, `heightAt`, `normalAt`, `materialAt` y `habitatAt` usan triángulos visibles. Fuera de la malla devuelven `null`, sin terreno ficticio. El océano no recibe BVH (su altura se desplaza en GPU): conserva la misma interpolación triangular temporal por CPU que el render, incluida la flotación.

`worldBuilder` entrega `worldQuery` al runtime; fauna terrestre, extremidades y reposos de aves usan `heightAt`; el director cinematográfico añade `lineOfSight` geométrico completo a su despeje de cámara. Conserva inyección opcional para pruebas de módulos que utilizan funciones analíticas anteriores, `?seed=`, snapshots ecológicos, timestep fijo, clima y modo TV.

**Datos del runner CI #42510792574 (no GPU real):** 183 Node + Vite + siete WebGL, tres semillas, 48 puntos/semilla. Diferencia BVH vs raycast sin índice: 2,27e-13 m máximo. P95 del heightfield antiguo vs triángulos: 1,04–1,96 m. Raycast sin acelerar 8,25–8,34 ms/consulta; BVH 0,0137–0,0282 ms/consulta; build BVH 40–88 ms y memoria estimada por índice 5,14–5,19 MB. QA perceptiva y GPU física: no medidos. Rollback: revertir PR #42; ningún cambio persistente.


## VE-04 · Rapier de proximidad y superficie visible (PR #43, candidato)

`src/physics/PhysicsWorld.js` aplica un controlador cinemático Rapier a un máximo de doce
mamíferos cercanos (radio de entrada 145 m, salida 185 m) y, cuando procede, al
contacto terrestre del protagonista. El catálogo ecológico sigue siendo propio.
Los triángulos estáticos son exactamente los del terreno y lecho fluvial
expuestos por `WorldQuery`; la malla de agua **no se convierte en suelo sólido**.
Las olas del océano y superficies acuáticas se consultan en el tiempo simulado
mediante `WorldQuery.sampleSurface`. No se duplican agentes de larga distancia.

El controlador calcula desplazamiento corregido antes de usar
`setNextKinematicTranslation`. Un `RigidBody` cinemático a secas **no**
bloquea penetraciones: este detalle es vinculante en futuras refactorizaciones.
Los contactos se ejecutan solo en los ticks VE-02 a 30 Hz, no en el RAF.
La inicialización WASM diferida determina el inicio del primer tick: iniciar
la ecología antes de resolverla produciría replays distintos según la latencia.
`dispose()` libera los cuerpos y el mundo; la nueva `surfaceRevision` de
`WorldQuery` permite invalidar la topología de colisión si se regeneran mallas.

`npm run benchmark:physics` registra muestras CPU, memoria RSS/heap y coste
incremental bajo GitHub Actions; las cifras no son FPS GPU, TV ni coste WASM
aislado. Las pruebas cubren pendientes, tres semillas, histéresis de distancia,
agua, regeneración y destrucción. **Pendiente de aceptación hasta que CI final,
comparación de costes, revisión de colisiones y Pages resulten verificadas.**
Rollback de VE-04: revertir PR #43; sin migración de datos.

### VE-04 · Decisión conservadora tras benchmark de Rapier

El piloto se restringe a 8 cuerpos cinemáticos de fauna próxima en escritorio,
4 en móvil, más un contacto del protagonista cuando se posa en terreno; jamás
se sustituyen los estados ecológicos ni se agregan cientos de rigid bodies.
La construcción de colliders locales usa directamente el BVH de VE-03
(`shapecast`), sin escanear los 160k triángulos completos.
Con 12 cuerpos, el coste incremental inicial fue 0,76–2,97 ms/tick en GitHub CI;
la construcción de parche descendió de 27–31 ms a 3–7 ms con BVH. El coste WASM
de primer arranque y RSS requieren hardware físico antes de ampliar alcance.
Pruebas definitivas y coste de 8 cuerpos en [checks PR #43](https://github.com/akumanomi1988/FlyingFree/pull/43/checks).
