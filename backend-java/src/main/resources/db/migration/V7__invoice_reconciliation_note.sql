alter table invoices
  add column if not exists reconciliation_note text;
