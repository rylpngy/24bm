-- 邀请管理:采购方向供应商发起的独立邀请单(注册 / 补资料 / 入私域)。
-- 状态机:待回复 → 已接受 / 已拒绝 / 已撤回;接受且关联已知供应商时桥接为私域待准入。
create table supplier_invitations (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text references enterprises(id),
  supplier_name text not null,
  contact text,
  category text,
  note text,
  status text not null default '待回复',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create index idx_supplier_invitations_tenant on supplier_invitations (tenant_id, status);
