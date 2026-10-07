-- 지시서 2주차: 알림 모아보기(131)·알림 고르기(132). 보낸 알림을 사람별로 남기고, 받을 알림 종류를 고른다.
-- 90일이 지난 알림은 매일 작업(/api/cron)이 지운다.
-- 되돌리기: drop table notifications; drop table notification_prefs;
create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  url text not null default '/app',
  created_at text not null,
  read_at text,
  pushed integer not null default 0
);
create index if not exists notifications_user on notifications(user_id, created_at);
alter table notifications enable row level security;
revoke all on notifications from anon, authenticated;
create table if not exists notification_prefs (
  user_id text primary key,
  prefs text not null default '{}',
  updated_at text not null
);
alter table notification_prefs enable row level security;
revoke all on notification_prefs from anon, authenticated;
