CREATE TABLE contract_review_rule_sets (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  name varchar(200) NOT NULL, draft_json jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
  created_by varchar(80) NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contract_review_rule_versions (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  set_id varchar(80) NOT NULL REFERENCES contract_review_rule_sets(id), version integer NOT NULL,
  name varchar(200) NOT NULL, rules_json jsonb NOT NULL,
  created_by varchar(80) NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,set_id,version)
);
CREATE TABLE contract_review_documents (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  contract_id varchar(80) REFERENCES contracts(id), file_name varchar(200) NOT NULL,
  storage_key text NOT NULL, original_sha256 varchar(64) NOT NULL, current_version integer NOT NULL DEFAULT 1,
  limitations_json jsonb NOT NULL, created_by varchar(80) NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contract_review_document_versions (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  document_id varchar(80) NOT NULL REFERENCES contract_review_documents(id), version integer NOT NULL,
  segments_json jsonb NOT NULL, text_sha256 varchar(64) NOT NULL,
  created_by varchar(80) NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,document_id,version)
);
CREATE TABLE contract_review_runs (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  document_id varchar(80) NOT NULL REFERENCES contract_review_documents(id), document_version integer NOT NULL,
  rules_version_id varchar(80) NOT NULL REFERENCES contract_review_rule_versions(id), perspective varchar(10) NOT NULL,
  mode varchar(40) NOT NULL, model varchar(120), limitation text,
  findings_json jsonb NOT NULL, created_by varchar(80) NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contract_review_decisions (
  id varchar(80) PRIMARY KEY, tenant_id varchar(80) NOT NULL REFERENCES tenants(id),
  document_id varchar(80) NOT NULL REFERENCES contract_review_documents(id), run_id varchar(80) NOT NULL REFERENCES contract_review_runs(id),
  finding_id varchar(80) NOT NULL, action varchar(20) NOT NULL CHECK(action IN ('adopt','dismiss')),
  old_version integer NOT NULL, new_version integer NOT NULL, locator varchar(160),
  before_text text NOT NULL, after_text text NOT NULL, comment varchar(2000) NOT NULL,
  actor_id varchar(80) NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,run_id,finding_id)
);
CREATE INDEX contract_review_documents_tenant ON contract_review_documents(tenant_id,created_at DESC);
CREATE INDEX contract_review_runs_document ON contract_review_runs(tenant_id,document_id,created_at DESC);
CREATE INDEX contract_review_decisions_document ON contract_review_decisions(tenant_id,document_id,created_at DESC);
