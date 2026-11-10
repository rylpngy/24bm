create table agency_evaluation_rounds (
 id text primary key, tenant_id text not null, package_id text not null,
 ordinal integer not null check(ordinal>0), status text not null default 'draft' check(status in ('draft','frozen','voided')),
 config_json jsonb not null, version bigint not null default 1,
 frozen_json jsonb, frozen_hash text, created_by text not null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), frozen_by text, frozen_at timestamptz, void_reason text not null default '',
 unique(tenant_id,id),unique(tenant_id,package_id,ordinal),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),
 check((frozen_json is null and frozen_hash is null and frozen_at is null and frozen_by is null) or
       (frozen_json is not null and frozen_hash is not null and frozen_at is not null and frozen_by is not null))
);
create index agency_evaluation_round_package on agency_evaluation_rounds(tenant_id,package_id,ordinal desc);
