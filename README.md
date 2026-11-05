# FlyingFree · VUELO

Experience a procedural coastal island, twelve selectable bird species, wildlife, physical sun cycle, dynamic weather, and original algorithmic ambient music.

## Run locally
```bash
npm install
npm run dev
npm test
npm run build
```

**Public website:** https://akumanomi1988.github.io/FlyingFree/

## Features in v0.2
- Twelve selectable bird species, each with an individual flight profile and articulated 3D silhouette.
- Deer, foxes, rabbits, butterflies, gulls, and dolphins with habitat-aware motion and simple activity/rest cycles.
- Procedural 3D island with trees, rocks, meadows, ocean shader, cloud layers, stars and sun.
- Solar position based on UTC, latitude 37° N, longitude -5° and presentation in Europe/Madrid.
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
| Esc | Close panels |

URLs: `?phase=dawn`, `?phase=sunset`, `?h=6.4`, `?bird=owl`, `?weather=storm`, `?broadcast=1`, `?selftest=1`.

## Testing
`npm test` exercises the deterministic math, solar clock and bird paths.
`npm run test:browser` runs Playwright against the built website, checking WebGL scenes, fauna, species selection, keyboard controls and major day/weather scenarios. Evidence is written to `artifacts/visual`. Install Chromium once using `npx playwright install chromium`.
Every PR and feature-branch push runs this in GitHub Actions. The `main` workflow deploys GitHub Pages.

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
- Al abrirse otra vez, si el permiso sigue concedido, se reactivan los datos automáticamente.
- Si no hay permiso, acceso geográfico o red, el clima ambiental sigue funcionando, **claramente señalado como simulado**, y el sol es una aproximación según la zona horaria.
- El botón **☁** activa el clima local. **R** vuelve al tiempo real tras usar atajos de demostración.
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
