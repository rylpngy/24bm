alter table approval_tasks
  add column if not exists review_comment text;
