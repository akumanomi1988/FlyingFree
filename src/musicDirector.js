import {clamp} from './core.js';

// Original generative harmonies. No samples, copyrighted recordings or network assets.
const HARMONIES={
 clear:{notes:[73.42,146.83,185.00,220.00,293.66],root:293.66,scale:[0,2,4,7,9,12]},
 cloudy:{notes:[73.42,146.83,164.81,220.00,293.66],root:293.66,scale:[0,2,5,7,9,12]},
 drizzle:{notes:[61.74,123.47,146.83,185.00,246.94],root:246.94,scale:[0,3,5,7,10,12]},
 rain:{notes:[61.74,123.47,146.83,185.00,246.94],root:246.94,scale:[0,3,5,7,10,12]},
 storm:{notes:[82.41,164.81,196.00,246.94,329.63],root:329.63,scale:[0,3,5,7,10,12]},
 fog:{notes:[55.00,110.00,130.81,164.81,246.94],root:220.00,scale:[0,3,5,7,10,12]},
 snow:{notes:[49.00,98.00,123.47,146.83,220.00],root:392.00,scale:[0,2,4,7,9,12]}
};
const safeUnit=(value,fallback=0)=>Number.isFinite(value)?clamp(value):fallback;

/**
 * Derives one musical state from the same blended weather and solar values as the renderer.
 * Exported independently of Web Audio so it can be tested without a browser.
 */
export function deriveMusicProfile(weather={},solar={},weatherId=weather?.id){
 const cloud=safeUnit(weather?.cloud),rain=safeUnit(weather?.rain),fog=safeUnit(weather?.fog);
 const daylight=safeUnit(solar?.daylight,solar?.night?0:1);
 const golden=safeUnit(solar?.golden);
 const night=Boolean(solar?.night);
 const key=weatherId==='sunny'?'clear':Object.hasOwn(HARMONIES,weatherId)?weatherId:
  rain>.5?'rain':fog>.5?'fog':cloud>.55?'cloudy':'clear';
 const harmony=HARMONIES[key];
 // Even a storm keeps an audible melodic bed; day and cloud cover mainly change brilliance.
 const brightness=clamp(.20+daylight*.66*(1-cloud*.48)+golden*.11-rain*.12-fog*.14,.12,.94);
 const fullness=clamp(.93-(night?.11:0)-rain*.065,.72,.96);
 const pace=clamp(.43+daylight*.29-rain*.08-(key==='fog'?.10:0),.27,.78);
 return {
  key,notes:harmony.notes,root:harmony.root,scale:harmony.scale,
  brightness,fullness,pace,
  padCutoff:650+brightness*3200,
  bellCutoff:1300+brightness*6400,
  bellLevel:.076+brightness*.064-(night?.014:0),
  windLevel:.026+cloud*.054,
  rainLevel:rain*.14
 };
}
