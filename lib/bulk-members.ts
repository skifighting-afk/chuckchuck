// 작업 054: 엑셀에서 복사한 표(탭 구분)를 직원 여러 명으로. 줄마다 오류를 알려 준다.
import {newMember,type Member} from './team-model';
export const BULK_COLUMNS=['이름','연락처','이메일','입사일','급여형태','급여','주 소정시간','직무'] as const;
export type BulkRow={line:number,member?:Member,errors:string[],raw:string[]};
const num=(v:string)=>Number(String(v).replace(/[,원\s]/g,''));
function day(v:string){const t=v.trim().replace(/[./]/g,'-').replace(/\s/g,'');const m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return '';const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return !isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:''}
export function parseBulk(text:string,branchId:string,existingEmails:string[]=[],defaults:{workplace?:string,employer?:string}={},max=150):BulkRow[]{
 const lines=text.replace(/\r/g,'').split('\n').map((l,i)=>({i:i+1,cells:l.split('\t').map(c=>c.trim())})).filter(l=>l.cells.some(Boolean));
 if(lines.length&&lines[0].cells[0]==='이름')lines.shift();
 const seen=new Set(existingEmails.map(e=>e.toLowerCase()).filter(Boolean)),out:BulkRow[]=[];
 for(const {i,cells} of lines.slice(0,max)){
  const [name='',phone='',email='',joined='',payType='',wage='',hours='',role='']=cells,errors:string[]=[];
  if(!name)errors.push('이름이 비어 있어요');else if(name.length>50)errors.push('이름이 너무 길어요');
  const em=email.toLowerCase();if(!em)errors.push('이메일이 비어 있어요(직원 앱 연결에 필요)');else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))errors.push('이메일 형식이 맞지 않아요');else if(em&&seen.has(em))errors.push('이미 등록된(또는 위 줄과 같은) 이메일이에요');
  const j=joined?day(joined):new Date().toISOString().slice(0,10);if(joined&&!j)errors.push('입사일은 2026-10-05 형식으로 써 주세요');
  const pt=(payType||'시급') as Member['payType'];if(!['시급','월급','일급'].includes(pt))errors.push('급여형태는 시급·월급·일급 중 하나예요');
  const w=num(wage);if(!wage||!Number.isInteger(w)||w<1||w>100000000)errors.push('급여는 숫자로 써 주세요');
  const h=hours?num(hours):(pt==='월급'?40:20);if(!(h>=0&&h<=80))errors.push('주 소정시간은 0~80 사이예요');
  const r=(role||'홀') as Member['role'];if(!['홀','주방','매니저'].includes(r))errors.push('직무는 홀·주방·매니저 중 하나예요');
  if(!phone)errors.push('연락처가 비어 있어요');else if(phone.length>30)errors.push('연락처가 너무 길어요');
  if(errors.length){out.push({line:i,errors,raw:cells});continue}
  if(em)seen.add(em);
  const m=newMember(branchId);m.contract={...m.contract,workplace:defaults.workplace||'',employer:defaults.employer||''};Object.assign(m,{name,phone,email:em,joined:j,payType:pt,wage:w,weeklyHours:h,role:r,employment:h>=40?'기간의 정함 없음':'단시간'});
  out.push({line:i,member:m,errors:[],raw:cells});
 }
 return out;
}
