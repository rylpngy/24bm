-- 给演示采购订单补抬头字段（收货地址/收货联系人/联系电话/付款方式）。

update purchase_orders set
  delivery_address = '上海市浦东新区张江高科技园区博云路2号研发楼A座',
  contact_name = '王收货',
  contact_phone = '021-58880001',
  payment_terms = '货到验收合格后30天内电汇'
where tenant_id = 'tenant-acme' and id = 'po-demo';

update purchase_orders set
  delivery_address = '上海市闵行区紫竹科学园区谈家塘路200号仓储中心',
  contact_name = '李仓管',
  contact_phone = '021-34567890',
  payment_terms = '月结60天，承兑汇票结算'
where tenant_id = 'tenant-acme' and id = 'po-invoiced';
