-- 给演示询价补业务条款（报价要求/交付要求/评选方式）。

update rfqs set
  quote_requirement = '报价含13%增值税专用发票，单价精确到分；报价有效期不少于30天。',
  delivery_requirement = '到货地址：上海研发中心；要求7个工作日内到货并提供质保2年。',
  evaluation_method = '综合评分'
where tenant_id = 'tenant-acme' and id = 'rfq-demo';

update rfqs set
  quote_requirement = '含税总价报价，附明细清单；逾期未响应视为放弃。',
  delivery_requirement = '分两批交付，首批3个工作日，余量10个工作日内。',
  evaluation_method = '最低价'
where tenant_id = 'tenant-acme' and id = 'rfq-fulfilled';

update rfqs set
  quote_requirement = '按米报价，最小起订100米；提供材质检测报告。',
  delivery_requirement = '一次性到货，到货后5日内验收对账。',
  evaluation_method = '最低价'
where tenant_id = 'tenant-acme' and id = 'rfq-invoiced';
