// Resolution governor for multi-hour TV/broadcast sessions.
// Drops are relatively fast; recoveries are deliberately slow and bounded.
// Never exceeds the pixel ratio selected for the user's viewport/device.
export function createAdaptiveResolution({
  maxScale,
  minScale=Math.min(.48,maxScale),
  downFps=23,
  upFps=48,
  upP95Ms=24,
  downHold=8,
  upHold=28,
  cooldownSeconds=12
}={}) {
  if(!Number.isFinite(maxScale)||maxScale<=0||
     !Number.isFinite(minScale)||minScale<=0||minScale>maxScale)
    throw new RangeError('Invalid resolution range');
  let scale=maxScale,bad=0,good=0,cooldown=0;
  let reductions=0,restorations=0;

  function snapshot() {
    return {scale,maxScale,minScale,reductions,restorations,
      lowFpsSeconds:+bad.toFixed(1),highFpsSeconds:+good.toFixed(1)};
  }
  function pause() {
    bad=0;good=0;
    return snapshot();
  }
  function observe({fps,p95Ms,seconds=1,hidden=false}={}) {
    if(hidden||!Number.isFinite(fps)||fps<0||!Number.isFinite(seconds)||seconds<=0)
      return {...pause(),changed:false};
    const elapsed=Math.min(2,seconds);
    cooldown=Math.max(0,cooldown-elapsed);
    const clearlyFast=fps>=upFps&&(!Number.isFinite(p95Ms)||p95Ms<=upP95Ms);
    if(fps<downFps) {
      bad+=elapsed;good=0;
    }else if(clearlyFast) {
      good+=elapsed;bad=0;
    }else{
      bad=Math.max(0,bad-elapsed);
      good=Math.max(0,good-elapsed);
    }
    let changed=false,reason=null;
    if(cooldown<=0&&bad>=downHold&&scale>minScale+.005) {
      const next=Math.max(minScale,Math.round(scale*.86*1000)/1000);
      if(next<scale){scale=next;reductions++;changed=true;reason='degrade';}
    }else if(cooldown<=0&&good>=upHold&&scale<maxScale-.005) {
      const next=Math.min(maxScale,Math.round(scale*1.075*1000)/1000);
      if(next>scale){scale=next;restorations++;changed=true;reason='recover';}
    }
    if(changed){cooldown=cooldownSeconds;bad=0;good=0;}
    return {...snapshot(),changed,reason};
  }
  return {observe,pause,snapshot};
}
