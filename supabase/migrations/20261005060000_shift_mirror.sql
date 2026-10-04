-- 작업 081 1단계: 근무표를 별도 테이블에 '그림자 복사'한다. 아직 원본은 가게 데이터(JSON)의 shifts이고,
-- 저장할 때마다 shift_records를 같게 맞춘다. 2단계에서 읽기를 이 테이블로 옮기기 전에 차이가 없는지 확인하는 용도.
-- 되돌리기: drop trigger stores_shift_mirror on stores; drop function stores_shift_mirror(); drop function shift_mirror_drift(text); drop table shift_records;
create table if not exists shift_records (
  owner text not null,
  id text not null,
  employee_id text not null,
  date text collate "C" not null,
  record jsonb not null,
  primary key (owner, id)
);
create index if not exists shift_owner_date on shift_records(owner, date);
alter table shift_records enable row level security;
revoke all on shift_records from anon, authenticated;

create or replace function stores_shift_mirror() returns trigger language plpgsql as $$
declare arr jsonb;
begin
  arr := try_jsonb(new.data)->'shifts';
  if arr is null or jsonb_typeof(arr) <> 'array' then return null; end if;
  if tg_op = 'UPDATE' and (try_jsonb(old.data)->'shifts') is not distinct from arr and old.owner = new.owner then return null; end if;
  delete from shift_records r where r.owner = new.owner and not exists (select 1 from jsonb_array_elements(arr) e where e->>'id' = r.id);
  insert into shift_records(owner, id, employee_id, date, record)
  select new.owner, e->>'id', coalesce(e->>'employeeId',''), coalesce(e->>'date',''), e from jsonb_array_elements(arr) e where e->>'id' is not null
  on conflict (owner, id) do update set employee_id = excluded.employee_id, date = excluded.date, record = excluded.record
    where shift_records.record is distinct from excluded.record;
  return null;
end $$;
drop trigger if exists stores_shift_mirror on stores;
create trigger stores_shift_mirror after insert or update on stores for each row execute function stores_shift_mirror();

-- 가게 데이터와 그림자 테이블의 차이(0이면 같음)
create or replace function shift_mirror_drift(p_owner text) returns int language sql stable as $$
  with j as (select coalesce(try_jsonb(data)->'shifts','[]'::jsonb) a from stores where owner = p_owner),
       e as (select x from j, jsonb_array_elements(j.a) x)
  select ((select count(*) from e where not exists (select 1 from shift_records r where r.owner = p_owner and r.id = e.x->>'id' and r.record = e.x))
        + (select count(*) from shift_records r where r.owner = p_owner and not exists (select 1 from e where e.x->>'id' = r.id)))::int;
$$;
revoke all on function shift_mirror_drift(text) from public, anon, authenticated;

-- 기존 가게 채우기
insert into shift_records(owner, id, employee_id, date, record)
select s.owner, e->>'id', coalesce(e->>'employeeId',''), coalesce(e->>'date',''), e
  from stores s, jsonb_array_elements(case when jsonb_typeof(try_jsonb(s.data)->'shifts')='array' then try_jsonb(s.data)->'shifts' else '[]'::jsonb end) e
 where e->>'id' is not null
on conflict do nothing;

-- 대표 변경·탈퇴 삭제도 그림자 테이블을 같이 처리
create or replace function transfer_store(p_from text, p_to text) returns jsonb language plpgsql as $$
declare n int;
begin
  if p_from = p_to then raise exception 'same owner'; end if;
  if exists (select 1 from stores where owner = p_to) then raise exception 'target already owns a store'; end if;
  perform set_config('app.transfer_store', 'on', true);
  delete from shift_records where owner = p_from;
  update stores set owner = p_to where owner = p_from; get diagnostics n = row_count;
  if n <> 1 then raise exception 'store not found'; end if;
  update contract_envelopes set owner_id = p_to where owner_id = p_from;
  update payslip_documents set owner_id = p_to where owner_id = p_from;
  update leave_evidence set owner = p_to where owner = p_from;
  update attendance_records set owner = p_to where owner = p_from;
  update store_manual_images set owner = p_to where owner = p_from;
  perform set_config('app.transfer_store', 'off', true);
  return jsonb_build_object('stores', n);
end $$;
revoke all on function transfer_store(text, text) from public, anon, authenticated;

create or replace function purge_store(p_owner text) returns jsonb language plpgsql as $$
declare payslips int; contracts int; evidence int; stores_n int; attendance_n int; manual_n int;
begin
  perform set_config('app.purge_store', 'on', true);
  delete from document_activity where (kind = 'payslip' and document_id in (select id from payslip_documents where owner_id = p_owner))
    or (kind = 'contract' and document_id in (select id from contract_envelopes where owner_id = p_owner));
  delete from payslip_documents where owner_id = p_owner; get diagnostics payslips = row_count;
  delete from contract_events where envelope_id in (select id from contract_envelopes where owner_id = p_owner);
  delete from contract_envelopes where owner_id = p_owner; get diagnostics contracts = row_count;
  delete from leave_evidence where owner = p_owner; get diagnostics evidence = row_count;
  delete from attendance_records where owner = p_owner; get diagnostics attendance_n = row_count;
  delete from store_manual_images where owner = p_owner; get diagnostics manual_n = row_count;
  delete from shift_records where owner = p_owner;
  delete from stores where owner = p_owner; get diagnostics stores_n = row_count;
  perform set_config('app.purge_store', 'off', true);
  return jsonb_build_object('payslips', payslips, 'contracts', contracts, 'evidence', evidence, 'attendance', attendance_n, 'manualImages', manual_n, 'stores', stores_n);
end $$;
revoke all on function purge_store(text) from public, anon, authenticated;
