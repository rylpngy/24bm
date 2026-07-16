-- Track C C-2:投标文件加密递交。
-- 每家一份在案(重投=覆盖内容并重算指纹);递交即密封——开标(C-3)前对招标人不下发内容,
-- content_digest 为密封凭证(递交时按内容计算 SHA-256,开标后可核验未被篡改)。
create table tender_bids (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  supplier_id text not null,
  bid_amount numeric(18, 2),
  document_html text,
  content_digest text not null,
  sealed_status text not null default '已密封',   -- 已密封 / 已撤回(留痕) / 已开启(C-3)
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (tenant_id, tender_id, supplier_id)
);

create index idx_tender_bids_tender on tender_bids (tenant_id, tender_id);
create index idx_tender_bids_supplier on tender_bids (supplier_id);
