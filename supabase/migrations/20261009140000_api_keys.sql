-- 지시서 090: 오픈 API — 가게별 읽기 전용 API 키(원문은 저장하지 않고 해시만).
-- 되돌리기: drop table api_keys;
create table if not exists api_keys (
  key_hash text primary key,
  owner text not null,
  label text not null default '',
  prefix text not null default '',
  created_at text not null default '',
  last_used_at text not null default ''
);
create index if not exists api_keys_owner on api_keys(owner);
alter table api_keys enable row level security;
