-- 지시서 020: 키오스크 모드 — 매장 태블릿 1대에 로그인 없이 띄우는 주소(지점별). 원문은 저장하지 않고 해시만.
-- 되돌리기: drop table kiosk_tokens;
create table if not exists kiosk_tokens (
  token_hash text primary key,
  owner text not null,
  branch_id text not null,
  created_at text not null default ''
);
create index if not exists kiosk_tokens_owner on kiosk_tokens(owner, branch_id);
alter table kiosk_tokens enable row level security;
