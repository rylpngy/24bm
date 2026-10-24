create table procurement_execution_archives (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  sha256 varchar(64) not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  remark varchar(1000) not null check (length(btrim(remark)) between 1 and 1000),
  zip_data bytea not null,
  unique (tenant_id, rfq_id, sha256)
);
create index procurement_execution_archives_rfq_idx
  on procurement_execution_archives(tenant_id, rfq_id, created_at desc);

create function procurement_execution_archive_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Procurement execution archives are immutable snapshots';
end;
$$;
create trigger procurement_execution_archive_immutable
  before update or delete on procurement_execution_archives
  for each row execute function procurement_execution_archive_immutable();
