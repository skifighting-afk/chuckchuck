-- 지시서 098: 로그인 기록(성공·실패) — 본인 화면 '로그인 기록'에서 본다. 90일 지나면 지운다.
-- 되돌리기: drop table login_events;
create table if not exists login_events (
  id text primary key,
  user_id text not null,
  at text not null,
  ok boolean not null default true,
  device text not null default '',
  ip text not null default ''
);
create index if not exists login_events_user on login_events(user_id, at);
alter table login_events enable row level security;
