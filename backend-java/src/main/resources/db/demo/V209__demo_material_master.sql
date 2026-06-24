-- 给演示物料补主数据字段(规格型号/品牌/税率/描述)。

update materials set
  specification = 'i7-1360P / 16G / 512G SSD / 14"',
  brand = '联想 ThinkPad',
  tax_rate = 13.00,
  description = '标配商务办公本，含三年上门保修。'
where tenant_id = 'tenant-acme' and code = 'IT-LAPTOP';

update materials set
  specification = '27" / 2K / IPS / 75Hz',
  brand = '戴尔 UltraSharp',
  tax_rate = 13.00,
  description = '低蓝光护眼显示器，支持壁挂。'
where tenant_id = 'tenant-acme' and code = 'IT-MONITOR';
