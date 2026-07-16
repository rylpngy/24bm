-- 招标文件发售/领取记录:邀请招标=定向发放(acquired_at 空表示尚未确认领取),
-- 公开招标=供应商自助领取(报名)。领取后方可查看招标文件正文,并成为后续投标资格前提。
create table tender_acquisitions (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  supplier_id text not null,
  source text not null,                     -- 邀请发放 / 公开领取
  acquired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, tender_id, supplier_id)
);

create index idx_tender_acq_tender on tender_acquisitions (tenant_id, tender_id);
create index idx_tender_acq_supplier on tender_acquisitions (supplier_id);
