// 작업 092: 웹 푸시(외부 라이브러리 없이 WebCrypto로). RFC 8291(aes128gcm 암호화) + RFC 8292(VAPID).
// 서버 비밀값: VAPID_PUBLIC_KEY(공개키, base64url 65바이트), VAPID_PRIVATE_KEY(개인키 d, base64url 32바이트), VAPID_SUBJECT(mailto:…)
const enc=new TextEncoder();
export const b64u={
 enc:(b:Uint8Array)=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},
 dec:(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0)),
};
const cat=(...parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length}return out};
async function hmac(key:Uint8Array,data:Uint8Array){const k=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data as BufferSource))}
const pubJwk=(pub:Uint8Array)=>({kty:'EC',crv:'P-256',x:b64u.enc(pub.slice(1,33)),y:b64u.enc(pub.slice(33,65))});
export async function importPrivate(d:string,pub:string,usage:'ecdh'|'sign'){
 const jwk={...pubJwk(b64u.dec(pub)),d,ext:true};
 return crypto.subtle.importKey('jwk',jwk,usage==='ecdh'?{name:'ECDH',namedCurve:'P-256'}:{name:'ECDSA',namedCurve:'P-256'},false,usage==='ecdh'?['deriveBits']:['sign']);
}
/** RFC 8291 메시지 암호화. 테스트에서는 보내는 쪽 임시 키와 salt를 넣어 표준 예시와 맞춰 본다. */
export async function encryptPayload(plaintext:Uint8Array,uaPublic:Uint8Array,authSecret:Uint8Array,fixed?:{asPrivate:string,asPublic:string,salt:Uint8Array}){
 let asPriv:CryptoKey,asPub:Uint8Array;
 if(fixed){asPriv=await importPrivate(fixed.asPrivate,fixed.asPublic,'ecdh');asPub=b64u.dec(fixed.asPublic)}
 else{const kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']) as CryptoKeyPair;asPriv=kp.privateKey;asPub=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey))}
 const salt=fixed?.salt||crypto.getRandomValues(new Uint8Array(16));
 const uaKey=await crypto.subtle.importKey('raw',uaPublic as BufferSource,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},asPriv,256));
 const prkKey=await hmac(authSecret,ecdh);
 const ikm=await hmac(prkKey,cat(enc.encode('WebPush: info\0'),uaPublic,asPub,new Uint8Array([1])));
 const prk=await hmac(salt,ikm);
 const cek=(await hmac(prk,cat(enc.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16);
 const nonce=(await hmac(prk,cat(enc.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const key=await crypto.subtle.importKey('raw',cek as BufferSource,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce as BufferSource},key,cat(plaintext,new Uint8Array([2])) as BufferSource));
 const rs=new Uint8Array([0,0,16,0]);// 4096
 return cat(salt,rs,new Uint8Array([asPub.length]),asPub,cipher);
}
/** RFC 8292 VAPID 인증 머리말 */
export async function vapidHeader(endpoint:string,env:{VAPID_PUBLIC_KEY:string,VAPID_PRIVATE_KEY:string,VAPID_SUBJECT?:string},now=Date.now()){
 const aud=new URL(endpoint).origin,header=b64u.enc(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),claims=b64u.enc(enc.encode(JSON.stringify({aud,exp:Math.floor(now/1000)+12*3600,sub:env.VAPID_SUBJECT||'mailto:help@chukchukapp.kr'})));
 const key=await importPrivate(env.VAPID_PRIVATE_KEY,env.VAPID_PUBLIC_KEY,'sign');
 const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(header+'.'+claims)));
 return `vapid t=${header}.${claims}.${b64u.enc(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}
export type PushEnv={VAPID_PUBLIC_KEY?:string,VAPID_PRIVATE_KEY?:string,VAPID_SUBJECT?:string};
export type Subscription={endpoint:string,p256dh:string,auth:string};
/** 알림 한 건 보내기. 키가 없으면 보내지 않는다. 410/404면 구독이 끝난 것. */
export async function sendPush(env:PushEnv,sub:Subscription,message:{title:string,body:string,url:string},fetcher:typeof fetch=fetch){
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return {status:'not_configured' as const};
 const body=await encryptPayload(enc.encode(JSON.stringify(message)),b64u.dec(sub.p256dh),b64u.dec(sub.auth));
 const r=await fetcher(sub.endpoint,{method:'POST',headers:{Authorization:await vapidHeader(sub.endpoint,env as any),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal'},body:body as BodyInit});
 return {status:r.status===201||r.ok?'sent' as const:r.status===404||r.status===410?'gone' as const:'failed' as const,code:r.status};
}
