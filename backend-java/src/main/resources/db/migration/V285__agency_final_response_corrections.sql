alter table agency_final_response_sheets drop constraint agency_final_response_sheets_tenant_id_session_id_user_id_key;
alter table agency_final_response_sheets add column ordinal integer not null default 1 check(ordinal>0);
alter table agency_final_response_sheets add column previous_id text;
alter table agency_final_response_sheets add column correction_id text;
alter table agency_final_response_sheets add unique(tenant_id,session_id,user_id,ordinal);
alter table agency_final_response_sheets add foreign key(tenant_id,previous_id) references agency_final_response_sheets(tenant_id,id);
create table agency_final_response_corrections (
 id text primary key,tenant_id text not null,session_id text not null,sheet_id text not null,user_id text not null,sheet_version bigint not null,sheet_hash text not null,
 cells_json jsonb not null,reason text not null,evidence_version_id text not null,evidence_hash text not null,status text not null check(status in ('processing','approved','rejected','withdrawn')),workflow_id text,result_note text not null default '',created_at timestamptz not null default now(),
 unique(tenant_id,id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),foreign key(tenant_id,sheet_id) references agency_final_response_sheets(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create unique index agency_final_response_pending_correction on agency_final_response_corrections(tenant_id,sheet_id) where status='processing';
alter table agency_final_response_sheets add unique(tenant_id,correction_id);
alter table agency_final_response_sheets add foreign key(tenant_id,correction_id) references agency_final_response_corrections(tenant_id,id);
