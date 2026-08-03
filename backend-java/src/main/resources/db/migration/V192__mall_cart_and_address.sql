-- 商城购物车与收货地址(M-2)。
--
-- 购物车按「租户 + 下单人」维度存服务端:换设备、刷新页面都不丢;
-- 行以 SKU 为准,价格不落库——结算时由服务端按当时的阶梯价重算,
-- 避免加购时的价格被当成成交价。

create table if not exists mall_carts (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists mall_cart_items (
  id text primary key,
  cart_id text not null references mall_carts(id) on delete cascade,
  sku_id text not null references mall_skus(id) on delete cascade,
  quantity numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, sku_id)
);
create index if not exists idx_mall_cart_items_cart on mall_cart_items (cart_id);

create table if not exists mall_addresses (
  id text primary key,
  tenant_id text not null references tenants(id),
  receiver text not null,
  phone text not null,
  province text not null default '',
  city text not null default '',
  district text not null default '',
  detail text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mall_addresses_tenant on mall_addresses (tenant_id, is_default desc);
