-- Track C C-9:评标问询与二次报价。
-- 评标中,评标委员会(由招标人代录)可向指定投标人发出「澄清问询」或「二次报价」邀请;
-- 投标人在线答复(二次报价须给出修订报价)。修订报价不改动密封投标原件(指纹链不破),
-- 评标价格分按"最新有效报价"(最近一次已答复的二次报价修订价,否则原投标价)计算。
create table tender_inquiries (
  id text primary key,
  tenant_id text not null references tenants(id),
  tender_id text not null references tenders(id) on delete cascade,
  bid_id text not null references tender_bids(id) on delete cascade,
  kind text not null,               -- 澄清问询 / 二次报价
  question text not null,
  asked_at timestamptz not null default now(),
  answer text,
  revised_amount numeric(18, 2),    -- 二次报价:修订后含税总价
  answered_at timestamptz
);

create index idx_tender_inquiries_tender on tender_inquiries (tenant_id, tender_id, asked_at);
create index idx_tender_inquiries_bid on tender_inquiries (bid_id);
