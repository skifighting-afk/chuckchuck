-- 작업 016: 약관·개인정보 처리방침 동의 기록(어느 판에 언제 동의했는지)
-- 되돌리기: alter table app_users drop column terms_version, drop column privacy_version, drop column consented_at;
alter table app_users add column if not exists terms_version text;
alter table app_users add column if not exists privacy_version text;
alter table app_users add column if not exists consented_at text;
