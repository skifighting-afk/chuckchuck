'use client';
// 겹치는 창(초기 설정·튜토리얼 메뉴)이 열려 있는 동안 뒤 화면을 막는다: 화면 낭독기·Tab·클릭이 뒤로 새지 않게(inert)
import {useEffect,type RefObject} from 'react';
export function useInertOthers(ref:RefObject<HTMLElement|null>,on:boolean){
 useEffect(()=>{if(!on)return;const me=ref.current;if(!me)return;const changed:HTMLElement[]=[];
  for(const el of Array.from(document.body.children) as HTMLElement[]){if(el.contains(me)||el.tagName==='SCRIPT'||el.hasAttribute('inert'))continue;el.setAttribute('inert','');changed.push(el)}
  return()=>{for(const el of changed)el.removeAttribute('inert')}},[on,ref]);
}
