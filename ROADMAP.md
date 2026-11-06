# VUELO · Roadmap vivo de ingeniería y calidad documental

**Dirección adoptada:** VUELO debe ser un documental autónomo de naturaleza estilizada; no un juego de pilotaje ni una colección de funciones aisladas. El espectador debe poder observar durante varios minutos sin intervención y encontrar un mundo coherente.

**Atlas visual interactivo:** [Abrir el atlas](./public/roadmap/index.html) · [Versión publicada tras pasar CI y desplegar Pages](https://akumanomi1988.github.io/FlyingFree/roadmap/)  
**Registro técnico:** [docs/NEXT_SESSION.md](./docs/NEXT_SESSION.md).  
**Fecha de adopción de la directriz:** 2026-11-06.

> El atlas es una reconstrucción histórica del corte de 2026-11-06. Sus cifras (por ejemplo, el 39 % de madurez estimada) son valoración técnica ilustrativa, **no KPIs medidos ni progreso actualizado automáticamente**. Este `ROADMAP.md` es la fuente principal para el trabajo futuro.

## Norte de producto — criterio vinculante

**Prueba de verdad:** producir una secuencia reproducible de **cuatro minutos** sin controles ni narración externa que muestre paisaje, vuelo, conducta animal, composición de cámara y sonido agradables y coherentes. La aceptación requiere revisión humana; las pruebas Node y WebGL solo establecen mínimos técnicos.

Decisiones de producto:

1. **Credibilidad antes que más especies:** corregir primero anatomía, vuelo y comportamiento de las doce actuales.
2. **Geografía reconocible antes que extensión ilimitada:** una región tropical sobresaliente, topografía/hidrología coherentes, después chunks y LOD progresivo.
3. **Cámara por acontecimientos, no por reloj:** documentar aproximación, vuelo, caza, descanso y revelaciones de paisaje sin cortes gratuitos.
4. **Ecología observada, no inferida:** medir tiempo por bioma y eventos completados; navegación motivada por recursos y especie.
5. **Calidad medida en dispositivo objetivo:** FPS P95/P99, memoria, fugas de GPU/WebGL, audio en TV, estabilidad prolongada.
6. **Privacidad y sostenibilidad comercial:** geolocalización consentida, proveedor meteorológico compatible con monetización, sin LLM innecesario por animal.

## Estado según evidencias

| Área | Estado verificable | Brecha de aceptación |
| --- | --- | --- |
| Mundo | Isla tropical procedural de 12 km por semilla, tres ríos, montañas, selva y humedales; PR #16 | Terreno en una sola malla, falta streaming/LOD espacial y coherencia visual de costas/tributarios |
| Fauna | 12 aves y otros animales con IA determinista y LOD | Conductas largas, hábitats medidos, interacciones emergentes, fotografía validada |
| Cámara | Sigue al protagonista, evita terreno; esta iteración añade composición por eventos | Revisión perceptiva de secuencia de 4 minutos y árboles/oclusión |
| Audio | Sintetizador atmosférico y corrección de subgraves; PR #14 | Prueba auditiva A/B con auriculares y televisor |
| Validación | Node, Vite y Playwright/WebGL en CI | No acreditan GPU real, estética ni sesiones de 8–72 h |
| Publicación | Existe workflow Pages en push a `main` | Verificar último deploy SHA y captura pública después de cada PR |

El último corte **anterior a esta revisión** verificado: PR #16 fusionada, 76 pruebas Node y 7 escenarios WebGL en [Actions #42190619653](https://github.com/akumanomi1988/FlyingFree/actions/runs/42190619653). No asumir que ese SHA se ha desplegado públicamente sin revisar Pages.

## Plan priorizado por dependencias

### Fase 00 — Verdad observable · P0

- [x] Documentar visión, cronología, decisiones y riesgos en el atlas HTML; vincularlo desde producto y README.
- [x] Introducir métricas de ocupación por hábitat derivadas de posiciones reales de aves.
- [x] Eliminar cortes de cámara temporizados sin contexto y documentar motivo/transiciones.
- [ ] Verificar que Pages sirve el SHA del último `main` desplegado y registrar screenshot.
- [ ] Montar contact sheet de **12 aves × varios ángulos × fases de vuelo**, con defectos antes/después.
- [ ] Grabar y evaluar una secuencia de 4 minutos (audio/cámara/mundo) con una semilla fija.
- [ ] Baseline P50/P95/P99 de frame time, memoria, draw calls y GPU en equipo real.

**Salida:** tres defectos perceptivos principales con evidencia reproducible y responsables; no cerrar solo por CI verde.

### Fase 01 — Escenario tropical sobresaliente · P0

- [ ] Chunks/LOD del terreno determinista, más tessellation cerca, horizonte estable y menor popping.
- [x] Los tres ríos principales terminan en la costa real de cada semilla; PR #18, con pruebas de desembocadura.\n- [ ] Red hidrológica completa: tributarios, cascadas y desembocaduras con pendientes físicamente plausibles.
- [x] El océano toma la profundidad del terreno procedural para localizar aguas someras, arrecifes estilizados y espuma; PR #18.\n- [ ] Playas, acantilados, coral y manglar con anatomía visual/hidrológica de alta calidad, revisados manualmente.
- [ ] Selva estratificada por altitud/humedad y distancia, escala y sombra consistentes.
- [ ] Tres semillas con geografías y rutas muy distintas, revisadas visualmente.

**Salida:** vuelo prolongado sobre una isla atractiva sin bordes evidentes, colisiones ni distancias absurdas; P95 dentro de presupuesto.

### Fase 02 — Ecología por especie · P0

- [x] Telemetría de tiempo sobre océano frente a hábitats interiores, separando vuelo y reposo.
- [x] Replay automatizado de 15 minutos × doce especies × dos semillas en CI, con límites de ocupación oceánica y pesca en agua dulce; PR #19.\n- [ ] Auditoría documental 30–60 min y revisión humana en 3+ semillas; fijar umbrales realistas por especie.
- [x] Restricción de puntos de pesca a agua dulce/mar real según la especie, sin eventos de alimentación sobre bosque o lecho seco; PR #19.\n- [ ] Nidos, dormideros, territorios, peces visibles, salpicaduras de pesca, perchas y recursos persistentes.
- [ ] Caza/huida, pesca y alimentación con consecuencias observables, no solo selección de estados.
- [ ] Simulación por nivel de importancia: fauna cercana detallada, población lejana agregada.

**Salida:** seguir un ave 30 minutos y poder explicar de forma consistente dónde se mueve, qué busca y qué consigue.

### Fase 03 — Anatomía y cine · P1

- [x] Director de planos basado en comportamiento, relieve, altura y giros, con histéresis.
- [ ] Revisión multiángulo de alas de doce especies; contacto de patas, plegado, planeo y aleteo.
- [ ] Cine por acontecimientos con composición, selección de sujeto, ritmo y continuidad.
- [ ] Microeventos distinguibles (caza/pesca, descanso, despegue y costa/valle) en una misma secuencia.
- [ ] Revisión auditiva A/B de música + ambiente, con prioridades en mezclas.

**Salida:** un fragmento documental de cuatro minutos atractivo para un observador externo.

### Fase 04 — Resistencia, TV y comercialización · P1

- [ ] Sesiones 30 min → 2 h → 8 h → 24 h → 72 h; memoria, FPS y errores sin degradación sostenida.
- [ ] Recuperación ante pérdida del contexto WebGL/renderer y desconexiones de climatología.
- [ ] Verificación de geolocalización consentida y ausencia de filtraciones de ubicación.
- [ ] Condiciones comerciales de Open-Meteo, atribuciones y, si procede, caché/proxy.
- [ ] Si hay emisión 24/7, supervisor de navegador + OBS/RTMP y recuperación automática.

**Salida:** experiencia fiable, verificable y sostenible que funciona sin operador.

## Puertas de calidad para fusionar

1. Tests Node; build Vite; todos los escenarios WebGL sin errores.
2. Nueva prueba reproducible del defecto que se está corrigiendo y evidencia before/after cuando sea visual.
3. Presupuestos de CPU/GPU/retenciones no empeorados en equipo objetivo; si no medible, marcar **pendiente**, no «mejorado».
4. No degradar clima local, consentimiento, modo TV ni escalas entre aves y mundo.
5. PR enlazada, commit revisable, `main` actualizado y verificación de publicación después del merge.
6. Registrar decisiones y riesgos en `docs/NEXT_SESSION.md`.

## Comandos de trabajo

```bash
npm install
npm test
npm run build
npm run test:browser
npm run audit:habitats   # auditoría offline; duración configurable
```

Reproducir un escenario: `?seed=1988&bird=eagle&phase=dawn&weather=clear&broadcast=1`. Otras semillas, especies y climas ayudan a descubrir defectos que una única captura oculta.

## Fuentes

- [Atlas de la visión](./public/roadmap/index.html): narrativa histórica y decisiones desde las conversaciones disponibles.
- [Registro de ingeniería](./docs/NEXT_SESSION.md): PR fusionadas, pruebas y limitaciones.
- [Repo GitHub](https://github.com/akumanomi1988/FlyingFree) y [Actions](https://github.com/akumanomi1988/FlyingFree/actions).
- Feedback de usuario documentado en las conversaciones sobre cámara, alas, audio, escala, ecosistema y mundo tropical.

**Regla de gestión:** el roadmap cambia con evidencia y valor de producto; no con el número de features añadidas.

## Auditoría documental reproducible (trabajo operativo)

**Workflow manual:** [Documentary experience audit](https://github.com/akumanomi1988/FlyingFree/actions/workflows/documentary-audit.yml) → Run workflow, indicando semilla y duración.

Este workflow hace una auditoría real del código de simulación: reproduce 12 aves durante 30 minutos simulados por especie (valor predeterminado) y guarda el porcentaje de muestras sobre océano, costas, humedales y tierra interior. A continuación produce capturas de **12 aves × 3 encuadres** de la cámara real WebGL (`chase`, `profile`, `high-reveal`) junto con un `index.html` de revisión visual. El reporte se descarga como artefacto de GitHub Actions.

```bash
npm run check
npm run audit:habitats -- --seed=1988 --seconds=1800 --strict
npx playwright install chromium
npm run audit:visual -- --seed=1988
# Prueba rápida de un subconjunto:
npm run audit:visual -- --seed=1988 --birds=eagle,owl --modes=chase,profile
```

Para que el mismo plano se pueda reproducir, el capturador utiliza `?selftest=1&qaShot=profile` (solo diagnóstico explícito): **no** modifica el director normal del espectador ni los perfiles de vuelo. Una captura de WebGL es evidencia visual revisable; que exista no significa que un artista la haya aprobado.

**Procedencia de un despliegue:** el build genera `public/build-info.json` como recurso desplegable. Tras un push a `main` y un workflow Pages correcto, consultar [build-info.json público](https://akumanomi1988.github.io/FlyingFree/build-info.json) y comparar `revision` con el commit que se quería publicar. Si no coincide, declarar despliegue pendiente, no concluido.
