import { clamp } from './core.js';
import { birdRigScale } from './worldScale.js';
import { batchStaticMeshes } from './meshBatch.js';
import { birdPlumage } from './speciesAppearance.js';

// Species-dependent wing planform; span remains calibrated by birdRigScale.
// Detailed surfaces are reserved for the camera-followed protagonist.
export function wingPlanform(profile) {
  const flight=profile.flight;
  const slender=flight==='marine'&&profile.id==='albatross';
  const pointed=flight==='dash'||profile.id==='hummingbird';
  return {
    chord:slender?.42:pointed?.48:flight==='nocturnal'?.91:.77,
    sweep:pointed?.40:slender?.20:.12,
    slots:flight==='soar'?(profile.id==='vulture'?7:5):pointed?2:4,
    primaries:slender?6:pointed?7:9
  };
}

export function createWingSurfaceGeometry(THREE,wings,plan) {
  const positions=[],uvs=[],indices=[];
  const spanSegments=18,chordSegments=4;
  for(let i=0;i<=spanSegments;i++){
    const t=i/spanSegments,x=2.155*wings*t;
    const taper=Math.pow(Math.max(.025,1-t),.57);
    const chord=plan.chord*taper*(.78+.22*Math.sin(t*Math.PI));
    const mid=-.08+plan.sweep*t*t;
    for(let j=0;j<=chordSegments;j++){
      const u=j/chordSegments;
      const z=mid+(u-.40)*chord;
      const camber=.075*Math.sin(u*Math.PI)*Math.sin(Math.PI*t)+.055*Math.sin(t*Math.PI);
      positions.push(x,camber,z);
      uvs.push(t,u);
      if(i<spanSegments&&j<chordSegments){
        const q=i*(chordSegments+1)+j;
        indices.push(q,q+chordSegments+1,q+1,q+1,q+chordSegments+1,q+chordSegments+2);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

// Feather points down +Z; convex central ridge and tapered leading/trailing edges.
export function createContourFeatherGeometry(THREE) {
  const points=[],uvs=[],indices=[];
  const lengthSegments=9;
  for(let j=0;j<=lengthSegments;j++){
    const t=j/lengthSegments;
    const width=Math.pow(Math.max(0,Math.sin(t*Math.PI)),.66)*.5;
    for(const u of [-1,0,1]){
      points.push(width*u,.045*(1-u*u)*Math.sin(t*Math.PI),t);
      uvs.push((u+1)*.5,t);
    }
    if(j<lengthSegments){
      const k=j*3;
      indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createBirdRig(THREE,profile) {
  const root=new THREE.Group();
  const colors=birdPlumage(profile.id);
  const material=(color,roughness=.93)=>new THREE.MeshStandardMaterial({
    color,roughness,metalness:0,flatShading:false,side:THREE.DoubleSide
  });
  const plumage=material(profile.color);
  const dark=material(colors.tip);
  const light=material(colors.chest);
  const wingMat=material(colors.wing);
  const crown=material(colors.crown);
  const iris=material(colors.iris,.58);
  const mask=colors.mask?material(colors.mask):null;
  const throat=colors.throat?material(colors.throat):null;
  const bill=material(colors.bill,.8);
  const eyes=material(0x171613,.3);
  const sph=new THREE.SphereGeometry(1,22,14);
  const feather=createContourFeatherGeometry(THREE);
  const cylinder=new THREE.CylinderGeometry(.055,.08,.58,9);
  const legs=[];
  const add=(geo,mat,parent,xyz,scl,rot)=>{
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...xyz);
    if(scl)mesh.scale.set(...scl);
    if(rot)mesh.rotation.set(...rot);
    parent.add(mesh);return mesh;
  };
  const isHeron=profile.id==='heron',isHumming=profile.id==='hummingbird';
  const isOwl=profile.id==='owl',isVulture=profile.id==='vulture';
  const longTail=profile.id==='swallow'||profile.id==='swift';
  const compact=isHumming||profile.id==='kingfisher';
  const neck=isHeron?1.20:.43;
  add(sph,plumage,root,[0,0,.10],[compact?.36:.43,.37,isHeron?1.20:1.10]);
  add(sph,light,root,[0,.09,-.59],[.34,.27,.57]);
  if(isHeron){
    add(sph,plumage,root,[0,.35,-.93],[.20,.48,.22],[-.37,0,0]);
    add(sph,light,root,[0,.55,-1.11],[.15,.34,.17],[-.35,0,0]);
  }
  const headY=isHeron?.71:.22;
  const headZ=isHeron?-1.20:-1.04;
  add(sph,crown,root,[0,headY,headZ],[isOwl?.39:.30,isOwl?.36:.28,.34]);
  if(isOwl){
    for(const side of [-1,1]){
      add(sph,light,root,[side*.18,headY+.04,headZ-.23],[.20,.23,.08]);
      const tuft=add(new THREE.ConeGeometry(.12,.40,9),plumage,root,
        [side*.31,headY+.34,headZ-.02],[1,1,1],[0,0,-side*.23]);
      tuft.rotation.z=-side*.23;
    }
  }
  if(isVulture)for(let k=0;k<12;k++){
    const a=k/12*Math.PI*2;
    add(sph,light,root,[Math.sin(a)*.32,.16+Math.cos(a)*.19,-.73],
      [.13,.12,.21],[0,a,0]);
  }
  const billLength=isHumming?.98:isHeron?.83:profile.id==='albatross'?.64:.34;
  add(new THREE.ConeGeometry(isHumming?.055:.12,billLength,10),bill,root,
    [0,headY-.025,headZ-.28-billLength*.38],[1,1,1],[-Math.PI/2,0,0]);
  if(throat){
    add(sph,throat,root,[0,headY-.17,headZ-.22],[.19,.17,.135]);
  }
  for(const side of [-1,1]){
    const ex=side*(isOwl?.205:.245),ey=headY+.095;
    if(mask)add(sph,mask,root,[side*(isOwl?.275:.27),headY+.035,headZ-.13],
      [.08,.14,.17]);
    add(sph,iris,root,[ex,ey,headZ-.19],
      [isOwl?.125:.085,isOwl?.13:.087,.053]);
    add(sph,eyes,root,[ex,ey,headZ-.23],
      [isOwl?.066:.052,isOwl?.073:.052,.048]);
    if(profile.id!=='swift'&&profile.id!=='swallow'){
      const leg=add(cylinder,bill,root,[side*.22,-.48,.32],[1,isHeron?1.85:.90,1],[.2,0,0]);
      leg.userData.restScaleY=isHeron?1.85:.90;
      legs.push(leg);
      for(let toe=-1;toe<=1;toe++)add(sph,bill,leg,[toe*.11,-.50,-.13],
        [.085,.05,.18]); // parented so feet articulate with the leg
    }
  }

  const plan=wingPlanform(profile),wingGeo=createWingSurfaceGeometry(THREE,profile.wings,plan);
  function wing(side) {
    const pivot=new THREE.Group();pivot.position.set(side*.29,.12,-.07);root.add(pivot);
    const base=new THREE.Group();base.scale.x=side;pivot.add(base);
    add(wingGeo,wingMat,base,[0,0,0]);
    // Rounded leading-edge bones and covert rows define wing thickness and curvature.
    add(sph,plumage,base,[.57*profile.wings,.035,-.10],
      [.63*profile.wings,.09,.19],[0,-.08,0]);
    for(let row=0;row<2;row++)for(let j=0;j<12;j++){
      const t=(j+.35)/12,span=(.19+t*1.57)*profile.wings;
      const taper=Math.pow(1-t*.83,.55);
      const chord=plan.chord*taper;
      const f=add(feather,row===0?plumage:(j%3===0?light:dark),base,
        [span,-.015-row*.013,plan.sweep*t*t+.13+row*.11],
        [.20*profile.wings*taper,.065,.30+chord*.50],
        [0,.10+t*.20,0]);
      f.rotation.y=.10+t*.20;
    }
    const tip=new THREE.Group();tip.position.set(1.35*profile.wings,.03,-.03);base.add(tip);
    for(let j=0;j<plan.primaries;j++){
      const t=j/Math.max(1,plan.primaries-1);
      const x=(.18+t*.54)*profile.wings;
      const f=add(feather,j%2?dark:wingMat,tip,[x,-.025,.08+(t-.5)*.15],
        [.19*profile.wings,.08,.35-t*.14],[0,-.12+t*.42,0]);
      f.rotation.y=-.12+t*.42;
    }
    // A feather slot is a small extra tip projection, not a separate wing mesh.
    for(let j=0;j<plan.slots;j++){
      const t=j/Math.max(1,plan.slots-1);
      add(feather,dark,tip,[.46*profile.wings+t*.18*profile.wings,-.02,.14+t*.08],
        [.12*profile.wings,.04,.21],[0,.35+t*.20,0]);
    }
    const baseBatch=batchStaticMeshes(THREE,base);
    const tipBatch=batchStaticMeshes(THREE,tip);
    return {pivot,tip,drawCallsSaved:baseBatch.drawCallsSaved+tipBatch.drawCallsSaved};
  }
  const left=wing(-1),right=wing(1);
  const tail=new THREE.Group();tail.position.set(0,-.07,.92);root.add(tail);
  for(let i=-3;i<=3;i++){
    const fork=longTail&&Math.abs(i)>=2?.63:0;
    add(feather,i%2?plumage:dark,tail,[i*.105,-.03,.12],
      [.21,.09,.78+fork],[0,i*.08,0]);
  }
  if(profile.id==='kingfisher')add(sph,material(0x0d8fa6),root,[0,.20,.24],[.29,.22,.63]);
  if(profile.id==='swallow')add(sph,material(0x9a493c),root,[0,-.15,-.59],[.24,.12,.30]);
  root.scale.setScalar(birdRigScale(profile));
  root.userData={profile,left,right,tail,legs,fold:0,flap:0,headTurn:0,geometryVersion:3,
    plumageDrawCallsSaved:left.drawCallsSaved+right.drawCallsSaved};
  return root;
}

export function animateBirdRig(group,elapsed,activity,dt=1/60){
  const {profile,left,right,tail,legs}=group.userData,flight=profile.flight;
  const grounded=Boolean(activity.grounded),foldWanted=activity.sleeping||grounded?1:0;
  const k=1-Math.exp(-Math.max(0,Math.min(.12,dt))*9);
  group.userData.fold+=(foldWanted-group.userData.fold)*k;
  const fold=group.userData.fold,rate=profile.flapRate??3.8;
  const energy=clamp(activity.energy??.5,0,1);
  const power=flight==='hover'?.37:flight==='dash'?.28:flight==='nocturnal'?.19:.12;
  const soar=flight==='soar'||flight==='marine';
  const flyCycle=Math.sin(elapsed*rate+profile.id.length*.73);
  const pulse=soar?Math.pow(Math.max(0,Math.sin(elapsed*.55)),4):1;
  const targetFlap=flyCycle*(power+energy*.10)*pulse;
  group.userData.flap+=(targetFlap-group.userData.flap)*(.3+.5*k);
  const wingbeat=group.userData.flap*(1-fold);
  const bank=clamp(activity.bank??0,-.65,.65);
  left.pivot.rotation.z=-(fold*.81+wingbeat+bank*.085);
  right.pivot.rotation.z=fold*.81+wingbeat-bank*.085;
  left.pivot.rotation.y=-fold*.61+Math.cos(elapsed*.53)*.02*(1-fold);
  right.pivot.rotation.y=fold*.61-Math.cos(elapsed*.53)*.02*(1-fold);
  left.pivot.rotation.x=-.025-Math.sin(elapsed*.81)*.05*(1-fold);
  right.pivot.rotation.x=-.025+Math.sin(elapsed*.81)*.05*(1-fold);
  const tipFlex=Math.sin(elapsed*rate-.52)*.11*(1-fold);
  left.tip.rotation.z=-tipFlex;right.tip.rotation.z=tipFlex;
  tail.rotation.y=Math.sin(elapsed*.55)*.045+bank*.21;
  tail.rotation.x=fold?-.13:Math.sin(elapsed*.95)*.052;
  tail.scale.x=1+(activity.state==='landing'?.23:.07)*Math.abs(bank);
  const legsOut=grounded||activity.state==='landing'||activity.state==='approach';
  for(const leg of legs){
    const legTarget=legsOut?.18:-1.12;
    leg.rotation.x+=(legTarget-leg.rotation.x)*k;
    leg.scale.y+=((legsOut?leg.userData.restScaleY:leg.userData.restScaleY*.18)-leg.scale.y)*k;
    leg.position.y+=((legsOut?-.48:-.30)-leg.position.y)*k;
  }
  group.rotation.z=bank;
  group.rotation.x=grounded?0:clamp(activity.pitch??0,-.34,.34);
}
