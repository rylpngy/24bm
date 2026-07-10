-- 澄清补遗与结果公告:
-- 1. 采购方可主动发布补遗公告(无提问方,supplier_id 置空);
-- 2. 定标后向全体受邀方发布结果公告,时间落在 rfqs.result_announced_at。
alter table rfq_clarifications alter column supplier_id drop not null;
alter table rfqs add column if not exists result_announced_at timestamptz;
