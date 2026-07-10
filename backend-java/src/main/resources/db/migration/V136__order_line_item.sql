-- 订单行项明细:采购订单生成时从中标报价的行项复制而来,使收货/开票可逐行对账。
-- 行金额 = 数量 × 单价;订单头金额 purchase_orders.amount 与明细行合计一致(沿用中标报价)。
create table order_line_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  order_id text not null references purchase_orders(id) on delete cascade,
  description text not null,
  unit text not null default '项',
  quantity numeric(14, 2) not null,
  unit_price numeric(14, 2) not null,
  line_amount numeric(16, 2) not null,
  sort_no integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_order_line_items_order on order_line_items (tenant_id, order_id, sort_no);
