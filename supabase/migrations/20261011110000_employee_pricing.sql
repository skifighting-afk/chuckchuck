-- Versioned quotes and immutable payment pricing; legacy records stay unchanged.
create table if not exists billing_quotes (
  id text primary key,
  owner text not null references stores(owner) on update cascade on delete cascade,
  pricing_version text not null,
  snapshot jsonb not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  order_id text unique,
  check (expires_at > created_at)
);
create index if not exists billing_quotes_owner on billing_quotes(owner, created_at);
alter table billing_quotes enable row level security;
revoke all on billing_quotes from anon, authenticated;
alter table billing_quotes add column if not exists context jsonb not null default '{}'::jsonb;

alter table payments add column if not exists pricing_version text;
alter table payments add column if not exists pricing_snapshot jsonb;
alter table payments add column if not exists fulfilled_at timestamptz;

create table if not exists payment_refunds (
  id text primary key,
  order_id text not null references payments(order_id),
  amount int not null check (amount > 0),
  previous_refunded int not null,
  reason text not null,
  status text not null,
  created_at timestamptz not null,
  completed_at timestamptz
);
create unique index if not exists payment_refunds_pending on payment_refunds(order_id) where status='pending';
alter table payment_refunds enable row level security;
revoke all on payment_refunds from anon, authenticated;
