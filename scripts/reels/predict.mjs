// 릴스 예상 점수: 영상을 만들 때 잴 수 있는 것만으로 매긴다(뇌파·시선 추적 같은 건 없음).
// 올린 뒤 실제 반응(바이럴 지수)과 나란히 놓고, 어떤 항목이 실제와 맞는지 보며 가중치를 고쳐 간다.
// 입력: 질문(q), 카드별 글(cards), 카드별 초(secs), 소리 여부(audio)
export function predict({q,cards,secs,audio=false,voice=false}){
 const total=secs.reduce((a,b)=>a+b,0);
 const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
 // 1) 훅: 첫 화면 질문. 짧을수록, 물음표·숫자·"사장님/알바/돈" 같은 말이 있을수록 높게
 const qLen=q.replace(/\s/g,'').length;
 let hook=100-Math.max(0,qLen-10)*5;
 if(!/\?$/.test(q))hook-=15;
 if(/\d/.test(q))hook+=5;
 if(/주휴|최저|월급|돈|벌금|퇴직금|알바|사장|해고|공휴일|수당/.test(q))hook+=10;
 hook=clamp(hook);
 // 2) 끝까지 보기: 릴스는 짧을수록 끝까지 본다. 7~15초 최고, 30초 넘으면 크게 깎음
 const sustain=clamp(total<=7?85:total<=15?100:total<=20?100-(total-15)*4:total<=30?80-(total-20)*3:50-(total-30)*2);
 // 3) 읽기 부담: 답 카드의 초당 글자 수. 사람이 편히 읽는 건 초당 8~10자 안팎
 const cps=cards.map((c,i)=>c.replace(/\s/g,'').length/Math.max(1,secs[i+1]||4));
 const worst=Math.max(...cps,0);
 const read=clamp(worst<=8?100:100-(worst-8)*12);
 // 4) 화면 변화: 3~4초마다 바뀌면 좋음
 const perChange=total/Math.max(1,secs.length);
 const visual=clamp(perChange<=3.5?100:100-(perChange-3.5)*20);
 // 5) 소리: 무음이면 낮음(인기 음악·목소리를 넣으면 올라감)
 // 직접 만든 배경음은 70, 인스타 인기 음원을 앱에서 붙이면 더 올라갈 수 있음
 // 목소리 나레이션까지 있으면 90(소리를 켠 사람도, 끈 사람도 따라올 수 있음)
 const sound=audio?(voice?90:70):30;
 const score=clamp(hook*0.35+sustain*0.25+read*0.2+visual*0.1+sound*0.1);
 const notes=[];
 if(hook<70)notes.push('첫 화면 질문을 10자 안쪽으로 줄이거나 돈·벌금 같은 말을 넣어 보세요.');
 if(read<70)notes.push(`글이 빨리 지나가요(가장 빠른 카드 초당 ${worst.toFixed(1)}자). 카드를 나누거나 글을 줄이세요.`);
 if(sustain<80)notes.push(`영상이 ${Math.round(total)}초예요. 15초 안쪽이면 끝까지 보는 사람이 늘어요.`);
 if(!audio)notes.push('소리가 없어요. 배경음을 넣으면 끝까지 보는 사람이 늘어요.');
 else if(!voice)notes.push('목소리가 없어요. 나레이션을 붙이면 소리 켠 사람이 더 오래 봐요.');
 return {score,hook,sustain,read,visual,sound,voice,seconds:Math.round(total*10)/10,cps:Math.round(worst*10)/10,notes};
}
