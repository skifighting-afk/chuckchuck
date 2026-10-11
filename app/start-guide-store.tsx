'use client';
import {createContext,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {GuideClient,type GuideDTO} from '../lib/start-guide-client';
import {START_GUIDE_VERSION,defaultGuidePreferences,type GuidePreferences} from '../lib/start-guide';
const Context=createContext<GuideClient|null>(null);
const demos=new Map<string,GuideDTO>();
/** 체험 화면 '처음 상태로': 퀘스트·안내 기억도 처음으로 */
export const resetDemoGuides=()=>demos.clear();
export function StartGuideProvider({context,branch,role='owner',kind='personal',demo=false,children}:{context:string;branch:string;role?:string;kind?:string;demo?:boolean;children:ReactNode}){
 const key=JSON.stringify([context,branch,role,kind,demo,START_GUIDE_VERSION]);
 // key로 감싸면 매장을 바꿀 때 화면 전체가 다시 만들어져 입력 중인 내용이 사라진다 → 안내 저장소(client)만 범위마다 새로 만든다
 return <GuideScope context={context} scopeKey={key} branch={branch} kind={kind} role={role} demo={demo}>{children}</GuideScope>;
}
function GuideScope({context,scopeKey,branch,kind,role,demo,children}:{context:string;scopeKey:string;branch:string;kind:string;role:string;demo:boolean;children:ReactNode}){
 const client=useMemo(()=>new GuideClient('/api/start-guide?branchId='+encodeURIComponent(branch)+'&kind='+kind+'&context='+encodeURIComponent(context),demo?async(_url,init)=>{
  const old=demos.get(scopeKey)||{scope:{key:scopeKey,branchId:branch,role,kind,guideVersion:START_GUIDE_VERSION},revision:0,preferences:defaultGuidePreferences(),availableQuestIds:[]};
  const d=init?{...old,revision:old.revision+1,preferences:{...old.preferences,...JSON.parse(init.body as string).patch}}:old;demos.set(scopeKey,d);return {ok:true,status:200,json:async()=>d};
 }:undefined),[scopeKey]);
 useEffect(()=>{void client.load();const focus=()=>{void client.refresh()};addEventListener('focus',focus);return()=>{removeEventListener('focus',focus);client.dispose()}},[client]);
 return <Context.Provider value={client}>{children}<GuideStatus/></Context.Provider>;
}
const empty={data:null,status:'loading' as const,error:''};
export function useStartGuide(){const client=useContext(Context);const s=useSyncExternalStore(client?.subscribe||(()=>()=>{}),client?.getSnapshot||(()=>empty),()=>empty);return {...s,client,save:(p:Partial<GuidePreferences>)=>client?.patch(p)}}
export function GuideStatus(){const g=useStartGuide();if(!g.error)return null;return <aside className="start-guide-message" role="alert"><p>{g.error}{g.status!=='scope-changed'?' 업무 화면은 계속 이용할 수 있어요.':''}</p><button type="button" onClick={()=>g.status==='scope-changed'?location.reload():void g.client?.retry()}>{g.status==='scope-changed'?'현재 계정으로 새로고침':g.status==='conflict'?'최신 안내 확인':'안내 다시 시도'}</button></aside>}
