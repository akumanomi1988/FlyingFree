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
async function render(name,query,width,height,runChecks){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,acceptDownloads:true});
  page.on('pageerror',e=>report.errors.push(name+' pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(name+' console: '+m.text());});
  try{
    const r=await page.goto(root+query,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(r?.status(),200,'Respuesta HTTP');
    await page.waitForFunction(()=>window.__FLYINGFREE_STATUS__?.frames>6,null,{timeout:60000});
    await page.waitForTimeout(1100);
    const stats=await page.evaluate(()=>{
      const c=document.querySelector('#viewport canvas'),s=window.__FLYINGFREE_STATUS__;
      if(!c)return {canvas:false,error:s.error};
      const sample=document.createElement('canvas');sample.width=64;sample.height=36;
      const cx=sample.getContext('2d',{willReadFrequently:true});
      cx.drawImage(c,0,0,64,36);
      const data=cx.getImageData(0,0,64,36).data;
      const distinct=new Set();let luminance=0,variability=0,nonBlack=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        distinct.add([r>>4,g>>4,b>>4].join(':'));
        const l=(r+g+b)/3;luminance+=l;variability+=Math.abs(r-b);
        if(r+g+b>60)nonBlack++;
      }
      return {canvas:true,renderedFrames:s.frames,fps:s.fps,error:s.error,colors:distinct.size,
        brightness:Math.round(luminance/(data.length/4)),colorVar:Math.round(variability/(data.length/4)),
        nonBlack:Math.round(nonBlack/(data.length/4)*100),
        scene:s.scene,fauna:s.fauna,bird:s.bird,weather:s.weather,renderScale:s.renderScale,birdDrawCallsSaved:s.birdDrawCallsSaved,motion:s.motion,groundDetail:s.groundDetail,
        treeDetail:s.treeDetail,faunaLOD:s.faunaLOD,performance:s.performance,adaptiveQuality:s.adaptiveQuality,
        world:s.world,cameraShot:s.cameraShot,cameraDirector:s.camera,habitatUse:s.habitatUse,
        camera:!!document.querySelector('#viewport canvas'),
        species:document.querySelectorAll('[data-bird]').length};
    });
    assert.equal(stats.canvas,true,'Canvas ausente');
    assert.equal(stats.error,null,'Excepción del motor');
    assert.equal(stats.species,12,'Selector incompleto');
    assert.ok(stats.fauna?.dolphins>=4,'Falta fauna marina');
    assert.ok(stats.birdDrawCallsSaved>=40,'El plumaje cercano no está agrupado por materiales');
    assert.ok(stats.fauna?.deer>=4,'Falta fauna de tierra');
    assert.ok(stats.faunaLOD?.prototypes>=3,'Falta la reutilización del LOD de fauna');
    assert.ok(stats.faunaLOD?.totalActors>=15,'Faltan animales con niveles de detalle');
    assert.ok(Object.values(stats.faunaLOD.farDrawCalls).every(n=>n>0&&n<=3),
      'Los modelos simplificados de fauna superan el presupuesto de draw calls');
    assert.ok(stats.renderedFrames>6,'No hay animación');
    assert.ok(stats.treeDetail?.capacity>=12,'La capa de LOD arbóreo no está integrada');
    assert.equal(stats.world?.extent,12000,'Se ha perdido la nueva isla tropical');
    assert.equal(stats.world?.riverChannels,3,'No se han generado tres ríos');
    assert.equal(stats.world?.coastSeed,stats.world.seed,
      'Océano y relieve usan semillas diferentes: arrecifes y espuma no coincidirían con la costa');
    assert.ok(stats.world?.coastResolution>=256,'Costa oceánica excesivamente poco detallada');
    assert.ok(stats.world.riverSegments>130,'Los cauces son demasiado cortos');
    assert.ok(['chase','shoulder','scenic','profile','high-reveal','close'].includes(stats.cameraShot),
      'Cámara cinematográfica sin director activo');
    assert.ok(Number.isInteger(stats.cameraDirector?.transitions),
      'Falta telemetría del director de cámara');
    assert.ok(Number.isFinite(stats.cameraDirector.altitudeAGL),
      'El director desconoce la altura sobre el suelo');
    assert.equal(stats.habitatUse?.species,stats.bird,
      'La telemetría ecológica debe corresponder al ave visible');
    assert.ok(stats.habitatUse.samples>=1,'El muestreo ecológico no funciona');
    assert.ok(Number.isInteger(stats.performance?.samples),'No se inicializó la telemetría de fotogramas');
    assert.ok(Number.isFinite(stats.adaptiveQuality?.scale),'La resolución adaptativa no se inicializó');
    assert.ok(stats.adaptiveQuality.scale>=stats.adaptiveQuality.minScale,
      'Resolución adaptativa por debajo de su presupuesto');
    assert.ok(stats.adaptiveQuality.scale<=stats.adaptiveQuality.maxScale,
      'Resolución adaptativa sobrepasa el límite del dispositivo');
    assert.ok(stats.colors>(name.includes('night')||name.includes('storm')?12:25),`Fallo visual: ${name}, colores=${stats.colors}, brillo=${stats.brightness}, plano=${stats.cameraShot}`);
    assert.ok(stats.brightness>8,'Escena demasiado oscura o no renderizada');
    if(runChecks)await runChecks(page,stats);
    await page.screenshot({path:directory+'/'+name+'.png',animations:'disabled',fullPage:true});
    report.scenarios.push({name,success:true,stats});
    await page.close();
  }catch(error){
    report.scenarios.push({name,success:false,error:String(error)});
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
  await render('02-sunset-vulture','?phase=sunset&bird=vulture&weather=cloudy&broadcast=1',1440,900);
  await render('03-night-owl','?h=23&bird=owl&weather=clear&broadcast=1',1440,900);
  await render('04-storm-albatross','?h=14&bird=albatross&weather=storm&broadcast=1',1440,900);
  await render('05-mobile-selector','?h=8&bird=hummingbird&weather=fog',390,844,
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
      await page.locator('[data-bird="owl"]').click();
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>window.__FLYINGFREE_STATUS__.bird),'owl','No cambia el ave');
      await page.locator('#bird-btn').click();
      assert.equal(await page.locator('#bird-picker').evaluate(e=>e.classList.contains('hidden')),false);
    });
  await render('06-tv-live-weather','?tv=1&bird=kestrel',1440,900,
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
