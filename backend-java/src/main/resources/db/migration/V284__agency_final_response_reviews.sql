create table agency_final_response_plans (
 tenant_id text not null,session_id text not null,package_id text not null,mode text not null check(mode in ('legacy','active')),version bigint not null default 1,
 snapshot_json jsonb not null,frozen_hash text,created_by text not null,created_at timestamptz not null default now(),
 primary key(tenant_id,session_id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id)
);
-- Only already confirmed campaigns retain their historical offline review path.
insert into agency_final_response_plans(tenant_id,session_id,package_id,mode,snapshot_json,created_by)
 select tenant_id,session_id,package_id,'legacy','{"reason":"confirmed before V284; preserve historical offline review"}'::jsonb,'migration:V284'
 from agency_final_quote_campaigns where status='confirmed';
create table agency_final_response_sheets (
 id text primary key,tenant_id text not null,session_id text not null,user_id text not null,status text not null default 'draft' check(status in ('draft','submitted')),
 version bigint not null default 1,entries_json jsonb not null default '[]',snapshot_json jsonb,frozen_hash text,submitted_at timestamptz,updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,session_id,user_id),foreign key(tenant_id,session_id) references agency_final_response_plans(tenant_id,session_id)
);
