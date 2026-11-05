import { random,terrainHeight,TAU,clamp } from './core.js';
import {FAUNA_SCALE} from './worldScale.js';
import {createFaunaLODFactory,faunaPathAngle,shouldAnimateFauna} from './faunaLOD.js';

// Small-scale ecosystems driven by behaviour states, not arbitrary mesh motion.
export function createEcosystem(THREE,scene,seed=1988,quality=1){
  const rng=random(seed^0x5ade9);
  const root=new THREE.Group();scene.add(root);
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.94,flatShading:false});
  const brown=mat(0xb18e64),cream=mat(0xe1cbb0),dark=mat(0x49483b),foxCoat=mat(0xc7794b),white=mat(0xf4debd),grass=mat(0x719b6c),flowerColors=[mat(0xe0af72),mat(0xcf849b),mat(0xe5d4ad),mat(0xb3aed8)];
  const sphere=new THREE.SphereGeometry(1,18,12),legGeo=new THREE.CylinderGeometry(.1,.12,1,10),antlerGeo=new THREE.CylinderGeometry(.055,.085,1,9);
  const eyeGeo=new THREE.SphereGeometry(1,10,8),up=new THREE.Vector3(0,1,0),a3=new THREE.Vector3(),b3=new THREE.Vector3();
  const create=(parent,geo,m,x,y,z,sx=1,sy=1,sz=1,rotation=null)=>{
    const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    if(rotation)mesh.rotation.set(...rotation);
    parent.add(mesh);return mesh;
  };
  const detail=(...args)=>{const mesh=create(...args);mesh.userData.detailOnly=true;return mesh;};
  const segment=(parent,m,from,to,thickness=1)=>{
    a3.set(...from);b3.set(...to);
    const delta=b3.clone().sub(a3),len=delta.length();
    const line=create(parent,antlerGeo,m,(from[0]+to[0])*.5,(from[1]+to[1])*.5,
      (from[2]+to[2])*.5,thickness,len,thickness);
    line.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/Math.max(len,.0001)));
    return line;
  };
  const actors=[];
  const faunaLOD=createFaunaLODFactory(THREE,{brown,cream,dark,foxCoat,white});
  function habitatPos(maxRadius,minElevation=22,maxElevation=250){
    for(let i=0;i<100;i++){
      const x=(rng()-.5)*maxRadius*2,z=(rng()-.5)*maxRadius*2;
      const y=terrainHeight(x,z,seed);if(y>=minElevation&&y<=maxElevation)return [x,y,z];
    }
    return [250,terrainHeight(250,80,seed),80];
  }
  function deer(){
    const group=new THREE.Group();
    group.userData.legs=[];
    const antlered=rng()>.42;
    group.userData.antlered=antlered;
    group.userData.body=create(group,sphere,brown,0,1.5,0,.52,.53,1.08);
    create(group,sphere,cream,0,1.6,-.77,.33,.55,.46);
    detail(group,sphere,cream,0,1.61,.98,.30,.24,.15);
    // A real head joint rotates its muzzle, ears, eyes and antlers together.
    const head=new THREE.Group();
    head.position.set(0,2.14,-.91);group.add(head);
    group.userData.head=head;
    create(head,sphere,brown,0,0,0,.30,.31,.38);
    detail(head,sphere,cream,0,-.04,-.28,.20,.16,.30);
    detail(head,sphere,dark,0,.02,-.55,.105,.085,.09);
    for(const side of [-1,1]){
      const ear=create(head,sphere,brown,side*.36,.28,.12,.25,.11,.30);
      ear.rotation.z=side*.18;
      detail(head,sphere,cream,side*.36,.29,.07,.17,.065,.19);
      detail(head,eyeGeo,dark,side*.275,.10,-.17,.071,.072,.057);
      for(const z of [-.63,.7]){
        const leg=create(group,legGeo,brown,side*.3,.68,z,.75,1.22,.75);
        leg.userData.leg={side,z};group.userData.legs.push(leg);
      }
      if(antlered){
        segment(head,cream,[side*.21,.28,-.05],[side*.41,.90,-.13],1.15);
        segment(head,cream,[side*.41,.90,-.13],[side*.57,1.16,-.15],.80);
        segment(head,cream,[side*.33,.66,-.10],[side*.58,.77,-.37],.66);
        segment(head,cream,[side*.43,.90,-.14],[side*.71,1.02,-.35],.53);
        segment(head,cream,[side*.49,1.02,-.14],[side*.67,1.23,-.26],.40);
      }
    }
    group.scale.setScalar(FAUNA_SCALE.deer);
    return group;
  }
  function fox(){
    const g=new THREE.Group();
    g.userData.legs=[];
    g.userData.body=create(g,sphere,foxCoat,0,.65,0,.35,.35,.86);
    create(g,sphere,white,0,.52,-.83,.27,.16,.46);
    // Facial details follow the same articulated head, not a fixed body.
    const head=new THREE.Group();head.position.set(0,.79,-.67);g.add(head);
    g.userData.head=head;
    create(head,sphere,foxCoat,0,0,0,.34,.34,.40);
    create(head,new THREE.ConeGeometry(.21,.46,12),white,0,-.15,-.42,.78,.68,1,[-Math.PI/2,0,0]);
    detail(head,eyeGeo,dark,0,-.10,-.66,.085,.085,.095);
    for(const side of [-1,1]){
      const ear=create(head,new THREE.ConeGeometry(.15,.39,9),foxCoat,side*.25,.36,-.15);
      ear.rotation.x=-.15;
      detail(head,new THREE.ConeGeometry(.085,.25,9),dark,side*.25,.39,-.19);
      detail(head,eyeGeo,dark,side*.28,.12,-.21,.074,.075,.065);
      detail(head,sphere,white,side*.23,-.28,-.24,.17,.15,.22);
      for(const z of [-.52,.57]){
        const leg=create(g,legGeo,dark,side*.25,.24,z,.54,.44,.54);
        leg.userData.leg={side,z};g.userData.legs.push(leg);
      }
    }
    const tail=create(g,sphere,foxCoat,0,.67,.95,.25,.25,.78);
    tail.rotation.x=-.35;
    create(tail,sphere,white,0,.01,.60,.89,.86,.38);
    g.userData.tail=tail;g.scale.setScalar(FAUNA_SCALE.fox);
    return g;
  }
  function rabbit(){
    const g=new THREE.Group();
    g.userData.legs=[];g.userData.ears=[];
    g.userData.body=create(g,sphere,cream,0,.36,0,.35,.34,.51);
    create(g,sphere,brown,0,.54,-.43,.28,.28,.30);
    create(g,sphere,cream,0,.40,.55,.18,.18,.18);
    detail(g,eyeGeo,dark,0,.52,-.75,.085,.075,.07);
    for(const side of [-1,1]){
      const ear=create(g,sphere,cream,side*.14,1.02,-.43,.105,.45,.16);
      ear.rotation.z=side*.18;g.userData.ears.push(ear);
      detail(ear,sphere,brown,0,0,-.16,.55,.84,.25);
      detail(g,eyeGeo,dark,side*.27,.57,-.58,.072,.081,.058);
      const paw=create(g,sphere,brown,side*.25,.18,-.28,.17,.14,.27);
      g.userData.legs.push(paw);
    }
    const hind=create(g,sphere,brown,0,.24,.40,.29,.26,.27);
    g.userData.legs.push(hind);
    g.scale.setScalar(FAUNA_SCALE.rabbit);return g;
  }
  function addActor(type,count,range){
    for(let i=0;i<count;i++){
      const g=type==='deer'?deer():type==='fox'?fox():rabbit();
      const [x,y,z]=habitatPos(range,type==='rabbit'?13:28,type==='fox'?235:180);
      g.position.set(x,y,z);g.rotation.y=rng()*TAU;
      const state={type,originX:x,originZ:z,seed:rng()*100,phase:rng()*TAU,speed:type==='fox'?.8:type==='rabbit'?.6:.24,cycle:13+rng()*19};
      const theta0=faunaPathAngle(0,state);
      state.anchorSin=Math.sin(theta0);
      state.anchorCos=Math.cos(theta0*.83);
      state.reactionX=0;state.reactionZ=0;state.lastTime=null;
      g.userData.state=state;
      faunaLOD.attach(g,type,Boolean(g.userData.antlered));
      g.userData.details=[];
      g.traverse(mesh=>{if(mesh.userData.detailOnly)g.userData.details.push(mesh);});
      g.userData.detailVisible=true;
      g.userData.motionDetailed=true;
      root.add(g);actors.push(g);
    }
  }
  addActor('deer',Math.round(8*quality),950);
  addActor('fox',Math.round(4*quality),1050);
  addActor('rabbit',Math.round(12*quality),900);
  const foxes=actors.filter(g=>g.userData.state.type==='fox');
  const rabbits=actors.filter(g=>g.userData.state.type==='rabbit');
  const flowers=[];
  const flowerGeo=new THREE.IcosahedronGeometry(1,0);
  const count=Math.round(750*quality);
  const blossom=new THREE.InstancedMesh(flowerGeo,flowerColors[1],count);
  blossom.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy=new THREE.Object3D();let flowerCount=0;
  for(let i=0;i<count*6&&flowerCount<count;i++){
    const [x,y,z]=habitatPos(1200,15,138);
    dummy.position.set(x,y+.27,z);dummy.rotation.set(rng()*TAU,rng()*TAU,rng()*TAU);
    const s=.95+rng()*1.4;dummy.scale.set(s*.045,s*.028,s*.045);dummy.updateMatrix();
    blossom.setMatrixAt(flowerCount,dummy.matrix);
    blossom.setColorAt(flowerCount, new THREE.Color([0xd3a0a9,0xdad490,0xa6bfa2,0xccbad1][Math.floor(rng()*4)]));
    flowers.push(new THREE.Vector3(x,y+.32,z));flowerCount++;
  }
  blossom.count=flowerCount;blossom.instanceMatrix.needsUpdate=true;
  if(blossom.instanceColor)blossom.instanceColor.needsUpdate=true;
  root.add(blossom);
  const butterflies=[];
  const wingGeom=new THREE.SphereGeometry(1,6,4);
  const wingMat=mat(0xf1c97e);
  for(let i=0;i<Math.round(30*quality);i++){
    const flower=flowers[Math.floor(rng()*flowers.length)];
    const g=new THREE.Group();const left=create(g,wingGeom,wingMat,-.47,0,0,.58,.13,.38);
    const right=create(g,wingGeom,wingMat,.47,0,0,.58,.13,.38);
    g.position.copy(flower);g.position.y+=.1+rng()*.45;
    g.scale.setScalar(FAUNA_SCALE.butterfly);
    root.add(g);
    butterflies.push({g,left,right,origin:g.position.clone(),seed:rng()*100});
  }
  const birds=[];
  const vgeom=new THREE.BufferGeometry();
  vgeom.setAttribute('position',new THREE.Float32BufferAttribute([-.6,0,0,0,.14,.18,0,.14,.18,.6,0,0,0,.14,.18,0,.05,-.25],3));
  vgeom.computeVertexNormals();
  const gullMat=new THREE.MeshStandardMaterial({color:0xe4e5d9,side:THREE.DoubleSide,roughness:.87});
  const gullDark=mat(0x667681),gullBill=mat(0xd8ad5b);
  // Secondary birds have a 3D silhouette nearby, but revert to two triangles
  // after the camera moves away. Each LOD is selected by the renderer.
  for(let i=0;i<Math.round(22*quality);i++){
    const high=new THREE.Group();
    create(high,sphere,gullMat,0,0,0,.17,.14,.45);
    create(high,sphere,gullMat,0,.14,-.38,.14,.14,.16);
    create(high,new THREE.ConeGeometry(.065,.24,8),gullBill,0,.12,-.59,1,1,1,[-Math.PI/2,0,0]);
    const wings=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*.11,.055,-.13);high.add(pivot);
      const wing=create(pivot,sphere,gullMat,side*.30,.02,.10,.45,.05,.19);
      wing.rotation.y=-side*.21;
      for(let f=0;f<3;f++){
        const feather=create(pivot,sphere,f===2?gullDark:gullMat,
          side*(.38+f*.10),-.02,.22+f*.045,.17,.025,.24-f*.04);
        feather.rotation.y=side*(.14+f*.12);
      }
      create(high,new THREE.SphereGeometry(1,8,6),gullDark,side*.13,.19,-.45,.025,.028,.02);
      wings.push(pivot);
    }
    for(let k=-1;k<=1;k++)create(high,sphere,gullMat,k*.07,-.03,.43,.055,.025,.27);
    const distant=new THREE.Mesh(vgeom,gullMat);
    const g=new THREE.LOD();g.addLevel(high,0);g.addLevel(distant,155);
    g.scale.setScalar(FAUNA_SCALE.gull);root.add(g);
    birds.push({g,wings,phase:rng()*TAU,offset:rng()*TAU,alt:170+rng()*180,radius:850+rng()*700});
  }
  const dolphins=[];
  const dolphinMat=mat(0x7192a2);
  for(let i=0;i<Math.round(7*quality);i++){
    const group=new THREE.Group();
    create(group,sphere,dolphinMat,0,0,0,.56,.42,1.85);
    create(group,sphere,cream,0,-.20,-.32,.47,.21,1.20);
    create(group,sphere,dolphinMat,0,-.05,-1.76,.19,.14,.55);
    create(group,new THREE.ConeGeometry(.34,.72,9),dolphinMat,0,.57,.28,1,1,1,[0,0,-.18]);
    for(const side of [-1,1]){
      const flipper=create(group,sphere,dolphinMat,side*.52,-.22,-.22,.67,.075,.22);
      flipper.rotation.z=side*.22;flipper.rotation.y=-side*.25;
      create(group,eyeGeo,dark,side*.49,.06,-1.05,.07,.065,.06);
    }
    const tail=new THREE.Group();tail.position.z=1.2;group.add(tail);
    create(tail,sphere,dolphinMat,0,0,.30,.2,.16,.65);
    for(const side of [-1,1]){
      const fluke=create(tail,sphere,dolphinMat,side*.36,0,.65,.45,.06,.21);
      fluke.rotation.y=side*.25;
    }
    group.userData.tail=tail;
    group.scale.setScalar(FAUNA_SCALE.dolphin);
    root.add(group);
    dolphins.push({group,phase:rng()*TAU,radius:1900+rng()*470,period:11+rng()*12,offset:i});
  }
  function update(t,daylight=1,wind=0,hero=null,precipitation=0,observer=null){
    for(const g of actors){
      const s=g.userData.state;
      const cycle=(t+s.seed)/s.cycle,phase=cycle%1;
      const grazing=phase<.63,move=phase>=.63;
      const radius=s.type==='deer'?53:s.type==='fox'?98:28;
      const theta=faunaPathAngle(t,s);
      // Allocation-free trajectory evaluation; exactly anchored to spawn at t=0.
      const x=s.originX+(Math.sin(theta)-s.anchorSin)*radius;
      const z=s.originZ+(Math.cos(theta*.83)-s.anchorCos)*radius;
      const alert=hero&&Math.hypot(hero.x-x,hero.z-z)<(s.type==='deer'?135:s.type==='rabbit'?75:95);
      const enemy=s.type==='rabbit'?foxes.find(f=>Math.hypot(f.position.x-x,f.position.z-z)<90):null;
      const prey=s.type==='fox'?rabbits.find(r=>Math.hypot(r.position.x-x,r.position.z-z)<115):null;
      const sidestep=alert?Math.sin(t*2+s.seed)*7:0;
      const runX=enemy?(x-enemy.position.x)/Math.max(1,Math.hypot(x-enemy.position.x,z-enemy.position.z))*18:prey?(prey.position.x-x)*.11:0;
      const runZ=enemy?(z-enemy.position.z)/Math.max(1,Math.hypot(x-enemy.position.x,z-enemy.position.z))*18:prey?(prey.position.z-z)*.11:0;
      // Predator/prey reactions interpolate over time rather than teleporting.
      const dt=s.lastTime===null?0:clamp(t-s.lastTime,0,.15);
      s.lastTime=t;
      const response=1-Math.exp(-dt*4.2);
      s.reactionX+=(sidestep+runX-s.reactionX)*response;
      s.reactionZ+=(runZ-s.reactionZ)*response;
      const px=x+s.reactionX,pz=z+s.reactionZ;
      const vx=px-g.position.x,vz=pz-g.position.z;
      const hop=s.type==='rabbit'&&(move||alert||enemy)
        ?Math.abs(Math.sin(t*5+s.seed))*.16*clamp(t*2,0,1):0;
      g.position.set(px,terrainHeight(px,pz)+hop,pz);
      g.userData.behaviour=enemy?'flee':prey?'hunt':alert?'alert':grazing?'foraging':'travelling';
      if(vx*vx+vz*vz>.000025){
        const facing=Math.atan2(-vx,-vz);
        const angleDelta=Math.atan2(Math.sin(facing-g.rotation.y),Math.cos(facing-g.rotation.y));
        g.rotation.y+=angleDelta*(1-Math.exp(-dt*4));
      }
      const ox=observer?observer.x-px:0,oy=observer?observer.y-g.position.y:0,oz=observer?observer.z-pz:0;
      const detailDistance=observer?Math.hypot(ox,oy,oz):0;
      g.userData.motionDetailed=shouldAnimateFauna(detailDistance,s.type);
      const running=Boolean(enemy||prey||alert||move);
      const phaseStride=t*(s.type==='rabbit'?12:s.type==='fox'?7:4.4)+s.seed;
      const intensity=running?(s.type==='rabbit'?.48:.33):.045;
      if(g.userData.motionDetailed){
        for(let i=0;i<(g.userData.legs?.length||0);i++){
          const leg=g.userData.legs[i];
          const side=leg.userData.leg?.side||1,z=leg.userData.leg?.z||0;
          leg.rotation.x=Math.sin(phaseStride+(side<0?Math.PI:0)+(z>0?Math.PI:0))*intensity;
        }
        if(g.userData.ears)g.userData.ears.forEach((ear,i)=>ear.rotation.z=(i===0?-1:1)*(.18+Math.sin(t*2+s.seed)*.07));
        if(g.userData.tail)g.userData.tail.rotation.x=-.35+Math.sin(t*3.1+s.seed)*.2;
        if(g.userData.body){
          g.userData.body.scale.y=(s.type==='rabbit'?.34:s.type==='fox'?.35:.53)*(1+.014*Math.sin(t*1.25+s.seed));
        }
        if(g.userData.head)g.userData.head.rotation.x=grazing?.13+Math.sin(t*.58+s.seed)*.11:Math.sin(t*.68+s.seed)*.06;
        g.rotation.x=s.type==='deer'&&grazing?Math.sin(t*.17+s.seed)*.025:0;
      }
      g.visible=!observer||Math.hypot(observer.x-g.position.x,observer.z-g.position.z)<1050;
      // Tiny facial decorations cost draw calls but have no silhouette value at distance.
      const showDetails=!observer||detailDistance<(g.userData.detailVisible?205:160);
      if(showDetails!==g.userData.detailVisible){
        for(const mesh of g.userData.details)mesh.visible=showDetails;
        g.userData.detailVisible=showDetails;
      }
    }
    for(const b of butterflies){
      const time=t+b.seed;
      b.g.position.set(b.origin.x+Math.sin(time*.9)*.48,b.origin.y+Math.cos(time*1.3)*.24,b.origin.z+Math.cos(time*.85)*.42);
      b.g.rotation.y=time*.6;
      b.left.rotation.z=Math.sin(time*12)*.9;
      b.right.rotation.z=-Math.sin(time*12)*.9;
      b.g.visible=daylight>.18&&precipitation<.45;
    }
    for(const b of birds){
      const time=t*.12+b.phase,theta=time+b.offset;
      b.g.position.set(Math.sin(theta)*b.radius,b.alt+Math.sin(time*1.4)*22,Math.cos(theta)*b.radius*.78);
      b.g.rotation.set(Math.sin(time*1.8)*.08,theta+.7,Math.cos(time*.6)*.19);
      const flap=Math.sin(t*3.8+b.phase)*.15;
      b.wings[0].rotation.z=-flap;
      b.wings[1].rotation.z=flap;
    }
    for(const d of dolphins){
      const theta=t*.028+d.phase, pulse=(t+d.offset*3.1)%d.period;
      const breach=pulse<2.5?Math.pow(Math.sin(pulse/2.5*Math.PI),2)*35:0;
      d.group.position.set(Math.sin(theta)*d.radius,-11+breach,Math.cos(theta)*d.radius*.94);
      d.group.rotation.set(pulse<2.5?Math.cos(pulse/2.5*Math.PI)*.8:0,theta,Math.sin(t*1.6+d.offset)*.09);
      d.group.userData.tail.rotation.x=Math.sin(t*4.6+d.offset)*.24;
    }
  }
  function focus(t){
    const slot=Math.floor(t/34)%4;
    if(slot===0){const a=actors.find(g=>g.userData.state.type==='deer');return {point:a.position.clone().add(new THREE.Vector3(0,1.2,0)),kind:'meadow'};}
    if(slot===1){const a=dolphins[0].group;return {point:a.position.clone().add(new THREE.Vector3(0,.4,0)),kind:'ocean'};}
    if(slot===2){const a=actors.find(g=>g.userData.state.type==='fox');return {point:a.position.clone().add(new THREE.Vector3(0,.45,0)),kind:'forest'};}
    return {point:butterflies[0]?.g.position.clone()||new THREE.Vector3(0,150,0),kind:'flowers'};
  }
  return {root,actors,birds,dolphins,butterflies,flowers,update,focus,
    get lodStats(){return {prototypes:faunaLOD.prototypes,farDrawCalls:faunaLOD.farDrawCalls,
      nearAnimated:actors.filter(g=>g.userData.motionDetailed).length,totalActors:actors.length};},
    stats:{deer:actors.filter(a=>a.userData.state.type==='deer').length,fox:actors.filter(a=>a.userData.state.type==='fox').length,rabbits:actors.filter(a=>a.userData.state.type==='rabbit').length,gulls:birds.length,dolphins:dolphins.length,butterflies:butterflies.length}};
}
