-- 개선 2차 B196·B198: 화면 오류·느린 요청(개인정보를 지운 글만, 14일 보관)
create table if not exists client_errors (
  id bigserial primary key,
  kind text not null default 'error',
  message text not null,
  path text not null default '',
  at text collate "C" not null
);
create index if not exists client_errors_at on client_errors(at);
alter table client_errors enable row level security;
revoke all on client_errors from anon, authenticated;
revoke all on sequence client_errors_id_seq from anon, authenticated;
