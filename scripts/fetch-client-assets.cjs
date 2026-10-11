// Only reuse artifacts from a main run that really published Pages.
module.exports=async({github,context,core})=>{
 const {owner,repo}=context.repo;
 let foundHistory=false;
 for(let page=1;;page++){
 const {data}=await github.rest.actions.listWorkflowRuns({owner,repo,workflow_id:'deploy.yml',branch:'main',status:'completed',per_page:30,page});
 foundHistory ||= data.workflow_runs.length>0;
 for(const run of data.workflow_runs){
  let published=false;
  for(let jobPage=1;;jobPage++){
   const jobs=await github.rest.actions.listJobsForWorkflowRun({owner,repo,run_id:run.id,filter:'all',per_page:100,page:jobPage});
   published=jobs.data.jobs.some(j=>j.steps?.some(s=>s.name==='화면 배포 (GitHub Pages)'&&s.conclusion==='success'));
   if(published||jobs.data.jobs.length<100)break;
  }
  if(!published)continue;
  const artifacts=await github.rest.actions.listWorkflowRunArtifacts({owner,repo,run_id:run.id,per_page:100});
  const artifact=artifacts.data.artifacts.find(a=>a.name==='client-assets'&&!a.expired)||artifacts.data.artifacts.find(a=>a.name==='github-pages'&&!a.expired);
  if(!artifact)throw Error('The previous published client artifact has expired; restore it before publishing.');
  const archive=await github.rest.actions.downloadArtifact({owner,repo,artifact_id:artifact.id,archive_format:'zip'});
  const fs=require('node:fs/promises'),path=require('node:path');const target=path.join(process.env.RUNNER_TEMP,'previous-client.zip');await fs.writeFile(target,Buffer.from(archive.data));
  core.setOutput('archive',target);core.setOutput('format',artifact.name==='github-pages'?'pages':'client');core.info('Retaining public client assets from published run '+run.id);return;
 }
 if(data.workflow_runs.length<30)break;
 }
 if(foundHistory)throw Error('No verified published Pages run found in history; refusing to drop existing assets.');
 core.info('First deployment: no previous public client assets.');
};
