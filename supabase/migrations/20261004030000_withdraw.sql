-- 작업 056: 회원 탈퇴
-- 사장님: 가게 데이터를 내려받은 뒤 탈퇴를 예약하면 30일 뒤 가게 데이터·서류·로그인 계정을 모두 지운다(그 사이 취소 가능).
-- 직원: 가게와의 연결을 끊고 로그인 계정을 바로 지운다. 가게 쪽 근무·급여 기록과 계약서는 사장님의 법정 보존 서류로 남는다.
-- 되돌리기: drop function purge_store(text); drop table account_deletions;
--          payslip_guard()를 init의 원래 내용(항상 예외)으로 되돌리고, purge_expired()를 20261004010000 내용으로 되돌린다.

create table if not exists account_deletions (
  user_id text primary key,
  auth_id text not null,
  requested_at text not null,
  purge_at bigint not null,
  data_purged_at text,
  done_at text
);
alter table account_deletions enable row level security;
revoke all on account_deletions from anon, authenticated;

-- 보낸 명세서는 그대로 바꿀 수 없다. 단, 탈퇴한 가게를 지울 때(purge_store 안)만 삭제를 허용한다.
create or replace function payslip_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.purge_store', true) = 'on' then
    return old;
  end if;
  raise exception 'Sent payslip is immutable';
end $$;

create or replace function purge_store(p_owner text) returns jsonb language plpgsql as $$
declare payslips int; contracts int; evidence int; stores_n int;
begin
  perform set_config('app.purge_store', 'on', true);
  delete from document_activity where (kind = 'payslip' and document_id in (select id from payslip_documents where owner_id = p_owner))
    or (kind = 'contract' and document_id in (select id from contract_envelopes where owner_id = p_owner));
  delete from payslip_documents where owner_id = p_owner; get diagnostics payslips = row_count;
  delete from contract_events where envelope_id in (select id from contract_envelopes where owner_id = p_owner);
  delete from contract_envelopes where owner_id = p_owner; get diagnostics contracts = row_count;
  delete from leave_evidence where owner = p_owner; get diagnostics evidence = row_count;
  delete from stores where owner = p_owner; get diagnostics stores_n = row_count;
  perform set_config('app.purge_store', 'off', true);
  return jsonb_build_object('payslips', payslips, 'contracts', contracts, 'evidence', evidence, 'stores', stores_n);
end $$;
revoke all on function purge_store(text) from public, anon, authenticated;

-- 매일 정리에 '기한이 지난 탈퇴 가게 데이터 삭제'를 더한다. 로그인 계정 삭제는 서버 함수가 이어서 한다.
create or replace function purge_expired() returns jsonb language plpgsql as $$
declare
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  evidence int; limits int; verifications int; withdrawn int := 0; r record;
begin
  delete from leave_evidence where expires_at <= now_iso; get diagnostics evidence = row_count;
  delete from auth_limits where expires_at < now_ms; get diagnostics limits = row_count;
  delete from auth_verifications where expires_at < now_ms; get diagnostics verifications = row_count;
  for r in select user_id from account_deletions where purge_at <= now_ms and data_purged_at is null loop
    perform purge_store(r.user_id);
    update account_deletions set data_purged_at = now_iso where user_id = r.user_id;
    withdrawn := withdrawn + 1;
  end loop;
  return jsonb_build_object('leave_evidence', evidence, 'auth_limits', limits, 'auth_verifications', verifications, 'withdrawn_stores', withdrawn);
end $$;
revoke all on function purge_expired() from public, anon, authenticated;
