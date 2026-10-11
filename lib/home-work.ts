import type {Task,HomeAlert} from './close-check';
export type HomeWork=Task&{detail?:string};
export function homeWorkItems(tasks:Task[],alerts:HomeAlert[]):HomeWork[]{
 const unique=[...new Map(alerts.map(a=>[a.key,a])).values()],out=unique.filter(a=>a.key.startsWith('out-')).length;
 return [...unique.map(a=>({key:a.key,label:a.title,detail:a.detail,count:1,target:a.target})),...tasks.map(t=>t.key==='clockout'?{...t,count:Math.max(0,t.count-out)}:t).filter(t=>t.count>0)];
}
