-- 작업 082: 직원 계정 → 가게 찾기, 가게 코드·가입 신청 찾기를 가게 수와 상관없이 빠르게.
-- 측정(가게 3,000곳, 로컬 Postgres): 직원 계정 찾기 340ms → 0.6ms, 가게 코드 찾기 325ms → 0.7ms.
create index if not exists stores_members_gin on stores using gin ((try_jsonb(data)->'_members') jsonb_path_ops);
create index if not exists stores_joincodes_gin on stores using gin ((try_jsonb(data)->'_joinCodes') jsonb_path_ops);
create index if not exists stores_joinapps_gin on stores using gin ((try_jsonb(data)->'_joinApplications') jsonb_path_ops);
create index if not exists stores_transfer_email on stores ((lower(try_jsonb(data)#>>'{_account,transfer,toEmail}')));
analyze stores;
