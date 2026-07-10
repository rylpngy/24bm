-- 收货验收行项明细:逐行登记收货数量/合格数量,关联订单行项(order_line_id)。
-- 支撑三单匹配的行级对账;description/unit/ordered_quantity 自订单行项冗余便于展示。
create table receipt_line_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  receipt_id text not null references receipts(id) on delete cascade,
  order_line_id text not null references order_line_items(id),
  description text not null,
  unit text not null default '项',
  ordered_quantity numeric(14, 2) not null,
  received_quantity numeric(14, 2) not null,
  qualified_quantity numeric(14, 2) not null,
  sort_no integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_receipt_line_items_receipt on receipt_line_items (tenant_id, receipt_id, sort_no);
