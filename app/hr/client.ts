import type {HrClient} from '../../lib/hr/types';
export class HrApiError extends Error{constructor(message:string,public status:number,public fields:{path:string;message:string}[]=[]){super(message)}}
export function createHrClient():HrClient{
 const request=async<T>(path:string,body?:unknown):Promise<T>=>{const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d:any=await r.json();if(!r.ok)throw new HrApiError(d.error||'연결 상태를 확인하고 다시 시도해 주세요.',r.status,d.fields||[]);return d as T};
 return{get:path=>request(path),post:(path,body)=>request(path,body)};
}
