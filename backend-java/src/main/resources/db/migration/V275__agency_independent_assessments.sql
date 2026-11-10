create table agency_assessment_sessions (
 id text primary key,tenant_id text not null,package_id text not null,round_id text not null,round_hash text not null,
 subjects_json jsonb not null,opening_evidence_version_id text not null,opening_hash text not null,opened_at timestamptz not null,note text not null,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,round_id),foreign key(tenant_id,round_id) references agency_evaluation_rounds(tenant_id,id),foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,opening_evidence_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_assessment_sheets (
 id text primary key,tenant_id text not null,session_id text not null,user_id text not null,ordinal integer not null check(ordinal>0),status text not null default 'draft' check(status in ('draft','submitted')),
 entries_json jsonb not null default '[]',version bigint not null default 1,previous_id text,correction_id text,content_hash text,submitted_at timestamptz,updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,session_id,user_id,ordinal),unique(tenant_id,correction_id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),foreign key(tenant_id,previous_id) references agency_assessment_sheets(tenant_id,id),
 check((status='draft' and submitted_at is null and content_hash is null) or (status='submitted' and submitted_at is not null and content_hash is not null))
);
create table agency_assessment_corrections (
 id text primary key,tenant_id text not null,session_id text not null,sheet_id text not null,user_id text not null,sheet_version bigint not null,sheet_hash text not null,
 cells_json jsonb not null,reason text not null,evidence_version_id text not null,evidence_hash text not null,status text not null check(status in ('processing','approved','rejected','withdrawn')),workflow_id text,result_note text not null default '',created_at timestamptz not null default now(),
 unique(tenant_id,id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),foreign key(tenant_id,sheet_id) references agency_assessment_sheets(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create unique index agency_assessment_pending_correction on agency_assessment_corrections(tenant_id,sheet_id) where status='processing';
alter table agency_assessment_sheets add foreign key(tenant_id,correction_id) references agency_assessment_corrections(tenant_id,id);
create index agency_assessment_my_sheets on agency_assessment_sheets(tenant_id,session_id,user_id,ordinal desc);
