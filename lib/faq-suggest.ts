// 지시서 10주차: 문의 쓰는 동안 비슷한 자주 묻는 질문을 먼저 보여 준다(글자 2개 묶음이 겹치는 정도로 고름)
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type QA = {q: string; a: string; link?: [string, string]};
const STOP = new Set(['어떻게', '하나요', '되나요', '있나요', '해요', '어요', '에서', '하면', '은요', '는데']);
const grams = (t: string) => { const s = t.replace(/[^가-힣a-zA-Z0-9]/g, ''); const out = new Set<string>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); if (!STOP.has(g)) out.add(g); } return out; };
export function suggestFaq(text: string, groups: {group: string; items: QA[]}[], n = 3) {
  const q = grams(text); if (q.size < 2) return [];
  const all = groups.flatMap(g => g.items.map(it => ({...it, group: g.group})));
  return all.map(it => { const t = grams(it.q), b = grams(it.a); let s = 0; for (const g of q) { if (t.has(g)) s += 2; else if (b.has(g)) s += 0.5; } return {it, s: s / Math.sqrt(q.size)}; })
    .filter(x => x.s >= 1.2).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.it);
}
/** 문의 대화: 처음 문의 + 답변·추가 문의 */
export type ThreadItem = {from: '회원' | '본사'; body: string; at: string};
export function parseThread(raw: unknown): ThreadItem[] { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(v) ? v.filter(x => x && typeof x.body === 'string').slice(-50) : []; } catch { return []; } }
