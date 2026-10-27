-- Enable only the isolated school tender POC; retain all existing tenant features.
update tenants t
set enabled_features = t.enabled_features || coalesce((
  select jsonb_agg(feature)
  from (values ('order'), ('contract'), ('finance')) requested(feature)
  where not t.enabled_features @> jsonb_build_array(feature)
), '[]'::jsonb)
where t.id = 'tenant-ludong-poc';
