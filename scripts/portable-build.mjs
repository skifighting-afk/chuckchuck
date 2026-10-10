// 화면(dist/client → GitHub Pages)과 서버 함수(supabase/functions/api/index.js), 테스트용 서버 묶음(dist/server)을 만든다.
import {build} from 'rolldown';
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';

import {existsSync,readFileSync} from 'node:fs';
const fileConfig=existsSync('deploy.config.json')?JSON.parse(readFileSync('deploy.config.json','utf8')):{};
const pick=k=>process.env[k]||fileConfig[k]||'';
const supabaseUrl=pick('SUPABASE_URL')||'http://localhost:54321';
const anonKey=pick('SUPABASE_ANON_KEY')||'local-anon-key';
const appDomain=pick('APP_DOMAIN');
// 브랜드 홈페이지 주소. 로그인 안 한 사람이 앱 첫 화면(/)에 오면 여기로 보낸다.
const homeOrigin='https://'+(pick('HOME_DOMAIN').trim()||'chukchuksajang.co.kr')+'/';
// 메타 광고 픽셀(공개 값). 비어 있으면 광고 추적 코드는 전혀 실리지 않는다.
const metaPixelId=pick('META_PIXEL_ID').trim();
if(metaPixelId&&!/^\d{15,16}$/.test(metaPixelId))throw Error('META_PIXEL_ID는 15~16자리 숫자여야 해요: '+metaPixelId);
if(metaPixelId&&readFileSync('lib/legal-docs.ts','utf8').includes('광고·행동 분석용 추적 도구는 쓰지 않습니다'))throw Error('메타 픽셀을 켜기 전에 개인정보 처리방침(lib/legal-docs.ts 10항·국외 이전)을 고쳐야 해요.');
if(process.env.CI&&process.env.REQUIRE_SUPABASE_CONFIG&&(!pick('SUPABASE_URL')||!pick('SUPABASE_ANON_KEY')))throw Error('SUPABASE_URL과 SUPABASE_ANON_KEY(저장소 Variables)가 필요해요.');

await mkdir('dist/client',{recursive:true});
await copyFile('lib/vendor/noble-hashes/LICENSE','dist/client/noble-hashes-LICENSE.txt');
await copyFile('lib/vendor/jsQR.LICENSE','dist/client/jsQR-LICENSE.txt');
await build({input:'app/client.tsx',resolve:{alias:{'@':path.resolve('.')}},transform:{define:{'process.env.NODE_ENV':JSON.stringify('production'),__SUPABASE_URL__:JSON.stringify(supabaseUrl),__SUPABASE_ANON_KEY__:JSON.stringify(anonKey),__META_PIXEL_ID__:JSON.stringify(metaPixelId),__KAKAO_LOGIN__:JSON.stringify(fileConfig.KAKAO_LOGIN===true),__HOME_ORIGIN__:JSON.stringify(homeOrigin),__KAKAO_CHANNEL__:JSON.stringify(typeof fileConfig.KAKAO_CHANNEL_URL==='string'?fileConfig.KAKAO_CHANNEL_URL:'')},jsx:{runtime:'automatic'}},output:{dir:'dist/client',entryFileNames:'app.js',chunkFileNames:'chunks/[name]-[hash].js',format:'esm',minify:true}});
// 작업 010: 묶음 크기 기록(처음 받는 app.js와 필요할 때 받는 조각)
{const {readdirSync,statSync}=await import('node:fs');const kb=f=>Math.round(statSync(f).size/1024);const chunks=existsSync('dist/client/chunks')?readdirSync('dist/client/chunks').map(f=>[f,kb('dist/client/chunks/'+f)]).sort((a,b)=>b[1]-a[1]):[];console.log(`화면 묶음: app.js ${kb('dist/client/app.js')}KB, 필요할 때 받는 조각 ${chunks.length}개 ${chunks.reduce((n,c)=>n+c[1],0)}KB`);for(const [f,k] of chunks.slice(0,8))console.log(`  ${f} ${k}KB`)}
const css=await compile(await readFile('app/globals.css','utf8'),{base:path.resolve('app'),onDependency:()=>{}});
const scanner=new Scanner({sources:[{base:path.resolve('.'),pattern:'{app,components,hooks}/**/*.{ts,tsx}',negated:false}]});
await writeFile('dist/client/app.css',css.build(scanner.scan()));
for(const f of ['cheokcheoki-guide.png','favicon.svg','cheokcheoki-welcome.png','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','icon-maskable-512.png'])await copyFile('public/'+f,'dist/client/'+f);
// 작업 074: GitHub Pages는 응답 헤더를 못 바꾸므로 보안 정책을 HTML meta로 넣는다.
// 화면은 자기 파일만 불러오고, 서버(Supabase)에만 연결한다. 카메라(QR) 영상과 QR·명세서 이미지(data:, blob:)는 허용.
const supabaseOrigin=new URL(supabaseUrl).origin;
const fb=metaPixelId?{script:' https://connect.facebook.net',img:' https://www.facebook.com',connect:' https://www.facebook.com https://connect.facebook.net'}:{script:'',img:'',connect:''};
// 토스페이먼츠 결제창(v2): 스크립트·결제창 iframe·이미지·결제 요청 주소
const toss={script:' https://js.tosspayments.com',frame:'https://*.tosspayments.com https://*.toss.im',img:' https://static.toss.im https://*.tosspayments.com',connect:' https://*.tosspayments.com',form:' https://*.tosspayments.com https://*.toss.im'};
const csp=["default-src 'self'",`script-src 'self'${fb.script}${toss.script}`,"style-src 'self' 'unsafe-inline'",`img-src 'self' data: blob:${fb.img}${toss.img}`,"media-src 'self' blob: mediastream:","font-src 'self' data:",`connect-src 'self' ${supabaseOrigin}${fb.connect}${toss.connect}`,`frame-src ${toss.frame}`,"object-src 'none'","base-uri 'self'",`form-action 'self'${toss.form}`,"worker-src 'self' blob:","manifest-src 'self'","upgrade-insecure-requests"].join('; ');
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="strict-origin-when-cross-origin"><title>척척사장 · 직원 관리</title><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#185b45"><meta name="description" content="입사부터 출퇴근, 급여와 계약까지. 함께 일하는 사람을 위한 매장 관리."><link rel="icon" href="/favicon.svg"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="apple-mobile-web-app-title" content="척척사장"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
await writeFile('dist/client/404.html',html); // GitHub Pages: 모든 주소를 화면 앱으로(로그인 화면은 검색에 안 나오게 noindex)
// 가이드 23: 로그인 없이 보는 공개 화면은 검색에 나오게 각자 제목·설명을 가진 HTML로 따로 둔다(GitHub Pages는 /pricing → pricing.html).
const site='https://'+(appDomain?.trim()||'chukchukapp.kr');
const esc=v=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const PUBLIC_PAGES=[
 ['/','index.html','척척사장 · 직원 출근부터 월급 정리까지','앱 설치 없이 휴대폰으로 쓰는 작은 가게 매장 관리. 직원 등록, 근무표, QR 출퇴근, 급여 계산과 명세서, 전자근로계약서까지. 30일 무료, 카드 등록 없음.'],
 ['/pricing','pricing.html','요금 안내 · 척척사장','베이직 월 9,900원부터, 프로(매장 QR 출퇴근) 월 14,900원부터(1지점, VAT 포함). 직원 수 제한 없이 지점 수로만 정해요. 30일 무료.'],
 ['/calculator','calculator.html','주휴수당·인건비 계산기 · 척척사장','시급과 근무 시간만 넣으면 주휴수당, 월 인건비, 4대보험 사장님 부담까지 바로 계산해요. 로그인 없이 무료.'],
 ['/help','help.html','자주 묻는 질문 · 척척사장','출퇴근 QR, 근무표, 급여 계산, 근로계약서, 요금과 체험에 대해 자주 묻는 질문을 모았어요.'],
 ['/start','start.html','시작하기 · 척척사장','사장님은 가게를 만들고, 직원은 가입 링크로 합류해요.'],
 ['/terms','terms.html','이용약관 · 척척사장','척척사장 이용약관'],
 ['/privacy','privacy.html','개인정보 처리방침 · 척척사장','척척사장 개인정보 처리방침'],
 ['/refund','refund.html','해지·환불 규정 · 척척사장','척척사장 해지·환불 규정'],
 ['/policy','policy.html','운영정책 · 척척사장','하지 말아야 할 일, 이용 제한 단계, 신고·이의 제기, 문의 처리 기한'],
 ['/accessibility','accessibility.html','접근성 안내 · 척척사장','누구나 쓸 수 있게 지키는 기준과 불편 신고 방법'],
 ['/news','news.html','서비스 소식 · 척척사장','척척사장에 새로 나온 기능과 바뀐 점'],
 ['/privacy-request','privacy-request.html','개인정보 요청 · 척척사장','내 개인정보 열람·정정·삭제·처리정지 요청 방법'],
 ['/status','status.html','서비스 상태 · 척척사장','척척사장 서버와 데이터베이스가 정상인지, 최근 서비스 안내를 확인해요.'],
];
for(const [path,file,title,desc] of PUBLIC_PAGES){
 const page=html.replace('<meta name="robots" content="noindex,nofollow">','<link rel="canonical" href="'+(path==='/'?homeOrigin:site+path)+'"><meta property="og:type" content="website"><meta property="og:site_name" content="척척사장"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+site+path+'"><meta property="og:image" content="'+site+'/icon-512.png"><meta property="og:locale" content="ko_KR">')
  .replace(/<title>[^<]*<\/title>/,'<title>'+esc(title)+'</title>').replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="'+esc(desc)+'">');
 if(page.includes('noindex'))throw new Error('공개 화면에 noindex가 남았어요: '+path);
 await writeFile('dist/client/'+file,page);
}
// 앱 화면 껍데기를 /app(app.html)에도 둔다(GitHub Pages가 200으로 답하게). 브랜드 홈페이지는 따로 배포한다(scripts/build-home.mjs → HOME_DOMAIN).
await writeFile('dist/client/app.html',html);
// 토스페이먼츠 결제창이 돌아오는 주소(200으로 답하게)
await mkdir('dist/client/billing',{recursive:true});await writeFile('dist/client/billing/success.html',html);await writeFile('dist/client/billing/fail.html',html);
await writeFile('dist/client/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+PUBLIC_PAGES.filter(([p])=>p!=='/').map(([p])=>'  <url><loc>'+site+p+'</loc></url>').join('\n')+'\n</urlset>\n');
await writeFile('dist/client/robots.txt','User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /account\nDisallow: /contracts\nDisallow: /manager\nSitemap: '+site+'/sitemap.xml\n');
await writeFile('dist/client/.nojekyll','');
// 출시 준비: 보안 취약점 신고 창구(RFC 9116)
await mkdir('dist/client/.well-known',{recursive:true});await writeFile('dist/client/.well-known/security.txt','Contact: '+site+'/support?category=%EC%8B%A0%EA%B3%A0\nExpires: '+new Date(Date.now()+330*86400000).toISOString().slice(0,19)+'Z\nPreferred-Languages: ko, en\nPolicy: '+site+'/policy\nCanonical: '+site+'/.well-known/security.txt\n');
if(appDomain)await writeFile('dist/client/CNAME',appDomain.trim()+'\n');
await writeFile('dist/client/version.json',JSON.stringify({sha:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString()})+'\n'); // 작업 004: 배포 후 점검이 새 화면이 올라왔는지 확인

// 테스트가 불러 쓰는 서버 묶음
await mkdir('dist/server',{recursive:true});
await build({input:'app/worker.ts',output:{file:'dist/server/index.js',format:'esm',minify:false}});
await build({input:'lib/team-model.ts',output:{file:'dist/server/team-model.js',format:'esm',minify:false}});
await build({input:'lib/wage-ledger.ts',output:{file:'dist/server/wage-ledger.js',format:'esm',minify:false}});
await build({input:'lib/demo.ts',output:{file:'dist/server/demo.js',format:'esm',minify:false}});
await build({input:'lib/labor-guide.ts',output:{file:'dist/server/labor-guide.js',format:'esm',minify:false}});
await build({input:'lib/labor-estimate.ts',output:{file:'dist/server/labor-estimate.js',format:'esm',minify:false}});
await build({input:'lib/income-tax.ts',output:{file:'dist/server/income-tax.js',format:'esm',minify:false}});
await build({input:'lib/annual-leave.ts',output:{file:'dist/server/annual-leave.js',format:'esm',minify:false}});
await build({input:'lib/close-check.ts',output:{file:'dist/server/close-check.js',format:'esm',minify:false}});
await build({input:'lib/assistant.ts',output:{file:'dist/server/assistant.js',format:'esm',minify:false}});
await build({input:'lib/employer-insurance.ts',output:{file:'dist/server/employer-insurance.js',format:'esm',minify:false}});
await build({input:'lib/bulk-members.ts',output:{file:'dist/server/bulk-members.js',format:'esm',minify:false}});
await build({input:'lib/faq.ts',output:{file:'dist/server/faq.js',format:'esm',minify:false}});
await build({input:'lib/contract-template.ts',output:{file:'dist/server/contract-template.js',format:'esm',minify:false}});
await build({input:'lib/nts.ts',output:{file:'dist/server/nts.js',format:'esm',minify:false}});
await build({input:'lib/legal-docs.ts',output:{file:'dist/server/legal-docs.js',format:'esm',minify:false}});
await build({input:'app/cron-api.ts',output:{file:'dist/server/cron.js',format:'esm',minify:false}});
// Supabase Edge Function (Deno). postgres 드라이버는 Deno가 npm:에서 직접 받는다.
await build({input:'supabase/functions/api/entry.ts',external:[/^npm:/],output:{file:'supabase/functions/api/index.js',format:'esm',minify:false}});
console.log('척척사장 화면·서버 함수 빌드 완료');
