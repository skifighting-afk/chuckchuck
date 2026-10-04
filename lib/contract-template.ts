// 작업 043: 고용노동부 개정 표준 근로계약서(2025. 3. 게시, 2025. 8. 파일 형식만 수정 재게시) 항목 순서·문구에 맞춘 초안.
// 원문: data-import 브랜치 moel-contract-2025-b.txt(원본 HWP의 sha256은 같은 이름 .sha256) — 기간의 정함 없음·있음·연소근로자·단시간 서식을 반영.
// 2025 서식에서 달라진 점: 5번에 '공휴일(대체공휴일 포함)은 근로기준법이 정하는 바에 따르며, 근로자의 날은 유급휴일로 함' 추가,
// 6번 임금지급일 '(휴일의 경우는 전날 지급)', 8번 사회보험 '적용(가입) 원칙, 예외는 항목·사유 기재', 9번 교부 '근로기준법 제17조 이행'.
import type {Team,Member} from './team-model';
import {ageAt} from './labor-checks';
export const STANDARD_CONTRACT_SOURCE='https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20250300356';
export const STANDARD_CONTRACT_VERSION='2025-03 고용노동부 개정 표준 근로계약서';
const DAYS=['월','화','수','목','금','토','일'];
export function standardContractDraft(s:Team,e:Member){
 const value=(v:unknown)=>String(v??'').trim()||'[작성 필요]';
 const age=ageAt((e as any).birthMonth,e.joined),minor=age!==null&&age<18,partTime=e.employment==='단시간'||e.weeklyHours<40;
 const fixedTerm=!!e.endDate,title=minor?'연소근로자(18세 미만인 자) 표준근로계약서':partTime?'단시간근로자 표준근로계약서':fixedTerm?'표준근로계약서(기간의 정함이 있는 경우)':'표준근로계약서(기간의 정함이 없는 경우)';
 const employer=value(e.contract.employer||s.settings.employerName);
 const workDays=String(e.contract.workDays||'').split(/[,\s·/]+/).filter(d=>DAYS.includes(d));
 const dailyHours=workDays.length?Math.round(e.weeklyHours/workDays.length*10)/10:null;
 const holiday=e.contract.holiday||'';
 const lines=[
  title,
  '',
  `${employer}(이하 "사업주"라 함)과(와) ${e.name}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.`,
  '',
  fixedTerm?`1. 근로계약기간 : ${e.joined}부터 ${e.endDate}까지`:`1. 근로개시일 : ${e.joined}부터`,
  `2. 근무장소 : ${value(e.contract.workplace)}`,
  `3. 업무의 내용 : ${value(e.contract.duties)}`,
  partTime
   ?`4. 근로일 및 근로일별 근로시간\n${(workDays.length?workDays:['[요일]']).map(d=>`   (${d})요일 · 업무 시작 ${value(e.contract.start)} · 업무 종료 ${value(e.contract.end)} · 휴게 ${e.contract.breakMinutes}분`).join('\n')}\n   1주 소정근로시간 ${e.weeklyHours}시간`
   :`4. 소정근로시간 : ${value(e.contract.start)} ~ ${value(e.contract.end)} (휴게 : [시작 시각] ~ [종료 시각], ${e.contract.breakMinutes}분) (1일 ${dailyHours??'[작성 필요]'}시간, 1주 ${e.weeklyHours}시간)`,
  ...(minor?['   ※ 18세 미만인 자의 근로시간은 1일 7시간, 1주에 35시간을 초과하지 못함']:[]),
  `5. 근무일/휴일 : 매주 ${workDays.length||'[작성 필요]'}일 근무(근무요일 ${value(e.contract.workDays)}), ${holiday.includes('주휴일')?holiday:'주휴일 '+value(holiday)}`,
  '   - 공휴일(대체공휴일 포함)은 근로기준법이 정하는 바에 따르며, 근로자의 날은 유급휴일로 함',
  '6. 임금',
  ...(minor?['   ※ 연소근로자의 경우에도 고용노동부장관이 매년 고시하는 최저임금을 준수하여야 함']:[]),
  `   - ${e.payType} : ${e.wage.toLocaleString('ko-KR')}원`,
  '   - 상여금 : [있음(금액) 또는 없음]',
  '   - 그 밖의 수당(약정수당) : [있음(수당명·금액) 또는 없음]',
  `   - 임금지급일 : 매월 ${e.payDay}일(휴일의 경우는 전날 지급)`,
  `   - 지급방법 : ${value(e.contract.paymentMethod)}`,
  '7. 연차유급휴가 : 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함'+(e.contract.leave&&!/법령|근로기준법/.test(e.contract.leave)?` (추가 약정: ${e.contract.leave})`:''),
  ...(minor?[`8. 가족관계증명서 및 동의서\n   - 가족관계기록사항에 관한 증명서 제출 여부 : ${(e as any).minorDocs?'제출':'[작성 필요]'}\n   - 친권자 또는 후견인의 동의서 구비 여부 : ${(e as any).minorDocs?'구비':'[작성 필요]'}`]:[]),
  `${minor?9:8}. 사회보험 적용여부`,
  '   - 4대 사회보험(고용보험, 산재보험, 국민연금, 건강보험) 적용(가입)을 원칙으로 함',
  `   - 현재 확인 상태: ${Object.entries(e.insurances).map(([k,v])=>k+' '+v.status+(v.status==='적용 제외'&&v.reason?`(사유: ${v.reason})`:'')).join(' · ')}`,
  '   ※ 적용(가입) 예외에 해당하는 경우에는 적용(가입) 항목 등을 명확히 기재',
  `${minor?10:9}. 근로계약서 교부`,
  `   - 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의 교부요구와 관계없이 근로자에게 교부함(근로기준법 제17조${minor?', 제67조':''} 이행)`,
  `${minor?11:10}. 근로계약, 취업규칙 등의 성실한 이행의무`,
  '   - 사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함',
  `${minor?12:11}. 그 밖의 사항`,
  ...(e.contract.additional?[`   - 추가 약정: ${e.contract.additional}`]:[]),
  minor?'   - 13세 이상 15세 미만인 자에 대해서는 고용노동부장관으로부터 취직인허증을 교부받아야 하며, 이 계약에 정함이 없는 사항은 근로관계법령에 따름':'   - 이 계약에 정함이 없는 사항은 근로관계법령에 따름',
  '',
  '작성일 : [년 월 일]',
  `(사업주) 사업체명 : ${s.store.name} (전화 : [작성 필요])`,
  '         주소 : [작성 필요]',
  `         대표자 : ${employer} (서명)`,
  `(근로자) 주소 : ${value((e as any).address)}`,
  `         연락처 : ${value(e.phone)}`,
  `         성명 : ${e.name} (서명)`,
  '',
  `검토용 초안입니다. [작성 필요]와 실제 근로조건을 확인한 후 사용하세요. 서식 기준: ${STANDARD_CONTRACT_VERSION}`,
  `표준서식 원문·작성안내: ${STANDARD_CONTRACT_SOURCE}`,
  '전자서명된 문서가 아닙니다.',
 ];
 return '근로계약서 · 고용노동부 표준서식 참고 초안\n\n'+lines.join('\n');
}
