import './api-client';
import React,{Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import Platform from './platform';
import {normalizeJoinCode} from '../lib/join-code';

// GitHub Pages는 서버 리디렉션이 없어서, 가게 합류 링크(/j/코드)는 화면에서 옮긴다.
if(location.pathname.startsWith('/j/')){
 const code=normalizeJoinCode(decodeURIComponent(location.pathname.slice(3)));
 location.replace(code?'/employee?code='+encodeURIComponent(code):'/employee');
}else createRoot(document.getElementById('root')!).render(<Suspense fallback={<div className="t-loading" role="status"><p>불러오는 중…</p></div>}><Platform/></Suspense>);
