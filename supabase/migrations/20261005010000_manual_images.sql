-- 매장 매뉴얼 사진(사장님이 올린 단계별 사진). 본문은 stores.data._manuals에 둔다.
create table if not exists store_manual_images (
  owner text not null,
  id text not null,
  mime text not null,
  body text not null,
  bytes integer not null,
  created_at text not null,
  primary key (owner, id)
);
alter table store_manual_images enable row level security;
revoke all on store_manual_images from anon, authenticated;

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
  delete from stores where owner = p_owner; get diagnostics stores_n = row_count;
  perform set_config('app.purge_store', 'off', true);
  return jsonb_build_object('payslips', payslips, 'contracts', contracts, 'evidence', evidence, 'attendance', attendance_n, 'manualImages', manual_n, 'stores', stores_n);
end $$;
revoke all on function purge_store(text) from public, anon, authenticated;
