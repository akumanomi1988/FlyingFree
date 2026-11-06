// Species information is separate from the renderer/AI. Wingbeat rates are
// approximate NORMAL-CRUISE animation targets (Hz), not laboratory measurements
// of a particular individual. Hovering hummingbirds beat too rapidly for a
// frame-by-frame mesh at 60 FPS: their visual rig uses an envelope instead.
const profiles={
 kestrel:{flight:'hover-dash',beatHz:5.4,flapStrength:.39,glide:.28,canopy:'edge',cruiseAGL:55,rest:'tree',feed:'small-prey',nest:'rock-or-tree',activity:'day',traits:['cerniéndose','vigilando']},
 hummingbird:{flight:'hover',beatHz:45,flapStrength:.34,glide:0,canopy:'interior',cruiseAGL:17,rest:'branch',feed:'nectar',nest:'small-cup-branch',activity:'day',traits:['libando','cerniéndose']},
 vulture:{flight:'soar',beatHz:1.6,flapStrength:.38,glide:.94,canopy:'above',cruiseAGL:165,rest:'cliff',feed:'carrion',nest:'cliff-ledge',activity:'day',traits:['planeando','buscando corrientes']},
 swift:{flight:'dash',beatHz:7.1,flapStrength:.30,glide:.55,canopy:'open',cruiseAGL:110,rest:'nest-only',feed:'insect',nest:'cavity',activity:'day',traits:['cazando insectos','volando']},
 albatross:{flight:'dynamic-soar',beatHz:.95,flapStrength:.19,glide:.97,canopy:'sea',cruiseAGL:19,rest:'water',feed:'fish',nest:'ground-mound',activity:'all',traits:['planeando','buscando alimento']},
 osprey:{flight:'soar-dive',beatHz:3.5,flapStrength:.31,glide:.69,canopy:'above',cruiseAGL:70,rest:'tree',feed:'fish',nest:'platform',activity:'day',traits:['patrullando','pescando']},
 owl:{flight:'silent-flap',beatHz:3.4,flapStrength:.32,glide:.35,canopy:'interior',cruiseAGL:30,rest:'branch',feed:'small-prey',nest:'cavity-or-ledge',activity:'night',traits:['escuchando','buscando presas']},
 eagle:{flight:'soar',beatHz:2.3,flapStrength:.40,glide:.89,canopy:'above',cruiseAGL:145,rest:'cliff',feed:'small-prey',nest:'large-platform',activity:'day',traits:['planeando','vigilando']},
 kingfisher:{flight:'fast-river',beatHz:8.7,flapStrength:.28,glide:.04,canopy:'riparian',cruiseAGL:12,rest:'branch',feed:'fish',nest:'river-bank-burrow',activity:'day',traits:['pescando','vigilando']},
 heron:{flight:'slow-flap',beatHz:1.8,flapStrength:.43,glide:.24,canopy:'wetland',cruiseAGL:26,rest:'wetland',feed:'fish',nest:'tree-platform',activity:'day',traits:['vadeando','pescando']},
 swallow:{flight:'agile',beatHz:6.9,flapStrength:.30,glide:.34,canopy:'edge',cruiseAGL:20,rest:'branch',feed:'insect',nest:'mud-cup',activity:'day',traits:['cazando insectos','girando']},
 gull:{flight:'flap-glide',beatHz:3.1,flapStrength:.32,glide:.60,canopy:'shore',cruiseAGL:27,rest:'water',feed:'fish',nest:'ground-colony',activity:'day',traits:['planeando','buscando alimento']}
};
export const BIRD_ETHOLOGY=Object.freeze(Object.fromEntries(
  Object.entries(profiles).map(([id,v])=>[id,Object.freeze(v)])
));
export function birdEthology(profile){
  const id=typeof profile==='string'?profile:profile?.id;
  const result=BIRD_ETHOLOGY[id];
  if(!result)throw new RangeError('Unknown bird species: '+id);
  return result;
}
// Altitude AGL varies by biome and species; real swifts remain high even
// though their bodies are small. Habitat transitions do not hard teleport.
export function cruiseClearance(profile,habitatType='forest'){
  const e=birdEthology(profile);
  if(e.canopy==='sea')return e.cruiseAGL;
  if(e.canopy==='above')return habitatType==='highland'||habitatType==='rock'
    ?e.cruiseAGL+40:e.cruiseAGL;
  if(e.canopy==='interior')return habitatType==='forest'?e.cruiseAGL:Math.max(23,e.cruiseAGL);
  if(e.canopy==='riparian')return habitatType==='wetland'?e.cruiseAGL:23;
  if(e.canopy==='wetland')return habitatType==='wetland'?e.cruiseAGL:42;
  if(e.canopy==='edge')return habitatType==='forest'?29:e.cruiseAGL;
  return e.cruiseAGL;
}
export function flightBeatHz(profile,behaviour='patrol',energy=.7){
  const e=birdEthology(profile);
  const rested=Math.max(.55,Math.min(1.10,.70+energy*.4));
  if(['rest','landing','feed','shelter'].includes(behaviour))return 0;
  if(behaviour==='takeoff')return e.beatHz*1.16*rested;
  if(behaviour==='approach')return e.beatHz*.83*rested;
  return e.beatHz*rested;
}
export const BIRD_ACTION_LABELS=Object.freeze({
  patrol:'Explorando',seek_food:'Buscando alimento',approach:'Aproximándose',
  landing:'Aterrizando',rest:'Descansando',feed:'Alimentándose',
  shelter:'Buscando refugio',return:'Volviendo',takeoff:'Despegando'
});
export function birdCondition(energy,hunger,activity,rain=0){
  const tiredness=Math.max(0,Math.min(1,1-energy));
  const urgency=Math.max(0,Math.min(1,hunger));
  const feeling=urgency>.75?'Hambre alta':tiredness>.73?'Fatiga alta':
    rain>.72?'Bajo lluvia':activity==='rest'?'En reposo':
    activity==='feed'?'Alimentándose':tiredness>.45?'Dosificando esfuerzo':'Activo';
  return {tiredness,hunger:urgency,feeling,
    action:BIRD_ACTION_LABELS[activity]??'En vuelo'};
}
