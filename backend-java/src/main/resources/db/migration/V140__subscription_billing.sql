-- 平台商业化:订阅套餐(月基础费)+ 各套餐的用量配额与超额单价。
-- 计费 = 月基础费 + Σ 各计量项超额(用量-配额,下限0)× 超额单价。
create table subscription_plans (
  code text primary key,
  name text not null,
  monthly_base_price numeric(12, 2) not null
);

create table plan_quotas (
  plan_code text not null references subscription_plans(code),
  metric text not null,
  included_quota integer not null,
  overage_unit_price numeric(12, 2) not null,
  primary key (plan_code, metric)
);

insert into subscription_plans (code, name, monthly_base_price) values
  ('MVP', '入门版', 999.00),
  ('Growth', '成长版', 2999.00),
  ('Enterprise', '企业版', 9999.00);

-- 计量项:orders 采购订单 / invoices 发票 / rfqs 询价 / users 成员。
insert into plan_quotas (plan_code, metric, included_quota, overage_unit_price) values
  ('MVP', 'orders', 3, 50.00),
  ('MVP', 'invoices', 5, 30.00),
  ('MVP', 'rfqs', 5, 20.00),
  ('MVP', 'users', 3, 100.00),
  ('Growth', 'orders', 50, 40.00),
  ('Growth', 'invoices', 100, 25.00),
  ('Growth', 'rfqs', 50, 15.00),
  ('Growth', 'users', 20, 80.00),
  ('Enterprise', 'orders', 500, 30.00),
  ('Enterprise', 'invoices', 1000, 20.00),
  ('Enterprise', 'rfqs', 500, 10.00),
  ('Enterprise', 'users', 200, 60.00);
