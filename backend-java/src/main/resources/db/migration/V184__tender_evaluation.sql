-- Track C C-4:评标委员会与评分表。
-- 开标后组建评标委员会(≥3 人且单数),逐评委对每份有效投标打技术/商务分(0-100);
-- 价格分按最低有效报价自动折算,综合得分服务端汇总(不落库,实时计算)。
create table tender_evaluators (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  evaluator_name text not null,
  evaluator_role text not null default '成员',   -- 组长 / 成员
  created_at timestamptz not null default now()
);

create index idx_tender_evaluators_tender on tender_evaluators (tenant_id, tender_id);

create table tender_scores (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  bid_id text not null references tender_bids(id) on delete cascade,
  evaluator_id text not null references tender_evaluators(id) on delete cascade,
  technical_score numeric(5, 2) not null,
  commercial_score numeric(5, 2) not null,
  comment text,
  scored_at timestamptz not null default now(),
  unique (tenant_id, evaluator_id, bid_id)
);

create index idx_tender_scores_tender on tender_scores (tenant_id, tender_id);
