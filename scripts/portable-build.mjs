import {build} from 'rolldown';
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';
import {readFile,writeFile,mkdir,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist/client',{recursive:true});
await copyFile('lib/vendor/noble-hashes/LICENSE','dist/client/noble-hashes-LICENSE.txt');
await copyFile('lib/vendor/jsQR.LICENSE','dist/client/jsQR-LICENSE.txt');
await build({input:'app/client.tsx',resolve:{alias:{'@':path.resolve('.')}},transform:{define:{'process.env.NODE_ENV':JSON.stringify('production')},jsx:{runtime:'automatic'}},output:{file:'dist/client/app.js',format:'esm',minify:true}});
const css=await compile(await readFile('app/globals.css','utf8'),{base:path.resolve('app'),onDependency:()=>{}});
const scanner=new Scanner({sources:[{base:path.resolve('.'),pattern:'{app,components,hooks}/**/*.{ts,tsx}',negated:false}]});
await writeFile('dist/client/app.css',css.build(scanner.scan()));
await copyFile('public/cheokcheoki-guide.png','dist/client/cheokcheoki-guide.png');
await copyFile('public/favicon.svg','dist/client/favicon.svg');
await copyFile('public/cheokcheoki-welcome.png','dist/client/cheokcheoki-welcome.png');
await writeFile('dist/client/index.html','<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>척척사장봇 · 직원 관리</title><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#185b45"><meta name="description" content="입사부터 출퇴근, 급여와 계약까지. 함께 일하는 사람을 위한 매장 관리."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
await mkdir('dist/server',{recursive:true});
await build({input:'app/worker.ts',output:{file:'dist/server/index.js',format:'esm',minify:true}});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'onjang',main:'index.js',compatibility_date:'2026-05-15',assets:{directory:'../client',binding:'ASSETS',not_found_handling:'single-page-application'},d1_databases:[{binding:'DB',database_name:'onjang',database_id:'00000000-0000-0000-0000-000000000000'}]}));
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Onjang browser and Worker build complete');


