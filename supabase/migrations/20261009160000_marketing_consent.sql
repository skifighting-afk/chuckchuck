-- 출시 준비: 광고성 정보 수신 동의(선택, 정보통신망법 제50조). 비어 있으면 동의 안 함.
-- 되돌리기: alter table app_users drop column marketing_at, drop column marketing_checked_at;
alter table app_users add column if not exists marketing_at text not null default '';
alter table app_users add column if not exists marketing_checked_at text not null default '';
