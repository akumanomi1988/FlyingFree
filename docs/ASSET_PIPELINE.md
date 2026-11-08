# VE-05 — Asset GLB/glTF y Blender

## Contrato de producción
- 1 unidad Three.js = 1 metro, mismo tamaño en todos los LOD; ningún scale-to-fit en runtime.
- Coordenadas GLB: +Y arriba, -Z adelante/pico y +Z cola; X envergadura.
- El origen se encuentra en el centro torácico en reposo/planeo.
- Armature y huesos obligatorios: Root, Body, Head, Wing_L, Wing_R,
  WingTip_L, WingTip_R, Tail, Leg_L, Leg_R, Foot_L, Foot_R.
- Exactamente dos alas físicas, sin superficies duplicadas.
- Mallas: Body.*, Breast.*, Bill_*, Eye_L/R, WingSurface_L/R_*, Rectrix.*, Toe.*.
- Materiales con prefijo MAT_; PBR metalness=0, roughness 0.6-1;
  texturas propias o con licencia comprobada.
- glTF 2.0 binario (.glb), buffers embebidos, skinning exportado e influencias
  de hueso limitadas a cuatro por vértice. No hay clips ni AnimationMixer nuevos:
  son responsabilidad de VE-06.
- LOD0 cerca de cámara, LOD1 a partir de 8 metros; mismos huesos y envergadura,
  significativamente menos triángulos.

## Referencia original
Martín pescador / Alcedo atthis: 0.26 metros de envergadura como src/core.js.
El generador original scripts/build-bird-assets.mjs crea dos GLB y un manifest
desde geometría anatómica propia: torso, cabeza, pico de dos mandíbulas, dos
alas con primarias, secundarias, coberteras, cola, dos patas y dedos.
No descarga ni reutiliza modelos externos. Los GLB son outputs reproducibles
en public/assets/birds. Se generan mediante npm run build y npm run dev.

**Procedencia/licencia:** código geométrico original desarrollado en este
repositorio; no se integran assets de terceros. La redistribución independiente
del modelo requiere decisión expresa del titular del proyecto y anotación de
la licencia correspondiente; no se atribuye una licencia CC0 de forma ficticia.

## Blender -> GLB para futuros assets
1. Trabajar en metros y medir la envergadura real con instrumentos de Blender.
2. Blender utiliza Z arriba. Marcar +Y Up al exportar glTF y validar que
   la cabeza apunta a -Z **en el GLB**; aplicar Rotation & Scale.
3. Nombrar armature, bones y meshes conforme al contrato; exactamente dos
   raíces de ala, sin geometría escondida duplicada.
4. Crear Skin con pesos normalizados (máx. 4 influencias) y binding consistente
   entre LOD0 y LOD1. Sin clips todavía.
5. Usar Principled BSDF, materiales PBR y texturas con licencia verificable;
   simplificar materiales para reducir draw calls. No introducir alpha blending
   innecesario, texturas 4K ni geometría oculta.
6. Eliminar vértices degenerados, revisar normales, UV, transforms y escala;
   generar LOD1 mediante retopología/decimación con revisión de silueta.
7. Exportar glTF Binary (.glb) con skins y materiales, sin cámaras/lámparas;
   documentar autor, licencia, procedencia y modificación en manifest.
8. Ejecutar npm run audit:assets, npm test, npm run build,
   npm run test:browser, y revisar capturas multiángulo reales.
9. Sustituir la fase generativa por una fase de exportación versionada cuando
   exista el modelo Blender validado; no sobrescribir manualmente los GLB
   que la compilación regenera actualmente.

## Runtime, caché, seguridad y reversión
BirdAssetLibrary utiliza GLTFLoader.loadAsync, caché deduplicada por URL,
SkeletonUtils.clone para huesos independientes, release para liberar
instancias, clearUnused para plantillas ociosas y dispose para liberar
geometrías, materiales y texturas. El cache de dos LOD es acotado.
Mientras se carga se mantiene el rig procedural anterior. Con éxito se
ocultan las mallas procedurales y se añade el GLB a la misma raíz;
la pose traslada las rotaciones existentes, sin crear un motor de animación.
Si falla red, parseo o permiso de hardware, se usa exclusivamente fallback.
Se fuerza con el parámetro assets=procedural; WebGL2 y memoria >2 GB son
los criterios de elegibilidad. Sin WebGL2 el renderer anterior conserva su
política de error, no se añade un motor nuevo.

**Validación técnica:** npm run audit:assets genera GLB y verifica mediante
GLTFLoader.parse huesos, skins, envergadura y reducción geométrica;
artifacts/assets/geometry.json guarda resultados. npm test cubre
carga concurrente, fallo/recuperación, ciclo de vida, nivel de memoria y pose.
npm run test:browser toma capturas en 3 cámaras/semillas del nuevo activo
y prueba 404 forzado y modo procedural.

**Pendiente de revisión humana:** silueta de los dos perfiles, escala en
árboles y terreno, detalles de plumas, sonido y TV. No se han medido P95/P99
ni memoria GPU física; SwiftShader es únicamente QA funcional. El render de
CI no equivale a aceptación artística. El rollback consiste en revertir la
PR VE-05 o usar assets=procedural temporalmente.

## Inspección anatómica de alta resolución

La cámara del documental encuadra al ave en su hábitat: un martín pescador
de unos 26 cm resulta pequeño junto a árboles de 20 metros. No se puede
certificar la geometría individual con esas capturas panorámicas.

Se incluye el visor QA `asset-preview.html`, con iluminación neutra,
cámara ortográfica, escala métrica real, lectura de draw calls/triángulos
GPU y vistas front, side, top, threeQuarter, back, tanto para LOD0 como
para LOD1. El visor no introduce dependencias en WorldQuery ni en BirdBrain.

```text
/FlyingFree/asset-preview.html?view=threeQuarter&lod=0
/FlyingFree/asset-preview.html?view=top&lod=1
```

Playwright exporta diez capturas `VE05-LOD*-*.png` en
`artifacts/visual/`, además de las escenas reales 08-14 en el ecosistema
y la comparación procedural en la misma semilla. CI archiva los artefactos
como `flyingfree-visual-evidence` y `ve05-kingfisher-glb-evidence`.

## Contrastación morfológica

Para la referencia Alcedo atthis se toman las proporciones de
[Feather Library — Specimen 1, macho](https://featherlibrary.com/specimen/ftlbgj090001/):
envergadura medida 247 mm, longitud con cola 145 mm, cola 29 mm
y pico 31,3 mm. La envergadura visual se aproxima al perfil VUELO
existente (260 mm), mientras que el largo del asset se mantiene
en torno a 145 mm. Estas cifras se usan como referencia de diseño,
no se descargan ni incorporan imágenes ni mallas de esa fuente.

El generador codifica la proporción longitudinal y el ancho ANTES
de enlazar los esqueletos, de forma que GLB, cámaras y BVH leen la
misma envergadura física; su root GLB incluye una transformación
de autoría que no se modifica en runtime para encajar en la cámara.
En los assets Blender posteriores se deben aplicar las transforms
antes de exportar. La comprobación estructural rechaza ejemplares
que excedan los rangos de longitud y envergadura establecidos.
