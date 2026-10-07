-- 지시서 147: 매주 자동 백업(가게별 최근 4주). 사장님이 설정에서 그 주 파일을 내려받는다.
-- 되돌리기: drop table store_backups;
create table if not exists store_backups (
  owner text not null,
  week text not null,
  data text not null,
  bytes integer not null,
  created_at text not null,
  primary key (owner, week)
);
alter table store_backups enable row level security;
