-- 报价行项明细:供应商按行报价(描述/单位/数量/单价),行金额 = 数量 × 单价。
-- 支撑买方逐行比价;报价头金额 quotes.amount 与明细行合计由服务端保持一致(按行汇总)。
create table quote_line_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  quote_id text not null references quotes(id) on delete cascade,
  description text not null,
  unit text not null default '项',
  quantity numeric(14, 2) not null,
  unit_price numeric(14, 2) not null,
  line_amount numeric(16, 2) not null,
  sort_no integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_quote_line_items_quote on quote_line_items (tenant_id, quote_id, sort_no);
