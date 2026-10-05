-- 가이드 97: 앱 안 문의하기. 회원이 쓴 문의와 본사 답변. 전자상거래법상 소비자 불만·분쟁 처리 기록은 3년 보관.
-- 되돌리기: drop table support_tickets;
create table if not exists support_tickets (
  id text primary key,
  user_id text not null,
  store_owner text,
  role text not null,
  category text not null,
  body text not null,
  status text not null default '접수',
  reply text,
  created_at text not null,
  replied_at text
);
create index if not exists support_user on support_tickets(user_id, created_at);
create index if not exists support_open on support_tickets(status, created_at);
alter table support_tickets enable row level security;
revoke all on support_tickets from anon, authenticated;
