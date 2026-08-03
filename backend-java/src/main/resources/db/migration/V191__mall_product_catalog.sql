-- 商城商品域(M-1):把「物料直挂价」升级为 商品聚合 + 多规格 SKU。
--
-- 私域与公开专区靠 mall_products.scope 区分:
--   tenant 私域协议价——价格按租户隔离,仅本租户可见可买(延续既有语义);
--   public 平台标准品——统一定价,已认证买家均可购买。
-- SKU 保留 material_id 映射,订单与对账仍按物料主数据口径走,不断链。

create table if not exists mall_categories (
  id text primary key,
  -- 空=平台级标准分类;非空=租户自建分类。
  tenant_id text references tenants(id),
  parent_id text references mall_categories(id),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_mall_categories_tenant on mall_categories (tenant_id, parent_id);

create table if not exists mall_products (
  id text primary key,
  scope text not null default 'tenant' check (scope in ('tenant', 'public')),
  -- 公开专区商品无归属租户;私域商品必须有。约束见下方 check。
  tenant_id text references tenants(id),
  supplier_id text not null references enterprises(id),
  category_id text references mall_categories(id),
  name text not null,
  brand text not null default '',
  description_html text not null default '',
  main_image_key text,
  status text not null default '在架'
    check (status in ('草稿', '待审核', '在架', '下架')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mall_products_scope_tenant check (
    (scope = 'tenant' and tenant_id is not null)
    or (scope = 'public' and tenant_id is null)
  )
);
create index if not exists idx_mall_products_tenant_status on mall_products (tenant_id, status);
create index if not exists idx_mall_products_scope_status on mall_products (scope, status);

create table if not exists mall_skus (
  id text primary key,
  product_id text not null references mall_products(id) on delete cascade,
  sku_code text not null default '',
  -- 规格键值(如 {"颜色":"黑","容量":"512G"});单规格商品为空对象。
  spec jsonb not null default '{}'::jsonb,
  material_id text references materials(id),
  unit text not null default '件',
  price numeric(14, 2) not null,
  min_order_qty numeric(14, 2) not null default 1,
  step_qty numeric(14, 2) not null default 1,
  -- 空=不限量(服务类商品);非空则下单校验并扣减。
  stock_qty numeric(14, 2),
  lead_time_days integer not null default 7,
  status text not null default '在架' check (status in ('在架', '下架')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mall_skus_product on mall_skus (product_id, status);

-- 阶梯价:达到 min_qty 即适用该单价;服务端按结算数量重算,不信任前端传价。
create table if not exists mall_sku_tier_prices (
  sku_id text not null references mall_skus(id) on delete cascade,
  min_qty numeric(14, 2) not null,
  price numeric(14, 2) not null,
  primary key (sku_id, min_qty)
);

create table if not exists mall_product_media (
  id text primary key,
  product_id text not null references mall_products(id) on delete cascade,
  storage_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_mall_product_media_product on mall_product_media (product_id, sort_order);

-- 存量迁移:一条 mall_listings → 一个单 SKU 的私域商品。
-- 订单只存行项快照(名称/单位/数量/单价)不外键 listing,故历史订单与对账不受影响。
insert into mall_products (id, scope, tenant_id, supplier_id, name, status, created_at, updated_at)
select
  'mp-' || l.id,
  'tenant',
  l.tenant_id,
  l.supplier_id,
  m.name,
  case when l.status = '在架' then '在架' else '下架' end,
  l.created_at,
  l.updated_at
from mall_listings l
join materials m on m.id = l.material_id
on conflict (id) do nothing;

insert into mall_skus (
  id, product_id, sku_code, material_id, unit, price, lead_time_days, status, created_at, updated_at)
select
  'ms-' || l.id,
  'mp-' || l.id,
  m.code,
  l.material_id,
  l.unit,
  l.price,
  7,
  case when l.status = '在架' then '在架' else '下架' end,
  l.created_at,
  l.updated_at
from mall_listings l
join materials m on m.id = l.material_id
on conflict (id) do nothing;

-- 分类:沿用物料分类名建租户级分类并回挂,保持货架的分类浏览可用。
insert into mall_categories (id, tenant_id, name)
select distinct
  'mc-' || l.tenant_id || '-' || md5(m.category),
  l.tenant_id,
  m.category
from mall_listings l
join materials m on m.id = l.material_id
where coalesce(m.category, '') <> ''
on conflict (id) do nothing;

update mall_products p
set category_id = 'mc-' || p.tenant_id || '-' || md5(m.category)
from mall_listings l
join materials m on m.id = l.material_id
where p.id = 'mp-' || l.id
  and coalesce(m.category, '') <> ''
  and p.category_id is null;
