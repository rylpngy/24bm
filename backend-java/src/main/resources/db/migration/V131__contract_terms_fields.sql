-- 合同加厚：签订日期 / 到期日（合同期限=生效~到期）/ 付款条款 / 质保与违约条款。
alter table contracts add column if not exists sign_date date;
alter table contracts add column if not exists expiry_date date;
alter table contracts add column if not exists payment_terms text not null default '';
alter table contracts add column if not exists warranty_terms text not null default '';
