// 홈페이지(site/)에서 화면과 빌드가 같이 쓰는 내용. 숫자는 lib/에서만 가져온다(요금·계산식·사업자 정보를 따로 적지 않는다).
import {plans,employeeMonthlyPrice,money,TRIAL_DAYS,CONTRACTS_FREE_PER_MONTH,CONTRACT_EXTRA_PRICE,contractFeeText,type PlanId} from '../lib/plans';
import {estimateLabor} from '../lib/labor-estimate';
import {operatorLines} from '../lib/operator';

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'} as Record<string, string>)[c]);
export {plans, employeeMonthlyPrice, money, TRIAL_DAYS, CONTRACTS_FREE_PER_MONTH, CONTRACT_EXTRA_PRICE, contractFeeText};
export type {PlanId};

/** 요금제 카드 기능 목록 — app/public-pages.tsx PLAN_FEATURES와 같은 내용 */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  basic: ['직원 수 제한 없음', '근무표 · 대타·교대 요청', '앱 버튼 출퇴근 · 정정 승인', '급여 자동 계산 · 명세서 · 임금대장', `전자근로계약서 ${contractFeeText()}`, '휴가 · 공지 · 매장 매뉴얼', '인건비 리포트'],
  pro: ['베이직 기능 전부', '매장 QR을 찍어야 출퇴근 기록', '30초마다 바뀌는 QR(대리 출근 막기)'],
};

// ── 예시 가게(히어로 장부·결말 장부). 2026년 9월 14일(월)~27일(일) 두 주. 모두 지어낸 예시다. ──
const DEMO_YEAR = 2026;
type Crew = {name: string; role: string; wage: number; days: number[]; neat: string; hand: string; hours: number; odd?: Record<number, {hand: string; note: string}>};
export const CREW: Crew[] = [
  {name: '민지', role: '홀', wage: 10320, days: [0, 1, 2, 3, 4], neat: '10:00–16:30', hand: '10-4반', hours: 6},
  {name: '준호', role: '주방', wage: 11000, days: [1, 2, 3, 4, 5], neat: '09:00–18:00', hand: '9-6', hours: 8, odd: {2: {hand: '9-6 (안 찍음?)', note: '정정 승인'}}},
  {name: '서연', role: '홀', wage: 10320, days: [4, 5, 6], neat: '17:00–22:30', hand: '5-10반', hours: 5, odd: {5: {hand: '대타? 민지', note: '교대 승인'}}},
  {name: '도윤', role: '주말', wage: 10500, days: [5, 6], neat: '12:00–15:30', hand: '12-3반', hours: 3.5},
];
export const DAYS = Array.from({length: 14}, (_, i) => ({date: 14 + i, dow: '월화수목금토일'[i % 7]}));

export function crewPay() {
  return CREW.map(c => {
    const r = estimateLabor({wage: c.wage, dailyHours: c.hours, days: c.days.length, year: DEMO_YEAR});
    return {...c, weekly: r.weeklyHours, juhu: r.juhuEligible, month: r.month.gross};
  });
}
export const crewTotal = () => crewPay().reduce((n, c) => n + c.month, 0);

const STAMP = '<svg class="stamp" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12l6 6L21 5"/><path d="M17 15l4 3L37 4"/></svg>';
export function ledgerHtml(done = false) {
  let k = 0;
  const head = DAYS.map(d => `<th scope="col"><b>${d.date}</b><small>${d.dow}</small></th>`).join('');
  const rows = CREW.map(c => {
    const cells = DAYS.map((d, i) => {
      const dow = i % 7;
      if (!c.days.includes(dow)) return '<td class="off" aria-label="쉬는 날">·</td>';
      const odd = c.odd && i < 7 ? c.odd[dow] : undefined;
      const [s, e] = c.neat.split('–');
      return `<td data-k="${k++}" class="${odd ? 'odd' : ''}${done ? ' on' : ''}"><span class="hand">${esc(odd ? odd.hand : c.hand)}</span><span class="neat">${s}<br>${e}${odd ? `<em>${odd.note}</em>` : ''}</span>${STAMP}</td>`;
    }).join('');
    return `<tr><th scope="row"><b>${c.name}</b><small>${c.role}</small></th>${cells}</tr>`;
  }).join('');
  return `<table class="ledger-table"><caption class="sr">예시 가게 9월 14일부터 27일까지 출근 기록</caption><thead><tr><th scope="col"><span class="hand">이름</span></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
export function ledgerCellCount() { return CREW.reduce((n, c) => n + c.days.length * 2, 0); }

export function phoneRowsHtml() {
  return crewPay().map(c => `<li><span class="who"><b>${c.name}</b><small>주 ${c.weekly}시간 · ${c.juhu ? '주휴수당 포함' : '주 15시간 미만, 주휴 없음'}</small></span><span class="amt" data-won="${c.month}">${money(c.month)}<small>원</small></span></li>`).join('');
}

// ── 걱정 다섯 가지(화면 + 검색용 FAQ 구조화 데이터) ──
export const WORRIES: {tag: string; q: string; a: string; link?: [string, string]}[] = [
  {tag: '돈', q: '써 보다가 돈이 나가는 거 아니에요?', a: `${TRIAL_DAYS}일 무료이고 카드를 등록하지 않아요. 체험이 끝나도 저절로 결제되지 않고, 사장님이 요금제를 고를 때만 유료로 바뀌어요. 이용 중에 해지하면 남은 날만큼 나눠서 돌려드려요.`, link: ['/refund', '해지·환불 규정']},
  {tag: '시간', q: '직원들한테 앱 깔라고 하기 번거로운데요.', a: '아무도 앱을 깔지 않아요. 휴대폰 인터넷 창으로 열고, 직원은 사장님이 보낸 가입 링크나 가게 코드로 합류 신청을 해요. 사장님이 수락해야 가게 정보가 보여요.'},
  {tag: '위험', q: '직원이 출근 시간을 마음대로 고치면요?', a: '직원은 고쳐 달라고 요청만 할 수 있고, 사장님이 승인해야 기록이 바뀌어요. 가게 데이터는 언제든 파일로 전부 내려받을 수 있어요.'},
  {tag: '복잡함', q: '저는 컴퓨터를 잘 못해요.', a: '가입 없이 예시 가게로 모든 화면을 먼저 눌러 볼 수 있어요. 눌러 본 내용은 저장되지 않아요. 글씨가 작으면 화면 아래 "글씨 크게"를 눌러 주세요.', link: ['/demo', '예시 가게 열기']},
  {tag: '후회', q: '안 맞으면 그동안 기록은 어떻게 돼요?', a: '체험이 끝나도 쌓인 기록은 그대로 볼 수 있고 내려받을 수 있어요. 탈퇴하면 30일 뒤에 지워지고, 그 전에는 취소할 수 있어요.'},
];
export const NOT_DOING = ['급여 이체(송금)', '세금 신고', 'GPS 위치 확인', '매출·재고 관리'];

export function worriesHtml(app: string) {
  return WORRIES.map((w, i) => `<details class="worry"${i === 0 ? ' open' : ''}><summary><span class="tag">${w.tag}</span><span class="q">${esc(w.q)}</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><p>${esc(w.a)}${w.link ? ` <a href="${app}${w.link[0]}">${w.link[1]}</a>` : ''}</p></details>`).join('');
}

export function footerHtml() {
  return operatorLines().map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
}

export function planCardsHtml(app: string) {
  return (['basic', 'pro'] as PlanId[]).map(id => {
    const p = plans[id];
    return `<article class="plan${id === 'pro' ? ' pro' : ''}"><div class="plan-head"><b>${p.name}</b>${id === 'pro' ? '<span class="flag">매장 QR 출퇴근</span>' : ''}</div><p class="plan-purpose">${id === 'basic' ? '근무표부터 급여·서류까지 한곳에서' : '직원이 매장에서 직접 찍는 출퇴근까지'}</p><p class="plan-from"><span>직원 1명당 월</span><b>${money(employeeMonthlyPrice(id, 1))}<small>원</small></b><span>부가세 포함</span></p><ul>${PLAN_FEATURES[id].map(f => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn plan-start" href="${esc(app)}/signup?role=owner&amp;plan=${id}">${p.name} ${TRIAL_DAYS}일 무료로 시작</a></article>`;
  }).join('');
}

export function jsonLd(site: string) {
  const app = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: '척척사장', url: site, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    description: '작은 가게 사장님을 위한 직원 근무표·출퇴근·급여 계산·임금명세서·전자근로계약서 관리. 앱 설치 없이 휴대폰으로.',
    offers: (['basic', 'pro'] as PlanId[]).map(id => ({'@type': 'Offer', name: plans[id].name + ' (직원 1명당, 월)', price: employeeMonthlyPrice(id, 1), priceCurrency: 'KRW'})),
  };
  const faq = {'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: WORRIES.map(w => ({'@type': 'Question', name: w.q, acceptedAnswer: {'@type': 'Answer', text: w.a}}))};
  return [app, faq].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
}
