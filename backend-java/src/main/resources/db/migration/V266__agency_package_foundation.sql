create table agency_groups (
 id text primary key,tenant_id text not null references tenants(id),name text not null,tags text not null default '',
 created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id)
);
create table agency_packages (
 id text primary key,tenant_id text not null references tenants(id),group_id text,title text not null default '',
 business_category text,object_code text,procurement_method text,regime text,region text,operating_mode text not null default 'half',
 department_id text,owner_id text,budget numeric(20,2),ceiling numeric(20,2),currency text not null default 'CNY',
 status text not null default 'draft' check(status in ('draft','reviewing','approved','rejected','withdrawn')),
 number text,business_year int,serial int check(serial between 1 and 9999),version bigint not null default 1,
 data_json jsonb not null,workflow_id text,created_by text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 business_status text not null default 'not_started',archive_completion text not null default 'accumulating',financial_status text not null default 'unassessed',
 unique(tenant_id,id),unique(tenant_id,business_year,serial),unique(tenant_id,number),
 foreign key(tenant_id,group_id) references agency_groups(tenant_id,id),check(budget is null or budget>=0),check(ceiling is null or ceiling>=0),
 check(operating_mode='half')
);
create index agency_package_list on agency_packages(tenant_id,created_at desc);
create table agency_members (
 tenant_id text not null,package_id text not null,user_id text not null,role text not null check(role in ('OWNER','EDITOR','VIEWER')),
 active boolean not null default true,created_at timestamptz not null default now(),ended_at timestamptz,
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id)
);
create unique index agency_member_active on agency_members(tenant_id,package_id,user_id) where active;
create unique index agency_single_owner on agency_members(tenant_id,package_id) where active and role='OWNER';
create table agency_package_history (
 tenant_id text not null,package_id text not null,version bigint not null,data_json jsonb not null,reason text not null,actor_id text not null,
 created_at timestamptz not null default now(),primary key(tenant_id,package_id,version),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id)
);
create table agency_numbering_config (
 tenant_id text primary key references tenants(id),pattern text not null default '{category}-{object}-{yyyyMM}-{serial}',time_zone text not null default 'Asia/Shanghai',
 categories jsonb not null default '{"ZC":"政府采购","DL":"其他代理业务"}',objects jsonb not null default '{"HW":"货物","FW":"服务","GC":"工程"}',version bigint not null default 1
);
create table agency_annual_sequences (
 tenant_id text not null references tenants(id),business_year int not null,last_serial int not null check(last_serial between 1 and 9999),primary key(tenant_id,business_year)
);
create table agency_reviews (
 id text primary key,tenant_id text not null,package_id text not null,kind text not null check(kind in ('archive','change')),base_version bigint not null,
 proposed_json jsonb not null,snapshot_json jsonb not null,status text not null check(status in ('processing','approved','rejected','withdrawn')),
 requested_by text not null,workflow_id text,created_at timestamptz not null default now(),comment text,
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),unique(tenant_id,id)
);
create unique index agency_one_pending_review on agency_reviews(tenant_id,package_id) where status='processing';
create table agency_idempotency (
 tenant_id text not null references tenants(id),request_key text not null,fingerprint text not null,response_json jsonb not null,created_at timestamptz not null default now(),primary key(tenant_id,request_key)
);
create table agency_files (
 id text primary key,tenant_id text not null,package_id text not null,name text not null,category text not null,
 visibility text not null check(visibility in ('project','restricted')),created_by text not null,created_at timestamptz not null default now(),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),unique(tenant_id,id)
);
create table agency_file_versions (
 id text primary key,tenant_id text not null,file_id text not null,ordinal int not null,status text not null check(status in ('uploading','sealed','cancelled')),
 attachment_id text,hash text,content_size bigint,created_by text not null,created_at timestamptz not null default now(),reason text,
 foreign key(tenant_id,file_id) references agency_files(tenant_id,id),unique(tenant_id,id),unique(tenant_id,file_id,ordinal),
 check(status<>'sealed' or (attachment_id is not null and hash is not null and content_size is not null))
);
create unique index agency_one_uploading_file_version on agency_file_versions(tenant_id,file_id) where status='uploading';
-- Permission grants remain explicit through existing role management; existing buyer:* includes these points.
