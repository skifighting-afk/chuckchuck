-- 작업 092: 웹 푸시 구독(기기별). 탈퇴·구독 만료(410) 때 지운다.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  p256dh text not null,
  auth text not null,
  created_at text not null
);
create index if not exists push_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;
revoke all on push_subscriptions from anon, authenticated;
