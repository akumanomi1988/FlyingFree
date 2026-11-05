# VUELO — auditoría técnica y backlog priorizado
Fecha: 2026-11-05 · Base: `main@32189d4465a007bc08bbaecd35cb7ade6718b80a`.

## Alcance y certeza
Inspección del código publicado, tests, workflows y resultados históricos de GitHub Actions. No se ha ejecutado una sesión prolongada, instrumentación GPU ni pruebas en televisores físicos en esta auditoría. Los defectos de los puntos 01–02 se observan directamente en código y se corrigen en la rama vinculada; lo demás es trabajo pendiente o hipótesis que requiere medición.

**Stack:** Three.js 0.180.0, Vite 6.3.5, JS ES modules, Playwright 1.55.0; distribución estática por GitHub Pages. Tests Node y seis escenarios de navegador en CI. La última ejecución de `main` conocida durante la auditoría terminó correctamente.

## Principio de priorización
Corregir primero fallos verificables que impiden que aparezcan elementos o comportamientos; después establecer presupuestos reales de frame time y estabilidad; solo entonces invertir en simulación y efectos caros. Estado `en rama` no significa integrado ni desplegado.

| Prioridad | Tipo | Oportunidad | Evidencia / hipótesis | Criterio de aceptación |
|---|---|---|---|---|
| P0-01 | Rápida | Restaurar flores y arbustos | `vegetation.js` solicita `flowers/shrubs`, `ecology.js` solo reconocía `flower/shrub` | Densidad positiva en hábitats compatibles, test en CI; **corregido en rama** |
| P0-02 | Rápida | Terminar refugio y aterrizaje | `behaviour.js` imponía altura `hunt` durante `shelter`, incompatible con altura `land` | Búho diurno y cernícalo bajo lluvia alcanzan descanso tras aterrizar; **corregido en rama** |
| P0-03 | Estructural | Presupuesto de rendimiento reproducible | Solo se informa FPS agregado y adaptación descendente de resolución | Registrar P50/P95/P99 de frame time, memoria, geometría y draw calls por escena/dispositivo |
| P0-04 | Estructural | Ensayos de estabilidad 2/8/24 horas | No constan pruebas de larga duración | Sin incremento sostenido de heap/GPU, sin bloqueos ni degradación continua |
| P0-05 | Rápida | Auditar `preserveDrawingBuffer:true` | Activado siempre en `WebGLRenderer` aunque captura PNG es ocasional | Medir memoria/coste y conservar capturas sin buffer persistente si es viable |
| P0-06 | Estructural | Timestep controlado y pausa/recuperación | `animate` limita `dt` a 0.1 s por frame | Movimiento consistente a 30/60/120 Hz y tras reanudar pestaña; sin saltos |
| P0-07 | Estructural | Regresión visual cuantificable | Pruebas actuales exigen color y luminancia, sin diferencia respecto a referencia | Comparativas de imágenes con umbrales contextualizados y revisión de falsos positivos |
| P1-08 | Estructural | Director de cámara sensible a eventos | Planos determinados por `Math.floor(elapsed/31)%7` | Encuadres motivados por vuelo, caza, descanso y topología; sin clipping ni cambios abruptos |
| P1-09 | Rápida | Reducir asignaciones por fotograma | `directCamera` crea varios `Vector3` por frame | Menos GC sin alterar trayectoria ni fotogramas visibles |
| P1-10 | Estructural | Maniobras diferenciadas por especie | Perfiles de vuelo comparten controlador de navegación base | Planeo térmico, cernido, pesca y vuelo marino distinguibles y verificables |
| P1-11 | Estructural | Interacción presa-depredador contextual | Ecosistema tiene reglas locales simples | Persecución/evasión visible sin comportamientos imposibles ni complejidad cuadrática excesiva |
| P1-12 | Estructural | Aterrizaje en superficies compatibles | Aterrizaje actual deriva de altura de terreno y un destino 2D | Posarse en ramas, rocas o costa sin interpenetración |
| P1-13 | Estructural | LOD ecológico por relevancia | Detalle del suelo usa umbrales de altitud y celda | Simulación por visibilidad, prioridad cinematográfica y proximidad; sin pop-in notable |
| P1-14 | Rápida | Suavizar insectos cercanos | Instancias de insectos se actualizan aproximadamente cada 0.35 s | Movimiento aparente suave y coste de CPU medido |
| P1-15 | Estructural | Mejorar audio naturalista | `audio.js` sintetiza notas, ruido de viento y lluvia | Aves, insectos, costa y bosques diferenciables, sin loops intrusivos |
| P1-16 | Estructural | Revisar iluminación y sombras | `RENDERING.md` reconoce ausencia de sombras físicamente proyectadas | Mayor legibilidad de formas con presupuesto GPU controlado |
| P1-17 | Estructural | Separar orquestación de `main.js` | Archivo principal concentra render, cámara, simulación, UI y reloj | Contratos claros entre bucle, estado, escena, cámara y overlays; tests independientes |
| P1-18 | Estructural | Transiciones de bioma y variedad espacial | Terreno procedural de isla con dominio fijo | Composición menos repetitiva y continuidad entre regiones |
| P1-19 | Estructural | Modo emisión robusto y recuperable | GitHub Pages solo sirve la web, sin supervisor OBS/RTMP | Supervisor separado, reinicio ante errores, métricas y exclusión de ubicación |
| P2-20 | Rápida | Señales UX para clima real frente a simulado | Existen modos y permisos diferentes | Evidencia automática de etiqueta correcta tras fallo, denegación y caducidad de datos |
| P2-21 | Estructural | Despacho de materiales y texturas reutilizables | Meshes procedurales comparten solo parte de las geometrías/materiales | Caída demostrada de material count y memoria sin perder variedad |
| P2-22 | Experimental | Streaming de terreno por chunks | Mundo actual es una isla fija | Explorar largas distancias sin teletransporte ni crecimiento de memoria |
| P2-23 | Experimental | Metereología local por bioma | Clima externo global influye en el mundo de manera simplificada | Microclimas coherentes sin coste elevado ni afirmaciones engañosas |
| P2-24 | Experimental | Estímulos acústicos y térmicas espaciales | Viento actual de malla y trayectoria solo parcialmente acoplados | Rapaces aprovechan ascendencias; viento modifica vuelo y sonido de forma creíble |

## Tres intervenciones de mayor retorno
1. **Corregir vegetación invisible** (P0-01): defecto directo, cambio pequeño, impacto inmediato.
2. **Corregir refugio/descanso** (P0-02): elimina comportamiento físicamente incoherente.
3. **Instrumentar rendimiento** (P0-03): permite decidir entre añadir detalle o reducir cargas con datos reales.

## Siguiente iteración aconsejada
Consolidar CI y revisión visual de P0-01/P0-02. Después implementar P0-03 con escenarios y semillas fijas; obtener línea base reproducible en escritorio y móvil. No atribuir mejoras de FPS a los dos fixes sin mediciones.
