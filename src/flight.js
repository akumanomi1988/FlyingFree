import { clamp, TAU } from './core.js';

// A deformable, feathered silhouette: all geometry originates in WebGL.
export function createBirdRig(THREE, profile) {
  const group=new THREE.Group();
  const featherColor=new THREE.Color(profile.color);
  const shadowColor=featherColor.clone().multiplyScalar(.84);
  const highlight=featherColor.clone().lerp(new THREE.Color('#e5dec3'),.10);
  const plumage=new THREE.MeshStandardMaterial({color:featherColor,roughness:.94,metalness:0,flatShading:false,side:THREE.DoubleSide});
  const secondary=new THREE.MeshStandardMaterial({color:shadowColor,roughness:1,side:THREE.DoubleSide});
  const pale=new THREE.MeshStandardMaterial({color:highlight,roughness:.94,side:THREE.DoubleSide});
  const bill=new THREE.MeshStandardMaterial({color:profile.id==='heron'||profile.id==='kingfisher'?0xd4a85e:0x514a37,roughness:.75});
  const eyeMat=new THREE.MeshBasicMaterial({color:0x141816});
  const add=(geo,mat,parent,position,scale,rotation)=>{
    const m=new THREE.Mesh(geo,mat); if(position)m.position.set(...position);if(scale)m.scale.set(...scale);
    if(rotation)m.rotation.set(...rotation);parent.add(m);return m;
  };
  const sph=new THREE.SphereGeometry(1,14,10),legs=[];
  const isLong=profile.id==='heron', isHumming=profile.id==='hummingbird', isOwl=profile.id==='owl';
  const neck=isLong?1.38:.54;
  add(sph,plumage,group,[0,0,.1],[.42,.37,isLong?1.28:1.12]);
  add(sph,pale,group,[0,.12,-.63],[.33,.29,.57]);
  add(sph,plumage,group,[0,.1+neck*.24,-.87-neck*.15],[isOwl?.41:.31,.30,isLong?.55:.36]);
  const faceZ=-1.1-neck*.16;
  if(isOwl){
    add(sph,pale,group,[-.21,.27,faceZ],[.26,.22,.12]);
    add(sph,pale,group,[ .21,.27,faceZ],[.26,.22,.12]);
  }
  const beakLength=isHumming?1.02:isLong?.9:profile.id==='albatross'?.72:.44;
  add(new THREE.ConeGeometry(isHumming?.07:.12,beakLength,7),bill,group,
    [0,.13+neck*.24,faceZ-beakLength*.52],[1,1,1],[-Math.PI/2,0,0]);
  for(const side of [-1,1]){
    add(sph,eyeMat,group,[side*(isOwl?.25:.23),.27+neck*.24,faceZ-.12],[isOwl?.10:.061,isOwl?.1:.066,.047]);
    if(!isHumming&&profile.id!=='swift'&&profile.id!=='swallow'){
      const leg=add(new THREE.CylinderGeometry(.045,.062,.54,6),bill,group,[side*.23,-.51,.32],[1,1,1],[.2,0,0]);
      leg.userData.leg=true;legs.push(leg);
    }
  }
  const ws=profile.wings;
  function wing(side){
    const pivot=new THREE.Group();pivot.position.set(side*.29,.12,-.07);group.add(pivot);
    const base=new THREE.Group();base.scale.x=side;pivot.add(base);
    const verts=[
      0,0,-.3, .55*ws,.05,-.55, 1.28*ws,.13,-.38,
      0,0,-.3, 1.28*ws,.13,-.38, 2.05*ws,.04,-.02,
      0,0,-.3, 2.05*ws,.04,-.02, 1.82*ws,-.07,.58,
      0,0,-.3, 1.82*ws,-.07,.58, .83*ws,-.04,.76,
      0,0,-.3, .83*ws,-.04,.76, 0,-.02,.35
    ];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();
    const surface=new THREE.Mesh(g,plumage);base.add(surface);
    for(let j=0;j<8;j++){
      const ratio=.42+j*.20;
      const feath=add(sph,j%3?secondary:pale,base,[ratio*ws,-.06,.22+j*.015],
        [.12*ws,.04,.42-j*.019],[0,-.04,Math.sin(j*.55)*.06]);
      feath.rotation.y=.1+j*.018;
    }
    const tip=new THREE.Group();tip.position.set(1.34*ws,.06,-.07);base.add(tip);
    for(let j=0;j<5;j++){
      const fan=add(sph,secondary,tip,[(j+1)*.135*ws,-.035,(j-2)*.125],
        [.25*ws,.04,.145], [0,-.12,(j-2)*.075]);
      fan.rotation.y=(j-2)*.11;
    }
    return {pivot,tip};
  }
  const left=wing(-1),right=wing(1);
  const tail=new THREE.Group();tail.position.set(0,-.08,1.01);group.add(tail);
  for(let i=-2;i<=2;i++){
    add(sph,i%2?plumage:secondary,tail,[i*.155,-.02,.32],[.13,.045,.68],[0,i*.09,0]);
  }
  if(profile.id==='kingfisher')add(sph,new THREE.MeshStandardMaterial({color:0x0c8295}),group,[0,.15,.2],[.22,.20,.65]);
  const size=profile.visualScale??(isHumming?4:profile.id==='albatross'?13:10);
  group.scale.setScalar(size);
  group.userData={profile,left,right,tail,legs,fold:0,flap:0,headTurn:0};
  return group;
}

export function animateBirdRig(group,elapsed,activity,dt=1/60){
 const {profile,left,right,tail,legs}=group.userData;
 const flight=profile.flight;
 const grounded=Boolean(activity.grounded),foldWanted=activity.sleeping||grounded?1:0;
 const k=1-Math.exp(-Math.max(0,Math.min(.12,dt))*9);
 group.userData.fold+=(foldWanted-group.userData.fold)*k;
 const fold=group.userData.fold;
 const rate=profile.flapRate??3.8;
 const energy=clamp(activity.energy??.5,0,1);
 const power=flight==='hover'?.37:flight==='dash'?.28:flight==='nocturnal'?.19:.12;
 // Gliders flap in short periods; hummingbirds maintain near-continuous wingbeats.
 const soar=flight==='soar'||flight==='marine';
 const flyCycle=Math.sin(elapsed*rate+profile.id.length*.73);
 const pulse=soar?Math.pow(Math.max(0,Math.sin(elapsed*.55)),4):1;
 const targetFlap=flyCycle*(power+energy*.10)*pulse;
 group.userData.flap+=(targetFlap-group.userData.flap)*(.3+.5*k);
 const wingbeat=group.userData.flap*(1-fold);
 const bank=clamp(activity.bank??0,-.65,.65);
 const leftFold=fold*.81,rightFold=fold*.81;
 left.pivot.rotation.z=-(leftFold+wingbeat+bank*.085);
 right.pivot.rotation.z=rightFold+wingbeat-bank*.085;
 left.pivot.rotation.y=-fold*.61+Math.cos(elapsed*.53)*.02*(1-fold);
 right.pivot.rotation.y=fold*.61-Math.cos(elapsed*.53)*.02*(1-fold);
 left.pivot.rotation.x=-.025-Math.sin(elapsed*.81)*.05*(1-fold);
 right.pivot.rotation.x=-.025+Math.sin(elapsed*.81)*.05*(1-fold);
 const tipFlex=Math.sin(elapsed*rate-.52)*.11*(1-fold);
 left.tip.rotation.z=-tipFlex;
 right.tip.rotation.z=tipFlex;
 // Tail feathers steer on turns and fan during final approach.
 tail.rotation.y=Math.sin(elapsed*.55)*.045+bank*.21;
 tail.rotation.x=fold?-.13:Math.sin(elapsed*.95)*.052;
 tail.scale.x=1+(activity.state==='landing'?.23:.07)*Math.abs(bank);
 const legsOut=grounded||activity.state==='landing'||activity.state==='approach';
 for(let i=0;i<legs.length;i++){
   const leg=legs[i];
   const legTarget=legsOut?.18:-1.12;
   leg.rotation.x+=(legTarget-leg.rotation.x)*k;
   const legLength=legsOut?1:.18;
   leg.scale.y+=(legLength-leg.scale.y)*k;
   const legHeight=legsOut?-.51:-.30;
   leg.position.y+=(legHeight-leg.position.y)*k;
 }
 group.rotation.z=bank;
 group.rotation.x=grounded?0:clamp(activity.pitch??0,-.34,.34);
}