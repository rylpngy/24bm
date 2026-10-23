create table invoice_payment_entries (
  id text primary key,
  tenant_id text not null references tenants(id),
  invoice_id text not null references invoices(id),
  idempotency_key varchar(100) not null,
  amount numeric(14,2) not null check (amount <> 0),
  milestone_id text,
  evidence_no varchar(200) not null,
  remark varchar(1000) not null default '',
  reversal_of text references invoice_payment_entries(id),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, invoice_id, idempotency_key),
  unique (tenant_id, reversal_of),
  check ((amount > 0 and reversal_of is null) or (amount < 0 and reversal_of is not null))
);
create index idx_payment_entries_invoice on invoice_payment_entries(tenant_id,invoice_id,created_at);

create table contract_payment_allocations (
  id text primary key,
  tenant_id text not null references tenants(id),
  entry_id text not null references invoice_payment_entries(id),
  milestone_id text not null references contract_payment_milestones(id),
  amount numeric(14,2) not null check (amount <> 0),
  unique (tenant_id,entry_id,milestone_id)
);
create index idx_contract_allocations_milestone on contract_payment_allocations(tenant_id,milestone_id);
