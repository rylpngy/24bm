create table contract_fulfillment_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  contract_id text not null references contracts(id),
  action_type text not null,
  target_id text not null,
  summary text not null,
  source_label text not null,
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_fulfillment_events_contract
  on contract_fulfillment_events (tenant_id, contract_id, created_at desc);

create index if not exists idx_contract_fulfillment_events_target
  on contract_fulfillment_events (tenant_id, action_type, target_id);
