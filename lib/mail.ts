export type MailEnv={RESEND_API_KEY?:string,EMAIL_FROM?:string};
export const mailReady=(env:MailEnv)=>!!env.RESEND_API_KEY&&!!env.EMAIL_FROM;
export async function sendMail(env:MailEnv,input:{to:string,subject:string,text:string,key:string,attachments?:{filename:string,content:string}[]}){
 if(!mailReady(env))throw Error('이메일 발송 연결이 필요해요.');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':input.key},signal:AbortSignal.timeout(12000),body:JSON.stringify({from:env.EMAIL_FROM,to:[input.to],subject:input.subject,text:input.text,...(input.attachments?{attachments:input.attachments}:{})})});
 const data:any=await response.json().catch(()=>({}));
 if(!response.ok||typeof data.id!=='string')throw Error('이메일 발송 서비스가 요청을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
 return data.id as string;
}
export function utf8Base64(text:string){let binary='';for(const byte of new TextEncoder().encode(text))binary+=String.fromCharCode(byte);return btoa(binary)}
