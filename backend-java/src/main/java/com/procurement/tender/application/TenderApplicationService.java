package com.procurement.tender.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.tender.api.DistributeTenderRequest;
import com.procurement.tender.api.SaveTenderRequest;
import com.procurement.tender.api.TenderAcquisitionResponse;
import com.procurement.tender.api.TenderResponse;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderAcquisition;
import com.procurement.tender.domain.TenderPolicy;
import com.procurement.tender.infrastructure.TenderAcquisitionMapper;
import com.procurement.tender.infrastructure.TenderMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 招标筹备(Track C C-1):招标文件编制 → 发布发售 → 邀请发放 / 公开领取。
 * 招标文件正文对供应商的可见性以领取记录为准(受邀发放或公开自助领取后可见)。
 */
@Service
public class TenderApplicationService {
  private static final DateTimeFormatter NO_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
  private static final String AUDIT_TARGET = "tender";

  private final TenderMapper tenderMapper;
  private final TenderAcquisitionMapper acquisitionMapper;
  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public TenderApplicationService(
      TenderMapper tenderMapper,
      TenderAcquisitionMapper acquisitionMapper,
      SupplierProfileApplicationService supplierProfileApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.tenderMapper = tenderMapper;
    this.acquisitionMapper = acquisitionMapper;
    this.supplierProfileApplicationService = supplierProfileApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  // ── 买方:编制 / 发布 / 发放 ─────────────────────────────────
  public List<TenderResponse> listCurrentTenantTenders() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    return tenderMapper.listByTenant(tenantId).stream()
        .map(t -> toResponse(t, acquisitionMapper.listByTender(tenantId, t.id()), true))
        .toList();
  }

  @Transactional
  public TenderResponse create(SaveTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    String userId = TenantAccessGuard.requireUserId("buyer tender APIs");
    requireTenderType(request.tenderType());
    String id = "tender-" + UUID.randomUUID();
    String prefix = "ZB" + LocalDate.now().format(NO_DATE);
    String tenderNo = prefix
        + String.format(Locale.ROOT, "%03d", tenderMapper.countByTenantAndNoPrefix(tenantId, prefix) + 1);
    tenderMapper.insert(
        id, tenantId, tenderNo, request.title(), request.tenderType(), request.budget(),
        TenderPolicy.STATUS_DRAFTING, request.documentHtml(), request.evaluationMethod(),
        request.bidBondAmount(), request.acquisitionDeadline(), request.submissionDeadline(),
        request.openingAt(), userId);
    auditLogApplicationService.recordTenantAction("tender.created", AUDIT_TARGET, id);
    return toResponse(tenderMapper.findByTenantAndId(tenantId, id), List.of(), true);
  }

  @Transactional
  public TenderResponse updateDraft(String tenderId, SaveTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTender(tenantId, tenderId);
    TenderPolicy.requireDrafting(tender.status(), tenderId);
    requireTenderType(request.tenderType());
    tenderMapper.updateDraft(
        tenantId, tenderId, request.title(), request.tenderType(), request.budget(),
        request.documentHtml(), request.evaluationMethod(), request.bidBondAmount(),
        request.acquisitionDeadline(), request.submissionDeadline(), request.openingAt());
    auditLogApplicationService.recordTenantAction("tender.updated", AUDIT_TARGET, tenderId);
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  @Transactional
  public TenderResponse publish(String tenderId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTender(tenantId, tenderId);
    TenderPolicy.requirePublishable(tender, OffsetDateTime.now());
    tenderMapper.updateStatus(tenantId, tenderId, TenderPolicy.STATUS_ON_SALE, OffsetDateTime.now());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.published", AUDIT_TARGET, tenderId,
        tender.tenderType() + "「" + tender.title() + "」招标文件开始发售");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  @Transactional
  public TenderResponse distribute(String tenderId, DistributeTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTender(tenantId, tenderId);
    TenderPolicy.requireInvitedDistribution(tender);
    for (String supplierId : request.supplierIds()) {
      acquisitionMapper.insertIgnore(
          "tacq-" + UUID.randomUUID(), tenantId, tenderId, supplierId, "邀请发放", null);
    }
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.distributed", AUDIT_TARGET, tenderId, "定向发放 " + request.supplierIds().size() + " 家");
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId, "招标文件已定向发放", tender.title() + " 招标文件已发放至受邀供应商。");
    return toResponse(tender, acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  // ── 供应商:可见清单 / 领取 ──────────────────────────────────
  public List<TenderResponse> listSupplierTenders() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    List<TenderAcquisition> mine = acquisitionMapper.listBySupplier(supplierId);
    var mineByTender = new java.util.HashMap<String, TenderAcquisition>();
    mine.forEach(a -> mineByTender.put(a.tenderId(), a));

    var result = new java.util.LinkedHashMap<String, TenderResponse>();
    for (Tender t : acquisitionMapper.listTendersBySupplier(supplierId)) {
      result.put(t.id(), supplierView(t, mineByTender.get(t.id())));
    }
    for (Tender t : acquisitionMapper.listOpenOnSale()) {
      result.putIfAbsent(t.id(), supplierView(t, mineByTender.get(t.id())));
    }
    return List.copyOf(result.values());
  }

  @Transactional
  public TenderResponse acquire(String tenderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    TenderAcquisition existing = acquisitionMapper.listBySupplier(supplierId).stream()
        .filter(a -> a.tenderId().equals(tenderId))
        .findFirst()
        .orElse(null);
    OffsetDateTime now = OffsetDateTime.now();
    if (existing == null) {
      TenderPolicy.requireOpenAcquirable(tender, now);
      acquisitionMapper.insertIgnore(
          "tacq-" + UUID.randomUUID(), tender.tenantId(), tenderId, supplierId, "公开领取", now);
    } else {
      acquisitionMapper.markAcquired(tender.tenantId(), tenderId, supplierId, now);
    }
    auditLogApplicationService.recordTenantAction(
        tender.tenantId(), "tender.acquired", AUDIT_TARGET, tenderId);
    return supplierView(
        tender,
        acquisitionMapper.listBySupplier(supplierId).stream()
            .filter(a -> a.tenderId().equals(tenderId))
            .findFirst()
            .orElse(null));
  }

  private Tender findTenderForSupplier(String tenderId, String supplierId) {
    return acquisitionMapper.listTendersBySupplier(supplierId).stream()
        .filter(t -> t.id().equals(tenderId))
        .findFirst()
        .or(() -> acquisitionMapper.listOpenOnSale().stream()
            .filter(t -> t.id().equals(tenderId))
            .findFirst())
        .orElseThrow(() -> new IllegalArgumentException("招标项目不存在或不可见: " + tenderId));
  }

  // 供应商视角:未领取(无 acquired_at)时不下发招标文件正文;领取记录仅含本方。
  private TenderResponse supplierView(Tender tender, TenderAcquisition mine) {
    boolean acquired = mine != null && mine.acquiredAt() != null;
    List<TenderAcquisitionResponse> acquisitions = mine == null
        ? List.of()
        : List.of(new TenderAcquisitionResponse(
            mine.supplierId(), null, mine.source(), mine.acquiredAt()));
    return new TenderResponse(
        tender.id(), tender.tenantId(), tender.tenderNo(), tender.title(), tender.tenderType(),
        tender.budget(), tender.status(), acquired ? tender.documentHtml() : null,
        tender.evaluationMethod(), tender.bidBondAmount(), tender.acquisitionDeadline(),
        tender.submissionDeadline(), tender.openingAt(), tender.publishedAt(), tender.createdAt(),
        acquisitions);
  }

  private TenderResponse toResponse(Tender tender, List<TenderAcquisition> acquisitions, boolean withNames) {
    return new TenderResponse(
        tender.id(), tender.tenantId(), tender.tenderNo(), tender.title(), tender.tenderType(),
        tender.budget(), tender.status(), tender.documentHtml(), tender.evaluationMethod(),
        tender.bidBondAmount(), tender.acquisitionDeadline(), tender.submissionDeadline(),
        tender.openingAt(), tender.publishedAt(), tender.createdAt(),
        acquisitions.stream()
            .map(a -> new TenderAcquisitionResponse(
                a.supplierId(),
                withNames ? supplierProfileApplicationService.findSupplierDisplayName(a.supplierId()) : null,
                a.source(),
                a.acquiredAt()))
            .toList());
  }

  private Tender requireTender(String tenantId, String tenderId) {
    Tender tender = tenderMapper.findByTenantAndId(tenantId, tenderId);
    if (tender == null) {
      throw new IllegalArgumentException("Tender not found in tenant scope: " + tenderId);
    }
    return tender;
  }

  private static void requireTenderType(String type) {
    if (!TenderPolicy.TYPE_OPEN.equals(type) && !TenderPolicy.TYPE_INVITED.equals(type)) {
      throw new IllegalArgumentException("招标方式须为 公开招标 或 邀请招标: " + type);
    }
  }
}
