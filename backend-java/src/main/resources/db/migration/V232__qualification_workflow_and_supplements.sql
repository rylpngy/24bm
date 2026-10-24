create table qualification_workflow_attempts (
  id text primary key, tenant_id text not null references tenants(id),
  review_id bigint not null references supplier_qualification_reviews(id),
  workflow_instance_id text, reason varchar(2000) not null,
  status text not null check(status in ('processing','completed','cancelled')),
  created_by text not null references users(id), created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index qualification_one_active_workflow on qualification_workflow_attempts(review_id) where status='processing';
create index qualification_attempt_history on qualification_workflow_attempts(tenant_id,review_id,created_at desc,id);

create table qualification_supplement_requests (
  id text primary key, tenant_id text not null references tenants(id),
  relation_id text not null references buyer_supplier_relations(id),
  qualification_id text not null references supplier_qualifications(id),
  reason varchar(2000) not null, due_date date not null,
  status text not null check(status in ('requested','submitted','returned','closed','cancelled')),
  revision bigint not null default 0, response varchar(2000), replacement_id text references supplier_qualifications(id),
  created_by text not null references users(id), responded_by text references users(id),
  created_at timestamptz not null default now(), responded_at timestamptz, closed_at timestamptz
);
create unique index qualification_one_open_supplement on qualification_supplement_requests(relation_id,qualification_id)
  where status in ('requested','submitted','returned');
create index qualification_supplement_tenant on qualification_supplement_requests(tenant_id,created_at desc,id);
