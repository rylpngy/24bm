-- 1.0 采购执行方式收敛:开放 询比 / 竞价 / 商城 / 单一来源。
-- 历史招标/询价/竞谈类数据统一映射为询比,单一来源作为定向采购在 1.0 保留。
update rfqs
set method = '询比'
where method in ('询价', '公开招标', '邀请招标', '竞争性谈判');

alter table rfqs alter column method set default '询比';
