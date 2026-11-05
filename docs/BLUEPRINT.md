# VUELO — Antecedentes del contrato F0/F1; actualizado para 0.4

## Visión
Mundo audiovisual generado en el navegador con un ave autónoma y ritmo contemplativo. El espectador no instala programas ni descarga activos audiovisuales. La página sirve archivos JavaScript empaquetados desde GitHub Pages.

## Objetivos iniciales verificables
- P0-01: Isla de 4300 m, relieve y vegetación basados en semillas fijas.
- P0-02: Océano animado procedural y cielo que evoluciona con el sol.
- P0-03: Cálculo solar dependiente de UTC, coordenadas autorizadas del dispositivo.
- P0-04: Hora mostrada según el reloj y zona horaria del navegador.
- P0-05: Doce perfiles de aves (cernícalo, colibrí, buitre, vencejo, albatros), seleccionables por URL y por día.
- P0-06: Siete climas controlables, con nubosidad, precipitación sonora, niebla y luminosidad.
- P0-07: Cámara cinematográfica con siete perspectivas, interpolación y seguimiento del sujeto.
- P0-08: Audio sintetizado en tiempo real, desbloqueado tras gesto explícito.
- P0-09: Guardar captura PNG mediante P.
- P0-10: Ajustar hora y velocidad de simulación por teclado.
- P0-11: Batería de pruebas Node para las funciones puras y diagnóstico visual via ?selftest=1.
- P0-12: Build de Vite con base /FlyingFree/ y despliegue desde main mediante GitHub Actions.

## Decisiones
Three.js 0.180.0, Vite 6.3.5, JavaScript ES modules. Es un prototipo funcional inicial: la migración a TypeScript, simulación de timestep fijo y LOD se planifican antes de la operación 24/7. GitHub Pages hospeda solo la experiencia visual; no ejecuta procesos Node ni puede administrar OBS.

## No implementado en F0/F1
Supervisor de streaming, integración OBS y RTMP, exportación offline, animaciones y ciclos vitales biológicamente precisos, transiciones meteorológicas de minutos, geometría de terreno versionada por semilla dinámica, LOD completo, tests de regresión visual, prueba continua de 72 horas.

## Criterios de aceptación F0/F1
1. `npm test` sin errores.
2. `npm run build` sin errores.
3. Renderizado WebGL en escritorio sin errores de consola.
4. `?selftest=1` con los checks verdes.
5. Teclas y parámetros de URL operativos.
6. Página accesible mediante HTTPS y fuentes locales empaquetadas, sin CDN de JavaScript.
7. Prueba manual en Chrome/Edge y smartphone; resultado documentado.

## Fases siguientes
F2: movimiento de especies, dormideros por hábitat, cámara y navegación rigurosa.
F3: clima de transición, sonido generativo tonal, estaciones y tratamiento artístico.
F4: supervisor Windows, servicio local, integración OBS y 72h de resistencia.
F5: despliegue offline, capturas para YouTube, composición de secuencias.
