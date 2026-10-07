// 작업 093: 카카오 알림톡 준비(뼈대). 실제 발송은 카카오 비즈 채널·템플릿 검수 승인 후 발송 대행사 키를 설정해야 한다.
// 알림톡은 정보성 메시지만 가능(광고 금지). 변수는 #{이름} 형식으로 검수 신청한다.
export type TemplateId='PAYSLIP_SENT'|'CONTRACT_SIGN'|'CORRECTION_RESULT'|'LEAVE_RESULT'|'SWAP_REQUEST'|'CLOCKOUT_MISSING'|'SCHEDULE_CHANGED'|'STAFF_INVITE';
export const TEMPLATES:Record<TemplateId,{name:string,text:string,button:string,vars:string[]}>={
 PAYSLIP_SENT:{name:'급여명세서 도착',text:'#{이름}님, #{가게} #{월} 급여명세서가 도착했어요.\n실수령액: #{실수령액}원\n지급일: #{지급일}\n\n앱에서 항목별 계산 근거를 확인할 수 있어요.',button:'명세서 보기',vars:['이름','가게','월','실수령액','지급일']},
 CONTRACT_SIGN:{name:'근로계약서 서명 요청',text:'#{이름}님, #{가게}에서 근로계약서 서명을 요청했어요.\n\n내용을 확인하고 동의하면 앱에서 서명할 수 있어요. 내용이 다르면 수정 요청을 보내 주세요.',button:'계약서 확인',vars:['이름','가게']},
 CORRECTION_RESULT:{name:'출퇴근 정정 결과',text:'#{이름}님, #{날짜} 출퇴근 정정 요청이 #{결과}되었어요.\n처리: #{처리자}',button:'기록 보기',vars:['이름','날짜','결과','처리자']},
 LEAVE_RESULT:{name:'휴가 신청 결과',text:'#{이름}님, #{기간} #{종류} 신청이 #{결과}되었어요.\n사유: #{사유}',button:'휴가 보기',vars:['이름','기간','종류','결과','사유']},
 SWAP_REQUEST:{name:'대타·교대 요청',text:'#{이름}님, #{요청자}님이 #{날짜} #{시간} 근무의 #{종류}를 구하고 있어요.',button:'요청 보기',vars:['이름','요청자','날짜','시간','종류']},
 SCHEDULE_CHANGED:{name:'근무표 변경',text:'#{이름}님, #{가게} 근무표가 바뀌었어요.\n#{내용}\n\n앱에서 확인해 주세요.',button:'근무표 보기',vars:['이름','가게','내용']},
 STAFF_INVITE:{name:'직원 초대',text:'#{이름}님, #{가게}에서 척척사장으로 초대했어요.\n아래 주소에서 가입하고 합류를 신청해 주세요.\n#{주소}',button:'가입하기',vars:['이름','가게','주소']},
 CLOCKOUT_MISSING:{name:'퇴근 기록 누락',text:'#{이름}님, #{날짜} 퇴근 기록이 없어요. 앱에서 실제 퇴근 시각으로 정정 요청을 보내 주세요.',button:'정정 요청',vars:['이름','날짜']},
};
export function renderTemplate(id:TemplateId,values:Record<string,string|number>){
 const t=TEMPLATES[id],missing=t.vars.filter(v=>values[v]===undefined||values[v]==='');if(missing.length)throw Error('알림톡 변수 누락: '+missing.join(', '));
 return t.text.replace(/#\{([^}]+)\}/g,(_,k)=>String(values[k]));
}
export type AlimtalkEnv={KAKAO_SENDER_KEY?:string,ALIMTALK_API_KEY?:string,ALIMTALK_ENDPOINT?:string};
/** 비즈 채널·대행사 키가 없으면 보내지 않고 'not_configured'를 돌려준다(가짜 성공 금지). */
export async function sendAlimtalk(env:AlimtalkEnv,to:string,id:TemplateId,values:Record<string,string|number>,fetcher:typeof fetch=fetch){
 const text=renderTemplate(id,values);
 if(!env.KAKAO_SENDER_KEY||!env.ALIMTALK_API_KEY||!env.ALIMTALK_ENDPOINT)return {status:'not_configured' as const,text};
 if(!/^01[016789]\d{7,8}$/.test(to.replace(/\D/g,'')))return {status:'invalid_phone' as const,text};
 const r=await fetcher(env.ALIMTALK_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.ALIMTALK_API_KEY},body:JSON.stringify({senderKey:env.KAKAO_SENDER_KEY,templateCode:id,to:to.replace(/\D/g,''),text})});
 return {status:r.ok?'accepted' as const:'failed' as const,text,code:r.status};
}
