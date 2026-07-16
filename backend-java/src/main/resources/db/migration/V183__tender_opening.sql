-- Track C C-3:定时开标 + 解密唱标。
-- 到达开标时间后招标人执行开标:招标状态 发售中→已开标,密封投标解封(已密封→已开启),
-- 解封时按内容复算 SHA-256 与密封指纹核验(核验结果实时计算,不落库)。
alter table tenders add column opened_at timestamptz;
