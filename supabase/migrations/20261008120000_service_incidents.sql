-- 지시서 148: 장애·점검 공지(본사가 올리고 닫는다). 모든 화면 위에 띄운다.
-- 되돌리기: drop table service_incidents;
create table if not exists service_incidents (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null,
  started_at text not null,
  ended_at text,
  created_by text not null
);
alter table service_incidents enable row level security;
