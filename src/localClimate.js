// Open-Meteo weather adapter. Location is never shown or persisted.
// The client receives only coordinates rounded to 0.1 degree (~11 km latitude).
import { clamp } from './core.js';
export const WEATHER_FIELDS='temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day';
export const WEATHER_REFRESH_MS=30*60*1000;
export const WEATHER_STALE_MS=90*60*1000;
export function classifyWeather(code,cloudPct=0,precipitation=0){
 const c=Number(code),cloud=clamp(Number(cloudPct)/100),rain=clamp(Number(precipitation)/2.2);
 if(!Number.isFinite(c))return {id:'unknown',name:'Sin datos',cloud,rain:0,fog:0};
 if(c===0||c===1)return {id:'clear',name:'Despejado',cloud:Math.max(.08,cloud),rain:0,fog:0};
 if(c===2)return {id:'cloudy',name:'Intervalos nubosos',cloud:Math.max(.38,cloud),rain:0,fog:0};
 if(c===3)return {id:'cloudy',name:'Nublado',cloud:Math.max(.74,cloud),rain:0,fog:0};
 if(c===45||c===48)return {id:'fog',name:'Niebla',cloud:.9,rain:0,fog:.75};
 if(c>=51&&c<=57)return {id:'drizzle',name:'Llovizna',cloud:Math.max(.72,cloud),rain:Math.max(.23,rain),fog:.24};
 if(c>=61&&c<=67)return {id:'rain',name:'Lluvia',cloud:Math.max(.78,cloud),rain:Math.max(.54,rain),fog:.23};
 if(c>=71&&c<=77)return {id:'snow',name:'Nieve',cloud:Math.max(.88,cloud),rain:.16,fog:.28,snow:true};
 if(c>=80&&c<=82)return {id:'rain',name:'Chubascos',cloud:Math.max(.77,cloud),rain:Math.max(.68,rain),fog:.17};
 if(c>=85&&c<=86)return {id:'snow',name:'Chubascos de nieve',cloud:.93,rain:.26,fog:.31,snow:true};
 if(c>=95&&c<=99)return {id:'storm',name:'Tormenta',cloud:1,rain:Math.max(.83,rain),fog:.38};
 return {id:'cloudy',name:'Variable',cloud:Math.max(.40,cloud),rain,fog:0};
}
export function parseWeather(payload,receivedAt=Date.now()){
 const v=payload?.current;
 if(!v||!Number.isFinite(Number(v.temperature_2m))||!Number.isFinite(Number(v.weather_code)))throw Error('Datos meteorológicos incompletos');
 const descriptor=classifyWeather(v.weather_code,v.cloud_cover,v.precipitation);
 return {descriptor,temperature:Math.round(v.temperature_2m),
  feelsLike:Number.isFinite(v.apparent_temperature)?Math.round(v.apparent_temperature):null,
  humidity:Number.isFinite(v.relative_humidity_2m)?Math.round(v.relative_humidity_2m):null,
  windKmh:Number.isFinite(v.wind_speed_10m)?Math.round(v.wind_speed_10m):null,
  observedAt:receivedAt,source:'Open-Meteo'};
}
export function buildWeatherURL(latitude,longitude){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Coordenadas inválidas');
 const q=new URLSearchParams({latitude:latitude.toFixed(1),longitude:longitude.toFixed(1),current:WEATHER_FIELDS,timezone:'auto',forecast_days:'1'});
 return 'https://api.open-meteo.com/v1/forecast?'+q;
}
export function approximateSolarCoordinates(date=new Date()){
 // Fallback only: derive solar longitude from local UTC offset. No claim of geographical accuracy.
 return {latitude:40,longitude:-date.getTimezoneOffset()/4,accurate:false};
}
export function createLiveClimate({geo=globalThis.navigator?.geolocation,
 permissions=globalThis.navigator?.permissions,
 fetcher=globalThis.fetch?.bind(globalThis),
 clock=()=>Date.now()}={}){
 let coords=null,weather=null,inFlight=null,lastAttempt=0,lastSuccess=0;
 const geolocate=()=>new Promise((resolve,reject)=>{
  if(!geo?.getCurrentPosition){reject(new Error('Geolocalización no disponible'));return;}
  geo.getCurrentPosition(
   p=>resolve({latitude:Math.round(p.coords.latitude*10)/10,longitude:Math.round(p.coords.longitude*10)/10,accurate:true}),
   err=>reject(new Error(err?.code===1?'Ubicación no autorizada':'No se puede obtener la ubicación')),
   {enableHighAccuracy:false,maximumAge:30*60*1000,timeout:10000}
  );
 });
 async function requestLocation({onlyPreviouslyGranted=false}={}){
  if(onlyPreviouslyGranted){
   if(!permissions?.query)return false;
   try{const permission=await permissions.query({name:'geolocation'});if(permission.state!=='granted')return false;}
   catch{return false;}
  }
  const position=await geolocate();coords=position;return true;
 }
 async function refresh(force=false){
  if(!coords||!fetcher)return null;
  if(inFlight)return inFlight;
  const now=clock();
  if(!force&&now-lastAttempt<WEATHER_REFRESH_MS&&weather)return weather;
  if(!force&&lastAttempt&&now-lastAttempt<60_000)return weather;
  lastAttempt=now;
  inFlight=(async()=>{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8500);
   try{
    const res=await fetcher(buildWeatherURL(coords.latitude,coords.longitude),{signal:controller.signal,cache:'no-store'});
    if(!res.ok)throw Error('Servicio meteorológico no disponible');
    const parsed=parseWeather(await res.json(),clock());
    weather=parsed;lastSuccess=clock();return weather;
   }finally{clearTimeout(timeout);inFlight=null;}
  })();
  return inFlight;
 }
 return {
  requestLocation,refresh,
  get coordinates(){return coords;},
  get weather(){return weather&&clock()-lastSuccess<WEATHER_STALE_MS?weather:null;},
  get stale(){return Boolean(weather)&&clock()-lastSuccess>=WEATHER_STALE_MS;},
  get enabled(){return Boolean(coords);}
 };
}
