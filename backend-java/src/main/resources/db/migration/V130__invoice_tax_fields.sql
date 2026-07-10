-- 发票加厚：发票代码 / 开票日期 / 税率（增值税专票字段化；税额与不含税金额可由价税合计与税率推导）。
alter table invoices add column if not exists invoice_code text not null default '';
alter table invoices add column if not exists invoice_date date;
alter table invoices add column if not exists tax_rate numeric(5, 2) not null default 13.00;
