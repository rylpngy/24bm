-- Review decisions remain separate from immutable content snapshots.
create table agency_document_review_contexts (
 tenant_id varchar(64) not null,
 workflow_id varchar(128) not null,
 revision_id varchar(128) not null,
 waived_issues_json text not null,
 exception_reason text not null,
 created_by varchar(64) not null,
 created_at timestamptz not null default now(),
 primary key (tenant_id,workflow_id)
);
create index agency_document_review_context_revision on agency_document_review_contexts(tenant_id,revision_id);
