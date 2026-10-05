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
const api=async(path,params,method='POST')=>{
 const url=new URL(`https://${host}/${ver}/${path}`);
 const body=new URLSearchParams({...params,access_token:token});
 const r=method==='GET'?await fetch(url+'?'+body):await fetch(url,{method,body});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(`인스타 API 오류 (${path.split('/').pop()}): ${d.error?.message||r.status}`);
 return d;
};
// 1) 릴스 상자 만들기(영상은 직접 올리기 방식)
const box=await api(`${user}/media`,{media_type:'REELS',upload_type:'resumable',caption,share_to_feed:'true',thumb_offset:'400'});
// 2) 영상 올리기
const up=await fetch(`https://rupload.facebook.com/ig-api-upload/${ver}/${box.id}`,{method:'POST',headers:{Authorization:`OAuth ${token}`,offset:'0',file_size:String(size)},body:readFileSync(video)});
const upd=await up.json().catch(()=>({}));
if(!up.ok||upd.success===false)throw Error('영상 올리기 실패: '+(upd.debug_info?.message||upd.error?.message||up.status));
// 3) 인스타가 영상 처리를 끝낼 때까지 기다리기(최대 10분)
let status='';
for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,10000));status=(await api(box.id,{fields:'status_code'},'GET')).status_code;if(status==='FINISHED'||status==='ERROR'||status==='EXPIRED')break}
if(status!=='FINISHED')throw Error('인스타 영상 처리가 끝나지 않았어요: '+status);
// 4) 게시
const pub=await api(`${user}/media_publish`,{creation_id:box.id});
console.log(`릴스 올림: "${meta.q}" (게시물 번호 ${pub.id})`);
