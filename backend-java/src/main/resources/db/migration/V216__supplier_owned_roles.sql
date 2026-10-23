alter table roles add column supplier_id varchar(120) references enterprises(id);
alter table roles add constraint supplier_role_scope check
  (supplier_id is null or (scope = 'supplier' and tenant_id is null));
create unique index supplier_role_name_unique on roles(supplier_id, lower(btrim(name))) where supplier_id is not null;
