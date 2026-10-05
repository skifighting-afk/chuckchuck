// 작업 011: 국세청 사업자등록 상태조회(공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스").
// 키는 서버 비밀값 NTS_API_KEY(일반 인증키 Decoding). 키가 없거나 조회가 실패해도 가입은 받고 '미확인'으로 둔다.
import {validBizNo} from './plans';
export type BizStatus='계속사업자'|'휴업자'|'폐업자'|'등록되지 않음'|'미확인';
export type BizCheck={bizNo:string,status:BizStatus,taxType?:string,checkedAt:string,reason?:string};
const CODE:Record<string,BizStatus>={'01':'계속사업자','02':'휴업자','03':'폐업자'};
export async function checkBusiness(bizNoRaw:string,env:{NTS_API_KEY?:string},fetcher:typeof fetch=fetch,now=new Date()):Promise<BizCheck>{
 const bizNo=String(bizNoRaw||'').replace(/\D/g,''),at=now.toISOString();
 if(!validBizNo(bizNo))return {bizNo,status:'미확인',checkedAt:at,reason:'번호 형식이 맞지 않아요'};
 if(!env.NTS_API_KEY)return {bizNo,status:'미확인',checkedAt:at,reason:'국세청 조회 연결 전'};
 try{
  const r=await fetcher('https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey='+encodeURIComponent(env.NTS_API_KEY),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({b_no:[bizNo]}),signal:AbortSignal.timeout(8000)});
  if(!r.ok)return {bizNo,status:'미확인',checkedAt:at,reason:'국세청 조회 실패('+r.status+')'};
  const d:any=await r.json(),row=d?.data?.[0];
  if(!row)return {bizNo,status:'미확인',checkedAt:at,reason:'국세청 응답이 비어 있어요'};
  const status=CODE[row.b_stt_cd]||(String(row.tax_type||'').includes('등록되지 않은')?'등록되지 않음':'미확인');
  return {bizNo,status,taxType:row.tax_type||undefined,checkedAt:at};
 }catch{return {bizNo,status:'미확인',checkedAt:at,reason:'국세청 조회 시간 초과'}}
}
