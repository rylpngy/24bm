-- 询比价多轮报价/BAFO:RFQ 记录当前轮次与是否最终轮;报价归属某一轮。
-- 再次报价 = 已开标 → 报价中(轮次+1,重新封存,设新截止),供应商在新轮重新报价。
alter table rfqs add column current_round int not null default 1;
alter table rfqs add column final_round boolean not null default false;
alter table quotes add column round int not null default 1;

-- 旧唯一约束(租户+RFQ+供应商)阻止跨轮再报;放宽为按轮唯一(同轮仍只能一份)。
alter table quotes drop constraint quotes_tenant_id_rfq_id_supplier_id_key;
alter table quotes add constraint quotes_tenant_rfq_supplier_round_key
  unique (tenant_id, rfq_id, supplier_id, round);
