alter table attachment_upload_tickets
  add column content_size bigint,
  add column content_sha256 varchar(64),
  add constraint upload_ticket_integrity_pair check (
    (content_size is null and content_sha256 is null)
    or (content_size is not null and content_sha256 is not null and content_size >= 0 and content_sha256 ~ '^[0-9a-f]{64}$'));

alter table attachments
  add column content_size bigint,
  add column content_sha256 varchar(64),
  add constraint attachment_integrity_pair check (
    (content_size is null and content_sha256 is null)
    or (content_size is not null and content_sha256 is not null and content_size >= 0 and content_sha256 ~ '^[0-9a-f]{64}$'));

-- Historical files have no trusted upload-time baseline. Do not infer hashes from current objects.
