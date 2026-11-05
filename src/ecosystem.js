import { random,terrainHeight,TAU,clamp } from './core.js';

// Small-scale ecosystems driven by behaviour states, not arbitrary mesh motion.
export function createEcosystem(THREE,scene,seed=1988,quality=1){
  const rng=random(seed^0x5ade9);
  const root=new THREE.Group();scene.add(root);
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
  const brown=mat(0xb18e64),cream=mat(0xe1cbb0),dark=mat(0x49483b),foxCoat=mat(0xc7794b),white=mat(0xf4debd),grass=mat(0x719b6c),flowerColors=[mat(0xe0af72),mat(0xcf849b),mat(0xe5d4ad),mat(0xb3aed8)];
  const sphere=new THREE.SphereGeometry(1,8,6),legGeo=new THREE.CylinderGeometry(.1,.12,1,6),antlerGeo=new THREE.CylinderGeometry(.033,.045,1,5);
  const create=(parent,geo,m,x,y,z,sx=1,sy=1,sz=1)=>{
    const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  };
  const actors=[];
  function habitatPos(maxRadius,minElevation=22,maxElevation=250){
    for(let i=0;i<100;i++){
      const x=(rng()-.5)*maxRadius*2,z=(rng()-.5)*maxRadius*2;
      const y=terrainHeight(x,z,seed);if(y>=minElevation&&y<=maxElevation)return [x,y,z];
    }
    return [250,terrainHeight(250,80,seed),80];
  }
  function deer(){
    const group=new THREE.Group();
    create(group,sphere,brown,0,1.5,0,.52,.53,1.08);
    create(group,sphere,cream,0,1.6,-.77,.33,.55,.46);
    create(group,sphere,brown,0,2.14,-.91,.30,.31,.38);
    create(group,sphere,dark,0,2.16,-1.24,.16,.14,.21);
    for(const side of [-1,1]){
      create(group,sphere,brown,side*.28,2.38,-.82,.22,.13,.28);
      for(const z of [-.63,.7]){
        const leg=create(group,legGeo,brown,side*.3,.68,z,.75,1.22,.75);leg.userData.leg={side,z};
      }
      if(rng()>.32){
        const antler=create(group,antlerGeo,cream,side*.22,2.73,-1.0,.85,.69,.85);
        antler.rotation.z=-side*.26;
      }
    }
    group.scale.setScalar(5.0);
    return group;
  }
  function fox(){
    const g=new THREE.Group();
    create(g,sphere,foxCoat,0,.65,0,.35,.35,.86);
    create(g,sphere,foxCoat,0,.79,-.67,.34,.34,.40);
    create(g,new THREE.ConeGeometry(.21,.46,6),white,0,.6,-1.06,.75,.65,1,[Math.PI/2,0,0]);
    for(const side of [-1,1]){
      const ear=create(g,new THREE.ConeGeometry(.16,.38,5),foxCoat,side*.25,1.15,-.82);
      ear.rotation.x=-.15;
      for(const z of [-.52,.57])create(g,legGeo,dark,side*.25,.24,z,.54,.44,.54);
    }
    const tail=create(g,sphere,foxCoat,0,.65,.90,.26,.27,.82);
    tail.rotation.x=-.35;g.userData.tail=tail;g.scale.setScalar(4.8);
    return g;
  }
  function rabbit(){
    const g=new THREE.Group();
    create(g,sphere,cream,0,.36,0,.35,.34,.51);
    create(g,sphere,brown,0,.54,-.43,.28,.28,.30);
    for(const side of [-1,1]){
      const ear=create(g,sphere,cream,side*.14,1.02,-.43,.105,.45,.16);
      ear.rotation.z=side*.18;
    }
    g.scale.setScalar(3.1);return g;
  }
  function addActor(type,count,range){
    for(let i=0;i<count;i++){
      const g=type==='deer'?deer():type==='fox'?fox():rabbit();
      const [x,y,z]=habitatPos(range,type==='rabbit'?13:28,type==='fox'?235:180);
      g.position.set(x,y,z);g.rotation.y=rng()*TAU;
      g.userData.state={type,originX:x,originZ:z,seed:rng()*100,phase:rng()*TAU,speed:type==='fox'?.8:type==='rabbit'?.6:.24,cycle:13+rng()*19};
      root.add(g);actors.push(g);
    }
  }
  addActor('deer',Math.round(8*quality),950);
  addActor('fox',Math.round(4*quality),1050);
  addActor('rabbit',Math.round(12*quality),900);
  const flowers=[];
  const flowerGeo=new THREE.IcosahedronGeometry(1,0);
  const count=Math.round(750*quality);
  const blossom=new THREE.InstancedMesh(flowerGeo,flowerColors[1],count);
  blossom.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy=new THREE.Object3D();let flowerCount=0;
  for(let i=0;i<count*6&&flowerCount<count;i++){
    const [x,y,z]=habitatPos(1200,15,138);
    dummy.position.set(x,y+2.6,z);dummy.rotation.set(rng()*TAU,rng()*TAU,rng()*TAU);
    const s=.95+rng()*1.4;dummy.scale.set(s,s*.47,s);dummy.updateMatrix();
    blossom.setMatrixAt(flowerCount,dummy.matrix);
    blossom.setColorAt(flowerCount, new THREE.Color([0xd3a0a9,0xdad490,0xa6bfa2,0xccbad1][Math.floor(rng()*4)]));
    flowers.push(new THREE.Vector3(x,y+3,z));flowerCount++;
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
    g.position.copy(flower);g.position.y+=3+rng()*7;
    g.scale.setScalar(2.0);
    root.add(g);
    butterflies.push({g,left,right,origin:g.position.clone(),seed:rng()*100});
  }
  const birds=[];
  const vgeom=new THREE.BufferGeometry();
  vgeom.setAttribute('position',new THREE.Float32BufferAttribute([-.6,0,0,0,.14,.18,0,.14,.18,.6,0,0,0,.14,.18,0,.05,-.25],3));
  vgeom.computeVertexNormals();
  const gullMat=new THREE.MeshStandardMaterial({color:0xe4e5d9,side:THREE.DoubleSide,roughness:.87});
  for(let i=0;i<Math.round(22*quality);i++){
    const g=new THREE.Mesh(vgeom,gullMat);
    g.scale.setScalar(8);root.add(g);
    birds.push({g,phase:rng()*TAU,offset:rng()*TAU,alt:170+rng()*180,radius:850+rng()*700});
  }
  const dolphins=[];
  const dolphinMat=mat(0x7192a2);
  for(let i=0;i<Math.round(7*quality);i++){
    const group=new THREE.Group();
    create(group,sphere,dolphinMat,0,0,0,.56,.42,1.85);
    create(group,new THREE.ConeGeometry(.34,.7,5),dolphinMat,0,.48,.32,1,1,1,[0,0,Math.PI]);
    create(group,sphere,dolphinMat,0,0,-1.55,.25,.24,.71);
    group.scale.setScalar(7);
    root.add(group);
    dolphins.push({group,phase:rng()*TAU,radius:1900+rng()*470,period:11+rng()*12,offset:i});
  }
  function update(t,daylight=1,wind=0){
    for(const g of actors){
      const s=g.userData.state;
      const cycle=(t+s.seed)/s.cycle,phase=cycle%1;
      const grazing=phase<.63,move=phase>=.63;
      const radius=s.type==='deer'?53:s.type==='fox'?98:28;
      const theta=(Math.floor(cycle)*.88+s.phase)+(move?(phase-.63)/.37*.62:0);
      const x=s.originX+Math.sin(theta)*radius;
      const z=s.originZ+Math.cos(theta*.83)*radius;
      const y=terrainHeight(x,z,seed);
      g.position.set(x,y+(s.type==='rabbit'&&move?Math.abs(Math.sin(t*4+s.seed))*3.6:0),z);
      g.rotation.y=-theta+.1*Math.sin(t*.25+s.seed);
      if(g.userData.tail)g.userData.tail.rotation.x=-.35+Math.sin(t*3.1+s.seed)*.2;
      g.rotation.x=grazing&&s.type==='deer'?Math.sin(t*.17+s.seed)*.08:0;
      g.visible=daylight>.08||s.type==='fox';
    }
    for(const b of butterflies){
      const time=t+b.seed;
      b.g.position.set(b.origin.x+Math.sin(time*.9)*15,b.origin.y+Math.cos(time*1.3)*5,b.origin.z+Math.cos(time*.85)*12);
      b.g.rotation.y=time*.6;
      b.left.rotation.z=Math.sin(time*12)*.9;
      b.right.rotation.z=-Math.sin(time*12)*.9;
      b.g.visible=daylight>.18;
    }
    for(const b of birds){
      const time=t*.12+b.phase,theta=time+b.offset;
      b.g.position.set(Math.sin(theta)*b.radius,b.alt+Math.sin(time*1.4)*22,Math.cos(theta)*b.radius*.78);
      b.g.rotation.set(Math.sin(time*1.8)*.08,theta+.7,Math.cos(time*.6)*.19);
    }
    for(const d of dolphins){
      const theta=t*.028+d.phase, pulse=(t+d.offset*3.1)%d.period;
      const breach=pulse<2.5?Math.pow(Math.sin(pulse/2.5*Math.PI),2)*35:0;
      d.group.position.set(Math.sin(theta)*d.radius,-11+breach,Math.cos(theta)*d.radius*.94);
      d.group.rotation.set(pulse<2.5?Math.cos(pulse/2.5*Math.PI)*.8:0,theta,0);
    }
  }
  function focus(t){
    const slot=Math.floor(t/34)%4;
    if(slot===0){const a=actors.find(g=>g.userData.state.type==='deer');return {point:a.position.clone().add(new THREE.Vector3(0,8,0)),kind:'meadow'};}
    if(slot===1){const a=dolphins[0].group;return {point:a.position.clone().add(new THREE.Vector3(0,10,0)),kind:'ocean'};}
    if(slot===2){const a=actors.find(g=>g.userData.state.type==='fox');return {point:a.position.clone().add(new THREE.Vector3(0,7,0)),kind:'forest'};}
    return {point:butterflies[0]?.g.position.clone()||new THREE.Vector3(0,150,0),kind:'flowers'};
  }
  return {root,actors,birds,dolphins,butterflies,flowers,update,focus,
    stats:{deer:actors.filter(a=>a.userData.state.type==='deer').length,fox:actors.filter(a=>a.userData.state.type==='fox').length,rabbits:actors.filter(a=>a.userData.state.type==='rabbit').length,gulls:birds.length,dolphins:dolphins.length,butterflies:butterflies.length}};
}
