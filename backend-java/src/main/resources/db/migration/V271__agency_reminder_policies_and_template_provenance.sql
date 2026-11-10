create table agency_plan_reminder_policies (
 tenant_id text not null, milestone_id text not null, package_id text not null,
 settings_json jsonb not null, version bigint not null default 1, reason text not null,
 updated_by text not null, updated_at timestamptz not null default now(),
 primary key(tenant_id,milestone_id), foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),
 foreign key(milestone_id) references agency_milestones(id)
);
create table agency_reminder_deliveries (
 id text primary key, tenant_id text not null, package_id text not null, milestone_id text not null,
 milestone_version bigint not null, policy_version bigint not null, recipient_id text not null,
 level text not null, due_at timestamptz not null, status text not null default 'pending'
 check(status in ('pending','failed','delivered','cancelled')), attempts integer not null default 0,
 next_attempt_at timestamptz default now(), sent_at timestamptz, error_text text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(milestone_id) references agency_milestones(id)
);
create index agency_reminder_delivery_retry on agency_reminder_deliveries(tenant_id,status,next_attempt_at,id);
create index agency_reminder_delivery_package on agency_reminder_deliveries(tenant_id,package_id,created_at desc);
alter table agency_template_versions add column source_date date;
alter table agency_template_versions add column policy_version text not null default '';
alter table agency_template_versions add column origin_template_version_id text references agency_template_versions(id);
