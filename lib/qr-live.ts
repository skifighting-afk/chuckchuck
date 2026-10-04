// 작업 044: 30초마다 바뀌는 출퇴근 QR. 토큰 = 'L.' + 시간창 + '.' + HMAC 앞 20자리.
// 직원이 QR을 찍은 뒤 기록하기까지 여유를 두어 현재·직전 시간창(최대 60초)을 받는다. 사진으로 찍어 두면 1분 뒤 쓸 수 없다.
export const QR_WINDOW_MS=30000;
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function mac(secret:string,win:number){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('qr:'+win))).slice(0,20)}
export async function liveToken(secret:string,now=Date.now()){const win=Math.floor(now/QR_WINDOW_MS);return {token:`L.${win}.${await mac(secret,win)}`,expiresIn:Math.ceil(((win+1)*QR_WINDOW_MS-now)/1000)}}
/** mode가 dynamic이면 움직이는 토큰만, 아니면 고정 토큰만 받는다 */
export async function qrTokenOk(secret:string|undefined,mode:string|undefined,token:unknown,now=Date.now()){
 if(!secret||typeof token!=='string'||token.length>200)return false;
 if(mode!=='dynamic')return token===secret;
 const m=token.match(/^L\.(\d+)\.([0-9a-f]{20})$/);if(!m)return false;
 const win=Number(m[1]),cur=Math.floor(now/QR_WINDOW_MS);if(win!==cur&&win!==cur-1)return false;
 return m[2]===await mac(secret,win);
}
