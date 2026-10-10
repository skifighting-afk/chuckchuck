// 만든 릴스를 인스타에 올린다(인스타그램 공식 API · 영상 직접 올리기, 따로 호스팅 필요 없음).
// 필요: IG_USER_ID, IG_ACCESS_TOKEN (GitHub Secrets). 프로페셔널(비즈니스) 계정 + instagram_business_content_publish 권한.
// 선택: IG_HOST (기본 graph.instagram.com, 페이스북 로그인 토큰이면 graph.facebook.com), IG_API_VERSION (기본 v25.0)
// 사용: node scripts/reels/post.mjs [폴더=reel-out]   · DRY_RUN=1 이면 보낼 내용만 출력
// 토큰·비밀 값은 절대 출력하지 않는다.
import {readFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';

const dir=resolve(process.argv[2]||'reel-out');
const {IG_USER_ID:user,IG_ACCESS_TOKEN:token}=process.env;
const host=process.env.IG_HOST||'graph.instagram.com',ver=process.env.IG_API_VERSION||'v25.0';
const video=join(dir,'reel.mp4'),caption=readFileSync(join(dir,'caption.txt'),'utf8'),meta=JSON.parse(readFileSync(join(dir,'meta.json'),'utf8'));
const size=statSync(video).size;
if(size>100*1024*1024)throw Error('영상이 100MB를 넘어요.');
if(process.env.DRY_RUN==='1'||!user||!token){
 console.log(`${!user||!token?'인스타 연결 정보(IG_USER_ID·IG_ACCESS_TOKEN)가 없어 올리지 않았어요.':'시험 실행이라 올리지 않았어요.'} 영상 ${meta.seconds}초 · ${(size/1048576).toFixed(1)}MB · "${meta.q}"`);
 process.exit(0);
}
// 실패하면 이유를 실행 화면 위 알림(annotation)으로도 남긴다(로그를 못 열 때도 보이게). 토큰은 넣지 않는다.
const fail=e=>{const m=String(e?.message||e).replace(token,'***');console.log(`::error title=인스타 올리기 실패::${m}`);process.exit(1)};
process.on('unhandledRejection',fail);process.on('uncaughtException',fail);
const api=async(path,params,method='POST')=>{
 const url=new URL(`https://${host}/${ver}/${path}`);
 const body=new URLSearchParams({...params,access_token:token});
 const r=method==='GET'?await fetch(url+'?'+body):await fetch(url,{method,body});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(`인스타 API 오류 (${path.split('/').pop()}): ${d.error?.message||r.status}`);
 return d;
};
// 0) 하루 한 번만: 오늘(한국 날짜) 이미 올린 릴스가 있으면 건너뛴다(올릴 시간 판단은 due.mjs). FORCE_POST=1이면 무시
if(process.env.FORCE_POST!=='1'){
 const kst=d=>new Date(new Date(d).getTime()+9*3600000);
 const now=kst(Date.now());
 const recent=await api(`${user}/media`,{fields:'timestamp,media_product_type',limit:'3'},'GET').catch(()=>null);
 const last=(recent?.data||[]).find(m=>m.media_product_type==='REELS');
 if(last&&kst(last.timestamp).toISOString().slice(0,10)===now.toISOString().slice(0,10)){console.log(`오늘 이미 올린 릴스가 있어 건너뛰었어요 (${last.timestamp}).`);process.exit(0)}
}
// 1) 릴스 상자 만들기
//   인스타 로그인 방식 계정은 영상 직접 올리기를 받지 않아(video_url 필요), 워크플로가 공개 주소(REEL_VIDEO_URL)를 만들어 준다.
//   표지는 REEL_COVER_URL(첫 화면 썸네일)로 지정한다. 주소가 없으면 직접 올리기를 시도한다.
const vurl=process.env.REEL_VIDEO_URL,curl=process.env.REEL_COVER_URL;
const base={media_type:'REELS',caption,share_to_feed:'true',...(curl?{cover_url:curl}:{thumb_offset:'400'})};
const box=await api(`${user}/media`,vurl?{...base,video_url:vurl}:{...base,upload_type:'resumable'});
if(!vurl){
 // 2) 영상 올리기
 const up=await fetch(`https://rupload.facebook.com/ig-api-upload/${ver}/${box.id}`,{method:'POST',headers:{Authorization:`OAuth ${token}`,offset:'0',file_size:String(size)},body:readFileSync(video)});
 const upd=await up.json().catch(()=>({}));
 if(!up.ok||upd.success===false)throw Error('영상 올리기 실패: '+(upd.debug_info?.message||upd.error?.message||up.status));
}
// 3) 인스타가 영상 처리를 끝낼 때까지 기다리기(최대 10분)
let status='';
for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,10000));const st=await api(box.id,{fields:'status_code,status'},'GET');status=st.status_code;if(status==='ERROR')status+=' · '+(st.status||'');if(/^(FINISHED|ERROR|EXPIRED)/.test(status))break}
if(!status.startsWith('FINISHED'))throw Error('인스타 영상 처리가 끝나지 않았어요: '+status);
// 4) 게시
const pub=await api(`${user}/media_publish`,{creation_id:box.id});
console.log(`릴스 올림: "${meta.q}" (게시물 번호 ${pub.id})`);
