-- 物料主数据加厚：规格型号 / 品牌 / 税率 / 描述。

alter table materials
  add column if not exists specification text not null default '';

alter table materials
  add column if not exists brand text not null default '';

alter table materials
  add column if not exists tax_rate numeric(5, 2) not null default 13.00;

alter table materials
  add column if not exists description text not null default '';
