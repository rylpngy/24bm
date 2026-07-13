-- 需求占用释放:已流标/已废标的项目不再占用需求(业务守卫口径),
-- 但旧唯一约束 (tenant_id, demand_id) 阻止需求在废标后重新立项,导致误报"已绑定"。
-- 放宽为 (tenant_id, demand_id, rfq_id):同一项目内防重复挂接,历史挂接(废标/流标)保留留痕。
alter table rfq_demands drop constraint rfq_demands_tenant_demand_unique;
alter table rfq_demands
  add constraint rfq_demands_tenant_demand_rfq_unique unique (tenant_id, demand_id, rfq_id);
