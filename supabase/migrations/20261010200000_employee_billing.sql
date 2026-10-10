-- 직원 수 기준 요금(2026-10-10 결정). 결제일 재직 직원 수와 그때 단가를 결제 행에 남긴다.
-- 과거 결제 행은 건드리지 않는다(null 그대로). 기간 중 인원 변화는 추가 청구하지 않는다.
alter table payments add column if not exists billed_employees int;
alter table payments add column if not exists unit_price int;
