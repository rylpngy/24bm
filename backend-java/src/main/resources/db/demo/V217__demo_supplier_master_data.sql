-- 给演示供应商补主数据（联系人/电话/邮箱 + 开户行/银行账号 + 经营范围）。

update supplier_enterprises set
  contact_name = '王晨',
  contact_phone = '13901234567',
  contact_email = 'wangchen@sunrise-ele.com',
  bank_name = '招商银行上海张江支行',
  bank_account = '121909000123456789',
  business_scope = '电子元器件、线缆及连接器批发；五金交电、办公设备销售；计算机软硬件技术服务。'
where enterprise_id = 'ent-supplier-sunrise';

update supplier_enterprises set
  contact_name = '李星',
  contact_phone = '13802223334',
  contact_email = 'lixing@tech-supply.com',
  bank_name = '中国工商银行上海漕河泾支行',
  bank_account = '100020030040050060',
  business_scope = '服务器、网络设备及外围设备销售；机房集成与运维服务。'
where enterprise_id = 'ent-supplier-tech';

update supplier_enterprises set
  contact_name = '陈恒',
  contact_phone = '13700001111',
  contact_email = 'chenheng@office-mart.com',
  bank_name = '上海浦东发展银行徐汇支行',
  bank_account = '988877766655544',
  business_scope = '办公家具、办公耗材及打印设备销售；办公场所综合配套服务。'
where enterprise_id = 'ent-supplier-office';
