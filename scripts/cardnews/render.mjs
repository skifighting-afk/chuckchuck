// 카드뉴스 그리기: weeks.json → 주마다 카드 PNG(1080×1350, 인스타 4:5). 릴스 카드와 같은 색·글꼴.
// 사용: node scripts/cardnews/render.mjs [--week 1] [--out cardnews-out]
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const data=JSON.parse(readFileSync(new URL('./weeks.json',import.meta.url),'utf8'));
const only=arg('--week','');
const outRoot=resolve(arg('--out','cardnews-out'));
const img=p=>existsSync(resolve(p))?'data:image/png;base64,'+readFileSync(resolve(p)).toString('base64'):'';
const wave=img('public/cheokcheoki-welcome.png'),guide=img('public/cheokcheoki-guide.png');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const FONT="'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const G='#10251b',L='#c8f169',W='#ffffff',S='#d9eadf',M='#9fbcaa',WARN='#ffb35c';

function page(w,c,i,n){
 const dark=!['cover','cta'].includes(c.k);
 const bg=c.k==='cover'?L:c.k==='cta'?L:c.k==='warn'?'#2a1d0e':G;
 const fg=dark?W:G;
 const head=`<div class="top"><div class="brand"><i>척</i>척척사장</div><span class="pg">${i+1} / ${n}</span></div>`;
 let body='';
 if(c.k==='cover')body=`<div class="tag">${esc(w.type.split(' · ')[0])}</div><div class="big">${esc(c.big)}</div><h1>${esc(c.t)}</h1><p class="sub">${esc(c.s)}</p>${wave?`<img class="pal" src="${wave}">`:''}<div class="swipe">넘겨 보기 →</div>`;
 else if(c.k==='fact')body=`<h2>${esc(c.t)}</h2><div class="num">${esc(c.big)}</div><p>${esc(c.s)}</p>`;
 else if(c.k==='table')body=`<h2>${esc(c.t)}</h2><table>${c.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table><p class="small">${esc(c.s)}</p>`;
 else if(c.k==='warn')body=`<div class="tag warnt">주의</div><h2 class="w">${esc(c.t)}</h2><p>${esc(c.s)}</p>`;
 else if(c.k==='num')body=`<div class="circle">${esc(c.n)}</div><h2>${esc(c.t)}</h2><p>${esc(c.s)}</p>`;
 else if(c.k==='case')body=`<div class="tag">${esc(c.n)}</div><h2 class="case">${esc(c.t)}</h2><div class="vote"><span>사장 잘못?</span><span>알바 잘못?</span></div><p class="small">다음 장에서 판정 →</p>`;
 else if(c.k==='verdict')body=`<div class="tag lime">${esc(c.n)}</div><div class="num v">${esc(c.t)}</div><p>${esc(c.s)}</p>`;
 else if(c.k==='app')body=`<div class="tag lime">척척사장에선 이렇게</div><h2>${esc(c.t)}</h2><p>${esc(c.s)}</p>${guide?`<img class="pal2" src="${guide}">`:''}`;
 else if(c.k==='cta')body=`<div class="save">${esc(c.t)}</div><h1 class="q">${esc(c.q)}</h1><div class="opt"><b>1</b>${esc(c.o[0])}</div><div class="opt o2"><b>2</b>${esc(c.o[1])}</div><div class="cta">30일 무료 · 카드 등록 없이</div><div class="url">chukchukapp.kr · 프로필 링크</div>${wave?`<img class="pal3" src="${wave}">`:''}`;
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;background:${bg};color:${fg};font-family:${FONT};word-break:keep-all;overflow:hidden;position:relative}
.top{position:absolute;left:84px;right:84px;top:70px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:16px;font-size:36px;font-weight:800}.brand i{width:58px;height:58px;border-radius:16px;background:${dark?L:G};color:${dark?G:L};display:flex;align-items:center;justify-content:center;font-style:normal;font-size:32px}
.pg{font-size:30px;font-weight:700;opacity:.7}
.tag{display:inline-block;position:absolute;left:84px;top:190px;font-size:36px;font-weight:900;padding:12px 28px;border-radius:999px;background:${dark?'rgba(255,255,255,.12)':W};color:${dark?S:G}}
.tag.lime{background:${L};color:${G}}.tag.warnt{background:${WARN};color:#2a1d0e}
.big{position:absolute;left:78px;right:60px;top:300px;font-size:200px;line-height:1;font-weight:900;letter-spacing:-8px}
.big{background:linear-gradient(transparent 62%,#fff 62%,#fff 92%,transparent 92%);display:inline-block;padding:0 12px}
h1{position:absolute;left:84px;right:84px;top:560px;margin:0;font-size:78px;line-height:1.22;font-weight:900;letter-spacing:-2.5px}
h1.q{top:400px;font-size:96px}
.sub{position:absolute;left:88px;right:420px;top:900px;margin:0;font-size:38px;line-height:1.4;font-weight:700;opacity:.8}
.swipe{position:absolute;left:84px;bottom:90px;font-size:40px;font-weight:900;background:${G};color:${L};padding:18px 34px;border-radius:999px}
.pal{position:absolute;right:10px;bottom:40px;width:440px;height:440px;object-fit:contain}
h2{position:absolute;left:84px;right:84px;top:300px;margin:0;font-size:80px;line-height:1.2;font-weight:900;letter-spacing:-2.5px}
h2.case{font-size:76px}h2.w{color:${WARN}}
.num{position:absolute;left:84px;right:84px;top:520px;font-size:150px;line-height:1.05;font-weight:900;letter-spacing:-6px;color:${L}}
.num.v{top:300px;font-size:104px;letter-spacing:-3px}
p{position:absolute;left:88px;right:88px;top:860px;margin:0;font-size:46px;line-height:1.45;font-weight:700;color:${dark?S:G}}
p.small{font-size:36px;top:auto;bottom:110px;color:${M}}
.circle{position:absolute;left:84px;top:170px;width:120px;height:120px;border-radius:50%;background:${L};color:${G};display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:900}
table{position:absolute;left:84px;right:84px;top:480px;border-collapse:collapse;font-size:56px;font-weight:800}
td{padding:26px 0;border-bottom:3px solid rgba(255,255,255,.15)}td:last-child{text-align:right;color:${L};font-weight:900}
.vote{position:absolute;left:84px;right:84px;top:760px;display:flex;gap:24px}.vote span{flex:1;text-align:center;font-size:52px;font-weight:900;padding:36px 0;border-radius:28px;background:rgba(255,255,255,.1)}.vote span:last-child{background:${L};color:${G}}
.pal2{position:absolute;right:30px;bottom:30px;width:360px;height:360px;object-fit:contain}
.save{position:absolute;left:84px;top:220px;font-size:44px;font-weight:900;background:${G};color:${L};padding:16px 30px;border-radius:999px}
.opt{position:absolute;left:84px;top:680px;display:flex;align-items:center;gap:24px;background:${W};color:${G};font-size:58px;font-weight:900;padding:20px 44px 20px 20px;border-radius:999px}
.opt.o2{top:820px;background:${G};color:${L}}.opt b{width:84px;height:84px;border-radius:50%;background:${G};color:${L};display:flex;align-items:center;justify-content:center;font-size:52px}.opt.o2 b{background:${L};color:${G}}
.cta{position:absolute;left:84px;top:1010px;font-size:48px;font-weight:900}
.url{position:absolute;left:84px;top:1085px;font-size:36px;font-weight:700;opacity:.75}
.pal3{position:absolute;right:0;bottom:0;width:420px;height:420px;object-fit:contain}
</style></head><body>${head}${body}</body></html>`;
}

const browser=await chromium.launch();
const pg=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(const w of data.weeks){
 if(only&&String(w.no)!==only)continue;
 const dir=join(outRoot,`week${w.no}`);mkdirSync(dir,{recursive:true});
 // 표지 A·B 두 장(광고 A/B 시험용) + 나머지 카드
 const covers=[{...w.cards[0],t:w.hookA},{...w.cards[0],t:w.hookB}];
 const rest=w.cards.slice(1),n=w.cards.length;
 const jobs=[['cover-A.png',covers[0],0],['cover-B.png',covers[1],0],...rest.map((c,i)=>[`card-${String(i+2).padStart(2,'0')}.png`,c,i+1])];
 for(const [f,c,i] of jobs){await pg.setContent(page(w,c,i,n),{waitUntil:'load'});await pg.waitForTimeout(120);await pg.screenshot({path:join(dir,f)})}
 console.log(`${w.no}주차 카드 ${jobs.length}장 → ${dir}`);
}
await browser.close();
