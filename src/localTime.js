import {sunPosition,clamp} from './core.js';
export function localHour(date){return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600}
export function withLocalHour(date,hour){const d=new Date(date);const h=Math.floor(hour),minutes=Math.floor((hour-h)*60),seconds=Math.round((hour-h-minutes/60)*3600);d.setHours(h,minutes,seconds,0);return d}
export function seasonLocal(date){
 const m=date.getMonth();return m===11||m<=1?'Invierno':m<=4?'Primavera':m<=7?'Verano':'Otoño';
}
export function astronomicalPhase(date,phase,lat,lon){
 if(phase==='night')return 23;
 if(phase==='noon'){
  let best=12,alt=-Infinity;for(let h=9;h<=16;h+=.25){let a=sunPosition(withLocalHour(date,h),lat,lon).altitude;if(a>alt){best=h;alt=a;}}return best;
 }
 const from=phase==='dawn'?2:13,to=phase==='dawn'?12:23,threshold=-.0145;
 let prev=from,p=sunPosition(withLocalHour(date,from),lat,lon).altitude;
 for(let h=from+.125;h<=to;h+=.125){
  const a=sunPosition(withLocalHour(date,h),lat,lon).altitude;
  if(phase==='dawn'&&p<=threshold&&a>threshold||phase==='sunset'&&p>=threshold&&a<threshold){
   return clamp(prev+(threshold-p)/(a-p)*(h-prev)+(phase==='dawn'?.18:-.23),0,23.99);
  }
  prev=h;p=a;
 }
 return phase==='dawn'?7:18.5;
}
export function localTimeLabel(date,timeZone){return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(timeZone?{timeZone}:{})}).format(date)}
export function localDateLabel(date,timeZone){return new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long',...(timeZone?{timeZone}:{})}).format(date)}
