// 작업 085: 서버가 돌려주는 오류 문구는 "다음에 무엇을 하면 되는지"를 담아야 한다.
import {readFileSync,readdirSync} from 'node:fs';
const dir=new URL('../app/',import.meta.url).pathname;
const next=/(주세요|하세요|해 줘|요청해|돼요|되요|있어요|부터|로그인|새로고침|다시|확인|골라|입력|눌러|바꾸|올려|받아|들어가|열어|이용해|안내해|문의|기다려|쓸 수|할 수 있|볼 수 있|받을 수|내려받|취소하)/;
const bad=[];let count=0;
for(const f of readdirSync(dir).filter(f=>/\.ts$/.test(f))){
 const text=readFileSync(dir+f,'utf8');
 for(const m of text.matchAll(/error:\s*'((?:[^'\\]|\\.)*)'/g)){count++;if(!next.test(m[1]))bad.push(`${f}: ${m[1]}`)}
}
if(bad.length){console.error('다음 행동이 없는 오류 문구:\n'+bad.join('\n'));process.exitCode=1}
else console.log(`PASS: 오류 문구 ${count}개 모두 다음 행동 안내 포함.`);

// 작업 007: 오류 번호와 개인정보 없는 로그
{
 const assert=(await import('node:assert/strict')).default;
 const {newErrorId,scrub,serverError}=await import('../lib/errors.ts');
 const {api}=await import('../dist/server/index.js');
 assert.match(newErrorId(),/^E-[A-Z2-9]{6}$/);
 const dirty='duplicate key value violates unique constraint "app_users_email_key" Key (email)=(kim@example.kr) user native:3f2a9c1e-1111-4222-8333-444455556666 phone 01012345678';
 const clean=scrub(dirty);
 assert.ok(!/kim@|example\.kr|01012345678|3f2a9c1e/.test(clean),'scrub removes personal data: '+clean);
 assert.ok(clean.includes('duplicate key value'),'scrub keeps the error kind');
 const logs=[];const orig=console.error;console.error=(...a)=>logs.push(a.join(' '));
 try{
  const r=serverError('test',new Error(dirty));const body=await r.json();
  assert.equal(r.status,500);assert.match(body.error,/오류 번호 E-[A-Z2-9]{6}/);assert.ok(logs.at(-1).includes(body.errorId));
  // DB가 고장 나도 사용자는 오류 번호를 받고, 로그에는 이메일이 남지 않는다.
  const brokenDB={prepare(){throw Object.assign(new Error('connection to server failed for kim@example.kr'),{name:'PostgresError'})},batch(){throw new Error('x')}};
  const res=await api(new Request('https://qa.local/api/auth',{method:'POST',headers:{origin:'https://qa.local','content-type':'application/json'},body:JSON.stringify({action:'login',email:'kim@example.kr',password:'x'})}),{DB:brokenDB,SUPABASE_URL:'https://auth.test.invalid',SUPABASE_ANON_KEY:'a'});
  const out=await res.json();
  assert.equal(res.status,500);assert.match(out.error,/오류 번호/);
  assert.ok(logs.some(l=>l.includes(out.errorId)),'route error logged with its number');
  assert.ok(!logs.join('\n').includes('kim@example.kr'),'logs carry no email');
 }finally{console.error=orig}
 console.log('PASS: 오류 번호·로그 개인정보 제거.');
}
