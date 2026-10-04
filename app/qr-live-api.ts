// 작업 044: 매장 화면(태블릿)에 띄울 움직이는 QR 주소. 사장님만, 저장하지 않고 읽기만 한다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {liveToken} from '../lib/qr-live';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function qrLiveApi(request:Request,env:{DB:D1Database}){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인이 필요해요.'},401);
 try{
  const linked=await resolveStore(env.DB,user);if(!linked||linked.access!=='owner')return json({error:'매장 QR 화면은 사장님 계정으로 열어 주세요.'},403);
  const data=JSON.parse(linked.row.data),branch=new URL(request.url).searchParams.get('branch')||'';
  const secret=data._attendanceQr?.[branch];if(!secret||data._attendanceQrMode?.[branch]!=='dynamic')return json({error:'먼저 출퇴근 QR 화면에서 30초마다 바뀌는 QR을 켜 주세요.'},409);
  const {token,expiresIn}=await liveToken(secret);
  return json({url:new URL('/app?branch='+encodeURIComponent(branch)+'&attendanceQr='+encodeURIComponent(token)+'#attendance',request.url).href,expiresIn});
 }catch(e){return serverError('qr-live',e,'QR을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
