create table agency_evaluation_controls (
 tenant_id text not null,round_id text not null,package_id text not null,state text not null default 'active' check(state in ('active','paused','terminated')),
 version bigint not null default 0,updated_by text not null,updated_at timestamptz not null default now(),primary key(tenant_id,round_id),
 foreign key(tenant_id,round_id) references agency_evaluation_rounds(tenant_id,id)
);
create table agency_evaluation_incidents (
 id text primary key,tenant_id text not null,round_id text not null,package_id text not null,kind text not null,title text not null,occurred_at timestamptz not null,
 responsible_id text not null,responsible_name text not null,impact_scope text not null,description text not null,
 evidence_version_id text not null,evidence_hash text not null,effect text not null check(effect in ('observe','pause')),
 restoration_conditions text not null,status text not null default 'open' check(status in ('open','resolved')),version bigint not null default 1,
 created_by text not null,created_at timestamptz not null default now(),resolution_json jsonb,resolved_by text,resolved_at timestamptz,
 unique(tenant_id,id),foreign key(tenant_id,round_id) references agency_evaluation_rounds(tenant_id,id),
 foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
create index agency_incidents_round on agency_evaluation_incidents(tenant_id,round_id,created_at desc);
create table agency_evaluation_control_events (
 id text primary key,tenant_id text not null,round_id text not null,control_version bigint not null,action text not null,
 before_state text not null,after_state text not null,incident_id text,cases_fingerprint text not null,evidence_version_id text not null,evidence_hash text not null,
 reason text not null,actor_id text not null,created_at timestamptz not null default now(),
 unique(tenant_id,round_id,control_version),foreign key(tenant_id,round_id) references agency_evaluation_rounds(tenant_id,id),
 foreign key(tenant_id,incident_id) references agency_evaluation_incidents(tenant_id,id),foreign key(tenant_id,evidence_version_id) references agency_file_versions(tenant_id,id)
);
