-- 采购方式分流 + 终止(流标/废标):method 记录采购方式,close_reason 记录终止说明。
alter table rfqs add column method varchar(32) not null default '询价';
alter table rfqs add column close_reason text;
