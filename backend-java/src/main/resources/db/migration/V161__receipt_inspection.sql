-- 收货验收质检:验收结论(全部合格/部分合格/全部不合格)+ 不合格处置(退货换货/让步接收)。
alter table receipts add column inspection_conclusion varchar(16);
alter table receipts add column disposition varchar(16);
alter table receipts add column disposition_note text;
