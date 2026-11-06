import { random, clamp } from './core.js';
import {createCoastHeightData,COAST_HEIGHT_MIN,COAST_HEIGHT_MAX} from './coastalBathymetry.js';
import {TROPICAL_WORLD} from './tropicalTerrain.js';

export function createSky(THREE,scene) {
  const uniforms={
    sunDirection:{value:new THREE.Vector3(0,1,0)},
    day:{value:1},golden:{value:.2},cloud:{value:0},night:{value:0}
  };
  const mat=new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:`
      varying vec3 vRay;
      void main(){
        vRay=normalize(position);
        vec4 view=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      uniform vec3 sunDirection;
      uniform float day,golden,cloud,night;
      varying vec3 vRay;
      void main(){
        float y=clamp(vRay.y,-1.0,1.0);
        float zenith=smoothstep(-.12,.90,y);
        vec3 nightZenith=vec3(.025,.057,.095);
        vec3 nightHorizon=vec3(.068,.111,.155);
        vec3 dayZenith=vec3(.17,.37,.57);
        vec3 dayHorizon=vec3(.64,.76,.73);
        vec3 c=mix(mix(nightHorizon,nightZenith,zenith),
                   mix(dayHorizon,dayZenith,zenith),day);
        float towardSun=max(dot(normalize(vRay),normalize(sunDirection)),0.0);
        float atmospheric=pow(towardSun,12.0)*pow(1.0-abs(y),1.6);
        c=mix(c,vec3(1.0,.49,.23),atmospheric*golden*.86);
        float sunsetBand=exp(-pow((y-.06)*6.2,2.0));
        c=mix(c,vec3(.90,.45,.28),sunsetBand*golden*.53*(1.0-cloud*.45));
        c+=vec3(.93,.66,.39)*pow(towardSun,280.0)*day*.28;
        float moonFacing=max(dot(normalize(vRay),-normalize(sunDirection)),0.0);
        float moonGlow=pow(moonFacing,5.0)*(1.0-day)*(1.0-cloud*.65);
        c+=vec3(.10,.16,.24)*moonGlow;
        float horizonLight=exp(-pow((y-.11)*5.5,2.0))*
          pow(max(dot(normalize(vRay.xz),normalize(sunDirection.xz)),0.0),3.0);
        c+=vec3(.68,.31,.16)*horizonLight*golden*.28;
        c=mix(c,vec3(.15,.21,.26),cloud*.32);
        gl_FragColor=vec4(c,1.0);
      }`
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(8000,32,20),mat);
  mesh.renderOrder=-1000;scene.add(mesh);
  return {mesh,uniforms,update(camera,sun,weather){
    mesh.position.copy(camera.position);
    uniforms.sunDirection.value.set(Math.sin(sun.azimuth)*Math.cos(sun.altitude),Math.sin(sun.altitude),-Math.cos(sun.azimuth)*Math.cos(sun.altitude));
    uniforms.day.value=sun.daylight;
    uniforms.golden.value=sun.golden;
    uniforms.cloud.value=weather.cloud;
    uniforms.night.value=sun.night?1:0;
  }};
}

export function createOcean(THREE,scene,seed=1988){
  const heightmap=createCoastHeightData(seed);
  const coastTexture=new THREE.DataTexture(heightmap.data,heightmap.size,heightmap.size,
    THREE.RGBAFormat,THREE.UnsignedByteType);
  coastTexture.magFilter=THREE.LinearFilter;
  coastTexture.minFilter=THREE.LinearFilter;
  coastTexture.wrapS=THREE.ClampToEdgeWrapping;
  coastTexture.wrapT=THREE.ClampToEdgeWrapping;
  coastTexture.generateMipmaps=false;
  coastTexture.needsUpdate=true;
  const uniforms={
    coastHeightmap:{value:coastTexture},
    coastExtent:{value:TROPICAL_WORLD.extent},
    coastHeightRange:{value:new THREE.Vector2(COAST_HEIGHT_MIN,COAST_HEIGHT_MAX)},
    coastSeaLevel:{value:TROPICAL_WORLD.seaLevel},
    time:{value:0},day:{value:1},storm:{value:0},
    sunlight:{value:new THREE.Vector3(0,1,0)},
    skyColor:{value:new THREE.Color('#8ac1c4')},
    fogDensity:{value:.0001}
  };
  const material=new THREE.ShaderMaterial({
    uniforms,side:THREE.DoubleSide,fog:false,depthWrite:true,
    vertexShader:`
      uniform float time,storm;
      varying vec3 vPosition,vNormal;
      varying float vWave;
      float h(vec2 p){
        return sin(p.x*.011+time*.61)*2.0
         +sin(p.y*.008-time*.50)*1.8
         +sin((p.x+p.y)*.019+time*1.07)*(1.1+storm*1.0)
         +sin(p.x*.027-p.y*.016+time*.81)*.45;
      }
      void main(){
        vec3 p=position;
        float wave=h(p.xz);
        p.y+=wave;
        float dx=(h(p.xz+vec2(2.0,0.0))-wave)/2.0;
        float dz=(h(p.xz+vec2(0.0,2.0))-wave)/2.0;
        vNormal=normalize(mat3(modelMatrix)*vec3(-dx,1.0,-dz));
        vec4 wp=modelMatrix*vec4(p,1.0);
        vPosition=wp.xyz;
        vWave=wave;
        gl_Position=projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader:`
      uniform float day,storm,fogDensity,time;
      uniform float coastExtent,coastSeaLevel;
      uniform vec2 coastHeightRange;
      uniform sampler2D coastHeightmap;
      uniform vec3 sunlight,skyColor;
      varying vec3 vPosition,vNormal;
      varying float vWave;
      void main(){
        vec3 V=normalize(cameraPosition-vPosition);
        vec3 L=normalize(sunlight);
        float r1=sin(vPosition.x*.11+time*1.9)*cos(vPosition.z*.13-time*1.32);
        float r2=sin((vPosition.x+vPosition.z)*.19+time*2.21);
        float microFade=1.0-smoothstep(430.0,3200.0,length(cameraPosition-vPosition));
        vec3 N=normalize(vNormal+vec3(r1*.07,0.0,r2*.05)*microFade);
        float diffuse=max(dot(N,L),0.0);
        float fresnel=pow(1.0-max(dot(V,N),0.0),3.0);
        float sparkle=pow(max(dot(reflect(-L,N),V),0.0),90.0)*day;
        float sunTrail=pow(max(dot(normalize(V.xz),normalize(L.xz)),0.0),20.0)
          *pow(1.0-abs(N.y-.94),2.0)*day;
        float coarse=sin(vPosition.x*.017+time*.7)*cos(vPosition.z*.019-time*.52)*.5+.5;
        // A heightmap built from exactly the same world seed as collision
        // heights and vegetation. No fake radial island shoreline approximation.
        vec2 coastUv=clamp(vPosition.xz/coastExtent+vec2(.5),vec2(0.001),vec2(.999));
        float terrainHeight=mix(coastHeightRange.x,coastHeightRange.y,
          texture2D(coastHeightmap,coastUv).r);
        float depth=coastSeaLevel-terrainHeight;
        float shoal=1.0-smoothstep(7.0,68.0,depth);
        float nearShore=smoothstep(-6.0,1.0,depth)*
          (1.0-smoothstep(2.5,17.0,depth));
        float coralBand=smoothstep(3.0,7.0,depth)*
          (1.0-smoothstep(23.0,55.0,depth));
        vec3 deep=mix(vec3(.014,.045,.094),vec3(.016,.155,.204),day);
        vec3 turquoise=mix(vec3(.044,.135,.16),vec3(.12,.38,.36),day);
        vec3 color=mix(deep,turquoise,shoal*.72);
        // Turquoise lagoons and subdued reef patches, governed by depth,
        // rather than decorative markings over the open ocean.
        float reefNoise=sin(vPosition.x*.064+sin(vPosition.z*.028))*
          cos(vPosition.z*.056-vPosition.x*.019);
        float reefMask=smoothstep(.22,.72,reefNoise)*coralBand;
        color=mix(color,vec3(.035,.18,.17),reefMask*.38*day);
        color+=vec3(.07,.17,.18)*(coarse*.32+diffuse*.25)*day;
        color=mix(color,skyColor,fresnel*.47);
        color+=mix(vec3(.65,.76,.81),vec3(1.0,.78,.46),.65)*
          (sparkle*.84+sunTrail*.11);
        float crest=smoothstep(3.6,5.9,abs(vWave));
        float foam=clamp(nearShore*(.19+.25*coarse)+crest*storm*.23,0.0,.67);
        color=mix(color,vec3(.77,.88,.82),foam);
        float dist=length(cameraPosition-vPosition);
        float fog=1.0-exp(-fogDensity*fogDensity*dist*dist);
        color=mix(color,skyColor,clamp(fog,0.0,.94));
        gl_FragColor=vec4(color,1.0);
      }`
  });
  const g=new THREE.PlaneGeometry(17000,17000,190,190);g.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(g,material);water.position.y=-9;water.renderOrder=1;
  scene.add(water);
  return {mesh:water,uniforms,bathymetry:{seed,resolution:heightmap.size,extent:heightmap.extent},
    dispose(){scene.remove(water);g.dispose();material.dispose();coastTexture.dispose();},
    update(t,sun,weather,fogColor){
    uniforms.time.value=t;
    uniforms.day.value=sun.daylight;
    uniforms.storm.value=weather.rain;
    uniforms.sunlight.value.set(Math.sin(sun.azimuth)*Math.cos(sun.altitude),Math.sin(sun.altitude),-Math.cos(sun.azimuth)*Math.cos(sun.altitude));
    uniforms.skyColor.value.copy(fogColor);
    uniforms.fogDensity.value=.00008+weather.fog*.00032;
  }};
}
export function createPrecipitation(THREE,scene,quality=1){
  const rng=random(2026);
  const count=Math.round(560*quality);
  const data=new Float32Array(count*6),points=[];
  for(let i=0;i<count;i++)points.push({x:(rng()-.5)*750,y:rng()*520,z:(rng()-.5)*700,s:190+rng()*195});
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(data,3).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.LineBasicMaterial({color:0xc7d9d9,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending});
  const mesh=new THREE.LineSegments(geo,mat);mesh.frustumCulled=false;mesh.visible=false;
  mesh.renderOrder=9;scene.add(mesh);
  return {mesh,update(t,dt,camera,rain,wind){
    mesh.visible=rain>.08;
    mat.opacity=.07+rain*.25;
    if(!mesh.visible)return;
    const p=geo.getAttribute('position');
    mesh.position.copy(camera.position);
    for(let i=0;i<count;i++){
      const o=points[i];
      o.y-=dt*o.s*(.7+rain*.5);
      o.x+=dt*wind*.15;
      if(o.y < -190){o.y+=600;o.x=(rng()-.5)*750;o.z=(rng()-.5)*700;}
      const ix=i*2;
      p.setXYZ(ix,o.x,o.y,o.z);
      p.setXYZ(ix+1,o.x+8+wind*.03,o.y-13-rain*13,o.z);
    }
    p.needsUpdate=true;
  }};
}
