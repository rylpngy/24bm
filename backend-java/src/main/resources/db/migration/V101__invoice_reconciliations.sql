create table invoice_reconciliations (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  invoice_id varchar(64) not null references invoices(id),
  supplier_id varchar(64) not null references enterprises(id),
  order_id varchar(64) not null references purchase_orders(id),
  stage varchar(64) not null,
  next_action varchar(128) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_id)
);

create index idx_invoice_reconciliations_tenant_stage
  on invoice_reconciliations (tenant_id, stage);

create index idx_invoice_reconciliations_supplier_stage
  on invoice_reconciliations (supplier_id, stage);

insert into invoice_reconciliations (id, tenant_id, invoice_id, supplier_id, order_id, stage, next_action)
select
  'recon-' || invoice.id,
  invoice.tenant_id,
  invoice.id,
  invoice.supplier_id,
  invoice.order_id,
  case
    when purchase_order.status not in ('已收货', '已完成') then '待收货'
    when invoice.payment_status = '已付款' then '已完成'
    else invoice.payment_status
  end,
  case
    when purchase_order.status not in ('已收货', '已完成') then '等待收货'
    when invoice.payment_status = '已付款' then '归档对账'
    else '登记付款'
  end
from invoices invoice
join purchase_orders purchase_order
  on purchase_order.tenant_id = invoice.tenant_id
 and purchase_order.id = invoice.order_id
on conflict (tenant_id, invoice_id) do nothing;
