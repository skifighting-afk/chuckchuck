-- 토스페이먼츠 결제 연결: 결제 종류(요금제·전자계약), 토스 결제 키(환불용), 실패 이유
alter table payments add column if not exists kind text not null default 'plan';
alter table payments add column if not exists payment_key text;
alter table payments add column if not exists fail_reason text;
create index if not exists payments_kind on payments(owner, kind, period_start);
