# VUELO — Ecología y conducta observable

**Estado:** modelo de simulación estilizado. No afirmar equivalencia científica con doce poblaciones silvestres reales.

## Lo que se ha contrastado

Las fuentes consultadas orientan la representación; no sustituyen la identificación taxonómica precisa de cada espécimen:

- **Colibríes:** Cornell documenta alrededor de 50 aleteos/segundo al cernirse en algunas especies y alimentación con néctar/insectos. En pantalla, una animación de 50 Hz a 60 FPS produciría aliasing: se ha elegido una cadencia visual menor de 18 Hz como aproximación, pendiente de material de ala con desenfoque/ilusión óptica adecuada. [Cornell](https://www.allaboutbirds.org/guide/Broad-tailed_Hummingbird/lifehistory), [UC Davis](https://hummingbirds.vetmed.ucdavis.edu/information/facts).
- **Vencejos:** RSPB confirma que pasan casi toda la vida en vuelo, comen y pueden descansar en el aire, y aterrizan principalmente para criar. La simulación añade recuperación mediante planeo en vez de aterrizaje forzado. [RSPB](https://www.rspb.org.uk/birds-and-wildlife/swift).
- **Cernícalos:** la caza al acecho y cernido precede al descenso a por la presa, y utilizan perchas elevadas. [RSPB](https://web-cdn.rspb.org.uk/birds-and-wildlife/identifying-birds/whats-that-bird-of-prey).
- **Garzas:** son aves zancudas que buscan alimento en humedales poco profundos, no aves típicamente nadadoras. [Cornell BirdSleuth](https://www.birds.cornell.edu/latam/wp-content/uploads/2022/05/BirdSleuth-Caribbean-Curriculum-English-Complete.pdf).
- **Criterio de observación:** Cornell separa el estilo de vuelo, cadencia, direccionalidad y obtención de alimento; hay que medir acciones visibles, no solo animar una máquina de estados. [Cornell Bird Academy](https://academy.allaboutbirds.org/inside-birding-behavior/).

## Restricciones de arquitectura

| Grupo | Zona preferente | Vuelo representado | Alimentación | Reposo |
| --- | --- | --- | --- | --- |
| Colibrí | Copa y flores | Aleteo visual rápido, cernido | Néctar/insectos | Ramas finas |
| Vencejo | Cielo despejado | Vuelo sostenido y planeo | Insectos al vuelo | Recuperación aérea |
| Golondrina | Claros / bordes de bosque | Maniobras y vuelos rasos | Insectos al vuelo | Posadero |
| Martín pescador | Riberas | Trayectos rápidos a poca altura | Pesca en agua dulce | Rama sobre cauce |
| Garza | Humedal y orilla | Batido lento, aproximación | Pesca zancuda | Orilla |
| Cernícalo | Pradera / claros | Cernido y patrulla | Roedores e insectos | Percha |
| Buitre / águila | Crestas | Térmicas y largos planeos | Carroña / presas | Roquedo y árbol |
| Águila pescadora | Costa y estuario | Planeo y picado | Pesca | Árbol costero |
| Gaviota | Costa y mar | Batidos moderados / planeo | Oportunista | Playa y flotación |
| Albatros | Mar abierto | Planeo dinámico | Pesca y cefalópodos | Flotación |
| Búho | Bosque | Vuelo silencioso nocturno | Vertebrados | Posadero |

**Limitación científica:** VUELO agrupa especies de distribuciones geográficas incompatibles con una sola isla tropical. Es una decisión de catálogo visual, **no** un ecosistema biogeográficamente fiel. Para fidelidad naturalista completa se requiere fijar región y población, reemplazar especies fuera de distribución y coordinar estaciones y migraciones. El selector no debe presentar este catálogo como una comunidad tropical autóctona.

## Lo que realmente hace el código

- `src/speciesEthology.js`: restricciones de navegación, etiquetas de fisiología, dieta y tipo de nido descriptivos; **no** genera nidos 3D, peces ni captura física todavía.
- `src/behaviour.js`: hambre, energía, búsqueda de alimentos, aproximación, posado, alimentación, sueño, despegue y descanso aéreo de vencejos; niveles simplificados, sin metabolismo validado.
- `src/flight.js`: rig alar y animaciones según especie/estado; amplitudes perceptivas, no biomecánica de alta fidelidad.
- `src/hudStatus.js`: mediciones observable de energía/hambre/estado y minimapa; «condición» significa regla funcional, **no sensaciones mentales inferidas**.
- `src/treeDetail.js`: la forma arbórea lejana persiste y capas detalladas escalan suavemente; falta un sistema de LOD por geometría de cada especie a nivel global.

## Puertas pendientes

1. Grabación de 4 minutos por especie, cámara cerca y lejos, con evaluador externo.
2. Nidos 3D reales por especie, búsqueda de perchas y contacto físico de patas con ramas.
3. Capturas de peces/insectos y alimentación con objetivos persistentes y recursos consumibles.
4. Validar frecuencias visuales contra vídeos en cámara lenta y revisar aliasing a 30/60/120 FPS.
5. Introducir zonas regionales reales y rechazar especies no compatibles, si se exige naturalismo estricto.
6. Evaluar gradientes de temperatura, cansancio y hábitat con datos científicos específicos (no confundir heurísticas con hechos).

La regla del proyecto es implementar conductas observables antes de añadir más especies.
