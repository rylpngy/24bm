create table agency_price_rules (
 id text primary key,tenant_id text not null,session_id text not null,version bigint not null default 1,
 status text not null default 'draft' check(status in ('draft','frozen')),config_json jsonb not null,
 frozen_json jsonb,frozen_hash text,created_by text not null,created_at timestamptz not null default now(),frozen_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,session_id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id)
);
create table agency_price_calculations (
 id text primary key,tenant_id text not null,session_id text not null,rule_id text not null,rule_hash text not null,
 basis_fingerprint text not null,input_fingerprint text not null,scope_json jsonb not null,trace_json jsonb not null,
 evidence_version_id text not null,evidence_hash text not null,reason text not null,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),
 foreign key(tenant_id,rule_id) references agency_price_rules(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create index agency_price_calculation_history on agency_price_calculations(tenant_id,session_id,created_at desc);
