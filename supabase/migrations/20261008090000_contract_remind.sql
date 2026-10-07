-- 지시서 9주차: 서명 대기 계약서 다시 알림(마지막으로 알린 때)
alter table contract_envelopes add column if not exists reminded_at text;
