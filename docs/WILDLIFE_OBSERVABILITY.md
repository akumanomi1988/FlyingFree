# Fauna persistente y observabilidad documental

La población no debe limitarse al punto inicial. La implementación reutiliza los 48 rigs existentes (en calidad estándar).
Cada celda de 360 metros obtiene candidatos por semilla, bioma y tipo. Al desplazarse el observador,
los rigs suficientemente lejanos se reasignan a residentes de nuevos hábitats. Los animales próximos
se protegen contra teletransportes. La caché espacial tiene un límite de 256 entradas. No se crean
nuevas mallas al cambiar de región.

Alcance: streaming visual y de estado local, no población individual persistente a escala de toda la
isla. Los residentes no conservan aún historial de reproducción, territorio ni consumo de recursos.

El módulo src/wildlifeObservatory.js mide cercanía, presencia geométrica en el frustum y tamaño proyectado.
El indicador recognizableProjected NO prueba ausencia de oclusión por terreno, hojas o niebla.
Un encuentro cercano puede influir suavemente en la mirada del director, sin cambio brusco de sujeto.
Los planos autónomos de acontecimientos distantes permanecen pendientes.

Telemetría: window.__FLYINGFREE_STATUS__.wildlifePopulation y
window.__FLYINGFREE_STATUS__.wildlifeVisibility. Las pruebas de Node verifican determinismo,
reutilización de rig, desplazamiento entre biomas y proyección. Playwright comprueba la integración.
La calidad artística y los FPS sobre GPU física siguen requiriendo aceptación independiente.
