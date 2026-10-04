-- 작업 056: 사장님이 마지막으로 가게 데이터를 내려받은 시각. 탈퇴 예약 전에 확인한다.
-- 되돌리기: alter table app_users drop column last_export_at;
alter table app_users add column if not exists last_export_at text;
