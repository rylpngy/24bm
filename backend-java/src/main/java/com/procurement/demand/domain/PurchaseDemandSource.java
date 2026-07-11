package com.procurement.demand.domain;

// 需求登记来源:部门申报 = 业务部门正常发起;直录登记 = 采购部门在计划/询价节点直接创建,
// 系统反向登记需求以保住业务闭环(需求↔计划回链、品类支出与预算口径)。
public final class PurchaseDemandSource {
  public static final String DEPARTMENT = "部门申报";
  public static final String DIRECT = "直录登记";

  private PurchaseDemandSource() {}
}
