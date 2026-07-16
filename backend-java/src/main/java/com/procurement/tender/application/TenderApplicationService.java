package com.procurement.tender.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.tender.api.DistributeTenderRequest;
import com.procurement.tender.api.SaveTenderRequest;
import com.procurement.tender.api.TenderAcquisitionResponse;
import com.procurement.tender.api.SubmitTenderBidRequest;
import com.procurement.tender.api.TenderBidResponse;
import com.procurement.tender.api.TenderResponse;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderAcquisition;
import com.procurement.tender.domain.TenderBid;
import com.procurement.tender.domain.TenderBidPolicy;
import com.procurement.tender.domain.TenderPolicy;
import com.procurement.tender.infrastructure.TenderAcquisitionMapper;
import com.procurement.tender.infrastructure.TenderBidMapper;
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
  private final TenderBidMapper bidMapper;
  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public TenderApplicationService(
      TenderMapper tenderMapper,
      TenderAcquisitionMapper acquisitionMapper,
      TenderBidMapper bidMapper,
      SupplierProfileApplicationService supplierProfileApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.tenderMapper = tenderMapper;
    this.acquisitionMapper = acquisitionMapper;
    this.bidMapper = bidMapper;
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

  // ── 买方:定时开标 + 解密唱标 ────────────────────────────────
  @Transactional
  public TenderResponse openTender(String tenderId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTender(tenantId, tenderId);
    OffsetDateTime now = OffsetDateTime.now();
    TenderPolicy.requireOpenable(tender, now);
    tenderMapper.markOpened(tenantId, tenderId, TenderPolicy.STATUS_OPENED, now);
    int unsealed = bidMapper.markAllOpened(tenantId, tenderId);
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.opened", AUDIT_TARGET, tenderId,
        "「" + tender.title() + "」开标,解封密封投标 " + unsealed + " 份");
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId, "开标唱标", tender.title() + " 已开标,投标报价与指纹核验结果已公示。");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
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

  // ── 供应商:投标递交(密封)/ 撤回 ─────────────────────────────
  @Transactional
  public TenderBidResponse submitBid(String tenderId, SubmitTenderBidRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    OffsetDateTime now = OffsetDateTime.now();
    TenderBidPolicy.requireSubmissionWindow(tender, now);
    TenderBidPolicy.requireAcquired(myAcquisition(tenderId, supplierId), tenderId);
    TenderBidPolicy.requireValidBid(request.bidAmount(), request.documentHtml(), tenderId);
    String digest = sha256(bidDigestPayload(
        tenderId, supplierId, request.bidAmount(), request.documentHtml()));
    bidMapper.upsert(
        "tbid-" + UUID.randomUUID(), tender.tenantId(), tenderId, supplierId,
        request.bidAmount(), request.documentHtml(), digest, now);
    auditLogApplicationService.recordTenantAction(
        tender.tenantId(), "tender.bid_submitted", AUDIT_TARGET, tenderId);
    notificationApplicationService.notifyActiveTenantUsers(
        tender.tenantId(), "收到密封投标", tender.title() + " 收到一份密封投标(开标前内容不可见)。");
    return supplierBidView(myBid(tenderId, supplierId));
  }

  @Transactional
  public TenderBidResponse withdrawBid(String tenderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    OffsetDateTime now = OffsetDateTime.now();
    TenderBidPolicy.requireSubmissionWindow(tender, now);
    TenderBidPolicy.requireSealed(myBid(tenderId, supplierId), tenderId);
    bidMapper.withdraw(tender.tenantId(), tenderId, supplierId, now);
    auditLogApplicationService.recordTenantAction(
        tender.tenantId(), "tender.bid_withdrawn", AUDIT_TARGET, tenderId);
    return supplierBidView(myBid(tenderId, supplierId));
  }

  // 电子签署入口:取本方投标(esign 计算内容指纹用),非本方或不存在即抛错。
  public TenderBid findSupplierOwnBid(String bidId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    return bidMapper.listBySupplier(supplierId).stream()
        .filter(b -> b.id().equals(bidId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Tender bid not found for supplier: " + bidId));
  }

  private TenderBid myBid(String tenderId, String supplierId) {
    return bidMapper.listBySupplier(supplierId).stream()
        .filter(b -> b.tenderId().equals(tenderId))
        .findFirst()
        .orElse(null);
  }

  private TenderAcquisition myAcquisition(String tenderId, String supplierId) {
    return acquisitionMapper.listBySupplier(supplierId).stream()
        .filter(a -> a.tenderId().equals(tenderId))
        .findFirst()
        .orElse(null);
  }

  private TenderBidResponse supplierBidView(TenderBid bid) {
    if (bid == null) return null;
    return new TenderBidResponse(
        bid.id(), bid.tenderId(), bid.supplierId(), null, bid.bidAmount(), bid.documentHtml(),
        bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(), null);
  }

  // 买方封存视图:开标(C-3)前只回递交登记——供应商名/时间/密封状态/指纹,金额与正文置空。
  private TenderBidResponse sealedBidView(TenderBid bid) {
    return new TenderBidResponse(
        bid.id(), bid.tenderId(), bid.supplierId(),
        supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId()),
        null, null, bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(),
        null);
  }

  // 唱标视图(开标后):金额与核验结果公示;投标函正文仅买方或本方可见,他方不下发。
  // 已撤回的投标保留登记但不解封内容(金额/正文均不公示)。
  private TenderBidResponse openedBidView(TenderBid bid, boolean withDocument) {
    boolean withdrawn = TenderBidPolicy.WITHDRAWN.equals(bid.sealedStatus());
    return new TenderBidResponse(
        bid.id(), bid.tenderId(), bid.supplierId(),
        supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId()),
        withdrawn ? null : bid.bidAmount(),
        withdrawn || !withDocument ? null : bid.documentHtml(),
        bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(),
        withdrawn ? null : verifyBidDigest(bid));
  }

  // 唱标排序:有效投标按报价升序;已撤回的殿后留痕。
  private List<TenderBidResponse> openingRoll(Tender tender, java.util.function.Predicate<TenderBid> withDocument) {
    return bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .map(b -> openedBidView(b, withDocument.test(b)))
        .sorted(java.util.Comparator
            .comparing((TenderBidResponse r) -> r.bidAmount() == null)
            .thenComparing(TenderBidResponse::bidAmount,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
        .toList();
  }

  // 解封核验:按当前存储内容复算 SHA-256,与递交时密封指纹比对。
  private boolean verifyBidDigest(TenderBid bid) {
    return sha256(bidDigestPayload(bid.tenderId(), bid.supplierId(), bid.bidAmount(), bid.documentHtml()))
        .equals(bid.contentDigest());
  }

  // 金额入摘要前规格化(去尾零),避免 numeric 回读尾零(188000.00)与递交原文(188000)不一致。
  private static String bidDigestPayload(
      String tenderId, String supplierId, java.math.BigDecimal amount, String documentHtml) {
    String amountKey = amount == null ? "" : amount.stripTrailingZeros().toPlainString();
    return "tender-bid|tender:" + tenderId + "|supplier:" + supplierId
        + "|amount:" + amountKey + "|doc:" + documentHtml;
  }

  private static String sha256(String content) {
    try {
      var md = java.security.MessageDigest.getInstance("SHA-256");
      return java.util.HexFormat.of().formatHex(md.digest(content.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Content digest failed", e);
    }
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
  // 开标前投标仅本方完整视图;开标后为唱标公示(各家名称/金额/核验),他方正文不下发。
  private TenderResponse supplierView(Tender tender, TenderAcquisition mine) {
    boolean acquired = mine != null && mine.acquiredAt() != null;
    String mySupplierId = mine == null ? "" : mine.supplierId();
    List<TenderAcquisitionResponse> acquisitions = mine == null
        ? List.of()
        : List.of(new TenderAcquisitionResponse(
            mine.supplierId(), null, mine.source(), mine.acquiredAt()));
    List<TenderBidResponse> bids = tender.openedAt() != null
        ? openingRoll(tender, b -> b.supplierId().equals(mySupplierId))
        : java.util.stream.Stream.of(supplierBidView(myBid(tender.id(), mySupplierId)))
            .filter(java.util.Objects::nonNull)
            .toList();
    return new TenderResponse(
        tender.id(), tender.tenantId(), tender.tenderNo(), tender.title(), tender.tenderType(),
        tender.budget(), tender.status(), acquired ? tender.documentHtml() : null,
        tender.evaluationMethod(), tender.bidBondAmount(), tender.acquisitionDeadline(),
        tender.submissionDeadline(), tender.openingAt(), tender.publishedAt(), tender.createdAt(),
        acquisitions, bids, tender.openedAt());
  }

  private TenderResponse toResponse(Tender tender, List<TenderAcquisition> acquisitions, boolean withNames) {
    List<TenderBidResponse> bids = tender.openedAt() != null
        ? openingRoll(tender, b -> true)
        : bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
            .map(this::sealedBidView)
            .toList();
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
            .toList(),
        bids, tender.openedAt());
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
