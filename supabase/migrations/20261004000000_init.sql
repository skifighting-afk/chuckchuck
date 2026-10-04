-- 척척사장봇 초기 스키마 (Cloudflare D1 0000~0004 → Supabase Postgres)
-- 모든 접근은 Edge Function `api`가 DB 연결로 처리한다. 브라우저(anon/authenticated)는 테이블에 직접 접근할 수 없다.

create table stores (
  owner text primary key,
  data text not null,
  version integer not null,
  updated_at text not null
);

create table leave_evidence (
  id text primary key,
  owner text not null,
  leave_id text not null,
  employee_id text not null,
  mime text not null,
  body text not null,
  bytes integer not null,
  created_at text not null,
  expires_at text not null
);
create index evidence_owner_leave on leave_evidence(owner, leave_id);

-- 로그인 자체는 Supabase Auth가 맡고, 앱에서 쓰는 이름·역할·이메일 확인 여부만 여기 둔다.
-- id는 'native:' + auth.users.id
create table app_users (
  id text primary key,
  auth_id uuid unique not null,
  email text unique not null,
  name text not null,
  role text not null check (role in ('owner','employee')),
  email_verified integer not null default 0,
  created_at bigint not null
);

create table auth_limits (
  bucket text primary key,
  hits integer not null,
  expires_at bigint not null
);

create table auth_verifications (
  token_hash text primary key,
  user_id text not null references app_users(id) on delete cascade,
  email text not null,
  expires_at bigint not null,
  created_at bigint not null
);
create index auth_verifications_user on auth_verifications(user_id);

create table contract_envelopes (
  id text primary key,
  owner_id text not null,
  employee_id text not null,
  employee_user_id text not null,
  document_json text not null,
  document_hash text not null,
  owner_signature text not null,
  employee_signature text,
  status text not null check (status in ('waiting','signed','declined','withdrawn')),
  version integer not null default 1,
  created_at text not null,
  completed_at text,
  reason text not null default '',
  delivery_method text,
  delivery_status text not null default 'not_ready',
  delivery_provider_id text,
  delivery_at text,
  received_at text,
  received_by text
);
create index contract_owner on contract_envelopes(owner_id, created_at);
create index contract_employee on contract_envelopes(employee_user_id, created_at);
create unique index contract_waiting on contract_envelopes(owner_id, employee_id) where status = 'waiting';

create table contract_events (
  id bigserial primary key,
  envelope_id text not null,
  version integer not null,
  status text not null,
  recorded_at text not null,
  record_json text not null
);

create function contract_guard() returns trigger language plpgsql as $$
begin
  if (new.owner_id, new.employee_id, new.employee_user_id, new.document_json, new.document_hash, new.owner_signature, new.created_at)
     is distinct from (old.owner_id, old.employee_id, old.employee_user_id, old.document_json, old.document_hash, old.owner_signature, old.created_at) then
    raise exception 'Contract snapshot is immutable';
  end if;
  if old.status = 'signed' and (new.employee_signature, new.status, new.completed_at, new.delivery_method)
     is distinct from (old.employee_signature, old.status, old.completed_at, old.delivery_method) then
    raise exception 'Completed signatures are immutable';
  end if;
  return new;
end $$;
create trigger contract_immutable before update on contract_envelopes for each row execute function contract_guard();

create function contract_log() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into contract_events(envelope_id, version, status, recorded_at, record_json)
    values (new.id, new.version, new.status, new.created_at,
            json_build_object('hash', new.document_hash, 'ownerSignature', new.owner_signature)::text);
  else
    insert into contract_events(envelope_id, version, status, recorded_at, record_json)
    values (new.id, new.version, new.status, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            json_build_object('hash', new.document_hash, 'employeeSignature', new.employee_signature, 'reason', new.reason,
              'deliveryMethod', new.delivery_method, 'deliveryStatus', new.delivery_status, 'providerId', new.delivery_provider_id,
              'deliveryAt', new.delivery_at, 'receivedAt', new.received_at, 'receivedBy', new.received_by)::text);
  end if;
  return new;
end $$;
create trigger contract_event_log after insert or update on contract_envelopes for each row execute function contract_log();

create table document_activity (
  kind text not null,
  document_id text not null,
  viewed_at text,
  download_requested_at text,
  saved_at text,
  primary key (kind, document_id)
);

create table payslip_documents (
  id text primary key,
  owner_id text not null,
  employee_id text not null,
  employee_user_id text not null,
  run_key text not null,
  revision integer not null,
  document_json text not null,
  created_at text not null,
  unique (owner_id, employee_id, run_key, revision)
);
create index payslip_recipient on payslip_documents(employee_user_id, created_at);

create function payslip_guard() returns trigger language plpgsql as $$
begin
  raise exception 'Sent payslip is immutable';
end $$;
create trigger immutable_payslip before update or delete on payslip_documents for each row execute function payslip_guard();

-- 직접 접근 차단: RLS를 켜고 정책을 두지 않는다.
do $$
declare t text;
begin
  foreach t in array array['stores','leave_evidence','app_users','auth_limits','auth_verifications','contract_envelopes','contract_events','document_activity','payslip_documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence contract_events_id_seq from anon, authenticated;

-- 깨진 JSON이 있어도 본사 집계가 멈추지 않도록 안전하게 변환한다.
create function try_jsonb(t text) returns jsonb language plpgsql immutable as $$
begin
  return t::jsonb;
exception when others then
  return null;
end $$;
