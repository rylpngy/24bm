package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.application.BudgetControlService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.OrderCancellationContracts.*;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderCancellationService {
  private final PurchaseOrderMapper orders;
  private final OrderCancellationMapper mapper;
  private final OrderAccessService access;
  private final BudgetControlService budget;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final NotificationApplicationService notifications;

  public OrderCancellationService(
      PurchaseOrderMapper orders,
      OrderCancellationMapper mapper,
      OrderAccessService access,
      BudgetControlService budget,
      PermissionService permissions,
      AuditLogApplicationService audit,
      NotificationApplicationService notifications) {
    this.orders = orders;
    this.mapper = mapper;
    this.access = access;
    this.budget = budget;
    this.permissions = permissions;
    this.audit = audit;
    this.notifications = notifications;
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("order cancellation");
  }

  private PurchaseOrder buyer(String id, boolean write) {
    access.requireOrder(id, write ? "buyer:order:manage" : "buyer:order:read");
    String t = TenantAccessGuard.requireTenantId("order cancellation");
    if (write) budget.lock(t);
    var o = write ? orders.lockByTenantAndId(t, id) : orders.findByTenantAndId(t, id);
    if (o == null) throw new IllegalArgumentException("订单不存在");
    return o;
  }

  private PurchaseOrder supplier(String id, boolean write) {
    permissions.require(write ? "supplier:order:manage" : "supplier:order:read");
    String s = TenantAccessGuard.requireSupplierId("order cancellation");
    var o = orders.findBySupplierAndId(s, id);
    if (o == null) throw new IllegalArgumentException("订单不存在");
    if (write) {
      budget.lock(o.tenantId());
      o = orders.lockByTenantAndId(o.tenantId(), id);
    }
    if (o == null || !s.equals(o.supplierId())) throw new IllegalArgumentException("订单不存在");
    return o;
  }

  private List<String> blockers(PurchaseOrder o, boolean pending) {
    var b = new ArrayList<>(mapper.blockers(o.tenantId(), o.id()));
    if (!(pending ? "取消协商中".equals(o.status()) : Set.of("待供应商确认", "待发货").contains(o.status())))
      b.add("仅未发货订单可以申请取消");
    return b;
  }

  private void eligible(PurchaseOrder o, boolean pending) {
    var b = blockers(o, pending);
    if (!b.isEmpty()) throw new IllegalStateException(String.join("；", b));
  }

  @Transactional(readOnly = true)
  public View view(String id, boolean supplier, int page, int size) {
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数无效");
    var o = supplier ? supplier(id, false) : buyer(id, false);
    return new View(
        blockers(o, false),
        mapper.page(o.tenantId(), id, size, (long) (page - 1) * size),
        mapper.count(o.tenantId(), id),
        page,
        size,
        actor());
  }

  @Transactional
  public Entry request(String id, Request request) {
    var o = buyer(id, true);
    var old = mapper.byKey(o.tenantId(), id, request.requestKey());
    if (old != null) {
      if (!old.reason().equals(request.reason().strip()))
        throw new IllegalStateException("同一请求编号不能修改原因");
      return old;
    }
    eligible(o, false);
    String key = "order-cancel-" + UUID.randomUUID();
    mapper.insert(
        key,
        o.tenantId(),
        id,
        o.supplierId(),
        request.requestKey(),
        request.reason().strip(),
        o.status(),
        actor());
    if (orders.updateStatus(o.tenantId(), id, o.status(), "取消协商中") != 1)
      throw new IllegalStateException("订单状态已变化");
    event(o, "requested", request.reason());
    return mapper.find(o.tenantId(), id, key);
  }

  @Transactional
  public Entry decide(String id, String requestId, Decision decision, boolean supplier) {
    var o = supplier ? supplier(id, true) : buyer(id, true);
    var e = mapper.find(o.tenantId(), id, requestId);
    if (e == null) throw new IllegalArgumentException("取消申请不存在");
    String state =
        switch (decision.action()) {
          case "accept" -> "accepted";
          case "reject" -> "rejected";
          case "withdraw" -> "withdrawn";
          default -> throw new IllegalArgumentException("无效操作");
        };
    if (supplier == "withdraw".equals(decision.action()))
      throw new IllegalArgumentException("供应商仅可同意或拒绝；采购方仅可撤回");
    if (!supplier && !actor().equals(e.createdBy())) throw new IllegalStateException("只有原发起人可以撤回");
    if (supplier && actor().equals(e.createdBy()))
      throw new IllegalStateException("发起人与供应商确认人不得为同一账号");
    if (!"pending".equals(e.status())) {
      if (state.equals(e.status())) return e;
      throw new IllegalStateException("申请已结束");
    }
    if ("accepted".equals(state)) eligible(o, true);
    if (!"取消协商中".equals(o.status())) throw new IllegalStateException("订单状态已变化");
    if (mapper.finish(o.tenantId(), id, e.id(), state, decision.reason().strip(), actor()) != 1)
      throw new IllegalStateException("申请已变化");
    if (orders.updateStatus(
            o.tenantId(), id, o.status(), "accepted".equals(state) ? "已取消" : e.previousStatus())
        != 1) throw new IllegalStateException("订单状态已变化");
    if ("accepted".equals(state)) {
      for (String sku : mapper.skuIds(o.tenantId(), id))
        if (mapper.lockSku(sku) == null) throw new IllegalStateException("原始商城SKU缺失，不能推算库存");
      if (mapper.restoreStock(o.tenantId(), id) != mapper.skuIds(o.tenantId(), id).size())
        throw new IllegalStateException("商城库存无法核对，取消未生效");
    }
    event(o, state, decision.reason());
    return mapper.find(o.tenantId(), id, e.id());
  }

  private void event(PurchaseOrder o, String action, String reason) {
    audit.recordTenantAction(
        o.tenantId(), "order.cancellation." + action, "purchase_order", o.id(), reason);
    notifications.notifyActiveTenantUsers(o.tenantId(), "订单取消进度", "订单 " + o.id() + "：" + action);
    notifications.notifyActiveSupplierUsers(
        o.tenantId(), o.supplierId(), "订单取消进度", "订单 " + o.id() + "：" + action);
  }
}
