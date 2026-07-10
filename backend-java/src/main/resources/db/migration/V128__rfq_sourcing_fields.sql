-- RFQ 加厚：报价要求 / 交付要求 / 评选方式（询价业务条款字段化）。
alter table rfqs add column if not exists quote_requirement text not null default '';
alter table rfqs add column if not exists delivery_requirement text not null default '';
alter table rfqs add column if not exists evaluation_method text not null default '最低价';
