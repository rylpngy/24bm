-- 竞价方式专属参数:起拍价与最小降价步长(竞价截止时间复用 rfqs.deadline_at)。
alter table rfqs
  add column if not exists auction_start_price numeric(18, 2),
  add column if not exists auction_min_decrement numeric(18, 2);
