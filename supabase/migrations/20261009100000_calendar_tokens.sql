-- 지시서 086: 내 근무를 폰 달력에 구독(직원별 비밀 주소). 주소 원문은 저장하지 않고 해시만 둔다.
-- 되돌리기: drop table calendar_tokens;
create table if not exists calendar_tokens (
  token_hash text primary key,
  owner text not null,
  employee_id text not null,
  created_at text not null default ''
);
create index if not exists calendar_tokens_emp on calendar_tokens(owner, employee_id);
alter table calendar_tokens enable row level security;
