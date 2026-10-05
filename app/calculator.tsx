// 작업 032: 로그인 없이 쓰는 주휴수당·인건비 계산기
import {useMemo,useState} from 'react';
import {estimateLabor} from '../lib/labor-estimate';
import {ratesFor} from '../lib/pay-rules';

const won=(n:number)=>Math.round(n).toLocaleString('ko-KR');
export function Calculator(){
 const year=new Date().getFullYear(),min=ratesFor(year).minimumWage;
 const [wage,setWage]=useState(String(min)),[daily,setDaily]=useState('5'),[days,setDays]=useState('5'),[night,setNight]=useState('0'),[five,setFive]=useState(false),[ded,setDed]=useState<'none'|'3.3'|'insurance'>('insurance'),[ind,setInd]=useState(''),[people,setPeople]=useState('1');
 const e=useMemo(()=>estimateLabor({wage:Number(wage),dailyHours:Number(daily),days:Number(days),nightHours:Number(night),fivePlus:five,deduction:ded,industrialRate:Number(ind)/100||0,year,people:Number(people)}),[wage,daily,days,night,five,ded,ind,people,year]);
 const num=(label:string,v:string,set:(s:string)=>void,props:any={})=><label className="calc-field">{label}<input type="number" inputMode="decimal" value={v} onChange={x=>set(x.target.value)} {...props}/></label>;
 return <main className="calc">
  <header><span className="saas-kicker">무료 계산기 · 로그인 없이</span><h1>주휴수당·인건비 계산기</h1><p>시급과 근무 시간을 넣으면 주휴수당, 월 예상 급여, 사장님이 내는 4대보험까지 바로 계산해요. {year}년 최저시급 {won(min)}원 기준.</p></header>
  <div className="calc-grid">
   <section className="auth-card calc-inputs" aria-label="근무 조건">
    {num('시급 (원)',wage,setWage,{min:0,step:10})}
    {e.belowMinimum&&<p className="t-warn" role="alert">{year}년 최저시급 {won(min)}원보다 낮아요.</p>}
    <div className="calc-two">{num('하루 근무시간 (휴게 제외)',daily,setDaily,{min:0,max:24,step:0.5})}{num('주 근무일수',days,setDays,{min:0,max:7,step:1})}</div>
    <label className="saas-check calc-check"><input type="checkbox" checked={five} onChange={x=>setFive(x.target.checked)}/><span>상시 직원 5명 이상 사업장(연장·야간 50% 가산)</span></label>
    {five&&num('주당 야간근무 시간 (22~06시)',night,setNight,{min:0,step:0.5})}
    <fieldset className="calc-ded"><legend>공제</legend>{([['insurance','4대보험'],['3.3','3.3% (사업소득)'],['none','없음']] as const).map(([k,l])=><label key={k} className={ded===k?'selected':''}><input type="radio" name="ded" checked={ded===k} onChange={()=>setDed(k)}/>{l}</label>)}</fieldset>
    {ded==='insurance'&&num('산재보험료율 (%, 업종별)',ind,setInd,{min:0,max:20,step:0.01,placeholder:'예: 0.9'})}
    {num('같은 조건 직원 수',people,setPeople,{min:1,step:1})}
   </section>
   <section className="auth-card calc-result" aria-live="polite" aria-label="계산 결과">
    <h2>한 달 예상</h2>
    <div className="calc-big"><span>직원 1명 월 급여</span><strong>{won(e.month.gross)}원</strong></div>
    <dl>
     <div><dt>주 근로시간</dt><dd>{e.weeklyHours}시간</dd></div>
     <div><dt>주휴수당</dt><dd>{e.juhuEligible?`주 ${won(e.week.juhu)}원 (${e.juhuHours.toFixed(1)}시간분)`:'없음 · 주 15시간 미만'}</dd></div>
     {five&&<div><dt>연장·야간 가산(주)</dt><dd>{won(e.week.overtime+e.week.night)}원</dd></div>}
     <div><dt>주급 합계</dt><dd>{won(e.week.total)}원</dd></div>
     <div><dt>직원 공제(월)</dt><dd>{won(e.month.employeeDeduction)}원</dd></div>
     <div><dt>직원 실수령(월)</dt><dd><b>{won(e.month.net)}원</b></dd></div>
     {ded==='insurance'&&<div><dt>사장님 부담 4대보험(월)</dt><dd>{won(e.month.employerInsurance)}원</dd></div>}
     <div className="calc-total"><dt>사장님 총 인건비(월)</dt><dd>{won(e.month.laborCost)}원</dd></div>
     {e.people>1&&<div className="calc-total"><dt>직원 {e.people}명 합계(월)</dt><dd>{won(e.total.laborCost)}원</dd></div>}
    </dl>
    {e.pensionHealthExcluded&&<p className="footnote">월 60시간 미만 근무라 국민연금·건강보험은 보통 적용 제외로 계산했어요(고용·산재는 적용).</p>}
    <p className="footnote">한 달 = 4.345주로 환산. 주휴수당은 소정근로일을 개근한 주에 생겨요. 근로소득세·휴일근로·국민연금 상·하한은 넣지 않은 간단 계산이에요. 실제 급여는 출퇴근 기록으로 계산해야 정확해요.</p>
    <a className="saas-primary" href="/signup?role=owner">이 조건으로 30일 무료 시작 →</a><button type="button" className="saas-secondary" onClick={()=>shareResult({wage:Number(wage),daily:Number(daily),days:Number(days),year,e})}>계산 결과 이미지로 저장·공유</button>
   </section>
  </div>
 </main>;
}

/** 가이드 52: 계산 결과를 이미지(PNG)로 만들어 휴대폰 공유창으로 보내거나 저장 */
async function shareResult({wage,daily,days,year,e}:{wage:number,daily:number,days:number,year:number,e:any}){
 const W=720,H=860,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d')!;
 g.fillStyle='#f7f9f8';g.fillRect(0,0,W,H);g.fillStyle='#12634b';g.fillRect(0,0,W,120);
 g.fillStyle='#fff';g.font='bold 40px sans-serif';g.fillText('주휴수당·인건비 계산',40,75);
 g.fillStyle='#17251f';g.font='28px sans-serif';g.fillText(`시급 ${won(wage)}원 · 하루 ${daily}시간 · 주 ${days}일`,40,180);
 const rows:[string,string][]=[['주휴수당(1주)',won(e.week.juhu)+'원'],['1주 합계',won(e.week.total)+'원'],['월 급여(세전)',won(e.month.gross)+'원'],['직원 공제',won(e.month.employeeDeduction)+'원'],['직원 실수령',won(e.month.net)+'원'],['사장님 부담 4대보험',won(e.month.employerInsurance)+'원'],['월 총 인건비',won(e.month.laborCost)+'원']];
 rows.forEach(([k,v],i)=>{const y=260+i*72;g.fillStyle=i===6?'#e6f2ec':'#fff';g.fillRect(40,y-44,W-80,60);g.fillStyle='#526359';g.font='26px sans-serif';g.fillText(k,64,y);g.fillStyle='#17251f';g.font='bold 30px sans-serif';const tw=g.measureText(v).width;g.fillText(v,W-64-tw,y)});
 g.fillStyle='#526359';g.font='22px sans-serif';g.fillText(`${year}년 최저임금·4대보험 요율 기준 · 참고용 추정`,40,H-70);g.fillText('chukchukapp.kr/calculator',40,H-36);
 const blob:Blob|null=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)return;
 const file=new File([blob],'인건비계산.png',{type:'image/png'});
 try{if((navigator as any).canShare?.({files:[file]})){await navigator.share({files:[file],title:'주휴수당·인건비 계산'});return}}catch(err){if((err as Error)?.name==='AbortError')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='인건비계산.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
