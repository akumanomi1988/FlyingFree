// VE-02: a monotonic, bounded, deterministic simulation timeline.
export const FIXED_SIMULATION_DT = 1 / 30;

export function createFixedStepClock({fixedDt=FIXED_SIMULATION_DT,maxSubsteps=8,maxFrameDt=.25}={}){
  if(!Number.isFinite(fixedDt)||fixedDt<=0||!Number.isInteger(maxSubsteps)||maxSubsteps<1||
     !Number.isFinite(maxFrameDt)||maxFrameDt<fixedDt)
    throw new RangeError('Invalid fixed simulation clock configuration');
  let lastTimestamp=null,accumulator=0,ticks=0,paused=false,droppedSeconds=0,frames=0;
  const epsilon=fixedDt*1e-7;
  const snapshot=()=>({
    fixedDt,maxSubsteps,ticks,seconds:ticks*fixedDt,
    alpha:paused?1:Math.min(1,Math.max(0,accumulator/fixedDt)),
    accumulator,paused,droppedSeconds,frames
  });
  function resync(timestamp=null){
    if(timestamp!==null&&!Number.isFinite(timestamp))throw new RangeError('Invalid clock timestamp');
    lastTimestamp=timestamp;accumulator=0;
  }
  function setPaused(value,timestamp=null){
    const next=Boolean(value);
    if(next!==paused){paused=next;resync(timestamp);}
    return snapshot();
  }
  function advance(timestamp,onStep){
    if(!Number.isFinite(timestamp))throw new RangeError('Invalid frame timestamp');
    if(typeof onStep!=='function')throw new TypeError('Expected simulation step callback');
    frames++;
    if(lastTimestamp===null){lastTimestamp=timestamp;return snapshot();}
    const elapsed=Math.max(0,(timestamp-lastTimestamp)/1000);
    lastTimestamp=timestamp;
    if(paused)return snapshot();
    const accepted=Math.min(elapsed,maxFrameDt);
    const budget=fixedDt*maxSubsteps,available=accumulator+accepted;
    const capped=Math.min(available,budget);
    droppedSeconds+=Math.max(0,elapsed-accepted)+Math.max(0,available-capped);
    const count=Math.min(maxSubsteps,Math.floor((capped+epsilon)/fixedDt));
    for(let i=0;i<count;i++){
      const nextTick=ticks+1;
      onStep(fixedDt,nextTick,nextTick*fixedDt);
      ticks=nextTick;
    }
    accumulator=Math.max(0,capped-count*fixedDt);
    return snapshot();
  }
  return {advance,resync,setPaused,snapshot};
}
