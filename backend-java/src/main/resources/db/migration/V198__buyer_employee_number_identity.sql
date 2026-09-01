create unique index if not exists uq_users_tenant_employee_no
  on users (tenant_id, upper(employee_no))
  where tenant_id is not null and employee_no is not null and btrim(employee_no) <> '';
