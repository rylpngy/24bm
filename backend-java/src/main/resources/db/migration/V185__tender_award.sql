-- Track C C-5:定标 + 中标公示 + 中标通知书(电子签章)。
-- 评标(C-4)推荐中标人为默认定标依据;定标后签发中标通知书(富文本),
-- 招标人电子签章经 esign 模块(targetType=tender-award)与中标投标密封指纹绑定。
alter table tenders add column awarded_bid_id text references tender_bids(id);
alter table tenders add column awarded_at timestamptz;
alter table tenders add column award_notice_html text;
