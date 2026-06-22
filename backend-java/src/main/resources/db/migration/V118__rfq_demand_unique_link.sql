alter table rfq_demands
  add constraint rfq_demands_tenant_demand_unique unique (tenant_id, demand_id);
