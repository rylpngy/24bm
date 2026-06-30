-- 中标通知书数字签名(电子签章防伪):对规范化通知内容做 HMAC-SHA256 签名,可验签防篡改。
alter table rfq_award_notices add column signature varchar(128);
