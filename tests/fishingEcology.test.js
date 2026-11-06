import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS,random} from '../src/core.js';
import {resourcePoint,foodType,aquaticForageScore,habitatAt} from '../src/ecology.js';
import {createBirdBrain} from '../src/behaviour.js';
const profile=id=>BIRDS.find(b=>b.id===id);
const waterBySpecies={
  kingfisher:['wetland','shore'],heron:['wetland','shore'],
  osprey:['wetland','shore','ocean'],gull:['wetland','shore','ocean'],
  albatross:['shore','ocean']
};

test('fish are available only at suitable real water bodies for each species',()=>{
  for(const seed of [1988,20261106,4721]){
    for(const [id,types] of Object.entries(waterBySpecies)){
      const bird=profile(id);
      assert.equal(foodType(bird),'fish');
      for(const [x,z] of [[0,0],[1100,750],[3600,-400]]){
        const site=resourcePoint(bird,x,z,random(seed^id.length),seed);
        assert.equal(site.kind,'fish');
        assert.equal(site.unavailable,undefined,
          'water foraging site unavailable for '+id+' seed '+seed);
        assert.ok(types.includes(site.biome),
          id+' must not fish in '+site.biome+' (seed '+seed+')');
        assert.ok(aquaticForageScore(bird,habitatAt(site.x,site.z,seed))>0);
        assert.ok(Number.isFinite(site.x)&&Number.isFinite(site.y)&&Number.isFinite(site.z));
      }
    }
  }
});

test('forest and mountains never invent fish targets',()=>{
  for(const id of Object.keys(waterBySpecies)){
    const bird=profile(id);
    for(const type of ['forest','meadow','highland','rock'])
      assert.equal(aquaticForageScore(bird,{type}),0,
        id+' should not forage in '+type);
  }
});

test('water foraging remains airborne instead of landing on the riverbed',()=>{
  for(const id of ['kingfisher','osprey','gull','heron']){
    const brain=createBirdBrain(profile(id),1988);
    let sawFeeding=false;
    for(let n=0;n<7200;n++){
      const t=n*.1;
      const act=brain.update(t,.1,.9,0);
      if(act.state==='feed'&&act.food==='fish'){
        sawFeeding=true;
        assert.equal(act.grounded,false,id+' should not stand on water/riverbed');
        assert.equal(act.wingsFolded,false,id+' should keep wings unfolded while fishing');
        assert.ok(waterBySpecies[id].includes(act.feedingHabitat),
          'fish must be associated with actual water habitat');
        break;
      }
    }
    assert.ok(sawFeeding,id+' never found fishing grounds within 12 simulated minutes');
  }
});
