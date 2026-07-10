-- 给演示收货单补验收明细（收货数量/合格数量/验收说明）。
update receipts set
  received_quantity = 500,
  qualified_quantity = 495,
  quality_note = '到货500米，抽检20卷外观与导通正常；5米端头轻微压痕已挑出，合格率99%。'
where tenant_id = 'tenant-acme' and id = 'rcpt-invoiced';
