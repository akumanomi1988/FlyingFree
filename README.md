# FlyingFree · VUELO

Mundo audiovisual procedural en el navegador: isla generativa, ave animada, luz astronómica, meteorología y sonido sintetizado en tiempo real.

**Estado:** prototipo F0/F1, no sistema de emisión 24/7.

## Desarrollo

```sh
npm install
npm run dev
npm run test
npm run build
```

La versión publicada en GitHub Pages compila Three.js dentro del paquete; el visitante no necesita un CDN ni instalar nada.

## Controles

- **1–4:** amanecer, mediodía, atardecer, noche.
- **5:** siguiente clima.
- **6–8:** velocidad ×1, ×60, ×600.
- **Espacio:** aleteo.
- **H:** ocultar/mostrar interfaz.
- **P:** captura PNG.
- **F:** pantalla completa.
- **M:** alternar sonido.

Parámetros opcionales: `?h=6.4`, `?bird=albatross`, `?weather=storm`, `?broadcast=1`, `?selftest=1`.

## Alcance honesto

Incluye una primera experiencia navegable con océano, elevación y vegetación procedurales, ciclo solar aproximado, cinco perfiles de vuelo y mezcla de sonido por Web Audio. No incluye todavía migración estacional avanzada, LOD completo, aves biológicamente precisas, supervisor Node, OBS ni transmisión automática a YouTube. La web requiere un navegador compatible con WebGL2 y Web Audio.

## Despliegue

Se incluye el workflow `.github/workflows/pages.yml` para GitHub Pages. En **Settings → Pages → Build and deployment → Source** selecciona **GitHub Actions** (configuración inicial manual que exige permisos administrativos).

URL prevista: https://akumanomi1988.github.io/FlyingFree/

## Derechos

Código original publicado bajo MIT. No se utilizan imágenes, vídeos ni música grabada de terceros.
