# FlyingFree · VUELO

Experience a procedural coastal island, twelve selectable bird species, wildlife, physical sun cycle, dynamic weather, and original algorithmic ambient music.

## Run locally
```bash
npm install
npm run dev
npm test
npm run build
npm run audit:habitats  # auditoría reproducible de distribución de aves por bioma
npm run audit:visual    # screenshots de doce aves, requiere Playwright Chromium
```

**Public website:** https://akumanomi1988.github.io/FlyingFree/

**Contrato de ingeniería actual:** [Arquitectura](./docs/ARCHITECTURE.md) · [Puertas de calidad](./docs/QUALITY_GATES.md) · [Etología y límites](./docs/BIRD_BEHAVIOR.md). Un cambio en una PR aún abierta no está necesariamente en `main`. Los valores de FPS de CI con SwiftShader no representan hardware físico. `?seed=1988` permite reproducir escenas defectuosas; las nuevas visitas sin semilla pueden generar una isla distinta.


## Dirección estratégica del proyecto (noviembre de 2026)

VUELO debe convertirse en **un documental autónomo de naturaleza tropical**, no en un juego ni en una acumulación de objetos. El criterio de calidad principal es una secuencia atractiva y coherente de cuatro minutos sin intervención, seguida de pruebas de resistencia para TV.

- **[Roadmap vivo de desarrollo](./ROADMAP.md)**: prioridades P0/P1, dependencias, aceptación y evidencias.
- **[Atlas estratégico interactivo original](./public/roadmap/index.html)**: historia, decisiones, rutas y distancia estimada hasta la visión.
- **[Atlas accesible en GitHub Pages](https://akumanomi1988.github.io/FlyingFree/roadmap/)** después del despliegue del commit correspondiente.
- **[Handoff y registro de PR](./docs/NEXT_SESSION.md)**: historia técnica y QA.
- **[Auditoría documental bajo demanda](https://github.com/akumanomi1988/FlyingFree/actions/workflows/documentary-audit.yml)**: replay ecológico de doce especies, contact sheet con tres encuadres y artefactos descargables.
- **[Manifiesto del build público](https://akumanomi1988.github.io/FlyingFree/build-info.json)**: comprobar el SHA efectivamente servido tras publicar, no confundir con HEAD local.

Regla: no dar por completada una mejora visual por haber pasado los tests; se requiere validación perceptiva y rendimiento en dispositivo objetivo.

## Características fundamentales
- Twelve selectable bird species, each with an individual flight profile and articulated 3D silhouette.
- Deer, foxes, rabbits, butterflies, gulls, and dolphins with habitat-aware motion and simple activity/rest cycles.
- Procedural 3D island with trees, rocks, meadows, ocean shader, cloud layers, stars and sun.
- Local astronomical sunlight when location is permitted; device time is used for the clock.
- Seven types of weather, smooth transitions, particle rain, camera direction and synthetic soundtrack.
- Five bird camera shots, wildlife documentary framing and panoramic sequences.
- Adaptive render resolution for slow GPUs; limited geometry on narrow screens.
- Browser-based checks: `?selftest=1`, GitHub Actions screenshots and console/error monitoring.

## Controls
| Key | Action |
|---|---|
| B | Open/close bird selector |
| 1, 2, 3, 4 | Actual astronomical dawn, solar noon, sunset, night |
| 5 | Change weather |
| 6, 7, 8 | Time speed ×1, ×60, ×600 |
| Space | Wing beat |
| M | Start or mute audio |
| H | Hide/show interface |
| P | Capture PNG |
| F | Fullscreen |
| T | Toggle TV screensaver |
| R | Return to real time |
| Esc | Close panels |

URLs: `?phase=dawn`, `?phase=sunset`, `?h=6.4`, `?bird=owl`, `?weather=storm`, `?broadcast=1`, `?selftest=1`.

## Testing
`npm test` exercises the deterministic math, solar clock and bird paths.
`npm run test:browser` runs Playwright against the built website, checking WebGL scenes, fauna, species selection, keyboard controls and major day/weather scenarios. Evidence is written to `artifacts/visual`. Install Chromium once using `npx playwright install chromium`.
Every pull request runs Node, Vite and browser QA once in GitHub Actions. Feature branches without a PR can run the quality workflow manually via `workflow_dispatch`; outdated runs are cancelled when a PR is updated. Pushes to `main` use the separate build/test/deploy workflow for GitHub Pages.

## Engineering limitations
This is a stylized, procedural ecosystem, not photorealistic animal footage or an ecological simulator. Animal shape/behaviour is representative rather than anatomically and biomechanically exhaustive. It does **not** contain an OBS/RTMP supervisor, nor has 72-hour continuous-operation testing been completed. GitHub Pages hosts the WebGL app; live video emission is a separate Windows/OBS undertaking.

No external image, video, or recorded music assets are required.

## Mundo vivo · Versión 0.4
- Aves: IA determinista con hambre, energía, ciclos de actividad, búsqueda de recursos por biomas, persecución, aproximación, descenso, aterrizaje, alimentación, refugio, descanso y despegue.
- Velocidad, maniobrabilidad y altura se ajustan por especie. Los vuelos son cinemáticos y estilizados, no biomecánica de laboratorio.
- Vegetación: pinos, robles, cipreses, olivos y abedules; arbustos, flores y hierba por humedad, pendiente y altitud.
- Insectos instanciados que solo aparecen cerca del suelo cuando la luz, temperatura y precipitación permiten su actividad.
- Zorros y conejos interactúan mediante caza y huida simplificadas. Los ciervos reaccionan al ave.
- LOD ecológico: mallas reutilizables de hierba, flores, arbustos e insectos activas solo a baja altura; sin generar miles de objetos independientes.

## Hora real y tiempo meteorológico
- En la experiencia normal el reloj es el del dispositivo del espectador, y el ciclo solar sigue la fecha y hora reales.
- Al conceder permiso de geolocalización, el amanecer, el sol y el ocaso utilizan la latitud y longitud del dispositivo y el clima se obtiene de Open-Meteo. La ubicación no se muestra ni se guarda, y las coordenadas compartidas con la API se redondean a 0,1 grados.
- En las visitas normales, la pantalla inicial ofrece «Entrar con clima local» y «Continuar sin ubicación». La opción sin ubicación no solicita ni reutiliza la geolocalización, aunque el permiso del navegador ya esté concedido. En modos TV y emisión se reutiliza silenciosamente un permiso previamente concedido; si no existe, el modo TV incluye un botón para activarlo.
- Si no hay permiso, acceso geográfico o red, el clima ambiental sigue funcionando, **claramente señalado como simulado**, y el sol es una aproximación según la zona horaria.
- El botón **☁** activa el clima local. Si el permiso está bloqueado, se muestra cómo modificar los ajustes del sitio. **R** vuelve al tiempo real tras usar atajos de demostración.
- Los parámetros `?h=23`, `?phase=sunset` y `?weather=storm` son demostraciones y no representan la observación meteorológica actual.
- Los datos pertenecen al dispositivo que está ejecutando la web. En una emisión de vídeo, todos los espectadores verían el clima de la máquina que genera esa emisión, no el clima individual de cada espectador.

## Salvapantallas de TV
Abre <https://akumanomi1988.github.io/FlyingFree/?tv=1> o pulsa **T**. La imagen ocupa la pantalla sin paneles invasivos, mientras que reloj, fecha, temperatura, viento y humedad se muestran en una capa discreta que se desplaza ligeramente para reducir retenciones. Puedes autorizar el clima desde la pantalla TV, acceder a sonido con un gesto y usar **F** para solicitar pantalla completa. El audio no empieza solo porque las políticas del navegador impiden el autoplay.

La función de suspensión del sistema o de ahorro de energía del televisor depende del navegador y del propio dispositivo; no hay garantía de funcionamiento continuo sin interrupción.

## Limitaciones, condiciones y privacidad
El código se entrega desde GitHub Pages. No contiene publicidad, trackers ni un backend de geolocalización. La localización solo se pide con permiso del visitante y solo se conserva en la memoria de la página. Open-Meteo recibe una coordenada aproximada y la IP de la petición HTTPS. No se representan nombres de ciudad, región ni coordenadas en pantalla. La ruta y el código contienen un proveedor externo para el clima y un enlace de atribución.

**Open-Meteo (API gratuita):** uso no comercial y límite inferior a 10.000 peticiones diarias según sus términos; datos bajo CC BY 4.0. Si se monetiza FlyingFree, debe contratarse una licencia comercial y valorar un proxy/caché regional con control de cuota. Datos meteorológicos sujetos a disponibilidad del proveedor.

No hay modelo de lenguaje por animal, renderizado fotorrealista, OBS, RTMP ni pruebas de 72 horas todavía.

## Pruebas
`npm test` verifica reloj local, perfiles de fauna, terreno, biomas, estados y API meteorológica simulada. `npm run test:browser` utiliza Chromium/WebGL y escenarios de escritorio, móvil, noche, lluvia y salvapantallas TV con geolocalización y API mockeadas. El workflow de Pages bloquea el despliegue si falla cualquiera de estos pasos.

## Animación y renderizado 0.5
- Viento variable en GPU: copas de árboles, coníferas, arbustos, pétalos y hierba se deforman en el vertex shader sin crear miles de objetos o actualizar matrices en CPU.
- Nubes volumétricas low-poly con deriva continua, sombra cromática y color al atardecer; resplandor del sol y luna, horizonte atmosférico más rico.
- Océano con micro-oleaje, reflejos solares, color turquesa costero, brillo variable y espuma de rompiente.
- Animación esquelética ligera de patas, orejas y colas en ciervos, zorros, conejos y delfines; aleteo y plegado de alas con interpolación, cola y postura de aterrizaje de las aves.
- Cámara contextual con plano cercano al aterrizar o alimentarse; motas y luciérnagas generadas solo a baja altura.
- Presupuesto de píxeles inicial limitado a ~3,7 MP para televisores 4K, degradación progresiva de escala bajo FPS insuficientes.
- Las geometrías y los materiales se crean una sola vez. El detalle aéreo se oculta por altura; se añaden pruebas del viento, del movimiento animal, del LOD y de los renders.
- Se mantiene un lenguaje visual **low-poly artístico**. No se presenta como fotorealismo, y todavía queda por medir la estabilidad en televisores físicos durante 24–72 h.


## Banda sonora adaptativa al clima

La música se sintetiza íntegramente en el navegador con Web Audio API, sin descargas de pistas ni licencias de grabaciones. Se refuerzan las armonías y aparece una melodía generativa de notas tipo campana/arpas. Dos bancos de osciladores cruzan sus volúmenes al cambiar de clima para evitar saltos bruscos de armonía.

- Cielo despejado: armonía mayor y brillo alto; nubosidad: armonía suspendida.
- Lluvia y llovizna: carácter íntimo, brillo reducido y fraseo más espaciado.
- Tormenta: armonía menor profunda; niebla: texturas suaves; nieve: timbre cristalino.
- El sol, el crepúsculo y la noche modulan el filtro, la densidad melódica y la presencia sonora progresivamente.
- Las notas se programan con antelación en el reloj de Web Audio y el planificador se resincroniza si el navegador limita los fotogramas.
- **M** o **♪** activan/silencian audio. El navegador exige un gesto de usuario para arrancar la música.
- Los osciladores de fondo se reutilizan; las notas temporales se desconectan al terminar. El motor puede liberarse con el método dispose().

Pruebas: tests/audio.test.js comprueba perfiles meteorológicos, transiciones, gestión de silencio, planificador y reutilización de osciladores.
