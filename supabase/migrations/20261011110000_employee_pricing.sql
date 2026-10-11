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

alter table payments add column if not exists pricing_version text;
alter table payments add column if not exists pricing_snapshot jsonb;
alter table payments add column if not exists fulfilled_at timestamptz;
