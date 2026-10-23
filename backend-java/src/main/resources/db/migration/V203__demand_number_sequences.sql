-- Demand IDs are global primary keys, so counters must be shared across tenants.
create table demand_number_sequences (
  prefix text primary key,
  last_value bigint not null check (last_value > 0)
);
