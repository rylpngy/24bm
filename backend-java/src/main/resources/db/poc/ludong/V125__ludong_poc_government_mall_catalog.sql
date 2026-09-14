update materials
set government_mall_catalog = true,
    updated_at = now()
where tenant_id = 'tenant-ludong-poc'
  and (
    lower(category) like '%办公%'
    or lower(category) like '%it%'
    or name like '%计算机%'
    or name like '%打印机%'
    or name like '%投影%'
    or name like '%显示器%'
  );
