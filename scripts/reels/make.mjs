// 인스타 릴스 자동 만들기: topics.json의 질문 하나 → 세로 영상(1080×1920, 15초 안쪽) + 글 + 표지.
// 구성: 썸네일 겸 첫 3초 훅(hooks.json 5종 중 하나) → 핵심 한 줄 → 실제 앱 화면("척척사장에선 이렇게") → 저장·댓글 부르는 양자택일 마무리.
// 카드마다 무료 AI 목소리(MeloTTS 한국어) 나레이션. 대본은 say.json(말하듯 쓴 짧은 대본), 자세한 답은 캡션에.
// 화면 카드는 Chromium으로 찍고, ffmpeg로 이어 붙인다(H.264·30fps·AAC 48kHz, 인스타 릴스 규격).
// 사용: node scripts/reels/make.mjs [--index N] [--hook break|loss|number|empathy|flip] [--out 폴더] [--site 주소] [--no-voice] [--no-screens] [--mute]
//   --index 없으면 2026-10-05부터 하루에 하나씩 차례로 고른다.
//   목소리 모델이 없거나 실패하면 배경음만, 앱 화면을 못 찍으면 화면 카드 없이 만든다.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {predict} from './predict.mjs';
import {makeMusic} from './music.mjs';
import {captureScreens} from './screens.mjs';
import {speak} from './speak.mjs';

const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const has=k=>process.argv.includes(k);
const topics=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url),'utf8'));
const START=Date.UTC(2026,9,5);
const day=Math.floor((Date.now()+9*3600000-START)/86400000);
// 한 달 대본(month.json)에 오늘(또는 --date) 날짜가 있으면 그걸 쓰고, 없으면 기존 주제를 차례로
const MONTH=JSON.parse(readFileSync(new URL('./month.json',import.meta.url),'utf8')).days;
const kstToday=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const mDate=arg('--date',has('--index')?'':kstToday);
const mi=MONTH.findIndex(m=>m.date===mDate);
const M=mi>=0?MONTH[mi]:null;
const index=Number(arg('--index',String(((day%topics.length)+topics.length)%topics.length)));
const t=M?{id:M.id,group:'사장님 노무 상식',q:M.q,a:M.a,screen:M.screen}:topics[index];if(!t)throw Error('주제 번호가 범위를 벗어났어요: '+index);
const out=resolve(arg('--out','reel-out'));mkdirSync(out,{recursive:true});
const img=p=>existsSync(resolve(p))?'data:image/png;base64,'+readFileSync(resolve(p)).toString('base64'):'';
const wave=img('public/cheokcheoki-welcome.png'),guide=img('public/cheokcheoki-guide.png');
const law=t.group.includes('노무');
const LIMIT=15;// 영상 길이 상한(초)

// 대본: [첫 말, 핵심 한 줄, 썸네일 큰 글씨]. 없으면 질문·답 첫 문장으로 대신
const SAY=JSON.parse(readFileSync(new URL('./say.json',import.meta.url),'utf8'))[t.id]||[t.q,t.a.split(/(?<=[.!?])\s+/)[0],t.q.split(' ')[0]];
// 3단계 대본(hooks.json): 첫 3초 훅 5종 중 고른 하나 → 핵심 한 줄 → 저장·댓글 부르는 양자택일 마무리
const HOOKS=JSON.parse(readFileSync(new URL('./hooks.json',import.meta.url),'utf8'));
const H=HOOKS[t.id];
const hookType=M?M.type:arg('--hook',H?.pick);
const hookLine=M?M.hook:(H?.hooks?.[hookType]||SAY[0]);
const coreLine=M?M.core:SAY[1];
const kw=M?M.kw:(H?.kw||SAY[2]);
const choice=M?M.choice:(H?.choice||['우리 가게는?','해당된다','아니다']);
const next=topics[(index+1)%topics.length];
const nextKw=M?(MONTH[mi+1]?.kw||HOOKS[next.id]?.kw||next.q):(HOOKS[next.id]?.kw||next.q);

const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const FONT="'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const shell=(body,bg,fg,extra='')=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;background:${bg};color:${fg};font-family:${FONT};word-break:keep-all;overflow:hidden;position:relative}
.brand{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:800}.brand i{width:64px;height:64px;border-radius:18px;background:#c8f169;color:#10251b;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:36px}
${extra}</style></head><body>${body}</body></html>`;

// 0) 썸네일 겸 첫 화면: 밝은 연두 바탕, 큰 키워드, 손 흔드는 척척이. 인스타 격자(3:4)에서 잘리지 않게 가운데(위아래 240px 안쪽)에 모은다
const cover=shell(`
<div class="ring r1"></div><div class="ring r2"></div>
<div class="top"><div class="brand"><i>척</i>척척사장</div><span class="sticker">${law?'사장님 필수 상식':'척척사장 꿀팁'}</span></div>
<div class="kw"><span>${esc(kw)}</span></div>
<h1>${esc(hookLine)}</h1>
<div class="bubble">10초면 끝!</div>
${wave?`<img class="pal" src="${wave}" alt="">`:''}`,'#c8f169','#10251b',`
.ring{position:absolute;border-radius:50%;border:56px solid rgba(255,255,255,.35)}.r1{width:900px;height:900px;right:-260px;bottom:120px}.r2{width:420px;height:420px;left:-160px;top:300px;border-width:40px}
.top{position:absolute;left:84px;right:84px;top:300px;display:flex;justify-content:space-between;align-items:center}
.top .brand{color:#10251b}.top .brand i{background:#10251b;color:#c8f169}
.sticker{background:#fff;color:#10251b;font-size:40px;font-weight:900;padding:16px 30px;border-radius:999px;transform:rotate(4deg);box-shadow:0 8px 0 #10251b}
.kw{position:absolute;left:84px;right:84px;top:440px}
.kw span{display:inline-block;font-size:${kw.length<=4?230:kw.length<=6?190:150}px;line-height:1.05;font-weight:900;letter-spacing:-8px;color:#10251b;background:linear-gradient(transparent 62%,#fff 62%,#fff 92%,transparent 92%);padding:0 10px}
h1{position:absolute;left:84px;width:900px;top:${kw.length<=4?760:720}px;margin:0;font-size:76px;line-height:1.22;font-weight:900;letter-spacing:-2.5px}
.pal{position:absolute;right:-40px;bottom:230px;width:640px;height:640px;object-fit:contain;filter:drop-shadow(0 24px 30px rgba(16,37,27,.35))}
.bubble{position:absolute;left:96px;bottom:420px;background:#10251b;color:#c8f169;font-size:52px;font-weight:900;padding:24px 40px;border-radius:40px 40px 40px 8px}`);

// 1) 핵심 한 줄: 짙은 초록 바탕에 큰 글씨, 자세한 건 캡션으로
const core=shell(`
<div class="brand" style="position:absolute;left:96px;top:240px"><i>척</i>척척사장</div>
<span class="tag">${esc(kw)}</span>
<p>${esc(coreLine).split(esc(kw)).join(`<em>${esc(kw)}</em>`)}</p>
<div class="foot">자세한 기준은 캡션에 정리했어요</div>
${guide?`<img class="pal" src="${guide}" alt="">`:''}`,'#10251b','#ffffff',`
.tag{position:absolute;left:96px;top:420px;background:#c8f169;color:#10251b;font-size:44px;font-weight:900;padding:14px 30px;border-radius:999px}
p{position:absolute;left:96px;right:96px;top:540px;margin:0;font-size:${coreLine.length>30?88:100}px;line-height:1.32;font-weight:900;letter-spacing:-3px}
.foot{position:absolute;left:96px;bottom:250px;width:440px;font-size:42px;line-height:1.4;font-weight:700;color:#b9cbbf}
.pal{position:absolute;right:80px;bottom:240px;width:380px;height:380px;object-fit:cover;border-radius:50%;background:#e3efe8;border:10px solid #c8f169}
p em{font-style:normal;color:#c8f169}`);

const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
// 2) 실제 앱 화면 한 장: 체험 화면(예시 가게)을 휴대폰 크기로 찍는다
const site=arg('--site',process.env.REEL_SITE||'https://chukchukapp.kr');
const scr=has('--no-screens')?{shots:[],label:''}:await captureScreens(browser,site,t.screen||t.id,out);
const shot=scr.shots[0];
const phone=shot&&shell(`
<div class="brand" style="position:absolute;left:96px;top:120px"><i>척</i>척척사장</div>
<span class="tag">척척사장에선 이렇게</span><h2>${esc(scr.label)} 화면</h2>
<div class="ph"><img src="data:image/png;base64,${readFileSync(shot).toString('base64')}" alt=""></div>`,'#15643f','#ffffff',`
.tag{position:absolute;left:96px;top:240px;background:#c8f169;color:#10251b;font-size:44px;font-weight:900;padding:14px 30px;border-radius:999px}
h2{position:absolute;left:96px;top:330px;margin:0;font-size:84px;font-weight:900;letter-spacing:-2px}
.ph{position:absolute;left:50%;top:500px;transform:translateX(-50%);padding:20px;border-radius:84px;background:#06110c;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.ph img{display:block;width:600px;height:1298px;object-fit:cover;object-position:top;border-radius:66px}`);

// 3) 마무리
const end=shell(`
<div class="brand" style="position:absolute;left:96px;top:240px"><i>척</i>척척사장</div>
<div class="save">저장해 두고 필요할 때 꺼내 봐</div>
<h1>${esc(choice[0])}</h1>
<div class="opt"><b>1</b>${esc(choice[1])}</div>
<div class="opt o2"><b>2</b>${esc(choice[2])}</div>
<div class="say">댓글에 숫자만 남겨 줘!</div>
<div class="url">30일 무료 · chukchukapp.kr${law?' · 상담 1350':''}</div>
${wave?`<img class="pal" src="${wave}" alt="">`:''}`,'#10251b','#ffffff',`
.save{position:absolute;left:96px;top:360px;font-size:42px;font-weight:800;color:#c8f169}
h1{position:absolute;left:96px;right:96px;top:450px;margin:0;font-size:${choice[0].length>12?92:108}px;line-height:1.18;font-weight:900;letter-spacing:-4px}
.opt{position:absolute;left:96px;top:760px;display:flex;align-items:center;gap:24px;background:#ffffff;color:#10251b;font-size:60px;font-weight:900;padding:22px 40px 22px 22px;border-radius:999px}
.opt.o2{top:900px;background:#c8f169}
.opt b{width:84px;height:84px;border-radius:50%;background:#10251b;color:#c8f169;display:flex;align-items:center;justify-content:center;font-size:52px}
.say{position:absolute;left:100px;top:1060px;font-size:48px;font-weight:800;color:#d9eadf}
.url{position:absolute;left:100px;top:1150px;font-size:36px;color:#9fbcaa;font-weight:700}
.pal{position:absolute;right:0;bottom:120px;width:520px;height:520px;object-fit:contain}`);

const pages=[cover,core,...(phone?[phone]:[]),end];
const labels=['훅(썸네일)','핵심',...(phone?['앱 화면']:[]),'댓글 질문'];
const pick=(arr,k=0)=>arr[(index+k)%arr.length];
const lines=[hookLine,coreLine,...(phone?[pick(['앱에선 이렇게 바로 보여!','버튼 한 번이면 끝!','척척사장이면 진짜 쉬워!'])]:[]),`${choice[1]}? 아니면 ${choice[2]}? 댓글로 숫자만!`].map(speak);
// 글만 보여 줄 때 시간(초)
const secs=[Math.min(3,Math.max(2.2,hookLine.replace(/\s/g,'').length/7)),Math.min(5,Math.max(3,coreLine.replace(/\s/g,'').length/8)),...(phone?[2.6]:[]),3];

const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const pngs=[];
for(let i=0;i<pages.length;i++){await page.setContent(pages[i],{waitUntil:'load'});await page.waitForTimeout(150);const f=join(out,`card-${i}.png`);await page.screenshot({path:f});pngs.push(f)}
await browser.close();
writeFileSync(join(out,'lines.json'),JSON.stringify(lines));

// 나레이션: MeloTTS 목소리를 조금 높여(캐릭터 느낌) 붙이고, 15초를 넘으면 말을 조금 빠르게 한다
const PITCH=Number(process.env.REEL_PITCH||'1.18'),FADE=0.35,PAD=0.3;
const probe=f=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString().trim());
const fx=(raw,dst,tempo)=>{const sr=Number(execFileSync('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=sample_rate','-of','csv=p=0',raw]).toString().trim())||44100;
 const at=tempo/PITCH,chain=at<0.5?['atempo=0.5',`atempo=${(at/0.5).toFixed(4)}`]:[`atempo=${at.toFixed(4)}`];
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',raw,'-af',[`asetrate=${Math.round(sr*PITCH)}`,'aresample=48000',...chain,'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_threshold=-45dB:stop_duration=0.25','highpass=f=80','acompressor=threshold=0.2:ratio=3','loudnorm=I=-15:TP=-1.5'].join(','),'-ac','2','-ar','48000',dst]);return probe(dst)};
let voices=[],voice=null;
if(!has('--no-voice')){
 try{
  execFileSync(process.env.REEL_PYTHON||'python3',[new URL('./tts.py',import.meta.url).pathname,join(out,'lines.json'),out],{stdio:'inherit',timeout:900000});
  const raws=lines.map((_,i)=>join(out,`voice-${i}.wav`));
  const build=tempo=>raws.map((r,i)=>existsSync(r)?{file:join(out,`voice-${i}-fx.wav`),sec:fx(r,join(out,`voice-${i}-fx.wav`),tempo)}:null);
  let tempo=1;voices=build(tempo);
  const need=()=>voices.reduce((n,v,i)=>n+Math.max(v?v.sec+PAD:0,i===1?2.6:1.6),0)+FADE;
  if(need()>LIMIT-0.2){const vsum=voices.reduce((n,v)=>n+(v?v.sec:0),0),room=LIMIT-0.2-FADE-voices.length*PAD;tempo=Math.min(1.35,vsum/Math.max(1,room)+0.02);voices=build(tempo)}
  if(voices.some(Boolean))voice={model:'MeloTTS KR',pitch:PITCH,tempo:Math.round(tempo*100)/100};
 }catch(e){console.log('목소리를 만들지 못해 배경음만 넣어요: '+e.message.split('\n')[0]);voices=[]}
}
voices.forEach((v,i)=>{if(v)secs[i]=Math.max(i===1?2.6:1.6,v.sec+PAD)});
// 그래도 넘으면 화면 시간을 비율대로 줄인다
let sum=secs.reduce((a,b)=>a+b,0)+FADE;if(sum>LIMIT){const k=(LIMIT-FADE)/(sum-FADE);for(let i=0;i<secs.length;i++)secs[i]=Math.round(secs[i]*k*100)/100}

// ffmpeg: 카드마다 살짝 다가가는 움직임 + 짧게 겹치며 넘어가기
const inputs=[],filters=[];
pngs.forEach((f,i)=>{inputs.push('-loop','1','-t',String(secs[i]+FADE),'-i',f);const frames=Math.round((secs[i]+FADE)*30);filters.push(`[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0008,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p,setsar=1[v${i}]`)});
let last='v0',offset=secs[0];const starts=[0];
for(let i=1;i<pngs.length;i++){starts.push(offset);const o=`x${i}`;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${o}]`);last=o;offset+=secs[i]}
const total=Math.min(LIMIT,secs.reduce((a,b)=>a+b,0)+FADE);
const mp4=join(out,'reel.mp4');
// 배경음: 코드로 만든 곡(저작권 문제 없음). 목소리가 나올 때는 배경음을 낮춘다. --mute면 소리 없이
const mute=has('--mute'),wav=join(out,'music.wav');const music=mute?null:makeMusic(total+0.2,index,wav);
const ai=pngs.length;
if(mute){inputs.push('-f','lavfi','-t',total.toFixed(2),'-i','anullsrc=channel_layout=stereo:sample_rate=48000');filters.push(`[${ai}:a]anull[aout]`)}
else{
 inputs.push('-i',wav);
 const vs=voices.map((v,i)=>v&&{...v,at:starts[i]+0.12}).filter(Boolean);
 if(!vs.length)filters.push(`[${ai}:a]anull[aout]`);
 else{
  vs.forEach((v,k)=>{inputs.push('-i',v.file);const ms=Math.round(v.at*1000);filters.push(`[${ai+1+k}:a]adelay=${ms}|${ms}[vd${k}]`)});
  filters.push(`${vs.map((_,k)=>`[vd${k}]`).join('')}amix=inputs=${vs.length}:normalize=0:duration=longest,apad[vo]`,`[vo]asplit[vo1][vo2]`,`[${ai}:a]volume=0.55[mus]`,`[mus][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=400[md]`,`[md][vo2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]`);
 }
}
execFileSync('ffmpeg',['-y','-loglevel','error',...inputs,'-filter_complex',filters.join(';'),'-map',`[${last}]`,'-map','[aout]','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-r','30','-g','60','-c:a','aac','-b:a','160k','-ar','48000','-t',total.toFixed(2),'-movflags','+faststart',mp4],{stdio:'inherit'});
// 표지(썸네일) 파일: 첫 화면을 jpg로
execFileSync('ffmpeg',['-y','-loglevel','error','-i',pngs[0],'-q:v','3',join(out,'cover.jpg')]);

// 해시태그는 5개 안쪽(2026 인스타 기준), 검색 키워드는 캡션 본문에
const tags=M?(M.tags+' #자영업 #척척사장'):'#자영업 #사장님 #알바관리 #노무상식 #척척사장';
const caption=`${hookLine}\n\n${t.q}\n${t.a}\n\n${law?'※ 일반적인 기준이에요. 사정마다 다를 수 있으니 애매하면 고용노동부 상담센터(1350)에 확인하세요.\n\n':''}📌 급할 때 꺼내 보게 저장해 둬요.\n\n${choice[0]}\n1️⃣ ${choice[1]}  2️⃣ ${choice[2]}\n댓글에 숫자만 남겨 주세요!\n\n내일은 '${nextKw}' 편이에요. 놓치기 싫으면 팔로우 👉 @chukchukbot_official\n\n이런 계산과 서류, 척척사장이 대신 해요. 30일 무료 · 카드 등록 없이 👉 프로필 링크\n\n${tags}`;
writeFileSync(join(out,'caption.txt'),caption);
const pred=predict({q:hookLine,cards:[coreLine],secs,audio:!mute,voice:!!voice});
writeFileSync(join(out,'meta.json'),JSON.stringify({index,date:M?.date||null,slot:M?.time||null,type:M?.type||null,id:t.id,q:t.q,hook:hookLine,hookType,choice,kw,group:t.group,seconds:Number(total.toFixed(1)),cover:join(out,'cover.jpg'),predict:pred,music,voice,screens:{site:site.replace(/^https?:\/\//,''),screen:scr.screen||null,count:phone?1:0},timeline:secs.map((sec,i)=>({label:labels[i],sec:Math.round(sec*10)/10,voice:!!voices[i],cps:i===1?Math.round(coreLine.replace(/\s/g,'').length/sec*10)/10:null}))},null,1));
console.log(`릴스 만듦: ${index}번 "${t.q}" · ${total.toFixed(1)}초 · 예상 점수 ${pred.score} → ${mp4}`);
