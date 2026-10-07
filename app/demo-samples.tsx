'use client';
// 체험 화면의 매장 매뉴얼: 실제 화면(StoreManual)과 같은 구성을 메모리에서 돌린다(저장 없음).
import {StoreManual,type ManualSource} from './manual';
import {manualVisibleTo} from '../lib/manual-view';

// 예시 사진 대신 쓰는 간단한 그림(실제 매장에서는 휴대폰으로 찍은 사진이 들어가요)
const pic=(label:string,bg:string,shape:string)=>'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="${bg}"/>${shape}<text x="320" y="370" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#10251b">${label}</text></svg>`);
const POS=pic('포스 → 마감 정산','#eef4ea','<rect x="190" y="70" width="260" height="190" rx="18" fill="#fff" stroke="#15643f" stroke-width="8"/><rect x="225" y="105" width="190" height="60" rx="8" fill="#c8f169"/><rect x="225" y="185" width="80" height="45" rx="8" fill="#15643f"/><rect x="335" y="185" width="80" height="45" rx="8" fill="#d9e5dc"/>');
const CHAIR=pic('의자를 테이블 위로','#f4f1e8','<rect x="170" y="150" width="300" height="24" rx="6" fill="#8a6a3a"/><rect x="190" y="174" width="18" height="120" fill="#8a6a3a"/><rect x="432" y="174" width="18" height="120" fill="#8a6a3a"/><rect x="250" y="70" width="140" height="70" rx="8" fill="#15643f"/><rect x="262" y="40" width="16" height="40" fill="#15643f"/><rect x="362" y="40" width="16" height="40" fill="#15643f"/>');
const COFFEE=pic('전원 켜고 15분 예열','#eef1f6','<rect x="220" y="60" width="200" height="230" rx="20" fill="#2c3e50"/><circle cx="320" cy="130" r="34" fill="#c8f169"/><rect x="285" y="210" width="70" height="60" rx="8" fill="#fff"/>');
const HAND=pic('손 씻기 30초','#e9f3f7','<circle cx="320" cy="170" r="110" fill="#fff" stroke="#2b7a99" stroke-width="10"/><text x="320" y="200" text-anchor="middle" font-family="sans-serif" font-size="90" font-weight="800" fill="#2b7a99">30</text>');
const EMPS=[{id:'e0',name:'김예시',role:'홀',branchId:'branch-main'},{id:'e1',name:'박샘플',role:'주방',branchId:'branch-main'},{id:'e2',name:'이체험',role:'매니저',branchId:'branch-main'},{id:'e3',name:'정가상',role:'홀',branchId:'branch-main'}];
const ago=(d:number)=>new Date(Date.now()-d*86400000).toISOString();
function seed(){return [
 {id:'m1',title:'홀 오픈 준비',category:'오픈',roles:[],branchId:'all',createdAt:ago(30),updatedAt:ago(30),note:'',reads:['e0','e1','e2','e3'],steps:[{text:'간판 조명과 홀 조명을 켜요.'},{text:'테이블마다 수저통·냅킨을 채워요.'},{text:'포스를 켜고 시재(거스름돈)를 세어 적어요.',imageId:POS},{text:'입구 매트를 깔고 OPEN 팻말로 돌려요.'}]},
 {id:'m2',title:'마감 순서 (홀)',category:'마감',roles:['홀'],branchId:'all',createdAt:ago(20),updatedAt:ago(1),note:'2단계: 의자 올리기 추가',reads:['e0'],steps:[{text:'포스 마감 정산을 누르고 영수증을 금고에 넣어요.',imageId:POS},{text:'테이블·의자를 닦고 의자를 테이블 위에 올려요.',imageId:CHAIR},{text:'에어컨·간판을 끄고 문을 잠근 뒤 사진을 단톡방에 올려요.'}]},
 {id:'m3',title:'주방 마감',category:'마감',roles:['주방'],branchId:'all',createdAt:ago(12),updatedAt:ago(12),note:'',reads:[],steps:[{text:'가스 밸브를 잠그고 사진을 찍어요.'},{text:'냉장고 칸마다 날짜 스티커를 붙여요.'},{text:'바닥 배수구 거름망을 비워요.'}]},
 {id:'m4',title:'커피 머신 아침 준비',category:'기기',roles:[],branchId:'all',createdAt:ago(9),updatedAt:ago(9),note:'',reads:['e0','e2'],steps:[{text:'전원을 켜고 15분 예열해요.',imageId:COFFEE},{text:'첫 샷 두 잔은 버리고 세 번째부터 써요.'},{text:'스팀 노즐을 한 번 빼서 물기를 날려요.'}]},
 {id:'m5',title:'손 씻기·위생 점검',category:'위생',roles:[],branchId:'all',createdAt:ago(5),updatedAt:ago(5),note:'',reads:['e1','e2','e3'],steps:[{text:'출근하면 비누로 30초 손을 씻어요.',imageId:HAND},{text:'모자·앞치마를 쓰고 거울로 확인해요.'},{text:'냉장고 온도를 점검표에 적어요(0~5℃).'}]},
] as any[]}
let store:any[]|null=null,version=1,runs:any[]=[];
function view(){const ms=store!;return {checkRuns:[...runs].reverse(),version,owner:true,branches:[{id:'branch-main',name:'본점'}],roles:['홀','주방','매니저'],manuals:ms.map(m=>{const aud=EMPS.filter(e=>manualVisibleTo(m,e));return {...m,read:false,reads:undefined,audience:aud.length,readCount:aud.filter(e=>m.reads.includes(e.id)).length,unread:aud.filter(e=>!m.reads.includes(e.id)).map(e=>e.name)}})}}
const demoSource:ManualSource={
 load:async()=>{store=seed();version=1;runs=[{id:'r0',manualId:'m1',title:'홀 오픈 준비',category:'오픈',by:'김예시',at:new Date(Date.now()-3*3600000).toISOString(),done:[0,1,2],total:3,photoId:null}];return view()},
 call:async(b:any)=>{const now=new Date().toISOString();
  if(b.action==='image')return {id:`data:${b.mime};base64,${b.body}`};
  if(b.action==='save'){const ex=b.id&&store!.find(m=>m.id===b.id);if(ex)Object.assign(ex,{title:b.title,branchId:b.branchId,category:b.category,roles:b.roles,note:b.note||'',steps:b.steps,updatedAt:now,reads:[]});else store!.push({id:'m'+Date.now(),title:b.title,branchId:b.branchId,category:b.category,roles:b.roles,note:'',steps:b.steps,createdAt:now,updatedAt:now,reads:[]})}
  if(b.action==='delete')store=store!.filter(m=>m.id!==b.id);
  if(b.action==='checkRun'){const m=store!.find(x=>x.id===b.id);if(!m)throw Error('매뉴얼을 찾을 수 없어요. 목록을 새로고침해 주세요.');if(!b.done?.length)throw Error('한 단계 이상 체크해 주세요.');runs.push({id:'r'+Date.now(),manualId:m.id,title:m.title,category:m.category,by:'예시 사장님',at:now,done:b.done,total:m.steps.length,photoId:b.photo?`data:${b.photo.mime};base64,${b.photo.body}`:null})}
  version++;return view()},
};
export function DemoManual(){return <StoreManual source={demoSource} branchId="branch-main" demoNote="체험용 예시예요. 분류·검색, 고치기, '직원 화면으로 보기'를 눌러 보세요(새로고침하면 처음으로). 실제 매장에서는 휴대폰으로 찍은 사진이 들어가요."/>}
