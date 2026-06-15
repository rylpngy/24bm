create table supplier_qualifications (
  id text primary key,
  supplier_id text not null references enterprises(id),
  qualification_type text not null,
  certificate_no text,
  expires_at date,
  file_name text not null,
  storage_key text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_supplier_qualifications_supplier
  on supplier_qualifications (supplier_id, status);
