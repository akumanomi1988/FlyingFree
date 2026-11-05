// Pure deterministic world/time functions: no browser or renderer dependencies.
export const TAU = Math.PI*2;
export const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const lerp = (a,b,t)=>a+(b-a)*t;
export const smooth = (a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x)};
export function random(seed){let state=(seed|0)||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}};
function hash(x,z,seed=1988){let n=Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(seed,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295}
export function noise(x,z,seed=1988){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return lerp(lerp(hash(a,b,seed),hash(a+1,b,seed),u),lerp(hash(a,b+1,seed),hash(a+1,b+1,seed),u),v)*2-1}
export function fbm(x,z,seed=1988){let f=1,a=.5,n=0;for(let i=0;i<5;i++){n+=noise(x*f,z*f,seed)*a;f*=2.06;a*=.5}return n}
export function terrainHeight(x,z,seed=1988){
  const radius=Math.hypot(x/1650,z/1500);
  const outline=1+fbm(x*.0019+7,z*.0019-9,seed)*.15;
  const shore=1-smooth(.67,1.045,radius/outline);
  const ridge=Math.pow(clamp(1-radius/1.09),1.8)*214;
  const hills=67+fbm(x*.0017+4,z*.0017+15,seed)*71+Math.abs(fbm(x*.004,z*.004,seed))*42;
  return -32+Math.max(0,shore)*(ridge+hills);
}
export const BIRDS=[
 {id:'kestrel',name:'Cernícalo',color:0xc6a075,wings:1.04,alt:205,radius:380,speed:1,flight:'hover',flapRate:5.4,wingspan:0.75,habitat:'Laderas y praderas',detail:'Vigila el terreno y se mantiene suspendido ante posibles presas.'},
 {id:'hummingbird',name:'Colibrí',color:0x3cb9a0,wings:.42,alt:64,radius:138,speed:2.0,flight:'hover',flapRate:18,wingspan:0.11,habitat:'Flores del bosque',detail:'Cernido rápido, maniobras cortas y búsqueda de néctar.'},
 {id:'vulture',name:'Buitre leonado',color:0x92705a,wings:1.75,alt:345,radius:620,speed:.67,flight:'soar',flapRate:1.2,wingspan:2.65,habitat:'Térmicas de montaña',detail:'Aprovecha corrientes ascendentes para planear sin esfuerzo.'},
 {id:'swift',name:'Vencejo',color:0x4f6879,wings:1.13,alt:260,radius:540,speed:2.25,flight:'dash',flapRate:8.8,wingspan:0.43,habitat:'Cielo abierto',detail:'Giros veloces y amplias rutas por el aire.'},
 {id:'albatross',name:'Albatros',color:0xd4d7ce,wings:2.15,alt:45,radius:1900,speed:.73,flight:'marine',flapRate:.7,wingspan:3.2,habitat:'Alta mar',detail:'Planeo dinámico sobre el oleaje con aleteo mínimo.'},
 {id:'osprey',name:'Águila pescadora',color:0x907860,wings:1.55,alt:190,radius:1050,speed:1.16,flight:'soar',flapRate:2.6,wingspan:1.65,habitat:'Costa y marismas',detail:'Patrulla el agua y realiza aproximaciones rápidas.'},
 {id:'owl',name:'Búho real',color:0x9b8167,wings:1.36,alt:165,radius:440,speed:.78,flight:'nocturnal',flapRate:3.2,wingspan:1.65,habitat:'Bosques nocturnos',detail:'Actividad nocturna, vuelos bajos y pausas en el bosque.'},
 {id:'eagle',name:'Águila real',color:0x76583f,wings:1.83,alt:405,radius:780,speed:.92,flight:'soar',flapRate:2.0,wingspan:2.2,habitat:'Cumbres rocosas',detail:'Planeo circular sobre la montaña y vuelos de exploración.'},
 {id:'kingfisher',name:'Martín pescador',color:0x267b99,wings:.70,alt:47,radius:480,speed:1.60,flight:'dash',flapRate:9.5,wingspan:0.26,habitat:'Riberas y lagunas',detail:'Vuela rápido a baja altura cerca de la superficie.'},
 {id:'heron',name:'Garza real',color:0x8999a3,wings:1.70,alt:78,radius:780,speed:.55,flight:'wade',flapRate:1.95,wingspan:1.9,habitat:'Marisma',detail:'Movimiento pausado y vuelo de aleteo profundo.'},
 {id:'gull',name:'Gaviota',color:0xe1e0d2,wings:1.44,alt:112,radius:1600,speed:1.14,flight:'marine',flapRate:2.4,wingspan:1.25,habitat:'Acantilados y mar',detail:'Aprovecha el viento costero y sigue el oleaje.'},
 {id:'swallow',name:'Golondrina',color:0x2c5163,wings:.86,alt:125,radius:350,speed:1.98,flight:'dash',flapRate:8.4,wingspan:0.32,habitat:'Praderas',detail:'Cambios de rumbo muy rápidos mientras busca insectos.'}
];
export const WEATHER=[
 {id:'clear',name:'Despejado',cloud:.10,rain:0,fog:0},
 {id:'sunny',name:'Soleado',cloud:.19,rain:0,fog:0},
 {id:'cloudy',name:'Nublado',cloud:.70,rain:0,fog:.16},
 {id:'fog',name:'Niebla',cloud:.85,rain:0,fog:.8},
 {id:'drizzle',name:'Llovizna',cloud:.75,rain:.28,fog:.35},
 {id:'rain',name:'Lluvia',cloud:.90,rain:.68,fog:.43},
 {id:'storm',name:'Tormenta',cloud:1,rain:1,fog:.56}
];
export function chooseBird(date){
 const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
 const ids={Sun:'kestrel',Mon:'vulture',Tue:'hummingbird',Wed:'swift',Thu:'eagle',Fri:'albatross',Sat:'osprey'};
 return BIRDS.find(b=>b.id===ids[weekday])||BIRDS[0];
}
export function chooseWeather(date){
 const day=Math.floor(date.getTime()/86400000);const rand=random(day^0x48ae1);
 return WEATHER[Math.floor(rand()*WEATHER.length)];
}
export function sunPosition(date,latitude=40,longitude=0){
  // Approximation based on NOAA apparent sun formula. Azimuth radians from north, clockwise.
  const n=date.getTime()/86400000+2440587.5-2451545;
  const L=((280.46+.9856474*n)%360+360)%360, g=(357.528+.9856003*n)*Math.PI/180;
  const lambda=(L+1.915*Math.sin(g)+.020*Math.sin(2*g))*Math.PI/180;
  const eps=(23.439-.0000004*n)*Math.PI/180;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lambda));
  const y=Math.tan(eps/2)**2, lr=L*Math.PI/180;
  const eq=4*(y*Math.sin(2*lr)-2*.0167*Math.sin(g)+4*.0167*y*Math.sin(g)*Math.cos(2*lr)-.5*y*y*Math.sin(4*lr)-1.25*.0167*.0167*Math.sin(2*g))*180/Math.PI;
  const mins=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;
  const solar=((mins+eq+4*longitude)%1440+1440)%1440, hourAngle=(solar/4-180)*Math.PI/180;
  const phi=latitude*Math.PI/180;
  const altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hourAngle));
  const azimuth=(Math.atan2(Math.sin(hourAngle),Math.cos(hourAngle)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))+Math.PI)%TAU;
  return {altitude,azimuth,daylight:smooth(-.15,.18,altitude),golden:1-smooth(.08,.42,Math.abs(altitude)),night:altitude<-.105};
}
export function readOptions(search){
 const p=new URLSearchParams(search);
 const h=Number(p.get('h'));const bird=BIRDS.find(b=>b.id===p.get('bird'));const weather=WEATHER.find(w=>w.id===p.get('weather'));
 const phase=['dawn','noon','sunset','night'].includes(p.get('phase'))?p.get('phase'):null;
 return {phase,tv:p.get('tv')==='1'||p.get('screensaver')==='1',hour:p.has('h')&&Number.isFinite(h)&&h>=0&&h<24?h:null,bird,weather,broadcast:p.get('broadcast')==='1',selftest:p.get('selftest')==='1'};
}
