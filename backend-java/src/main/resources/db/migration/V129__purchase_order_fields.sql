-- 采购订单加厚：收货地址 / 收货联系人 / 联系电话 / 付款方式（订单抬头字段化）。
alter table purchase_orders add column if not exists delivery_address text not null default '';
alter table purchase_orders add column if not exists contact_name text not null default '';
alter table purchase_orders add column if not exists contact_phone text not null default '';
alter table purchase_orders add column if not exists payment_terms text not null default '货到验收30天内付款';
