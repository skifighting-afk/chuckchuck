import type {GuidePreferences} from './start-guide';
export type GuideDTO={scope:{key:string;branchId:string;role:string;kind:string;guideVersion:string};preferences:GuidePreferences;revision:number;availableQuestIds:string[]};
type Snapshot={data:GuideDTO|null;status:'loading'|'ready'|'saving'|'error'|'conflict'|'scope-changed';error:string};
type Send=(url:string,init?:RequestInit)=>Promise<{ok:boolean;status:number;json:()=>Promise<any>}>;
/** One instance per verified user/business/branch/role. No global live-account cache. */
export class GuideClient{
 private state:Snapshot={data:null,status:'loading',error:''};private listeners=new Set<()=>void>();private generation=0;private chain=Promise.resolve();private pending:any=null;private scopeKey:string|null=null;private seq=0;private conflictSeq=0;private retryTimer:any=null;
 private url:string;private send:Send;
 constructor(url:string,send:Send=(u,i)=>fetch(u,i)){this.url=url;this.send=send}
 getSnapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 private set(p:Partial<Snapshot>){this.state={...this.state,...p};this.listeners.forEach(fn=>fn())}
 dispose(){this.generation++;this.listeners.clear();clearTimeout(this.retryTimer)}
 private invalidate(){this.pending=null;this.set({data:null,status:'scope-changed',error:'계정이나 매장 권한이 바뀌었어요. 화면을 새로고침해 주세요.'})}
 private accepts(d:GuideDTO){if(this.scopeKey&&d.scope.key!==this.scopeKey){this.invalidate();return false}this.scopeKey=d.scope.key;return true}
 async load(){if(this.pending||this.state.status==='scope-changed')return;const generation=++this.generation;try{const r=await this.send(this.url),d=await r.json();if(generation!==this.generation)return;if(r.status===401||r.status===403||d.code==='GUIDE_SCOPE_CHANGED'){this.invalidate();return}if(!r.ok)throw Error(d.error);if(this.accepts(d))this.set({data:d,status:'ready',error:''})}catch(e){if(generation===this.generation)this.set({status:'error',error:e instanceof Error?e.message:'안내를 불러오지 못했어요.'})}}
 async refresh(){if(this.state.status==='ready')await this.load()}
 patch(patch:Partial<GuidePreferences>){const seq=++this.seq;this.chain=this.chain.then(async()=>{
  // 충돌 전에 줄 서 있던 저장은 버리고(다른 기기 변경 존중), 충돌을 본 뒤 새로 한 행동은 최신 상태 위에 저장한다
  if(this.pending||!this.state.data)return;if(this.state.status!=='ready'&&!(this.state.status==='conflict'&&seq>this.conflictSeq))return;this.pending={patch,revision:this.state.data.revision,scopeKey:this.state.data.scope.key,requestId:crypto.randomUUID()};await this.flush()});return this.chain}
 private async flush(){const body=this.pending;if(!body)return;const generation=++this.generation;this.set({status:'saving',error:''});try{const r=await this.send(this.url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(generation!==this.generation)return;if(r.status===401||r.status===403||d.code==='GUIDE_SCOPE_CHANGED'){this.invalidate();return}if(r.status===409){this.pending=null;this.conflictSeq=this.seq;if(d.latest&&!this.accepts(d.latest))return;this.set({data:d.latest||null,status:'conflict',error:d.error||'안내 상태가 바뀌었어요. 최신 상태를 확인해 주세요.'});return}if(!r.ok)throw Error(d.error);this.pending=null;if(this.accepts(d))this.set({data:d,status:'ready',error:''})}catch(e){if(generation===this.generation){this.set({status:'error',error:e instanceof Error?e.message:'안내를 저장하지 못했어요.'});
  // 잠깐 끊긴 경우를 위해 한 번 저절로 다시 보낸다(그동안 다른 저장이 막히지 않게)
  clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{if(this.state.status==='error'&&this.pending)void this.retry()},5000);this.retryTimer?.unref?.()}}}
 async retry(){if(this.pending)await this.flush();else await this.load()}
}
