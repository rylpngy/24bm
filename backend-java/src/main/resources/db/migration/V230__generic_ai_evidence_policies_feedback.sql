create table ai_policies (
  id text primary key,
  tenant_id text not null references tenants(id),
  policy_key text not null check (policy_key ~ '^[a-zA-Z0-9_-]{1,80}$'),
  version integer not null check (version > 0),
  title text not null check (length(title) between 1 and 200),
  content text not null check (octet_length(content) <= 64000),
  status text not null check (status in ('draft','published','retired')),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id,policy_key,version),
  unique (tenant_id,id)
);
create unique index uq_ai_policy_published on ai_policies(tenant_id,policy_key) where status='published';

create table ai_review_runs (
  id text primary key,
  tenant_id text not null references tenants(id),
  subject_type text not null check (subject_type in ('demand','attachment','supplier','procurement_risk')),
  subject_id text not null,
  source_revision text not null,
  payload text not null check (octet_length(payload) <= 256000),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by text not null references users(id),
  created_at timestamptz not null,
  unique(tenant_id,id)
);
create index idx_ai_reviews_subject on ai_review_runs(tenant_id,subject_type,subject_id,created_at desc,id desc);

create table ai_review_feedback (
  id text primary key,
  tenant_id text not null,
  run_id text not null,
  finding_id text not null,
  reviewer_id text not null references users(id),
  disposition text not null check (disposition in ('adopted','dismissed','needs_review')),
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(tenant_id,run_id) references ai_review_runs(tenant_id,id),
  unique(tenant_id,run_id,finding_id,reviewer_id)
);

create function ai_casefile_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'AI case files are immutable';
end;
$$;
create trigger ai_review_runs_immutable before update on ai_review_runs
  for each row execute function ai_casefile_immutable();

create function ai_policy_content_immutable() returns trigger language plpgsql as $$
begin
  if (new.id,new.tenant_id,new.policy_key,new.version,new.title,new.content,new.source_hash,new.created_by,new.created_at)
    is distinct from (old.id,old.tenant_id,old.policy_key,old.version,old.title,old.content,old.source_hash,old.created_by,old.created_at) then
    raise exception 'AI policy content is immutable; create a new version';
  end if;
  return new;
end;
$$;
create trigger ai_policy_content_immutable before update on ai_policies
  for each row execute function ai_policy_content_immutable();
