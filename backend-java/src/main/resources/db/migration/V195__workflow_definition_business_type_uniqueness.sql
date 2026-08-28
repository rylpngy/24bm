-- 一个业务类型对应一个流程配置入口；发布操作在该入口下产生不可变版本。
-- 既有定义在 V194 前没有业务类型，NULL 不参与本约束。
create unique index uq_process_definitions_tenant_business_type
  on process_definitions (tenant_id, business_type)
  where business_type is not null;
