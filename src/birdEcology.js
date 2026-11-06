// Distinct ecological *archetypes*, not a claim that each rendered bird is an
// exact taxonomic species. Preferences control behavior and visuals together.
// Sources and limitations: docs/BIRD_BEHAVIOR.md.
const baseline=Object.freeze({canPerch:true,forageHeight:24,cruiseAboveCanopy:25,
  fatigueDrain:1,feedingStyle:'ground',nest:'vegetation',rest:'branch',wingBeatHz:4});
export const BIRD_ECOLOGY=Object.freeze({
 kestrel:{forageHeight:22,cruiseAboveCanopy:60,feedingStyle:'hover-hunt',nest:'rock ledge',rest:'branch',wingBeatHz:5},
 hummingbird:{forageHeight:4,cruiseAboveCanopy:5,fatigueDrain:1.8,feedingStyle:'nectar',nest:'small cup on branch',rest:'branch',wingBeatHz:45},
 vulture:{forageHeight:150,cruiseAboveCanopy:125,fatigueDrain:.40,feedingStyle:'scavenge',nest:'cliff ledge',rest:'cliff',wingBeatHz:2},
 swift:{canPerch:false,forageHeight:35,cruiseAboveCanopy:80,fatigueDrain:.60,feedingStyle:'aerial insects',nest:'crevice',rest:'vertical',wingBeatHz:8},
 albatross:{canPerch:false,forageHeight:15,cruiseAboveCanopy:50,fatigueDrain:.28,feedingStyle:'surface fish',nest:'open ground',rest:'water',wingBeatHz:1.3},
 osprey:{forageHeight:18,cruiseAboveCanopy:75,fatigueDrain:.65,feedingStyle:'plunge fish',nest:'large stick nest',rest:'branch',wingBeatHz:3.5},
 owl:{forageHeight:10,cruiseAboveCanopy:17,feedingStyle:'nocturnal prey',nest:'cavity / rock',rest:'branch',wingBeatHz:3.5},
 eagle:{forageHeight:95,cruiseAboveCanopy:130,fatigueDrain:.47,feedingStyle:'hunt',nest:'large stick nest',rest:'cliff',wingBeatHz:2.6},
 kingfisher:{forageHeight:3,cruiseAboveCanopy:8,feedingStyle:'dive fish',nest:'riverbank burrow',rest:'branch',wingBeatHz:10},
 heron:{forageHeight:4,cruiseAboveCanopy:34,feedingStyle:'wade fish',nest:'tree colony',rest:'wetland',wingBeatHz:2.5},
 gull:{forageHeight:12,cruiseAboveCanopy:27,fatigueDrain:.75,feedingStyle:'surface forage',nest:'coastal scrape',rest:'water',wingBeatHz:3.5},
 swallow:{forageHeight:8,cruiseAboveCanopy:18,fatigueDrain:.90,feedingStyle:'aerial insects',nest:'mud cup',rest:'branch',wingBeatHz:9}
});
export function birdEcology(profile){
 return {...baseline,...(BIRD_ECOLOGY[profile.id]||{})};
}
export function flightAltitude(profile,habitat,ground){
 const behavior=birdEcology(profile);
 const canopy=habitat.type==='forest'?24:habitat.type==='wetland'?12:habitat.type==='shore'?7:0;
 return Math.max(ground+behavior.forageHeight,
   ground+canopy+behavior.cruiseAboveCanopy);
}
export function birdSensation({energy,hunger,state,floating=false,weather=0}){
 if(floating)return 'Flotando';
 if(state==='rest')return 'Descansando';
 if(state==='shelter')return 'Resguardándose';
 if(state==='landing'||state==='approach')return 'Aterrizando';
 if(state==='takeoff')return 'Despegando';
 if(state==='feed')return 'Alimentándose';
 if(state==='seek_food'||hunger>.66)return 'Buscando alimento';
 if(energy<.3)return 'Cansada';
 if(weather>.75)return 'Viento y lluvia';
 return 'Explorando';
}
