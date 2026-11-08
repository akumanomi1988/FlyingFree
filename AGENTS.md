# AGENTS.md — Contrato de ejecución para agentes de VUELO

Este archivo se lee antes de modificar el repositorio. **No realizar análisis sin desarrollo** cuando se ha pedido ejecutar un hito. No añadir funciones arbitrarias: el siguiente hito se determina exclusivamente con [ROADMAP.md](./ROADMAP.md).

## Misión de producto
VUELO/FlyingFree es un documental autónomo estilizado en el navegador, con isla tropical procedural, doce aves, fauna y cámara cinematográfica. El usuario observa; no pilota. Calidad visual, biológica, estabilidad, testabilidad y rendimiento son las prioridades. No romper la versión pública por acelerar merges. Three.js se mantiene como renderer; la evolución prevista de física, BVH, animación, cámara y steering está aprobada **como plan**, no implementada por este documento.

## Inicio obligatorio (cada sesión)
1. Comprobar cuenta/repo \`akumanomi1988/FlyingFree\`, \`git status\`, último SHA de \`origin/main\`, PR abiertas, checks y último despliegue; no sobrescribir trabajo ajeno.
2. Leer \`ROADMAP.md\`, \`docs/ARCHITECTURE.md\`, \`docs/QUALITY_GATES.md\`, \`package.json\`; consultar \`docs/NEXT_SESSION.md\` solo para contexto histórico. **Si una descripción documental contradice el código de \`main\`, confiar en el código + CI y corregir el documento.**
3. Buscar el **primer hito pendiente** \`[ ]\` de ROADMAP y revisar dependencias. Si hay una PR ya abierta para ese ID, **continuarla**. Si el ID ya está desarrollado pero el checkbox quedó sin actualizar, comprobar y normalizar con evidencia; no duplicar la implementación.
4. Crear/usar rama dedicada \`feat/VE-XX-descripcion\` desde \`main\`. Un hito = una PR razonablemente revisable. Si encuentras defectos P0 que bloquean la aceptación, corregirlos en la misma PR o declarar bloqueo; no iniciar el hito siguiente.

## Implementación
- Entregar **código funcional**, no solo planes. Respetar los contratos de la sección «Arquitectura objetivo» del ROADMAP.
- No introducir dependencia, motor ni assets sin comparar coste, licencia, mantenimiento y utilidad real frente al sistema existente.
- Código determinista por semilla y timestep; no depender de framerate, orden no garantizado, reloj de pared o DOM para decisiones ecológicas.
- Conservar compatibilidad de \`window.__FLYINGFREE_STATUS__\`, \`?seed=\`, \`?selftest=1\`, controles, TV, consentimiento meteorológico y renderer actual.
- Modularidad por responsabilidades, sin reescritura total, sin desactivar tests, sin despliegue directo a Pages al margen de CI. Los assets deben tener procedencia/licencia explícita.
- El análisis y la refactorización sin integración observable **no cumplen** un hito.

## Definition of Done (checklist vinculante)
- [ ] Código del hito implementado y pruebas nuevas de regresión/determinismo, documentación de alcance y rollback.
- [ ] \`npm test\`, \`npm run build\` y \`npm run test:browser\` correctos para el **último HEAD**. Las capturas de WebGL no sustituyen revisión humana cuando el hito la exige.
- [ ] Capturas comparables antes/después, benchmarks (o anotación explícita «no medido») y ausencia de regresiones conocidas.
- [ ] Actualizar \`ROADMAP.md\`: **en el mismo push que los cambios funcionales validados**, cambiar solo VE-XX de \`[ ]\` a \`[x]\` y sustituir «Evidencia/PR/CI: pendiente» por PR, SHA, resultados y limitaciones reales. En el PR, el \`[x]\` es candidato hasta merge. Registrar además una entrada corta en \`docs/NEXT_SESSION.md\`.
- [ ] Push remoto y PR a \`main\`; comprobar CI del HEAD de esa PR. No fusionar si falla o no termina.
- [ ] Merge a \`main\` y comprobar que \`main\` contiene tanto código como checkbox. Verificar el workflow Pages y \`build-info.json.revision == main SHA\`; si Pages no se verifica, comunicar «integrado, despliegue pendiente» y resolverlo antes de iniciar el siguiente hito.
- [ ] Resumen de entrega: ID, archivos, pruebas, enlaces PR/CI, SHA de main, despliegue verificado o pendiente, próximo ID.

Si careces de permisos de push, merge, acceso a GPU o revisión humana, **no declares completado aquello que dependa de esos medios**. Deja una PR/patch reproducible y especifica exactamente el bloqueo. Nunca marques otros hitos ni infieras porcentajes de madurez a partir de checkboxes.

## Anti-regresiones críticas
- Las aves no pueden adquirir alas duplicadas, tamaños desproporcionados ni trayectorias incoherentes con su especie.
- La fauna cercana debe permanecer observable; no desplazar actores visibles sin transición.
- El terreno que usa IA/colisiones debe corresponder con la malla representada, incluidos ríos/costa.
- Cámara sin clipping ni pérdida continuada del protagonista, especialmente en móvil con niebla.
- LOD/instancing: no crear malla/rigid body para cada individuo lejano; justificar cambios de draw calls y coste de arranque.
- WebGL CI en GitHub Actions puede usar SwiftShader: no venderlo como benchmark GPU de producción.
- Clima local solo con permiso y ubicación nunca expuesta; audio solo tras gesto donde lo exige el navegador.

## Prompt de ejecución corto (también utilizable fuera de este repositorio)
> Trabaja en \`akumanomi1988/FlyingFree\`. Lee \`AGENTS.md\` y \`ROADMAP.md\`, inspecciona \`main\` y las PR abiertas y desarrolla **el primer hito pendiente** (o continúa su PR). Implementa código y tests, verifica Node/Vite/WebGL, actualiza su checkbox y evidencias **en el mismo push**, abre PR, intégrala solo con CI verde y comprueba el SHA publicado en Pages. Si algo bloquea la aceptación, no lo declares completado: documenta el bloqueo y entrega enlaces/SHAs. No avances otro hito.
