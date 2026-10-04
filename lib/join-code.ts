const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newJoinCode(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>alphabet[b&31]).join('')}
export function normalizeJoinCode(value:unknown){
 if(typeof value!=='string')return '';
 const text=value.trim();
 if(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(text))return text.toLowerCase();
 const compact=text.replace(/[\s-]/g,'').toUpperCase();
 return /^[A-HJ-NP-Z2-9]{8}$/.test(compact)?compact:'';
}
export function pastedJoinCode(value:string,origin:string){
 if(/^https?:\/\//i.test(value.trim())){
  try{const url=new URL(value.trim());if(url.origin!==origin)return '';return normalizeJoinCode(url.pathname.startsWith('/j/')?url.pathname.slice(3):url.pathname==='/employee'?url.searchParams.get('code'):'')}catch{return ''}
 }
 return normalizeJoinCode(value);
}
export function joinPath(code:string){return code.length===8?'/j/'+code:'/employee?code='+encodeURIComponent(code)}
export function displayJoinCode(code:string){return code.length===8?code.slice(0,4)+' '+code.slice(4):code}
