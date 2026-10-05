-- 메일 없이 비밀번호 찾기: 사장님(직원)·본사(사장님)가 임시 비밀번호를 만들면, 다음 로그인 때 새 비밀번호로 바꾸게 한다.
-- 되돌리기: alter table app_users drop column must_change_password;
alter table app_users add column if not exists must_change_password integer not null default 0;
