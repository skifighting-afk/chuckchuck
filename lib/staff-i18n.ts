// 지시서 050: 직원 화면 다국어(주요 버튼·메뉴) — 영어·중국어·베트남어. 번역이 없는 글은 한국어 그대로.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type Lang = 'ko' | 'en' | 'zh' | 'vi';
export const LANGS: [Lang, string][] = [['ko', '한국어'], ['en', 'English'], ['zh', '中文'], ['vi', 'Tiếng Việt']];
const D: Record<string, [string, string, string]> = {
  '오늘': ['Today', '今天', 'Hôm nay'], '근무표': ['Schedule', '排班', 'Lịch làm'], '급여': ['Pay', '工资', 'Lương'], '더보기': ['More', '更多', 'Thêm'],
  '내 계약': ['My contract', '我的合同', 'Hợp đồng'], '휴가·공지': ['Leave & notices', '休假·公告', 'Nghỉ phép & thông báo'], '매뉴얼': ['Manuals', '手册', 'Hướng dẫn'],
  '출근': ['Clock in', '上班打卡', 'Vào ca'], '다시 출근': ['Clock in again', '再次上班', 'Vào ca lại'], '퇴근': ['Clock out', '下班打卡', 'Tan ca'],
  '휴게 시작': ['Start break', '开始休息', 'Bắt đầu nghỉ'], '휴게 끝': ['End break', '结束休息', 'Kết thúc nghỉ'], '휴게 일찍 끝내기': ['End break early', '提前结束休息', 'Nghỉ xong sớm'],
  '매장 QR을 찍으면 기록돼요': ['Scan the store QR to record', '扫描店铺二维码即可记录', 'Quét mã QR của cửa hàng để ghi lại'],
  '이번 주 근무': ['This week', '本周排班', 'Tuần này'], '다음 근무': ['Next shift', '下一班', 'Ca tiếp theo'], '다가오는 근무': ['Upcoming shifts', '即将到来的班次', 'Ca sắp tới'],
  '내 출퇴근 기록': ['My time records', '我的考勤记录', 'Lịch sử chấm công'], '수정 요청': ['Request fix', '申请修改', 'Yêu cầu sửa'], '수정 요청 보내기': ['Send fix request', '发送修改申请', 'Gửi yêu cầu sửa'],
  '대타·교대 구하기': ['Find a cover / swap', '找人代班·换班', 'Tìm người thay ca'], '명세서 내려받기': ['Download payslip', '下载工资单', 'Tải phiếu lương'], '로그아웃': ['Log out', '退出', 'Đăng xuất'], '도움말': ['Help', '帮助', 'Trợ giúp'],
  '근무 중': ['Working', '工作中', 'Đang làm'], '승인 대기': ['Waiting approval', '等待批准', 'Chờ duyệt'], '확인했어요': ['Got it', '已确认', 'Đã xem'], '맡을게요': ["I'll take it", '我来做', 'Tôi nhận'],
  '내 급여 왜 이래요?': ['Why is my pay like this?', '我的工资为什么是这样?', 'Sao lương tôi như vậy?'], '보내기': ['Send', '发送', 'Gửi'], '취소': ['Cancel', '取消', 'Hủy'],
};
let cur: Lang = 'ko';
export const setLang = (l: Lang) => { cur = l; };
export const getLang = () => cur;
export function L(ko: string) { if (cur === 'ko') return ko; const x = D[ko]; return x ? x[cur === 'en' ? 0 : cur === 'zh' ? 1 : 2] : ko; }
export const hasText = (ko: string) => ko in D;
