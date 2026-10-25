create table procurement_project_packages (
 id text primary key, tenant_id text not null, project_id text not null,
 title varchar(200) not null, status text not null default 'draft' check(status in ('draft','ready','closed','cancelled')),
 revision integer not null default 1, project_revision integer not null,
 amount numeric(18,2) not null check(amount>0), lines jsonb not null, snapshot jsonb not null,
 created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id), foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
create index project_packages_project on procurement_project_packages(tenant_id,project_id,created_at,id);
create table procurement_project_package_demands (
 tenant_id text not null, package_id text not null, demand_id text not null references purchase_demands(id),
 primary key(tenant_id,demand_id), foreign key(tenant_id,package_id) references procurement_project_packages(tenant_id,id)
);
create table procurement_project_executions (
 id text primary key, tenant_id text not null, project_id text not null, package_id text not null,
 execution_type text not null check(execution_type in ('rfq','tender')), execution_id text not null,
 status text not null default 'active' check(status in ('active','abandoned')),
 reason varchar(1000) not null default '', created_by text not null, created_at timestamptz not null default now(),
 unique(tenant_id,execution_type,execution_id), foreign key(tenant_id,package_id) references procurement_project_packages(tenant_id,id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
create unique index project_package_active_execution on procurement_project_executions(tenant_id,package_id) where status='active';
create table procurement_project_changes (
 id text primary key, tenant_id text not null, project_id text not null, based_revision integer not null,
 before_snapshot jsonb not null, proposal jsonb not null, amount numeric(18,2) not null,
 reason varchar(1000) not null, status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','withdrawn')),
 revision integer not null default 1, workflow_instance_id text, result_revision integer,
 created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
create unique index project_change_open on procurement_project_changes(tenant_id,project_id) where status in ('draft','submitted');
create table procurement_project_legacy_baselines (
 tenant_id text not null, project_id text not null, execution_type text not null, execution_id text not null,
 snapshot jsonb not null, demand_ids jsonb not null, created_at timestamptz not null default now(),
 primary key(tenant_id,execution_type,execution_id), foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
