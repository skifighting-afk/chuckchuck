// 지시서 다음 매장 일지: 054 인수인계 · 062 할 일 · 063 온도 · 064 시재 · 065 신고 · 048·053 서명
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function raw(user,path,body){return api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body){const r=await raw(user,path,body);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'매뉴얼 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['far','다른지점']]){await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});const j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});}
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const F=d._members.find(m=>m.userId===id('far')).employeeId;d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
import {tempIssue,cashDiff} from '../lib/store-log.ts';
ok('fridge 7 is out of range',!!tempIssue({name:'냉장',value:7,type:'냉장'}));ok('freezer -20 ok',tempIssue({name:'냉동',value:-20,type:'냉동'}),'');ok('cash diff',cashDiff({expected:100,counted:90}),-10);
const L=(u,b)=>call(u,'/api/store-log',b);
const A=d._members.find(m=>m.userId===id('amy')).employeeId;
ok('handover needs text',(await L('amy',{action:'log',kind:'인수인계',text:''})).status,400);
ok('staff writes handover',(await L('amy',{action:'log',kind:'인수인계',text:'우유 2팩 남음'})).status,200);
const farView=(await call('far','/api/store-log')).body;ok('far branch sees no handover',farView.logs.filter(l=>l.kind==='인수인계').length,0);
ok('staff logs temps',(await L('amy',{action:'log',kind:'온도',temps:[{name:'냉장고1',value:7,type:'냉장'}]})).status,200);
ok('staff logs cash',(await L('amy',{action:'log',kind:'시재',expected:100000,counted:98000})).status,200);
ok('bad photo refused',(await L('amy',{action:'log',kind:'고장·사고',text:'제빙기 누수',photo:{mime:'image/png',body:'AAAA'}})).status,400);
ok('incident with photo',(await L('amy',{action:'log',kind:'고장·사고',text:'제빙기 누수',photo:{mime:'image/png',body:png}})).status,200);
let boss=(await call('boss','/api/store-log')).body;const inc=boss.logs.find(l=>l.kind==='고장·사고');
ok('owner sees all kinds',['인수인계','온도','시재','고장·사고'].every(k=>boss.logs.some(l=>l.kind===k)),true);
const img=await raw('boss','/api/store-log?image='+inc.photoId);ok('owner opens photo',img.status,200);
ok('other staff cannot open photo',(await raw('far','/api/store-log?image='+inc.photoId)).status,404);
ok('staff cannot change status',(await L('amy',{action:'logStatus',id:inc.id,status:'해결'})).status,403);
ok('owner resolves',(await L('boss',{action:'logStatus',id:inc.id,status:'해결',reply:'수리 불렀어요'})).status,200);
// 할 일
ok('staff cannot assign task',(await L('amy',{action:'task',employeeId:A,text:'청소'})).status,403);
ok('owner assigns task',(await L('boss',{action:'task',employeeId:A,text:'창고 정리'})).status,200);
let amy=(await call('amy','/api/store-log')).body;ok('staff sees own task',amy.tasks.length,1);
ok('other staff cannot finish it',(await L('far',{action:'taskDone',id:amy.tasks[0].id})).status,404);
ok('staff finishes task',(await L('amy',{action:'taskDone',id:amy.tasks[0].id})).status,200);
// 서명
ok('staff cannot request sign',(await L('amy',{action:'signRequest',title:'x',body:'y',employeeIds:[A]})).status,403);
ok('owner requests sign',(await L('boss',{action:'signRequest',title:'위생 교육 확인서',body:'교육 받았습니다',kind:'위생교육 확인',employeeIds:[A,F]})).status,200);
amy=(await call('amy','/api/store-log')).body;const sd=amy.signs[0];ok('staff sees doc without others','employeeIds' in sd,false);
ok('sign needs agree + exact name',(await L('amy',{action:'sign',id:sd.id,name:'다른이름',agree:true})).status,400);
ok('staff signs',(await L('amy',{action:'sign',id:sd.id,name:'에이미',agree:true})).status,200);
ok('cannot sign twice',(await L('amy',{action:'sign',id:sd.id,name:'에이미',agree:true})).status,400);
boss=(await call('boss','/api/store-log')).body;ok('owner sees 1 of 2 signed',Object.keys(boss.signs[0].signs).length,1);
ok('signed doc cannot be deleted',(await L('boss',{action:'signDelete',id:sd.id})).status,400);
ok('remind unsigned',(await L('boss',{action:'signRemind',id:sd.id})).status,200);
const st=(await call('boss','/api/store')).body;ok('audit has sign',st.audit.some(x=>x.action==='서류 서명'),true);
// 사장님이 근무표를 저장해도 일지는 남는다(PUT 보존 목록)
const put=await api(new Request('https://qa.local/api/store',{method:'PUT',headers:{origin:'https://qa.local','content-type':'application/json',...(await headersFor('boss'))},body:JSON.stringify({state:st.state,version:st.version})}),env);ok('owner PUT ok',put.status,200);
ok('logs survive PUT',(await call('boss','/api/store-log')).body.logs.length>=4,true);
// 066 교육 퀴즈
{let mv=(await call('boss','/api/manual')).body;
 ok('bad quiz refused',(await call('boss','/api/manual',{action:'save',title:'위생',branchId:'all',category:'위생',steps:[{text:'손 씻기'}],quiz:[{q:'몇 초?',options:['10초'],answer:0}],version:mv.version})).status,400);
 ok('owner saves quiz manual',(await call('boss','/api/manual',{action:'save',title:'위생',branchId:'all',category:'위생',steps:[{text:'손 씻기'}],quiz:[{q:'몇 초?',options:['10초','30초'],answer:1},{q:'냉장?',options:['0~5','10'],answer:0}],version:mv.version,notify:false})).status,200);
 let am=(await call('amy','/api/manual')).body,m=am.manuals.find(x=>x.title==='위생');ok('staff gets quiz without answers',m.quiz.every(x=>!('answer' in x)),true);
 let r=await call('amy','/api/manual',{action:'quiz',id:m.id,answers:[0,0],version:am.version});ok('wrong answer reported by number',[r.body.quizResult.pass,r.body.quizResult.wrong],[false,[1]]);
 r=await call('amy','/api/manual',{action:'quiz',id:m.id,answers:[1,0],version:r.body.version});ok('all correct passes',r.body.quizResult.pass,true);
 am=(await call('amy','/api/manual')).body;ok('staff marked passed',am.manuals.find(x=>x.title==='위생').quizPassed,true);
 mv=(await call('boss','/api/manual')).body;ok('owner sees pass',mv.manuals.find(x=>x.title==='위생').quizPasses,['에이미']);}
// 058·059·068·069
ok('order needs item',(await L('amy',{action:'log',kind:'발주 요청',item:''})).status,400);
ok('staff requests order',(await L('amy',{action:'log',kind:'발주 요청',item:'우유',qty:'2박스'})).status,200);
ok('complaint',(await L('amy',{action:'log',kind:'고객 불만',text:'음식 늦음',handled:'음료 서비스'})).status,200);
ok('owner cannot write anonymous',(await L('boss',{action:'log',kind:'건의',text:'x'})).status,400);
ok('anonymous suggestion',(await L('amy',{action:'log',kind:'건의',text:'마감 인원 늘려 주세요'})).status,200);
boss=(await call('boss','/api/store-log')).body;const sug=boss.logs.find(l=>l.kind==='건의');
ok('suggestion has no author',[sug.by,'employeeId' in sug,sug.at.endsWith('T00:00:00.000Z')],['익명',false,true]);
const st2=(await call('boss','/api/store')).body;ok('audit has no author for suggestion',st2.audit.filter(x=>x.action==='건의 기록').every(x=>x.actor.name==='익명'&&!x.target),true);
ok('owner answers suggestion',(await L('boss',{action:'logStatus',id:sug.id,status:'해결',reply:'다음 주부터 늘릴게요'})).status,200);
ok('other staff sees answered suggestion',(await call('far','/api/store-log')).body.logs.some(l=>l.kind==='건의'),false);
amy=(await call('amy','/api/store-log')).body;ok('same-branch staff sees answered suggestion',amy.logs.some(l=>l.kind==='건의'&&l.reply),true);
ok('order status by owner',(await L('boss',{action:'logStatus',id:boss.logs.find(l=>l.kind==='발주 요청').id,status:'처리 중'})).status,200);
ok('staff messages owner',(await L('amy',{action:'msg',text:'내일 30분 늦어요'})).status,200);
boss=(await call('boss','/api/store-log')).body;ok('owner sees message',boss.messages.some(m=>m.employeeId===A&&m.from==='staff'),true);
ok('owner replies',(await L('boss',{action:'msg',employeeId:A,text:'알겠어요'})).status,200);
ok('owner marks read',(await L('boss',{action:'msgRead',employeeId:A})).status,200);
amy=(await call('amy','/api/store-log')).body;ok('staff sees thread with read mark',[amy.messages.length,!!amy.messages.find(m=>m.from==='staff').readAt],[2,true]);
ok('other staff sees no messages',(await call('far','/api/store-log')).body.messages.length,0);
console.log('PASS: 매장 일지·할 일·서명 서류.');
await closeAll();
