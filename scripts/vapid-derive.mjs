// 작업 092: VAPID 키를 이미 있는 배포 비밀값에서 정해진 방법으로 만든다(사장님이 따로 키를 만들 필요 없게).
// DB 비밀번호를 바꾸면 키가 바뀌어 각 기기에서 알림을 다시 켜야 한다.
// GitHub Actions에서: 개인키는 로그에 가리고(add-mask) GITHUB_ENV로만 넘긴다.
import {createECDH,createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const seed=process.env.VAPID_SEED;if(!seed){console.log('VAPID 재료 없음: 웹 푸시 꺼짐');process.exit(0)}
const n=BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
let d=BigInt('0x'+createHash('sha256').update('chukchuk-vapid-v1:'+seed).digest('hex'))%(n-1n)+1n;
const priv=Buffer.from(d.toString(16).padStart(64,'0'),'hex'),ecdh=createECDH('prime256v1');ecdh.setPrivateKey(priv);
const b64u=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pub=b64u(ecdh.getPublicKey(null,'uncompressed')),pk=b64u(priv);
if(process.env.GITHUB_ENV){console.log('::add-mask::'+pk);appendFileSync(process.env.GITHUB_ENV,`VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${pk}\n`)}
console.log('VAPID 공개키: '+pub);
