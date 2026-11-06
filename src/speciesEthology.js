// Species-specific behavioural constraints and observable descriptors.
// Wing frequencies represent animation cadence, not a claim of exact
// aerodynamic simulation (a 60 FPS rasterizer cannot resolve 50+ Hz flaps).
export const BIRD_ETHOLOGY=Object.freeze({
 kestrel:{zone:'open',height:85,wingHz:5.4,food:'Pequeños mamíferos e insectos',rest:'Perchas abiertas',nest:'Oquedades y nidos reutilizados'},
 hummingbird:{zone:'canopy',height:25,wingHz:18,food:'Néctar e insectos',rest:'Ramas finas',nest:'Copa pequeña de fibras vegetales'},
 vulture:{zone:'ridge',height:180,wingHz:1.2,food:'Carroña',rest:'Cortados rocosos',nest:'Repisa de acantilado'},
 swift:{zone:'sky',height:155,wingHz:8.8,food:'Insectos aéreos',rest:'Solo en refugios de nidificación',nest:'Oquedades'},
 albatross:{zone:'ocean',height:36,wingHz:.7,food:'Peces y cefalópodos',rest:'Superficie marina',nest:'Suelo en colonias'},
 osprey:{zone:'coast',height:80,wingHz:2.6,food:'Peces',rest:'Árboles y postes junto al agua',nest:'Plataforma grande de ramas'},
 owl:{zone:'canopy',height:37,wingHz:3.2,food:'Pequeños vertebrados',rest:'Ramas y roquedos',nest:'Repisa o nido reutilizado'},
 eagle:{zone:'ridge',height:205,wingHz:2,food:'Mamíferos y aves',rest:'Crestas y árboles altos',nest:'Gran plataforma en roca o árbol'},
 kingfisher:{zone:'river',height:17,wingHz:9.5,food:'Peces pequeños',rest:'Ramas sobre el agua',nest:'Túnel en talud fluvial'},
 heron:{zone:'wetland',height:28,wingHz:2.7,food:'Peces y anfibios',rest:'Orillas y arbolado cercano',nest:'Plataforma de ramas'},
 gull:{zone:'coast',height:32,wingHz:3.4,food:'Peces e invertebrados',rest:'Mar y playas',nest:'Suelo de costa'},
 swallow:{zone:'canopy',height:38,wingHz:8.4,food:'Insectos voladores',rest:'Posaderos abiertos',nest:'Copa de barro'}
});
export function birdFlightClearance(id,phase='cruise'){
 const p=BIRD_ETHOLOGY[id];
 if(!p)return 70;
 if(phase==='hunt')return id==='hummingbird'?4:id==='kingfisher'?2:Math.min(15,p.height*.4);
 if(phase==='cruise')return p.height;
 return Math.max(4,p.height*.65);
}
const STATE_LABELS=Object.freeze({
 patrol:'Explorando',seek_food:'Buscando alimento',approach:'Aproximándose',
 landing:'Aterrizando',feed:'Alimentándose',takeoff:'Despegando',
 return:'Regresando',rest:'Descansando',shelter:'Buscando refugio'
});
export function birdStatus(energy,hunger,state,weather=0){
 const stamina=Math.max(0,Math.min(1,energy));
 const appetite=Math.max(0,Math.min(1,hunger));
 const label=STATE_LABELS[state]||'Volando';
 const condition=stamina<.22?'Agotado':appetite>.75?'Hambriento':
   stamina<.42?'Cansado':weather>.72?'Bajo lluvia':'Activo';
 return {stamina,appetite,state:label,condition,needsRest:stamina<.27,
   needsFood:appetite>.56};
}
