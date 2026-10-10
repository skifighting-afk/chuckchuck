// 척척사장 홈페이지 동작. 글과 숫자는 HTML에 이미 다 있고(자바스크립트가 없어도 읽힌다), 여기서는 움직임과 계산만 붙인다.
import {plans, employeeMonthlyPrice, money, TRIAL_DAYS, type PlanId} from './render';
import {estimateLabor} from '../lib/labor-estimate';
import {ratesFor} from '../lib/pay-rules';
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

// 5. 둘러보기 탭
const tabs = $$<HTMLButtonElement>('[role=tab]');
function selectTab(i: number, focus = false) {
  tabs.forEach((t, j) => { const on = i === j; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; ($('#' + t.getAttribute('aria-controls')) as HTMLElement).hidden = !on; });
  if (focus) tabs[i].focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i));
  t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); selectTab((i + d + tabs.length) % tabs.length, true); } if (e.key === 'Home') selectTab(0, true); if (e.key === 'End') selectTab(tabs.length - 1, true); });
});

// 6. 30초 QR (모양만 보여 주는 예시. 실제 출근 QR이 아니다)
const qc = $<HTMLCanvasElement>('#qr-canvas'), ring = $('#ring'), qLeft = $('#qr-left');
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function drawQr() {
  const ctx = qc.getContext('2d'); if (!ctx) return;
  const N = 29, s = qc.width / N;
  ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, qc.width, qc.height); ctx.fillStyle = '#0f3d2f';
  const finder = (x: number, y: number) => { ctx.fillRect(x * s, y * s, 7 * s, 7 * s); ctx.fillStyle = '#fffdf8'; ctx.fillRect((x + 1) * s, (y + 1) * s, 5 * s, 5 * s); ctx.fillStyle = '#0f3d2f'; ctx.fillRect((x + 2) * s, (y + 2) * s, 3 * s, 3 * s); };
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) ctx.fillRect(x * s, y * s, s, s);
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  // 가운데 ✓✓
  ctx.fillStyle = '#fffdf8'; ctx.fillRect(11 * s, 11 * s, 7 * s, 7 * s); ctx.fillStyle = '#12634b'; ctx.beginPath(); ctx.roundRect?.(11.5 * s, 11.5 * s, 6 * s, 6 * s, s); ctx.fill();
  ctx.strokeStyle = '#d4f77d'; ctx.lineWidth = s * 0.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  ctx.moveTo(12.6 * s, 14.6 * s); ctx.lineTo(13.8 * s, 15.8 * s); ctx.lineTo(16 * s, 13.2 * s); ctx.moveTo(15 * s, 15.3 * s); ctx.lineTo(15.6 * s, 15.8 * s); ctx.lineTo(16.9 * s, 14.2 * s); ctx.stroke();
}
let left = 30, qrTimer = 0;
function qrTick() { left -= 1; if (left <= 0) { left = 30; seed = (Date.now() % 100000) + 7; drawQr(); } qLeft.textContent = String(left); ring.style.strokeDashoffset = String(94.25 * (1 - left / 30)); }
seed = 42; drawQr();
new IntersectionObserver(([e]) => { if (e.isIntersecting && !qrTimer) qrTimer = setInterval(qrTick, 1000) as unknown as number; else if (!e.isIntersecting && qrTimer) { clearInterval(qrTimer); qrTimer = 0; } }).observe(qc);

// 7. 단톡방 ↔ 직원 화면 비교
const cmp = $('#compare'), cmpRange = $<HTMLInputElement>('#cmp-range');
const setSplit = () => cmp.style.setProperty('--split', cmpRange.value + '%');
cmpRange.addEventListener('input', setSplit); setSplit();

// 8. 인건비 계산 (lib/labor-estimate.ts 그대로). 설정: 사업장 규모, 공제 방식, 야간 근무
const wageIn = $<HTMLInputElement>('#c-wage'), hoursIn = $<HTMLInputElement>('#c-hours'), nightIn = $<HTMLInputElement>('#c-night');
const daysOut = $('#c-days'), peopleOut = $('#c-people');
let days = 5, people = 2, year = 2026, wageTouched = false;
const num = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;
const picked = (name: string) => ($<HTMLInputElement>(`input[name=${name}]:checked`)?.value ?? '');
function steppers(scope: Root, get: () => number, set: (v: number) => void, min: number, max: number) {
  $$<HTMLButtonElement>('button[data-step]', scope).forEach(b => b.addEventListener('click', () => { set(clamp(get() + Number(b.dataset.step), min, max)); }));
}
steppers(daysOut.parentElement!, () => days, v => { days = v; renderCalc(); }, 1, 7);
steppers(peopleOut.parentElement!, () => people, v => { people = v; renderCalc(); }, 1, 30);
$$<HTMLInputElement>('input[name=year]').forEach(r => r.addEventListener('change', () => { year = Number(r.value); if (!wageTouched) wageIn.value = money(ratesFor(year).minimumWage); renderCalc(); }));
$$<HTMLInputElement>('input[name=size], input[name=deduct]').forEach(r => r.addEventListener('change', renderCalc));
wageIn.addEventListener('input', () => { wageTouched = true; const v = num(wageIn.value); wageIn.value = v ? money(v) : ''; renderCalc(); });
hoursIn.addEventListener('input', renderCalc);
nightIn.addEventListener('input', renderCalc);
$('#rec-apply').addEventListener('click', () => {
  $<HTMLInputElement>('#sz-five').checked = true; $<HTMLInputElement>('#dd-ins').checked = true; renderCalc();
});
let lastShare = '';
function renderCalc() {
  const wage = num(wageIn.value), daily = clamp(Number(hoursIn.value) || 0, 0, 24), night = clamp(Number(nightIn.value) || 0, 0, 168);
  const five = picked('size') === 'five', ded = (picked('deduct') || 'none') as 'none' | '3.3' | 'insurance';
  daysOut.textContent = String(days); peopleOut.textContent = String(people);
  const r = estimateLabor({wage, dailyHours: daily, days, people, year, fivePlus: five, nightHours: night, deduction: ded});
  $('#c-min').textContent = `${year}년 최저임금 ${money(r.minimumWage)}원`;
  $('#r-total').textContent = money(r.total.gross);
  $('#r-month').textContent = money(r.month.gross) + '원';
  $('#r-juhu').textContent = r.juhuEligible ? `주 ${money(r.week.juhu)}원` : '주 15시간 미만이라 없음';
  $('#r-hours').textContent = `${r.month.hours}시간`;
  $('#r-ded').textContent = `${money(r.month.employeeDeduction)}원`;
  $('#r-net').textContent = `${money(r.month.net)}원`;
  $('#r-er').textContent = ded === 'insurance' ? `${money(r.month.employerInsurance)}원` : '해당 없음';
  const warn = $('#r-warn'), msgs: string[] = [];
  if (r.belowMinimum) msgs.push(`시급이 ${year}년 최저임금(${money(r.minimumWage)}원)보다 낮아요.`);
  if (five && r.week.overtime) msgs.push('하루 8시간·주 40시간을 넘는 연장 근무에 50% 가산을 넣었어요.');
  if (!five && (night || r.week.overtime)) msgs.push('연장·야간 가산은 5명 이상 사업장에만 적용돼요. 지금은 빼고 계산했어요.');
  if (r.pensionHealthExcluded) msgs.push('월 60시간 미만이라 국민연금·건강보험은 빼고 계산했어요.');
  warn.hidden = !msgs.length; warn.textContent = msgs.join(' ');
  const dedName = ded === 'insurance' ? '4대보험' : ded === '3.3' ? '3.3%' : '공제 없음';
  lastShare = `[우리 가게 한 달 인건비]\n시급 ${money(wage)}원 · 하루 ${daily}시간 · 주 ${days}일 · ${people}명 · ${five ? '5명 이상' : '5명 미만'} · ${dedName}\n한 사람 월급 ${money(r.month.gross)}원 (주휴수당 ${r.juhuEligible ? '주 ' + money(r.week.juhu) + '원' : '없음'})\n합계 약 ${money(r.total.gross)}원 (${year}년 기준, 예상치)\n계산: 척척사장 https://chukchukapp.kr/calculator`;
}
$('#calc-form').addEventListener('submit', e => e.preventDefault());
$('#share').addEventListener('click', async () => {
  const msg = $('#share-msg');
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({title: '우리 가게 한 달 인건비', text: lastShare}); msg.textContent = ''; return; }
    await navigator.clipboard.writeText(lastShare); msg.textContent = '복사했어요. 카톡에 붙여 넣으세요.';
  } catch {
    msg.textContent = '복사가 막혀 있어요. 화면을 캡처해서 보내 주세요.';
  }
});

// 9. 시연 GIF: 누르면 크게 보기, 다시 누르거나 Esc로 닫기
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

renderCalc();
trackPageView();
