-- 가이드 44: 서버 오류가 잇달아 나면 본사에 알림. 개인정보 없이 횟수와 마지막 오류 번호만 둔다.
-- 되돌리기: drop table ops_alerts;
create table if not exists ops_alerts (
  key text primary key,
  window_start bigint not null,
  hits int not null,
  last_error text,
  last_sent bigint
);
alter table ops_alerts enable row level security;
revoke all on ops_alerts from anon, authenticated;
