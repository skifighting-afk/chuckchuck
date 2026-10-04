-- 작업 057: 가게 대표(소유 계정) 넘기기. 서명·발송한 문서 본문은 그대로 두고 소유 계정만 옮긴다.
-- app.transfer_store='on'일 때만 계약서·명세서의 owner_id 변경을 허용한다(다른 칸은 여전히 바꿀 수 없음).
create or replace function contract_guard() returns trigger language plpgsql as $$
begin
  if (new.employee_id, new.employee_user_id, new.document_json, new.document_hash, new.owner_signature, new.created_at)
     is distinct from (old.employee_id, old.employee_user_id, old.document_json, old.document_hash, old.owner_signature, old.created_at)
     or (new.owner_id is distinct from old.owner_id and coalesce(current_setting('app.transfer_store', true), '') <> 'on') then
    raise exception 'Contract snapshot is immutable';
  end if;
  if old.status = 'signed' and (new.employee_signature, new.status, new.completed_at, new.delivery_method)
     is distinct from (old.employee_signature, old.status, old.completed_at, old.delivery_method) then
    raise exception 'Completed signatures are immutable';
  end if;
  return new;
end $$;

create or replace function payslip_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.purge_store', true) = 'on' then
    return old;
  end if;
  if tg_op = 'UPDATE' and coalesce(current_setting('app.transfer_store', true), '') = 'on'
     and (to_jsonb(new) - 'owner_id') = (to_jsonb(old) - 'owner_id') then
    return new;
  end if;
  raise exception 'Sent payslip is immutable';
end $$;

create or replace function transfer_store(p_from text, p_to text) returns jsonb language plpgsql as $$
declare n int;
begin
  if p_from = p_to then raise exception 'same owner'; end if;
  if exists (select 1 from stores where owner = p_to) then raise exception 'target already owns a store'; end if;
  perform set_config('app.transfer_store', 'on', true);
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
