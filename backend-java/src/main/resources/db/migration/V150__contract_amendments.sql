-- 合同变更/补充协议:对已生效合同的金额/工期/条款/范围变更留痕(按序号),
-- 金额/工期变更可应用到主合同。配合 contracts 表的 amount / expiry_date。
create table contract_amendments (
  id text primary key,
  tenant_id text not null references tenants(id),
  contract_id text not null references contracts(id) on delete cascade,
  seq integer not null,
  change_type text not null,
  old_amount numeric(14, 2),
  new_amount numeric(14, 2),
  old_expiry_date date,
  new_expiry_date date,
  reason text not null,
  actor_id text not null references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, contract_id, seq)
);

create index idx_contract_amendments_contract
  on contract_amendments (tenant_id, contract_id, seq desc);
