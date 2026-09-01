-- 鲁东大学货物类采购申报 POC：两份表格共享一个申报材料包和一个 Flowable 实例。
create table ludong_poc_applications (
  id text primary key,
  tenant_id text not null references tenants(id),
  application_no text not null,
  project_name text not null,
  applicant_unit text not null,
  department_id text,
  budget_amount numeric(16, 2) not null default 0,
  status text not null check (status in ('draft', 'in_approval', 'approved', 'rejected', 'archived')),
  form_data jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  created_by text not null references users(id),
  submitted_by text references users(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, application_no)
);

create index idx_ludong_poc_application_list
  on ludong_poc_applications (tenant_id, status, updated_at desc);
