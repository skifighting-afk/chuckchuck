// 인스타 성과 모으기: 올린 릴스마다 조회·좋아요·댓글·저장·공유·도달과 계정의 하루 프로필 방문을 모아 insights.json으로.
// 필요 권한: instagram_business_basic, instagram_business_manage_insights (토큰을 새로 받을 때 함께 허용)
// 사용: node scripts/reels/insights.mjs [이전 insights.json] [저장할 파일]   · 토큰·비밀 값은 출력하지 않는다.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';

const [prevPath='insights.json',outPath='insights.json']=process.argv.slice(2);
const {IG_USER_ID:user,IG_ACCESS_TOKEN:token}=process.env;
const host=process.env.IG_HOST||'graph.instagram.com',ver=process.env.IG_API_VERSION||'v25.0';
if(!user||!token){console.log('인스타 연결 정보가 없어 건너뛰어요.');process.exit(0)}
const prev=existsSync(prevPath)?JSON.parse(readFileSync(prevPath,'utf8')):{reels:[],daily:[]};
const get=async(path,params={})=>{const u=new URL(`https://${host}/${ver}/${path}`);for(const [k,v] of Object.entries({...params,access_token:token}))u.searchParams.set(k,String(v));const r=await fetch(u);const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Object.assign(Error(d.error?.message||String(r.status)),{code:d.error?.code});return d};
const warnings=[];
const me=await get(user,{fields:'username,followers_count,media_count'});
const list=(await get(`${user}/media`,{fields:'id,caption,media_product_type,timestamp,permalink,like_count,comments_count',limit:50})).data||[];
const reels=[];
for(const m of list.filter(m=>m.media_product_type==='REELS')){
 const row={id:m.id,q:(m.caption||'').split('\n')[0].slice(0,80),posted:m.timestamp,permalink:m.permalink,likes:m.like_count||0,comments:m.comments_count||0,views:null,reach:null,saves:null,shares:null,avgWatchSec:null};
 try{
  const ins=(await get(`${m.id}/insights`,{metric:'views,reach,saved,shares,ig_reels_avg_watch_time'})).data||[];
  const v=n=>ins.find(x=>x.name===n)?.values?.[0]?.value??ins.find(x=>x.name===n)?.total_value?.value??null;
  row.views=v('views');row.reach=v('reach');row.saves=v('saved');row.shares=v('shares');const w=v('ig_reels_avg_watch_time');row.avgWatchSec=w==null?null:Math.round(w/100)/10;
 }catch(e){warnings.push('릴스 통계를 못 읽었어요(권한 instagram_business_manage_insights 확인): '+e.message)}
 reels.push(row);
}
// 계정: 어제 하루 프로필 방문·도달
const kst=new Date(Date.now()+9*3600000),day=new Date(Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate()-1)),since=Math.floor(day.getTime()/1000)-9*3600,until=since+86400;
const date=day.toISOString().slice(0,10);let daily=prev.daily.filter(d=>d.date!==date);
try{
 const acc=(await get(`${user}/insights`,{metric:'profile_views,reach,accounts_engaged',period:'day',metric_type:'total_value',since,until})).data||[];
 const t=n=>acc.find(x=>x.name===n)?.total_value?.value??null;
 daily.push({date,profileViews:t('profile_views'),reach:t('reach'),engaged:t('accounts_engaged'),followers:me.followers_count??null});
}catch(e){warnings.push('계정 통계를 못 읽었어요: '+e.message);daily.push({date,profileViews:null,reach:null,engaged:null,followers:me.followers_count??null})}
daily=daily.sort((a,b)=>a.date.localeCompare(b.date)).slice(-90);
const out={updatedAt:new Date().toISOString(),username:me.username,followers:me.followers_count??null,mediaCount:me.media_count??null,reels,daily,warnings:[...new Set(warnings)]};
writeFileSync(outPath,JSON.stringify(out,null,1));
console.log(`성과 모음: 릴스 ${reels.length}개 · 팔로워 ${out.followers??'-'} · 경고 ${out.warnings.length}건`);
