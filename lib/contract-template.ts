import type {Team,Member} from './team-model';
export const STANDARD_CONTRACT_SOURCE='https://www.moel.go.kr/mainpop2.do';
export function standardContractDraft(s:Team,e:Member){
 const value=(v:unknown)=>String(v??'').trim()||'[작성 필요]';
 return `근로계약서 · 고용노동부 표준서식 참고 초안

사업주: ${value(e.contract.employer||s.settings.employerName)}
근로자: ${e.name}
아래 근로조건을 함께 확인합니다.

1. 계약기간: ${e.joined}부터 ${e.endDate||'기간의 정함 없음'}
2. 근무장소: ${value(e.contract.workplace)}
3. 담당 업무: ${value(e.contract.duties)}
4. 근무시간: ${value(e.contract.start)} ~ ${value(e.contract.end)}
   휴게시간: [시작 시각] ~ [종료 시각], 합계 ${e.contract.breakMinutes}분
   근무요일: ${value(e.contract.workDays)} / 주 ${e.weeklyHours}시간
   단시간 근로자는 요일별 근무시간을 추가로 기재: [작성 필요]
5. 휴일: ${value(e.contract.holiday)}
6. 임금
   ${e.payType}: ${e.wage.toLocaleString('ko-KR')}원
   상여금: [있음/없음 및 금액·지급조건]
   수당별 금액과 계산방법: [작성 필요]
   지급일: 매월 ${e.payDay}일 / 휴일인 경우 지급일: [작성 필요]
   지급방법: ${value(e.contract.paymentMethod)}
7. 휴가: ${value(e.contract.leave)}
8. 사회보험: ${Object.entries(e.insurances).map(([key,v])=>key+' '+v.status).join(' · ')}
9. 계약서 사본 교부: 서명 후 근로자에게 사본 전달 / 전달일·방법: [작성 필요]
10. 추가 약정: ${e.contract.additional||'없음'}
    사업주와 근로자는 약속한 조건을 성실하게 이행합니다. 법령상 기준에 미달하는 약정은 그 기준에 맞춰 확인합니다.

작성일: [년 월 일]
사업체명: ${s.store.name}
사업장 주소·연락처: [작성 필요]
사장님: ${value(e.contract.employer||s.settings.employerName)} (서명)
근로자 주소: [작성 필요]
근로자 연락처: ${value(e.phone)}
근로자 성명: ${e.name} (서명)

검토용 초안입니다. [작성 필요]와 실제 근로조건을 확인한 후 사용하세요.
표준서식 원문·작성안내: ${STANDARD_CONTRACT_SOURCE}
전자서명된 문서가 아닙니다.`;
}
