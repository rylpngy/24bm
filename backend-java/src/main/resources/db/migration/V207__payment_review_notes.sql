create table invoice_payment_review_notes (
    id varchar(100) primary key,
    tenant_id varchar(100) not null references tenants(id),
    invoice_id varchar(100) not null references invoices(id),
    idempotency_key varchar(100) not null,
    reported_paid_amount numeric(14,2) check (reported_paid_amount >= 0),
    evidence_reference varchar(500) not null,
    explanation varchar(2000) not null,
    snapshot text not null,
    created_by varchar(100) not null references users(id),
    created_at timestamptz not null default now(),
    unique (tenant_id, invoice_id, idempotency_key)
);
create index idx_payment_review_invoice on invoice_payment_review_notes(tenant_id, invoice_id, created_at desc);
