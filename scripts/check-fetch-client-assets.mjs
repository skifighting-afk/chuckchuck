import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import fetchPrevious from './fetch-client-assets.cjs';
const root=await mkdtemp(path.join(tmpdir(),'chuk-fetch-assets-'));
const saved=process.env.RUNNER_TEMP;process.env.RUNNER_TEMP=root;
function fixture({pages=[[]],published=[],artifacts=[{id:9,name:'client-assets',expired:false}]}={}){
 const calls=[],outputs={};
 const github={rest:{actions:{
  listWorkflowRuns:async args=>{assert.equal(args.status,'completed','a published run can fail a later smoke check');calls.push(['runs',args.page]);return {data:{workflow_runs:pages[(args.page||1)-1]||[]}}},
  listJobsForWorkflowRun:async args=>{calls.push(['jobs',args.run_id]);return {data:{jobs:[{steps:[{name:'화면 배포 (GitHub Pages)',conclusion:args.filter==='all'&&published.includes(args.run_id)?'success':'skipped'}]}]}}},
  listWorkflowRunArtifacts:async args=>{calls.push(['artifacts',args.run_id]);return {data:{artifacts}}},
  downloadArtifact:async args=>{calls.push(['download',args.artifact_id]);return {data:Buffer.from('public archive')}}
 }}};
 return {github,context:{repo:{owner:'test',repo:'app'}},core:{setOutput:(k,v)=>outputs[k]=v,info:()=>{}},calls,outputs};
}
try{
 const f=fixture({pages:[Array.from({length:30},(_,i)=>({id:100-i})),[{id:50,conclusion:'failure'}]],published:[50]});
 await fetchPrevious(f);assert.deepEqual(f.calls.filter(c=>c[0]==='runs'),[['runs',1],['runs',2]]);assert.deepEqual(f.calls.find(c=>c[0]==='artifacts'),['artifacts',50]);assert.equal(f.outputs.format,'client');assert.equal(await readFile(f.outputs.archive,'utf8'),'public archive');
 const legacy=fixture({pages:[[{id:1}]],published:[1],artifacts:[{id:4,name:'client-assets',expired:true},{id:5,name:'github-pages',expired:false}]});await fetchPrevious(legacy);assert.equal(legacy.outputs.format,'pages');assert.deepEqual(legacy.calls.find(c=>c[0]==='download'),['download',5]);
 const expired=fixture({pages:[[{id:1}]],published:[1],artifacts:[]});await assert.rejects(fetchPrevious(expired),/expired/);
 const skipped=fixture({pages:[[{id:1}]]});await assert.rejects(fetchPrevious(skipped),/No verified published/);
 const first=fixture();await fetchPrevious(first);assert.deepEqual(first.outputs,{});
 const broken=fixture();broken.github.rest.actions.listWorkflowRuns=async()=>{throw Error('network failure')};await assert.rejects(fetchPrevious(broken),/network failure/);
 console.log('PASS: actual publication selection, failed-smoke publication, paginated history, legacy fallback and fail-closed errors.');
}finally{if(saved===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=saved;await rm(root,{recursive:true,force:true})}
