-- 지시서 10주차: 문의에 추가 질문·추가 답변(대화)과 해결 표시
alter table support_tickets add column if not exists thread text not null default '[]';
