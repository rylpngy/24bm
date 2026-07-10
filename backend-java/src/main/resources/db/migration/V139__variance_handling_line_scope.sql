-- 差异处理行级化:可标注差异处理究竟由哪一行(订单行项)触发,贯通行级三单匹配→差异处理。
-- 仍保持每发票一条差异处理(unique(tenant_id, invoice_id)不变);新增列为可空注解。
alter table variance_handlings
  add column order_line_id varchar(64) references order_line_items(id),
  add column line_description text;
