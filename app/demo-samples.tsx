// 가이드 38: 체험 화면에서 매장 매뉴얼·휴가·공지·대타가 어떻게 보이는지 예시로 보여 준다(저장하지 않음).
const MANUAL=[{title:'마감 순서 (홀)',steps:['포스 마감 정산을 누르고 영수증을 금고에 넣어요.','테이블·의자를 닦고 의자를 테이블 위에 올려요.','에어컨·간판 조명을 끄고, 출입문을 잠근 뒤 사진을 찍어 단톡방에 올려요.']},{title:'커피 머신 아침 준비',steps:['전원을 켜고 15분 예열해요.','첫 샷 두 잔은 버려요(머신 길들이기).','우유 스팀 노즐을 한 번 비우고 닦아요.']}];
export function DemoManual(){return <section className="panel t-panelbody"><p className="notice">체험용 예시예요. 로그인한 매장에서는 사진을 넣어 단계별로 만들고, 직원 휴대폰에 바로 보여요.</p>{MANUAL.map(m=><article key={m.title} className="t-gap"><h2>{m.title}</h2><ol>{m.steps.map(s=><li key={s}>{s}</li>)}</ol></article>)}</section>}

