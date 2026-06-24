-- 采购需求加厚：期望交期 / 优先级 / 用途说明。

alter table purchase_demands
  add column if not exists expected_delivery_date date;

alter table purchase_demands
  add column if not exists priority text not null default '常规';

alter table purchase_demands
  add column if not exists purpose text not null default '';
