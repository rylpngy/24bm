alter table purchase_orders
  add constraint purchase_orders_tenant_rfq_supplier_unique unique (tenant_id, rfq_id, supplier_id);
