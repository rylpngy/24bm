-- 收货验收加厚：收货数量 / 合格数量 / 验收说明（合格率可由合格数量÷收货数量推导）。
alter table receipts add column if not exists received_quantity integer not null default 0;
alter table receipts add column if not exists qualified_quantity integer not null default 0;
alter table receipts add column if not exists quality_note text not null default '';
