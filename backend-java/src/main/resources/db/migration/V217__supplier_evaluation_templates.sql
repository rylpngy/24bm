create table supplier_evaluation_templates (
  id text primary key,
  tenant_id text not null references tenants(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id,id)
);

create table supplier_evaluation_template_versions (
  id text primary key,
  tenant_id text not null,
  template_id text not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  version integer not null check (version > 0),
  quality_weight numeric not null check (quality_weight between 0 and 100),
  delivery_weight numeric not null check (delivery_weight between 0 and 100),
  price_weight numeric not null check (price_weight between 0 and 100),
  service_weight numeric not null check (service_weight between 0 and 100),
  created_at timestamptz not null default now(),
  check (quality_weight + delivery_weight + price_weight + service_weight = 100),
  foreign key (tenant_id,template_id) references supplier_evaluation_templates(tenant_id,id),
  unique (tenant_id,template_id,version),
  unique (tenant_id,id)
);

alter table supplier_performance_tasks add column template_version_id text;
alter table supplier_performance_tasks add foreign key (tenant_id,template_version_id)
  references supplier_evaluation_template_versions(tenant_id,id);
alter table supplier_evaluations add column scoring_snapshot jsonb;

-- Existing rows remain untouched: NULL means the original 35/30/20/15 template.
create function preserve_supplier_evaluation_template_version() returns trigger language plpgsql as $$
begin
  raise exception 'Evaluation template versions are immutable';
end;
$$;
create trigger supplier_evaluation_template_versions_immutable
  before update or delete on supplier_evaluation_template_versions
  for each row execute function preserve_supplier_evaluation_template_version();

create function preserve_supplier_evaluation_scoring() returns trigger language plpgsql as $$
begin
  if new.scoring_snapshot is distinct from old.scoring_snapshot
      or new.total_score is distinct from old.total_score
      or new.quality_score is distinct from old.quality_score
      or new.delivery_score is distinct from old.delivery_score
      or new.price_score is distinct from old.price_score
      or new.service_score is distinct from old.service_score then
    raise exception 'Historical evaluation scoring is immutable';
  end if;
  return new;
end;
$$;
create trigger supplier_evaluation_scoring_immutable before update on supplier_evaluations
  for each row execute function preserve_supplier_evaluation_scoring();

create function preserve_supplier_task_template_version() returns trigger language plpgsql as $$
begin
  if new.template_version_id is distinct from old.template_version_id then
    raise exception 'Assigned evaluation template version is immutable';
  end if;
  return new;
end;
$$;
create trigger supplier_task_template_version_immutable before update on supplier_performance_tasks
  for each row execute function preserve_supplier_task_template_version();
