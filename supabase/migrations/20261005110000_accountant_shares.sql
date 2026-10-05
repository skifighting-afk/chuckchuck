-- 가이드 68: 세무사에게 보내는 읽기 전용 급여 자료 링크(7일, 언제든 끄기, 열람 기록).
-- 되돌리기: drop table accountant_shares;
create table if not exists accountant_shares (
  hash text primary key,
  owner text not null,
  run_key text not null,
  label text not null,
  created_at text not null,
  expires_at text not null,
  revoked_at text,
  views jsonb not null default '[]'::jsonb
);
create index if not exists accountant_shares_owner on accountant_shares(owner, created_at);
alter table accountant_shares enable row level security;
revoke all on accountant_shares from anon, authenticated;
