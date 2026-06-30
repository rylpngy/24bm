-- 询比价澄清答疑:受邀供应商对 RFQ 提问,采购方答复;答复可广播给全部受邀供应商。
create table rfq_clarifications (
  id varchar(64) primary key,
  tenant_id varchar(64) not null,
  rfq_id varchar(64) not null,
  supplier_id varchar(64) not null,
  question text not null,
  answer text,
  answered_by varchar(64),
  published boolean not null default false,
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);
create index idx_rfq_clarifications_rfq on rfq_clarifications (tenant_id, rfq_id);
