create table receipt_disposition_reviews (
  id text primary key,
  tenant_id text not null references tenants(id),
  receipt_id text not null references receipts(id),
  decision varchar(30) not null check (decision in ('让步接收', '维持退货换货')),
  reason varchar(2000) not null check (length(btrim(reason)) between 1 and 2000),
  evidence_no varchar(500) not null check (length(btrim(evidence_no)) between 1 and 500),
  reviewed_by text not null references users(id),
  reviewed_at timestamptz not null default now(),
  unique (tenant_id, receipt_id)
);

create function receipt_disposition_review_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Receipt disposition reviews are immutable';
end;
$$;
create trigger receipt_disposition_review_immutable
  before update or delete on receipt_disposition_reviews
  for each row execute function receipt_disposition_review_immutable();
