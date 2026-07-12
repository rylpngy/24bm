-- 采购公告体系:项目级公告(采购/变更/定标/终止),由业务事件自动模板化生成,门户公开可见。
create table if not exists rfq_announcements (
  id text primary key,
  tenant_id text not null references tenants (id),
  rfq_id text not null,
  type text not null, -- 采购公告 / 变更公告 / 定标公告 / 终止公告
  title text not null,
  summary text, -- 模板化正文摘要(由真实业务字段生成)
  method text, -- 采购方式(冗余,公告展示用)
  deadline_at timestamptz, -- 报价截止(采购/变更公告)
  evaluation_method text,
  quote_requirement text,
  delivery_requirement text,
  awarded_supplier_name text, -- 定标公告:中标供应商
  award_amount numeric(18, 2), -- 定标公告:中标含税总价
  close_reason text, -- 终止公告:流标/废标原因
  published_at timestamptz not null default now()
);

create index idx_rfq_announcements_tenant_rfq on rfq_announcements (tenant_id, rfq_id, published_at desc);
create index idx_rfq_announcements_published on rfq_announcements (published_at desc);
