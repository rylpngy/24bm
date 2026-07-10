-- 询比邀请生命周期:已读回执(viewed_at)与拒绝参与(decline_reason);配合 RFQ 草稿→发布流程。
alter table rfq_invites
  add column if not exists viewed_at timestamptz,
  add column if not exists decline_reason text;
