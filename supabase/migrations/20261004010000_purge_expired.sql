-- 작업 072: 보관 기간이 지난 데이터를 매일 지운다.
-- - 휴가 증빙 파일: 제출 후 30일(leave_evidence.expires_at, ISO 문자열)
-- - 로그인 시도 제한 기록, 이메일 확인 링크: 만료 시각(밀리초 epoch)
-- 되돌리기: select cron.unschedule('purge-expired'); drop function purge_expired();

create or replace function purge_expired() returns jsonb language plpgsql as $$
declare
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  evidence int; limits int; verifications int;
begin
  delete from leave_evidence where expires_at <= now_iso; get diagnostics evidence = row_count;
  delete from auth_limits where expires_at < now_ms; get diagnostics limits = row_count;
  delete from auth_verifications where expires_at < now_ms; get diagnostics verifications = row_count;
  return jsonb_build_object('leave_evidence', evidence, 'auth_limits', limits, 'auth_verifications', verifications);
end $$;
revoke all on function purge_expired() from public, anon, authenticated;

-- Supabase에서는 pg_cron으로 매일 18:15 UTC(한국 시간 새벽 3시 15분)에 실행한다.
-- pg_cron이 없는 곳(로컬 테스트용 Postgres)에서는 건너뛴다.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired';
    perform cron.schedule('purge-expired', '15 18 * * *', 'select purge_expired()');
  end if;
end $$;
