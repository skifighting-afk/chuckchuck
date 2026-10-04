-- 작업 045: 출퇴근 기록을 가게 데이터(JSON 한 덩어리)에서 별도 테이블로 옮긴다.
-- - attendance_records: 가게(owner)별 출퇴근 한 건 = 한 행. 근로기준법 제42조(3년 보존)를 위해 오래된 기록도 그대로 둔다.
-- - 서버는 최근 기간만 가게 데이터에 붙여(_attendanceFrom 표시와 함께) 화면에 보내고, 저장할 때 이 트리거가
--   attendance 배열을 테이블로 옮긴 뒤 가게 데이터에서는 지운다.
--   · _attendanceFrom 있음: 그 시각 이후 기록만 배열과 맞춘다(배열에 없으면 삭제). 그 전 기록은 건드리지 않는다.
--   · _attendanceFrom 없음 + attendance 있음: 가게 기록 전체를 배열로 바꾼다(처음 이전·가게 생성·테스트 데이터).
--   · attendance 없음: 테이블을 건드리지 않는다(출퇴근과 상관없는 저장).
-- 되돌리기: 가게별로 attendance_records를 data의 attendance 배열로 다시 넣은 뒤
--          drop trigger stores_attendance_sync on stores; drop function stores_attendance_sync(); drop table attendance_records;

create table if not exists attendance_records (
  owner text not null,
  id text not null,
  employee_id text not null,
  start_at text not null,
  record jsonb not null,
  primary key (owner, id)
);
create index if not exists attendance_owner_start on attendance_records(owner, start_at);
alter table attendance_records enable row level security;
revoke all on attendance_records from anon, authenticated;

create or replace function stores_attendance_sync() returns trigger language plpgsql as $$
declare j jsonb; arr jsonb; since text;
begin
  j := try_jsonb(new.data);
  if j is null or not (j ? 'attendance') then return new; end if;
  arr := coalesce(j->'attendance', '[]'::jsonb);
  if jsonb_typeof(arr) <> 'array' then arr := '[]'::jsonb; end if;
  since := j->>'_attendanceFrom';
  -- 배열에 없는 기록 지우기(범위 안에서만)
  delete from attendance_records r
   where r.owner = new.owner
     and (since is null or r.start_at >= since)
     and not exists (select 1 from jsonb_array_elements(arr) e where e->>'id' = r.id);
  -- 새 기록·바뀐 기록 넣기
  insert into attendance_records(owner, id, employee_id, start_at, record)
  select new.owner, e->>'id', coalesce(e->>'employeeId',''), coalesce(e->>'start',''), e
    from jsonb_array_elements(arr) e
   where e->>'id' is not null
  on conflict (owner, id) do update
    set employee_id = excluded.employee_id, start_at = excluded.start_at, record = excluded.record
    where attendance_records.record is distinct from excluded.record;
  new.data := (j - 'attendance' - '_attendanceFrom')::text;
  return new;
end $$;

drop trigger if exists stores_attendance_sync on stores;
create trigger stores_attendance_sync before insert or update of data on stores
  for each row execute function stores_attendance_sync();

-- 기존 가게의 출퇴근 기록을 옮긴다(트리거가 처리).
update stores set data = data where try_jsonb(data) ? 'attendance';

-- 탈퇴 가게를 지울 때 출퇴근 기록도 함께 지운다.
create or replace function purge_store(p_owner text) returns jsonb language plpgsql as $$
declare payslips int; contracts int; evidence int; stores_n int; attendance_n int;
begin
  perform set_config('app.purge_store', 'on', true);
  delete from document_activity where (kind = 'payslip' and document_id in (select id from payslip_documents where owner_id = p_owner))
    or (kind = 'contract' and document_id in (select id from contract_envelopes where owner_id = p_owner));
  delete from payslip_documents where owner_id = p_owner; get diagnostics payslips = row_count;
  delete from contract_events where envelope_id in (select id from contract_envelopes where owner_id = p_owner);
  delete from contract_envelopes where owner_id = p_owner; get diagnostics contracts = row_count;
  delete from leave_evidence where owner = p_owner; get diagnostics evidence = row_count;
  delete from attendance_records where owner = p_owner; get diagnostics attendance_n = row_count;
  delete from stores where owner = p_owner; get diagnostics stores_n = row_count;
  perform set_config('app.purge_store', 'off', true);
  return jsonb_build_object('payslips', payslips, 'contracts', contracts, 'evidence', evidence, 'attendance', attendance_n, 'stores', stores_n);
end $$;
revoke all on function purge_store(text) from public, anon, authenticated;
