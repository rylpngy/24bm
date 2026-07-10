-- 单一来源采购须保留来源说明(1.0 业务框架:定向选择 1 家供应商,需保留来源说明和审批依据)。
alter table rfqs
  add column if not exists single_source_reason text;
