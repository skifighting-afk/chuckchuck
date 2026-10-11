import {} from './experience';
// 척척사장 홈페이지 동작. 글과 숫자는 HTML에 이미 다 있고(자바스크립트가 없어도 읽힌다), 여기서는 움직임과 계산만 붙인다.
import {} from './result-flow';
import {trackPageView} from '../app/meta-pixel';

// 0. 앱으로 가야 할 주소(/?invite=…, 로그인 메일의 되돌아오기 주소)는 앱 도메인으로 넘긴다. 광고 꼬리표(utm·fbclid)만 있으면 그대로 둔다.
{
  const q = new URLSearchParams(location.search), keys = [...q.keys()].filter(k => !/^(utm_|fbclid$|gclid$|ref$)/.test(k));
  const appUrl = (document.querySelector('.nav-login') as HTMLAnchorElement | null)?.href || '/app';
  if (location.pathname === '/' && (keys.length || /access_token|error_description|type=recovery/.test(location.hash))) location.replace(appUrl + location.search + location.hash);
}

// 찾을 범위(문서나 요소). DOM 타입이 서버용 타입과 섞여도 맞게 필요한 모양만 적는다.
type Root = {querySelector(s: string): Element | null; querySelectorAll(s: string): Iterable<Element>};
const $ = <T extends Element = HTMLElement>(s: string, r: Root = document) => r.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, r: Root = document) => [...r.querySelectorAll(s)] as T[];
const root = document.documentElement;
const store = {get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 화면은 그대로 */ } }};

// 1. 글씨 크게 · 움직임 줄이기 (앱과 같은 저장 이름)
const TEXT_KEY = 'chukchuk-large-text', MOTION_KEY = 'chukchuk-reduce-motion';
const osReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduce = osReduce || store.get(MOTION_KEY) === '1';
root.classList.toggle('large-text', store.get(TEXT_KEY) === '1');
root.classList.toggle('reduce', reduce);
if (!reduce) root.classList.add('anim');
const prefText = $('#pref-text'), prefMotion = $('#pref-motion');
prefText.setAttribute('aria-pressed', String(root.classList.contains('large-text')));
prefMotion.setAttribute('aria-pressed', String(reduce));
prefText.addEventListener('click', () => { const on = !root.classList.contains('large-text'); root.classList.toggle('large-text', on); prefText.setAttribute('aria-pressed', String(on)); store.set(TEXT_KEY, on ? '1' : '0'); });
prefMotion.addEventListener('click', () => { store.set(MOTION_KEY, reduce ? '0' : '1'); location.reload(); });

// 2. 메뉴 배경
const nav = $('#nav');
const onNav = () => nav.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', onNav, {passive: true}); onNav();

// 9. 실제 앱 시연: 누르면 크게 보기, 다시 누르거나 Esc로 닫기
$$<HTMLButtonElement>('.gif-zoom').forEach(b => b.addEventListener('click', () => {
  const box = b.closest('.gif-box') as HTMLElement, on = !box.classList.contains('big');
  $$('.gif-box.big').forEach(x => { x.classList.remove('big'); x.querySelector('.gif-zoom')!.textContent = '크게 보기'; });
  if (on) { box.classList.add('big'); b.textContent = '닫기'; }
}));
addEventListener('keydown', e => { if (e.key === 'Escape') $$('.gif-box.big').forEach(x => { x.classList.remove('big'); x.querySelector('.gif-zoom')!.textContent = '크게 보기'; }); });

// 11. 커서 이름표 (마우스일 때만)
const cur = $('#cursor');
if (matchMedia('(pointer: fine)').matches) {
  $$('[data-cursor]').forEach(el => {
    el.addEventListener('pointerenter', () => { cur.textContent = el.dataset.cursor!; cur.classList.add('show'); });
    el.addEventListener('pointerleave', () => cur.classList.remove('show'));
  });
  addEventListener('pointermove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, {passive: true});
}


trackPageView();
