-- Only the original per-order document constraints block multiple batches.
alter table deliveries drop constraint if exists deliveries_tenant_id_order_id_key;
alter table receipts drop constraint if exists receipts_tenant_id_order_id_key;

create index if not exists idx_deliveries_tenant_order on deliveries (tenant_id, order_id);
create index if not exists idx_receipts_tenant_order on receipts (tenant_id, order_id);

create table delivery_line_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  delivery_id text not null references deliveries(id),
  order_line_id text not null references order_line_items(id),
  shipped_quantity numeric(14,2) not null check (shipped_quantity > 0),
  unique (tenant_id, delivery_id, order_line_id)
);
create index idx_delivery_lines_order_line on delivery_line_items (tenant_id, order_line_id);
-- Do not backfill line quantities: legacy headers do not prove line allocations.
