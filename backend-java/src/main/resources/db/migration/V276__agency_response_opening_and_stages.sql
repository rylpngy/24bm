alter table agency_participations add unique(tenant_id,id);
create table agency_opening_plans (
 tenant_id text not null,round_id text not null,package_id text not null,status text not null default 'draft' check(status in ('draft','intake','opened')),version bigint not null default 1,config_json jsonb not null,created_by text not null,updated_at timestamptz not null default now(),primary key(tenant_id,round_id),foreign key(tenant_id,round_id) references agency_evaluation_rounds(tenant_id,id)
);
create table agency_response_receipts (
 id text primary key,tenant_id text not null,package_id text not null,round_id text not null,participation_id text not null,item_key text not null,file_id text not null,received_at timestamptz not null,original_type text not null,source_note text not null,note text not null,late_entry_reason text not null default '',status text not null default 'received' check(status in ('received','withdrawn')),version bigint not null default 1,created_by text not null,created_at timestamptz not null default now(),withdraw_reason text not null default '',unique(tenant_id,id),unique(tenant_id,file_id),foreign key(tenant_id,round_id) references agency_opening_plans(tenant_id,round_id),foreign key(tenant_id,file_id) references agency_files(tenant_id,id),foreign key(tenant_id,participation_id) references agency_participations(tenant_id,id)
);
create unique index agency_response_current_item on agency_response_receipts(tenant_id,round_id,participation_id,item_key) where status='received';
create table agency_response_openings (
 id text primary key,tenant_id text not null,package_id text not null,round_id text not null,manifest_json jsonb not null,manifest_hash text not null,subjects_json jsonb not null,opened_at timestamptz not null,evidence_version_id text not null,evidence_hash text not null,note text not null,created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,round_id),foreign key(tenant_id,round_id) references agency_opening_plans(tenant_id,round_id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
alter table agency_assessment_sheets add column stage_key text not null default 'legacy' check(stage_key in ('legacy','qualification','conformity','evaluation'));
do $$ declare constraint_name text; begin
 select conname into constraint_name from pg_constraint where conrelid='agency_assessment_sheets'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (tenant_id, session_id, user_id, ordinal)';
 if constraint_name is null then raise exception 'Expected personal assessment unique key missing';end if;
 execute format('alter table agency_assessment_sheets drop constraint %I',constraint_name);
end $$;
alter table agency_assessment_sheets add unique(tenant_id,session_id,user_id,stage_key,ordinal);
create table agency_assessment_stages (
 id text primary key,tenant_id text not null,session_id text not null,stage_key text not null check(stage_key in ('qualification','conformity','evaluation')),subjects_json jsonb not null,prerequisite_hash text not null,evidence_version_id text not null,evidence_hash text not null,note text not null,exclusions_json jsonb not null,created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,session_id,stage_key),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
