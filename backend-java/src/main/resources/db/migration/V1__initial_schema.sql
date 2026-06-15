-- 24Bid multi-tenant procurement SaaS initial schema.
-- Target database: PostgreSQL 15+

create table tenants (
  id text primary key,
  name text not null,
  plan text not null,
  status text not null,
  enabled_features jsonb not null default '[]'::jsonb,
  user_limit integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enterprises (
  id text primary key,
  name text not null,
  type text not null check (type in ('platform', 'buyer', 'supplier')),
  industry text not null default '',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_enterprises (
  enterprise_id text primary key references enterprises(id),
  credit_code text,
  legal_person text,
  verified_status text not null default 'pending',
  profile_status text not null default 'draft'
);

create table users (
  id text primary key,
  tenant_id text references tenants(id),
  supplier_id text references enterprises(id),
  name text not null,
  mobile text,
  email text,
  status text not null default 'active',
  department_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tenant_id is not null and supplier_id is null)
    or (tenant_id is null and supplier_id is not null)
    or (tenant_id is null and supplier_id is null)
  )
);

create table roles (
  id text primary key,
  tenant_id text references tenants(id),
  scope text not null check (scope in ('platform', 'buyer', 'supplier')),
  name text not null,
  permissions jsonb not null default '[]'::jsonb
);

create table user_roles (
  user_id text not null references users(id),
  role_id text not null references roles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table departments (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  parent_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table buyer_supplier_relations (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text not null references enterprises(id),
  status text not null,
  level text not null,
  categories jsonb not null default '[]'::jsonb,
  performance_score numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, supplier_id)
);

create table materials (
  id text primary key,
  tenant_id text not null references tenants(id),
  code text not null,
  name text not null,
  category text not null,
  unit text not null,
  reference_price numeric(14, 2) not null default 0,
  unique (tenant_id, code)
);

create table purchase_demands (
  id text primary key,
  tenant_id text not null references tenants(id),
  title text not null,
  department_id text not null,
  requester_id text not null references users(id),
  budget numeric(14, 2) not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_demand_items (
  id text primary key,
  tenant_id text not null references tenants(id),
  demand_id text not null references purchase_demands(id) on delete cascade,
  material_id text not null references materials(id),
  quantity numeric(14, 4) not null
);

create table approval_tasks (
  id text primary key,
  tenant_id text not null references tenants(id),
  biz_type text not null,
  biz_id text not null,
  assignee_id text references users(id),
  status text not null,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

create table approval_templates (
  template_code text not null,
  tenant_id text not null references tenants(id),
  biz_type text not null,
  name text not null,
  default_approver_role_id text not null references roles(id),
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, template_code),
  unique (tenant_id, biz_type)
);

create table rfqs (
  id text primary key,
  tenant_id text not null references tenants(id),
  title text not null,
  status text not null,
  deadline_at timestamptz not null,
  owner_id text not null references users(id),
  awarded_supplier_id text references enterprises(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rfq_demands (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id) on delete cascade,
  demand_id text not null references purchase_demands(id)
);

create table rfq_invites (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id) on delete cascade,
  supplier_id text not null references enterprises(id),
  invite_status text not null,
  unique (tenant_id, rfq_id, supplier_id)
);

create table quotes (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id) on delete cascade,
  supplier_id text not null references enterprises(id),
  amount numeric(14, 2) not null,
  tax_rate numeric(5, 2) not null,
  delivery_days integer not null,
  status text not null,
  submitted_at timestamptz not null default now(),
  unique (tenant_id, rfq_id, supplier_id)
);

create table award_decisions (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id),
  quote_id text not null references quotes(id),
  supplier_id text not null references enterprises(id),
  amount numeric(14, 2) not null,
  reason text not null,
  approved_status text not null,
  created_at timestamptz not null default now()
);

create table purchase_orders (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id),
  supplier_id text not null references enterprises(id),
  amount numeric(14, 2) not null,
  status text not null,
  expected_receipt_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deliveries (
  id text primary key,
  tenant_id text not null references tenants(id),
  order_id text not null references purchase_orders(id),
  supplier_id text not null references enterprises(id),
  carrier text not null,
  tracking_no text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, order_id)
);

create table receipts (
  id text primary key,
  tenant_id text not null references tenants(id),
  order_id text not null references purchase_orders(id),
  receiver_id text not null references users(id),
  result text not null,
  received_at timestamptz not null default now(),
  unique (tenant_id, order_id)
);

create table invoices (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text not null references enterprises(id),
  order_id text not null references purchase_orders(id),
  amount numeric(14, 2) not null,
  invoice_no text,
  payment_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_id)
);

create table attachments (
  id text primary key,
  tenant_id text not null references tenants(id),
  owner_type text not null,
  owner_id text not null,
  file_name text not null,
  storage_key text not null,
  uploaded_by text not null references users(id),
  visibility text not null default 'tenant',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table notifications (
  id text primary key,
  tenant_id text not null references tenants(id),
  recipient_id text not null references users(id),
  title text not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id text primary key,
  tenant_id text references tenants(id),
  actor_id text not null references users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);

create index idx_purchase_demands_tenant_status on purchase_demands (tenant_id, status);
create index idx_rfqs_tenant_status on rfqs (tenant_id, status);
create index idx_quotes_supplier on quotes (supplier_id, status);
create index idx_orders_tenant_status on purchase_orders (tenant_id, status);
create index idx_invoices_tenant_payment on invoices (tenant_id, payment_status);
