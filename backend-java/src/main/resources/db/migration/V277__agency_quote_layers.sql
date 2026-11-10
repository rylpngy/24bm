create table agency_quote_layers (
 id text primary key,tenant_id text not null,session_id text not null,participation_id text not null,ordinal integer not null,previous_id text,
 original_amount numeric(20,2) not null check(original_amount>=0),corrected_amount numeric(20,2),evaluation_amount numeric(20,2),currency text not null,
 kind text not null check(kind in ('original','correction','policy')),evidence_version_id text not null,evidence_hash text not null,reason text not null,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,session_id,participation_id,ordinal),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),foreign key(tenant_id,previous_id) references agency_quote_layers(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
