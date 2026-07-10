-- 演示部门预算:信息化部 2026 预算 480000(需求占用 已用458000+在途36000=494000 → 超预算 14000);
-- 财务部 2026 预算 200000(暂无需求,占用 0,健康)。
insert into department_budgets (id, tenant_id, department_id, period, total_amount)
values
  ('budget-it-2026', 'tenant-acme', 'dept-it', '2026', 480000.00),
  ('budget-fin-2026', 'tenant-acme', 'dept-finance', '2026', 200000.00)
on conflict (tenant_id, department_id, period) do nothing;
