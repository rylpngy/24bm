create table agency_discussion_plans (
 tenant_id text not null,session_id text not null,package_id text not null,mode text not null check(mode in ('legacy','active')),version bigint not null default 1,
 subjects_json jsonb not null,basis_json jsonb not null,frozen_hash text,created_by text not null,created_at timestamptz not null default now(),
 primary key(tenant_id,session_id),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id)
);
-- Mark pre-existing offline records explicitly; APIs cannot create new legacy exemptions.
insert into agency_discussion_plans(tenant_id,session_id,package_id,mode,subjects_json,basis_json,created_by)
 select s.tenant_id,s.id,s.package_id,'legacy','[]'::jsonb,'{"reason":"pre-existing offline assessment; preserve historical procedure evidence"}'::jsonb,'migration:V282'
 from agency_assessment_sessions s join agency_packages p on p.tenant_id=s.tenant_id and p.id=s.package_id
 where p.procurement_method in ('竞争性谈判','竞争性磋商');
create table agency_supplier_discussions (
 id text primary key,tenant_id text not null,session_id text not null,participation_id text not null,ordinal integer not null,previous_id text,
 status text not null default 'draft' check(status in ('draft','confirmed','void')),version bigint not null default 1,content_json jsonb not null,
 frozen_json jsonb,frozen_hash text,created_by text not null,created_at timestamptz not null default now(),confirmed_by text,confirmed_at timestamptz,void_reason text,
 unique(tenant_id,id),unique(tenant_id,session_id,participation_id,ordinal),foreign key(tenant_id,session_id) references agency_assessment_sessions(tenant_id,id),
 foreign key(tenant_id,previous_id) references agency_supplier_discussions(tenant_id,id)
);
create unique index agency_discussion_open_draft on agency_supplier_discussions(tenant_id,session_id,participation_id) where status='draft';
alter table agency_final_quote_campaigns add column discussion_manifest_json jsonb not null default '[]'::jsonb;
alter table agency_final_quote_campaigns add column discussion_fingerprint text;
