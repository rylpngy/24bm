-- Track C C-6:流标与重新招标。
-- 开标后、定标前可宣布流标(原因必填留痕);流标项目可一键重新招标:
-- 复制标的要素与招标文件正文新建「编制中」草稿(新编号,时间节点须重新设定),
-- rebid_of_tender_id 记录溯源链。
alter table tenders add column failed_at timestamptz;
alter table tenders add column failure_reason text;
alter table tenders add column rebid_of_tender_id text references tenders(id);
