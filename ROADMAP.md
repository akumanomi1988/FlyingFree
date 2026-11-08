# VUELO · Roadmap operativo para agentes

**Última revisión del plan:** 2026-11-08. **Repositorio:** [FlyingFree](https://github.com/akumanomi1988/FlyingFree). **Rama de verdad:** `main`.  
**Guía de ejecución obligatoria:** [AGENTS.md](./AGENTS.md). **Puertas QA:** [docs/QUALITY_GATES.md](./docs/QUALITY_GATES.md). **Arquitectura y límites:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).  
**Historia del roadmap anterior:** [docs/ROADMAP_HISTORY_20261108.md](./docs/ROADMAP_HISTORY_20261108.md). **Atlas histórico:** [public/roadmap/index.html](./public/roadmap/index.html).

> **Objetivo:** una simulación *autónoma*, documental, tropical y observable durante horas. No es un juego de pilotaje. Priorizar credibilidad, continuidad, belleza visual, rendimiento y estabilidad; no nuevas features sin evidencias. Este archivo es la **única cola ordenada** de hitos de desarrollo. Las anotaciones históricas y porcentajes del atlas no son indicadores de CI ni justifican cerrar tareas.

## Cómo elegir el siguiente trabajo (sin interpretación)

1. Sincronizar `main`; comprobar PR abiertas y Actions. Si existe una PR de un hito, **continuarla antes de crear otra**.
2. Leer de arriba abajo la tabla de hitos. Elegir **el primer ID con `[ ]`** cuya dependencia esté completada en `main`. El siguiente hoy es **VE-01**.
3. Implementar **solamente ese hito** como vertical slice integrado, incluyendo pruebas, capturas/evidencias, actualización de documentación y rollback si hay regresión.
4. En el **mismo push que contiene el código validado** marcar `[x]` en la rama de trabajo y adjuntar debajo del hito evidencia de commit/PR, tests y riesgos. **No marcar `[x]` solo por escribir código, por pasar tests parciales o por abrir una PR.**
5. Fusionar a `main` solo con la CI del último HEAD verde. Tras la fusión, comprobar workflow de Pages y la igualdad de `build-info.json.revision` con el SHA de `main`. Si no se puede verificar, registrar **despliegue pendiente**, no «publicado»; reabrir/corregir mediante PR si el hito no es funcional.
6. No empezar el siguiente ID hasta que el actual conste en `main`. Si está bloqueado, **no saltarlo silenciosamente**: registrar impedimento reproducible en su sección y comunicar el bloqueo. No modificar otros checkboxes.

**Semántica:** `[ ]` = pendiente en `main`; `[x]` = código, pruebas y documentación aprobados por PR e integrados en `main` (si aún falla Pages debe constar explícitamente). Durante una PR el marcado `[x]` es **propuesto**, no hecho efectivo hasta el merge. GitHub Pages solo se considera publicado cuando su workflow verifica el SHA. **No cambiar porcentajes de madurez porque se instaló una librería.**

## Arquitectura objetivo y decisiones vinculantes

Mantener **Three.js 0.180.x** como renderer hasta nueva decisión respaldada por un benchmark. No migrar a otro motor en bloque. **El ecosistema es el núcleo de producto y sigue siendo propio.**

| Capa | Responsabilidad | Herramienta / regla |
| --- | --- | --- |
| Simulation Core | Semilla, estado de individuos, necesidades, decisiones y recursos; no acceso a WebGL/DOM | JS modular + reloj de simulación fijo |
| World & Spatial | Malla y alturas compatibles; consultas de suelo, normales, obstáculos, visibilidad | `three-mesh-bvh` para geometría estática; API `WorldQuery` propia |
| Physics | Contactos físicos cercanos, restricciones y cuerpos cinemáticos | `@dimforge/rapier3d-compat` solo si piloto y coste pasan; no miles de rigid bodies |
| Animation | Jerarquía anatómica, clips, blending, IK de contacto, LOD | `THREE.AnimationMixer` + glTF/GLB; fallback procedural explícito |
| Documentary | Elegir sujetos, planos, continuidad y ritmo por eventos | `cameraDirector` propio; evaluar `camera-controls` **solo como ejecutor de movimiento**, no como director |
| Steering | Navegación, evasión y grupos, sin sustituir hambre/caza/ecología | Piloto A/B con Yuka; integrar solo si aporta valor y se mantiene determinismo |
| Presentation | Render, océano, vegetación, shaders, instancing, UI, clima, audio | Three.js + LOD + resolución adaptativa |
| Integration & QA | Estado diagnóstico, procedencia de build, escenas reproducibles | Node, Vite, Playwright/WebGL, auditoría documental y benchmark físico |

**Contratos que cada cambio debe preservar:** (a) una misma semilla reproduce biomas, posiciones iniciales, recursos, costa y ríos; (b) decisiones/estado no dependen de FPS de render; (c) `WorldQuery` representa la superficie *visible* también para contactos y oclusiones, sin supuestos incompatibles entre heightfield y triángulos; (d) sin contaminación del estado de simulación con objetos `THREE.Mesh` o DOM salvo adaptadores explícitos; (e) agentes lejanos agregados, mallas cercanas detalladas; (f) no se introducen servicios, LLM por animal ni backend para problemas locales; (g) audio por gesto, clima consentido y TV sin controles intrusivos.

**Política de dependencias:** verificar versión, licencia, mantenimiento, tamaño/arranque y compatibilidad actuales antes de añadir cada paquete; registrar alternativa, medición antes/después, riesgo y rollback. No instalar Yuka/Rapier/camera-controls todos a la vez. No confundir una demo con mejora observada. Rapier no gobierna alas en vuelo; `AnimationMixer` no decide acciones ecológicas; `camera-controls` no sustituye al director de eventos.

## Cola de hitos (el primer `[ ]` es el siguiente)

| Orden | Estado | Hito | Dependencias | Evidencia mínima |
| --- | --- | --- | --- | --- |
| 01 | [ ] | **VE-01 — Separar runtime y orquestación** | Ninguna | Sin regresiones; tests de wiring y escenas existentes |
| 02 | [ ] | **VE-02 — Reloj fijo y snapshots deterministas** | VE-01 | Mismas trayectorias a 15/30/60/120 FPS |
| 03 | [ ] | **VE-03 — WorldQuery y raycasts BVH** | VE-02 | Altura/contacto/visibilidad sobre malla real |
| 04 | [ ] | **VE-04 — Física local selectiva con Rapier** | VE-03 | Contactos reales sin coste masivo ni dobles simulaciones |
| 05 | [ ] | **VE-05 — Pipeline de assets GLB/glTF** | VE-01 | Un ave detallada importable, reproducible, con LOD y fallback |
| 06 | [ ] | **VE-06 — Animación esquelética piloto** | VE-05, VE-02 | Un ave con clips combinados y contactos creíbles |
| 07 | [ ] | **VE-07 — Adaptación de las 12 aves** | VE-06 | 12 siluetas, alas y estados verificados por contacto visual |
| 08 | [ ] | **VE-08 — Movimiento de cámara desacoplado** | VE-02, VE-03 | Cámara documental sin clipping, tirones o pérdida de sujeto |
| 09 | [ ] | **VE-09 — Evaluación de steering con Yuka** | VE-02, VE-03 | A/B reproducible, decisión integrar o descartar con datos |
| 10 | [ ] | **VE-10 — Chunks/LOD y presupuestos del mundo** | VE-03, VE-04 | Streaming sin grietas ni pop-in importante; perfiles P95/P99 |
| 11 | [ ] | **VE-11 — Auditoría documental integrada** | VE-07, VE-08, VE-09, VE-10 | Cuatro minutos, varias semillas, personas y pruebas de rendimiento |
| 12 | [ ] | **VE-12 — Operación TV prolongada** | VE-11 | 30 min→2 h→8 h→24 h→72 h y recuperación sin operador |

> **Paralelismo:** la tabla indica orden canónico de ejecución para agentes que reciben «siguiente hito». Las dependencias permiten ejecución paralela **solo** con coordinación explícita y PR sin colisión, nunca saltando el primer pendiente por iniciativa propia. Si faltan activos, hardware o revisión humana, registrar el bloqueo; no fingir que se ha cumplido.

## Alcance y aceptación por hito

### VE-01 — Separar runtime y orquestación
**Archivos iniciales:** `src/main.js` (~879 líneas al aprobar este plan), `src/behaviour.js`, `src/ecosystem.js`, `src/cameraDirector.js`.  
**Hacer:** extraer el bucle y estado del simulador a módulos con responsabilidades explícitas (`src/runtime/` o equivalentes); crear adaptadores de entorno, escena y UI; mantener `main.js` como bootstrap. No refactorizar de golpe toda la ecología ni modificar la estética. Inyectar reloj, semilla y servicios para pruebas; conservar `window.__FLYINGFREE_STATUS__`.  
**Aceptar:** inicialización y destrucción limpias, una sola instancia del bucle, selector, clima, audio y TV intactos; tests de ciclo de vida/wiring, `npm test`, `npm run build`, `npm run test:browser` verdes. Añadir diagrama textual de dependencias reales.  
**Evidencia/PR/CI:** pendiente.

### VE-02 — Reloj fijo y snapshots deterministas
**Hacer:** timestep fijo inicial 1/30 s con acumulador, límite de substeps y política al volver de pestaña suspendida; separar tiempo de pared (hora y clima) del tiempo simulado y de la interpolación del render. No acelerar meteorología real con la velocidad de demo. Capturar snapshots de movimiento/estados ecológicos sin objetos Three.js.  
**Aceptar:** replay de misma semilla y eventos equivalentes con frames de entrada 15/30/60/120 Hz, sin `NaN`, saltos de cámara ni duplicación de decisiones tras una pausa; pruebas con seed fija y test browser.  
**Evidencia/PR/CI:** pendiente.

### VE-03 — WorldQuery y BVH
**Hacer:** crear `WorldQuery` con `sampleSurface`, `raycast`, `lineOfSight` y consultas de normal/material/hábitat. Integrar `three-mesh-bvh` en geometría estática cercana. Basar oclusión, aterrizajes y contactos en la malla triangulada visible; coordinar renovación de índices si el terreno cambia por chunks. No construir BVH de toda la vegetación animada.  
**Aceptar:** pruebas en costa, pendientes, orillas y agua con 3 semillas; tolerancia medida entre malla y collider, y ausencia de falsos apoyos o sujetos detrás de crestas. Perfil antes/después de tiempo de consulta y memoria.  
**Evidencia/PR/CI:** pendiente.

### VE-04 — Física local selectiva con Rapier
**Hacer:** pequeño adaptador `PhysicsWorld` con `@dimforge/rapier3d-compat` (o sustitución justificada), instanciación y liberación de WASM seguras. Prototipo de cuerpo cinemático cercano: aterrizaje, posado o animal terrestre con terreno de VE-03. Lejos, mantener movimiento analítico y población agregada; no duplicar integración de movimiento.  
**Aceptar:** contactos físicamente coherentes en relieve inclinado; cuerpo nunca atraviesa suelo ni agua por un collider obsoleto; memoria estable en sucesivos mundos regenerados; tests deterministas/fixtures y benchmark CPU para decidir ampliar o limitar Rapier.  
**Evidencia/PR/CI:** pendiente.

### VE-05 — Pipeline de assets GLB/glTF
**Hacer:** adoptar una convención de ejes/unidades (metros, Z/Y coherentes), nombres de huesos, materiales, variantes y LOD; carga asíncrona/caché/liberación. Preparar un ave de referencia (p. ej. águila) con silueta anatómica reconocible, esqueleto y al menos dos LOD, manteniendo fallback procedural y sin assets de origen/licencia inciertos. Documentar exportación Blender→GLB y optimizaciones del formato.  
**Aceptar:** ave visible en navegador y TV, escala correcta frente a árboles, no se ven cuatro alas, fallback si falla carga, recursos liberados al cambiar especie. Tests y comparativas multiángulo. Un cubo de prueba no cuenta como ave completa.  
**Evidencia/PR/CI:** pendiente.

### VE-06 — Animación esquelética piloto
**Hacer:** clips/estados `flap`, `glide`, `takeoff`, `landing`, `perch`, `rest` enlazados con `THREE.AnimationMixer` y blending; el estado procede del `BirdBrain`, no del renderer. Resolver contacto de patas con una capa limitada de IK/ajuste al `WorldQuery`. Mantener versión procedural para comparación.  
**Aceptar:** secuencias sin torsiones, alas extra, vibraciones, pops o penetraciones; 4 minutos de vuelo piloto, 15/30/60 FPS y pruebas de transición con snapshots.  
**Evidencia/PR/CI:** pendiente.

### VE-07 — Adaptación de las 12 aves
**Hacer:** extender la pipeline probada a doce arquetipos sin mezclar anatomía incompatibles; agrupación por locomoción (rapaces, planeadoras marinas, pequeñas, zancudas y especializadas). Introducir diferencias de envergadura/frecuencia y LOD de animación; documentar excepción biológica por especie.  
**Aceptar:** `npm run audit:visual -- --seed=1988` y hoja 12×3 revisada por persona, filmación por estado, sin cuatro alas, tamaños coherentes, reposo y flotación específicos. Si falta revisión humana, **no cerrar**.  
**Evidencia/PR/CI:** pendiente.

### VE-08 — Movimiento de cámara desacoplado
**Hacer:** mantener `cameraDirector` para elección de plano/eventos, crear ejecutor de movimiento/collision/constraints desacoplado. Evaluar `camera-controls` con A/B; integrarlo solo si resuelve seguimiento cinematográfico y no introduce orientación artificial o pérdida del protagonista. Evitar saltos de posición, velocidades angulares bruscas y cámara bajo terreno (VE-03).  
**Aceptar:** escenarios estrechos, rapaces sobre relieve, niebla móvil 390×844, costa y TV; progresión continua y sujeto encuadrado en la prueba documental; no relajar aserciones visuales.  
**Evidencia/PR/CI:** pendiente.

### VE-09 — Evaluación de steering con Yuka
**Hacer:** prueba acotada para un zorro y su presa o un grupo de aves: separación, evasión y persecución. Comparar con motor actual mediante idéntica semilla y eventos ecológicos, coste por agente, memoria y calidad visible. La selección de acciones, necesidad de comer y recursos queda en el núcleo.  
**Aceptar:** informe A/B y tests de continuidad/performance; **resultado válido puede ser descartar Yuka** si aporta más acoplamiento que beneficio. No adoptar navegación de un videojuego como sustituto de ecología.  
**Evidencia/PR/CI:** pendiente.

### VE-10 — Chunks/LOD y presupuestos del mundo
**Hacer:** dividir malla territorial actualmente monolítica en chunks con determinismo por semilla; colisión y BVH local sincronizados; carga/descarga de vegetación y LOD por distancia; mantener costa/ríos sin grietas y las consultas de bioma correctas.  
**Aceptar:** ruta reproducible por montaña-valle-río-mar; sin bordes visibles, fugas ni faunas flotantes; P50/P95/P99 y memoria antes/después (en GPU física si disponible), draw calls e instantáneas. Si no hay hardware real, documentar bloqueo de esa puerta.  
**Evidencia/PR/CI:** pendiente.

### VE-11 — Auditoría documental integrada
**Hacer:** secuencia de cuatro minutos que muestre mundo, vuelo, alimentación/descanso, fauna, cámara y sonido; ejecutar con tres semillas y escenas fijas, recopilar vídeo/contact sheet y revisión humana independiente. Priorizar defectos observados, no nuevos animales decorativos.  
**Aceptar:** revisión humana documentada, 0 defectos críticos en secuencia, coherencia de eventos verificable, mezcla de audio revisada en TV/auriculares y baseline medido en dispositivo objetivo. Las capturas automáticas por sí solas **no** cierran el hito.  
**Evidencia/PR/CI:** pendiente.

### VE-12 — Operación TV prolongada
**Hacer:** pruebas escalonadas 30 min, 2 h, 8 h, 24 h, 72 h; instrumentar uso de memoria, contexto WebGL, pérdida/recuperación de clima, audio, pestañas inactivas y regeneración de isla; supervisor externo OBS/RTMP **solo si** se decide emitir 24/7.  
**Aceptar:** informe por duración y hardware, medidas sostenidas, recuperación sin operador de fallos simulados, consentimiento geográfico intacto y condiciones comerciales de meteorología revisadas. No prometer 72 h si solo se ha ejecutado un test corto.  
**Evidencia/PR/CI:** pendiente.

## Puertas comunes por cada PR

- `npm test` y `npm run build` en último commit; `npm run test:browser` con Chromium instalado; conservar 7 escenas actuales o ampliar sin bajar umbrales.
- Test de regresión nuevo del comportamiento o defecto cambiado. Si es gráfico, captura **antes/después** de misma `?seed=1988`, estación, cámara y especie. Además usar otra semilla para descubrir sobreajuste.
- Sin regresiones de FPS/P95, draw calls o memoria según baseline *disponible*; si todavía no hay GPU de referencia, anotar explícitamente «no medido en GPU física».
- No romper selector de 12 aves, paisaje procedural, mares y ríos coherentes, cámara documental, clima local voluntario, audio sujeto a interacción ni modo TV.
- Actualizar en **la misma rama** esta tabla, la sección del hito y `docs/NEXT_SESSION.md` con fecha, HEAD, PR, pruebas y riesgos; evitar reescribir historia o declarar deploy prematuramente.
- Hacer `push`, comprobar que existe PR hacia `main`, revisar CI del último HEAD, merge y luego verificar workflow Pages / `build-info.json` contra SHA de `main`. Si no puede fusionar, dejar PR abierta y comunicar que no está completado en `main`.
- La calidad visual y ecológica precisa prueba perceptiva, no solo CI. Mantener todo el código anterior hasta validar sustitución y dejar rollback sencillo.

## Comandos y referencias reproducibles

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run audit:habitats -- --seed=1988 --seconds=1800 --strict
npm run audit:visual -- --seed=1988
```

Escena fija: `?seed=1988&bird=eagle&phase=dawn&weather=clear&broadcast=1`. Caso móvil: `?h=8&bird=hummingbird&weather=fog&seed=1988` a 390×844.  
Publicación: [Actions](https://github.com/akumanomi1988/FlyingFree/actions) · [Sitio](https://akumanomi1988.github.io/FlyingFree/) · [build-info.json](https://akumanomi1988.github.io/FlyingFree/build-info.json).  
Verificación de verdad: la revisión publicada debe coincidir con el SHA efectivo de `main`, no con la rama ni con un commit histórico.  
**Snapshot de partida del plan:** `main@f7030ae28e08c8bc9434de946e0f44df028096a0`, CI Pages [#42462516025](https://github.com/akumanomi1988/FlyingFree/actions/runs/42462516025) verde el 2026-11-08. Este identificador es histórico; los agentes futuros deben consultar GitHub en vivo.
