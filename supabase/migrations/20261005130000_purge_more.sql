-- 개인정보 처리방침 3항(보관 기간과 파기)과 맞추기: 매일 정리(purge_expired)에 기간이 지난 기록 삭제를 더한다.
-- 문의·비밀번호 찾기 요청 3년, 본사 접근 기록 1년, 결제 기록 5년, 세무사 링크는 끝난 뒤 30일.
-- 되돌리기: 20261004030000_withdraw.sql의 purge_expired를 다시 실행.
create or replace function purge_expired() returns jsonb language plpgsql as $$
declare
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  evidence int; limits int; verifications int; withdrawn int := 0; tickets int; hqlog int; pays int; shares int; r record;
begin
  delete from leave_evidence where expires_at <= now_iso; get diagnostics evidence = row_count;
  delete from auth_limits where expires_at < now_ms; get diagnostics limits = row_count;
  delete from auth_verifications where expires_at < now_ms; get diagnostics verifications = row_count;
  for r in select user_id from account_deletions where purge_at <= now_ms and data_purged_at is null loop
    perform purge_store(r.user_id);
    update account_deletions set data_purged_at = now_iso where user_id = r.user_id;
    withdrawn := withdrawn + 1;
  end loop;
  delete from support_tickets where created_at < to_char((now() - interval '3 years') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); get diagnostics tickets = row_count;
  delete from hq_access_log where at < to_char((now() - interval '1 year') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); get diagnostics hqlog = row_count;
  delete from payments where coalesce(paid_at, created_at) < to_char((now() - interval '5 years') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); get diagnostics pays = row_count;
  delete from accountant_shares where expires_at < to_char((now() - interval '30 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); get diagnostics shares = row_count;
  return jsonb_build_object('leave_evidence', evidence, 'auth_limits', limits, 'auth_verifications', verifications, 'withdrawn_stores', withdrawn,
    'support_tickets', tickets, 'hq_access_log', hqlog, 'payments', pays, 'accountant_shares', shares);
end $$;
revoke all on function purge_expired() from public, anon, authenticated;
