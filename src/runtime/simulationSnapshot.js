// Versioned plain-data observations. No THREE.Mesh or wall-clock fields.
// Replaying starts from seed + the same input events at the same ticks;
// this does not restore internal RNG state from an arbitrary checkpoint.
const finite=value=>{
  if(!Number.isFinite(value))throw new RangeError('Non-finite simulation snapshot value');
  return Math.round(value*1e6)/1e6;
};
export function captureSimulationSnapshot({seed,clock,birdId,bird,weather,animals=[]}){
  if(!bird||!clock)throw new TypeError('Clock and bird state are required');
  const pose=source=>({
    x:finite(source.x),y:finite(source.y),z:finite(source.z),
    heading:finite(source.heading??0),velocity:finite(source.velocity??source.speed??0)
  });
  return {
    schema:1,seed,tick:clock.ticks,simSeconds:finite(clock.seconds),
    bird:{species:birdId,...pose(bird),state:bird.state??'patrol',
      energy:finite(bird.energy),hunger:finite(bird.hunger),
      landings:bird.landings??0,feedings:bird.feedings??0,rests:bird.rests??0},
    weather:{id:weather.id,cloud:finite(weather.cloud),rain:finite(weather.rain),fog:finite(weather.fog)},
    fauna:animals.map(a=>({species:a.species,...pose(a),state:a.state??'idle'}))
  };
}
