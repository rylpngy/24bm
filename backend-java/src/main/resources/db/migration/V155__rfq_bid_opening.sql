-- 询比价开标控制:报价收集阶段封存(采购方看不到报价明细),开标后方可评标/定标。
-- opened_at 为空 = 封存中(状态 报价中);非空 = 已开标。
alter table rfqs add column opened_at timestamptz;
alter table rfqs add column opened_by varchar(64);
