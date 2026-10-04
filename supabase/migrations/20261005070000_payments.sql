-- 작업 064: 결제 내역·영수증(결제 연결 전 뼈대). 결제 승인은 서버 함수만 기록한다(작업 062·063에서 채움).
-- 탈퇴·대표 변경 때 옮기거나 지우지 않는다: 대금 결제 기록은 전자상거래법상 5년 보관, 결제한 사람(이전 대표) 기준.
create table if not exists payments (
  id text primary key,
  owner text not null,
  order_id text unique not null,
  plan text not null,
  store_slots int not null,
  months int not null,
  amount int not null,           -- 원, VAT 포함
  status text not null,          -- 'paid' | 'cancelled' | 'refunded' | 'failed'
  method text,
  provider text,
  receipt_url text,
  paid_at text,
  period_start text,
  period_end text,
  refunded_amount int not null default 0,
  created_at text not null
);
create index if not exists payments_owner on payments(owner, created_at);
alter table payments enable row level security;
revoke all on payments from anon, authenticated;
