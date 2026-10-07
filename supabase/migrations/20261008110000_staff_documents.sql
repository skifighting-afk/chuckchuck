-- 지시서 5주차 041: 직원 서류 보관함(보건증·통장 사본 등 사진). 퇴사 3년 뒤 지울 수 있게 직원별로 둔다.
-- 되돌리기: drop table staff_documents;
create table if not exists staff_documents (
  owner text not null,
  id text not null,
  employee_id text not null,
  kind text not null,
  mime text not null,
  body text not null,
  bytes integer not null,
  uploaded_by text not null,
  created_at text not null,
  primary key (owner, id)
);
create index if not exists staff_documents_emp on staff_documents(owner, employee_id);
alter table staff_documents enable row level security;
