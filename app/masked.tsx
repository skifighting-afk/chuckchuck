'use client';
import {useState} from 'react';
import {maskPhone,maskEmail,maskAddress} from '../lib/mask';
export function Masked({value,kind,empty='등록 필요'}:{value:string,kind:'phone'|'email'|'address',empty?:string}){
 const [show,setShow]=useState(false);if(!value)return <>{empty}</>;
 const masked=kind==='phone'?maskPhone(value):kind==='email'?maskEmail(value):maskAddress(value);
 return <span className="masked">{show?value:masked} <button type="button" className="masked-toggle" aria-label={(show?'가리기':'보기')+' '+({phone:'연락처',email:'이메일',address:'주소'}[kind])} onClick={()=>setShow(!show)}>{show?'가리기':'보기'}</button></span>
}
