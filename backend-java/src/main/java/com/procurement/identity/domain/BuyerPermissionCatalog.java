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
      new Point("buyer:role:manage", "企业全权管理员（组织、角色与配置）", "管理"),
      new Point("buyer:ai:read", "查看AI评审记录（仍需业务数据权限）", "AI辅助"),
      new Point("buyer:ai:use", "发起AI评审与记录人工反馈", "AI辅助"),
      new Point("buyer:ai:manage", "维护AI制度依据版本", "AI辅助"),
      new Point("buyer:analytics:read", "查看采购分析", "报表"),
      new Point("buyer:budget:read", "查看部门预算", "预算"),
      new Point("buyer:project:read", "查看项目库", "项目"),
      new Point("buyer:project:manage", "申报立项及项目执行管理", "项目"),
      new Point("buyer:budget:manage", "设置部门预算", "预算"),
      new Point("buyer:audit:read", "查看企业审计台账(需全部数据范围)", "管理"),
      new Point("buyer:workflow:manage", "配置与发布流程", "流程"),
      new Point("buyer:workflow:read", "查看流程与任务历史", "流程"),
      new Point("buyer:workflow:review", "办理审批任务", "流程"),
      new Point("buyer:ludong-poc:read", "查看鲁东申报材料", "鲁东 POC"),
      new Point("buyer:ludong-poc:write", "填报鲁东申报材料", "鲁东 POC"),
      new Point("buyer:ludong-poc:review", "审核鲁东申报材料", "鲁东 POC"),
      new Point("buyer:ludong-poc:export", "下载鲁东归档表格", "鲁东 POC"),
      new Point("buyer:demand:create", "新建需求", "需求"),
      new Point("buyer:demand:read", "查看需求", "需求"),
      new Point("buyer:rfq:read", "查看询比", "询比"),
      new Point("buyer:rfq:manage", "管理报价附件", "询比"),
      new Point("buyer:tender:read", "查看招标项目与附件", "招标"),
      new Point("buyer:tender:manage", "管理招标项目与附件", "招标"),
      new Point("buyer:mall:read", "查看商城目录与个人购物车", "商城"),
      new Point("buyer:mall:purchase", "商城采购、售后与评价", "商城"),
      new Point("buyer:mall:manage", "维护货架、审核商品与企业地址", "商城"),
      new Point("buyer:supplier:read", "查看供应商档案与附件", "供应商"),
      new Point("buyer:supplier:manage", "维护供应商与提交准入", "供应商"),
      new Point("buyer:order:read", "查看采购订单与物流", "履约"),
      new Point("buyer:order:manage", "生成与维护采购订单", "履约"),
      new Point("buyer:receipt:read", "查看收货记录", "履约"),
      new Point("buyer:receipt:manage", "登记收货验收", "履约"),
      new Point("buyer:material:read", "查看物料", "物料"),
      new Point("buyer:contract:read", "查看合同", "合同"),
      new Point("buyer:contract:manage", "管理合同附件", "合同"),
      new Point("buyer:invoice:read", "查看发票", "财务"),
      new Point("buyer:payment:register", "登记付款", "财务"),
      new Point("buyer:payment:reverse", "冲销付款登记", "财务"),
      new Point("buyer:payment:reconcile", "登记历史付款核对依据", "财务"),
      new Point("buyer:variance:approve", "审批对账差异", "财务"),
      new Point("buyer:report:export", "导出报表", "报表"));

  private static final Set<String> VALID =
      POINTS.stream().map(Point::point).collect(Collectors.toUnmodifiableSet());

  private BuyerPermissionCatalog() {}

  public static boolean isValid(String point) {
    return VALID.contains(point);
  }
}
