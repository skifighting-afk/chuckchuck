'use client';
// 작업 084: 글씨 크게 보기(이 기기에만 저장)
import {useEffect,useState} from 'react';
const KEY='chukchuk-large-text';
export function applyTextSize(){try{document.documentElement.classList.toggle('large-text',localStorage.getItem(KEY)==='1')}catch{}}
export function TextSizeToggle(){
 const [on,setOn]=useState(false);
 useEffect(()=>{try{setOn(localStorage.getItem(KEY)==='1')}catch{}},[]);
 const flip=()=>{const v=!on;setOn(v);try{localStorage.setItem(KEY,v?'1':'0')}catch{}document.documentElement.classList.toggle('large-text',v)};
 return <button type="button" className="text-size-toggle" aria-pressed={on} onClick={flip} title="글씨 크게 보기">{on?'가 크게 ✓':'가 크게'}</button>
}
