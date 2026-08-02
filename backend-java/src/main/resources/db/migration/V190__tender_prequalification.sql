-- Track C F-1:招标资格预审。
-- 招标项目可在编制阶段开启资格预审;开启后供应商须先提交预审申请并经招标人审查通过,
-- 方可领取招标文件(投标以已领取为前提,门槛自动继承)。驳回后可修改重新申请。
alter table tenders add column prequalification_required boolean not null default false;

create table tender_prequalifications (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  supplier_id text not null,
  application text not null,          -- 资格声明:业绩、资质、履约能力说明
  status text not null default '待审查',  -- 待审查 / 已通过 / 未通过
  review_comment text,
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (tenant_id, tender_id, supplier_id)
);

create index idx_tender_prequalifications_tender on tender_prequalifications (tenant_id, tender_id, applied_at);
create index idx_tender_prequalifications_supplier on tender_prequalifications (supplier_id);
