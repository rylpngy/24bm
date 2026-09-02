alter table materials
  add column if not exists government_mall_catalog boolean not null default false;

create index if not exists idx_materials_tenant_government_mall
  on materials (tenant_id, government_mall_catalog);
