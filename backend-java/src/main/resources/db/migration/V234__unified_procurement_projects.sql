create table procurement_projects (
 id varchar(80) primary key, tenant_id varchar(80) not null references tenants(id),
 project_no varchar(100) not null, title varchar(200) not null,
 department_id varchar(80) not null references departments(id), owner_id varchar(80) not null references users(id),
 period varchar(4) not null, funding_source varchar(200) not null, purpose varchar(4000) not null,
 planned_amount numeric(18,2) not null check(planned_amount>0),
 status varchar(30) not null default 'draft', revision integer not null default 1,
 created_by varchar(80) not null, workflow_instance_id varchar(80),
 execution_type varchar(20), execution_id varchar(80), closeout_reason varchar(2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,project_no), unique(tenant_id,id), unique(tenant_id,execution_type,execution_id),
 check(status in ('draft','submitted','approved','rejected','withdrawn','terminated','closed')),
 check((execution_type is null and execution_id is null) or (execution_type in ('rfq','tender') and execution_id is not null))
);
create index procurement_project_page on procurement_projects(tenant_id,created_at desc,id);
create table procurement_project_lines (
 id varchar(80) primary key, tenant_id varchar(80) not null, project_id varchar(80) not null,
 material_id varchar(80) not null, name varchar(500) not null, specification text not null,
 unit varchar(80) not null, quantity numeric(18,4) not null check(quantity>0),
 unit_price numeric(18,4) not null check(unit_price>=0), purpose varchar(1000) not null default '',
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
create table procurement_project_demands (
 tenant_id varchar(80) not null, project_id varchar(80) not null, demand_id varchar(80) not null references purchase_demands(id),
 linked_by varchar(80) not null, linked_at timestamptz not null default now(),
 primary key(tenant_id,demand_id),foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
