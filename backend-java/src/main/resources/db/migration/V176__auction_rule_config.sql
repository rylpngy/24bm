-- 竞价规则配置:保留价/计划开始/软关闭参数/供应商可见性开关(民企在线竞价完善)。
alter table rfqs add column if not exists auction_reserve_price numeric(18, 2);
alter table rfqs add column if not exists auction_planned_start timestamptz;
alter table rfqs add column if not exists auction_soft_close_trigger_minutes int;
alter table rfqs add column if not exists auction_soft_close_extend_minutes int;
alter table rfqs add column if not exists auction_show_rank boolean not null default true;
alter table rfqs add column if not exists auction_show_lowest boolean not null default true;
alter table rfqs add column if not exists auction_show_competitor_names boolean not null default false;
