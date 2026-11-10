create table agency_templates (
 id text primary key,tenant_id text not null references tenants(id),package_id text,name text not null,scope text not null check(scope in ('company','project')),
 procurement_method text not null,object_code text,regime text,region text,description text not null default '',active boolean not null default true,
 latest_ordinal int not null default 1,published_version_id text,version bigint not null default 1,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),check((scope='company' and package_id is null) or (scope='project' and package_id is not null))
);
create table agency_template_versions (
 id text primary key,tenant_id text not null,template_id text not null,ordinal int not null,sections_json jsonb not null,status text not null default 'draft' check(status in ('draft','processing','published','rejected','withdrawn')),
 source_note text not null,workflow_id text,requested_by text,created_by text not null,created_at timestamptz not null default now(),comment text,
 unique(tenant_id,id),unique(tenant_id,template_id,ordinal),foreign key(tenant_id,template_id) references agency_templates(tenant_id,id)
);
create unique index agency_template_one_review on agency_template_versions(tenant_id,template_id) where status='processing';
create table agency_demand_items (
 id text primary key,tenant_id text not null,package_id text not null,field_key text not null,value_text text not null,source_version_id text not null,
 locator text not null,status text not null check(status in ('pending','confirmed','conflict','superseded')),version bigint not null default 1,
 origin text not null check(origin in ('manual','deterministic')),job_id text,created_by text not null,updated_by text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,source_version_id) references agency_file_versions(tenant_id,id),unique(tenant_id,id)
);
create table agency_documents (
 id text primary key,tenant_id text not null,package_id text not null,kind text not null check(kind in ('purchase','announcement')),
 template_version_id text,sections_json jsonb not null default '[]',settings_json jsonb not null default '{}',basis_json jsonb not null default '{}',version bigint not null default 1,
 status text not null default 'draft' check(status in ('draft','ready','reviewing','approved','rejected','withdrawn')),current_revision_id text,
 created_by text not null,updated_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,package_id,kind),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,template_version_id) references agency_template_versions(tenant_id,id)
);
create table agency_execution_jobs (
 id text primary key,tenant_id text not null,package_id text not null,kind text not null check(kind in ('compose','extract')),document_id text,input_version bigint,
 payload_json jsonb not null,status text not null default 'queued' check(status in ('queued','processing','success','failed','stale')),attempts int not null default 0,
 result_json jsonb not null default '{}',error_text text,created_by text not null,created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,
 unique(tenant_id,id),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,document_id) references agency_documents(tenant_id,id)
);
create index agency_execution_job_queue on agency_execution_jobs(status,created_at);
create table agency_document_revisions (
 id text primary key,tenant_id text not null,document_id text not null,input_version bigint not null,source_kind text not null check(source_kind in ('composed','uploaded')),
 file_version_id text not null,hash text not null,snapshot_json jsonb not null,status text not null default 'candidate' check(status in ('candidate','processing','approved','rejected','withdrawn')),
 job_id text,workflow_id text,requested_by text,created_by text not null,created_at timestamptz not null default now(),comment text,
 unique(tenant_id,id),unique(tenant_id,job_id),foreign key(tenant_id,document_id) references agency_documents(tenant_id,id),foreign key(tenant_id,file_version_id) references agency_file_versions(tenant_id,id)
);
create unique index agency_document_one_review on agency_document_revisions(tenant_id,document_id) where status='processing';
create table agency_publication_rules (
 tenant_id text not null,package_id text not null,announcement_applicable boolean not null,reason text not null,evidence_version_id text not null,version bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now(),
 primary key(tenant_id,package_id),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_publications (
 id text primary key,tenant_id text not null,package_id text not null,purchase_revision_id text not null,announcement_revision_id text,platform text not null,published_at timestamptz not null,url text,evidence_version_id text,rule_version bigint,
 created_by text not null,created_at timestamptz not null default now(),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),
 foreign key(tenant_id,purchase_revision_id) references agency_document_revisions(tenant_id,id),foreign key(tenant_id,announcement_revision_id) references agency_document_revisions(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_participations (
 id text primary key,tenant_id text not null,package_id text not null,supplier_name text not null,credit_code text,contact text,phone text,source text not null,
 acquisition_status text not null check(acquisition_status in ('unknown','acquired','not_applicable')),submission_status text not null check(submission_status in ('unknown','submitted','withdrawn')),
 risk_note text not null default '',risk_status text not null check(risk_status in ('pending','checked','not_applicable')),evidence_version_id text,notes text not null default '',
 version bigint not null default 1,created_by text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_milestones (
 id text primary key,tenant_id text not null,package_id text not null,node_key text not null,title text not null,owner_id text not null,starts_at timestamptz,due_at timestamptz,
 dependencies_json jsonb not null default '[]',material_requirement text not null default '',status text not null default 'planned' check(status in ('planned','doing','completed','cancelled','not_applicable')),
 completed_at timestamptz,result_note text not null default '',change_reason text not null default '',legal_deadline timestamptz,legal_basis text,version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),template_version bigint not null default 0,unique(tenant_id,id),unique(tenant_id,package_id,node_key),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id)
);
create table agency_preparations (
 tenant_id text not null,package_id text not null,venue text not null default '',scheduled_at timestamptz,material_notes text not null default '',committee_notes text not null default '',draw_notes text not null default '',evidence_version_id text,
 version bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now(),primary key(tenant_id,package_id),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_execution_events (
 id text primary key,tenant_id text not null,package_id text not null,object_type text not null,object_id text not null,before_json jsonb,after_json jsonb not null,reason text not null,actor_id text not null,created_at timestamptz not null default now(),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id)
);

create table agency_plan_templates (
 tenant_id text not null references tenants(id),procurement_method text not null,operating_mode text not null default 'half',version bigint not null,nodes_json jsonb not null,reason text not null,created_by text not null,created_at timestamptz not null default now(),primary key(tenant_id,procurement_method,operating_mode,version)
);
