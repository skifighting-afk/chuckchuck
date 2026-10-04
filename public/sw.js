// 작업 091: 홈 화면 앱용 서비스워커. 화면 파일만 '네트워크 먼저, 끊기면 마지막 저장본'으로 쓴다.
// 서버(API)·로그인·다른 주소 요청은 절대 저장하지 않는다(급여·개인정보가 기기에 남지 않게).
const CACHE='chukchuk-shell-v2',SHELL=['/','/app.js','/app.css','/favicon.svg','/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  const isPage=r.mode==='navigate';
  e.respondWith(fetch(r).then(res=>{if(res.ok&&(isPage||SHELL.includes(u.pathname))){const copy=res.clone();caches.open(CACHE).then(c=>c.put(isPage?'/':r,copy))}return res}).catch(()=>caches.match(isPage?'/':r).then(m=>m||new Response('오프라인이에요. 인터넷에 연결한 뒤 다시 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
});
// 작업 092: 웹 푸시 알림 보여 주기·누르면 앱 열기
self.addEventListener('push',e=>{let m={title:'척척사장봇',body:'새 소식이 있어요.',url:'/app'};try{m={...m,...e.data.json()}}catch{}e.waitUntil(self.registration.showNotification(m.title,{body:m.body,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:m.url},lang:'ko'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL(e.notification.data?.url||'/app',location.origin).href;e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list)if(c.url.startsWith(location.origin)&&'focus' in c){c.navigate(url);return c.focus()}return clients.openWindow(url)}))});
