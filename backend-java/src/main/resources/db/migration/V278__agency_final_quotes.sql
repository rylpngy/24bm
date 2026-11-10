create table agency_final_quote_campaigns (
 id text primary key, tenant_id text not null, session_id text not null, package_id text not null,
 status text not null default 'collecting' check(status in ('collecting','confirmed')), version bigint not null default 1,
 cutoff_at timestamptz not null, initiated_at timestamptz not null, subjects_json jsonb not null, scope_hash text not null, exclusions_json jsonb not null,
 requirements_version_id text not null, requirements_hash text not null, notice_version_id text not null, notice_hash text not null,
 reason text not null, created_by text not null, created_at timestamptz not null default now(),
 confirmed_at timestamptz, confirmation_version_id text, confirmation_hash text, decisions_json jsonb, confirmation_note text,
 unique(tenant_id,id), unique(tenant_id,session_id), check(cutoff_at>initiated_at),
 foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),
 foreign key(tenant_id,requirements_version_id) references agency_file_versions(tenant_id,id),
 foreign key(tenant_id,notice_version_id) references agency_file_versions(tenant_id,id),
 foreign key(tenant_id,confirmation_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_final_quote_receipts (
 id text primary key, tenant_id text not null, campaign_id text not null, participation_id text not null, file_id text not null,
 amount numeric(20,2) not null check(amount>=0), currency text not null, received_at timestamptz not null,
 original_type text not null check(original_type in ('paper_scan','electronic_copy')), source_note text not null, late_entry_reason text not null,
 status text not null default 'received' check(status in ('received','withdrawn')), withdraw_reason text,
 created_by text not null, created_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,file_id),
 foreign key(tenant_id,campaign_id) references agency_final_quote_campaigns(tenant_id,id),
 foreign key(tenant_id,file_id) references agency_files(tenant_id,id)
);
create unique index agency_final_quote_active on agency_final_quote_receipts(tenant_id,campaign_id,participation_id) where status='received';
