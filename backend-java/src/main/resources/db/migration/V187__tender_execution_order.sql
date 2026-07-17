-- Track C C-7:中标 → 采购订单联动。
-- 定标后一键生成执行采购订单(经「招标」锚点 RFQ 挂入既有订单/履约/财务/合同链),
-- execution_order_id 记录联动结果并保证幂等(一个招标项目只生成一张执行订单)。
alter table tenders add column execution_order_id text references purchase_orders(id);
