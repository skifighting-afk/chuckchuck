export const START_GUIDE_VERSION='2026-10-11-v2';
export type GuideRole='owner'|'manager'|'employee';
export type GuideKind='personal'|'management';
export type GuidePreferences={mini:boolean;hideAll:boolean;deferredUntil:string|null;active:{questId:string;step:number}|null;acknowledged:string[]};
export type GuideIdentity={userId:string;owner:string;branchId:string;role:GuideRole;kind:GuideKind;guideVersion:string};
export const defaultGuidePreferences=():GuidePreferences=>({mini:false,hideAll:false,deferredUntil:null,active:null,acknowledged:[]});
// Unambiguous canonical input; API returns only its SHA-256 digest, never account IDs.
export const guideScopeKey=(s:GuideIdentity)=>JSON.stringify([s.userId,s.owner,s.branchId,s.role,s.kind,s.guideVersion]);
export function validateGuidePatch(input:unknown,allowedQuestIds:readonly string[],now=Date.now()):Partial<GuidePreferences>{
 const fail=():never=>{throw Error('안내 설정을 확인해 주세요.')};
 if(!input||typeof input!=='object'||Array.isArray(input))return fail();
 const b=input as Record<string,unknown>,out:Partial<GuidePreferences>={};
 if(Object.keys(b).some(k=>!['mini','hideAll','deferredUntil','active','acknowledged'].includes(k)))return fail();
 for(const k of ['mini','hideAll'] as const)if(k in b){if(typeof b[k]!=='boolean')return fail();out[k]=b[k] as boolean}
 if('deferredUntil' in b){const t=b.deferredUntil;if(t!==null&&(typeof t!=='string'||!Number.isFinite(Date.parse(t))||Date.parse(t)>now+30*86400000))return fail();out.deferredUntil=t===null?null:new Date(t as string).toISOString()}
 if('active' in b){const a=b.active as any;if(a!==null&&(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['questId','step'].includes(k))||!allowedQuestIds.includes(a.questId)||!Number.isInteger(a.step)||a.step<0||a.step>100))return fail();out.active=a===null?null:{questId:a.questId,step:a.step}}
 if('acknowledged' in b){const a=b.acknowledged;if(!Array.isArray(a)||a.length>100||a.some(x=>typeof x!=='string'||!allowedQuestIds.includes(x)))return fail();out.acknowledged=[...new Set(a)] as string[]}
 return out;
}
