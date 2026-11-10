create table agency_recommendations (
 id text primary key,tenant_id text not null,package_id text not null,session_id text not null,round_id text not null,ordinal integer not null,source_fingerprint text not null,snapshot_json jsonb not null,frozen_hash text not null,created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,session_id,ordinal),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id)
);
create table agency_evaluation_reports (
 id text primary key,tenant_id text not null,package_id text not null,session_id text not null,recommendation_id text not null,status text not null default 'draft' check(status in ('draft','reviewing','approved','rejected')),version bigint not null default 1,narrative_json jsonb not null,artifact_version_id text,artifact_hash text,artifact_basis_version bigint,created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),foreign key(tenant_id,recommendation_id) references agency_recommendations(tenant_id,id)
);
create table agency_report_artifacts (
 id text primary key,tenant_id text not null,report_id text not null,report_version bigint not null,file_version_id text not null,file_hash text not null,source_fingerprint text not null,created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),foreign key(tenant_id,report_id) references agency_evaluation_reports(tenant_id,id),foreign key(tenant_id,file_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_report_submissions (
 id text primary key,tenant_id text not null,report_id text not null,report_version bigint not null,source_fingerprint text not null,snapshot_json jsonb not null,frozen_hash text not null,status text not null default 'processing' check(status in ('processing','approved','rejected','withdrawn')),workflow_id text,result_note text not null default '',created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),foreign key(tenant_id,report_id) references agency_evaluation_reports(tenant_id,id)
);
create unique index agency_report_pending_submission on agency_report_submissions(tenant_id,report_id) where status='processing';
