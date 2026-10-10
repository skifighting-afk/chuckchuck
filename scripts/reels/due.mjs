// 예약 실행 때 "지금 올릴 차례인지" 먼저 본다. 영상 만들기(5분 넘게 걸림) 전에 끝내서, 차례가 아니면 바로 마친다.
// 차례 = 오늘(한국 날짜) 정한 시간(month.json의 time, 없으면 18:00)이 지났고, 오늘 아직 릴스를 안 올렸을 때.
// 결과는 GITHUB_OUTPUT에 go=true|false 로 남긴다. 손으로 돌린 실행(workflow_dispatch)은 늘 go=true.
import {readFileSync,appendFileSync} from 'node:fs';
const out=v=>{console.log(`go=${v}`);if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`go=${v}\n`);process.exit(0)};
if(process.env.EVENT!=='schedule')out(true);
const now=new Date(Date.now()+9*3600000),today=now.toISOString().slice(0,10),hhmm=now.toISOString().slice(11,16);
const days=JSON.parse(readFileSync(new URL('./month.json',import.meta.url),'utf8')).days;
const slot=days.find(d=>d.date===today)?.time||'18:00';
if(hhmm<slot){console.log(`오늘 ${slot} 차례예요. 지금은 ${hhmm}.`);out(false)}
const user=process.env.IG_USER_ID,token=process.env.IG_ACCESS_TOKEN,host=process.env.IG_HOST||'graph.instagram.com';
if(!user||!token)out(true);
try{
 const r=await fetch(`https://${host}/v25.0/${user}/media?fields=timestamp,media_product_type&limit=3&access_token=${encodeURIComponent(token)}`);
 const d=await r.json();
 const last=(d.data||[]).find(m=>m.media_product_type==='REELS');
 if(last&&new Date(new Date(last.timestamp).getTime()+9*3600000).toISOString().slice(0,10)===today){console.log(`오늘 이미 올렸어요 (${last.timestamp}).`);out(false)}
}catch(e){console.log('최근 게시물 확인 실패, 올리기 단계에서 한 번 더 확인해요: '+e.message)}
out(true);
