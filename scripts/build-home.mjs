// 브랜드 홈페이지(site/) → chukchuksajang.co.kr. 앱(chukchukapp.kr)과 따로 배포한다.
// 번들러 없이 Node의 타입 지우기로 lib/ 파일을 그대로 브라우저 모듈로 만들고, 요금·계산식·사업자 정보는 lib/에서 읽어 HTML에 미리 채운다.
// 사용:
//   node scripts/build-home.mjs --site _site       홈페이지 배포 폴더(CNAME·robots·sitemap·404 포함). 홈페이지 저장소의 Actions가 이걸 부른다.
//   node scripts/build-home.mjs --preview <폴더>   Claude 미리보기용(문서 껍데기·보안 정책 meta 없이)
// 도메인은 deploy.config.json의 HOME_DOMAIN(홈페이지)·APP_DOMAIN(앱)에서 읽는다.
import {stripTypeScriptTypes} from 'node:module';
import {readFile, writeFile, mkdir, copyFile, readdir} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const MODULES = ['site/home.ts', 'site/render.ts', 'lib/plans.ts', 'lib/labor-estimate.ts', 'lib/pay-rules.ts', 'lib/operator.ts', 'app/meta-pixel.ts'];
const config = existsSync('deploy.config.json') ? JSON.parse(readFileSync('deploy.config.json', 'utf8')) : {};
const origin = d => 'https://' + String(d || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
export const HOME_ORIGIN = origin(process.env.HOME_DOMAIN || config.HOME_DOMAIN || 'chukchuksajang.co.kr');
export const APP_ORIGIN = origin(process.env.APP_DOMAIN || config.APP_DOMAIN || 'chukchukapp.kr');

export async function buildHome({out, site = HOME_ORIGIN, app = APP_ORIGIN, pixelId = '', preview = false} = {}) {
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
    for (const f of await readdir('site/' + sub)) if (/\.(woff2|webp|txt|gif|jpg|mp4)$/.test(f) && f !== 'charset.txt') await copyFile(`site/${sub}/${f}`, path.join(dir, sub, f));
  }
  // 3) HTML 채우기
  const R = await import(pathToFileURL(path.resolve(dir, 'site/render.js')).href + '?t=' + Date.now());
  const PR = await import(pathToFileURL(path.resolve(dir, 'lib/pay-rules.js')).href + '?t=' + Date.now());
  const base = preview ? '' : '/';
  const pay = R.crewTotal();
  const desc = `앱 설치 없이 휴대폰으로 쓰는 작은 가게 직원 관리. 근무표, 출퇴근, 급여 계산과 명세서, 전자근로계약서까지. 직원 1명당 월 ${R.money(R.employeeMonthlyPrice('basic', 1))}원부터, ${R.TRIAL_DAYS}일 무료, 카드 등록 없음.`;
  const fb = pixelId ? {script: ' https://connect.facebook.net', img: ' https://www.facebook.com', connect: ' https://www.facebook.com https://connect.facebook.net'} : {script: '', img: '', connect: ''};
  const csp = ["default-src 'self'", `script-src 'self'${fb.script}`, "style-src 'self'", `img-src 'self' data:${fb.img}`, "font-src 'self'", `connect-src 'self'${fb.connect}`, "object-src 'none'", "base-uri 'self'", `form-action 'self' ${app}`, 'upgrade-insecure-requests'].join('; ');
  const minWage = R.money(PR.ratesFor(2026).minimumWage);
  const vars = {
    CSP: `<meta http-equiv="Content-Security-Policy" content="${csp}">`, SITE: site, BASE: base, APP: app, DESCRIPTION: R.esc(desc), JSONLD: R.jsonLd(site),
    TRIAL: String(R.TRIAL_DAYS), LEDGER: R.ledgerHtml(false), FINALE_LEDGER: R.ledgerHtml(true), PHONE_ROWS: R.phoneRowsHtml(),
    PAY_TOTAL: R.money(pay), PAY_TOTAL_RAW: String(pay), CALC_TOY: R.money(R.crewPay()[0].month).slice(0, -1),
    WORRIES: R.worriesHtml(app), NOT_DOING: R.NOT_DOING.map(x => `<li>${R.esc(x)}</li>`).join(''), FOOTER: R.footerHtml(), PLAN_CARDS: R.planCardsHtml(app),
    PRICE_START: R.money(R.employeeMonthlyPrice('basic', 1)), CONTRACT_FEE: R.esc(R.contractFeeText()), MINWAGE: minWage, MINWAGE_TEXT: minWage,
  };
  let tpl = await readFile('site/index.html', 'utf8');
  tpl = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw Error('site/index.html: 채울 값이 없어요 ' + m); return vars[k]; });
  const cut = (name) => { const m = tpl.match(new RegExp(`<!--@${name}-->([\\s\\S]*?)<!--@/${name}-->`)); if (!m) throw Error('표시 없음: ' + name); return m[1]; };
  const css = tpl.match(/<link rel="stylesheet"[^>]*>/)[0];
  const html = preview
    ? cut('title') + '\n' + css + '\n' + cut('body').replace(/^\s*<body>|<\/body>\s*$/g, '')
    : '<!doctype html>\n<html lang="ko">\n' + cut('head').replace('</head>', css + '\n</head>') + cut('body') + '\n</html>\n';
  if (!preview && html.includes('noindex')) throw Error('홈페이지에 noindex가 있어요');
  await writeFile(path.join(out, 'index.html'), html);
  return {html, pay};
}

/** 홈페이지 배포 폴더 전체: index.html + 아이콘 + CNAME + robots + sitemap + 404(앱의 같은 주소로 넘김) */
export async function buildHomeSite(out = '_site') {
  const pixelId = String(process.env.META_PIXEL_ID || config.META_PIXEL_ID || '').trim();
  if (pixelId && !/^\d{15,16}$/.test(pixelId)) throw Error('META_PIXEL_ID는 15~16자리 숫자여야 해요: ' + pixelId);
  await mkdir(out, {recursive: true});
  const r = await buildHome({out, pixelId});
  for (const f of ['favicon.svg', 'icon-192.png', 'icon-512.png']) await copyFile('public/' + f, path.join(out, f));
  // 홈페이지에 없는 주소(/login, /pricing, /j/코드 …)는 앱의 같은 주소로 보낸다.
  await writeFile(path.join(out, 'home/go-app.js'), `location.replace(${JSON.stringify(APP_ORIGIN)}+location.pathname+location.search+location.hash);\n`);
  await writeFile(path.join(out, '404.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>척척사장</title><meta http-equiv="refresh" content="3;url=${APP_ORIGIN}/"><script src="/home/go-app.js"></script></head><body style="font-family:system-ui,sans-serif;padding:40px"><p>척척사장 앱으로 이동하고 있어요. <a href="${APP_ORIGIN}/">바로 가기</a></p></body></html>\n`);
  await writeFile(path.join(out, 'CNAME'), new URL(HOME_ORIGIN).host + '\n');
  await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${HOME_ORIGIN}/sitemap.xml\n`);
  await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${HOME_ORIGIN}/</loc></url>\n</urlset>\n`);
  await writeFile(path.join(out, '.nojekyll'), '');
  return r;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const preview = arg('--preview');
  const out = preview || arg('--site') || '_site';
  const r = preview ? await buildHome({out, preview: true}) : await buildHomeSite(out);
  console.log(`홈페이지(${HOME_ORIGIN}, 앱 ${APP_ORIGIN}) → ${out}/index.html ${Math.round(r.html.length / 1024)}KB · 예시 급여 합계 ${r.pay.toLocaleString('ko-KR')}원`);
}
