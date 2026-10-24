alter table order_line_items add column source_sku_id text references mall_skus(id);
create index idx_order_lines_source_sku on order_line_items(source_sku_id) where source_sku_id is not null;

create table mall_purchase_controls (
  tenant_id text primary key references tenants(id),
  max_checkout_amount numeric(14,2) check (max_checkout_amount > 0),
  category_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(category_ids)='array'),
  require_address boolean not null default false,
  updated_by text references users(id),
  updated_at timestamptz not null default now()
);

create table mall_checkout_attempts (
  tenant_id text not null references tenants(id),
  user_id text not null references users(id),
  idempotency_key text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key(tenant_id,user_id,idempotency_key)
);
-- Historical order/SKU relationships and checkout outcomes are not inferred.

create table mall_order_checkout_notes (
  order_id text primary key references purchase_orders(id),
  tenant_id text not null references tenants(id),
  remark text not null check (char_length(remark) <= 2000)
);
