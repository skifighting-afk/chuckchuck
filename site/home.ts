import {} from './experience';
// 척척사장 홈페이지 동작. 글과 숫자는 HTML에 이미 다 있고(자바스크립트가 없어도 읽힌다), 여기서는 움직임과 계산만 붙인다.
import {money} from './render';
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
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

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

// 3. 히어로: 손글씨 장부 → 체크 → 휴대폰 급여 화면
const hero = $('#hero'), stage = $('#stage'), ledger = $('#ledger'), phone = $('#hero-phone');
const cells = $$<HTMLTableCellElement>('td[data-k]', ledger).sort((a, b) => +a.dataset.k! - +b.dataset.k!);
const notes = $$('.calc-toy');
const steps = $$('.steps li');
const totalEl = $('#pay-total'), total = Number(totalEl.dataset.won);
let mx = 0, my = 0, counted = -1;
const rolled = (to: number, t: number) => t >= 1 ? to : Math.round(to * ease(t) / 10) * 10;
function countTo(el: HTMLElement, to: number, t: number) { el.textContent = money(rolled(to, t)); }
function heroFrame() {
  if (reduce) return;
  const r = hero.getBoundingClientRect(), run = Math.max(1, r.height - innerHeight);
  const p = clamp(-r.top / run), mobile = innerWidth <= 900;
  // 칸 체크: 8%~52% 사이에 차례로
  const n = cells.length;
  cells.forEach((c, i) => c.classList.toggle('on', p > 0.08 + 0.44 * (i / n)));
  // 메모: 체크가 찍히고 떨어져 나간다
  notes.forEach((el, i) => { const t = 0.16 + i * 0.1; el.classList.toggle('done-note', p > t); el.classList.toggle('gone', p > t + 0.07); });
  ledger.classList.toggle('tidy', p > 0.5);
  // 장부: 비스듬히 → 똑바로 → 작아지며 물러남
  const flat = ease(span(p, 0.0, 0.55)), shrink = ease(span(p, 0.55, 0.8));
  const rx = lerp(24, 0, flat) + my * 4 * (1 - flat), rz = lerp(-5, 0, flat) + mx * 2 * (1 - flat);
  const s = lerp(1, mobile ? 0.86 : 0.72, shrink), tx = lerp(0, mobile ? 0 : -14, shrink);
  ledger.style.transform = `translateX(${tx}%) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s})`;
  ledger.style.opacity = String(lerp(1, mobile ? 0.12 : 0.35, shrink));
  // 휴대폰: 아래에서 올라온다
  const ph = ease(span(p, 0.58, 0.84)), fitS = Math.min(1, (stage.clientHeight - 8) / Math.max(1, phone.offsetHeight));
  phone.style.opacity = String(ph);
  phone.style.transform = (mobile ? `translate(50%, ${lerp(-30, -50, ph)}%)` : `translateY(${lerp(-30, -50, ph)}%)`) + ` scale(${lerp(.92, 1, ph) * fitS})`;
  phone.style.pointerEvents = ph > 0.5 ? 'auto' : 'none';
  const ct = span(p, 0.7, 0.92);
  if (ct !== counted) { counted = ct; countTo(totalEl, total, ct); $$('.amt', phone).forEach(a => { const w = Number(a.dataset.won); a.firstChild!.textContent = money(rolled(w, ct)); }); }
  // 단계 글
  const cur = p < 0.3 ? 0 : p < 0.6 ? 1 : 2;
  steps.forEach((s, i) => { s.classList.toggle('on', i < cur || (i === 2 && p > 0.9)); s.classList.toggle('cur', i === cur); });
}
if (!reduce) {
  let raf = 0;
  const tick = () => { raf = 0; heroFrame(); };
  const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', req, {passive: true}); addEventListener('resize', req);
  if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; req(); }, {passive: true});
  heroFrame();
}

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
