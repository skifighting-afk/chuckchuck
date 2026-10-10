// 개선 2차 화면 편의(모든 화면 공통, 한 번만 붙인다)
// B180 날짜 칸에서 T=오늘, +/- = 하루 앞뒤 · B181 금액 칸 아래 천 단위 쉼표 미리 보기 · B178 데이터 절약·느린 연결이면 가벼운 화면
const kToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
function setVal(el:HTMLInputElement,v:string){const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d?.set?.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
export function installUxHelpers(){
 if(typeof window==='undefined'||(window as any).__ccUx)return;(window as any).__ccUx=true;
 try{const c:any=(navigator as any).connection;if(c&&(c.saveData||/^(slow-2g|2g)$/.test(c.effectiveType||'')))document.documentElement.classList.add('lite')}catch{}
 addEventListener('keydown',e=>{const el=e.target as HTMLInputElement;if(!(el instanceof HTMLInputElement)||el.type!=='date'||el.readOnly||el.disabled||e.ctrlKey||e.metaKey||e.altKey)return;
  const base=el.value&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)?el.value:kToday();
  if(e.key==='t'||e.key==='T'){e.preventDefault();setVal(el,kToday())}
  else if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();const d=new Date(Date.parse(base+'T00:00:00Z')+(e.key==='-'?-1:1)*86400000).toISOString().slice(0,10);if((!el.min||d>=el.min)&&(!el.max||d<=el.max))setVal(el,d)}},true);
 let hint:HTMLDivElement|null=null;
 const show=(el:HTMLInputElement)=>{const n=Number(el.value);if(el.type!=='number'||!Number.isFinite(n)||Math.abs(n)<1000){hint?.remove();hint=null;return}
  if(!hint){hint=document.createElement('div');hint.className='num-hint';hint.setAttribute('aria-hidden','true');document.body.appendChild(hint)}
  const r=el.getBoundingClientRect();hint.textContent=n.toLocaleString('ko-KR');hint.style.left=(r.left+scrollX)+'px';hint.style.top=(r.bottom+scrollY+2)+'px'};
 addEventListener('input',e=>{if(e.target instanceof HTMLInputElement)show(e.target)},true);
 addEventListener('focusin',e=>{if(e.target instanceof HTMLInputElement)show(e.target)},true);
 addEventListener('focusout',()=>{hint?.remove();hint=null},true);
}
