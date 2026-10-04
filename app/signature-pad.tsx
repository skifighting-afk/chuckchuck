'use client';
// 작업 039: 휴대폰 손서명(캔버스). 그린 서명을 PNG로 넘긴다.
import {useEffect,useRef,useState} from 'react';
export function SignaturePad({onChange,label='손서명'}:{onChange:(png:string)=>void,label?:string}){
 const ref=useRef<HTMLCanvasElement>(null),drawing=useRef(false),last=useRef<[number,number]|null>(null),[empty,setEmpty]=useState(true);
 useEffect(()=>{const c=ref.current!;const ctx=c.getContext('2d')!;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111'},[]);
 const pos=(e:React.PointerEvent<HTMLCanvasElement>):[number,number]=>{const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)*e.currentTarget.width/r.width,(e.clientY-r.top)*e.currentTarget.height/r.height]};
 const line=(a:[number,number],b:[number,number])=>{const ctx=ref.current!.getContext('2d')!;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0]+.01,b[1]+.01);ctx.stroke()};
 const end=()=>{if(!drawing.current)return;drawing.current=false;last.current=null;setEmpty(false);onChange(ref.current!.toDataURL('image/png'))};
 const clear=()=>{const c=ref.current!;c.getContext('2d')!.clearRect(0,0,c.width,c.height);setEmpty(true);onChange('')};
 return <div className="sig-pad"><span className="sig-label">{label} <small>(선택 · 손가락이나 마우스로)</small></span><canvas ref={ref} width={600} height={200} role="img" aria-label={label+' 입력 칸'} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;last.current=pos(e);line(last.current,last.current)}} onPointerMove={e=>{if(!drawing.current)return;const p=pos(e);line(last.current!,p);last.current=p}} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}/>{!empty&&<button type="button" className="saas-secondary" onClick={clear}>지우고 다시 그리기</button>}</div>
}
