import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for(const name of ['capture-birds.mjs','audit-habitats.mjs','write-build-info.mjs']){
 test('quality tool '+name+' parses as Node ESM',()=>{
   const url=new URL('../scripts/'+name,import.meta.url);
   const script=fileURLToPath(url);
   const output=execFileSync(process.execPath,['--check',script],{encoding:'utf8'});
   assert.equal(output,'');
 });
}
