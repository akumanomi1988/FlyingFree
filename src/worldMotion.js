// Shared, allocation-free wind field for all instanced foliage.
// The vertex shader bends the crown / blades, preserving the scene's draw-call budget.
export function createWindField(){
 const time={value:0},force={value:.35};
 const materials=[];
 function apply(material,{amplitude=.3,height=4,frequency=.8}={}){
  const strength=Number(amplitude.toFixed(4)),h=Math.max(.1,Number(height.toFixed(3))),f=Number(frequency.toFixed(4));
  const before=material.onBeforeCompile?.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   if(before)before(shader,renderer);
   shader.uniforms.uWorldWindTime=time;
   shader.uniforms.uWorldWindForce=force;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float uWorldWindTime;
uniform float uWorldWindForce;`);
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 forestOrigin=instanceMatrix[3].xyz;
#else
  vec3 forestOrigin=vec3(0.0);
#endif
float windTip=smoothstep(-${(h*.5).toFixed(3)},${(h*.5).toFixed(3)},position.y);
float windPhase=uWorldWindTime*${f.toFixed(4)}+forestOrigin.x*.031+forestOrigin.z*.023;
float windPulse=.72+.28*sin(windPhase*.38+forestOrigin.z*.007);
float windWave=sin(windPhase)*.75+sin(windPhase*1.77+forestOrigin.x*.014)*.25;
transformed.x+=windWave*windTip*windTip*${strength.toFixed(4)}*uWorldWindForce*windPulse;
transformed.z+=cos(windPhase*.79)*windTip*windTip*${(strength*.6).toFixed(4)}*uWorldWindForce;`);
  };
  material.customProgramCacheKey=()=>`world-wind-${strength}-${h}-${f}-2`;
  materials.push(material);
  return material;
 }
 function update(t,weather){
  time.value=t;
  // Small motion in clear weather; stronger gusts during rain/storms.
  const target=.25+(weather?.cloud??0)*.55+(weather?.rain??0)*.95;
  force.value+=(Math.min(2,target)-force.value)*.09;
 }
 return {apply,update,get strength(){return force.value},get materials(){return materials.length}};
}
