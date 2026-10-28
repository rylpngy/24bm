create table rfq_quotation_policies (
  tenant_id text not null references tenants(id), rfq_id text not null references rfqs(id),
  full_quote_required boolean not null default false, auto_extend boolean not null default false,
  extension_hours integer not null default 24 check(extension_hours between 1 and 720),
  max_auto_extensions integer not null default 2 check(max_auto_extensions between 0 and 5),
  primary key(tenant_id,rfq_id)
);
create table quote_submission_files (
  id text primary key, tenant_id text not null references tenants(id), rfq_id text not null references rfqs(id),
  supplier_id text not null references enterprises(id), file_name text not null, storage_key text not null unique,
  content_size bigint not null, sha256 text not null, uploaded_by text not null references users(id),
  created_at timestamptz not null default clock_timestamp()
);
create table quote_versions (
  id text primary key, tenant_id text not null references tenants(id), quote_id text not null references quotes(id),
  rfq_id text not null references rfqs(id), supplier_id text not null references enterprises(id),
  version_no integer not null check(version_no>0), round integer not null, source text not null,
  actor_id text references users(id), snapshot_json jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,quote_id,version_no)
);
create index quote_versions_supplier on quote_versions(supplier_id,rfq_id,created_at);
create table rfq_deadline_extensions (
  id text primary key, tenant_id text not null references tenants(id), rfq_id text not null references rfqs(id),
  round integer not null, old_deadline timestamptz not null, new_deadline timestamptz not null,
  mode text not null check(mode in ('automatic','manual')), valid_quote_count integer not null,
  reason text not null, actor_id text references users(id), created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,rfq_id,round,old_deadline), check(new_deadline>old_deadline)
);
