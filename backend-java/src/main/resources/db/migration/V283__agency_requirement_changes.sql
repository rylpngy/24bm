create table agency_requirement_changes (
 id text primary key,tenant_id text not null,session_id text not null,package_id text not null,ordinal integer not null,
 status text not null default 'authorized' check(status in ('authorized','notified')),version bigint not null default 1,
 snapshot_json jsonb not null,frozen_hash text not null,completion_json jsonb,completion_hash text,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,session_id,ordinal),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id)
);
create unique index agency_requirement_change_pending on agency_requirement_changes(tenant_id,session_id) where status='authorized';
create table agency_requirement_notice_receipts (
 id text primary key,tenant_id text not null,change_id text not null,participation_id text not null,ordinal integer not null,previous_id text,
 snapshot_json jsonb not null,frozen_hash text not null,created_by text not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,change_id,participation_id,ordinal),foreign key(tenant_id,change_id) references agency_requirement_changes(tenant_id,id),
 foreign key(tenant_id,previous_id) references agency_requirement_notice_receipts(tenant_id,id)
);
alter table agency_final_quote_campaigns add column requirement_changes_json jsonb;
