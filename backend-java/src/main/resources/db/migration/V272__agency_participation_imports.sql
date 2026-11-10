create table agency_participation_imports (
 id text primary key, tenant_id text not null, package_id text not null, source_version_id text not null,
 source_hash text not null, source_name text not null, rows_json jsonb not null,
 status text not null check(status in ('preview','invalid','committed')), version bigint not null default 1,
 result_json jsonb not null default '{}',created_by text not null,created_at timestamptz not null default now(),
 committed_by text,committed_at timestamptz,unique(tenant_id,id),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),
 foreign key(tenant_id,source_version_id) references agency_file_versions(tenant_id,id)
);
alter table agency_participations add column import_id text;
alter table agency_participations add column source_row integer;
alter table agency_participations add constraint agency_participation_import_fk foreign key(tenant_id,import_id) references agency_participation_imports(tenant_id,id);
create unique index agency_participation_import_row on agency_participations(tenant_id,import_id,source_row) where import_id is not null;
