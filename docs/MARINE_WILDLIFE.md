# Fauna marina local y encuentros costeros

Antes, 34 gaviotas y 7 delfines orbitaban el origen a distancias de 4,6–5,8 km.
Ese diseño impedía que la mayoría de recorridos los encontrara.

La nueva asignación usa candidatos marinos por celdas deterministas de 480 metros,
compatible con la semilla y la batimetría. Los mismos modelos se reutilizan: no
se añaden jerarquías de meshes ni draw calls por repoblar una celda.

Los delfines solo reciben anclas en agua suficientemente profunda, con toda
su órbita contenida en agua. La velocidad orbital se expresa en m/s (2–4,4),
y la altura máxima de un salto se reduce a unos pocos metros respecto al nivel
del mar. Las gaviotas se concentran en océano, costa y humedales compatibles.

La reubicación no recicla residentes próximos al observador. La simulación
marina sigue siendo estilizada: falta formación de grupos, caza y navegación
social. Los animales submarinos no se anuncian como encuentros visuales
salvo cuando su cuerpo emerge lo suficiente para poder filmarlos.

Telemetría: marinePopulation, wildlifeVisibility y fauna dentro del estado
expuesto en window.__FLYINGFREE_STATUS__. Las pruebas de Node verifican
semillas, profundidad, rutas, pools y continuidad. Las escenas WebGL verifican
la integración, no el rendimiento garantizado en GPU física.
