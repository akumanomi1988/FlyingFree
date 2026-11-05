# FlyingFree 0.5 — Contrato de render y animación

## Dirección artística
Low-poly naturalista y contemplativo: paleta de vegetación suave, iluminación solar cálida, horizonte con dispersión atmosférica, agua con color por profundidad aparente y movimiento ambiental continuo.

## Presupuesto y arquitectura
- Un único WebGLRenderer, Three.js r0.180 y shader de cielo y océano. Sin dependencias de postprocesado que multipliquen los pases.
- La deformación de viento se ejecuta en MeshStandardMaterial.onBeforeCompile; uniformes compartidos de tiempo y fuerza, y programas de GPU cacheados por parámetros.
- La vegetación de detalle genera un pool fijo de InstancedMesh por categoría. El pool se recoloca solo cuando cambia la celda espacial y desaparece por altitud.
- Nubes comparten geometría de esfera y cada grupo tiene un material para su visibilidad; se desplazan y reciclan en el perímetro del mundo.
- Motas diurnas y luciérnagas nocturnas reutilizan buffers de Points con baja frecuencia de actualización.
- Animaciones de animales: transformaciones de articulaciones y poses derivadas de estados; no se regeneran mallas cada fotograma.
- El render inicial limita el número de píxeles físicos a unos 3,7 millones, incluso en 4K. Si los FPS se mantienen bajos, se reduce la resolución sin disminuir los objetos críticos.

## Pruebas
Node: instanciación, shader wind, materiales, jerarquías animadas, LOD y escenas sin excepciones.
Chromium: cinco escenas climáticas y móviles, más TV con Open-Meteo simulado. Se capturan evidencias y se exigen señales de color y actividad de animación.

## Límites
- Las sombras de árboles, animales y nubes no son todavía trazadas físicamente. El amanecer/ocaso es astronómico cuando se permite geolocalización; el clima requiere el servicio externo.
- La física del vuelo, conducta y extremidades es estilizada; una simulación biomecánica y un LOD de terreno multicelda quedan fuera de esta iteración.
- No se ha validado en televisores de fabricantes específicos ni durante 72 horas continuadas.
