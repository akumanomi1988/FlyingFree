# VUELO — Contrato de calidad y reproducción

Fecha de revisión: 2026-11-06. Documento operativo; un check técnico verde **no** certifica calidad documental, rendimiento en GPU física ni despliegue público.

## Fuente de verdad

1. `main` es la única versión integrada. Una rama abierta o un PR verde no se presenta como producción.
2. Cada cambio visual contiene una prueba con semilla y un artefacto de antes/después; para una regresión de encuadre registrar especie, semilla, meteorología, hora, resolución y FPS.
3. La URL pública debe servir `/FlyingFree/build-info.json` con la revisión esperada; comparar SHA después del workflow Pages. No inferir publicación a partir de un merge.
4. Los informes CI obtenidos con SwiftShader sirven para reproducir fallos funcionales y de composición; **no** representan FPS de una GPU de usuario.

## Puertas automáticas (bloquean integración)

| Puerta | Comando | Qué demuestra | Qué no demuestra |
| --- | --- | --- | --- |
| Estado puro | `npm test` | IA, matemáticas, ecosistema, animación y regresiones de cámara | Validación zoológica / física |
| Paquete navegable | `npm run build` | Empaquetado Vite y procedencia del build | Despliegue |
| Render + UX | `npm run test:browser` | WebGL, consentimiento, clima, UI, director, screenshots con semillas | Calidad artística o FPS real |
| Hábitat | `npm run audit:habitats -- --seed=1988 --seconds=1800 --strict` | Replays deterministas y proporción por bioma | Poblaciones ecológicas realistas |
| Anatomía | `npm run audit:visual -- --seed=1988` | Hoja de contacto generada con las 12 aves × 3 ángulos | Que una persona haya aprobado las imágenes |

El workflow manual `documentary-audit.yml` conserva los informes de revisión. En `tests/browser.mjs`, el escenario `05-mobile-selector` reproduce la niebla matinal con `?h=8&bird=hummingbird&weather=fog&seed=1988` a 390×844. La captura oscura/casi monocromática que disparó CI en PR #22 es un **defecto abierto hasta que una ejecución posterior pase sin relajar el umbral**.

## Aceptación de encuadre

El director `src/cameraDirector.js` debe:
- Seguir todo el movimiento **horizontal** del sujeto; suavizar altura y orientación de forma independiente.
- Evitar cortes por temporizador, pérdida de sujeto, oclusión sostenida y clipping de terreno.
- Conservar rotación limitada y encuadre a 15/30/60 FPS, incluso para colibríes de envergadura pequeña.
- Exponer `status.framing` como coordenadas normalizadas de pantalla (NDC X/Y/Z) y distancia cámara–ave para depuración. Coordenadas NDC fuera de ±1 indican sujeto fuera del frustum; no muestran ubicación del visitante.
- Revisar paisaje, tamaño del animal y continuidad de los cambios de especie por captura humana, sin declarar superados los problemas de oclusión por una única aserción.

## Aceptación ecológica

- El mismo `worldSeed` determina malla, ríos, costa, hábitats, recursos y cámara. `?seed=N` reproduce el escenario; cada sesión normal puede usar semilla distinta.
- Una especie seleccionada comienza en un hábitat apropiado; no hereda una posición imposible del sujeto anterior.
- Los objetivos de pesca deben existir en un hábitat acuático según la especie; no sustituir la falta de alimento con peces invisibles en bosques.
- Los vencejos agotados recuperan energía planeando sin aterrizar en tierra; el estado `aerial_rest` no implica nido ni agarre a roca.
- Alimentación, descanso, flotación y apoyo deben coincidir con la postura visible. Metabolismo y frecuencias de ala siguen siendo aproximaciones estilizadas, no datos zoológicos calibrados.

## QA de rendimiento y estabilidad pendiente

Perfil inicial sugerido, **no resultado medido**:
- Medir CPU frame time P50/P95/P99, `renderer.info.render.calls`, triángulos, memoria JS y, cuando sea posible, GPU frame time. Separar calidad alta y TV económica.
- Aceptación de rendimiento se fija por hardware objetivo tras obtener baseline; evitar prometer 60 FPS sin medir.
- Ensayos de 30 min, 2 h, 8 h, 24 h y 72 h registrando heap, fugas, sonido, clima, recuperación WebGL, filtros de audio y cambios de pestaña.
- El audio requiere escucha en auriculares y televisor; el monitoreo automatizado no detecta zumbidos perceptivos, fatiga auditiva ni mezcla inadecuada.

## Checklist de entrega por PR

1. Semilla y pasos reproducibles documentados.
2. Cambios mínimos con tests de regresión del fallo (no reducir umbrales para hacer verde la CI).
3. Node + Vite + siete escenas Playwright/WebGL **en el último HEAD**, no en commits intermedios.
4. Evidencia visual revisada para cámara, alas, escala, fauna o paisaje; pendientes etiquetados.
5. Registrar decisiones y resultados reales en `docs/NEXT_SESSION.md`, enlazar PR y CI.
6. Integrar en `main` solo si las puertas están verdes; comprobar Pages y su SHA por separado.

## Fuentes y puntos de entrada

- [Roadmap](../ROADMAP.md)
- [Handoff y PR históricas](./NEXT_SESSION.md)
- [Límites de conducta animal](./BIRD_BEHAVIOR.md)
- [Atlas documental](../public/roadmap/index.html)
- [Workflow QA](../.github/workflows/quality.yml)
- [Auditoría documental](../.github/workflows/documentary-audit.yml)
