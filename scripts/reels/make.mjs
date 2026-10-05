// 인스타 릴스 자동 만들기: topics.json의 질문 하나 → 세로 영상(1080×1920, 약 15~25초) + 글 + 표지.
// 화면 카드는 Chromium으로 찍고, ffmpeg로 이어 붙인다(H.264·30fps·AAC 48kHz, 인스타 릴스 규격).
// 질문 → 답 → 실제 앱 화면("척척사장에선 이렇게") → 마무리. 카드마다 AI 목소리 나레이션(MeloTTS, 무료)을 붙인다.
// 사용: node scripts/reels/make.mjs [--index N] [--out 폴더] [--site 주소] [--no-voice] [--no-screens] [--mute]
//   목소리 모델이 없거나 실패하면 목소리 없이, 앱 화면을 못 찍으면 화면 카드 없이 만든다.
//   --index 없으면 2026-10-05부터 하루에 하나씩 차례로 고른다.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {predict} from './predict.mjs';
import {makeMusic} from './music.mjs';
import {captureScreens} from './screens.mjs';

const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const topics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url),'utf8'));
const START=Date.UTC(2026,9,5);
const day=Math.floor((Date.now()+9*3600000-START)/86400000);
const index=Number(arg('--index',String(((day%topics.length)+topics.length)%topics.length)));
const t=topics[index];if(!t)throw Error('주제 번호가 범위를 벗어났어요: '+index);
const out=resolve(arg('--out','reel-out'));mkdirSync(out,{recursive:true});
const mascotPath=resolve('public/cheokcheoki-guide.png');
const mascot=existsSync(mascotPath)?'data:image/png;base64,'+readFileSync(mascotPath).toString('base64'):'';

// 답을 문장으로 나눠 카드 2~4장에 담는다(카드당 글자 90자 안팎)
const sentences=t.a.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
const cards=[];let cur='';
for(const s of sentences){if(cur&&(cur+' '+s).length>70){cards.push(cur);cur=s}else cur=cur?cur+' '+s:s}
if(cur)cards.push(cur);
const law=t.group.includes('노무');

const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const shell=(body,bg,fg)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;background:${bg};color:${fg};font-family:'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all;overflow:hidden}
.wrap{width:1080px;height:1920px;padding:200px 96px 240px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:800}.brand i{width:64px;height:64px;border-radius:18px;background:#c8f169;color:#10251b;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:36px}
.tag{align-self:flex-start;font-size:40px;font-weight:700;border-radius:999px;padding:14px 28px}
h1{font-size:112px;line-height:1.22;font-weight:900;letter-spacing:-3px;margin:0}
p{font-size:76px;line-height:1.45;font-weight:700;letter-spacing:-1.5px;margin:0}
.foot{margin-top:auto;font-size:40px;font-weight:700}
.pal{position:absolute;right:72px;bottom:200px;width:480px;height:480px;border-radius:50%;background:#e3efe8;overflow:hidden;display:flex;align-items:center;justify-content:center}.pal img{width:430px;height:430px;object-fit:contain}
</style></head><body><div class="wrap">${body}</div></body></html>`;
const has=k=>process.argv.includes(k);
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
// 실제 앱 화면: 체험 화면(예시 가게)을 휴대폰 크기로 찍는다
const site=arg('--site',process.env.REEL_SITE||'https://chukchukapp.kr');
const scr=has('--no-screens')?{shots:[],label:''}:await captureScreens(browser,site,t.id,out);
const png64=f=>'data:image/png;base64,'+readFileSync(f).toString('base64');
const phone=(f,label,i)=>shell(`<div class="brand"><i>척</i>척척사장</div><span class="tag" style="margin-top:56px;background:#c8f169;color:#10251b">척척사장에선 이렇게</span><h2 style="font-size:76px;line-height:1.2;font-weight:900;letter-spacing:-2px;margin:28px 0 0">${esc(i===0?label+' 화면':'버튼 한 번이면 끝')}</h2><div style="margin:44px auto 0;padding:20px;border-radius:84px;background:#06110c;box-shadow:0 30px 80px rgba(0,0,0,.45)"><img src="${png64(f)}" alt="" style="display:block;width:600px;height:1298px;object-fit:cover;object-position:top;border-radius:66px"></div>`,'#10251b','#ffffff').replace('padding:200px 96px 240px','padding:120px 96px 80px');
const pages=[
 shell(`<div class="brand"><i>척</i>척척사장</div><span class="tag" style="margin-top:120px;background:#c8f169;color:#10251b">${esc(t.group)}</span><h1 style="margin-top:48px">${esc(t.q)}</h1><div class="foot" style="color:#b9cbbf">끝까지 보면 답이 나와요</div>${mascot?`<div class="pal"><img src="${mascot}" alt=""></div>`:''}`,'#10251b','#ffffff'),
 ...cards.map((c,i)=>shell(`<div class="brand" style="color:#15643f"><i>척</i>척척사장</div><span class="tag" style="margin-top:120px;background:#15643f;color:#fff">${i+1} / ${cards.length}</span><p style="margin-top:56px">${esc(c)}</p><div class="foot" style="color:#4b5d53">${esc(t.q)}</div>`,'#f4f7f5','#10251b')),
 ...scr.shots.map((f,i)=>phone(f,scr.label,i)),
 shell(`<div class="brand"><i>척</i>척척사장</div><h1 style="margin-top:160px">${law?'이런 계산,<br>앱이 대신 해요':'더 쉽게,<br>척척.'}</h1><p style="margin-top:56px;font-size:60px;color:#d9eadf">주휴수당 · 급여명세서 · 근로계약서 · QR 출퇴근</p><div class="foot"><div style="font-size:56px;color:#c8f169;font-weight:900">30일 무료 · 프로필 링크</div><div style="margin-top:12px;color:#d9eadf">chukchukapp.kr${law?' · 자세한 상담은 고용노동부 1350':''}</div></div>`,'#15643f','#ffffff'),
];
// 소수는 목소리 모델이 점을 건너뛰어(1.5 → "1 5") 한글로 바꿔 읽힌다: 1.5 → 일 점 오
const D='영일이삼사오육칠팔구';
const sino=n=>{n=Number(n);if(!n)return '영';let r='';const u=[[10000,'만'],[1000,'천'],[100,'백'],[10,'십']];for(const [v,w] of u){const q=Math.floor(n/v);if(q){r+=(q===1&&v<10000?'':v===10000?sino(q):D[q])+w;n%=v}}return r+(n?D[n]:'')};
const decimals=s=>s.replace(/(\d+)\.(\d+)/g,(_,a,b)=>sino(a)+' 점 '+[...b].map(d=>D[d]).join('')+' ');
// 카드마다 읽어 줄 대사(숫자 쉼표·기호는 읽기 좋게 정리)
const WORDS={QR:'큐알',PDF:'피디에프',CSV:'씨에스브이',CCTV:'씨씨티비',PC:'피씨',VAT:'부가세',xlsx:'엑셀',csv:'씨에스브이'};
const speak=s=>decimals(s.replace(/(\d),(?=\d{3})/g,'$1')).replace(/[A-Za-z]{2,}/g,w=>WORDS[w]||w).replace(/×/g,' 곱하기 ').replace(/÷/g,' 나누기 ').replace(/=/g,' 은 ').replace(/~/g,'부터 ').replace(/[\[\]"“”>]/g,' ').replace(/%/g,'퍼센트').replace(/[()]/g,', ').replace(/[·→👉※]/g,', ').replace(/\s*,\s*([.!?])/g,'$1').replace(/(,\s*){2,}/g,', ').replace(/\s+/g,' ').trim();
// 대사는 say.json(주제마다 말하듯 쓴 대본)에서. 없으면 카드 글을 그대로 읽는다.
const SAY=JSON.parse(readFileSync(new URL('./say.json',import.meta.url),'utf8'))[t.id];
const body=cards.map(()=>'');
if(SAY){const L=SAY[1];L.forEach((l,j)=>{const k=Math.min(cards.length-1,Math.floor(j*cards.length/L.length));body[k]=(body[k]?body[k]+' ':'')+l})}else cards.forEach((c,i)=>body[i]=c);
const pick=(arr,k=0)=>arr[(index+k)%arr.length];
const appLine1=[`척척사장에선 ${scr.label} 화면에서 바로 보여요.`,`앱에선 이렇게, ${scr.label} 화면에서 한눈에!`,`척척사장 ${scr.label} 화면이에요. 진짜 쉽죠?`];
const appLine2=['복잡한 건 앱이 알아서 해요!','버튼 한 번이면 끝이에요.','사장님은 확인만 하시면 돼요!'];
const outro=law?['이런 계산, 이제 척척사장한테 맡기세요! 삼십 일 무료예요.','머리 아픈 계산은 척척사장이 할게요. 프로필 링크 눌러 보세요!','사장님 일, 이제 척척 하세요! 삼십 일 무료예요.']:['척척사장, 삼십 일 무료로 써 보세요!','사장님 일, 이제 척척 하세요! 프로필 링크에 있어요.','오늘 꿀팁 도움 됐으면, 프로필 링크로 놀러 오세요!'];
const lines=[SAY?SAY[0]:t.q,...body,...scr.shots.map((_,i)=>i===0?pick(appLine1):pick(appLine2,1)),pick(outro,2)].map(speak);
// 글만 보여 줄 때 시간(초): 질문 3초, 답은 초당 9자로 3.5~7초, 앱 화면 3.5초, 마지막 3.5초
const secs=[3,...cards.map(c=>Math.min(7,Math.max(3.5,c.replace(/\s/g,"").length/9))),...scr.shots.map(()=>3.5),3.5];

const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const pngs=[];
for(let i=0;i<pages.length;i++){await page.setContent(pages[i],{waitUntil:'load'});await page.waitForTimeout(150);const f=join(out,`card-${i}.png`);await page.screenshot({path:f});pngs.push(f)}
await browser.close();

// 나레이션: MeloTTS로 만든 목소리를 조금 높이고(만화 캐릭터 느낌) 카드 시간을 목소리 길이에 맞춘다
const PITCH=Number(process.env.REEL_PITCH||'1.18');
const probe=f=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString().trim());
const voices=[];let voice=null;
writeFileSync(join(out,'lines.json'),JSON.stringify(lines));
if(!has('--no-voice')){
 try{
  execFileSync(process.env.REEL_PYTHON||'python3',[new URL('./tts.py',import.meta.url).pathname,join(out,'lines.json'),out],{stdio:'inherit',timeout:900000});
  for(let i=0;i<lines.length;i++){const raw=join(out,`voice-${i}.wav`);if(!existsSync(raw)){voices.push(null);continue}
   const sr=Number(execFileSync('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','csv=p=0',raw]).toString().trim())||44100;
   const fx=join(out,`voice-${i}-fx.wav`);
   execFileSync('ffmpeg',['-y','-loglevel','error','-i',raw,'-af',`asetrate=${Math.round(sr*PITCH)},aresample=48000,atempo=${(1/PITCH).toFixed(4)},highpass=f=80,acompressor=threshold=0.2:ratio=3,loudnorm=I=-16:TP=-1.5`,'-ac','2','-ar','48000',fx]);
   voices.push({file:fx,sec:probe(fx)})}
  if(voices.some(Boolean))voice={model:'MeloTTS KR',pitch:PITCH};
 }catch(e){console.log('목소리를 만들지 못해 배경음만 넣어요: '+e.message.split('\n')[0]);voices.length=0}
}
voices.forEach((v,i)=>{if(v)secs[i]=Math.max(secs[i],v.sec+0.6)});

// ffmpeg: 카드마다 살짝 다가가는 움직임 + 0.4초 겹치며 넘어가기
const FADE=0.4,inputs=[],filters=[];
pngs.forEach((f,i)=>{inputs.push('-loop','1','-t',String(secs[i]+FADE),'-i',f);const frames=Math.round((secs[i]+FADE)*30);filters.push(`[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0006,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p,setsar=1[v${i}]`)});
let last='v0',offset=secs[0];const starts=[0];
for(let i=1;i<pngs.length;i++){starts.push(offset);const o=`x${i}`;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${o}]`);last=o;offset+=secs[i]}
const total=secs.reduce((a,b)=>a+b,0)+FADE;
const mp4=join(out,'reel.mp4');
// 배경음: 코드로 만든 곡(저작권 문제 없음). 목소리가 나올 때는 배경음을 낮춘다. --mute면 소리 없이
const mute=has('--mute'),wav=join(out,'music.wav');const music=mute?null:makeMusic(total+0.2,index,wav);
const ai=pngs.length;
if(mute){inputs.push('-f','lavfi','-t',total.toFixed(2),'-i','anullsrc=channel_layout=stereo:sample_rate=48000');filters.push(`[${ai}:a]anull[aout]`)}
else{
 inputs.push('-i',wav);
 const vs=voices.map((v,i)=>v&&{...v,at:starts[i]+0.25}).filter(Boolean);
 if(!vs.length)filters.push(`[${ai}:a]anull[aout]`);
 else{
  vs.forEach((v,k)=>{inputs.push('-i',v.file);const ms=Math.round(v.at*1000);filters.push(`[${ai+1+k}:a]adelay=${ms}|${ms}[vd${k}]`)});
  filters.push(`${vs.map((_,k)=>`[vd${k}]`).join('')}amix=inputs=${vs.length}:normalize=0:duration=longest,apad[vo]`,`[vo]asplit[vo1][vo2]`,`[${ai}:a]volume=0.55[mus]`,`[mus][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=400[md]`,`[md][vo2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]`);
 }
}
execFileSync('ffmpeg',['-y','-loglevel','error',...inputs,'-filter_complex',filters.join(';'),'-map',`[${last}]`,'-map','[aout]','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-r','30','-g','60','-c:a','aac','-b:a','160k','-ar','48000','-t',total.toFixed(2),'-movflags','+faststart',mp4],{stdio:'inherit'});

const tags='#자영업 #자영업자 #사장님 #소상공인 #알바관리 #직원관리 #노무상식 #주휴수당 #최저시급 #근로계약서 #급여명세서 #척척사장';
const caption=`${t.q}\n\n${t.a}\n\n${law?'※ 일반적인 기준이에요. 사정마다 다를 수 있으니 애매하면 고용노동부 상담센터(1350)에 확인하세요.\n\n':''}이런 계산과 서류, 척척사장이 대신 해요. 30일 무료 · 카드 등록 없이 👉 프로필 링크\n\n${tags}`;
writeFileSync(join(out,'caption.txt'),caption);
const pred=predict({q:t.q,cards,secs,audio:!mute,voice:!!voice});
writeFileSync(join(out,'meta.json'),JSON.stringify({index,id:t.id,q:t.q,group:t.group,seconds:Number(total.toFixed(1)),cover:join(out,'card-0.png'),predict:pred,music,voice,screens:{site:site.replace(/^https?:\/\//,''),screen:scr.screen||null,count:scr.shots.length},timeline:secs.map((sec,i)=>({label:i===0?'질문':i===secs.length-1?'마무리':i<=cards.length?'답 '+i:'앱 화면 '+(i-cards.length),sec:Math.round(sec*10)/10,voice:!!voices[i],cps:i>0&&i<=cards.length?Math.round(cards[i-1].replace(/\s/g,'').length/sec*10)/10:null}))},null,1));
console.log(`릴스 만듦: ${index}번 "${t.q}" · ${total.toFixed(1)}초 · 예상 점수 ${pred.score} → ${mp4}`);
