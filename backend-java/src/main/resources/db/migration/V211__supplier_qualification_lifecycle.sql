create table supplier_qualification_uploads (
  storage_key text primary key,
  supplier_id text not null,
  file_name text not null,
  state text not null default 'issued',
  expires_at timestamptz not null,
  content_sha256 text,
  content_size bigint
);
alter table supplier_qualifications add column replaced_by text references supplier_qualifications(id);
create table supplier_qualification_events (
  id bigserial primary key,
  supplier_id text not null,
  qualification_id text not null references supplier_qualifications(id),
  replacement_id text references supplier_qualifications(id),
  action text not null,
  actor_id text not null,
  created_at timestamptz not null default now()
);
