-- Track C 招投标(2.0)C-1:招标项目与招标文件。
-- 独立于询比(rfqs)的限界上下文——招标流程(文件发售/资格/开评标/评委)与询比状态机差异大,不复用。
create table tenders (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_no text not null,
  title text not null,
  tender_type text not null,               -- 公开招标 / 邀请招标
  budget numeric(18, 2),
  status text not null default '编制中',    -- 编制中 → 发售中 → 已截止(后续切片扩展开评标态)
  document_html text,                       -- 招标文件正文(富文本;渲染端白名单消毒)
  evaluation_method text,                   -- 综合评分法 / 最低评标价法
  bid_bond_amount numeric(18, 2),           -- 投标保证金
  acquisition_deadline timestamptz,         -- 文件获取截止
  submission_deadline timestamptz,          -- 投标递交截止
  opening_at timestamptz,                   -- 开标时间
  owner_id text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tender_no)
);

create index idx_tenders_tenant on tenders (tenant_id);
create index idx_tenders_status on tenders (tenant_id, status);
