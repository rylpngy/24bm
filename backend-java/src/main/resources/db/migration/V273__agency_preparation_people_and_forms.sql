create table agency_preparation_people (
 id text primary key,tenant_id text not null,package_id text not null,name text not null,organization text not null default '',role text not null,
 status text not null default 'active' check(status in ('active','removed')),version bigint not null default 1,reason text not null,
 created_by text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id)
);
create table agency_preparation_forms (
 id text primary key,tenant_id text not null,package_id text not null,group_id text not null,ordinal integer not null,kind text not null,
 code text not null,title text not null,people_json jsonb not null,basis_json jsonb not null,basis_hash text not null,body_text text not null,
 file_version_id text not null,file_hash text not null,status text not null default 'generated' check(status in ('generated','voided')),
 version bigint not null default 1,supersedes_id text,created_by text not null,created_at timestamptz not null default now(),void_reason text,
 unique(tenant_id,id),unique(tenant_id,group_id,ordinal),unique(tenant_id,code),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,file_version_id) references agency_file_versions(tenant_id,id),
 foreign key(tenant_id,supersedes_id) references agency_preparation_forms(tenant_id,id)
);
create table agency_preparation_returns (
 id text primary key,tenant_id text not null,package_id text not null,form_id text not null,people_json jsonb not null,
 file_version_id text not null,file_hash text not null,signed_on date not null,note text not null,stale_reason text not null default '',
 status text not null default 'recorded' check(status in ('recorded','voided')),version bigint not null default 1,
 created_by text not null,created_at timestamptz not null default now(),void_reason text,unique(tenant_id,id),
 foreign key(tenant_id,package_id) references agency_packages(tenant_id,id),foreign key(tenant_id,form_id) references agency_preparation_forms(tenant_id,id),
 foreign key(tenant_id,file_version_id) references agency_file_versions(tenant_id,id)
);
create table agency_preparation_return_people (
 tenant_id text not null,form_id text not null,person_id text not null,return_id text not null,active boolean not null default true,
 primary key(tenant_id,return_id,person_id),foreign key(tenant_id,form_id) references agency_preparation_forms(tenant_id,id),
 foreign key(tenant_id,person_id) references agency_preparation_people(tenant_id,id),foreign key(tenant_id,return_id) references agency_preparation_returns(tenant_id,id)
);
create unique index agency_preparation_current_signature on agency_preparation_return_people(tenant_id,form_id,person_id) where active;
create index agency_preparation_forms_package on agency_preparation_forms(tenant_id,package_id,created_at desc);
create index agency_preparation_returns_package on agency_preparation_returns(tenant_id,package_id,created_at desc);
