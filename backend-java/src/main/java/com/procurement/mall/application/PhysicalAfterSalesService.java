package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.api.PhysicalAfterSalesContracts.*;
import com.procurement.mall.domain.*;
import com.procurement.mall.infrastructure.*;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.OrderAccessService;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhysicalAfterSalesService {
  public record Proof(byte[] bytes, String fileName, String sha256) {}

  private final MallServiceMapper cases;
  private final PhysicalAfterSalesMapper mapper;
  private final OrderAccessService access;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final NotificationApplicationService notifications;

  public PhysicalAfterSalesService(
      MallServiceMapper cases,
      PhysicalAfterSalesMapper mapper,
      OrderAccessService access,
      PermissionService permissions,
      AuditLogApplicationService audit,
      NotificationApplicationService notifications) {
    this.cases = cases;
    this.mapper = mapper;
    this.access = access;
    this.permissions = permissions;
    this.audit = audit;
    this.notifications = notifications;
  }

  private MallAfterSales require(String id, boolean supplier, boolean write) {
    MallAfterSales a;
    if (supplier) {
      permissions.require(write ? "supplier:order:manage" : "supplier:order:read");
      a = cases.findForSupplier(TenantAccessGuard.requireSupplierId("physical after-sales"), id);
    } else {
      a = cases.findForBuyer(TenantAccessGuard.requireTenantId("physical after-sales"), id);
      if (a != null)
        access.requireOrder(a.orderId(), write ? "buyer:mall:purchase" : "buyer:order:read");
    }
    if (a == null) throw new IllegalArgumentException("售后记录不存在或无权访问");
    if (write) {
      cases.lockOrder(a.tenantId(), a.orderId());
      a = cases.lockForBuyer(a.tenantId(), id);
      if (mapper.settlementLocked(a.tenantId(), a.orderId())
          || mapper.archived(a.tenantId(), a.orderId())
          || cases.projectLiquidated(a.tenantId(), a.orderId()))
        throw new IllegalStateException("订单正在清算或已归档，禁止修改实物责任");
    }
    return a;
  }

  public View view(String id, boolean supplier) {
    var a = require(id, supplier, false);
    return view(a, supplier);
  }

  private View view(MallAfterSales a, boolean supplier) {
    var events = mapper.events(a.tenantId(), a.id());
    String last = events.isEmpty() ? "" : events.getLast().kind();
    String financial =
        a.type().equals("退货") ? "实物退回不等于退款；须在订单合同清算中完成退款、红冲核对及预算结算" : "同价同数量换货，不新增应付款";
    var actions = PhysicalAfterSalesPolicy.actions(a.type(), a.status(), last, supplier);
    if (!actions.isEmpty()
        && (mapper.settlementLocked(a.tenantId(), a.orderId())
            || mapper.archived(a.tenantId(), a.orderId())
            || cases.projectLiquidated(a.tenantId(), a.orderId()))) actions = List.of();
    return new View(last.isEmpty() ? "待寄回" : last, actions, events, financial);
  }

  @Transactional
  public View act(String id, Action r, boolean supplier) {
    var a = require(id, supplier, true);
    byte[] bytes;
    try {
      bytes = Base64.getDecoder().decode(r.fileBase64());
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("凭证文件编码无效");
    }
    if (bytes.length == 0 || bytes.length > 2097152)
      throw new IllegalArgumentException("请上传不超过2MB的凭证原件");
    if (r.fileName().contains("/")
        || r.fileName().contains("\\")
        || r.fileName().chars().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("文件名无效");
    String sha = sha(bytes);
    var before = view(a, supplier);
    var existing =
        before.events().stream()
            .filter(e -> e.requestKey().equals(r.requestKey()))
            .findFirst()
            .orElse(null);
    if (existing != null) {
      if (!existing.kind().equals(r.kind())
          || existing.quantity().compareTo(r.quantity()) != 0
          || !existing.referenceNo().equals(r.referenceNo())
          || !existing.note().equals(r.note())
          || !existing.fileName().equals(r.fileName())
          || !existing.sha256().equals(sha)
          || !existing.actorId().equals(TenantAccessGuard.requireUserId("physical evidence")))
        throw new IllegalStateException("同一请求编号内容不同");
      return before;
    }
    if (!before.actions().contains(r.kind()))
      throw new IllegalStateException("当前阶段或岗位不能执行该实物操作，请刷新");
    if (a.quantity().compareTo(r.quantity()) != 0
        || mapper.received(a.tenantId(), a.orderLineId()).compareTo(a.quantity()) < 0)
      throw new IllegalStateException("实物交接数量须等于本售后单数量，且不能超过原收货量；分批请分单申请");
    if (r.kind().equals("return_dispatch")
        && cases
                .claimedQuantity(a.tenantId(), a.orderLineId())
                .compareTo(mapper.received(a.tenantId(), a.orderLineId()))
            > 0) throw new IllegalStateException("累计售后数量超过已收货数量，请先核对分单");
    var values = new HashMap<String, Object>();
    values.put("id", "map-" + UUID.randomUUID());
    values.put("tenant", a.tenantId());
    values.put("caseId", id);
    values.put("key", r.requestKey());
    values.put("kind", r.kind());
    values.put("quantity", r.quantity());
    values.put("reference", r.referenceNo());
    values.put("note", r.note());
    values.put("name", r.fileName());
    values.put("bytes", bytes);
    values.put("sha", sha);
    values.put("actor", TenantAccessGuard.requireUserId("physical evidence"));
    values.put("role", supplier ? "supplier" : "buyer");
    mapper.insert(values);
    audit.recordTenantAction(
        a.tenantId(),
        "mall_after_sales.physical." + r.kind(),
        "mall_service",
        id + " / " + values.get("id") + " / SHA256=" + sha);
    if (supplier)
      notifications.notifyActiveTenantUsers(a.tenantId(), "售后实物进度", id + "：" + r.kind());
    else
      notifications.notifyActiveSupplierUsers(
          a.tenantId(), a.supplierId(), "售后实物进度", id + "：" + r.kind());
    return view(a, supplier);
  }

  public void requireReady(MallAfterSales a) {
    if (!List.of("退货", "换货").contains(a.type())) return;
    var events = mapper.events(a.tenantId(), a.id());
    String last = events.isEmpty() ? "" : events.getLast().kind();
    if (!PhysicalAfterSalesPolicy.ready(a.type(), last))
      throw new IllegalStateException("退货须完成寄回及签收；换货须完成补发及买方合格复验，不能仅凭回复完成");
  }

  public Proof file(String id, String event, boolean supplier) {
    var a = require(id, supplier, false);
    var file = mapper.file(a.tenantId(), id, event);
    if (file == null || !sha(file.bytes()).equals(file.sha256()))
      throw new IllegalStateException("凭证不存在或完整性校验失败");
    return new Proof(file.bytes(), file.fileName(), file.sha256());
  }

  public static String sha(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
