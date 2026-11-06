import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

// The static deployed site must expose the exact source revision that built it.
// Pages runs on main: GITHUB_SHA is that pushed commit. PR builds are preview
// validation and may report a synthetic merge commit (not a Pages deployment).
function currentCommit(){
  if(/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA??''))return process.env.GITHUB_SHA;
  try{
    const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return /^[0-9a-f]{40}$/.test(sha)?sha:null;
  }catch{return null;}
}
const payload={
  application:'VUELO',
  revision:currentCommit(),
  buildTime:new Date().toISOString(),
  event:process.env.GITHUB_EVENT_NAME||'local',
  ref:process.env.GITHUB_REF||null,
  runId:process.env.GITHUB_RUN_ID||null,
  isPagesCandidate:process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_REF==='refs/heads/main'
};
await mkdir('public',{recursive:true});
await writeFile('public/build-info.json',JSON.stringify(payload,null,2)+'\n');
console.log('VUELO build revision:',payload.revision??'unavailable','pages candidate:',payload.isPagesCandidate);
