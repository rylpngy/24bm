-- 商城货架:租户维护的协议价商品(已准入供应商 + 物料 + 协议单价),支撑目录直购。
create table if not exists mall_listings (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text not null references enterprises(id),
  material_id text not null references materials(id),
  price numeric(14, 2) not null,
  unit text not null default '件',
  status text not null default '在架',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, supplier_id, material_id)
);
create index if not exists idx_mall_listings_tenant_status on mall_listings (tenant_id, status);
