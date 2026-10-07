-- 지시서 108: 한 계정으로 여러 가게 — 지금 보고 있는 가게(사용자별 선택)
-- 되돌리기: drop table user_store_pref;
create table if not exists user_store_pref (
  user_id text primary key,
  owner text not null,
  updated_at text not null
);
alter table user_store_pref enable row level security;
