create table attachment_upload_tickets (
  storage_key text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references users(id),
  owner_type text not null,
  owner_id text not null,
  file_name text not null,
  visibility text not null,
  token_hash text not null,
  state text not null check (state in ('issued', 'uploading', 'uploaded', 'registered', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index attachment_upload_tickets_expiry_idx on attachment_upload_tickets(expires_at);
create index purchase_demands_tenant_page_idx on purchase_demands(tenant_id, created_at desc, id desc);
