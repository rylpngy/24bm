-- 重置演示供应商到一致基线：只保留"待准入/已准入"两种种子状态。
-- "准入审批中"只应由真实提交准入(创建审批任务)产生，避免无任务的脏状态。

update buyer_supplier_relations set status = '已准入', level = 'A'
  where tenant_id = 'tenant-acme' and supplier_id = 'ent-supplier-sunrise';

update buyer_supplier_relations set status = '待准入', level = 'B'
  where tenant_id = 'tenant-acme' and supplier_id = 'ent-supplier-tech';

update buyer_supplier_relations set status = '待准入', level = 'C'
  where tenant_id = 'tenant-acme' and supplier_id = 'ent-supplier-office';

-- 清理之前演示提交残留的供应商准入审批任务(避免脏待办)。
delete from approval_tasks
  where tenant_id = 'tenant-acme' and biz_type = 'buyer_supplier_admission';
