-- 지시서 098: 2단계 인증(인증 앱). 켠 사람만 쓰고, 기본값은 꺼짐.
-- 되돌리기: alter table app_users drop column totp_secret, drop column totp_enabled, drop column totp_backup, drop column totp_step; drop table mfa_sessions;
alter table app_users add column if not exists totp_secret text not null default '';
alter table app_users add column if not exists totp_enabled boolean not null default false;
alter table app_users add column if not exists totp_backup text not null default '[]';
alter table app_users add column if not exists totp_step bigint not null default -1;
create table if not exists mfa_sessions (
  session_key text primary key,
  user_id text not null,
  created_at text not null default ''
);
create index if not exists mfa_sessions_user on mfa_sessions(user_id);
alter table mfa_sessions enable row level security;
