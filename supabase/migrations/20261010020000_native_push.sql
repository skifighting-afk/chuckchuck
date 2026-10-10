-- 스토어 앱(안드로이드 FCM·아이폰 APNs) 알림 기기 토큰
create table if not exists native_push_tokens (
  token text primary key,
  user_id text not null,
  platform text not null,          -- 'ios' | 'android'
  created_at text not null
);
create index if not exists native_push_user on native_push_tokens(user_id);
alter table native_push_tokens enable row level security;
revoke all on native_push_tokens from anon, authenticated;
