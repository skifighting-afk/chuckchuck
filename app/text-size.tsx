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
// 개선 2차 B098·B173: 어둡게 보기(이 기기에만 저장). 기기가 이미 어두운 모드면 버튼을 숨긴다.
const DARK='chukchuk-dark';
const sysDark=()=>{try{return matchMedia('(prefers-color-scheme: dark)').matches}catch{return false}};
export function applyTheme(){try{document.documentElement.classList.toggle('force-dark',localStorage.getItem(DARK)==='1'&&!sysDark())}catch{}}
export function ThemeToggle(){
 const [on,setOn]=useState(false),[sys,setSys]=useState(false);
 useEffect(()=>{setSys(sysDark());try{setOn(localStorage.getItem(DARK)==='1')}catch{}},[]);
 if(sys)return null;
 const flip=()=>{const v=!on;setOn(v);try{localStorage.setItem(DARK,v?'1':'0')}catch{}document.documentElement.classList.toggle('force-dark',v)};
 return <button type="button" className="text-size-toggle" aria-pressed={on} onClick={flip} title="어둡게 보기">{on?'☾ 어둡게 ✓':'☾ 어둡게'}</button>
}
