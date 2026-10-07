-- 지시서 084: 카카오톡 채널 챗봇(척척 비서) — 카카오 사용자와 척척사장 계정 연결. 연결 코드는 10분 동안만 쓸 수 있다.
-- 되돌리기: drop table kakao_links; drop table kakao_link_codes;
create table if not exists kakao_links (
  kakao_user text primary key,
  user_id text not null,
  created_at text not null default ''
);
create table if not exists kakao_link_codes (
  code text primary key,
  user_id text not null,
  expires_at bigint not null default 0
);
alter table kakao_links enable row level security;
alter table kakao_link_codes enable row level security;
