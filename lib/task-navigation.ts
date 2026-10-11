const GROUPS=[
 {label:'오늘의 업무',pages:['홈']},
 {label:'인사·근무',pages:['직원 관리','근무 스케줄','출퇴근 기록','퇴직금 확인','인건비 리포트']},
 {label:'소통·매뉴얼',pages:['휴가·공지','매장 매뉴얼']},
 {label:'계약·서류',pages:['급여·명세서','근로계약서','전송함','근로기준 안내']},
 {label:'매장·설정',pages:['매장 관리·비교','설정']}
];
export function taskGroups(allowed:readonly string[]){return GROUPS.map(g=>({...g,pages:g.pages.filter(p=>allowed.includes(p))})).filter(g=>g.pages.length)}
export function rememberPage(previous:readonly string[],page:string,allowed:readonly string[]){return [...new Set([page,...previous].filter(p=>p!=='홈'&&allowed.includes(p)))].slice(0,3)}
export function recordVisitedPage(storage:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void},scope:string,page:string,allowed:readonly string[]){
 if(!scope)return [];
 const key='cheok-recent-pages:'+scope;
 let previous:string[]=[];
 try{const value=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(value))previous=value.filter(x=>typeof x==='string')}catch{}
 const next=rememberPage(previous,page,allowed);
 try{storage.setItem(key,JSON.stringify(next))}catch{}
 return next;
}
