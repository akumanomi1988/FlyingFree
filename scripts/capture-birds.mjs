import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {BIRDS} from '../src/core.js';

const options=new Map(process.argv.slice(2).filter(v=>v.startsWith('--')).map(v=>{
  const [key,...rest]=v.slice(2).split('=');
  return [key,rest.join('=')||'true'];
}));
const seed=Number(options.get('seed')||1988);
if(!Number.isInteger(seed)||seed<1||seed>2147483647)throw Error('Invalid seed');
const validModes=new Set(['chase','shoulder','profile','scenic','high-reveal','close']);
const modes=(options.get('modes')||'chase,profile,high-reveal').split(',').filter(Boolean);
if(!modes.length||modes.some(m=>!validModes.has(m)))throw Error('Invalid camera modes');
const selected=options.get('birds')?
  BIRDS.filter(b=>(options.get('birds')||'').split(',').includes(b.id)):BIRDS;
if(!selected.length)throw Error('No valid birds selected');
const root='http://127.0.0.1:4173/FlyingFree/';
const output='artifacts/visual/avian-matrix';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
  '--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
let errors='',browser=null;
for(const stream of [server.stdout,server.stderr])stream.on('data',d=>errors+=String(d));
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const escapeHtml=str=>String(str).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;');
const captures=[];
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch(root)).ok){ready=true;break;}}catch{}
    await sleep(250);
  }
  if(!ready)throw Error('Vite preview unavailable: '+errors);
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'
  ]});
  for(const bird of selected){
    for(const mode of modes){
      const page=await browser.newPage({viewport:{width:1365,height:768},deviceScaleFactor:1});
      const issues=[];
      page.on('pageerror',e=>issues.push(e.message));
      page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
      const file=`${bird.id}-${mode}.png`;
      try{
        const query=new URLSearchParams({
          seed:String(seed),bird:bird.id,h:'12.5',weather:'clear',
          broadcast:'1',selftest:'1',qaShot:mode
        });
        const response=await page.goto(root+'?'+query.toString(),{
          waitUntil:'domcontentloaded',timeout:45000
        });
        if(!response?.ok())throw Error('HTTP '+response?.status());
        await page.waitForFunction(expected=>{
          const s=window.__FLYINGFREE_STATUS__;
          return s?.frames>10&&s?.cameraShot===expected&&!s.error;
        },mode,{timeout:65000});
        await page.waitForTimeout(400);
        const state=await page.evaluate(()=>{
          const s=window.__FLYINGFREE_STATUS__;
          return {bird:s.bird,behaviour:s.behaviour,camera:s.camera,world:s.world,
            habitatUse:s.habitatUse,performance:s.performance};
        });
        if(issues.length)throw Error(issues.join(' ; '));
        await page.screenshot({path:output+'/'+file,animations:'disabled'});
        captures.push({bird:bird.id,mode,ok:true,file,state});
        console.log('CAPTURE',bird.id,mode);
      }catch(err){
        captures.push({bird:bird.id,mode,ok:false,error:String(err)});
        console.error('FAILED',bird.id,mode,err);
      }finally{await page.close();}
    }
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
const passed=captures.filter(c=>c.ok).length;
const report={seed,builtAt:new Date().toISOString(),view:'1365×768',
  method:'deterministic QA-only camera angles; visually review screenshots',
  successes:passed,total:captures.length,captures};
await writeFile(output+'/report.json',JSON.stringify(report,null,2));
const cards=captures.map(c=>c.ok?
  `<figure><a href="./${escapeHtml(c.file)}"><img loading="lazy" src="./${escapeHtml(c.file)}" alt="${escapeHtml(c.bird)} / ${escapeHtml(c.mode)}"></a><figcaption>${escapeHtml(c.bird)} · ${escapeHtml(c.mode)}</figcaption></figure>`:
  `<figure class="error">${escapeHtml(c.bird)} · ${escapeHtml(c.mode)}<p>${escapeHtml(c.error)}</p></figure>`).join('\n');
const page=`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VUELO · Matriz visual de aves</title><style>
body{margin:0;background:#091a1e;color:#e9f4ee;font:14px system-ui,sans-serif}
header{padding:35px 4vw;border-bottom:1px solid #294039}h1{font-size:30px}
p{color:#aec7bb}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:13px;padding:4vw}
figure{margin:0;background:#14272a;border:1px solid #315044;border-radius:12px;overflow:hidden}
img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
figcaption{padding:12px 15px;font-weight:600}.error{padding:15px;color:#ffb7a1}
a{color:inherit}small{opacity:.7}
</style></head><body><header><h1>VUELO · Contact sheet</h1>
<p>Semilla ${seed} · ${passed}/${captures.length} capturas · Fuente: aplicación WebGL, no imágenes conceptuales.</p>
<small>Revisar silueta de alas, escala, posición de cámara, oclusiones y anatomía de cada especie. Este informe no sustituye aprobación artística.</small>
</header><main>${cards}</main></body></html>`;
await writeFile(output+'/index.html',page);
console.log('VISUAL MATRIX:',passed+'/'+captures.length,'→',output+'/index.html');
if(passed!==captures.length)process.exitCode=1;
