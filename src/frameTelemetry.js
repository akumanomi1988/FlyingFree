// Bounded, allocation-light frame telemetry for long-running sessions.
// Percentiles are nearest-rank values over a rolling window, not GPU timings.
export function createFrameTelemetry(capacity=600){
  if(!Number.isInteger(capacity)||capacity<2||capacity>36000)throw new RangeError('Invalid telemetry capacity');
  const samples=new Float32Array(capacity);
  let count=0,cursor=0,dropped=0;
  return {
    record(ms){
      if(!Number.isFinite(ms)||ms<=0)return false;
      if(ms>2000){dropped++;return false;} // Reject tab suspension, NOT real 250–2000ms jank.
      samples[cursor]=ms;cursor=(cursor+1)%capacity;count++;return true;
    },
    snapshot(){
      const size=Math.min(count,capacity);
      if(!size)return {samples:0,p50:null,p95:null,p99:null,mean:null,overBudgetPct:null,discarded:dropped};
      const sorted=Array.from(samples.subarray(0,size)).sort((a,b)=>a-b);
      const percentile=p=>+sorted[Math.max(0,Math.ceil(size*p)-1)].toFixed(2);
      let sum=0,over=0;
      for(let i=0;i<size;i++){sum+=sorted[i];if(sorted[i]>1000/60)over++;}
      return {samples:size,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),
        mean:+(sum/size).toFixed(2),overBudgetPct:+(over*100/size).toFixed(1),discarded:dropped};
    },
    reset(){count=0;cursor=0;dropped=0;}
  };
}
