create table tender_scoring_rules (
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id),
  revision integer not null check (revision > 0),
  technical_weight numeric(5,2) not null check (technical_weight between 0 and 100),
  commercial_weight numeric(5,2) not null check (commercial_weight between 0 and 100),
  price_weight numeric(5,2) not null check (price_weight between 0 and 100),
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  primary key(tenant_id,tender_id,revision),
  check (technical_weight + commercial_weight + price_weight = 100)
);
