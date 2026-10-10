// 구글 플레이에 AAB 올리기(Google Play Developer API v3): node play-upload.mjs <서비스계정.json> <app.aab> <트랙: internal|alpha|beta|production>
// 처음 만드는 앱은 플레이 콘솔에서 첫 AAB를 직접 한 번 올려야 API 업로드가 된다. 출시 전 앱은 'draft'로만 올라간다(PLAY_STATUS로 바꿀 수 있음).
import {readFileSync} from 'node:fs';
import {createSign} from 'node:crypto';
const [saPath,aab,track='internal']=process.argv.slice(2),pkg=process.env.PLAY_PACKAGE||'kr.chukchukapp.app',status=process.env.PLAY_STATUS||'draft';
const sa=JSON.parse(readFileSync(saPath,'utf8'));
const b64u=s=>Buffer.from(s).toString('base64url');
const now=Math.floor(Date.now()/1000),head=b64u(JSON.stringify({alg:'RS256',typ:'JWT'})),body=b64u(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
const sig=createSign('RSA-SHA256').update(head+'.'+body).sign(sa.private_key).toString('base64url');
const tok=await (await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${head}.${body}.${sig}`})})).json();
if(!tok.access_token)throw Error('구글 인증 실패: 서비스 계정 JSON과 플레이 콘솔 권한을 확인해 주세요.');
const H={Authorization:'Bearer '+tok.access_token},api=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const j=async(r,what)=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${what} 실패(${r.status}): ${d?.error?.message||''}`);return d};
const edit=await j(await fetch(`${api}/edits`,{method:'POST',headers:H}),'편집 시작');
const up=await j(await fetch(`https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}/edits/${edit.id}/bundles?uploadType=media`,{method:'POST',headers:{...H,'Content-Type':'application/octet-stream'},body:readFileSync(aab)}),'AAB 올리기');
await j(await fetch(`${api}/edits/${edit.id}/tracks/${track}`,{method:'PUT',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({track,releases:[{versionCodes:[String(up.versionCode)],status,releaseNotes:[{language:'ko-KR',text:process.env.RELEASE_NOTES||'근무표·출퇴근·급여를 휴대폰에서 더 빠르게.'}]}]})}),'트랙 지정');
await j(await fetch(`${api}/edits/${edit.id}:commit`,{method:'POST',headers:H}),'반영');
console.log(`플레이 ${track} 트랙에 올렸어요 · 버전 코드 ${up.versionCode} · 상태 ${status}`);
