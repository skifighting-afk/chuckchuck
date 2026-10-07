// 지시서 '다음' 매장 운영 묶음: 054 교대 인수인계 · 063 위생·온도 기록 · 064 시재 마감 · 065 고장·사고 신고(사진)
// · 062 오늘 할 일 배정 · 048·053 추가 서류·필수 확인 서명. 직원도 쓰고, 사장님은 전부 본다.
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {canWrite} from '../lib/plans';
import {notifyUser} from './push-api';
import type {PushEnv} from '../lib/webpush';
import {tempIssue,SIGN_TEMPLATES} from '../lib/store-log';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const kday=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
const str=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
type Log={id:string,kind:'인수인계'|'온도'|'시재'|'고장·사고',branchId:string,byId:string,by:string,employeeId?:string,at:string,text:string,temps?:{name:string,value:number,type:'냉장'|'냉동'|'기타'}[],cash?:{expected:number,counted:number},photoId?:string|null,status?:'접수'|'처리 중'|'해결',reply?:string};
type Task={id:string,branchId:string,employeeId:string,date:string,text:string,by:string,at:string,doneAt?:string|null};
type Sign={id:string,title:string,body:string,kind:string,employeeIds:string[],createdAt:string,due?:string,signs:Record<string,{at:string,name:string}>};
export async function storeLogApi(request:Request,env:{DB:D1Database}&PushEnv){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
 const linked=await resolveStore(env.DB,user);if(!linked||linked.access==='revoked')return json({error:'먼저 매장에 연결해 주세요. 사장님께 초대를 요청해 주세요.'},403);
 const {row,access}=linked,data:any=JSON.parse(row.data),owner=access==='owner',url=new URL(request.url),now=new Date().toISOString(),today=kday(now);
 const self=data.employees.find((e:any)=>e.id===data._members?.find((m:any)=>m.userId===user)?.employeeId);
 if(!owner&&(!self||self.status==='퇴사'))return json({error:'재직 중인 직원만 쓸 수 있어요. 사장님께 확인해 주세요.'},403);
 const logs:Log[]=data._storeLog||[],tasks:Task[]=data._tasks||[],signs:Sign[]=data._signDocs||[];
 const mine=(l:{branchId:string})=>owner||l.branchId===self?.branchId;
 const view=()=>({version:row.version,owner,selfId:self?.id||null,templates:owner?SIGN_TEMPLATES:[],
  employees:owner?data.employees.filter((e:any)=>e.status!=='퇴사').map((e:any)=>({id:e.id,name:e.name,branchId:e.branchId})):[],branches:owner?data.branches.map((b:any)=>({id:b.id,name:b.name})):[],
  logs:logs.filter(mine).filter(l=>owner||l.kind==='인수인계'||l.byId===user).filter(l=>l.at>=new Date(Date.now()-(owner?62:7)*86400000).toISOString()).slice(-300).reverse().map(l=>({...l,byId:undefined,mine:l.byId===user})),
  tasks:tasks.filter(t=>owner?t.date>=kday(new Date(Date.now()-7*86400000).toISOString()):t.employeeId===self?.id&&t.date>=kday(new Date(Date.now()-86400000).toISOString())).slice(-500),
  signs:owner?signs.slice(-100).reverse():signs.filter(x=>x.employeeIds.includes(self?.id)).map(x=>({...x,employeeIds:undefined,signs:x.signs[self!.id]?{[self!.id]:x.signs[self!.id]}:{}})).reverse()});
 if(request.method==='GET'){
  const image=url.searchParams.get('image');
  if(image){const l=logs.find(l=>l.photoId===image);if(!l||!(owner||l.byId===user))return json({error:'볼 수 없는 사진이에요. 목록을 새로고침해 주세요.'},404);const f=await env.DB.prepare('SELECT mime,body FROM store_manual_images WHERE owner=? AND id=?').bind(linked.owner,image).first<any>();if(!f)return json({error:'사진을 찾을 수 없어요. 다시 올려 주세요.'},404);const bin=Uint8Array.from(atob(f.body),c=>c.charCodeAt(0));return new Response(bin,{headers:{'Content-Type':f.mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}})}
  return json(view());
 }
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const raw=await request.text();if(raw.length>600000)return json({error:'보낸 내용이 너무 커요. 사진을 줄여서 다시 올려 주세요.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'요청을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
 if(data._account&&!canWrite(data._account))return json({error:'체험이 끝나 지금은 조회만 할 수 있어요. 요금제를 고르면 다시 저장할 수 있어요.'},403);
 const branchId=owner?(data.branches.some((x:any)=>x.id===b.branchId)?b.branchId:data.branches[0].id):self!.branchId;
 let audit='',target='';const notices:{to:string,title:string,body:string,url:string}[]=[];
 const uidOf=(employeeId:string)=>(data._members||[]).find((m:any)=>m.employeeId===employeeId)?.userId;
 if(b.action==='log'){
  const kind=b.kind;if(!['인수인계','온도','시재','고장·사고'].includes(kind))return json({error:'기록 종류를 골라 주세요.'},400);
  const text=str(b.text,1000);const l:Log={id:crypto.randomUUID(),kind,branchId,byId:user,by:owner?'사장님':self!.name,...(self?{employeeId:self.id}:{}),at:now,text};
  if(kind==='인수인계'&&!text)return json({error:'다음 근무자에게 남길 말을 적어 주세요.'},400);
  if(kind==='온도'){const temps=(Array.isArray(b.temps)?b.temps:[]).slice(0,20).map((x:any)=>({name:str(x?.name,30),value:Number(x?.value),type:['냉장','냉동'].includes(x?.type)?x.type:'기타'})).filter((x:any)=>x.name&&Number.isFinite(x.value)&&Math.abs(x.value)<=200);if(!temps.length)return json({error:'기기 이름과 온도를 하나 이상 적어 주세요.'},400);l.temps=temps.map((x:any)=>({...x,value:Math.round(x.value*10)/10}))}
  if(kind==='시재'){const e=Math.round(Number(b.expected)),c=Math.round(Number(b.counted));if(!Number.isFinite(e)||!Number.isFinite(c)||e<0||c<0||e>1e9||c>1e9)return json({error:'장부 금액과 센 금액을 숫자로 적어 주세요.'},400);l.cash={expected:e,counted:c}}
  if(kind==='고장·사고'){if(!text)return json({error:'무슨 일이 있었는지 적어 주세요.'},400);l.status='접수';
   if(b.photo){const p=b.photo;if(!['image/jpeg','image/png'].includes(p?.mime)||typeof p.body!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.body))return json({error:'JPG·PNG 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.'},400);const bin=atob(p.body);if(bin.length>400000)return json({error:'사진이 너무 커요. 400KB 이하로 줄여서 올려 주세요.'},413);if(!(p.mime==='image/png'?bin.startsWith('\x89PNG\r\n\x1a\n'):bin.startsWith('\xff\xd8\xff')))return json({error:'사진 형식이 맞지 않아요. JPG·PNG 사진을 골라 주세요.'},400);
    l.photoId='log-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO store_manual_images(owner,id,mime,body,bytes,created_at) VALUES(?,?,?,?,?,?)').bind(linked.owner,l.photoId,p.mime,p.body,bin.length,now).run()}
   if(!owner)notices.push({to:linked.owner,title:`${self!.name}님이 고장·사고를 알렸어요`,body:text.slice(0,60),url:'/app?screen=manual'})}
  if(kind==='온도'&&!owner){const bad=l.temps!.map(tempIssue).filter(Boolean);if(bad.length)notices.push({to:linked.owner,title:'온도가 기준을 벗어났어요',body:bad.join(', ').slice(0,80),url:'/app?screen=manual'})}
  if(kind==='시재'&&!owner&&l.cash!.counted!==l.cash!.expected)notices.push({to:linked.owner,title:`시재 차액 ${(l.cash!.counted-l.cash!.expected).toLocaleString('ko-KR')}원`,body:`${self!.name}님 마감 기록 · 장부 ${l.cash!.expected.toLocaleString('ko-KR')}원, 센 금액 ${l.cash!.counted.toLocaleString('ko-KR')}원`,url:'/app?screen=manual'});
  if(kind==='인수인계')for(const e of data.employees.filter((x:any)=>x.branchId===branchId&&x.status!=='퇴사'&&x.id!==self?.id)){const uid=uidOf(e.id);const on=(data.shifts||[]).some((s:any)=>s.employeeId===e.id&&(s.date===today||s.date===kday(new Date(Date.now()+86400000).toISOString())));if(uid&&on)notices.push({to:uid,title:'인수인계 메모가 있어요',body:text.slice(0,60),url:'/app'})}
  // 60일 지난 기록은 정리(사진도 함께)
  const cut=new Date(Date.now()-62*86400000).toISOString(),drop=logs.filter(x=>x.at<cut);data._storeLog=[...logs.filter(x=>x.at>=cut),l].slice(-2000);for(const x of drop)if(x.photoId)await env.DB.prepare('DELETE FROM store_manual_images WHERE owner=? AND id=?').bind(linked.owner,x.photoId).run();
  audit=kind+' 기록';target=l.by;
 }
 else if(b.action==='logStatus'){if(!owner)return json({error:'처리 상태는 사장님만 바꿀 수 있어요.'},403);const l=logs.find(x=>x.id===b.id&&x.kind==='고장·사고');if(!l)return json({error:'신고를 찾을 수 없어요. 새로고침해 주세요.'},404);if(!['접수','처리 중','해결'].includes(b.status))return json({error:'상태를 골라 주세요.'},400);l.status=b.status;l.reply=str(b.reply,300)||l.reply;data._storeLog=logs;audit='고장·사고 처리';target=l.text.slice(0,40);const uid=l.employeeId&&uidOf(l.employeeId);if(uid)notices.push({to:uid,title:`신고가 '${l.status}'로 바뀌었어요`,body:(l.reply||l.text).slice(0,60),url:'/app'})}
 else if(b.action==='task'){if(!owner)return json({error:'할 일은 사장님이 정해요. 필요한 일은 사장님께 말씀해 주세요.'},403);const e=data.employees.find((x:any)=>x.id===b.employeeId&&x.status!=='퇴사');const text=str(b.text,200),date=/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')?b.date:today;if(!e||!text)return json({error:'직원과 할 일을 적어 주세요.'},400);if(tasks.filter(t=>t.date===date&&t.employeeId===e.id).length>=20)return json({error:'한 사람에게 하루 20개까지 줄 수 있어요.'},400);
  tasks.push({id:crypto.randomUUID(),branchId:e.branchId,employeeId:e.id,date,text,by:'사장님',at:now,doneAt:null});data._tasks=tasks.filter(t=>t.date>=kday(new Date(Date.now()-31*86400000).toISOString())).slice(-3000);audit='할 일 배정';target=e.name;const uid=uidOf(e.id);if(uid&&date===today)notices.push({to:uid,title:'오늘 할 일이 생겼어요',body:text.slice(0,60),url:'/app'})}
 else if(b.action==='taskDone'){const t=tasks.find(x=>x.id===b.id);if(!t||!(owner||t.employeeId===self?.id))return json({error:'할 일을 찾을 수 없어요. 새로고침해 주세요.'},404);t.doneAt=b.undo?null:now;data._tasks=tasks;audit=b.undo?'할 일 되돌림':'할 일 완료';target=t.text.slice(0,40)}
 else if(b.action==='taskDelete'){if(!owner)return json({error:'할 일은 사장님만 지울 수 있어요.'},403);data._tasks=tasks.filter(t=>t.id!==b.id);audit='할 일 삭제';target=b.id}
 else if(b.action==='signRequest'){if(!owner)return json({error:'서명 요청은 사장님만 보낼 수 있어요.'},403);
  const title=str(b.title,80),body=str(b.body,8000),ids=(Array.isArray(b.employeeIds)?b.employeeIds:[]).filter((id:any)=>data.employees.some((e:any)=>e.id===id&&e.status!=='퇴사'));if(!title||!body||!ids.length)return json({error:'제목·내용·받을 직원을 정해 주세요.'},400);if(signs.length>=300)return json({error:'서명 요청이 너무 많아요. 끝난 것을 정리해 주세요.'},400);
  const x:Sign={id:crypto.randomUUID(),title,body,kind:str(b.kind,30)||'기타',employeeIds:[...new Set(ids)] as string[],createdAt:now,...(/^\d{4}-\d{2}-\d{2}$/.test(b.due||'')?{due:b.due}:{}),signs:{}};signs.push(x);data._signDocs=signs;audit='서명 요청';target=title;for(const id of x.employeeIds){const uid=uidOf(id);if(uid)notices.push({to:uid,title:'확인·서명할 서류가 있어요',body:title,url:'/app'})}}
 else if(b.action==='signRemind'){if(!owner)return json({error:'다시 알리기는 사장님만 할 수 있어요.'},403);const x=signs.find(s=>s.id===b.id);if(!x)return json({error:'서명 요청을 찾을 수 없어요. 새로고침해 주세요.'},404);const left=x.employeeIds.filter(id=>!x.signs[id]);for(const id of left){const uid=uidOf(id);if(uid)notices.push({to:uid,title:'아직 서명하지 않은 서류가 있어요',body:x.title,url:'/app'})}audit='서명 다시 알림';target=x.title;if(!left.length)return json({error:'모두 서명했어요. 다시 알릴 사람이 없어요.'},400)}
 else if(b.action==='sign'){if(!self)return json({error:'직원 계정에서만 서명할 수 있어요.'},403);const x=signs.find(s=>s.id===b.id&&s.employeeIds.includes(self.id));if(!x)return json({error:'서류를 찾을 수 없어요. 새로고침해 주세요.'},404);if(x.signs[self.id])return json({error:'이미 서명했어요. 서명 서류 목록에서 확인해 주세요.'},400);const name=str(b.name,40);if(b.agree!==true||name.replace(/\s/g,'')!==String(self.name).replace(/\s/g,''))return json({error:`내용을 읽고 '확인했어요'에 체크한 뒤 내 이름(${self.name})을 똑같이 적어 주세요.`},400);x.signs[self.id]={at:now,name};data._signDocs=signs;audit='서류 서명';target=x.title;notices.push({to:linked.owner,title:`${self.name}님이 서명했어요`,body:x.title,url:'/app?screen=contracts'})}
 else if(b.action==='signDelete'){if(!owner)return json({error:'서명 요청은 사장님만 지울 수 있어요.'},403);const x=signs.find(s=>s.id===b.id);if(!x)return json({error:'서명 요청을 찾을 수 없어요. 새로고침해 주세요.'},404);if(Object.keys(x.signs).length)return json({error:'서명한 사람이 있는 서류는 기록 보관을 위해 지울 수 없어요. 새 서류를 따로 보내 주세요.'},400);data._signDocs=signs.filter(s=>s.id!==b.id);audit='서명 요청 삭제';target=x.title}
 else return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 data._audit=[...(data._audit||[]),{id:crypto.randomUUID(),at:now,actor:{id:user,name:owner?'사장님':self?.name||''},action:audit,target,before:null,after:null,reason:''}].slice(-1000);
 const r=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(data),row.version+1,now,linked.owner,row.version).run();
 if(!r.meta.changes)return json({error:'동시에 바뀐 내용이 있어요. 새로고침한 뒤 다시 해 주세요.'},409);
 row.version=row.version+1;
 for(const n of notices)await notifyUser(env as any,n.to,{title:n.title,body:n.body,url:n.url,kind:'manual'}).catch(()=>null);
 return json(view());
 }catch(e){return serverError('store-log',e,'매장 기록을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
