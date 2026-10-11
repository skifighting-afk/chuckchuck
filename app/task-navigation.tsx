import {type ComponentType} from 'react';
import {SidebarMenu,SidebarMenuItem,SidebarMenuButton,useSidebar} from '@/components/ui/sidebar';
import {taskGroups} from '../lib/task-navigation';
type Props={pages:readonly (readonly [string,ComponentType<any>])[];page:string;recent:string[];go:(page:string)=>void};
export function TaskNavigation({pages,page,recent,go}:Props){
 const {setOpenMobile}=useSidebar(),allowed=pages.map(([p])=>p);
 const pick=(p:string)=>{go(p);setOpenMobile(false)};
 return <nav className="task-navigation" aria-label="업무별 메뉴">{recent.length>0&&<section className="task-nav-recent" aria-label="최근 사용"><h2>최근 사용</h2><div>{recent.map(p=><button type="button" key={p} aria-label={'최근 사용 · '+p} onClick={()=>pick(p)}>{p}</button>)}</div></section>}{taskGroups(allowed).map(group=><section key={group.label} aria-label={group.label}><h2>{group.label}</h2><SidebarMenu>{group.pages.map(p=>{const Icon=pages.find(([name])=>name===p)![1];return <SidebarMenuItem key={p}><SidebarMenuButton isActive={page===p} aria-current={page===p?'page':undefined} onClick={()=>pick(p)}><Icon size={19} aria-hidden="true"/><span>{p}</span></SidebarMenuButton></SidebarMenuItem>})}</SidebarMenu></section>)}</nav>;
}
