'use client';
// 지시서 030: 근무표를 이미지 한 장으로 — 단톡방에 올리기(휴대폰은 공유 창, PC는 PNG 저장). 라이브러리 없이 canvas로 그린다.
import {useState} from 'react';
import {type Team,datePlus} from '../lib/team-model';
const W='일월화수목금토';
export function drawSchedule(s:Team,es:Team['employees'],week:string,title:string){
 const days=Array.from({length:7},(_,i)=>datePlus(week,i)),rows=es.filter(e=>e.status!=='퇴사'),nameW=150,colW=150,rowH=64,headH=110,c=document.createElement('canvas');
 const width=nameW+colW*7+40,height=headH+rowH*(rows.length+1)+50,scale=2;c.width=width*scale;c.height=height*scale;const g=c.getContext('2d')!;g.scale(scale,scale);
 g.fillStyle='#ffffff';g.fillRect(0,0,width,height);g.fillStyle='#10251b';g.font='bold 28px sans-serif';g.fillText(title,20,48);
 g.font='18px sans-serif';g.fillStyle='#5b6470';g.fillText(`${Number(days[0].slice(5,7))}/${Number(days[0].slice(8))} ~ ${Number(days[6].slice(5,7))}/${Number(days[6].slice(8))} 근무표`,20,80);
 const y0=headH;g.fillStyle='#17583f';g.fillRect(20,y0,width-40,rowH);g.fillStyle='#fff';g.font='bold 18px sans-serif';g.fillText('직원',32,y0+38);
 days.forEach((d,i)=>{g.fillText(`${Number(d.slice(8))}일(${W[new Date(d+'T00:00:00Z').getUTCDay()]})`,20+nameW+i*colW+12,y0+38)});
 rows.forEach((e,r)=>{const y=y0+rowH*(r+1);g.fillStyle=r%2?'#f4faf6':'#ffffff';g.fillRect(20,y,width-40,rowH);g.fillStyle='#10251b';g.font='bold 18px sans-serif';g.fillText(e.name.slice(0,8),32,y+38);
  days.forEach((d,i)=>{const sh=s.shifts.filter(x=>x.employeeId===e.id&&x.date===d);const leave=((s as any).approvedLeaves||[]).some((l:any)=>l.employeeId===e.id&&l.start<=d&&d<=l.end);g.font='17px sans-serif';g.fillStyle=leave?'#8a4b00':'#1f2a24';
   const text=leave?'휴가':sh.map(x=>`${x.start}-${x.end}`).join(' / ')||'—';const lines=text.length>11?[text.slice(0,11),text.slice(11,22)]:[text];lines.forEach((t,k)=>g.fillText(t,20+nameW+i*colW+12,y+(lines.length>1?28+k*22:38)))});
  g.strokeStyle='#d7e4dc';g.beginPath();g.moveTo(20,y+rowH);g.lineTo(width-20,y+rowH);g.stroke()});
 g.fillStyle='#5b6470';g.font='14px sans-serif';g.fillText('척척사장에서 만든 근무표 · 바뀌면 앱에서 확인해 주세요',20,height-18);
 return c;
}
export function ScheduleImage({s,es,week,title}:{s:Team,es:Team['employees'],week:string,title:string}){
 const [msg,setMsg]=useState('');
 const run=async()=>{setMsg('');const c=drawSchedule(s,es,week,title);const blob:Blob|null=await new Promise(r=>c.toBlob(b=>r(b),'image/png'));if(!blob){setMsg('이미지를 만들지 못했어요. 인쇄·PDF로 저장을 써 주세요.');return}
  const file=new File([blob],`근무표_${week}.png`,{type:'image/png'});
  try{if((navigator as any).canShare?.({files:[file]})){await (navigator as any).share({files:[file],title:'근무표'});return}}catch(e){if((e as Error).name==='AbortError')return}
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);setMsg('이미지를 저장했어요. 단톡방에 올려 주세요.')};
 return <><button type="button" className="secondary" onClick={run}>이미지로 공유</button>{msg&&<span role="status" className="footnote">{msg}</span>}</>;
}
