-- 供应商主数据加厚：联系人/电话/邮箱 + 开户行/银行账号 + 经营范围（采购方建档与付款所需）。
alter table supplier_enterprises add column if not exists contact_name text not null default '';
alter table supplier_enterprises add column if not exists contact_phone text not null default '';
alter table supplier_enterprises add column if not exists contact_email text not null default '';
alter table supplier_enterprises add column if not exists bank_name text not null default '';
alter table supplier_enterprises add column if not exists bank_account text not null default '';
alter table supplier_enterprises add column if not exists business_scope text not null default '';
