# VUELO · Etología y límites de la simulación (2026-11-06)

Este documento distingue **observación zoológica**, **aproximación de software** y **funcionalidad pendiente**. Los nombres de la UI representan tipos de ave, no identificaciones científicas con sexo/edad/área de distribución completos; no extrapolar cifras exactas de una especie a todas las del grupo.

## Principios fundamentados

- **Colibríes:** Cornell Lab documenta para el colibrí de cola ancha un aleteo en suspensión de alrededor de 50 golpes/s, alimentación de néctar e insectos y vigilancia territorial. La simulación conserva una frecuencia biológica declarativa de 45 Hz; por límites de muestreo de monitores 60 Hz, el *render* dibuja un ciclo estilizado limitado a 13 Hz. No simular el aleteo real con un seno de 45 Hz sin motion blur (aliasing visual). [Cornell Lab](https://www.allaboutbirds.org/guide/Broad-tailed_Hummingbird/lifehistory), [BBC Earth](https://www.bbcearth.com/factfiles/animals/birds/hummingbird).
- **Albatros:** Cornell describe planeo dinámico a baja altura sobre olas, aleteos infrecuentes y búsqueda de alimento lejos de tierra. Por tanto, su vuelo no debe parecer un colibrí ni mantenerse continuamente aleteando. [Cornell Lab](https://blog.allaboutbirds.org/guide/Black-footed_Albatross/id).
- **Vencejos:** Cornell indica que el vencejo de chimenea captura insectos en vuelo, tiene aleteos rápidos y poco profundos y no se posa en ramas; puede agarrarse a paredes verticales o cavidades. En VUELO se desactiva el posado arborícola genérico, pero **aún no hay agarre físico a pared/cueva**. [Cornell Lab](https://www.allaboutbirds.org/guide/Chimney_Swift/overview).
- **Gaviotas:** RSPB describe oportunismo trófico (peces, crustáceos, huevos, etc.) y nidificación en salientes/acantilados para ciertos taxones. El modelo VUELO usa alimentación costera simplificada y flotación acuática; no representa una colonia reproductora completa. [RSPB](https://web-cdn.rspb.org.uk/birds-and-wildlife/great-black-backed-gull).
- **Martín pescador:** la secuencia de aproximación, captura y salida del agua requiere picado, salpicadura, presa visible y regreso a posadero. El estado actual de pesca no reproduce aún todos esos fenómenos; fotos/vídeo de referencia de [National Geographic](https://www.nationalgeographic.com/podcasts/overheard/article/episode-7-legends-kingfishers-otters-red-tailed-hawks).

## Modelado introducido en esta iteración

`src/birdEcology.js` reúne, para las doce especies, un **perfil de intención** de altura de vuelo, perfil de gasto energético, hábitat, nido, reposo y frecuencia alar. No se trata de una fuente científica de constantes universales, sino de una capa de dirección calibrable.

- Colibrí/martín pescador/golondrina: patrullas más cercanas a doseles y corredores fluviales.
- Buitre/águila/águila pescadora: sobrevuelo del dosel, laderas, acantilados y corrientes ascendentes (las térmicas todavía son aproximaciones de comportamiento).
- Albatros/gaviota: costa y mar, reposo flotando donde corresponde.
- Garza: humedales y marcha/vadeo en agua somera; no debe nadar como una gaviota.
- Vencejo: actividad eminentemente aérea, sin reposo inventado sobre ramas. El estado `aerial_rest` permite recuperar energía planeando sin aterrizar (también durante la lluvia); no representa agarre real a roquedos ni reproducción, y se comprueba con `tests/aerialRecovery.test.js`.

El mapa cambia de **semilla por sesión** si la URL no especifica `seed`. Para comparar fotogramas o auditar regresiones usa `?seed=1988`, que reproduce la misma geografía. La variación procedural sigue apoyándose en un modelo insular con los mismos algoritmos de montañas y ríos; no genera todavía un archipiélago ni evolución geológica de años.

## Brechas no cubiertas

1. Montaje visual revisado de nidos y emplazamientos reales según especie (apenas existen metadatos, no reproducción/cuidado parental).
2. Alimentación con presas visibles, conducta de aproximación y captura física, especialmente peces e insectos.
3. Contacto preciso de patas con ramas concretas, desplazamiento terrestre, zancudas y gallináceas; el posado aproximado usa alturas de copas reales, pero no IK de dedos.
4. Ala de colibrí como volumen temporal/blur correcto en 60 FPS; no forzar un seno físicamente imposible de visualizar.
5. Interacciones de población, territorialidad, época reproductora, muda y migraciones según época.
6. Supervisión visual del mar y rompientes en acantilados, y benchmarking GPU real; las olas en shader no son un solucionador de fluidos.

**Criterio de aceptación:** no etiquetar «realista» por haber añadido una tabla de especies. Revisar vídeos de cuatro minutos con seed fija y especies alternadas, contrastar con observación y validar comportamiento de 30–60 minutos.
