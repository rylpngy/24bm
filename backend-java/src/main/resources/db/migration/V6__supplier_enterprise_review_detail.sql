alter table supplier_enterprises
  add column if not exists review_comment text,
  add column if not exists profile_confirmed boolean not null default false,
  add column if not exists risk_confirmed boolean not null default false;
