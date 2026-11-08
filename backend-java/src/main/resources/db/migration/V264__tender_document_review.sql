create table tender_document_reviews (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id),
  fingerprint text not null,
  status text not null check (status in ('processing','approved','rejected')),
  requested_by text not null,
  completed_by text,
  comment text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index tender_document_review_pending on tender_document_reviews(tenant_id,tender_id) where status='processing';
create index tender_document_review_history on tender_document_reviews(tenant_id,tender_id,created_at desc);
