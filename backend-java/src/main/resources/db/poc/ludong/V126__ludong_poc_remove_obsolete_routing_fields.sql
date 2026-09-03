-- 经费主管审核改为固定节点，由统一工号复用机制自动跳过重复办理。
-- 同时清理已取消的附件三配置字段，保留其他已填报数据。
update ludong_poc_applications
set form_data = form_data
      - 'sameFundingUnit'
      - 'sameFundingUnitMode'
      - 'sameFundingUnitSystemValue'
      - 'sameFundingUnitReason'
      - 'configurationStandard',
    items = coalesce((
      select jsonb_agg(item - 'configurationLimit')
      from jsonb_array_elements(items) as item
    ), '[]'::jsonb),
    updated_at = now()
where tenant_id = 'tenant-ludong-poc';
