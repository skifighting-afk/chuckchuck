// 인스타 릴스 자동 만들기: topics.json의 질문 하나 → 세로 영상(1080×1920, 약 15~25초) + 글 + 표지.
// 화면 카드는 Chromium으로 찍고, ffmpeg로 이어 붙인다(H.264·30fps·AAC 48kHz, 인스타 릴스 규격).
// 사용: node scripts/reels/make.mjs [--index N] [--out 폴더]
//   --index 없으면 2026-10-05부터 하루에 하나씩 차례로 고른다.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

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
const pages=[
 shell(`<div class="brand"><i>척</i>척척사장봇</div><span class="tag" style="margin-top:120px;background:#c8f169;color:#10251b">${esc(t.group)}</span><h1 style="margin-top:48px">${esc(t.q)}</h1><div class="foot" style="color:#b9cbbf">끝까지 보면 답이 나와요</div>${mascot?`<div class="pal"><img src="${mascot}" alt=""></div>`:''}`,'#10251b','#ffffff'),
 ...cards.map((c,i)=>shell(`<div class="brand" style="color:#15643f"><i>척</i>척척사장봇</div><span class="tag" style="margin-top:120px;background:#15643f;color:#fff">${i+1} / ${cards.length}</span><p style="margin-top:56px">${esc(c)}</p><div class="foot" style="color:#4b5d53">${esc(t.q)}</div>`,'#f4f7f5','#10251b')),
 shell(`<div class="brand"><i>척</i>척척사장봇</div><h1 style="margin-top:160px">${law?'이런 계산,<br>앱이 대신 해요':'더 쉽게,<br>척척.'}</h1><p style="margin-top:56px;font-size:60px;color:#d9eadf">주휴수당 · 급여명세서 · 근로계약서 · QR 출퇴근</p><div class="foot"><div style="font-size:56px;color:#c8f169;font-weight:900">30일 무료 · 프로필 링크</div><div style="margin-top:12px;color:#d9eadf">chukchukapp.kr${law?' · 자세한 상담은 고용노동부 1350':''}</div></div>`,'#15643f','#ffffff'),
];
// 카드별 보여 줄 시간(초): 질문 3초, 답은 글자 수에 맞춰 4~6초, 마지막 3.5초
const secs=[3,...cards.map(c=>Math.min(6,Math.max(4,c.length/18))),3.5];

const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const pngs=[];
for(let i=0;i<pages.length;i++){await page.setContent(pages[i],{waitUntil:'load'});await page.waitForTimeout(150);const f=join(out,`card-${i}.png`);await page.screenshot({path:f});pngs.push(f)}
await browser.close();

// ffmpeg: 카드마다 살짝 다가가는 움직임 + 0.4초 겹치며 넘어가기 + 소리 없는 오디오 트랙
const FADE=0.4,inputs=[],filters=[];
pngs.forEach((f,i)=>{inputs.push('-loop','1','-t',String(secs[i]+FADE),'-i',f);const frames=Math.round((secs[i]+FADE)*30);filters.push(`[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0006,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p,setsar=1[v${i}]`)});
let last='v0',offset=secs[0];
for(let i=1;i<pngs.length;i++){const o=`x${i}`;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${o}]`);last=o;offset+=secs[i]}
const total=secs.reduce((a,b)=>a+b,0)+FADE;
const mp4=join(out,'reel.mp4');
execFileSync('ffmpeg',['-y','-loglevel','error',...inputs,'-f','lavfi','-t',total.toFixed(2),'-i','anullsrc=channel_layout=stereo:sample_rate=48000','-filter_complex',filters.join(';'),'-map',`[${last}]`,'-map',`${pngs.length}:a`,'-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-r','30','-g','60','-c:a','aac','-b:a','128k','-ar','48000','-shortest','-movflags','+faststart',mp4],{stdio:'inherit'});

const tags='#자영업 #자영업자 #사장님 #소상공인 #알바관리 #직원관리 #노무상식 #주휴수당 #최저시급 #근로계약서 #급여명세서 #척척사장봇';
const caption=`${t.q}\n\n${t.a}\n\n${law?'※ 일반적인 기준이에요. 사정마다 다를 수 있으니 애매하면 고용노동부 상담센터(1350)에 확인하세요.\n\n':''}이런 계산과 서류, 척척사장봇이 대신 해요. 30일 무료 · 카드 등록 없이 👉 프로필 링크\n\n${tags}`;
writeFileSync(join(out,'caption.txt'),caption);
writeFileSync(join(out,'meta.json'),JSON.stringify({index,id:t.id,q:t.q,seconds:Number(total.toFixed(1)),cover:join(out,'card-0.png')},null,1));
console.log(`릴스 만듦: ${index}번 "${t.q}" · ${total.toFixed(1)}초 → ${mp4}`);
