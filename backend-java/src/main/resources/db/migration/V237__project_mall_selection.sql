create table procurement_project_mall_selections (
  tenant_id text not null,
  package_id text not null,
  project_id text not null,
  rfq_id text not null references rfqs(id),
  order_id text not null references purchase_orders(id),
  request_key varchar(100) not null,
  request_hash text not null,
  snapshot jsonb not null,
  reason varchar(1000) not null,
  actor_id text not null references users(id),
  created_at timestamptz not null default now(),
  primary key(tenant_id,package_id),
  unique(tenant_id,rfq_id),
  foreign key(tenant_id,package_id) references procurement_project_packages(tenant_id,id),
  foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
