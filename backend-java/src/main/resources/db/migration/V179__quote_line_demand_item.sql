-- 报价行绑定采购清单行:供应商按采购清单逐行报价,报价行回指需求清单行,
-- 使采购方可逐行比价(同一清单行横向对比各家单价),而非仅比总价。
-- 历史报价行(自由填写时代)demand_item_id 为空,展示时按品名回退。
alter table quote_line_items add column demand_item_id text;

create index idx_quote_line_items_demand_item on quote_line_items (tenant_id, demand_item_id);
