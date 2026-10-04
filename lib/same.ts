// 키 순서와 상관없이 같은 값인지 비교한다(DB jsonb는 키 순서를 바꾼다).
export const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
export const same = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
