-- Append after the existing school seed version 127; never change applied seed history.
-- Only this isolated tender tenant is enabled. Do not enable modules on original customer tenants.
update tenants set enabled_features=enabled_features || '["rfq"]'::jsonb
where id='tenant-ludong-poc' and not (enabled_features @> '["rfq"]'::jsonb);
