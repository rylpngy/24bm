-- 商城运营闭环(M-4):上架审核留痕、售后单、订单评价。
--
-- 上架审核不新增表:沿用 mall_products.status 的四态(草稿/待审核/在架/下架),
-- 这里只补审核意见与审核时间,让驳回能说清楚原因。

alter table mall_products add column if not exists review_comment text;
alter table mall_products add column if not exists reviewed_at timestamptz;

-- 售后单:挂在采购订单行上(订单行是履约与对账的最小单元)。
create table if not exists mall_after_sales (
  id text primary key,
  tenant_id text not null references tenants(id),
  order_id text not null references purchase_orders(id),
  order_line_id text not null,
  supplier_id text not null references enterprises(id),
  -- 退货 / 换货 / 维修
  type text not null,
  quantity numeric(14, 2) not null,
  reason text not null,
  -- 待处理 / 处理中 / 已完成 / 已拒绝
  status text not null default '待处理',
  supplier_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mall_after_sales_tenant on mall_after_sales (tenant_id, status);
create index if not exists idx_mall_after_sales_supplier on mall_after_sales (supplier_id, status);

-- 评价:一条订单行只允许评一次(唯一约束防重复刷分)。
create table if not exists mall_reviews (
  id text primary key,
  tenant_id text not null references tenants(id),
  order_id text not null references purchase_orders(id),
  order_line_id text not null,
  product_id text references mall_products(id) on delete set null,
  supplier_id text not null references enterprises(id),
  rating integer not null check (rating between 1 and 5),
  content text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, order_line_id)
);
create index if not exists idx_mall_reviews_product on mall_reviews (product_id);
create index if not exists idx_mall_reviews_supplier on mall_reviews (supplier_id);
