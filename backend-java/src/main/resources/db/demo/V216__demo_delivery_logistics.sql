-- 给演示物流发货补字段（发货数量/发货日期/预计到货/物流备注）。
update deliveries set
  shipped_quantity = 80,
  shipped_date = date '2026-07-02',
  estimated_arrival = date '2026-07-05',
  logistics_note = '顺丰陆运整车直发，已签出库单；途经苏州中转，预计3日内到货。'
where tenant_id = 'tenant-acme' and id = 'dlv-demo';

update deliveries set
  shipped_quantity = 500,
  shipped_date = date '2026-06-18',
  estimated_arrival = date '2026-06-22',
  logistics_note = '德邦物流分两板发运，运单含保价；到货后请按收货明细核对数量。'
where tenant_id = 'tenant-acme' and id = 'dlv-invoiced';
