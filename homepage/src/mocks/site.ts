export const BRAND = {
  name: "척척사장봇",
  alias: "척척이",
  tagline: "사장님 옆의 든든한 매장 비서",
  aliasLine: "매장 비서 척척이",
};

export const CHARACTER = {
  image:
    "https://storage.helloreaddy.io/project_files/cba92c23-514d-40dc-ac8a-94006ddb63a2/760723a6-6e7b-47e1-8e8d-a35786961229_compressed_cheokcheoki-welcome.webp",
  // 히어로 오른쪽 인사 영상 (Higgsfield에서 직접 생성·확인한 5초 무음 영상).
  // 원본 이미지를 poster/fallback으로 함께 쓴다. 큰 영상 섹션을 만들지 않고 자리만 교체한다.
  heroVideoUrl:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3JBiHIWO19NVQIwSnWzVAcACC0c/hf_20260923_075524_46cfe314-9dbf-4114-86ae-11e5237468e6.mp4",
  alt: "초록 앞치마를 입은 매장 도우미 척척이",
  greeting: "사장님, 오늘도 척척 해볼까요?",
};

// 새로 제작한 공식 "안내 자세" 이미지(좌 3/4로 돌아 손바닥을 펴 내용을 가리킴).
// 홈·제품 페이지의 요약 급여 카드 캐릭터만 이 이미지로 교체한다.
export const CHEOKCHEOKI_GUIDE =
  "https://storage.helloreaddy.io/project_files/cba92c23-514d-40dc-ac8a-94006ddb63a2/d3ebb5c7-e4e9-48b1-b0cd-793c0b45608b_compressed_cheokcheoki-guide.webp";

// 캐릭터 역할: guide(안내)는 새 공식 안내 자세 이미지를 쓰고, 나머지는 원본 이미지를 그대로 사용한다.
// welcome=정면 미소로 손 흔들기 / guide=좌 3/4로 돌아 손바닥으로 내용 가리키기 /
// review=우 3/4로 목록을 들고 살피기 / complete=정면 눈웃음에 엄지척.
export const CHARACTER_ROLES: Record<string, string> = {
  welcome: CHARACTER.image,
  guide: CHEOKCHEOKI_GUIDE,
  review: CHARACTER.image,
  complete: CHARACTER.image,
};

/* ------------------------------------------------------------------ */
/* 공통 사이트 표기 + og/twitter 공용 이미지                            */
/* 세로 광고가 아니라 기존 브랜드 대표 이미지(척척이)를 공용 이미지로 쓴다. */
/* ------------------------------------------------------------------ */

export const SITE = {
  name: BRAND.name,
  ogImage: CHARACTER.image,
  ogImageAlt: "초록 앞치마를 두른 척척사장봇 매장 도우미 척척이",
  twitterCard: "summary_large_image",
  locale: "ko_KR",
};

export interface SeoMeta {
  title: string;
  description: string;
  keywords: string;
}

/* 경로별 고유 제목·설명·키워드. 모든 문구는 실제 화면 내용과 일치한다. */
export const SEO_META: Record<string, SeoMeta> = {
  "/": {
    title: "척척사장봇 | 직원 출근부터 월급 정리까지",
    description:
      "앱 설치 없이 휴대폰으로 여는 매장 관리 비서, 척척사장봇. 직원 출퇴근, 근무표, 급여 정리를 한곳에서 확인하세요. 가입 후 30일은 카드 등록 없이 무료이고, 자동 결제는 없어요.",
    keywords: "척척사장봇, 척척이, 매장 직원관리, 출퇴근 관리, 근무표, 급여 정리, 소상공인",
  },
  "/product": {
    title: "어떻게 쓰나요 | 척척사장봇 매장 운영 기능",
    description:
      "척척사장봇이 제공하는 기능을 사실대로 소개합니다. 이메일 로그인, 직원 직접 가입·가입 신청 관리, 중간관리자 권한 위임, 출퇴근·휴게 기록, 정정 승인, 근무표, 매장 QR, 급여 정리, 근로계약서 표준서식 초안과 사본 다운로드를 확인하세요.",
    keywords: "척척사장봇 사용법, 매장 출퇴근 관리, 근무표, 급여 정리, 직원 관리",
  },
  "/pricing": {
    title: "이용 요금 | 척척사장봇 요금제",
    description:
      "베이직 월 9,900원부터, 프로(QR 출퇴근) 월 14,900원부터(1지점, VAT 포함). 직원 수 제한 없이 지점 수로만 요금이 정해지고, 가입 후 30일은 무료예요.",
    keywords: "척척사장봇 요금, 매장 관리 요금제, 출퇴근 관리 가격, 소상공인 요금",
  },
  "/guide": {
    title: "시작 방법 | 척척사장봇 시작 안내",
    description:
      "사장님과 직원 두 경로로 시작하는 방법을 안내해요. 사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일 가입 후 가게 코드를 넣어 합류를 신청하고 사장님이 수락하면 연결돼요. 매장 QR은 출근·퇴근 때 스캔하는 방식이에요.",
    keywords: "척척사장봇 시작 방법, 사장님 회원가입·로그인, 직원 가입·가게 합류, 매장 QR 출근",
  },
  "/try": {
    title: "화면 먼저 보기 | 척척사장봇 사전 체험",
    description:
      "회원가입 없이 척척사장봇 화면을 먼저 눌러 보세요. 이번 달 예상 급여와 오늘 출근 상태를 요약으로 보고, 급여·출퇴근·근무표 상세를 열어볼 수 있어요. 모든 화면은 가상 예시예요.",
    keywords: "척척사장봇 사전 체험, 매장 관리 화면, 출퇴근 데모, 급여 데모, 근무표 데모",
  },
  "/start": {
    title: "시작하기 | 척척사장봇 사장님·직원 시작",
    description:
      "사장님과 직원이 각자 맞는 경로로 시작해요. 사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일 가입 후 가게 코드를 넣어 합류를 신청한 뒤 사장님이 수락해 연결돼요. 무료 화면 체험은 로그인 없이 열려요.",
    keywords: "척척사장봇 시작하기, 사장님 회원가입, 사장님 로그인, 직원 가입·가게 합류, 직원 로그인",
  },
  "/security": {
    title: "데이터·권한 안내 | 척척사장봇 접근 관리",
    description:
      "척척사장봇의 데이터 접근 원칙을 안내합니다. 역할 기반 서버 권한 확인, 개인별 필요한 정보만 제공, 변경 이력 기록을 원칙으로 하며, 확인되지 않은 인증이나 보증은 주장하지 않습니다.",
    keywords: "척척사장봇 데이터 권한, 역할 기반 접근, 출퇴근 데이터 관리, 매장 정보 보호",
  },
  "/terms": {
    title: "서비스 준비 안내 | 척척사장봇",
    description:
      "척척사장봇은 정식 판매 전 준비 단계입니다. 서비스 이용약관과 운영자 정보는 확정 전이며 확정 시점에 안내할 예정이에요. 현재는 결제 기능을 제공하지 않습니다.",
    keywords: "척척사장봇 서비스 준비, 이용약관 준비, 판매 준비 안내",
  },
  "/privacy": {
    title: "개인정보 안내 준비 | 척척사장봇",
    description:
      "척척사장봇의 개인정보 처리방침은 정식 판매 전 확정 예정입니다. 현재 홈페이지는 별도의 개인정보 입력 폼을 운영하지 않으며 이름·연락처·이메일을 수집하지 않습니다.",
    keywords: "척척사장봇 개인정보 안내, 개인정보 처리방침 준비, 정보 수집",
  },
  "/contact": {
    title: "도입 준비 안내 | 척척사장봇 사전 체험",
    description:
      "척척사장봇 도입 준비 안내입니다. 별도 문의 폼 대신 화면 먼저 보는 사전 체험으로 시작해요. 사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일로 가입해 합류를 신청하고 사장님이 수락해 연결해요.",
    keywords: "척척사장봇 도입 안내, 사전 체험 안내, 매장 관리 시작",
  },
};

export const EXTERNAL = {
  // 역할별 진입 URL — 사장님과 직원이 각자 맞는 화면으로 들어간다.
  // 사장님: 가게 만들기(회원가입) + 로그인
  ownerSignup: "https://chukchukapp.kr/signup?role=owner&plan=basic",
  ownerLogin: "https://chukchukapp.kr/login?role=owner",
  // 직원: 직원 가입·가게 합류 + 로그인
  employeeSignup: "https://chukchukapp.kr/employee",
  employeeLogin: "https://chukchukapp.kr/login?role=employee",
  demo: "https://chukchukapp.kr/demo",
  // 공개 "무료로 시작하기"·체험 CTA는 운영 앱의 체험 화면(/demo)으로 보낸다.
  // "내 가게 열기" CTA는 운영 앱 /start로 보내 앱 안의 사장님/직원 역할 선택을 쓴다.
  appStart: "https://chukchukapp.kr/start",
  starter: "https://chukchukapp.kr/signup?role=owner&plan=basic",
  team: "https://chukchukapp.kr/signup?role=owner&plan=pro",
  multi: "https://chukchukapp.kr/signup?role=owner&plan=pro",
  // 실제 앱의 직원 가입 주소와 사장님 신청 관리 화면.
  employee: "https://chukchukapp.kr/employee",
  staffRequests: "https://chukchukapp.kr/staff-requests",
};

/* 역할별 시작 경로 — 사장님 / 직원 두 버전으로 진입을 분리한다.
   역할 선택만으로 권한이 생기지 않으며, 직원은 사장님 수락 후 연결된다. */
export interface RoleEntryAction {
  label: string;
  href: string;
  primary: boolean;
  note: string;
}

export interface RoleEntry {
  id: string;
  role: string;
  title: string;
  body: string;
  icon: string;
  steps: string[];
  actions: RoleEntryAction[];
}

export const ROLE_ENTRIES: RoleEntry[] = [
  {
    id: "owner",
    role: "사장님",
    title: "사장님으로 시작",
    body: "이메일·비밀번호로 가입해 가게를 만들고, 직원 가입 신청 관리에서 매장별 조건을 설정하고 수락해요. 근무표와 급여도 함께 관리해요.",
    icon: "ri-store-3-line",
    steps: ["가게 만들기", "가입 신청 관리", "근무표·급여 관리"],
    actions: [
      {
        label: "사장님 회원가입",
        href: EXTERNAL.ownerSignup,
        primary: true,
        note: "가게 새로 만들기",
      },
      {
        label: "사장님 로그인",
        href: EXTERNAL.ownerLogin,
        primary: false,
        note: "이미 가게가 있어요",
      },
    ],
  },
  {
    id: "employee",
    role: "직원",
    title: "직원으로 시작",
    body: "이메일로 계정을 만들고 가게 코드를 확인해 이름·연락처·주소·첫 근무일을 입력해요. 근로계약 초안을 확인하고 가입을 신청한 뒤, 사장님이 수락하면 내 화면이 열려요.",
    icon: "ri-user-add-line",
    steps: ["이메일 계정 만들기", "가게 코드 확인", "근로조건 확인", "가입 신청·승인 대기", "수락 후 본인 화면"],
    actions: [
      {
        label: "직원 회원가입·가게 합류",
        href: EXTERNAL.employeeSignup,
        primary: true,
        note: "이메일로 계정 만들고 합류 신청",
      },
      {
        label: "직원 로그인",
        href: EXTERNAL.employeeLogin,
        primary: false,
        note: "이미 합류했어요",
      },
    ],
  },
];

export const ROLE_ENTRY_NOTES = [
  "역할 선택만으로 권한이 생기는 것은 아니에요. 직원은 사장님이 수락한 뒤에 연결돼요.",
  "수락 전에는 직원이 매장 정보를 볼 수 없어요.",
  "회원가입과 로그인은 이메일·비밀번호로 진행해요.",
  "직원 화면에서는 본인 출퇴근·근무표·급여·계약만 볼 수 있어요.",
];

export const HERO = {
  title: "직원 출근부터 월급 정리까지, 척척.",
  description:
    "앱 설치 없이 휴대폰으로 여세요. 오늘 누가 일하는지, 이번 달 급여는 얼마인지 한곳에서 확인해요.",
  primaryCta: "무료로 시작하기",
  secondaryCta: "화면 먼저 보기",
};

export const TRIAL_NOTE =
  "30일 무료 체험 · 카드 등록 없음 · 자동 결제 없음";

export const PRICING_DISCLAIMER =
  "지금은 판매 준비용 가격이에요. 정식 판매 전에 가격과 조건이 바뀔 수 있어요.";

export const PAID_BILLING_NOTE =
  "가입 후 30일 동안 프로 기능까지 무료 · 카드 등록 없음 · 자동 결제 없음";

export interface NavLinkItem {
  label: string;
  to: string;
  external?: boolean;
}

export interface FooterGroup {
  title: string;
  links: NavLinkItem[];
}

export const NAV_LINKS: NavLinkItem[] = [
  { label: "어떻게 쓰나요", to: "/product" },
  { label: "이용 요금", to: "/pricing" },
  { label: "시작 방법", to: "/guide" },
  { label: "내 가게 열기", to: EXTERNAL.appStart, external: true },
];

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: "알아보기",
    links: [
      { label: "어떻게 쓰나요", to: "/product" },
      { label: "이용 요금", to: "/pricing" },
      { label: "시작 방법", to: "/guide" },
      { label: "내 가게 열기", to: EXTERNAL.appStart, external: true },
    ],
  },
  {
    title: "안내",
    links: [
      { label: "데이터·권한 안내", to: "/security" },
      { label: "서비스 준비 안내", to: "/terms" },
      { label: "개인정보 안내 준비", to: "/privacy" },
      { label: "도입 준비 안내", to: "/contact" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 제품 시연(데모) — 실제 앱 화면 구조를 따라 만든 가상 예시 데이터      */
/* ------------------------------------------------------------------ */

export const APP_MENU = [
  { label: "홈", icon: "ri-home-5-line" },
  { label: "직원 관리", icon: "ri-team-line" },
  { label: "근로계약서", icon: "ri-file-text-line" },
  { label: "출퇴근 기록", icon: "ri-time-line" },
  { label: "근무 스케줄", icon: "ri-calendar-schedule-line" },
  { label: "급여·명세서", icon: "ri-wallet-3-line" },
  { label: "매장 관리·비교", icon: "ri-store-2-line" },
];

export const DEMO_STORE = "우리 가게 (예시)";
export const DEMO_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
export const DEMO_EMPLOYEES = ["김예시", "박샘플", "이체험", "임예제"];
export const DEMO_SHIFT = "09:00–17:00";
export const DEMO_SHIFT_NOTE = "모든 근무 09:00–17:00 · 휴게 60분";

export const DEMO_STEPS = [
  {
    id: "clock",
    menu: "출퇴근 기록",
    label: "오늘 출근 보기",
    headline: "오늘 누가 나왔는지 바로 보여요",
    captions: [
      "① 오늘 출근한 직원과 아직 안 온 직원을 한 줄로 구분해요.",
      "② 빠진 기록은 사유와 함께 정정을 요청하고, 사장님이 승인해요.",
    ],
  },
  {
    id: "schedule",
    menu: "근무 스케줄",
    label: "근무표 보기",
    headline: "누가 언제 일하는지 한눈에 보여요",
    captions: [
      "① 요일마다 직원별 근무 시간을 한 칸에 담았어요.",
      "② 근무표를 저장하면 직원 화면에도 같은 내용이 보여요.",
    ],
  },
  {
    id: "payroll",
    menu: "급여·명세서",
    label: "월급 정리 보기",
    headline: "이번 달 급여를 정리하고 확정해요",
    captions: [
      "① 직원별 근무 시간과 실수령액을 한 표에서 확인해요.",
      "② 확인이 끝나면 급여 확정을 눌러 마감해요.",
    ],
  },
];

/* 우리 가게 홈 요약: 이번 달 예상 급여 + 오늘 상태 (가상 예시) */
export const DEMO_HOME_SUMMARY = {
  store: "우리 가게",
  meta: "오늘 · 9월 23일 수요일 (예시)",
  salary: {
    title: "이번 달 예상 급여",
    amount: "266,000원",
    basis: "입력된 근무·수당·공제 기준 · 검토 전",
    cta: "급여 자세히 보기",
  },
  clock: {
    id: "clock",
    label: "오늘 출근",
    value: "4명 · 지금 근무 1명",
  },
  // 출근 줄 아래에 붙는 작은 근무표 링크.
  scheduleLink: { label: "오늘 근무표 보기" },
  // "확인할 일"은 근무표로 가지 않고, 직원정보 확인 목록을 접고 편다.
  confirm: {
    id: "confirm",
    label: "확인할 일",
    value: "4건",
    action: "직원정보 확인",
    items: [
      { name: "김예시", item: "계좌 정보 확인", state: "확인 필요" },
      { name: "박샘플", item: "연락처 정보 확인", state: "확인 필요" },
      { name: "이체험", item: "근로계약 서명 확인", state: "확인 필요" },
      { name: "임예제", item: "신분 확인 서류", state: "확인 필요" },
    ],
  },
  note: "화면 이해를 위한 예시예요. 입력한 내용은 저장되지 않고 실제 송금도 없어요.",
};

/* 직원 관리 화면 — 직원 목록·상세 (가상 예시 · 홈의 "확인할 일"과 같은 4명) */
export const DEMO_EMPLOYEE_ROSTER = [
  {
    id: "kim",
    name: "김예시",
    role: "홀 · 정직원",
    status: "오늘 퇴근",
    tone: "warn",
    phone: "010-0000-0001",
    hireDate: "2023년 4월 3일",
    pay: "시급 11,000원",
    schedule: "월–금 · 09:00–17:00",
    account: "○○은행 ***-***-1001",
    checkItem: "계좌 정보 확인",
    checkState: "확인 필요",
  },
  {
    id: "park",
    name: "박샘플",
    role: "주방 · 정직원",
    status: "오늘 퇴근",
    tone: "warn",
    phone: "010-0000-0002",
    hireDate: "2024년 1월 8일",
    pay: "시급 11,200원",
    schedule: "화–토 · 10:00–18:00",
    account: "△△은행 ***-***-2002",
    checkItem: "연락처 정보 확인",
    checkState: "확인 필요",
  },
  {
    id: "lee",
    name: "이체험",
    role: "홀 · 아르바이트",
    status: "오늘 퇴근",
    tone: "warn",
    phone: "010-0000-0003",
    hireDate: "2025년 3월 17일",
    pay: "시급 10,500원",
    schedule: "주말 · 09:00–17:00",
    account: "□□은행 ***-***-3003",
    checkItem: "근로계약 서명 확인",
    checkState: "확인 필요",
  },
  {
    id: "lim",
    name: "임예제",
    role: "주방 · 아르바이트",
    status: "근무 중",
    tone: "ok",
    phone: "010-0000-0004",
    hireDate: "2025년 6월 2일",
    pay: "시급 10,500원",
    schedule: "금–일 · 11:00–19:00",
    account: "◇◇은행 ***-***-4004",
    checkItem: "신분 확인 서류",
    checkState: "확인 필요",
  },
];

/* 근로계약서 화면 — 가상 직원 4명의 근로조건 (실제 개인정보·실제 서명 없음) */
export interface DemoContract {
  id: string;
  name: string;
  role: string;
  period: string;
  hours: string;
  hourlyWage: string;
  payDay: string;
  workplace: string;
  duties: string;
  leave: string;
}

export const DEMO_CONTRACTS: DemoContract[] = [
  {
    id: "kim",
    name: "김예시",
    role: "홀 · 정직원",
    period: "2023년 4월 3일 ~ 기간의 정함이 없음",
    hours: "월–금 09:00–17:00 (휴게 60분)",
    hourlyWage: "시급 11,000원",
    payDay: "매월 10일",
    workplace: "우리 가게 본점 (예시 주소)",
    duties: "홀 주문 접수·서빙·마감 정리",
    leave: "주 1일 유급 휴일 · 연차는 근로기준법에 따름",
  },
  {
    id: "park",
    name: "박샘플",
    role: "주방 · 정직원",
    period: "2024년 1월 8일 ~ 기간의 정함이 없음",
    hours: "화–토 10:00–18:00 (휴게 60분)",
    hourlyWage: "시급 11,200원",
    payDay: "매월 10일",
    workplace: "우리 가게 본점 (예시 주소)",
    duties: "주방 조리 보조·재료 준비·위생 관리",
    leave: "주 1일 유급 휴일 · 연차는 근로기준법에 따름",
  },
  {
    id: "lee",
    name: "이체험",
    role: "홀 · 아르바이트",
    period: "2025년 3월 17일 ~ 기간의 정함이 없음",
    hours: "주말 09:00–17:00 (휴게 60분)",
    hourlyWage: "시급 10,500원",
    payDay: "매월 10일",
    workplace: "우리 가게 본점 (예시 주소)",
    duties: "홀 주문 접수·서빙·정리",
    leave: "주 1일 유급 휴일 · 연차는 근로기준법에 따름",
  },
  {
    id: "lim",
    name: "임예제",
    role: "주방 · 아르바이트",
    period: "2025년 6월 2일 ~ 기간의 정함이 없음",
    hours: "금–일 11:00–19:00 (휴게 60분)",
    hourlyWage: "시급 10,500원",
    payDay: "매월 10일",
    workplace: "우리 가게 본점 (예시 주소)",
    duties: "주방 조리 보조·설거지·정리",
    leave: "주 1일 유급 휴일 · 연차는 근로기준법에 따름",
  },
];

export const DEMO_TODAY_SUMMARY = [
  { label: "오늘 출근", value: "4명", tone: "ok" },
  { label: "지금 근무", value: "1명", tone: "ok" },
  { label: "퇴근 확인 필요", value: "1건", tone: "warn" },
];

export const DEMO_ATTENDANCE = [
  {
    name: "김예시",
    day: "9/23 (수)",
    clockIn: "09:00",
    clockOut: "17:05",
    rest: "60분",
    work: "7시간 5분",
    state: "출근 완료",
    tone: "ok",
  },
  {
    name: "박샘플",
    day: "9/23 (수)",
    clockIn: "08:58",
    clockOut: "17:02",
    rest: "60분",
    work: "7시간 4분",
    state: "출근 완료",
    tone: "ok",
  },
  {
    name: "이체험",
    day: "9/23 (수)",
    clockIn: "09:00",
    clockOut: "17:00",
    rest: "60분",
    work: "7시간 0분",
    state: "출근 완료",
    tone: "ok",
  },
  {
    name: "임예제",
    day: "9/23 (수)",
    clockIn: "17:00",
    clockOut: "—",
    rest: "—",
    work: "근무 중",
    state: "근무 중",
    tone: "ok",
  },
];

export const DEMO_APPROVAL = {
  name: "김예시",
  day: "9/23 (수) 퇴근",
  before: "17:00",
  after: "18:00",
  reason: "마감 정리 시간이 반영되지 않았어요.",
};

// 직원별 실수령 합계가 홈 요약의 "이번 달 예상 급여 266,000원"과 정확히 일치한다.
// (지급 288,000원 − 공제 22,000원 = 266,000원)
export const DEMO_PAYROLL = [
  { name: "김예시", hours: "12시간", pay: "96,000원", deduct: "8,000원", net: "88,000원" },
  { name: "박샘플", hours: "11시간", pay: "88,000원", deduct: "7,000원", net: "81,000원" },
  { name: "이체험", hours: "10시간", pay: "80,000원", deduct: "6,000원", net: "74,000원" },
  { name: "임예제", hours: "3시간", pay: "24,000원", deduct: "1,000원", net: "23,000원" },
];

export const DEMO_PAYROLL_TOTAL = "266,000원";
export const DEMO_MONTH = "2026년 9월 (예시)";

export const DEMO_MONTHS = ["9월", "8월"];

export const DEMO_MULTI_STORES = [
  { store: "강남점 (예시)", staff: "8명", hours: "412시간", cost: "4,120,000원", checkouts: "2건" },
  { store: "홍대점 (예시)", staff: "6명", hours: "318시간", cost: "3,180,000원", checkouts: "1건" },
  { store: "잠실점 (예시)", staff: "9명", hours: "455시간", cost: "4,550,000원", checkouts: "3건" },
];

export const QR_GUIDE = {
  title: "휴대폰 카메라로 매장 QR을 찍으면 출근 화면이 열려요.",
  note: "직원은 이메일로 가입한 뒤 합류를 신청하고, 사장님이 수락하면 본인 화면에서 출근 버튼을 눌러 기록해요. 매장에 붙이거나 띄운 QR을 출근·퇴근 때 스캔하는 방식이고, 위치 인증이 아니에요. QR 스캔만으로 자동 출근되지는 않아요.",
};

/* ------------------------------------------------------------------ */
/* 브랜드 제품체험 — 일간 근무 타임라인 (가상 예시)                     */
/* ------------------------------------------------------------------ */

export interface ShiftSegment {
  start: number; // 시작 시각 (0–24)
  end: number; // 종료 시각 (24 초과 시 다음날로 이어짐)
  label: string;
}

export interface TimelineEmployee {
  name: string;
  note: string;
  segments: ShiftSegment[];
}

export const DEMO_TIMELINE_DAY = "9월 23일 수요일 (예시)";

export const DEMO_TIMELINE: TimelineEmployee[] = [
  {
    name: "김예시",
    note: "오픈 준비",
    segments: [{ start: 9, end: 17, label: "09:00–17:00" }],
  },
  {
    name: "박샘플",
    note: "홀 담당",
    segments: [{ start: 9, end: 17, label: "09:00–17:00" }],
  },
  {
    name: "이체험",
    note: "야간 마감",
    segments: [{ start: 22, end: 26, label: "22:00–다음날 02:00" }],
  },
  {
    name: "임예제",
    note: "저녁 근무",
    segments: [{ start: 17, end: 22, label: "17:00–22:00" }],
  },
];

/* 쉬운 질문 문구: 누가 일하나요 → 몇 시부터 몇 시까지인가요 → 얼마를 줄까요 */
export const EXPERIENCE_QUESTIONS: Record<string, string> = {
  clock: "누가 일하나요?",
  schedule: "몇 시부터 몇 시까지인가요?",
  payroll: "얼마를 줄까요?",
};

/* 척척이가 탭에 맞춰 건네는 짧은 안내 문장 */
export const MASCOT_GUIDES: Record<string, string> = {
  clock: "누가 출근했는지 여기서 확인해요.",
  schedule: "몇 시부터 몇 시까지 일하는지 보여요.",
  payroll: "기록을 확인하고 월급을 정리해요.",
};

/* ------------------------------------------------------------------ */
/* 요금제                                                              */
/* ------------------------------------------------------------------ */

export interface PlanFeature {
  label: string;
  preview?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  limit: string;
  price: string;
  priceNote: string;
  total: string;
  highlight: boolean;
  cta: string;
  url: string;
  note: string;
  extra?: string;
  features: PlanFeature[];
}

// 요금은 운영 앱 lib/plans.ts와 같아야 한다(scripts/check-claims.mjs가 비교). 모든 금액은 VAT 포함.
export const PLAN_TIERS = {
  basic: [[1, 9900], [3, 14900], [5, 18900]] as [number, number][],
  pro: [[1, 14900], [3, 19900], [5, 23900]] as [number, number][],
};
export const EXTRA_PER_BRANCH = 3900;
export const CONTRACT_FREE_PER_MONTH = 1;
export const CONTRACT_EXTRA_PRICE = 3000;
export const TERM_DISCOUNTS = [
  { months: 1, rate: 0 },
  { months: 6, rate: 0.1 },
  { months: 12, rate: 0.2 },
];
/** 지점 수에 맞는 월 요금(VAT 포함). 6지점부터 지점당 추가. */
export function monthlyPrice(plan: keyof typeof PLAN_TIERS, branches: number) {
  const tiers = PLAN_TIERS[plan];
  for (const [upTo, price] of tiers) if (branches <= upTo) return price;
  const [last, top] = tiers[tiers.length - 1];
  return top + (branches - last) * EXTRA_PER_BRANCH;
}
const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;

const BASIC_FEATURES: PlanFeature[] = [
  { label: "직원 수 제한 없음" },
  { label: "근무표 · 대타·교대 요청" },
  { label: "출퇴근 기록 · 정정 승인" },
  { label: "급여 계산 · 임금명세서 · 임금대장" },
  { label: `전자근로계약서 (월 ${CONTRACT_FREE_PER_MONTH}장 무료, 추가 1장 ${won(CONTRACT_EXTRA_PRICE)})` },
  { label: "휴가 · 공지 · 매장 매뉴얼" },
];

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "베이직",
    tagline: "근무표·급여·계약을 한곳에서",
    limit: `2~3지점 ${won(monthlyPrice("basic", 3))} · 4~5지점 ${won(monthlyPrice("basic", 5))}`,
    price: `월 ${won(monthlyPrice("basic", 1))}`,
    priceNote: "1지점 · VAT 포함",
    total: `6지점부터 지점당 월 ${won(EXTRA_PER_BRANCH)} 추가`,
    highlight: false,
    cta: "30일 무료로 시작하기",
    url: EXTERNAL.starter,
    note: PAID_BILLING_NOTE,
    features: BASIC_FEATURES,
  },
  {
    id: "pro",
    name: "프로",
    tagline: "베이직 전부 + 매장 QR 출퇴근",
    limit: `2~3지점 ${won(monthlyPrice("pro", 3))} · 4~5지점 ${won(monthlyPrice("pro", 5))}`,
    price: `월 ${won(monthlyPrice("pro", 1))}`,
    priceNote: "1지점 · VAT 포함",
    total: `6지점부터 지점당 월 ${won(EXTRA_PER_BRANCH)} 추가`,
    highlight: true,
    cta: "30일 무료로 시작하기",
    url: EXTERNAL.team,
    note: PAID_BILLING_NOTE,
    features: [...BASIC_FEATURES, { label: "매장 QR 출퇴근 (30초마다 바뀌는 QR)" }],
  },
];

export const PRICING_VAT_NOTE =
  "안내된 모든 요금은 VAT 포함 금액이에요. 6개월 구독은 10%, 12개월 구독은 20% 할인돼요.";

export const PRICING_LIMIT_NOTE =
  "직원 수는 제한이 없어요. 요금은 지점(매장) 수로만 정해져요.";

// 순서(번호)는 다른 페이지가 FAQS[n]으로 골라 쓰므로 바꾸지 않는다. 답은 운영 앱 도움말(lib/faq.ts)과 맞춘다.
export const FAQS = [
  {
    q: "설치가 필요한가요?",
    a: "아니요. 휴대폰이나 컴퓨터 브라우저로 열어서 써요. 홈 화면에 추가하면 앱처럼 열려요.",
  },
  {
    q: "무료로 써 볼 수 있나요?",
    a: "네. 가입하면 가게당 한 번 30일 동안 프로 기능까지 무료로 쓸 수 있어요. 카드를 등록하지 않아요.",
  },
  {
    q: "체험이 끝나면 자동으로 결제되나요?",
    a: "아니요. 자동 결제와 자동 갱신은 없어요. 체험이 끝나도 기록 조회와 내려받기는 계속되고, 새로 저장하려면 요금제를 결제해요. 지금은 결제 서비스 연결 전이라 실제 결제는 없어요.",
  },
  {
    q: "지금 바로 가입할 수 있나요?",
    a: "네. 사장님은 이메일·비밀번호로 가입해 바로 가게를 만들 수 있어요. 직원은 사장님이 보낸 가입 링크로 신청하고, 사장님이 수락하면 연결돼요.",
  },
  {
    q: "출퇴근은 어떻게 기록하나요?",
    a: "프로 요금제(체험 포함)는 매장 QR을 찍은 뒤 출근·퇴근 버튼을 눌러요. 베이직은 QR 없이 앱 버튼으로 기록해요. QR을 찍기만 해서는 기록되지 않고, 위치는 기록하지 않아요.",
  },
  {
    q: "급여는 어디까지 자동으로 계산되나요?",
    a: "기본급, 주휴수당, 5명 이상 사업장의 연장·야간·휴일 가산, 4대보험과 근로소득세를 계산해요. 공휴일 유급휴일 수당 같은 일부 항목은 사장님이 확인해 넣어야 해요. 계산 결과는 참고 자료이고, 최종 금액은 사장님이 확인해 주세요.",
  },
  {
    q: "지점이 여러 곳이에요.",
    a: "요금은 지점 수 구간으로 정해져요. 1지점, 2~3지점, 4~5지점 요금이 있고 6지점부터는 지점당 월 3,900원이 더해져요. 앱에서 지점별 화면을 바꿔 가며 관리하고 지점끼리 비교할 수 있어요.",
  },
  {
    q: "휴가 신청도 되나요?",
    a: "네. 직원이 휴가를 신청하면 사장님이 승인하고, 잔여일수가 줄어요. 5명 이상 사업장이면 입사일 기준 연차도 계산해 보여 줘요.",
  },
  {
    q: "직원 수 제한이 있나요?",
    a: "없어요. 요금은 지점 수로만 정해지고, 직원은 몇 명이든 같은 요금이에요.",
  },
  {
    q: "근로계약서는 어떻게 쓰나요?",
    a: "모든 요금제에서 고용노동부 표준 근로계약서 양식으로 작성하고, 사장님과 직원이 앱에서 확인·서명해요. 전자근로계약서는 월 1장 무료이고 추가 1장은 3,000원이에요. 공인 인증서 서명은 아니고, 로그인한 계정 확인과 성명·동의(선택적으로 손서명)를 기록해요.",
  },
  {
    q: "로그인은 어떻게 하나요?",
    a: "이메일·비밀번호로 가입하고 로그인해요. 비밀번호를 잊으면 직원은 사장님이, 사장님은 본사가 본인 확인 후 임시 비밀번호를 만들어 드려요.",
  },
];

export const START_STEPS = [
  {
    step: "1",
    title: "화면 먼저 체험",
    body: "설치 없이 화면을 먼저 눌러 봐요. 로그인 없이도 열려요.",
    icon: "ri-window-line",
  },
  {
    step: "2",
    title: "내 가게 만들기",
    body: "사장님은 이메일·비밀번호로 가입해 내 가게를 만들어요.",
    icon: "ri-store-3-line",
  },
  {
    step: "3",
    title: "직원 연결·매장 QR",
    body: "직원은 이메일로 계정을 만들고 합류를 신청해요. 사장님이 수락하면 연결되고, 매장 QR을 출근·퇴근 때 스캔해요.",
    icon: "ri-qr-code-line",
  },
];

/* 직원 연결 기본 흐름 — 사장님은 가게 준비, 직원은 직접 신청, 사장님이 수락 */
export const EMPLOYEE_JOIN_FLOW = [
  {
    step: "1",
    title: "사장님이 가게 준비",
    body: "사장님은 이메일·비밀번호로 가입해 가게를 만들고, 직원 가입 주소와 가게 코드를 확인해요. 직원 가입 신청 관리에서 매장별 근로조건을 미리 설정해요.",
    icon: "ri-store-3-line",
  },
  {
    step: "2",
    title: "직원이 직접 신청",
    body: "직원은 이메일로 계정을 만들고 가게 코드를 확인한 뒤 이름·연락처·주소·첫 근무일을 입력해요. 사장님이 미리 설정한 근로계약 초안을 확인하고 가입을 신청하면, 사장님의 승인을 기다려요.",
    icon: "ri-user-add-line",
  },
  {
    step: "3",
    title: "사장님이 검토·수락",
    body: "사장님이 신청 정보와 계약을 검토해 수락하면, 그때부터 직원 본인 화면이 열려요.",
    icon: "ri-user-follow-line",
  },
];

export const EMPLOYEE_JOIN_NOTES = [
  "수락 전에는 직원이 매장 정보를 볼 수 없어요.",
  "가입 신청 때 보는 근로계약 초안 확인은 실제 서명과 별개예요. 실제 근로계약서는 수락 후 사장님이 작성해 양측이 서명해요.",
  "계약을 아직 설정하지 않은 매장은 직원 화면에 준비 중으로 안내돼요.",
  "사장님이 직원 정보를 직접 입력해 등록하거나, 이미 가입한 직원 계정과 연결하는 보조 방법도 있어요.",
];

/* 중간관리자(매니저) 권한 위임 — 사장님이 직원 정보에서 지정하고 항목별로 체크해 위임 */
export const MANAGER_DELEGATION = {
  title: "중간관리자(매니저) 권한 위임",
  body: "사장님이 직원 정보에서 중간관리자를 지정하고, 근무표 등록·근태 수정 승인·휴가 승인·지점 공지 작성 각 권한을 항목별로 체크해 위임해요.",
  notes: [
    "매니저는 소속 지점 범위 안에서만 볼 수 있어요.",
    "본인이 낸 신청은 스스로 승인할 수 없어요.",
    "권한을 회수하면 곧바로 적용돼요.",
  ],
  ownerOnly: "급여 확정·결제·계약 요청·권한 부여는 사장님이 관리해요. 직원은 본인 계약서만 확인하고 서명해요.",
};

/* 근로계약서 — 사장님 작성·서명 → 직원 본문 확인 후 서명 → 본문·양측 기록 보관·사본 (고용노동부 표준서식 참고) */
export const CONTRACT_DRAFT = {
  title: "고용노동부 표준서식 참고 근로계약서",
  steps: ["사장님 근로조건 작성·성명 서명", "직원 본문 확인 후 본인 서명", "본문·양측 기록 보관·사본 내려받기"],
  sourceLabel: "고용노동부 표준 근로계약서 서식 원문",
  sourceUrl: "https://www.moel.go.kr/mainpop2.do",
  note: "앱에서 양측 확인·서명과 사본을 관리해요. 이메일 인증·발송은 연결 준비 중이에요.",
  signupNote:
    "가입 신청 때 보는 근로계약 초안 확인은 실제 서명과 별개예요. 실제 근로계약서는 수락 후 사장님이 작성해 양측이 서명해요. 계약을 설정하지 않은 매장은 직원 화면에 준비 중으로 안내돼요.",
};

export interface RoadmapItem {
  name: string;
  icon: string;
  note?: string;
}

export const ROADMAP: RoadmapItem[] = [
  {
    name: "휴가 신청·사장 승인·잔여일수 차감",
    icon: "ri-plane-line",
    note: "필요하면 증빙 첨부 · 개발·검증 중",
  },
  { name: "매장 공지·확인", icon: "ri-megaphone-line" },
  { name: "인건비 집계·CSV 리포트", icon: "ri-bar-chart-2-line" },
  { name: "여러 매장 통합 비교", icon: "ri-store-2-line" },
];

export const CAPABILITIES = [
  { name: "이메일·비밀번호 로그인", icon: "ri-login-circle-line" },
  { name: "직원 직접 가입·합류 신청·사장님 수락(매장별 조건 설정)", icon: "ri-user-add-line" },
  { name: "중간관리자 권한 위임(근무표·근태·휴가·공지)", icon: "ri-shield-user-line" },
  { name: "출퇴근 및 휴게 기록", icon: "ri-time-line" },
  { name: "매장 QR 출근 화면", icon: "ri-qr-code-line" },
  { name: "사유를 남기는 정정 요청·사장 승인", icon: "ri-edit-2-line" },
  { name: "근무표", icon: "ri-calendar-schedule-line" },
  { name: "입력 수당·공제 기반 급여 합산", icon: "ri-calculator-line" },
  { name: "급여 확정·해제 이력", icon: "ri-history-line" },
  { name: "급여 명세서 출력", icon: "ri-printer-line" },
  { name: "근로계약서 작성·양측 서명·사본 보관", icon: "ri-file-text-line" },
];

export const NOT_INCLUDED = [
  "법정수당 완전 자동산정",
  "공인 인증서·법적 효력 보장",
  "인증메일·비밀번호 찾기·계약 사본 이메일 발송",
  "실제 결제(카드 청구)",
  "급여 송금",
  "세금 신고",
  "카카오 로그인",
  "실시간 GPS 인증",
  "ERP 연동",
];

export const SECURITY_PRINCIPLES = [
  {
    title: "역할 기반 서버 권한 확인",
    body: "사장·매니저·직원 권한에 따라 볼 수 있는 정보를 서버에서 확인해요. 권한이 없는 요청은 통과하지 않아요.",
    icon: "ri-shield-check-line",
  },
  {
    title: "개인별 필요한 정보만",
    body: "직원은 본인 출퇴근·근무표·급여·계약만 보고, 매장 전체 정보는 필요한 역할에만 열려요.",
    icon: "ri-eye-line",
  },
  {
    title: "변경 이력 기록",
    body: "출퇴근 정정, 급여 확정·해제 같은 중요한 변경은 누가 언제 무엇을 바꿨는지 기록으로 남겨요.",
    icon: "ri-history-line",
  },
];

export const CONTACT_FLOW = [
  {
    step: "1",
    title: "사전 체험 시작",
    body: "아래 버튼으로 이동해 화면 먼저 보는 사전 체험을 시작할 수 있어요.",
    icon: "ri-rocket-2-line",
  },
  {
    step: "2",
    title: "화면 먼저 체험",
    body: "로그인 없이 화면을 먼저 눌러 볼 수 있어요. 카드 등록은 필요하지 않아요.",
    icon: "ri-window-line",
  },
  {
    step: "3",
    title: "내 가게 만들기·직원 연결",
    body: "사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일로 가입해 합류를 신청한 뒤 사장님이 수락해 연결해요.",
    icon: "ri-store-3-line",
  },
];

export const TERMS_NOTICE = [
  "척척사장봇은 지금 정식 판매 전 준비 단계이고, 서비스 이용약관은 확정 전이에요.",
  "운영자 정보(사업자 정보)와 정책 세부 내용은 정식 판매 전에 확정해 안내할 예정이에요.",
  "확정 전까지는 어떤 요금도 청구되지 않고, 결제 기능도 없어요.",
];

export const PRIVACY_NOTICE = [
  "개인정보 처리방침은 정식 판매 전 확정 예정이에요.",
  "지금 이 홈페이지는 별도의 개인정보 입력 폼을 운영하지 않아요.",
  "사전 체험은 화면을 먼저 눌러 보는 방식이고, 가게 정보를 저장할 때만 로그인해요.",
];