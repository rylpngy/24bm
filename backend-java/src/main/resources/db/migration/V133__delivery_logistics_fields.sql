-- 物流发货加厚：发货数量 / 发货日期 / 预计到货 / 物流备注。
alter table deliveries add column if not exists shipped_quantity integer not null default 0;
alter table deliveries add column if not exists shipped_date date;
alter table deliveries add column if not exists estimated_arrival date;
alter table deliveries add column if not exists logistics_note text not null default '';
