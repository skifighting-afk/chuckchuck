'use client';
import {useState} from 'react';
import {maskPhone,maskEmail,maskAddress} from '../lib/mask';
// 지시서 100: employeeId를 주면 '보기'를 누를 때 열람 기록을 남긴다(체험 화면 제외)
export function Masked({value,kind,empty='등록 필요',employeeId}:{value:string,kind:'phone'|'email'|'address',empty?:string,employeeId?:string}){
 const [show,setShow]=useState(false);if(!value)return <>{empty}</>;
 const masked=kind==='phone'?maskPhone(value):kind==='email'?maskEmail(value):maskAddress(value);
 return <span className="masked">{show?value:masked} <button type="button" className="masked-toggle" aria-label={(show?'가리기':'보기')+' '+({phone:'연락처',email:'이메일',address:'주소'}[kind])} onClick={()=>{if(!show&&employeeId&&!location.pathname.startsWith('/demo'))void fetch('/api/pii-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employeeId,kind})}).catch(()=>{});setShow(!show)}}>{show?'가리기':'보기'}</button></span>
}
