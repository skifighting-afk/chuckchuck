import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildHomeSite,HOME_ORIGIN,APP_ORIGIN} from './build-home.mjs';
const out=await mkdtemp(path.join(tmpdir(),'chukchuk-seo-'));
try{
 const {html}=await buildHomeSite(out);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert(html.includes(`rel="canonical" href="${HOME_ORIGIN}/"`));
 assert(!html.includes('noindex'));
 assert(html.includes('<title>척척사장 | 알바 근무표·출퇴근·급여 관리</title>'));
 assert(html.includes('name="twitter:card"'));
 assert(html.includes('property="og:image:alt"'));
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 const app=schemas.find(s=>s['@type']==='SoftwareApplication'),faq=schemas.find(s=>s['@type']==='FAQPage');
 assert.equal(app.url,HOME_ORIGIN);assert.equal(app['@id'],HOME_ORIGIN+'/#software');
 assert.deepEqual(app.offers.map(o=>o.price),[2900,3900]);
 assert.equal(app.installUrl,APP_ORIGIN+'/start');
 for(const q of faq.mainEntity){assert(html.includes(q.name));assert(html.includes(q.acceptedAnswer.text.replace(/"/g,'&quot;'))||html.includes(q.acceptedAnswer.text))}
 const robots=await readFile(path.join(out,'robots.txt'),'utf8'),sitemap=await readFile(path.join(out,'sitemap.xml'),'utf8');
 assert(robots.includes('Sitemap: '+HOME_ORIGIN+'/sitemap.xml'));assert(sitemap.includes('<loc>'+HOME_ORIGIN+'/</loc>'));
 for(const page of ['app.html','404.html','billing/success.html','billing/fail.html'])assert((await readFile('dist/client/'+page,'utf8')).includes('name="robots" content="noindex,nofollow"'),page);
 const pricing=await readFile('dist/client/pricing.html','utf8');assert(pricing.includes('rel="canonical" href="'+APP_ORIGIN+'/pricing"'));assert(!pricing.includes('noindex'));
 console.log('PASS: homepage search/social metadata, visible FAQ/prices, canonical domains and private app indexing boundary');
}finally{await rm(out,{recursive:true,force:true})}
