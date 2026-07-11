-- 公开商机报名登记:门户访客对报价中的公开项目报名参与;
-- 采购方审核后可转为正式邀请(报名企业须已是平台认证供应商),接通既有报价链路。
create table rfq_enrollments (
  id text primary key,
  tenant_id text not null references tenants(id),
  rfq_id text not null references rfqs(id),
  company_name text not null,
  contact_name text not null,
  contact_phone text not null,
  note text not null default '',
  status text not null default '待处理' check (status in ('待处理', '已受邀', '已忽略')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rfq_enrollments_tenant_rfq on rfq_enrollments (tenant_id, rfq_id);
-- 同一项目同一企业仅一条待处理报名。
create unique index uq_rfq_enrollments_pending
  on rfq_enrollments (rfq_id, company_name)
  where status = '待处理';
