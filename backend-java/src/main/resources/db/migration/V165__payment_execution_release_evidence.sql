alter table payment_execution_records
  add column release_evidence_no varchar(128),
  add column release_remark varchar(512);
