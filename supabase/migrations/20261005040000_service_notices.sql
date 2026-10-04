-- 작업 066: 가격 인상·약관 변경 30일 전 고지와 사장님 동의 기록
create table if not exists service_notices (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null,
  effective_at text not null,
  created_at text not null,
  created_by text not null
);
create table if not exists service_notice_consents (
  notice_id text not null references service_notices(id) on delete cascade,
  user_id text not null,
  agreed_at text not null,
  primary key (notice_id, user_id)
);
alter table service_notices enable row level security;
alter table service_notice_consents enable row level security;
revoke all on service_notices from anon, authenticated;
revoke all on service_notice_consents from anon, authenticated;
