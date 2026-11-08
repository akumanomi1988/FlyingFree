import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root='http://127.0.0.1:4173/FlyingFree/';
const directory='artifacts/visual';
await fs.mkdir(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
let serverLog='';
for(const stream of [server.stdout,server.stderr])stream.on('data',d=>serverLog+=String(d));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitServer(){
  for(let i=0;i<70;i++){
    try{const r=await fetch(root);if(r.ok)return;}catch{}
    await sleep(250);
  }
  throw Error('Vite preview no responde: '+serverLog);
}
const report={date:new Date().toISOString(),result:'pending',scenarios:[],errors:[]};
let browser;
async function render(name,query,width,height,runChecks,beforeNavigation){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,acceptDownloads:true});
  page.on('pageerror',e=>report.errors.push(name+' pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!(name==='11-kingfisher-missing-glb'&&/404|Failed to load resource/i.test(m.text())))report.errors.push(name+' console: '+m.text());});
  try{
    if(beforeNavigation)await beforeNavigation(page);
    const r=await page.goto(root+query,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(r?.status(),200,'Respuesta HTTP');
    await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.frames>6,null,{timeout:60000});
    await page.waitForTimeout(1100);
    await page.waitForFunction(()=>typeof window.__FLYINGFREE_STATUS__?.motion?.motes==='number',
      null,{timeout:12000});
    // Ask the engine for a one-shot sample immediately after renderer.render().
    // With preserveDrawingBuffer=false Chromium may clear the buffer *before*
    // a separate RAF callback, especially under mobile SwiftShader load.
    const stats=await page.evaluate(async()=>{
      const pixels=await window.__FLYINGFREE_RENDER_PROBE__();
      const c=document.querySelector('#viewport canvas'),s=window.__FLYINGFREE_STATUS__;
      if(!c)return {canvas:false,error:s.error};
      const result={canvas:true,renderedFrames:s.frames,fps:s.fps,error:s.error,colors:pixels.colors,
        brightness:pixels.brightness,colorVar:pixels.colorVar,
        nonBlack:pixels.nonBlack,
        scene:s.scene,fauna:s.fauna,bird:s.bird,asset:s.asset,weather:s.weather,renderScale:s.renderScale,birdDrawCallsSaved:s.birdDrawCallsSaved,motion:s.motion,groundDetail:s.groundDetail,
        treeDetail:s.treeDetail,faunaLOD:s.faunaLOD,regionalBirds:s.regionalBirds,riverLife:s.riverLife,performance:s.performance,adaptiveQuality:s.adaptiveQuality,riverGeometry:s.riverGeometry,
        forestVisibility:s.forestVisibility,performanceTarget:s.performanceTarget,
         wildlifePopulation:s.wildlifePopulation,wildlifeVisibility:s.wildlifeVisibility,
         marinePopulation:s.marinePopulation,
        world:s.world,worldQuery:s.worldQuery,physics:s.physics,cameraShot:s.cameraShot,cameraDirector:s.camera,framing:s.framing,habitatUse:s.habitatUse,floating:s.floating,
        camera:!!document.querySelector('#viewport canvas'),
        metrics:{energy:document.querySelector('#bird-energy')?.value,
          hunger:document.querySelector('#bird-hunger')?.value,
          mood:document.querySelector('#bird-mood')?.textContent,
          mapVisible:getComputedStyle(document.querySelector('#mini-map')).display!=='none',
          mapExpected:!document.body.classList.contains('tv-mode')&&!document.body.classList.contains('no-ui')},
        particles:s.motion?.motes,
        species:document.querySelectorAll('[data-bird]').length};
      return result;
    });
    assert.equal(stats.canvas,true,'Canvas ausente');
    assert.equal(stats.error,null,'Excepción del motor');
    assert.equal(stats.species,12,'Selector incompleto');
    assert.equal(stats.physics?.state,'active','VE-04: Rapier WASM is not active in WebGL');
    assert.ok(stats.physics.ticks>0,'VE-04: Rapier not stepped by fixed clock');
    assert.ok(stats.physics.activeBodies>=0&&stats.physics.activeBodies<=(width<720?4:8),
      'VE-04: nearby body cap violated');
    assert.ok(stats.metrics?.energy>=0&&stats.metrics?.energy<=1,
      'Energy indicator not initialized');
    assert.ok(stats.metrics?.hunger>=0&&stats.metrics?.hunger<=1,
      'Satiety indicator not initialized');
    assert.ok(stats.metrics?.mood,'Missing bird state indicator');
    assert.equal(stats.metrics?.mapVisible,stats.metrics?.mapExpected,
      'Minimap should be visible in standard UI, hidden for clean TV/broadcast');
    assert.equal(stats.particles,0,'Useless airborne point particles have returned');
    // Mobile intentionally scales the number of pooled instances down, but
    // keeps the extended geometric detail radius and a smooth fade.
    assert.ok(stats.treeDetail?.capacity>=(width<720?140:230),
      'El LOD arbóreo no respeta el presupuesto de su dispositivo');
    assert.ok(stats.treeDetail?.fadeDistance>0,
      'Falta transición continua de las copas');
    assert.equal(await page.locator('#new-island').count(),1,
      'Falta control para generar otra isla a voluntad');
    assert.ok(stats.fauna?.dolphins>=4,'Falta fauna marina');
    assert.ok(stats.birdDrawCallsSaved>=40,'El plumaje cercano no está agrupado por materiales');
    assert.ok(stats.fauna?.deer>=10,'La población terrestre sigue siendo muy baja');
    assert.ok(stats.regionalBirds?.population>=30,
      'Las aves secundarias no aparecen en los hábitats cercanos');
    assert.ok(stats.regionalBirds?.visible>=3,
      'La escena inicial carece de aves secundarias visibles');
    assert.equal(stats.regionalBirds?.drawCalls,3,
      'Los bandos secundarios han perdido el render instanciado');
    assert.ok(stats.riverLife?.rocks>=100&&stats.riverLife?.reeds>=100,
      'Las riberas no muestran rocas y vegetación');
    assert.ok(stats.riverLife?.fish>=18,
      'El río no dispone de peces simulados');
    assert.ok(stats.wildlifePopulation?.cellUpdates>=1,'El gestor de poblaciones no recorre celdas');
    assert.ok(stats.wildlifePopulation?.nearby>=0,'Falta la población próxima');
    assert.ok(stats.wildlifePopulation?.cachedCells<=256,'Cache de fauna crece sin límite');
    assert.ok(stats.marinePopulation?.dolphinsLocal>=0,'No se observa población marina');
    assert.ok(stats.marinePopulation?.gullsLocal>=0,'No se rastrean gaviotas regionales');
    assert.ok(stats.wildlifeVisibility?.inFrustum>=0,'No se mide proyección de animales');
    assert.ok(stats.wildlifeVisibility?.recognizableProjected<=stats.wildlifeVisibility?.inFrustum,
      'Reconocibles no pueden superar sujetos dentro del frustum');
    assert.ok(stats.faunaLOD?.prototypes>=3,'Falta la reutilización del LOD de fauna');
    assert.ok(stats.faunaLOD?.totalActors>=15,'Faltan animales con niveles de detalle');
    assert.ok(Object.values(stats.faunaLOD.farDrawCalls).every(n=>n>0&&n<=3),
      'Los modelos simplificados de fauna superan el presupuesto de draw calls');
    assert.ok(stats.renderedFrames>6,'No hay animación');
    assert.ok(stats.treeDetail?.capacity>=12,'La capa de LOD arbóreo no está integrada');
    assert.equal(stats.world?.extent,12000,'Se ha perdido la nueva isla tropical');
    assert.deepEqual(stats.worldQuery?.sources,['terrain','riverbed','river-water'],
      'BVH should index only immutable ground and river geometry');
    assert.ok(stats.worldQuery?.bvhBytes>0&&stats.worldQuery?.queries>0,
      'WorldQuery must be used by fauna and camera, not only instantiated');
    assert.equal(stats.world?.riverChannels,3,'No se han generado tres ríos');
    assert.equal(stats.world?.coastSeed,stats.world.seed,
      'Océano y relieve usan semillas diferentes: arrecifes y espuma no coincidirían con la costa');
    assert.ok(stats.world?.coastResolution>=256,'Costa oceánica excesivamente poco detallada');
    assert.ok(stats.world.riverSegments>130,'Los cauces son demasiado cortos');
    assert.ok(stats.riverGeometry?.waterVertices>1200,
      'El agua ha vuelto a ser una cinta sin secciones transversales');
    assert.ok(stats.riverGeometry?.bankVertices>2200,
      'No hay lecho y orillas modelados a lo largo del río');
    assert.equal(stats.riverGeometry?.drawCalls,2,
      'El cauce supera el presupuesto de draw calls');
    assert.ok(['chase','shoulder','scenic','profile','high-reveal','close'].includes(stats.cameraShot),
      'Cámara cinematográfica sin director activo');
    assert.ok(Number.isInteger(stats.cameraDirector?.transitions),
      'Falta telemetría del director de cámara');
    assert.ok(Number.isFinite(stats.cameraDirector.altitudeAGL),
      'El director desconoce la altura sobre el suelo');
    assert.ok(Number.isFinite(stats.cameraDirector.turnSpeed)&&stats.cameraDirector.turnSpeed<=.761,
      'La cámara supera el límite de giro cinematográfico');
    assert.equal(typeof stats.floating,'boolean',
      'Falta estado de flotación de aves acuáticas');
    assert.equal(stats.habitatUse?.species,stats.bird,
      'La telemetría ecológica debe corresponder al ave visible');
    assert.ok(stats.habitatUse.samples>=1,'El muestreo ecológico no funciona');
    assert.ok(Number.isInteger(stats.performance?.samples),'No se inicializó la telemetría de fotogramas');
    assert.ok(Number.isFinite(stats.adaptiveQuality?.scale),'La resolución adaptativa no se inicializó');
    assert.ok(stats.adaptiveQuality.scale>=stats.adaptiveQuality.minScale,
      'Resolución adaptativa por debajo de su presupuesto');
    assert.ok(stats.adaptiveQuality.scale<=stats.adaptiveQuality.maxScale,
      'Resolución adaptativa sobrepasa el límite del dispositivo');
    assert.equal(stats.performanceTarget?.fps,30,
      'No hay objetivo explícito de 30 FPS');
    assert.ok(stats.forestVisibility?.visible>10,
      'El bosque optimizado ha desaparecido del plano');
    assert.ok(stats.forestVisibility?.visible<stats.forestVisibility?.total,
      'Se siguen enviando todos los árboles a la GPU aunque no sean visibles');
    assert.equal(stats.forestVisibility?.drawCalls,8,
      'El streaming de copas multiplicó las llamadas de dibujo');
    if(name==='05-mobile-selector'){
      assert.ok(stats.framing&&Math.abs(stats.framing.y)<.95&&Math.abs(stats.framing.x)<.95,
        'Subject fell outside mobile portrait framing: '+JSON.stringify(stats.framing));
      assert.ok(stats.framing.fov>=65&&stats.framing.fov<=81,
        'Portrait lens did not adapt to narrow screen: '+JSON.stringify(stats.framing));
    }
    // A clean, bright sky during the location-consent flow is naturally
    // low-entropy. Keep strict checks on scenic shots and reject black frames
    // separately using brightness, not an arbitrary number of sky colors.
    const minColors=name==='07-location-opt-in'?16:
      name.includes('night')||name.includes('storm')?12:25;
    assert.ok(stats.colors>minColors,`Fallo visual: ${name}, colores=${stats.colors}, brillo=${stats.brightness}, plano=${stats.cameraShot}, framing=${JSON.stringify(stats.framing)}`);
    assert.ok(stats.brightness>8,'Escena demasiado oscura o no renderizada');
    if(runChecks)await runChecks(page,stats);
    await page.screenshot({path:directory+'/'+name+'.png',animations:'disabled',fullPage:true});
    report.scenarios.push({name,success:true,stats});
    if(name==='01-day-kestrel'){
      const lifecycle=await page.evaluate(()=>{
        const runtime=window.__FLYINGFREE_RUNTIME__;
        const before=runtime.snapshot();
        const duplicateStart=runtime.start();
        runtime.dispose();
        return {before,duplicateStart,after:runtime.snapshot(),
          canvasPresent:!!document.querySelector('#viewport canvas')};
      });
      assert.equal(lifecycle.before.running,true,'Runtime animation did not start');
      assert.equal(lifecycle.before.starts,1,'Multiple animation loops detected');
      assert.equal(lifecycle.duplicateStart,false,'Second start must be idempotent');
      assert.equal(lifecycle.after.running,false,'Runtime still animates after dispose');
      assert.equal(lifecycle.after.disposed,true,'Runtime did not transition to disposed');
      assert.equal(lifecycle.after.events,0,'DOM handlers leaked after dispose');
      assert.equal(lifecycle.canvasPresent,false,'Canvas WebGL not released');
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_RUNTIME__.snapshot().frames),
        lifecycle.after.frames,'Frames increased after dispose');
    }
    await page.close();
  }catch(error){
    report.scenarios.push({name,success:false,error:String(error)});
    // Preserve raw WebGL pixels without the welcome overlay obscuring the
    // scene. This distinguishes a genuine render occlusion from UI tint.
    try{
      const raw=await page.evaluate(()=>document.querySelector('#viewport canvas')?.toDataURL('image/png'));
      if(raw?.startsWith('data:image/png;base64,'))
        await fs.writeFile(directory+'/'+name+'-CANVAS.png',Buffer.from(raw.split(',')[1],'base64'));
    }catch{}
    try{await page.screenshot({path:directory+'/'+name+'-ERROR.png'})}catch{}
    await page.close();
    throw error;
  }
}
try{
  await waitServer();
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required'
  ]});
  await render('01-day-kestrel','?h=12.5&bird=kestrel&weather=clear&broadcast=1&selftest=1&seed=1988',1440,900,
    async(page)=>{
      await page.waitForFunction(()=>!!window.__FLYINGFREE_STATUS__.selftest,{timeout:10000});
      const diagnostics=await page.evaluate(()=>window.__FLYINGFREE_STATUS__.selftest);
       const replayCheck=await page.evaluate(()=>{
         const runtime=window.__FLYINGFREE_RUNTIME__;
         const before=runtime.simulationSnapshot();
         runtime.pause();
         return {before,paused:runtime.snapshot().simulation.paused};
       });
       assert.equal(replayCheck.paused,true,'Simulation pause not available');
       await page.waitForTimeout(250);
       const paused=await page.evaluate(()=>window.__FLYINGFREE_RUNTIME__.simulationSnapshot());
       assert.deepEqual(paused,replayCheck.before,'Paused ecology changed');
       await page.evaluate(()=>window.__FLYINGFREE_RUNTIME__.resume());
       await page.waitForFunction(t=>window.__FLYINGFREE_RUNTIME__.simulationSnapshot().tick>t,replayCheck.before.tick,{timeout:8000});
       await page.keyboard.press('k');
       assert.equal(await page.evaluate(()=>window.__FLYINGFREE_RUNTIME__.snapshot().simulation.paused),true);
       await page.keyboard.press('k');
       assert.equal(await page.evaluate(()=>window.__FLYINGFREE_RUNTIME__.snapshot().simulation.paused),false);
      assert.equal(diagnostics.success,true,'Diagnósticos de WebGL / fauna');
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.motion?.windMaterials>=7,null,{timeout:15000});
      const motion=await page.evaluate(()=>window.__FLYINGFREE_STATUS__.motion);
      assert.ok(motion.articulatedAnimals>=15,'Falta animación de fauna');
      assert.ok(motion.clouds>=15,'Cielo sin capas de nubes');
      assert.ok(motion.wind>0,'Viento sin inicializar');
      assert.equal(await page.locator('#help .roadmap-link').count(),1,
        'El roadmap no es accesible desde la ayuda');
      const atlas=await page.request.get(root+'roadmap/');
      assert.equal(atlas.status(),200,'Roadmap no se publica con Vite');
      assert.match(await atlas.text(),/Atlas de una visión/,
        'No se ha incorporado el HTML estratégico');
      const meta=await page.request.get(root+'build-info.json');
      assert.equal(meta.status(),200,'Falta manifiesto de versión desplegable');
      const build=await meta.json();
      assert.equal(build.application,'VUELO');
      assert.ok(Number.isFinite(Date.parse(build.buildTime)),'Fecha de build inválida');
      if(process.env.GITHUB_SHA)
        assert.match(build.revision,/^[a-f0-9]{40}$/,'Build sin commit verificable');
      await page.keyboard.press('4');
      await page.waitForTimeout(1200);
      assert.ok((await page.locator('#clock').textContent()).startsWith('23:'),'La tecla de noche no actualiza el reloj');
      await page.keyboard.press('5');
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('#weather-name').innerText(),'Soleado','Cambio de clima');
    });
  await render('02-sunset-vulture','?phase=sunset&bird=vulture&weather=cloudy&broadcast=1&seed=1988',1440,900);
  await render('03-night-owl','?h=23&bird=owl&weather=clear&broadcast=1&seed=1988',1440,900);
  await render('04-storm-albatross','?h=14&bird=albatross&weather=storm&broadcast=1&seed=1988',1440,900);
  await render('05-mobile-selector','?h=8&bird=hummingbird&weather=fog&seed=1988',390,844,
    async(page)=>{
      assert.match(await page.locator('#enter-btn').innerText(),/ENTRAR CON CLIMA LOCAL/);
      assert.equal(await page.locator('#skip-location-btn').isVisible(),true);
      // Explicitly granting the browser permission must not override opt-out.
      await page.context().grantPermissions(['geolocation']);
      await page.context().setGeolocation({latitude:40.42837,longitude:-3.71252});
      let unwantedWeatherCalls=0;
      await page.route('https://api.open-meteo.com/v1/forecast*',async(route)=>{
        unwantedWeatherCalls++;await route.abort();
      });
      await page.locator('#skip-location-btn').click();
      assert.equal(await page.locator('#intro').evaluate(e=>e.classList.contains('off')),true);
      await page.waitForTimeout(450);
      assert.equal(unwantedWeatherCalls,0,'Continuar sin ubicación hizo una consulta meteorológica');
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__?.climate?.live),false);
      await page.waitForFunction(()=>document.querySelector('#audio-btn').classList.contains('active'),null,{timeout:8000});
      assert.equal(await page.locator('#tv-audio').getAttribute('aria-pressed'),'true');
      await page.keyboard.press('m');
      await page.waitForFunction(()=>!document.querySelector('#audio-btn').classList.contains('active'));
      assert.equal(await page.locator('#tv-audio').getAttribute('aria-pressed'),'false');
      await page.keyboard.press('m');
      await page.waitForFunction(()=>document.querySelector('#audio-btn').classList.contains('active'));
      await page.locator('#bird-btn').click();
      assert.equal(await page.locator('#bird-picker').evaluate(e=>e.classList.contains('hidden')),false,'El selector no abre');
      const originalPosition=await page.evaluate(()=>({...window.__FLYINGFREE_STATUS__.birdPosition}));
      await page.locator('[data-bird="owl"]').click();
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__.bird),'owl','No cambia el ave');
      const selected=await page.evaluate(()=>window.__FLYINGFREE_STATUS__.birdPosition);
      assert.ok(Math.hypot(selected.x-originalPosition.x,selected.z-originalPosition.z)>80,
        'Changing bird must relocate to species-specific habitat');
      await page.locator('#map-btn').click();
      assert.equal(await page.locator('#mini-map').isVisible(),false,'Minimap does not hide');
      await page.locator('#map-btn').click();
      assert.equal(await page.locator('#mini-map').isVisible(),true,'Minimap cannot be restored');
      await page.locator('#hud-btn').click();
      assert.equal(await page.locator('#hud').isVisible(),false,'Bird indicators cannot hide');
      await page.locator('#hud-btn').click();
      await page.locator('#bird-btn').click();
      assert.equal(await page.locator('#bird-picker').evaluate(e=>e.classList.contains('hidden')),false);
    });
  await render('06-tv-live-weather','?tv=1&bird=kestrel&seed=1988',1440,900,
    async(page)=>{
      assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('tv-mode')),true);
      assert.equal(await page.locator('#tv-overlay').isVisible(),true);
      await page.context().grantPermissions(['geolocation']);
      await page.context().setGeolocation({latitude:40.42837,longitude:-3.71252});
      let weatherRequests=0;
      await page.route('https://api.open-meteo.com/v1/forecast*',async(route)=>{
        weatherRequests++;
        const u=new URL(route.request().url());
        assert.equal(u.searchParams.get('latitude'),'40.4');
        assert.equal(u.searchParams.get('longitude'),'-3.7');
        await route.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({current:{temperature_2m:weatherRequests===1?14.3:19.1,apparent_temperature:11.5,weather_code:61,cloud_cover:91,precipitation:1.0,relative_humidity_2m:78,wind_speed_10m:27}})});
      });
      await page.locator('#tv-consent').click();
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.climate?.live===true,{timeout:20000});
      assert.equal(await page.locator('#tv-temp').innerText(),'14 °C');
      assert.match(await page.locator('#tv-weather').innerText(),/LLUVIA/i);
      assert.equal(await page.locator('#tv-attribution').isVisible(),true);
      // Advance wall-clock time without waiting 30 real minutes. The renderer
      // must fetch a fresh observation and update the TV temperature.
      await page.evaluate(()=>{
        const originalNow=Date.now.bind(Date);
        Date.now=()=>originalNow()+31*60*1000;
      });
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.climate?.temperature===19,{timeout:12000});
      assert.equal(weatherRequests,2,'El clima no se actualiza tras caducar la caché');
      assert.equal(await page.locator('#tv-temp').innerText(),'19 °C');
      const body=await page.locator('body').innerText();
      assert.equal(body.includes('40.4'),false,'coordinates leaked into visible UI');
      assert.equal(body.includes('-3.7'),false,'longitude leaked into visible UI');
      assert.equal(body.includes('37° N'),false,'fixed region leaked into visible UI');
      await page.keyboard.press('t');
      assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('tv-mode')),false);
      await page.keyboard.press('t');
      assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('tv-mode')),true);
    });
  await render('07-location-opt-in','?bird=eagle',1280,800,
    async(page)=>{
      await page.context().grantPermissions(['geolocation']);
      await page.context().setGeolocation({latitude:40.42837,longitude:-3.71252});
      let requests=0;
      await page.route('https://api.open-meteo.com/v1/forecast*',async(route)=>{
        requests++;
        await route.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({current:{temperature_2m:16.4,weather_code:2,cloud_cover:48,wind_speed_10m:14}})});
      });
      await page.locator('#enter-btn').click();
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.climate?.live===true,{timeout:20000});
      assert.equal(await page.locator('#temperature').innerText(),'16 °C');
      assert.ok(requests>=1,'Al entrar no se solicitó la ubicación ni el clima real');
      assert.equal(await page.locator('#intro').evaluate(e=>e.classList.contains('off')),true);
    });
  // The reference bird is a *real GLB skin*, not a replacement procedural cube.
  // Multiple camera shots preserve visual evidence at different distances.
  for(const [name,mode,seed] of [
    ['08-kingfisher-close','close',1988],
    ['09-kingfisher-profile','profile',12345],
    ['10-kingfisher-scenic','high-reveal',20261106]
  ]){
    await render(name,'?h=12.5&bird=kingfisher&weather=clear&broadcast=1&selftest=1&seed='+seed+'&qaShot='+mode,
      1365,768,async page=>{
        await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='ready',
          null,{timeout:30000});
        const asset=await page.evaluate(()=>window.__FLYINGFREE_STATUS__.asset);
        assert.equal(asset.species,'kingfisher');
        assert.equal(asset.near.bones>=10,true,'Exported GLB must include anatomical skeleton');
        assert.ok(asset.near.triangles>asset.far.triangles*1.7);
      });
  }
  // Fail a real HTTP fetch. Renderer must keep original procedural bird active.
  await render('11-kingfisher-missing-glb',
    '?bird=kingfisher&seed=1988&h=12.5&weather=clear&broadcast=1',
    1280,800,async page=>{
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='fallback',
        null,{timeout:25000});
      assert.match(await page.evaluate(()=>window.__FLYINGFREE_STATUS__.asset.reason),/404|Failed|fetch/i);
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__.birdDrawCallsSaved>=40),true);
    },
    async page=>{
      await page.route('**/assets/birds/kingfisher-lod0.glb*',
        route=>route.fulfill({status:404,contentType:'text/plain',body:'not found'}));
    });
  await render('12-kingfisher-procedural-optout',
    '?bird=kingfisher&assets=procedural&seed=1988&broadcast=1',
    1280,800,async page=>{
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__.asset.state),'procedural');
    });
  // Same seed, weather and composition as 08 for procedural-versus-GLB
  // comparison; captures remain available as an Actions artifact.
  await render('14-kingfisher-before-procedural-close',
    '?h=12.5&bird=kingfisher&weather=clear&broadcast=1&selftest=1&seed=1988&qaShot=close&assets=procedural',
    1365,768,async page=>{
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__?.asset?.state),'procedural');
    });
  await render('13-kingfisher-species-swap',
    '?bird=kingfisher&seed=1988&h=12.5&weather=clear',
    1280,800,async page=>{
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='ready',
        null,{timeout:30000});
      await page.locator('#skip-location-btn').click();
      await page.locator('#bird-btn').click();
      await page.locator('[data-bird="owl"]').click();
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='procedural'
        &&window.__FLYINGFREE_STATUS__?.bird==='owl');
      await page.locator('#bird-btn').click();
      await page.locator('[data-bird="kingfisher"]').click();
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.asset?.state==='ready'
        &&window.__FLYINGFREE_STATUS__?.bird==='kingfisher',null,{timeout:30000});
      const state=await page.evaluate(()=>window.__FLYINGFREE_STATUS__.asset);
      assert.equal(state.cache.cached,2,'Only two GLB levels may be cached');
      assert.equal(state.cache.active,2,'Two current skins must be retained');
      await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.performance?.gpuGeometries>0);
      const before=await page.evaluate(()=>({
        worldSeed:window.__FLYINGFREE_STATUS__.world.seed,
        geometries:window.__FLYINGFREE_STATUS__.performance.gpuGeometries,
        textures:window.__FLYINGFREE_STATUS__.performance.gpuTextures
      }));
      // New-island is a full Vite app restart, not a partially reset BVH;
      // the old WebGL context must not be retained as a hidden world.
      await page.evaluate(()=>document.getElementById('new-island').click());
      await page.waitForFunction(previous=>window.__FLYINGFREE_STATUS__?.world?.seed!==previous
        &&window.__FLYINGFREE_STATUS__?.frames>6
        &&window.__FLYINGFREE_STATUS__?.asset?.state==='ready',
        before.worldSeed,{timeout:90000});
      const after=await page.evaluate(()=>({
        worldSeed:window.__FLYINGFREE_STATUS__.world.seed,
        geometries:window.__FLYINGFREE_STATUS__.performance.gpuGeometries,
        textures:window.__FLYINGFREE_STATUS__.performance.gpuTextures
      }));
      assert.notEqual(after.worldSeed,before.worldSeed,'Island seed must change');
      assert.ok(after.geometries>0&&after.geometries<=before.geometries+60,
        'Recreating the world must not accumulate uncontrolled GPU geometry: '+JSON.stringify({before,after}));
      assert.ok(after.textures<=before.textures+8,
        'Recreating the world must not accumulate GPU textures: '+JSON.stringify({before,after}));
    });
  // Dedicated orthographic inspections. The documentary camera intentionally
  // keeps a 26 cm bird small compared with a 20 m tree; these shots are needed
  // to ACCEPT anatomical contours and the actual distant LOD.
  for(const level of [0,1]){
    for(const angle of ['front','side','top','threeQuarter','back']){
      const name='VE05-'+(level?'LOD1':'LOD0')+'-'+angle;
      const page=await browser.newPage({viewport:{width:960,height:750},deviceScaleFactor:1});
      page.on('pageerror',error=>report.errors.push(name+': '+error.message));
      try{
        const response=await page.goto(root+'asset-preview.html?view='+angle+'&lod='+level,
          {waitUntil:'domcontentloaded',timeout:20000});
        assert.equal(response?.status(),200,'Asset inspection document missing');
        await page.waitForFunction(()=>window.__VE05_PREVIEW__?.ready||
          window.__VE05_PREVIEW__?.error,null,{timeout:30000});
        const metrics=await page.evaluate(()=>window.__VE05_PREVIEW__);
        assert.equal(metrics.error,null,name+' GLB failed: '+metrics.error);
        assert.equal(metrics.bones,12,name+' imported anatomical skeleton');
        assert.ok(metrics.sizeMetres.x>.24&&metrics.sizeMetres.x<.29,
          name+' physical wingspan '+metrics.sizeMetres.x);
        assert.ok(metrics.drawCalls>3&&metrics.drawCalls<65,name+' draw call budget');
        assert.ok(metrics.renderedTriangles>100,'Real GLB must render triangles');
        await page.screenshot({path:directory+'/'+name+'.png',animations:'disabled'});
        report.scenarios.push({name,success:true,stats:metrics});
      }finally{await page.close();}
    }
  }
  assert.deepEqual(report.errors,[],'Errores JavaScript o WebGL en consola');
  report.result='pass';
}catch(e){report.failure=e.stack||String(e);report.result='fail';console.error(e);}
finally{
  report.completedAt=new Date().toISOString();
  await fs.writeFile(directory+'/report.json',JSON.stringify(report,null,2));
  if(browser)await browser.close();
  server.kill('SIGTERM');
  console.log(JSON.stringify(report,null,2));
}
if(report.result!=='pass')process.exitCode=1;
