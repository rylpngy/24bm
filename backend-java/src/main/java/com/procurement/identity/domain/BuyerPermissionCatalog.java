package com.procurement.identity.domain;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// 采购方可分配权限点目录:角色权限矩阵的列定义。仅收录真实生效的权限点
// (服务层 PermissionService.require 实际校验的 + 管理员通配 + 本功能自身的管理权限)。
public final class BuyerPermissionCatalog {

  public record Point(String point, String label, String group) {}

  public static final List<Point> POINTS = List.of(
      new Point("buyer:*", "全部权限(管理员)", "全局"),
      new Point("buyer:role:manage", "管理角色与权限", "管理"),
      new Point("buyer:workflow:manage", "配置与发布流程", "流程"),
      new Point("buyer:workflow:read", "查看流程与任务历史", "流程"),
      new Point("buyer:workflow:review", "办理审批任务", "流程"),
      new Point("buyer:demand:create", "新建需求", "需求"),
      new Point("buyer:demand:read", "查看需求", "需求"),
      new Point("buyer:rfq:read", "查看询比", "询比"),
      new Point("buyer:material:read", "查看物料", "物料"),
      new Point("buyer:contract:read", "查看合同", "合同"),
      new Point("buyer:invoice:read", "查看发票", "财务"),
      new Point("buyer:payment:register", "登记付款", "财务"),
      new Point("buyer:variance:approve", "审批对账差异", "财务"),
      new Point("buyer:report:export", "导出报表", "报表"));

  private static final Set<String> VALID =
      POINTS.stream().map(Point::point).collect(Collectors.toUnmodifiableSet());

  private BuyerPermissionCatalog() {}

  public static boolean isValid(String point) {
    return VALID.contains(point);
  }
}
