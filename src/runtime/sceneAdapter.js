// GPU presentation adapter. Scene composition is independent of UI wiring.
export function createBrowserScene({THREE,document,parent,width,height,pixelRatio,skyDay}){
  if(!document.createElement('canvas').getContext('webgl2'))
    throw new Error('WebGL2 no disponible. Comprueba la aceleración gráfica en tu navegador.');
  // No preserved full-resolution framebuffer: render probes read back in-frame.
  const renderer=new THREE.WebGLRenderer({
    antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'
  });
  let scene,camera,hemi,sunLight,moonLight,sunHalo,moonHalo,sunOrb,moonOrb;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  parent.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=skyDay.clone();scene.fog=new THREE.FogExp2(skyDay.clone(),.00013);
  camera=new THREE.PerspectiveCamera(55,width/height,.15,12500);
  camera.position.set(250,450,820);
  hemi=new THREE.HemisphereLight(0xd7efff,0x394337,1.7);scene.add(hemi);
  sunLight=new THREE.DirectionalLight('#ffead0',2.5);sunLight.position.set(500,950,-350);scene.add(sunLight);
  moonLight=new THREE.DirectionalLight(0x85b1dd,.65);scene.add(moonLight);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const glowCtx=glowCanvas.getContext('2d');
  const glow=glowCtx.createRadialGradient(64,64,3,64,64,64);
  glow.addColorStop(0,'rgba(255,241,202,0.88)');
  glow.addColorStop(.25,'rgba(255,211,141,0.32)');
  glow.addColorStop(.68,'rgba(255,173,93,0.10)');
  glow.addColorStop(1,'rgba(255,180,98,0)');
  glowCtx.fillStyle=glow;glowCtx.fillRect(0,0,128,128);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,
   blending:THREE.AdditiveBlending,fog:false}));sunHalo.scale.set(860,860,1);scene.add(sunHalo);
  moonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:.18,depthWrite:false,
   blending:THREE.AdditiveBlending,fog:false,color:0x9dbce4}));moonHalo.scale.set(360,360,1);scene.add(moonHalo);
  const sunGeo=new THREE.SphereGeometry(73,16,12);
  sunOrb=new THREE.Mesh(sunGeo,new THREE.MeshBasicMaterial({color:0xffe5b7,fog:false}));scene.add(sunOrb);
  moonOrb=new THREE.Mesh(new THREE.SphereGeometry(42,16,12),new THREE.MeshBasicMaterial({color:0xc1d2df,fog:false}));scene.add(moonOrb);

  return {renderer,scene,camera,hemi,sunLight,moonLight,sunHalo,moonHalo,sunOrb,moonOrb};
}

export function disposeBrowserScene(scene,renderer){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene?.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material]){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  for(const texture of textures)texture.dispose();
  renderer?.dispose();
  renderer?.domElement?.remove();
}
