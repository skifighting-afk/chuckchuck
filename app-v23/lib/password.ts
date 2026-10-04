import {pbkdf2Async} from './vendor/noble-hashes/pbkdf2.js';
import {sha256} from './vendor/noble-hashes/sha2.js';
const enc=new TextEncoder();
export const PASSWORD_ITERATIONS=600000;
export const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))))}
export async function passwordHash(password:string,salt:string){return hex(await pbkdf2Async(sha256,enc.encode(password),enc.encode(salt),{c:PASSWORD_ITERATIONS,dkLen:32}))}
export function equalHash(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function validPassword(v:unknown):v is string{return typeof v==='string'&&Array.from(v).length>=8&&v.length<=128&&v.trim().length>=8&&!/^(.)\1+$/u.test(v)&&!['12345678','123456789','1234567890','0123456789','87654321','password','password1','password123','qwertyui','qwerty123','qwerty1234','11112222','00000000','admin1234','abcd1234','abcdefgh'].includes(v.toLowerCase())}
