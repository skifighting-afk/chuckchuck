-- 작업 073: 본사 계정이 고객 가게 정보를 볼 때마다 남기는 기록(1년 보관)
create table if not exists hq_access_log (
  id bigserial primary key,
  at text not null,
  actor text not null,
  action text not null,
  target text,
  detail jsonb
);
create index if not exists hq_access_log_at on hq_access_log(at);
alter table hq_access_log enable row level security;
revoke all on hq_access_log from anon, authenticated;
