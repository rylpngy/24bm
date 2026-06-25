-- 合同付款计划:按里程碑(预付/验收/质保等)拆分合同金额,逐里程碑登记付款。
-- 各里程碑金额合计 = 合同金额;状态 待付 →(登记付款)→ 已付。
create table contract_payment_milestones (
  id text primary key,
  tenant_id text not null references tenants(id),
  contract_id text not null references contracts(id) on delete cascade,
  name text not null,
  percent integer not null,
  amount numeric(14, 2) not null,
  status text not null default '待付',
  sort_no integer not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_contract_milestones_contract on contract_payment_milestones (tenant_id, contract_id, sort_no);
