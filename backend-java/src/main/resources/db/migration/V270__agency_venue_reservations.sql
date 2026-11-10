alter table agency_preparations add column scheduled_end_at timestamptz;
alter table agency_preparations add column purpose text not null default '';
create index agency_preparation_venue_slot on agency_preparations(tenant_id,venue,scheduled_at,scheduled_end_at);
