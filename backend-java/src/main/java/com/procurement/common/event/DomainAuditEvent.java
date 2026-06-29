package com.procurement.common.event;

// 领域审计事件:跨模块审计解耦的载体。业务服务 publish 此事件而非直接调审计服务;
// 审计模块的监听器同步落库(同线程/同事务,沿用 TenantContext 取 tenant/actor)。
public record DomainAuditEvent(String action, String targetType, String targetId) {}
