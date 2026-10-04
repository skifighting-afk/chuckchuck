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
if(process.env.CI&&process.env.REQUIRE_SUPABASE_CONFIG&&(!pick('SUPABASE_URL')||!pick('SUPABASE_ANON_KEY')))throw Error('SUPABASE_URL과 SUPABASE_ANON_KEY(저장소 Variables)가 필요해요.');

await mkdir('dist/client',{recursive:true});
await copyFile('lib/vendor/noble-hashes/LICENSE','dist/client/noble-hashes-LICENSE.txt');
await copyFile('lib/vendor/jsQR.LICENSE','dist/client/jsQR-LICENSE.txt');
await build({input:'app/client.tsx',resolve:{alias:{'@':path.resolve('.')}},transform:{define:{'process.env.NODE_ENV':JSON.stringify('production'),__SUPABASE_URL__:JSON.stringify(supabaseUrl),__SUPABASE_ANON_KEY__:JSON.stringify(anonKey)},jsx:{runtime:'automatic'}},output:{file:'dist/client/app.js',format:'esm',minify:true}});
const css=await compile(await readFile('app/globals.css','utf8'),{base:path.resolve('app'),onDependency:()=>{}});
const scanner=new Scanner({sources:[{base:path.resolve('.'),pattern:'{app,components,hooks}/**/*.{ts,tsx}',negated:false}]});
await writeFile('dist/client/app.css',css.build(scanner.scan()));
for(const f of ['cheokcheoki-guide.png','favicon.svg','cheokcheoki-welcome.png'])await copyFile('public/'+f,'dist/client/'+f);
// 작업 074: GitHub Pages는 응답 헤더를 못 바꾸므로 보안 정책을 HTML meta로 넣는다.
// 화면은 자기 파일만 불러오고, 서버(Supabase)에만 연결한다. 카메라(QR) 영상과 QR·명세서 이미지(data:, blob:)는 허용.
const supabaseOrigin=new URL(supabaseUrl).origin;
const csp=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","media-src 'self' blob: mediastream:","font-src 'self' data:",`connect-src 'self' ${supabaseOrigin}`,"object-src 'none'","base-uri 'self'","form-action 'self'","worker-src 'self' blob:"].join('; ');
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="strict-origin-when-cross-origin"><title>척척사장봇 · 직원 관리</title><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#185b45"><meta name="description" content="입사부터 출퇴근, 급여와 계약까지. 함께 일하는 사람을 위한 매장 관리."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
await writeFile('dist/client/index.html',html);
await writeFile('dist/client/404.html',html); // GitHub Pages: 모든 주소를 화면 앱으로
await writeFile('dist/client/.nojekyll','');
if(appDomain)await writeFile('dist/client/CNAME',appDomain.trim()+'\n');

// 테스트가 불러 쓰는 서버 묶음
await mkdir('dist/server',{recursive:true});
await build({input:'app/worker.ts',output:{file:'dist/server/index.js',format:'esm',minify:false}});
await build({input:'lib/team-model.ts',output:{file:'dist/server/team-model.js',format:'esm',minify:false}});
await build({input:'lib/wage-ledger.ts',output:{file:'dist/server/wage-ledger.js',format:'esm',minify:false}});
await build({input:'lib/demo.ts',output:{file:'dist/server/demo.js',format:'esm',minify:false}});
// Supabase Edge Function (Deno). postgres 드라이버는 Deno가 npm:에서 직접 받는다.
await build({input:'supabase/functions/api/entry.ts',external:[/^npm:/],output:{file:'supabase/functions/api/index.js',format:'esm',minify:false}});
console.log('척척사장봇 화면·서버 함수 빌드 완료');
