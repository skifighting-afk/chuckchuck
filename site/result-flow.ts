export {};
const host=document.getElementById('hero-record-flow');
if(host){
 const cards=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-record-step]'));
 const play=host.querySelector<HTMLButtonElement>('#hero-flow-play')!,detail=host.querySelector<HTMLElement>('#hero-flow-detail')!;
 let preferred=false;try{preferred=localStorage.getItem('chukchuk-reduce-motion')==='1'}catch{}
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||preferred;
 const copy=['누가 언제 출퇴근했는지, 매장에 없어도 기록을 확인해요.','출퇴근 시각과 휴게·정정 내역을 함께 보고, 인정할 시간을 확인해요.','시급 12,000원으로 계산한 이날 기본급은 54,400원. 직원도 계산 근거를 확인해요.'];
 let phase=0,playing=!reduce,visible=true;
 function render(manual=false){
  cards.forEach((card,n)=>card.setAttribute('aria-pressed',String(n===phase)));
  detail.setAttribute('aria-live',manual?'polite':'off');detail.textContent=copy[phase];
  play.setAttribute('aria-pressed',String(playing));play.textContent=reduce?'자동 보기 꺼짐':playing?'자동 보기 멈추기':'자동 보기 시작';
 }
 play.hidden=false;play.disabled=reduce;render();
 play.addEventListener('click',()=>{if(!reduce){playing=!playing;render()}});
 host.addEventListener('focusin',e=>{if(e.target!==play){playing=false;render()}});
 host.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[data-record-step]');if(target){phase=Number(target.dataset.recordStep);playing=false;render(true)}});
 new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting)},{threshold:.15}).observe(host);
 if(!reduce)setInterval(()=>{if(playing&&visible&&!document.hidden){phase=(phase+1)%cards.length;render()}},6000);
}
