package com.procurement.common.event;

// 领域审计事件:跨模块审计解耦的载体。业务服务 publish 此事件而非直接调审计服务;
// 审计模块的监听器同步落库(同线程/同事务,沿用 TenantContext 取 tenant/actor)。
// detail 可选,记录「改了什么」(如 角色: 财务专员 → 采购管理员);三参构造默认 detail=null。
public record DomainAuditEvent(String action, String targetType, String targetId, String detail) {
  public DomainAuditEvent(String action, String targetType, String targetId) {
    this(action, targetType, targetId, null);
  }
}
