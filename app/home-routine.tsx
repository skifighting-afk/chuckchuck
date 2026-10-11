import {useState} from 'react';
import type {Team} from '../lib/team-model';
import {DailyBoard} from './daily';
export function HomeRoutine({state,branch,demo}:{state:Team;branch:string;demo:boolean}){
 const [open,setOpen]=useState(()=>new URLSearchParams(location.search).get('daily')==='1');
 return <details className="home-routine" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>반복 업무·오늘의 일과 보기</summary><DailyBoard role="owner" state={state} branch={branch} demo={demo}/></details>;
}
