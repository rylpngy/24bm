-- 需求登记来源:部门申报(默认,业务部门发起)/ 直录登记(采购部门在计划或询价节点直接创建,
-- 系统反向登记需求以保住「需求→计划→询价→订单」闭环与品类/预算口径)。
alter table purchase_demands
  add column source text not null default '部门申报';
