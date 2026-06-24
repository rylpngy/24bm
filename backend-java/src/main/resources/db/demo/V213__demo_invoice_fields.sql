-- 给演示发票补增值税专票字段（发票代码/开票日期/税率）。
-- 价税合计 88000.00 + 税率 13% => 税额≈10128.32，不含税≈77871.68（响应层推导）。

update invoices set
  invoice_code = '144031909110',
  invoice_date = date '2026-06-20',
  tax_rate = 13.00
where tenant_id = 'tenant-acme' and id = 'inv-demo';
