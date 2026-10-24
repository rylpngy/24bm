create table external_identity_bindings (
  id varchar(80) primary key,
  tenant_id varchar(80) not null references tenants(id),
  user_id varchar(80) not null references users(id),
  issuer varchar(500) not null,
  subject varchar(255) not null,
  enabled boolean not null default true,
  revision integer not null default 1,
  valid_after bigint not null,
  reason varchar(1000) not null,
  created_by varchar(80) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, subject)
);
create index external_identity_tenant_page on external_identity_bindings(tenant_id, created_at desc, id);
