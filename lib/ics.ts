// 가이드 70: 내 근무를 휴대폰 달력(구글·애플·삼성)에 넣는 .ics 파일. 시각은 한국 시간(Asia/Seoul) 그대로 쓴다.
export type IcsShift = {id: string; date: string; start: string; end: string; title?: string; place?: string};
const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const dt = (date: string, hm: string) => date.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00';
const nextDay = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
/** 75자 넘는 줄 접기(RFC 5545) — 한글은 바이트 기준이라 넉넉히 60자로 자른다 */
const fold = (line: string) => { const out: string[] = []; let rest = line; while (rest.length > 60) { out.push(rest.slice(0, 60)); rest = ' ' + rest.slice(60); } out.push(rest); return out.join('\r\n'); };
export function shiftsToIcs(store: string, shifts: IcsShift[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chukchukapp.kr//schedule//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(store + ' 근무'), 'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const s of shifts) {
    const endDate = s.end <= s.start ? nextDay(s.date) : s.date; // 밤샘 근무
    lines.push('BEGIN:VEVENT', 'UID:' + s.id + '@chukchukapp.kr', 'DTSTAMP:' + stamp, 'DTSTART;TZID=Asia/Seoul:' + dt(s.date, s.start), 'DTEND;TZID=Asia/Seoul:' + dt(endDate, s.end),
      'SUMMARY:' + esc(s.title || store + ' 근무'), ...(s.place ? ['LOCATION:' + esc(s.place)] : []), 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
