-- Buyer-maintained supplier data belongs to the tenant relationship, not the public enterprise.
-- Do not backfill shared contact/bank values: historical writes do not identify their owning tenant.
alter table buyer_supplier_relations
    add column credit_code text,
    add column legal_person text,
    add column business_scope text,
    add column contact_name text,
    add column contact_phone text,
    add column contact_email text,
    add column bank_name text,
    add column bank_account text;
