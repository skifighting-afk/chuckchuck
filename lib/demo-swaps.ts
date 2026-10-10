// 체험 매장 전용. 네트워크·영구 저장 없이 실제 요청 UI의 상태 전이를 실행한다.
export function applyDemoSwap(team:any,ops:any,b:any,actor:{selfId:string|null,today:string,now:string}) {
 const nextTeam=structuredClone(team),nextOps=structuredClone(ops),owner=!actor.selfId;
 const fail=(s:string):never=>{throw Error(s)};
 const employee=(id:string)=>team.employees.find((e:any)=>e.id===id&&e.status!=='퇴사');
 const snap=(s:any)=>({...s,name:employee(s.employeeId)?.name||''});
 const same=(s:any,t:any)=>!!s&&['id','employeeId','date','start','end'].every(k=>s[k]===t[k]);
 const span=(s:any)=>{const start=Date.parse(s.date+'T'+s.start+':00Z'),end=Date.parse(s.date+'T'+s.end+':00Z');return [start,end<=start?end+86400000:end]};
 const check=(id:string,s:any,ignore:string[])=>{
  const e=employee(id);if(!e||e.branchId!==employee(s.employeeId)?.branchId)fail('같은 지점 재직 직원만 맡을 수 있어요.');
  if(Object.values(team.payrollRuns||{}).some((r:any)=>r.locked&&r.month===s.date.slice(0,7)&&r.rows?.some((x:any)=>[id,s.employeeId].includes(x.employeeId))))fail('급여가 확정된 달이에요.');
  if(ops.leaves.some((l:any)=>l.status==='승인'&&l.employeeId===id&&s.date>=l.start&&s.date<=l.end))fail('승인된 휴가가 있어요.');
  const [a,z]=span(s);if(team.shifts.some((x:any)=>x.employeeId===id&&!ignore.includes(x.id)&&(()=>{const [c,d]=span(x);return a<d&&c<z})()))fail('겹치는 근무가 있어요.');
 };
 if(b.action==='requestSwap'){
  const s=team.shifts.find((s:any)=>s.id===b.shiftId);if(!s||s.date<actor.today)fail('오늘 이후 근무를 골라 주세요.');
  if(!owner&&s.employeeId!==actor.selfId)fail('본인 근무만 요청할 수 있어요.');
  if(!['대타','교대'].includes(b.kind)||!b.reason?.trim()||b.reason.length>500)fail('종류와 사유를 입력해 주세요.');
  if(ops.swaps.some((w:any)=>w.shift.id===s.id&&['구하는 중','승인 대기'].includes(w.status)))fail('이미 요청 중인 근무예요.');
  const target=b.targetId&&employee(b.targetId);if(b.targetId&&(!target||target.id===s.employeeId||target.branchId!==employee(s.employeeId)?.branchId))fail('같은 지점 동료를 골라 주세요.');
  nextOps.swaps.push({id:crypto.randomUUID(),kind:b.kind,branchId:employee(s.employeeId)?.branchId,shift:snap(s),targetId:target?.id||null,targetName:target?.name||'',reason:b.reason.trim(),status:'구하는 중',at:actor.now,by:employee(s.employeeId)?.name});
 }else{
  const w=nextOps.swaps.find((w:any)=>w.id===b.id);if(!w)fail('요청을 찾을 수 없어요.');
  const s=team.shifts.find((s:any)=>s.id===w.shift.id);
  if(b.action==='cancelSwap'){
   if(!owner&&w.shift.employeeId!==actor.selfId)fail('요청한 본인이나 사장님만 취소할 수 있어요.');
   if(!['구하는 중','승인 대기'].includes(w.status))fail('이미 처리된 요청이에요.');w.status='취소';
  }else if(b.action==='acceptSwap'){
   const who=owner?b.employeeId:actor.selfId;if(w.status!=='구하는 중')fail('이미 처리된 요청이에요.');
   if(!who||who===w.shift.employeeId)fail('다른 동료가 수락해야 해요.');if(w.targetId&&w.targetId!==who)fail('지정된 동료만 수락할 수 있어요.');
   if(!same(s,w.shift))fail('요청 이후 근무가 바뀌었어요.');
   const counter=w.kind==='교대'?team.shifts.find((x:any)=>x.id===b.myShiftId&&x.employeeId===who&&x.date>=actor.today):null;
   if(w.kind==='교대'&&!counter)fail('바꿔 줄 본인 근무를 골라 주세요.');
   check(who,s,counter?[counter.id]:[]);if(counter)check(w.shift.employeeId,counter,[s.id]);
   w.taker={id:who,name:employee(who)?.name,at:actor.now};w.counter=counter?snap(counter):null;w.status='승인 대기';
  }else if(b.action==='reviewSwap'){
   if(!owner)fail('사장님만 승인할 수 있어요.');if(w.status!=='승인 대기'||typeof b.approve!=='boolean')fail('이미 처리된 요청이에요.');
   if(!b.approve&&!b.comment?.trim())fail('반려 사유를 적어 주세요.');
   if(b.approve){
    if(!same(s,w.shift))fail('요청 이후 근무가 바뀌었어요.');
    const c=w.counter&&team.shifts.find((x:any)=>x.id===w.counter.id);if(w.counter&&!same(c,w.counter))fail('바꿀 근무가 바뀌었어요.');
    check(w.taker.id,s,c?[c.id]:[]);if(c)check(w.shift.employeeId,c,[s.id]);
    nextTeam.shifts=nextTeam.shifts.map((x:any)=>x.id===s.id?{...x,employeeId:w.taker.id}:c&&x.id===c.id?{...x,employeeId:w.shift.employeeId}:x);
   }
   w.status=b.approve?'승인':'반려';w.reviewedAt=actor.now;w.reviewer='예시 사장님';w.comment=b.comment||'';
  }else fail('지원하지 않는 체험 동작이에요.');
 }
 return {team:nextTeam,ops:nextOps};
}
