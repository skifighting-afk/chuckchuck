// 홈페이지(site/) → chukchukapp.kr 첫 화면(index.html). 번들러 없이 Node의 타입 지우기로 lib/ 파일을 그대로 브라우저 모듈로 만든다.
// 요금·계산식·사업자 정보는 lib/에서 읽어 HTML에 미리 채운다(자바스크립트가 꺼져도 맞는 숫자가 보이게).
// 직접 실행: node scripts/build-home.mjs --preview <폴더>  (미리보기용: 앱 주소를 https://chukchukapp.kr로, 보안 정책 meta 없이)
import {stripTypeScriptTypes} from 'node:module';
import {readFile, writeFile, mkdir, copyFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const MODULES = ['site/home.ts', 'site/render.ts', 'lib/plans.ts', 'lib/labor-estimate.ts', 'lib/pay-rules.ts', 'lib/operator.ts', 'app/meta-pixel.ts'];

export async function buildHome({out = 'dist/client', site = 'https://chukchukapp.kr', pixelId = '', preview = false, supabaseOrigin = ''} = {}) {
  const dir = path.join(out, 'home');
  // 1) 모듈
  for (const file of MODULES) {
    let code = stripTypeScriptTypes(await readFile(file, 'utf8'), {mode: 'strip'});
    code = code.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (_, a, p, b) => a + (p.endsWith('.js') ? p : p + '.js') + b);
    if (file === 'app/meta-pixel.ts') code = code.replace(/__META_PIXEL_ID__/g, JSON.stringify(pixelId));
    const dest = path.join(dir, file.replace(/\.ts$/, '.js'));
    await mkdir(path.dirname(dest), {recursive: true});
    await writeFile(dest, code);
  }
  // 2) 파일
  await copyFile('site/home.css', path.join(dir, 'home.css'));
  for (const sub of ['fonts', 'img']) {
    await mkdir(path.join(dir, sub), {recursive: true});
    for (const f of await readdir('site/' + sub)) if (/\.(woff2|webp|txt)$/.test(f) && f !== 'charset.txt') await copyFile(`site/${sub}/${f}`, path.join(dir, sub, f));
  }
  // 3) HTML 채우기
  const R = await import(pathToFileURL(path.resolve(dir, 'site/render.js')).href + '?t=' + Date.now());
  const app = preview ? site : '';
  const base = preview ? '' : '/';
  const pay = R.crewTotal();
  const desc = `앱 설치 없이 휴대폰으로 쓰는 작은 가게 직원 관리. 근무표, 출퇴근, 급여 계산과 명세서, 전자근로계약서까지. 직원 수 제한 없이 월 ${R.money(R.monthlyPrice('basic', 1))}원부터, ${R.TRIAL_DAYS}일 무료, 카드 등록 없음.`;
  const fb = pixelId ? {script: ' https://connect.facebook.net', img: ' https://www.facebook.com', connect: ' https://www.facebook.com https://connect.facebook.net'} : {script: '', img: '', connect: ''};
  const csp = ["default-src 'self'", `script-src 'self'${fb.script}`, "style-src 'self'", `img-src 'self' data:${fb.img}`, "font-src 'self'", `connect-src 'self'${supabaseOrigin ? ' ' + supabaseOrigin : ''}${fb.connect}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'upgrade-insecure-requests'].join('; ');
  const vars = {
    CSP: `<meta http-equiv="Content-Security-Policy" content="${csp}">`, SITE: site, BASE: base, APP: app, DESCRIPTION: R.esc(desc), JSONLD: R.jsonLd(site),
    TRIAL: String(R.TRIAL_DAYS), LEDGER: R.ledgerHtml(false), FINALE_LEDGER: R.ledgerHtml(true), PHONE_ROWS: R.phoneRowsHtml(),
    PAY_TOTAL: R.money(pay), PAY_TOTAL_RAW: String(pay), CALC_TOY: R.money(R.crewPay()[0].month).slice(0, -1),
    WORRIES: R.worriesHtml(app), NOT_DOING: R.NOT_DOING.map(x => `<li>${R.esc(x)}</li>`).join(''), FOOTER: R.footerHtml(), PLAN_CARDS: R.planCardsHtml(app),
    PRICE_START: R.money(R.monthlyPrice('basic', 1)), CONTRACT_FREE: String(R.CONTRACTS_FREE_PER_MONTH), CONTRACT_EXTRA: R.money(R.CONTRACT_EXTRA_PRICE),
    MINWAGE: R.money(10320), MINWAGE_TEXT: R.money(10320),
  };
  // 최저임금은 계산기 기본 연도(2026)의 값을 lib/pay-rules.ts에서
  const PR = await import(pathToFileURL(path.resolve(dir, 'lib/pay-rules.js')).href);
  vars.MINWAGE = vars.MINWAGE_TEXT = R.money(PR.ratesFor(2026).minimumWage);
  let tpl = await readFile('site/index.html', 'utf8');
  tpl = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw Error('site/index.html: 채울 값이 없어요 ' + m); return vars[k]; });
  const cut = (name) => { const m = tpl.match(new RegExp(`<!--@${name}-->([\\s\\S]*?)<!--@/${name}-->`)); if (!m) throw Error('표시 없음: ' + name); return m[1]; };
  const css = tpl.match(/<link rel="stylesheet"[^>]*>/)[0];
  let html;
  if (preview) html = cut('title') + '\n' + css + '\n' + cut('body').replace(/^\s*<body>|<\/body>\s*$/g, '');
  else html = '<!doctype html>\n<html lang="ko">\n' + cut('head').replace('</head>', css + '\n</head>') + cut('body') + '\n</html>\n';
  if (!preview && html.includes('noindex')) throw Error('홈페이지에 noindex가 있어요');
  await writeFile(path.join(out, preview ? 'index.html' : 'index.html'), html);
  return {html, pay};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--preview');
  const out = i > 0 ? process.argv[i + 1] : 'dist/client';
  const r = await buildHome({out, preview: i > 0});
  console.log(`홈페이지 → ${out}/index.html (${Math.round(r.html.length / 1024)}KB, 예시 급여 합계 ${r.pay.toLocaleString('ko-KR')}원)`);
}
