// 가이드 38: 체험 화면에서 매장 매뉴얼·휴가·공지·대타가 어떻게 보이는지 예시로 보여 준다(저장하지 않음).
const MANUAL=[{title:'마감 순서 (홀)',steps:['포스 마감 정산을 누르고 영수증을 금고에 넣어요.','테이블·의자를 닦고 의자를 테이블 위에 올려요.','에어컨·간판 조명을 끄고, 출입문을 잠근 뒤 사진을 찍어 단톡방에 올려요.']},{title:'커피 머신 아침 준비',steps:['전원을 켜고 15분 예열해요.','첫 샷 두 잔은 버려요(머신 길들이기).','우유 스팀 노즐을 한 번 비우고 닦아요.']}];
const LEAVES=[['김예시','연차','다음 주 수요일 1일','승인 대기'],['박샘플','연차','이번 달 25~26일 2일','승인'],['정가상','무급휴가','다음 주 토요일 1일','반려 · 대체 근무자 없음']];
const SWAPS=[['정가상','토 11:00~18:00 대타 구해요','박샘플이 하겠다고 함 → 사장님 승인 대기'],['김예시','금 09:00~15:00 ↔ 목 09:00~15:00 교대','승인']];
const NOTICES=[['위생 점검 안내','다음 주 화요일 구청 위생 점검이 있어요. 모자·앞치마 꼭 챙겨 주세요.','읽음 3/4'],['추석 근무','추석 당일은 쉬고, 전날·다음 날은 2시간 일찍 마감해요.','읽음 4/4']];
export function DemoManual(){return <section className="panel t-panelbody"><p className="notice">체험용 예시예요. 로그인한 매장에서는 사진을 넣어 단계별로 만들고, 직원 휴대폰에 바로 보여요.</p>{MANUAL.map(m=><article key={m.title} className="t-gap"><h2>{m.title}</h2><ol>{m.steps.map(s=><li key={s}>{s}</li>)}</ol></article>)}</section>}
export function DemoOperations(){return <section className="panel t-panelbody"><p className="notice">체험용 예시예요. 로그인한 매장에서는 직원이 휴대폰으로 신청하고 사장님이 여기서 승인해요.</p>
 <h2>휴가 신청</h2><div className="t-tablewrap"><table><thead><tr><th>직원</th><th>종류</th><th>기간</th><th>상태</th></tr></thead><tbody>{LEAVES.map(r=><tr key={r[0]+r[2]}>{r.map((c,i)=><td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
 <h2 className="t-gap">대타·교대 요청</h2><ul>{SWAPS.map(r=><li key={r[1]}><b>{r[0]}</b> · {r[1]} — {r[2]}</li>)}</ul>
 <h2 className="t-gap">매장 공지</h2><ul>{NOTICES.map(r=><li key={r[0]}><b>{r[0]}</b> — {r[1]} <small>({r[2]})</small></li>)}</ul></section>}
