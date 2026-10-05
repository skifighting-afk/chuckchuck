// 척척 비서 질문 100가지: 가게 기록을 읽어 답하는 질문 + 자주 묻는 노무 상식 + 앱 사용법.
// 노무 답은 많이 쓰는 일반 기준만 짧게 적고, 사정마다 다를 수 있는 건 고용노동부 상담(국번 없이 1350)이나 세무사 확인을 권한다.
// m: 모두 맞아야 하는 말 묶음(정규식). 여러 항목이 맞으면 묶음이 많은(더 구체적인) 항목이 이긴다.
import {type Team,type Member,calculate,kdate,missing,duration} from './team-model';
import {type Target,todayBoard,homeAlerts,budgetStatus,plannedLabor} from './close-check';
import {checkDay,monthPatterns} from './attendance-check';
import {ratesFor} from './pay-rules';
import {ageAt} from './labor-checks';
import type {Action} from './assistant';

export type Ctx={s:Team,branch:string,date:string,now:number,es:Member[],ids:Set<string>,who?:Member,text:string};
type Out={lines:string[],actions?:Action[]};
export type Item={id:string,group:string,q:string,m:RegExp[],a:string|((c:Ctx)=>Out),go?:Target,href?:string};

const won=(n:number)=>Math.round(n).toLocaleString('ko-KR');
const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const mondayOf=(d:string)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.toISOString().slice(0,10)};
const md=(d:string)=>`${Number(d.slice(5,7))}월 ${Number(d.slice(8))}일`;
const names=(list:{name:string}[],n=6)=>list.length?list.slice(0,n).map(x=>x.name).join(', ')+(list.length>n?` 외 ${list.length-n}명`:''):'';
const tol=(c:Ctx)=>((c.s.settings as any).attendanceTolerance||'normal');
const board=(c:Ctx)=>{const f=checkDay(c.date,c.s.shifts.filter(x=>c.ids.has(x.employeeId)),c.s.attendance.filter(a=>c.ids.has(a.employeeId)),tol(c),c.now);return todayBoard(c.s,c.branch,c.date,f,c.now,tol(c)==='lenient'?10:tol(c)==='strict'?0:5)};
const weekHours=(c:Ctx,id:string,from:string)=>c.s.shifts.filter(x=>x.employeeId===id&&x.date>=from&&x.date<=addDays(from,6)).reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes),0);
const rows=(c:Ctx,month=c.date.slice(0,7))=>calculate(c.s,month).filter(r=>c.ids.has(r.employeeId));
const prevMonth=(d:string)=>new Date(Date.parse(d.slice(0,7)+'-01T00:00:00Z')-86400000).toISOString().slice(0,7);
const go=(target:Target,label:string):Action=>({type:'go',target,label});
const link=(href:string,label:string):Action=>({type:'link',href,label});
const minWage=(c:Ctx)=>ratesFor(Number(c.date.slice(0,4))).minimumWage;
const ask='사정마다 다를 수 있어요. 애매하면 고용노동부 상담센터(국번 없이 1350)에 물어보세요.';

export const KB:Item[]=[
 // ── 가게 기록으로 답해요 ──
 {id:'now-count',group:'오늘 가게',q:'지금 몇 명 일하고 있어?',m:[/지금|현재/,/몇\s*명|인원/],a:c=>{const b=board(c);return {lines:[`지금 ${b.working}명이 일하고 있어요.${b.left?` ${b.left}명은 아직 출근 전이에요.`:''}`],actions:[go('attendance','출퇴근 기록 보기')]}}},
 {id:'tomorrow',group:'오늘 가게',q:'내일 누가 일해?',m:[/내일/,/누가|근무자|일해|출근/],a:c=>{const d=addDays(c.date,1),l=c.s.shifts.filter(x=>c.ids.has(x.employeeId)&&x.date===d).sort((a,b)=>a.start.localeCompare(b.start));return {lines:[l.length?`${md(d)} 근무: `+l.map(x=>`${c.es.find(e=>e.id===x.employeeId)?.name} ${x.start}–${x.end}`).join(', '):`${md(d)}에는 잡힌 근무가 없어요.`],actions:[go('schedule','근무표 열기')]}}},
 {id:'weekend',group:'오늘 가게',q:'이번 주말 근무자는?',m:[/주말|토요일|일요일/,/누가|근무|일해/],a:c=>{const sat=addDays(mondayOf(c.date),5),l=c.s.shifts.filter(x=>c.ids.has(x.employeeId)&&(x.date===sat||x.date===addDays(sat,1)));return {lines:[l.length?'이번 주말: '+l.map(x=>`${md(x.date)} ${c.es.find(e=>e.id===x.employeeId)?.name} ${x.start}–${x.end}`).join(', '):'이번 주말에는 잡힌 근무가 없어요.'],actions:[go('schedule','근무표 열기')]}}},
 {id:'noshow',group:'오늘 가게',q:'QR 안 찍은 사람 있어?',m:[/QR|큐알|출근/,/안|없|누락|빠/],a:c=>{const b=board(c),l=b.rows.filter(r=>r.status==='noshow'||r.status==='missed');return {lines:[l.length?'출근 기록이 없는 사람: '+l.map(r=>`${r.name}(${r.start} 예정 · ${r.label})`).join(', '):'오늘 출근 QR을 안 찍은 사람은 없어요.'],actions:[go('attendance','출퇴근 기록 보기')]}}},
 {id:'clockout',group:'오늘 가게',q:'퇴근 안 찍은 사람 있어?',m:[/퇴근/,/안|없|누락|빠/],a:c=>{const l=c.s.attendance.filter(a=>c.ids.has(a.employeeId)&&!a.end&&kdate(a.start)<c.date);return {lines:[l.length?'퇴근 기록이 빠진 근무: '+l.map(a=>`${c.es.find(e=>e.id===a.employeeId)?.name} ${md(kdate(a.start))}`).join(', ')+'. 실제 퇴근 시각으로 고쳐야 급여가 맞아요.':'퇴근 기록이 빠진 근무는 없어요.'],actions:[go('attendance','출퇴근 기록 보기')]}}},
 {id:'last-labor',group:'돈',q:'지난달 인건비 얼마였어?',m:[/지난\s*달|저번\s*달|전달/,/인건비|급여|월급|얼마/],a:c=>{const m=prevMonth(c.date),r=rows(c,m);return {lines:[r.length?`${Number(m.slice(5))}월 지급 합계 ${won(r.reduce((n,x)=>n+x.gross,0))}원, 실수령 합계 ${won(r.reduce((n,x)=>n+x.net,0))}원이에요.`:`${Number(m.slice(5))}월 급여 기록이 없어요.`],actions:[go('payroll','급여 화면 열기')]}}},
 {id:'most-hours',group:'돈',q:'이번 달 제일 많이 일한 사람은?',m:[/제일|가장|많이|순위|랭킹/,/일한|근무|시간/],a:c=>{const r=rows(c).sort((a,b)=>b.hours-a.hours).slice(0,5);return {lines:[r.length?'이번 달 근무시간: '+r.map((x,i)=>`${i+1}. ${x.name} ${x.hours.toFixed(1)}시간`).join(' · '):'이번 달 근무 기록이 아직 없어요.']}}},
 {id:'week-total',group:'근무표',q:'이번 주 근무표 총 몇 시간이야?',m:[/이번\s*주/,/총|전체|합계|몇\s*시간/],a:c=>{const mon=mondayOf(c.date),h=c.es.reduce((n,e)=>n+weekHours(c,e.id,mon),0);return {lines:[`이번 주(${md(mon)}~) 근무표는 모두 ${h.toFixed(1)}시간이에요.`],actions:[go('schedule','근무표 열기')]}}},
 {id:'no-shift',group:'근무표',q:'이번 주 근무 없는 직원은?',m:[/근무|스케줄/,/없는|빠진|안\s*잡/],a:c=>{const mon=mondayOf(c.date),l=c.es.filter(e=>e.status==='재직'&&weekHours(c,e.id,mon)===0);return {lines:[l.length?`이번 주 근무가 없는 직원: ${names(l)}.`:'재직 중인 직원 모두 이번 주 근무가 있어요.'],actions:[go('schedule','근무표 열기')]}}},
 {id:'headcount',group:'직원',q:'직원 몇 명이야?',m:[/직원|알바|사람/,/몇\s*명|수|명단|목록/],a:c=>{const on=c.es.filter(e=>e.status==='재직'),ready=c.es.filter(e=>e.status!=='재직');return {lines:[`재직 ${on.length}명${ready.length?`, 입사 준비 ${ready.length}명`:''}이에요.${on.length?' '+names(on,10)+'.':''}`],actions:[go('employees','직원 관리 열기')]}}},
 {id:'no-contract',group:'직원',q:'계약서 안 쓴 직원은?',m:[/계약/,/안\s*(쓴|한)|미체결|누구|없는/,/직원|사람|누구/],a:c=>{const l=c.es.filter(e=>e.employment!=='독립 용역'&&e.contract.status!=='체결 완료');return {lines:[l.length?`근로계약서가 체결되지 않은 직원: ${names(l)}. 근로계약서를 쓰고 주지 않으면 500만원 이하 벌금 대상이에요.`:'모든 직원이 근로계약을 마쳤어요.'],actions:[link('/contracts','계약서 만들기·보내기')]}}},
 {id:'missing-info',group:'직원',q:'정보 덜 채운 직원 있어?',m:[/정보|입력/,/덜|빠진|누락|부족/],a:c=>{const l=c.es.filter(e=>missing(e).length);return {lines:[l.length?l.slice(0,5).map(e=>`${e.name}: ${missing(e).join(', ')}`).join(' / '):'모든 직원 정보가 채워져 있어요.'],actions:[go('employees','직원 관리 열기')]}}},
 {id:'health-cert',group:'직원',q:'보건증 끝나가는 직원은?',m:[/보건증|건강진단/],a:c=>{const l=c.es.filter(e=>(e as any).healthCertUntil).sort((a,b)=>String((a as any).healthCertUntil).localeCompare(String((b as any).healthCertUntil)));const soon=l.filter(e=>(e as any).healthCertUntil<=addDays(c.date,30));return {lines:[soon.length?'30일 안에 끝나거나 지난 보건증: '+soon.map(e=>`${e.name}(${(e as any).healthCertUntil})`).join(', '):l.length?'30일 안에 끝나는 보건증은 없어요.':'보건증 만료일을 넣은 직원이 없어요. 음식점이면 직원 정보에 만료일을 넣어 두세요.','음식을 다루는 일은 1년마다 건강진단(보건증)을 받아야 해요.'],actions:[go('employees','직원 관리 열기')]}}},
 {id:'minors',group:'직원',q:'18세 미만 직원 있어?',m:[/18세|미성년|청소년|고등학생/,/있|누구|직원/],a:c=>{const l=c.es.filter(e=>{const a=ageAt((e as any).birthMonth,c.date);return a!==null&&a<18});return {lines:[l.length?`18세 미만 직원: ${names(l)}. 가족관계증명서와 친권자 동의서를 받아 두고, 하루 7시간·주 35시간을 넘기지 마세요.`:'생년월이 입력된 직원 중 18세 미만은 없어요.']}}},
 {id:'anniv',group:'직원',q:'곧 1년 되는 직원은?',m:[/1년|일\s*년|근속/,/곧|되는|다가|누구/],a:c=>{const l=c.es.filter(e=>{if(!e.joined)return false;const one=(Number(e.joined.slice(0,4))+1)+e.joined.slice(4,10);return one>=c.date&&one<=addDays(c.date,60)});return {lines:[l.length?'60일 안에 1년을 채우는 직원: '+l.map(e=>`${e.name}(${md((Number(e.joined.slice(0,4))+1)+e.joined.slice(4,10))})`).join(', ')+'. 주 15시간 이상이면 퇴직금 대상이 되고 연차 15일이 생겨요.':'60일 안에 1년을 채우는 직원은 없어요.']}}},
 {id:'short-time',group:'직원',q:'주 15시간 안 되는 직원은?',m:[/15\s*시간/,/안|미만|못|누구/],a:c=>{const l=c.es.filter(e=>e.weeklyHours<15);return {lines:[l.length?`계약상 주 15시간 미만 직원: ${names(l)}. 주휴수당·연차·퇴직금이 생기지 않아요. 실제 근무가 15시간을 넘으면 달라져요.`:'계약상 주 15시간 미만인 직원은 없어요.']}}},
 {id:'corrections',group:'오늘 가게',q:'수정 요청 온 거 있어?',m:[/수정|정정/,/요청|승인|대기|있/],a:c=>{const n=c.s.requests.filter(r=>r.status==='승인 대기'&&c.ids.has(r.before?.employeeId)).length;return {lines:[n?`출퇴근 수정 요청 ${n}건이 수정 승인함에서 기다려요.`:'기다리는 수정 요청이 없어요.'],actions:[go('attendance','수정 승인함 열기')]}}},
 {id:'locked',group:'돈',q:'이번 달 급여 확정했어?',m:[/확정/,/했어|됐어|했나|됐나|상태|여부/],a:c=>{const m=c.date.slice(0,7),r=(c.s.payrollRuns as any)[m+':'+c.branch],p=(c.s.payrollRuns as any)[prevMonth(c.date)+':'+c.branch];return {lines:[`${Number(m.slice(5))}월 급여: ${r?.locked?'확정됨':'아직 확정 전'} · ${Number(prevMonth(c.date).slice(5))}월 급여: ${p?.locked?'확정됨':'확정 전'}.`],actions:[go('payroll','급여 화면 열기')]}}},
 {id:'budget',group:'돈',q:'인건비 예산 얼마나 썼어?',m:[/예산/],a:c=>{const b=budgetStatus(c.s,c.branch,c.date.slice(0,7));return {lines:[b?`이번 달 근무표 기준 ${won(b.planned)}원으로 예산 ${won(b.budget)}원의 ${Math.round(b.ratio*100)}%예요.${b.over?' 예산을 넘었어요.':b.near?' 예산에 거의 닿았어요.':''}`:'인건비 예산이 아직 없어요. 설정에서 월 예산을 넣으면 홈과 비서가 알려 드려요.'],actions:[go('reports','인건비 리포트 열기')]}}},
 {id:'late-month',group:'오늘 가게',q:'이번 달 지각 많이 한 사람은?',m:[/이번\s*달|한\s*달|자주|많이/,/지각|늦/],a:c=>{const p=monthPatterns(c.date.slice(0,7),c.s.shifts.filter(x=>c.ids.has(x.employeeId)),c.s.attendance.filter(a=>c.ids.has(a.employeeId)),tol(c),c.now).filter(x=>x.지각>0);return {lines:[p.length?p.slice(0,5).map(x=>`${c.es.find(e=>e.id===x.employeeId)?.name} ${x.지각}번(${x.lateMinutes}분)${x.repeatDay?` · 주로 ${x.repeatDay}요일`:''}`).join(' / '):'이번 달 지각 기록이 없어요.'],actions:[go('attendance','출퇴근 기록 보기')]}}},
 {id:'below-min',group:'돈',q:'최저시급보다 적게 받는 직원 있어?',m:[/최저/,/적게|미달|낮|아래|안\s*되|있/],a:c=>{const min=minWage(c),l=c.es.filter(e=>e.payType==='시급'&&e.wage<min);return {lines:[l.length?`${c.date.slice(0,4)}년 최저시급 ${won(min)}원보다 낮은 시급: `+l.map(e=>`${e.name} ${won(e.wage)}원`).join(', ')+'. 고쳐 주세요.':`시급 직원은 모두 ${c.date.slice(0,4)}년 최저시급(${won(min)}원) 이상이에요.`],actions:[go('employees','직원 관리 열기')]}}},
 {id:'avg-wage',group:'돈',q:'평균 시급이 얼마야?',m:[/평균/,/시급|임금|급여/],a:c=>{const l=c.es.filter(e=>e.payType==='시급');return {lines:[l.length?`시급 직원 ${l.length}명의 평균 시급은 ${won(l.reduce((n,e)=>n+e.wage,0)/l.length)}원이에요(최저 ${won(Math.min(...l.map(e=>e.wage)))}원 · 최고 ${won(Math.max(...l.map(e=>e.wage)))}원).`:'시급 직원이 없어요.']}}},
 {id:'insured',group:'직원',q:'4대보험 가입한 직원은?',m:[/4대\s*보험|사대\s*보험/,/누구|가입|현황|직원/],a:c=>{const on=c.es.filter(e=>e.taxMode==='4대보험 자동'),biz=c.es.filter(e=>e.taxMode==='사업소득 3.3%');return {lines:[`4대보험 자동 공제: ${on.length?names(on):'없음'} · 3.3% 사업소득: ${biz.length?names(biz):'없음'}.`]}}},
 {id:'next-week-hours',group:'근무표',q:'다음 주 근무 몇 시간 잡혔어?',m:[/다음\s*주|담주/,/몇\s*시간|시간|총/],a:c=>{const mon=addDays(mondayOf(c.date),7),l=c.es.map(e=>({name:e.name,h:weekHours(c,e.id,mon)})).filter(x=>x.h>0);return {lines:[l.length?`다음 주: `+l.map(x=>`${x.name} ${x.h.toFixed(1)}시간`).join(', '):'다음 주 근무표가 비어 있어요.'],actions:[go('schedule','근무표 열기')]}}},
 {id:'over-52',group:'근무표',q:'주 52시간 넘는 사람 있어?',m:[/52/],a:c=>{const mon=mondayOf(c.date),l=c.es.map(e=>({name:e.name,h:weekHours(c,e.id,mon)})).filter(x=>x.h>52);return {lines:[l.length?'이번 주 52시간을 넘는 근무표: '+l.map(x=>`${x.name} ${x.h.toFixed(1)}시간`).join(', '):'이번 주 근무표에서 52시간을 넘는 사람은 없어요.','주 52시간(기본 40 + 연장 12) 제한은 5명 이상 사업장에 적용돼요.']}}},
 {id:'labor-forecast',group:'돈',q:'이번 달 인건비 얼마나 나올 것 같아?',m:[/인건비|급여/,/나올|예상|예측|전망/],a:c=>({lines:[`근무표대로 다 일하면 이번 달 인건비는 약 ${won(plannedLabor(c.s,c.branch,c.date.slice(0,7)))}원이에요(수당·공제 전, 시급×근무표 시간 + 월급).`],actions:[go('reports','인건비 리포트 열기')]})},
 {id:'today-schedule',group:'오늘 가게',q:'오늘 근무표 보여줘',m:[/오늘/,/근무표|스케줄|일정/],a:c=>{const b=board(c);return {lines:[b.rows.length?b.rows.map(r=>`${r.name} ${r.start}–${r.end} · ${r.label}`).join(' / '):'오늘은 잡힌 근무가 없어요.'],actions:[go('schedule','근무표 열기')]}}},

 // ── 바로 해 드려요(화면 열기) ──
 {id:'copy-week',group:'바로 하기',q:'지난주 근무표 복사해줘',m:[/복사|붙여|똑같이/,/근무|주|스케줄/],a:'근무 스케줄 화면의 [지난주 복사]를 누르면 지난주 근무를 이번 주로 한 번에 옮겨요. 옮긴 뒤 바뀐 날만 고치면 돼요.',go:'schedule'},
 {id:'template',group:'바로 하기',q:'근무표 템플릿 어떻게 써?',m:[/템플릿|틀|패턴/],a:'자주 쓰는 한 주 근무를 템플릿으로 저장해 두고, 다른 주에 [이 주에 붙이기]로 넣어요. 근무 스케줄 화면의 [템플릿] 버튼이에요.',go:'schedule'},
 {id:'draft',group:'바로 하기',q:'직원 가능 시간으로 근무표 짜줘',m:[/가능\s*시간|초안|자동/,/근무표|스케줄|짜/],a:'직원이 휴가·공지 > 근무 요청에서 가능한 시간을 내면, 근무 스케줄의 [가능 시간으로 초안]이 그 시간에 맞춰 근무표 초안을 만들어요. 확인하고 저장하면 끝이에요.',go:'schedule'},
 {id:'print',group:'바로 하기',q:'근무표 인쇄하고 싶어',m:[/인쇄|프린트|출력/,/근무|스케줄/],a:'근무 스케줄 화면의 [인쇄 (A4 가로)]를 누르면 한 주 근무표를 A4 한 장으로 뽑아요. 매장 벽에 붙여 두기 좋아요.',go:'schedule'},
 {id:'unlock',group:'바로 하기',q:'확정한 급여 고치고 싶어',m:[/확정/,/해제|풀|고치|수정|취소/],a:'급여·명세서 화면의 [확정 해제]를 누르고 사유를 쓰면 다시 고칠 수 있어요. 다시 확정하면 명세서가 새 수정본으로 바뀌고, 이미 보낸 직원에게는 새 수정본을 보내면 돼요.',go:'payroll'},
 {id:'finalize',group:'바로 하기',q:'급여 확정하려면?',m:[/급여|월급/,/확정|마감|정리/],a:'급여·명세서 화면에서 달을 고르고 [급여 검토·확정]을 누르세요. 지급일을 넣고 확인 항목에 체크하면 그 달 기록이 잠기고, 명세서를 보낼 수 있어요. 확정은 기록을 잠그는 것이고 돈을 보내지는 않아요.',go:'payroll'},
 {id:'pdf',group:'바로 하기',q:'명세서 PDF로 받고 싶어',m:[/명세서/,/PDF|pdf|합본|파일|저장|출력/],a:'명세서를 보낸 뒤 급여·명세서 화면에서 [보낸 명세서 합본 PDF]를 누르면 직원 전체 명세서를 PDF 한 파일로 받아요. 직원은 자기 명세서를 [PDF로 저장]할 수 있어요.',go:'payroll'},
 {id:'accountant',group:'바로 하기',q:'세무사한테 자료 보내려면?',m:[/세무사|회계/],a:'급여를 확정한 뒤 급여·명세서 화면의 세무사 공유에서 링크를 만들면, 세무사가 로그인 없이 7일 동안 그 달 확정 급여를 볼 수 있어요. 언제든 끌 수 있고, 누가 열어 봤는지 남아요. 신고 자료 CSV도 같은 화면에서 받아요.',go:'payroll'},
 {id:'ledger',group:'바로 하기',q:'임금대장 받으려면?',m:[/임금\s*대장/,/받|다운|내려|어디|CSV|엑셀/],a:'급여·명세서 화면 아래 임금대장에서 연도를 고르고 내려받기를 누르면 CSV(엑셀로 열림)로 받아요. 급여를 확정할 때마다 자동으로 쌓여요.',go:'payroll'},
 {id:'excel-staff',group:'바로 하기',q:'직원 엑셀로 한 번에 등록하려면?',m:[/엑셀|여러\s*명|한\s*번에|일괄/,/직원|등록/],a:'직원 관리 > [여러 명 붙여넣기]에서 엑셀 파일(.xlsx·.csv)을 올리거나 표를 붙여 넣으면 미리보기 뒤 한 번에 등록돼요. [엑셀 양식 받기]로 열 순서를 맞추면 편해요.',go:'employees'},
 {id:'invite',group:'바로 하기',q:'직원 초대 링크 보내려면?',m:[/초대|가입\s*링크|가입\s*주소|합류/],a:'직원 가입 주소를 카카오톡으로 보내면 직원이 직접 정보를 넣고 합류를 신청해요. 신청이 오면 홈 맨 위 승인함에서 [수락]만 누르면 돼요.',href:'/staff-requests'},
 {id:'preview-staff',group:'바로 하기',q:'직원 화면은 어떻게 보여?',m:[/직원\s*화면|직원이\s*보는|미리\s*보기/],a:'직원 관리 화면의 [직원 화면 미리보기]를 누르면 그 직원이 보는 예상 급여·근무표·계약서를 그대로 볼 수 있어요.',go:'employees'},
 {id:'add-branch',group:'바로 하기',q:'지점 추가하려면?',m:[/지점|2호점|분점|가게\s*하나/,/추가|늘|만들|하나\s*더/],a:'설정 > 지점 관리에서 새 지점 이름을 넣고 추가해요. 요금은 지점 수 구간으로 정해지니 계정·요금제에서 지점 수도 맞춰 주세요. 지점이 2곳 이상이면 매장 관리·비교에서 나란히 볼 수 있어요.',href:'/app?screen=settings'},
 {id:'manager',group:'바로 하기',q:'매니저한테 일 맡기려면?',m:[/매니저|점장|관리자/,/맡|권한|위임|넘기/],a:'직원 관리에서 그 직원의 권한을 매니저로 바꾸고 맡길 일(출퇴근 수정 승인 등)을 고르면, 매니저는 자기 화면에서 그 일만 처리해요. 급여 확정과 계약은 사장님만 해요.',go:'employees'},
 {id:'leave-approve',group:'바로 하기',q:'휴가 승인은 어디서 해?',m:[/휴가|연차|대타|교대/,/승인|어디|요청|신청/],a:'직원이 올린 휴가와 대타·교대 요청은 휴가·공지 화면에서 승인해요. 대타를 승인하면 근무표가 자동으로 바뀌어요.',go:'operations'},
 {id:'notice',group:'바로 하기',q:'직원들한테 공지하려면?',m:[/공지|알림\s*보내|전달/],a:'휴가·공지 > 매장 공지에 쓰면 직원 앱에 바로 보여요. 알림을 켠 직원 휴대폰에는 알림도 가요.',go:'operations'},
 {id:'manual',group:'바로 하기',q:'매장 매뉴얼 만들려면?',m:[/매뉴얼|업무\s*순서|가이드/],a:'매장 매뉴얼에서 [새 매뉴얼]을 누르고 단계별로 글과 사진을 넣으면 직원 화면 매뉴얼 탭에 바로 보여요. 마감 청소, 포스 사용법처럼 자주 묻는 일을 적어 두세요.',href:'/app?screen=manual'},

 // ── 노무 상식 ──
 {id:'juhu-rule',group:'노무 상식',q:'주휴수당 조건이 뭐야?',m:[/주휴/,/조건|기준|언제|대상|받/],a:'한 주 소정근로시간이 15시간 이상이고, 그 주에 정한 근무일을 모두 나오면 하루치 임금을 주휴수당으로 줘요. 5명 미만 가게도 똑같이 적용돼요.'},
 {id:'juhu-calc',group:'노무 상식',q:'주휴수당 계산 어떻게 해?',m:[/주휴/,/계산|얼마|공식|금액/],a:c=>({lines:[`주휴수당 = (주 소정근로시간 ÷ 40) × 8시간 × 시급이에요. 주 40시간 이상이면 8시간분(최대). 예: 주 20시간·시급 ${won(minWage(c))}원 → 20÷40×8×${won(minWage(c))} = ${won(20/40*8*minWage(c))}원.`,'앱은 직원별로 이 계산을 자동으로 하고, 명세서에 계산 방법을 적어요.']})},
 {id:'min-wage',group:'노무 상식',q:'올해 최저시급 얼마야?',m:[/최저\s*(시급|임금)/,/얼마|올해|내년|금액|몇/],a:c=>{const y=Number(c.date.slice(0,4)),m=minWage(c);return {lines:[`${y}년 최저시급은 ${won(m)}원이에요. 주 40시간 일하는 월급제는 주휴 포함 월 209시간 기준 ${won(m*209)}원 이상이어야 해요.`]}}},
 {id:'overtime',group:'노무 상식',q:'연장근로수당은 언제 줘?',m:[/연장|초과\s*근무|오버\s*타임/],a:'5명 이상 사업장은 하루 8시간 또는 한 주 40시간을 넘긴 시간에 통상임금의 50%를 더 줘요(1.5배). 5명 미만 가게는 가산 의무가 없고 일한 시간만큼 주면 돼요.'},
 {id:'night',group:'노무 상식',q:'야간수당은 몇 시부터야?',m:[/야간/],a:'밤 10시부터 다음 날 아침 6시 사이에 일한 시간이 야간근로예요. 5명 이상 사업장은 그 시간에 50%를 더 줘요. 5명 미만은 가산 의무가 없어요.'},
 {id:'holiday-work',group:'노무 상식',q:'휴일에 일하면 수당 얼마나 더 줘?',m:[/휴일\s*(근로|근무|수당)|휴일에\s*일/],a:'5명 이상 사업장은 휴일에 일한 8시간까지 50%, 8시간을 넘는 시간은 100%를 더 줘요. 5명 미만은 가산 의무가 없어요.'},
 {id:'public-holiday',group:'노무 상식',q:'빨간 날 쉬면 돈 줘야 해?',m:[/빨간\s*날|공휴일|명절|설날|추석/],a:'5명 이상 사업장은 공휴일이 유급휴일이라, 쉬어도 하루치 임금을 주고 일하면 휴일근로수당을 더 줘요. 5명 미만 가게는 공휴일 유급휴일 의무가 없어요.'},
 {id:'mayday',group:'노무 상식',q:'5월 1일 근로자의 날은?',m:[/근로자의\s*날|노동절|5월\s*1일/],a:'5월 1일은 법으로 정한 유급휴일이라 가게 규모와 상관없이 쉬어도 하루치 임금을 줘요. 그날 일하면 5명 이상 사업장은 휴일근로수당(50% 가산)도 더 줘요.'},
 {id:'under5',group:'노무 상식',q:'5인 미만 사업장은 뭐가 달라?',m:[/5\s*(인|명)\s*미만|다섯\s*명\s*미만|작은\s*가게/],a:'5명 미만 가게는 연장·야간·휴일 가산수당, 연차휴가, 공휴일 유급휴일, 부당해고 구제, 주 52시간 제한이 적용되지 않아요. 최저임금, 주휴수당, 퇴직금, 근로계약서, 해고예고, 5월 1일 유급휴일은 똑같이 적용돼요.'},
 {id:'headcount-rule',group:'노무 상식',q:'상시근로자 5명은 어떻게 세?',m:[/상시\s*근로자|5\s*명\s*(이상|넘)|몇\s*명\s*기준/],a:'지난 한 달 동안 일한 사람 수를 날마다 더한 값(연인원)을 그 달 가게를 연 날 수로 나눠요. 알바도 다 셈에 들어가요. 앱의 매장 관리·비교와 설정에서 지난달 기준 계산을 볼 수 있어요.'},
 {id:'break-rule',group:'노무 상식',q:'휴게시간은 얼마나 줘야 해?',m:[/휴게/,/얼마|몇\s*분|시간|줘야|규칙|법/],a:'4시간 일하면 30분 이상, 8시간 일하면 1시간 이상을 근무 중간에 줘야 해요. 휴게시간은 임금에서 빠져요. 앱은 근무표에 휴게를 넣으면 그만큼 빼고 계산해요.'},
 {id:'annual-leave',group:'노무 상식',q:'연차는 며칠 생겨?',m:[/연차|유급\s*휴가/,/며칠|몇\s*일|생겨|발생|계산/],a:'5명 이상 사업장 기준으로, 1년 미만은 한 달 개근할 때마다 1일(최대 11일), 1년 동안 80% 이상 나오면 15일이 생겨요. 3년째부터 2년마다 1일씩 늘어 최대 25일이에요. 주 15시간 미만이거나 5명 미만 가게는 연차 의무가 없어요.'},
 {id:'severance',group:'노무 상식',q:'퇴직금 대상이 누구야?',m:[/퇴직금/,/대상|조건|누구|받/],a:'1년 이상 일했고 4주 평균 주 15시간 이상 일한 직원이 대상이에요. 가게 규모와 상관없이 적용돼요. 퇴직 후 14일 안에 줘야 해요.'},
 {id:'severance-calc',group:'노무 상식',q:'퇴직금 계산 어떻게 해?',m:[/퇴직금/,/계산|얼마|공식/],a:'퇴직금 = 1일 평균임금 × 30일 × (일한 날 ÷ 365)예요. 평균임금은 그만두기 전 3개월 임금 합계를 그 기간 날 수로 나눠요. 앱의 퇴직금 확인 화면에서 직원을 고르면 계산해 줘요.',go:'employees'},
 {id:'dismiss',group:'노무 상식',q:'직원 해고하려면 어떻게 해?',m:[/해고|자르|그만\s*두게/],a:'해고하려면 30일 전에 알리거나, 바로 내보내면 30일분 통상임금(해고예고수당)을 줘야 해요. 일한 지 3개월이 안 됐으면 예외예요. 5명 이상 사업장은 정당한 이유와 서면 통지도 필요해요. '+ask},
 {id:'resign',group:'노무 상식',q:'직원이 갑자기 그만두면?',m:[/갑자기|무단/,/그만|퇴사|안\s*나와/],a:'직원이 갑자기 그만둬도 일한 만큼의 임금과 주휴수당은 퇴사 후 14일 안에 줘야 해요. 손해를 임금에서 마음대로 빼면 안 돼요. 앱에서는 직원 상태를 퇴사로 바꾸면 접근이 끝나고 기록은 남아요.'},
 {id:'contract-penalty',group:'노무 상식',q:'근로계약서 안 쓰면 어떻게 돼?',m:[/계약서/,/안\s*쓰|미작성|벌금|과태료|꼭/],a:'근로계약서를 쓰고 직원에게 주지 않으면 500만원 이하 벌금 대상이에요. 알바·단시간도 똑같아요. 임금·근로시간·휴일·휴가·일하는 곳·하는 일이 들어가야 해요. 앱은 고용노동부 표준 양식으로 만들고 양쪽이 휴대폰으로 서명해요.',href:'/contracts'},
 {id:'payslip-law',group:'노무 상식',q:'급여명세서 꼭 줘야 해?',m:[/명세서/,/꼭|의무|과태료|안\s*주|법/],a:'2021년 11월부터 모든 사업장은 임금을 줄 때 명세서를 줘야 해요. 안 주면 과태료 대상이에요. 성명, 지급일, 총액, 항목별 금액, 계산 방법, 공제 내역이 들어가야 하고, 앱 명세서는 이 항목을 다 넣어요.'},
 {id:'pay-day',group:'노무 상식',q:'월급날 늦게 줘도 돼?',m:[/월급날|급여일|지급일/,/늦|미루|밀|어기/],a:'임금은 매달 정한 날에 한 번 이상 전액을 줘야 해요. 늦으면 임금체불이 되고, 퇴사자는 14일 안에 줘야 해요. 사정이 생기면 직원과 미리 합의하세요.'},
 {id:'insurance-rule',group:'노무 상식',q:'알바도 4대보험 들어야 해?',m:[/4대\s*보험|사대\s*보험|국민연금|건강보험|고용보험|산재/,/알바|단시간|들어야|가입|기준/],a:'산재보험은 모든 직원이 대상이에요. 국민연금·건강보험·고용보험은 원칙적으로 월 60시간(주 15시간) 이상 일하면 가입해야 해요. 고용보험은 그보다 적게 일해도 3개월 넘게 계속 일하면 대상이 될 수 있어요. '+ask},
 {id:'insurance-report',group:'노무 상식',q:'4대보험 신고 언제까지 해?',m:[/취득|상실|신고/,/보험|취득|상실/],a:'직원이 들어오면 입사한 날이 속한 달의 다음 달 15일까지 취득 신고, 그만두면 다음 달 15일까지 상실 신고를 해요. 4대사회보험 정보연계센터에서 한 번에 할 수 있어요.'},
 {id:'durunuri',group:'노무 상식',q:'두루누리 지원받을 수 있어?',m:[/두루누리|보험료\s*지원/],a:'근로자 10명 미만 사업장에서 월 보수가 일정 금액 미만인 신규 가입자는 고용보험·국민연금 보험료의 일부를 지원받을 수 있어요. 기준 금액과 비율은 해마다 바뀌니 근로복지공단(1588-0075)에서 확인하세요.'},
 {id:'three-three',group:'노무 상식',q:'3.3% 떼면 되는 거 아냐?',m:[/3\.3|삼쩜삼|프리랜서|사업소득/],a:'3.3%는 진짜 개인사업자(프리랜서)에게만 쓰는 방식이에요. 정해진 시간에 사장님 지시를 받고 일하는 알바는 근로자라서, 3.3%로 처리해도 주휴·퇴직금·4대보험 의무가 그대로 있어요. 앱은 3.3%를 고를 때 사업소득이 맞는지 확인하게 해요.'},
 {id:'probation',group:'노무 상식',q:'수습 기간엔 최저임금 덜 줘도 돼?',m:[/수습/],a:'1년 이상 계약한 직원은 수습 3개월 동안 최저임금의 90%까지 줄 수 있어요. 다만 편의점·음식점 서빙처럼 단순한 일은 수습이어도 깎을 수 없어요. 1년 미만 계약도 깎을 수 없어요.'},
 {id:'minor-rule',group:'노무 상식',q:'고등학생 알바 쓸 때 주의할 점은?',m:[/고등학생|청소년|미성년|18세/,/주의|알바|쓰|채용|규칙/],a:'18세 미만은 가족관계증명서와 친권자 동의서를 받아 두고, 하루 7시간·주 35시간까지만 일해요(합의하면 하루 1시간·주 5시간 더). 밤 10시~아침 6시와 휴일 근무는 본인 동의와 노동부 인가가 필요해요. 15세 미만은 취직인허증이 있어야 해요. 최저임금은 어른과 같아요.'},
 {id:'late-deduct',group:'노무 상식',q:'지각하면 월급에서 빼도 돼?',m:[/지각|늦/,/빼|공제|깎|벌금/],a:'늦은 시간만큼 일하지 않은 시간의 임금을 빼는 건 괜찮아요. 하지만 지각비·벌금을 따로 떼는 건 안 돼요. 앱은 실제 출퇴근 기록으로 일한 시간만 계산해요.'},
 {id:'absence-juhu',group:'노무 상식',q:'결근하면 주휴수당 안 줘도 돼?',m:[/결근|빠지|안\s*나온/,/주휴/],a:'그 주에 정한 근무일 중 하루라도 무단결근하면 그 주 주휴수당은 안 줘도 돼요. 지각·조퇴는 결근이 아니라서 주휴가 그대로 생겨요.'},
 {id:'meal',group:'노무 상식',q:'식대도 월급에 넣을 수 있어?',m:[/식대|밥값|식비/],a:'식대는 월 20만원까지 세금이 붙지 않아요(비과세). 매달 정해서 주는 식대는 최저임금 계산에도 들어가요. 앱에서는 급여 화면에서 수당 항목으로 넣으면 돼요.'},
 {id:'week-52',group:'노무 상식',q:'일주일에 최대 몇 시간 일할 수 있어?',m:[/최대|몇\s*시간까지|한도/,/일주일|주|근무/],a:'기본 주 40시간에 합의하면 연장 12시간까지, 모두 주 52시간이 한도예요(5명 이상 사업장). 5명 미만 가게는 이 제한이 없지만 너무 길면 사고 위험이 커요.'},
 {id:'shutdown',group:'노무 상식',q:'가게 사정으로 쉬게 하면 돈 줘야 해?',m:[/휴업|문\s*닫|장사\s*안|쉬게/],a:'가게 사정(손님이 없어서, 공사 등)으로 쉬게 하면 5명 이상 사업장은 평균임금의 70% 이상을 휴업수당으로 줘야 해요. 5명 미만 가게는 의무가 없어요. '+ask},
 {id:'maternity',group:'노무 상식',q:'출산휴가는 며칠이야?',m:[/출산|임신|육아\s*휴직/],a:'출산 전후로 90일(쌍둥이 이상 120일)을 쉴 수 있고, 가게 규모와 상관없이 적용돼요. 급여 일부는 고용보험에서 나와요. 육아휴직도 신청할 수 있어요. 자세한 금액은 고용센터(1350)에 확인하세요.'},
 {id:'rules-10',group:'노무 상식',q:'취업규칙 만들어야 해?',m:[/취업\s*규칙|사규/],a:'상시 10명 이상 사업장은 취업규칙을 만들어 고용노동부에 신고해야 해요. 10명 미만이면 의무는 아니지만 지각·휴가 기준을 매장 매뉴얼에 적어 두면 다툼이 줄어요.'},
 {id:'harassment',group:'노무 상식',q:'직원끼리 괴롭힘 문제가 생기면?',m:[/괴롭힘|갑질|폭언|성희롱/],a:'신고를 받으면 바로 사실을 확인하고, 피해 직원을 가해자와 떨어뜨려(근무 시간 분리 등) 보호해야 해요. 신고했다고 불리하게 대하면 안 돼요. 고용노동부 상담센터(1350)에서 절차를 안내받을 수 있어요.'},
 {id:'records-keep',group:'노무 상식',q:'서류는 얼마나 보관해야 해?',m:[/보관|보존/,/서류|기간|얼마|몇\s*년/],a:'근로계약서, 임금대장, 출퇴근 기록 같은 노무 서류는 3년 동안 보관해야 해요. 앱은 기록을 지우지 않고 남겨 두고, 언제든 내려받을 수 있어요.'},
 {id:'withholding',group:'노무 상식',q:'원천세 신고는 언제 해?',m:[/원천세|원천\s*징수|세금\s*신고/],a:'직원 급여에서 뗀 소득세는 원칙적으로 지급한 달의 다음 달 10일까지 신고·납부해요(작은 사업장은 반기 납부를 신청할 수도 있어요). 연말정산은 다음 해 2월 급여 때 해요. 정확한 건 세무사와 확인하세요.'},
 {id:'income-tax',group:'노무 상식',q:'알바 급여에서 소득세 떼야 해?',m:[/소득세|간이\s*세액/],a:'4대보험에 가입한 근로자는 간이세액표에 따라 소득세를 떼요. 급여가 적으면 0원이 나오기도 해요. 일용직은 하루 15만원까지 소득세가 없어요. 앱은 간이세액표로 자동 계산해요.'},
 {id:'daily-worker',group:'노무 상식',q:'하루만 일하는 사람은 어떻게 처리해?',m:[/하루만|일용|단기|일당/],a:'하루 단위로 고용하면 일용근로자예요. 그래도 근로계약서(일용 양식)를 쓰고, 일당이 최저시급×일한 시간 이상이어야 해요. 일용직 소득세는 하루 15만원 넘는 부분에만 붙어요.'},
 {id:'two-jobs',group:'노무 상식',q:'다른 데서도 일하는 알바는?',m:[/투잡|다른\s*(데|곳|가게)|겸업/],a:'다른 곳에서도 일해도 우리 가게 근무시간만 따로 봐요. 주휴·퇴직금·4대보험 기준(주 15시간)도 우리 가게 시간으로 판단해요.'},
 {id:'swap-pay',group:'노무 상식',q:'대타 근무 급여는 누구한테 줘?',m:[/대타/,/급여|돈|누구|시급|임금/],a:'실제로 일한 사람에게 그 시간만큼 줘요. 앱에서 대타를 승인하면 근무표가 바뀌고, 출퇴근 기록대로 급여가 계산돼요.'},
 {id:'cctv',group:'노무 상식',q:'CCTV로 출근 확인해도 돼?',m:[/CCTV|씨씨티비|카메라/],a:'CCTV를 근태 확인에 쓰려면 직원에게 미리 알리고 동의를 받는 게 안전해요. 앱의 매장 QR은 위치나 영상을 저장하지 않고 출퇴근 시각만 남겨요.'},
 {id:'wage-down',group:'노무 상식',q:'시급 내려도 돼?',m:[/시급|임금|월급/,/내려|깎|줄이|삭감/],a:'근로조건을 낮추려면 직원의 동의가 필요하고, 새 근로계약서를 써야 해요. 최저임금 아래로는 동의해도 안 돼요.'},
 {id:'labor-office',group:'노무 상식',q:'노동청에 신고당하면 어떻게 해?',m:[/노동청|진정|신고\s*당/],a:'출석 요구가 오면 근로계약서, 임금대장, 명세서, 출퇴근 기록을 챙겨 가세요. 앱에서 모두 내려받을 수 있어요. 금액이 맞지 않으면 차액을 정리하는 게 가장 빨라요. '+ask},
 {id:'retire-paper',group:'노무 상식',q:'퇴사 처리 순서 알려줘',m:[/퇴사/,/처리|순서|절차|할\s*일/],a:'① 마지막 근무일 확인 → ② 마지막 급여와 남은 연차수당·퇴직금 계산(14일 안에 지급) → ③ 4대보험 상실 신고(다음 달 15일까지) → ④ 원하면 경력증명서 발급. 앱 직원 관리의 퇴사 처리에서 차례대로 안내해요.',go:'employees'},

 // ── 앱 사용법 ──
 {id:'qr-setup',group:'앱 사용법',q:'출퇴근 QR 어떻게 설치해?',m:[/QR|큐알/,/설치|붙|인쇄|어떻게|만들/],a:'출퇴근 기록 화면의 [출퇴근 QR]을 눌러 이미지를 저장하고 인쇄해 매장에 붙이세요. 직원은 출근·퇴근·휴게 때 이 QR을 찍어야 기록돼요. 태블릿이 있으면 30초마다 바뀌는 QR을 띄워 사진으로 찍어 두는 걸 막을 수 있어요.',go:'attendance'},
 {id:'qr-dynamic',group:'앱 사용법',q:'대리 출근 막을 수 있어?',m:[/대리|대신\s*찍|사진으로\s*찍|부정/],a:'30초마다 바뀌는 QR을 켜고 매장 태블릿이나 PC에 띄워 두면, QR 사진으로 다른 곳에서 찍을 수 없어요. 출퇴근 QR 화면에서 켤 수 있어요.',go:'attendance'},
 {id:'break-how',group:'앱 사용법',q:'직원 휴게는 어떻게 기록돼?',m:[/휴게/,/기록|어떻게|버튼|직원/],a:'직원이 휴게 시작을 누르고 시간(근무표 기준·30분·60분)을 고른 뒤 매장 QR을 찍어요. 고른 시간이 지나면 저절로 끝나서, 휴게 끝을 잊어도 그 시간만 빠져요. 일찍 돌아오면 QR을 찍고 일찍 끝내요.'},
 {id:'correction-how',group:'앱 사용법',q:'출퇴근 잘못 찍은 거 고치려면?',m:[/잘못|틀|실수/,/찍|기록|출근|퇴근/],a:'출퇴근 기록 화면에서 그 줄의 [수정 요청]으로 맞는 시각을 넣고, 수정 승인함에서 승인하면 바뀌어요. 직원도 자기 화면에서 수정 요청을 보낼 수 있어요. 누가 언제 바꿨는지 변경 이력에 남아요.',go:'attendance'},
 {id:'send-how',group:'앱 사용법',q:'명세서는 어떻게 보내?',m:[/명세서/,/어떻게|방법|보내는/],a:'급여를 확정한 뒤 급여·명세서 화면 아래에서 [직원 앱으로 보내기]를 누르면 직원 휴대폰에 알림과 함께 가요. 이메일은 필요 없어요. 저에게 "명세서 다 보내줘"라고 해도 돼요.',go:'payroll'},
 {id:'esign',group:'앱 사용법',q:'전자계약 서명은 어떻게 해?',m:[/서명|전자\s*계약|사인/],a:'계약서 화면에서 직원을 고르면 입력된 근로조건으로 계약서가 만들어져요. 사장님이 먼저 서명하면 직원 앱으로 가고, 직원이 휴대폰으로 서명하면 양쪽에 사본이 남아요.',href:'/contracts'},
 {id:'plan',group:'앱 사용법',q:'요금이 얼마야?',m:[/요금|가격|비용|얼마\s*내/],a:'베이직 월 9,900원부터, 매장 QR 출퇴근이 들어간 프로 월 14,900원부터예요(1지점, VAT 포함). 직원 수 제한은 없고, 지점 수로만 정해져요. 6개월 10%, 12개월 20% 할인이에요.',href:'/account'},
 {id:'pay-how',group:'앱 사용법',q:'결제는 어디서 해?',m:[/결제|카드\s*등록|구독/],a:'계정·요금제 화면의 결제하기에서 해요. 지금은 결제 연결을 준비하는 중이라, 체험은 결제 없이 그대로 쓸 수 있어요.',href:'/account'},
 {id:'trial-end',group:'앱 사용법',q:'무료 체험 끝나면 어떻게 돼?',m:[/체험|무료/,/끝|종료|지나|이후/],a:'30일 체험이 끝나도 자동으로 결제되지 않아요. 기록 보기와 내려받기는 계속되고, 새로 저장하는 것만 결제 뒤에 다시 돼요. 데이터를 지우지 않아요.',href:'/account'},
 {id:'export',group:'앱 사용법',q:'데이터 다 내려받을 수 있어?',m:[/내려|백업|다운|엑셀로/,/데이터|기록|전부|다/],a:'설정 화면의 내려받기에서 직원·근무표·출퇴근·급여 기록을 파일로 받을 수 있어요. 언제든 받아 두세요.',href:'/app?screen=settings'},
 {id:'withdraw',group:'앱 사용법',q:'탈퇴하려면?',m:[/탈퇴|계정\s*삭제|그만\s*쓸/],a:'계정 화면의 탈퇴에서 예약할 수 있어요. 예약하면 정해진 날까지 읽기 전용으로 남아 있고, 그 전에 취소할 수 있어요. 직원에게는 서류를 내려받으라고 안내가 가요.',href:'/withdraw'},
 {id:'password',group:'앱 사용법',q:'비밀번호를 잊어버렸어',m:[/비밀번호|비번/],a:'로그인 화면의 비밀번호 찾기에서 요청하면 본사가 확인한 뒤 임시 비밀번호를 알려 드려요. 직원 비밀번호는 사장님이 직원 관리에서 초기화할 수 있어요.',href:'/login'},
 {id:'big-text',group:'앱 사용법',q:'글씨가 너무 작아',m:[/글씨|글자/,/작|크게|키워/],a:'화면 맨 위의 [가 크게] 버튼을 누르면 글씨가 커져요. 이 기기에 기억돼요.'},
 {id:'install',group:'앱 사용법',q:'앱 설치는 어떻게 해?',m:[/설치|홈\s*화면|아이콘|앱으로/],a:'앱스토어 설치 없이 휴대폰 브라우저에서 열어요. 화면 위의 [앱 설치] 또는 브라우저 메뉴의 "홈 화면에 추가"를 누르면 아이콘이 생겨요.'},
 {id:'push',group:'앱 사용법',q:'알림은 어떻게 켜?',m:[/알림|푸시/,/켜|받|설정|안\s*와/],a:'직원 화면 오늘 탭 아래의 알림 켜기를 누르고 브라우저 허용을 누르면 명세서·공지·승인 결과 알림이 와요. 아이폰은 홈 화면에 추가한 앱에서만 알림이 와요.'},
 {id:'multi-store',group:'앱 사용법',q:'매장 여러 개 한 번에 보려면?',m:[/매장\s*여러|여러\s*(매장|지점)|비교|전체\s*매장/],a:'매장 관리·비교 화면에서 지점별 근무시간과 인건비를 나란히 볼 수 있어요. 왼쪽 위 지점 선택으로 매장을 바꿔요.',href:'/app?screen=stores'},
 {id:'what-can',group:'앱 사용법',q:'너 뭐 할 수 있어?',m:[/뭐\s*(할|해)|할\s*수\s*있|기능|도움말|사용법/],a:()=>({lines:['가게 기록을 읽고 답하고, 말로 시키면 [실행] 한 번으로 처리해요. 이렇게 말해 보세요.','· 김민지 시급 10500 · 김민지 내일 9시부터 6시 근무','· 명세서 다 보내줘 · 김민지 명세서 보여줘 · QR 띄워줘','· 오늘 누가 일해? · 누가 지각했어? · 이번 달 인건비 · 분석해줘','· 주휴수당 조건 · 퇴직금 계산 · 4대보험 기준','한 번 말한 직원은 기억해서, 다음엔 이름 없이 "시급 11000"처럼 말해도 돼요. 아래 [물어볼 수 있는 것]에서 전체 목록을 볼 수 있어요.']})},
];

/** 가장 잘 맞는 항목. 없으면 null */
export function matchKB(text:string):Item|null{
 let best:Item|null=null;
 for(const it of KB)if(it.m.every(r=>r.test(text))&&(!best||it.m.length>best.m.length))best=it;
 return best;
}
export function answerKB(it:Item,c:Ctx):{lines:string[],actions:Action[]}{
 const out=typeof it.a==='string'?{lines:[it.a],actions:[] as Action[]}:it.a(c);
 const actions=[...(out.actions||[])];
 if(it.go&&!actions.length)actions.push(go(it.go,({attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄',reports:'인건비 리포트'} as Record<Target,string>)[it.go]+' 열기'));
 if(it.href&&!actions.length)actions.push(link(it.href,'바로 가기'));
 return {lines:out.lines,actions};
}
