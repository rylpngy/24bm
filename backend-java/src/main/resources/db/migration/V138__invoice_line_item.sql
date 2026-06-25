-- 发票行项明细:供应商开票时从订单行项复制而来,使三单匹配可逐行对账(订单↔收货↔发票)。
-- 行金额 = 数量 × 单价;发票头金额 invoices.amount 与明细行合计一致(沿用订单行项)。
create table invoice_line_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  invoice_id text not null references invoices(id) on delete cascade,
  order_line_id text references order_line_items(id),
  description text not null,
  unit text not null default '项',
  quantity numeric(14, 2) not null,
  unit_price numeric(14, 2) not null,
  line_amount numeric(16, 2) not null,
  sort_no integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_invoice_line_items_invoice on invoice_line_items (tenant_id, invoice_id, sort_no);
