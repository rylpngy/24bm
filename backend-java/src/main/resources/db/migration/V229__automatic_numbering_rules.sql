create table numbering_rules (
  tenant_id text not null references tenants(id),
  business_type text not null check (business_type in ('demand', 'tender')),
  prefix text not null check (prefix ~ '^[A-Za-z0-9_-]{0,20}$'),
  date_format text not null check (date_format in ('none', 'yyyy', 'yyyyMM', 'yyyyMMdd')),
  width integer not null check (width between 1 and 9),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, business_type),
  check (not enabled or length(prefix) > 0)
);

-- Shared namespace is intentional: demand IDs are global primary keys. Retain every issued code,
-- including ambiguous rendered prefixes (A + 001 versus A0 + 01), across all rule revisions.
create table numbering_reservations (
  business_type text not null check (business_type in ('demand', 'tender')),
  number text not null,
  tenant_id text not null references tenants(id),
  primary key (business_type, number)
);
insert into numbering_reservations(business_type, number, tenant_id)
select 'demand', id, tenant_id from purchase_demands on conflict do nothing;
insert into numbering_reservations(business_type, number, tenant_id)
select 'tender', tender_no, tenant_id from tenders on conflict do nothing;

-- Do not replace or reset demand_number_sequences (V203).
create table tender_number_sequences (
  prefix text primary key,
  last_value bigint not null check (last_value > 0)
);
