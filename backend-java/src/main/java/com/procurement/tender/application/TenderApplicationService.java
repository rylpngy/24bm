package com.procurement.tender.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.RfqAnnouncementService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.tender.api.AnswerTenderInquiryRequest;
import com.procurement.tender.api.ApplyPrequalificationRequest;
import com.procurement.tender.api.AwardTenderRequest;
import com.procurement.tender.api.DistributeTenderRequest;
import com.procurement.tender.api.ExecuteTenderRequest;
import com.procurement.tender.api.FailTenderRequest;
import com.procurement.tender.api.FormCommitteeRequest;
import com.procurement.tender.api.SaveTenderRequest;
import com.procurement.tender.api.SendTenderInquiryRequest;
import com.procurement.tender.api.SubmitScoresRequest;
import com.procurement.tender.api.SubmitTenderBidRequest;
import com.procurement.tender.api.TenderAcquisitionResponse;
import com.procurement.tender.api.TenderBidEvaluationSummary;
import com.procurement.tender.api.TenderBidResponse;
import com.procurement.tender.api.TenderEvaluatorResponse;
import com.procurement.tender.api.TenderInquiryResponse;
import com.procurement.tender.api.TenderPrequalificationResponse;
import com.procurement.tender.api.ReviewPrequalificationRequest;
import com.procurement.tender.api.SetPrequalificationRequest;
import com.procurement.tender.api.TenderResponse;
import com.procurement.tender.api.TenderScoreResponse;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderAcquisition;
import com.procurement.tender.domain.TenderBid;
import com.procurement.tender.domain.TenderBidPolicy;
import com.procurement.tender.domain.TenderEvaluationPolicy;
import com.procurement.tender.domain.TenderEvaluator;
import com.procurement.tender.domain.TenderInquiry;
import com.procurement.tender.domain.TenderInquiryPolicy;
import com.procurement.tender.domain.TenderPolicy;
import com.procurement.tender.domain.TenderPrequalification;
import com.procurement.tender.domain.TenderPrequalificationPolicy;
import com.procurement.tender.domain.TenderScore;
import com.procurement.tender.infrastructure.TenderAcquisitionMapper;
import com.procurement.tender.infrastructure.TenderBidMapper;
import com.procurement.tender.infrastructure.TenderEvaluationMapper;
import com.procurement.tender.infrastructure.TenderInquiryMapper;
import com.procurement.tender.infrastructure.TenderPrequalificationMapper;
import com.procurement.tender.infrastructure.TenderMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 招标筹备(Track C C-1):招标文件编制 → 发布发售 → 邀请发放 / 公开领取。
 * 招标文件正文对供应商的可见性以领取记录为准(受邀发放或公开自助领取后可见)。
 */
@Service
public class TenderApplicationService {
  private static final String AUDIT_TARGET = "tender";

  private final TenderMapper tenderMapper;
  private final TenderAcquisitionMapper acquisitionMapper;
  private final TenderBidMapper bidMapper;
  private final TenderEvaluationMapper evaluationMapper;
  private final TenderInquiryMapper inquiryMapper;
  private final TenderPrequalificationMapper prequalificationMapper;
  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final RfqAnnouncementService rfqAnnouncementService;
  private final TenantCapabilityApplicationService tenantCapabilityApplicationService;
  private final com.procurement.identity.application.PermissionService permissions;
  private final com.procurement.identity.application.DataScopeService scopes;
  private com.procurement.numbering.application.NumberingApplicationService numbering;

  @org.springframework.beans.factory.annotation.Autowired
  void setNumberingApplicationService(com.procurement.numbering.application.NumberingApplicationService numbering) {
    this.numbering = numbering;
  }

  private String nextTenderNumber() {
    return numbering == null
        ? com.procurement.numbering.application.NumberingApplicationService.defaultNumber(
            "tender", null, tenderMapper::allocateSequence)
        : numbering.nextTenderNumber(tenderMapper::allocateSequence);
  }

  public TenderApplicationService(
      TenderMapper tenderMapper,
      TenderAcquisitionMapper acquisitionMapper,
      TenderBidMapper bidMapper,
      TenderEvaluationMapper evaluationMapper,
      TenderInquiryMapper inquiryMapper,
      TenderPrequalificationMapper prequalificationMapper,
      SupplierProfileApplicationService supplierProfileApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      RfqAnnouncementService rfqAnnouncementService,
      TenantCapabilityApplicationService tenantCapabilityApplicationService,
      com.procurement.identity.application.PermissionService permissions,
      com.procurement.identity.application.DataScopeService scopes) {
    this.tenderMapper = tenderMapper;
    this.acquisitionMapper = acquisitionMapper;
    this.bidMapper = bidMapper;
    this.evaluationMapper = evaluationMapper;
    this.inquiryMapper = inquiryMapper;
    this.prequalificationMapper = prequalificationMapper;
    this.supplierProfileApplicationService = supplierProfileApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.rfqAnnouncementService = rfqAnnouncementService;
    this.tenantCapabilityApplicationService = tenantCapabilityApplicationService;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  // ── 买方:编制 / 发布 / 发放 ─────────────────────────────────
  public List<TenderResponse> listCurrentTenantTenders() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    permissions.require("buyer:tender:read");
    return tenderMapper.listVisibleByTenant(tenantId, scopes.currentUserDataScope()).stream()
        .map(t -> toResponse(t, acquisitionMapper.listByTender(tenantId, t.id()), true))
        .toList();
  }

  @Transactional
  public TenderResponse create(SaveTenderRequest request) {
    permissions.require("buyer:tender:manage");
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    // M-0:招标方式未开通即拒绝立项。
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.TENDER.code());
    String userId = TenantAccessGuard.requireUserId("buyer tender APIs");
    requireTenderType(request.tenderType());
    tenderMapper.lockTenantNumbering(tenantId);
    String id = "tender-" + UUID.randomUUID();
    String tenderNo = nextTenderNumber();
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
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
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
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    tenantCapabilityApplicationService.requireMethodEnabled(tenantId, ProcurementMethodCatalog.TENDER.code());
    if (!"综合评分法".equals(tender.evaluationMethod()) && !"最低评标价法".equals(tender.evaluationMethod())) {
      throw new IllegalArgumentException("评标办法须为综合评分法或最低评标价法");
    }
    TenderPolicy.requirePublishable(tender, OffsetDateTime.now());
    tenderMapper.updateStatus(tenantId, tenderId, TenderPolicy.STATUS_ON_SALE, OffsetDateTime.now());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.published", AUDIT_TARGET, tenderId,
        tender.tenderType() + "「" + tender.title() + "」招标文件开始发售");
    // 公开招标同步门户招标公告;邀请招标定向发放不公开立项公告。
    if (TenderPolicy.TYPE_OPEN.equals(tender.tenderType())) {
      rfqAnnouncementService.onTenderPublished(
          tenantId, tenderId, tender.title(), tender.tenderType(),
          tender.submissionDeadline(), tender.evaluationMethod());
    }
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  @Transactional
  public TenderResponse distribute(String tenderId, DistributeTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderPolicy.requireInvitedDistribution(tender);
    TenderPolicy.requireAcquisitionWindow(tender, OffsetDateTime.now());
    for (String supplierId : request.supplierIds().stream().distinct().sorted().toList()) {
      if (!"已准入".equals(tenderMapper.lockInvitedSupplierStatus(tenantId, supplierId))) {
        throw new IllegalArgumentException("受邀供应商须为本企业已准入供应商: " + supplierId);
      }
      int inserted = acquisitionMapper.insertIgnore(
          "tacq-" + UUID.randomUUID(), tenantId, tenderId, supplierId, "邀请发放", null);
      if (inserted > 0) {
        notificationApplicationService.notifyActiveSupplierUsers(
            tenantId, supplierId, "招标邀请", tender.title() + " 已向贵方发放招标文件,请在获取截止前领取。");
      }
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
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    OffsetDateTime now = OffsetDateTime.now();
    TenderPolicy.requireOpenable(tender, now);
    tenderMapper.markOpened(tenantId, tenderId, TenderPolicy.STATUS_OPENED, now);
    int unsealed = bidMapper.markAllOpened(tenantId, tenderId);
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.opened", AUDIT_TARGET, tenderId,
        "「" + tender.title() + "」开标,解封密封投标 " + unsealed + " 份");
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId, "开标唱标", tender.title() + " 已开标,投标报价与指纹核验结果可在项目详情查看。");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }


  // ── 资格预审(F-1) ──────────────────────────────────────────
  /** 编制阶段设定是否实行资格预审(发布后不得变更)。 */
  @Transactional
  public TenderResponse setPrequalificationRequired(String tenderId, SetPrequalificationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderPrequalificationPolicy.requireToggleable(tender);
    tenderMapper.updatePrequalificationRequired(tenantId, tenderId, request.required());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.prequalification_set", AUDIT_TARGET, tenderId,
        request.required() ? "启用资格预审" : "取消资格预审");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  /** 招标人审查资格预审申请(通过/不通过,意见必填)。 */
  @Transactional
  public TenderResponse reviewPrequalification(
      String tenderId, String applicationId, ReviewPrequalificationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderPolicy.requireAcquisitionWindow(tender, OffsetDateTime.now());
    TenderPrequalification application = prequalificationMapper.listByTender(tenantId, tenderId).stream()
        .filter(a -> a.id().equals(applicationId))
        .findFirst()
        .orElse(null);
    TenderPrequalificationPolicy.requireReviewable(
        tender, application, request.status(), request.reviewComment());
    int updated = prequalificationMapper.review(
        tenantId, applicationId, request.status(), request.reviewComment().trim(), OffsetDateTime.now());
    if (updated == 0) {
      throw new IllegalStateException("该申请已被审查,请刷新查看: " + applicationId);
    }
    String supplierName = supplierProfileApplicationService.findSupplierDisplayName(application.supplierId());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.prequalification_reviewed", AUDIT_TARGET, tenderId,
        "资格预审「" + supplierName + "」" + request.status() + ":" + request.reviewComment().trim());
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId, application.supplierId(), "资格预审结果",
        tender.title() + " 资格预审" + request.status() + ":" + request.reviewComment().trim());
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  /** 供应商提交资格预审申请(驳回后可修改重新提交)。 */
  @Transactional
  public TenderResponse applyPrequalification(String tenderId, ApplyPrequalificationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    TenderPolicy.requireAcquisitionWindow(tender, OffsetDateTime.now());
    TenderPrequalification existing = myPrequalification(tender, supplierId);
    TenderPrequalificationPolicy.requireApplicable(tender, existing, request.application());
    prequalificationMapper.upsert(
        "tpq-" + UUID.randomUUID(), tender.tenantId(), tenderId, supplierId,
        request.application().trim(), OffsetDateTime.now());
    auditLogApplicationService.recordTenantAction(
        tender.tenantId(), "tender.prequalification_applied", AUDIT_TARGET, tenderId);
    notificationApplicationService.notifyActiveTenantUsers(
        tender.tenantId(), "资格预审申请",
        tender.title() + " 收到一份资格预审申请,请在招标详情中审查。");
    return supplierView(tender, myAcquisition(tenderId, supplierId), supplierId);
  }

  private TenderPrequalification myPrequalification(Tender tender, String supplierId) {
    return prequalificationMapper.listBySupplier(supplierId).stream()
        .filter(a -> a.tenderId().equals(tender.id()))
        .findFirst()
        .orElse(null);
  }

  private TenderPrequalificationResponse toPrequalificationResponse(
      TenderPrequalification a, String supplierName) {
    return new TenderPrequalificationResponse(
        a.id(), a.supplierId(), supplierName, a.application(), a.status(),
        a.reviewComment(), a.appliedAt(), a.reviewedAt());
  }

  // ── 买方:中标转执行订单(C-7) ──────────────────────────────
  // 经「招标」锚点 RFQ 生成执行采购订单(单行=中标标的总价),供应商确认后
  // 沿既有 发货→验收→发票→付款→合同 链履约;每个招标项目仅生成一张(幂等)。
  @Transactional
  public TenderResponse executeTender(String tenderId, ExecuteTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    permissions.require("buyer:order:manage");
    if (TenderPolicy.STATUS_AWARDED.equals(tender.status()) && tender.executionOrderId() != null) {
      return toResponse(tender, acquisitionMapper.listByTender(tenantId, tenderId), true);
    }
    TenderPolicy.requireExecutable(tender);
    TenderBid awarded = findAwardedBid(tender);
    requireValidOpenedBid(tender, awarded);
    BigDecimal executionAmount = effectiveAmount(awarded, inquiryMapper.listByTender(tenantId, tenderId));
    String anchorRfqId = rfqApplicationService.createTenderAnchor(
        tender.title() + "(招标转执行)", awarded.supplierId());
    String orderId = purchaseOrderApplicationService.createTenderOrder(
        anchorRfqId, awarded.supplierId(), executionAmount,
        request.expectedReceiptDate(),
        tender.title() + " 中标标的(" + tender.tenderNo() + ")");
    int updated = tenderMapper.markExecuted(tenantId, tenderId, orderId);
    if (updated == 0) {
      throw new IllegalStateException("执行订单已由其他操作生成,请刷新查看: " + tenderId);
    }
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.executed", AUDIT_TARGET, tenderId,
        "中标转执行:采购订单 " + orderId + "(中标价 " + executionAmount + ")");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  // ── 买方:流标 + 重新招标(C-6) ─────────────────────────────
  @Transactional
  public TenderResponse failTender(String tenderId, FailTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderPolicy.requireFailable(tender, request.reason());
    tenderMapper.markFailed(
        tenantId, tenderId, TenderPolicy.STATUS_FAILED, OffsetDateTime.now(), request.reason().trim());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.failed", AUDIT_TARGET, tenderId, "宣布流标:" + request.reason().trim());
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId, "招标流标", tender.title() + " 已宣布流标,可复用要素重新招标。");
    for (TenderAcquisition acquisition : acquisitionMapper.listByTender(tenantId, tenderId)) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId, acquisition.supplierId(), "招标流标",
          tender.title() + " 已宣布流标,原因:" + request.reason().trim());
    }
    rfqAnnouncementService.onTenderFailed(
        tenantId, tenderId, tender.title(), tender.tenderType(), request.reason().trim());
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  // 重新招标:复制标的要素与招标文件正文新建「编制中」草稿(新编号);
  // 时间节点不复制(须按新周期重设),发放/投标/评标记录不迁移(留在原流标项目备查)。
  @Transactional
  public TenderResponse rebidTender(String tenderId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    String userId = TenantAccessGuard.requireUserId("buyer tender APIs");
    Tender origin = requireTenderForUpdate(tenantId, tenderId);
    TenderPolicy.requireRebiddable(origin);
    Tender existing = tenderMapper.findRebid(tenantId, tenderId);
    if (existing != null) {
      scopes.requireCreatorAccess(existing.ownerId());
      return toResponse(existing, acquisitionMapper.listByTender(tenantId, existing.id()), true);
    }
    tenantCapabilityApplicationService.requireMethodEnabled(tenantId, ProcurementMethodCatalog.TENDER.code());
    tenderMapper.lockTenantNumbering(tenantId);
    String id = "tender-" + UUID.randomUUID();
    String tenderNo = nextTenderNumber();
    tenderMapper.insert(
        id, tenantId, tenderNo, origin.title() + "(重招)", origin.tenderType(), origin.budget(),
        TenderPolicy.STATUS_DRAFTING, origin.documentHtml(), origin.evaluationMethod(),
        origin.bidBondAmount(), null, null, null, userId);
    tenderMapper.markRebidOf(tenantId, id, origin.id());
    tenderMapper.updatePrequalificationRequired(tenantId, id, origin.prequalificationRequired());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.rebid", AUDIT_TARGET, id, "由流标项目「" + origin.title() + "」(" + origin.tenderNo() + ")重新招标");
    return toResponse(requireTender(tenantId, id), List.of(), true);
  }


  // ── 评标问询与二次报价(C-9) ────────────────────────────────
  @Transactional
  public TenderResponse sendInquiry(String tenderId, SendTenderInquiryRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderBid bid = bidMapper.listByTender(tenantId, tenderId).stream()
        .filter(b -> b.id().equals(request.bidId()))
        .findFirst()
        .orElse(null);
    TenderInquiryPolicy.requireInquiryOpen(tender, bid, request.kind());
    requireValidOpenedBid(tender, bid);
    if (evaluationMapper.countScores(tenantId, tenderId) > 0) {
      throw new IllegalStateException("已有评分留痕,不可再发起会改变评审依据的问询或二次报价");
    }
    inquiryMapper.insert(
        "tinq-" + UUID.randomUUID(), tenantId, tenderId, bid.id(), request.kind(), request.question().trim());
    String supplierName = supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.inquiry_sent", AUDIT_TARGET, tenderId,
        request.kind() + " → " + supplierName + ":" + request.question().trim());
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId, bid.supplierId(), "评标" + request.kind(),
        tender.title() + " 评标委员会向贵方发出" + request.kind() + ",请在招标项目详情的评标阶段及时答复。");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  @Transactional
  public TenderResponse answerInquiry(String tenderId, String inquiryId, AnswerTenderInquiryRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    TenderBid myBid = myBid(tenderId, supplierId);
    TenderInquiry inquiry = inquiryMapper.listByTender(tender.tenantId(), tenderId).stream()
        .filter(i -> i.id().equals(inquiryId))
        .filter(i -> myBid != null && i.bidId().equals(myBid.id()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("问询不存在或不属于本方投标: " + inquiryId));
    TenderInquiryPolicy.requireAnswerable(tender, inquiry);
    TenderInquiryPolicy.requireValidAnswer(inquiry.kind(), request.answer(), request.revisedAmount());
    if (TenderInquiryPolicy.KIND_REQUOTE.equals(inquiry.kind())) {
      TenderBidPolicy.requireValidBid(request.revisedAmount(), request.answer(), tenderId);
    }
    int updated = inquiryMapper.answer(
        inquiryId, tender.tenantId(), request.answer().trim(), request.revisedAmount(), OffsetDateTime.now());
    if (updated == 0) {
      throw new IllegalStateException("该问询已答复,不可重复提交: " + inquiryId);
    }
    auditLogApplicationService.recordTenantAction(
        tender.tenantId(), "tender.inquiry_answered", AUDIT_TARGET, tenderId);
    notificationApplicationService.notifyActiveTenantUsers(
        tender.tenantId(), "问询已答复",
        tender.title() + " 投标人已答复" + inquiry.kind()
            + (request.revisedAmount() != null ? ",修订报价 " + request.revisedAmount() : "") + "。");
    return supplierView(tender, myAcquisition(tenderId, supplierId), supplierId);
  }

  // 最新有效报价:最近一次已答复的二次报价修订价;无则为原投标价。
  private BigDecimal effectiveAmount(TenderBid bid, List<TenderInquiry> inquiries) {
    return inquiries.stream()
        .filter(i -> i.bidId().equals(bid.id()))
        .filter(i -> TenderInquiryPolicy.KIND_REQUOTE.equals(i.kind()) && i.answeredAt() != null
            && i.revisedAmount() != null)
        .max(java.util.Comparator.comparing(TenderInquiry::answeredAt))
        .map(TenderInquiry::revisedAmount)
        .orElse(bid.bidAmount());
  }

  // ── 买方:定标 + 中标通知书(C-5) ───────────────────────────
  @Transactional
  public TenderResponse awardTender(String tenderId, AwardTenderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    TenderBid bid = bidMapper.listByTender(tenantId, tenderId).stream()
        .filter(b -> b.id().equals(request.bidId()))
        .findFirst()
        .orElse(null);
    TenderPolicy.requireAwardable(tender, bid, request.awardNoticeHtml());
    requireValidOpenedBid(tender, bid);
    if (evaluationSummary(tender, evaluationMapper.listEvaluators(tenantId, tenderId),
        evaluationMapper.listScores(tenantId, tenderId)).stream().noneMatch(TenderBidEvaluationSummary::recommended)) {
      throw new IllegalStateException("须全体评委对全部有效投标完成完整评分并完成问询答复后方可定标");
    }
    BigDecimal awardAmount = effectiveAmount(bid, inquiryMapper.listByTender(tenantId, tenderId));
    tenderMapper.markAwarded(
        tenantId, tenderId, TenderPolicy.STATUS_AWARDED, bid.id(),
        OffsetDateTime.now(), request.awardNoticeHtml());
    String winnerName = supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.awarded", AUDIT_TARGET, tenderId,
        "定标:中标人「" + winnerName + "」,中标价 " + awardAmount + "(含二次报价修订)");
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId, "招标定标", tender.title() + " 已定标,中标人「" + winnerName + "」,中标通知书已保存。");
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId, bid.supplierId(), "中标通知", tender.title() + " 已确定贵方中标,请查阅项目中标通知书。");
    rfqAnnouncementService.onTenderAwarded(
        tenantId, tenderId, tender.title(), tender.tenderType(), winnerName, awardAmount);
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  // 电子签章入口(esign 模块经应用层访问):取本租户已定标招标及其中标投标。
  public Tender findCurrentTenantAwardedTender(String tenderId) {
    String tenantId = TenantAccessGuard.requireTenantId("esign APIs");
    Tender tender = requireTender(tenantId, tenderId);
    if (tender.awardedBidId() == null) {
      throw new IllegalStateException("招标项目尚未定标,不能签章中标通知书: " + tenderId);
    }
    return tender;
  }

  public TenderBid findAwardedBid(Tender tender) {
    return bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .filter(b -> b.id().equals(tender.awardedBidId()))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("中标投标不存在: " + tender.awardedBidId()));
  }

  // ── 买方:评标委员会与评分表(C-4) ──────────────────────────
  @Transactional
  public TenderResponse formCommittee(String tenderId, FormCommitteeRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    List<String> names = request.members().stream().map(FormCommitteeRequest.Member::name).toList();
    TenderEvaluationPolicy.requireCommitteeFormable(
        tender, names, evaluationMapper.countScores(tenantId, tenderId) > 0);
    evaluationMapper.deleteEvaluators(tenantId, tenderId);
    for (FormCommitteeRequest.Member m : request.members()) {
      String role = TenderEvaluationPolicy.ROLE_LEADER.equals(m.role())
          ? TenderEvaluationPolicy.ROLE_LEADER
          : TenderEvaluationPolicy.ROLE_MEMBER;
      evaluationMapper.insertEvaluator(
          "teval-" + UUID.randomUUID(), tenantId, tenderId, m.name().trim(), role);
    }
    if (!TenderPolicy.STATUS_EVALUATING.equals(tender.status())) {
      tenderMapper.updateStatus(tenantId, tenderId, TenderPolicy.STATUS_EVALUATING, tender.publishedAt());
    }
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.committee_formed", AUDIT_TARGET, tenderId,
        "组建评标委员会 " + request.members().size() + " 人,进入评标");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  @Transactional
  public TenderResponse submitScores(String tenderId, SubmitScoresRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer tender APIs");
    Tender tender = requireTenderForUpdate(tenantId, tenderId);
    if (inquiryMapper.listByTender(tenantId, tenderId).stream().anyMatch(i -> i.answeredAt() == null)) {
      throw new IllegalStateException("须完成问询答复后再提交评分");
    }
    TenderEvaluator evaluator = evaluationMapper.listEvaluators(tenantId, tenderId).stream()
        .filter(e -> e.id().equals(request.evaluatorId()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("评委不在本项目评标委员会中: " + request.evaluatorId()));
    var bidsById = new java.util.HashMap<String, TenderBid>();
    bidMapper.listByTender(tenantId, tenderId).forEach(b -> bidsById.put(b.id(), b));
    OffsetDateTime now = OffsetDateTime.now();
    for (SubmitScoresRequest.Line line : request.lines()) {
      TenderBid bid = bidsById.get(line.bidId());
      TenderEvaluationPolicy.requireScorable(tender, bid);
      requireValidOpenedBid(tender, bid);
      TenderEvaluationPolicy.requireValidScore(line.technicalScore(), line.commercialScore(), line.bidId());
      evaluationMapper.upsertScore(
          "tscore-" + UUID.randomUUID(), tenantId, tenderId, line.bidId(), evaluator.id(),
          line.technicalScore(), line.commercialScore(), line.comment(), now);
    }
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.scored", AUDIT_TARGET, tenderId,
        "评委「" + evaluator.evaluatorName() + "」提交评分 " + request.lines().size() + " 份");
    return toResponse(requireTender(tenantId, tenderId),
        acquisitionMapper.listByTender(tenantId, tenderId), true);
  }

  // ── 供应商:可见清单 / 领取 ──────────────────────────────────
  public List<TenderResponse> listSupplierTenders() {
    permissions.require("supplier:tender:read");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    List<TenderAcquisition> mine = acquisitionMapper.listBySupplier(supplierId);
    var mineByTender = new java.util.HashMap<String, TenderAcquisition>();
    mine.forEach(a -> mineByTender.put(a.tenderId(), a));

    // 受邀/已领取 ∪ 公开发售,去重后统一按发布时间倒序——新发售的公开招标不被
    // 本方存量记录挤到后页(供应商第一眼应看到最新商机)。
    var merged = new java.util.LinkedHashMap<String, Tender>();
    for (Tender t : acquisitionMapper.listTendersBySupplier(supplierId)) {
      merged.put(t.id(), t);
    }
    for (Tender t : acquisitionMapper.listOpenOnSale()) {
      merged.putIfAbsent(t.id(), t);
    }
    return merged.values().stream()
        .sorted(java.util.Comparator.comparing(
            Tender::createdAt, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
        .map(t -> supplierView(t, mineByTender.get(t.id()), supplierId))
        .toList();
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
    if (existing != null && existing.acquiredAt() != null) {
      return supplierView(tender, existing, supplierId);
    }
    TenderPolicy.requireAcquisitionWindow(tender, now);
    // F-1:实行资格预审的项目,须预审通过方可领取招标文件(投标以已领取为前提)。
    TenderPrequalificationPolicy.requirePrequalified(tender, myPrequalification(tender, supplierId));
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
            .orElse(null),
        supplierId);
  }

  // ── 供应商:投标递交(密封)/ 撤回 ─────────────────────────────
  @Transactional
  public TenderBidResponse submitBid(String tenderId, SubmitTenderBidRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier tender APIs");
    Tender tender = findTenderForSupplier(tenderId, supplierId);
    OffsetDateTime now = OffsetDateTime.now();
    TenderBidPolicy.requireSubmissionWindow(tender, now);
    TenderBidPolicy.requireAcquired(myAcquisition(tenderId, supplierId), tenderId);
    TenderPrequalificationPolicy.requirePrequalified(tender, myPrequalification(tender, supplierId));
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
    permissions.require("supplier:tender:read");
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
        bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(), null, null);
  }

  // 买方封存视图:开标(C-3)前只回递交登记——供应商名/时间/密封状态/指纹,金额与正文置空。
  private TenderBidResponse sealedBidView(TenderBid bid) {
    return new TenderBidResponse(
        bid.id(), bid.tenderId(), bid.supplierId(),
        supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId()),
        null, null, bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(),
        null, null);
  }

  // 唱标视图(开标后):金额与核验结果公示;投标函正文仅买方或本方可见,他方不下发。
  // 已撤回的投标保留登记但不解封内容(金额/正文均不公示)。
  private TenderBidResponse openedBidView(Tender tender, TenderBid bid, boolean withDocument) {
    boolean withdrawn = TenderBidPolicy.WITHDRAWN.equals(bid.sealedStatus());
    return new TenderBidResponse(
        bid.id(), bid.tenderId(), bid.supplierId(),
        supplierProfileApplicationService.findSupplierDisplayName(bid.supplierId()),
        withdrawn ? null : bid.bidAmount(),
        withdrawn || !withDocument ? null : bid.documentHtml(),
        bid.contentDigest(), bid.sealedStatus(), bid.submittedAt(), bid.withdrawnAt(),
        withdrawn ? null : verifyBidDigest(bid), isValidOpenedBid(tender, bid));
  }

  // 唱标排序:有效投标按报价升序;已撤回的殿后留痕。
  private List<TenderBidResponse> openingRoll(Tender tender, java.util.function.Predicate<TenderBid> withDocument) {
    return bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .map(b -> openedBidView(tender, b, withDocument.test(b)))
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
    permissions.require("supplier:tender:manage");
    Tender visible = acquisitionMapper.listTendersBySupplier(supplierId).stream()
        .filter(t -> t.id().equals(tenderId))
        .findFirst()
        .or(() -> acquisitionMapper.listOpenOnSale().stream()
            .filter(t -> t.id().equals(tenderId))
            .findFirst())
        .orElseThrow(() -> new IllegalArgumentException("招标项目不存在或不可见: " + tenderId));
    Tender locked = tenderMapper.lockByTenantAndId(visible.tenantId(), tenderId);
    if (locked == null) throw new IllegalArgumentException("招标项目不存在或不可见: " + tenderId);
    return locked;
  }

  // 供应商视角:未领取(无 acquired_at)时不下发招标文件正文;领取记录仅含本方。
  // 开标前投标仅本方完整视图;开标后为唱标公示(各家名称/金额/核验),他方正文不下发。
  private TenderResponse supplierView(Tender tender, TenderAcquisition mine, String mySupplierId) {
    boolean acquired = mine != null && mine.acquiredAt() != null;
    List<TenderAcquisitionResponse> acquisitions = mine == null
        ? List.of()
        : List.of(new TenderAcquisitionResponse(
            mine.supplierId(), null, mine.source(), mine.acquiredAt()));
    List<TenderBidResponse> bids = tender.openedAt() != null
        ? openingRoll(tender, b -> b.supplierId().equals(mySupplierId))
        : java.util.stream.Stream.of(supplierBidView(myBid(tender.id(), mySupplierId)))
            .filter(java.util.Objects::nonNull)
            .toList();
    // 中标通知书正文仅中标人可见;中标投标与定标时间对全体可见方公示。
    boolean isWinner = tender.awardedBidId() != null && bids.stream()
        .anyMatch(b -> b.id().equals(tender.awardedBidId()) && b.supplierId().equals(mySupplierId));
    // 本方投标的问询(澄清/二次报价):供应商在评标阶段答复。
    TenderBid ownBid = myBid(tender.id(), mySupplierId);
    List<TenderInquiryResponse> myInquiries = ownBid == null
        ? List.of()
        : inquiryMapper.listByTender(tender.tenantId(), tender.id()).stream()
            .filter(i -> i.bidId().equals(ownBid.id()))
            .map(i -> toInquiryResponse(i, null))
            .toList();
    return new TenderResponse(
        tender.id(), tender.tenantId(), tender.tenderNo(), tender.title(), tender.tenderType(),
        tender.budget(), tender.status(), acquired ? tender.documentHtml() : null,
        tender.evaluationMethod(), tender.bidBondAmount(), tender.acquisitionDeadline(),
        tender.submissionDeadline(), tender.openingAt(), tender.publishedAt(), tender.createdAt(),
        acquisitions, bids, tender.openedAt(),
        // 评标过程对供应商不下发(定标结果按上方规则公示)。
        List.of(), List.of(), List.of(),
        tender.awardedBidId(), tender.awardedAt(), isWinner ? tender.awardNoticeHtml() : null,
        tender.failedAt(), tender.failureReason(), tender.rebidOfTenderId(), tender.executionOrderId(),
        myInquiries,
        tender.prequalificationRequired(),
        java.util.stream.Stream.of(myPrequalification(tender, mySupplierId))
            .filter(java.util.Objects::nonNull)
            .map(a -> toPrequalificationResponse(a, null))
            .toList());
  }

  private TenderInquiryResponse toInquiryResponse(TenderInquiry i, String supplierName) {
    return new TenderInquiryResponse(
        i.id(), i.bidId(), supplierName, i.kind(), i.question(), i.askedAt(),
        i.answer(), i.revisedAmount(), i.answeredAt());
  }

  private TenderResponse toResponse(Tender tender, List<TenderAcquisition> acquisitions, boolean withNames) {
    List<TenderBidResponse> bids = tender.openedAt() != null
        ? openingRoll(tender, b -> true)
        : bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
            .map(this::sealedBidView)
            .toList();
    List<TenderEvaluator> evaluators = evaluationMapper.listEvaluators(tender.tenantId(), tender.id());
    List<TenderScore> scores = evaluationMapper.listScores(tender.tenantId(), tender.id());
    var eligibleBidIds = bids.stream().filter(b -> Boolean.TRUE.equals(b.evaluationEligible()))
        .map(TenderBidResponse::id).collect(java.util.stream.Collectors.toSet());
    var bidsById = new java.util.HashMap<String, TenderBid>();
    bidMapper.listByTender(tender.tenantId(), tender.id()).forEach(b -> bidsById.put(b.id(), b));
    List<TenderInquiryResponse> inquiries = inquiryMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .map(i -> toInquiryResponse(i, java.util.Optional.ofNullable(bidsById.get(i.bidId()))
            .map(b -> supplierProfileApplicationService.findSupplierDisplayName(b.supplierId()))
            .orElse(null)))
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
        bids, tender.openedAt(),
        evaluators.stream()
            .map(e -> new TenderEvaluatorResponse(
                e.id(), e.evaluatorName(), e.evaluatorRole(),
                (int) scores.stream().filter(s -> s.evaluatorId().equals(e.id()))
                    .filter(s -> eligibleBidIds.contains(s.bidId()))
                    .filter(s -> validScore(s.technicalScore()) && validScore(s.commercialScore()))
                    .map(TenderScore::bidId).distinct().count()))
            .toList(),
        scores.stream()
            .map(s -> new TenderScoreResponse(
                s.evaluatorId(), s.bidId(), s.technicalScore(), s.commercialScore(),
                s.comment(), s.scoredAt()))
            .toList(),
        evaluationSummary(tender, evaluators, scores),
        tender.awardedBidId(), tender.awardedAt(), tender.awardNoticeHtml(),
        tender.failedAt(), tender.failureReason(), tender.rebidOfTenderId(), tender.executionOrderId(),
        inquiries,
        tender.prequalificationRequired(),
        prequalificationMapper.listByTender(tender.tenantId(), tender.id()).stream()
            .map(a -> toPrequalificationResponse(
                a, supplierProfileApplicationService.findSupplierDisplayName(a.supplierId())))
            .toList());
  }

  // 评标汇总(实时计算):价格分=最低有效报价/本报价×100;
  // 综合评分法 综合=技术均分×50%+商务均分×20%+价格分×30%;最低评标价法按报价升序。
  // 全体评委对全部有效投标交卷后,第一名标记为推荐中标人。
  private List<TenderBidEvaluationSummary> evaluationSummary(
      Tender tender, List<TenderEvaluator> evaluators, List<TenderScore> scores) {
    List<TenderBid> validBids = bidMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .filter(b -> isValidOpenedBid(tender, b))
        .toList();
    if (validBids.isEmpty() || evaluators.isEmpty()) {
      return List.of();
    }
    List<TenderInquiry> allInquiries = inquiryMapper.listByTender(tender.tenantId(), tender.id());
    var effectiveByBid = new java.util.HashMap<String, BigDecimal>();
    validBids.forEach(b -> effectiveByBid.put(b.id(), effectiveAmount(b, allInquiries)));
    BigDecimal lowest = effectiveByBid.values().stream()
        .filter(java.util.Objects::nonNull)
        .min(java.util.Comparator.naturalOrder())
        .orElse(null);
    boolean complete = evaluators.size() >= 3 && evaluators.size() % 2 == 1
        && allInquiries.stream().noneMatch(i -> i.answeredAt() == null)
        && validBids.stream().allMatch(b -> evaluators.stream().allMatch(e ->
            scores.stream().anyMatch(s -> s.bidId().equals(b.id()) && s.evaluatorId().equals(e.id())
                && validScore(s.technicalScore()) && validScore(s.commercialScore()))));

    record Row(TenderBid bid, BigDecimal avgTech, BigDecimal avgComm, BigDecimal priceScore, BigDecimal composite, BigDecimal effective) {}
    List<Row> rows = validBids.stream().map(b -> {
      List<TenderScore> mine = scores.stream().filter(s -> s.bidId().equals(b.id()))
          .filter(s -> evaluators.stream().anyMatch(e -> e.id().equals(s.evaluatorId())))
          .filter(s -> validScore(s.technicalScore()) && validScore(s.commercialScore())).toList();
      BigDecimal avgTech = average(mine.stream().map(TenderScore::technicalScore).toList());
      BigDecimal avgComm = average(mine.stream().map(TenderScore::commercialScore).toList());
      BigDecimal effective = effectiveByBid.get(b.id());
      BigDecimal priceScore = lowest == null || effective == null || effective.signum() <= 0
          ? null
          : lowest.multiply(BigDecimal.valueOf(100)).divide(effective, 2, RoundingMode.HALF_UP);
      BigDecimal composite = avgTech == null || avgComm == null || priceScore == null
          ? null
          : avgTech.multiply(new BigDecimal("0.5"))
              .add(avgComm.multiply(new BigDecimal("0.2")))
              .add(priceScore.multiply(new BigDecimal("0.3")))
              .setScale(2, RoundingMode.HALF_UP);
      return new Row(b, avgTech, avgComm, priceScore, composite, effective);
    }).toList();

    boolean lowestPriceMethod = "最低评标价法".equals(tender.evaluationMethod());
    java.util.Comparator<Row> ranking = lowestPriceMethod
        ? java.util.Comparator.comparing(Row::effective,
            java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
        : java.util.Comparator.comparing(Row::composite,
            java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
    List<Row> sorted = rows.stream().sorted(ranking).toList();

    var result = new java.util.ArrayList<TenderBidEvaluationSummary>();
    for (int i = 0; i < sorted.size(); i++) {
      Row r = sorted.get(i);
      result.add(new TenderBidEvaluationSummary(
          r.bid().id(),
          supplierProfileApplicationService.findSupplierDisplayName(r.bid().supplierId()),
          r.bid().bidAmount(), r.avgTech(), r.avgComm(), r.priceScore(), r.composite(),
          i + 1, complete && i == 0, r.effective()));
    }
    return List.copyOf(result);
  }

  private static BigDecimal average(List<BigDecimal> values) {
    List<BigDecimal> present = values.stream().filter(java.util.Objects::nonNull).toList();
    if (present.isEmpty()) return null;
    return present.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
        .divide(BigDecimal.valueOf(present.size()), 2, RoundingMode.HALF_UP);
  }

  private static boolean validScore(BigDecimal score) {
    return score != null && score.signum() >= 0 && score.compareTo(BigDecimal.valueOf(100)) <= 0;
  }

  private boolean isValidOpenedBid(Tender tender, TenderBid bid) {
    if (bid == null || !"已开启".equals(bid.sealedStatus())
        || !tender.id().equals(bid.tenderId()) || !tender.tenantId().equals(bid.tenantId())
        || bid.withdrawnAt() != null || bid.bidAmount() == null || bid.bidAmount().signum() <= 0
        || bid.documentHtml() == null || bid.documentHtml().isBlank() || !verifyBidDigest(bid)
        || bid.submittedAt() == null || tender.submissionDeadline() == null
        || !bid.submittedAt().isBefore(tender.submissionDeadline())) return false;
    boolean acquired = acquisitionMapper.listByTender(tender.tenantId(), tender.id()).stream()
        .anyMatch(a -> a.supplierId().equals(bid.supplierId()) && a.acquiredAt() != null
            && !a.acquiredAt().isAfter(bid.submittedAt()));
    BigDecimal effective = effectiveAmount(bid, inquiryMapper.listByTender(tender.tenantId(), tender.id()));
    if (effective.signum() <= 0 || effective.stripTrailingZeros().scale() > 2
        || effective.compareTo(new BigDecimal("10000000000000000")) >= 0) return false;
    return acquired && (!tender.prequalificationRequired()
        || prequalificationMapper.listByTender(tender.tenantId(), tender.id()).stream()
            .anyMatch(a -> a.supplierId().equals(bid.supplierId())
                && TenderPrequalificationPolicy.STATUS_PASSED.equals(a.status())
                && a.reviewedAt() != null && !a.reviewedAt().isAfter(bid.submittedAt())));
  }

  private void requireValidOpenedBid(Tender tender, TenderBid bid) {
    if (!isValidOpenedBid(tender, bid)) {
      throw new IllegalStateException("须为指纹核验通过、按时递交且已领取并符合预审资格的有效投标");
    }
  }

  private Tender requireTenderForUpdate(String tenantId, String tenderId) {
    requireTender(tenantId, tenderId);
    // Every tender command, including supplier writes, takes this lock before checking state.
    Tender tender = tenderMapper.lockByTenantAndId(tenantId, tenderId);
    if (tender == null) throw new IllegalArgumentException("Tender not found in tenant scope: " + tenderId);
    scopes.requireCreatorAccess(tender.ownerId());
    return tender;
  }

  private Tender requireTender(String tenantId, String tenderId) {
    permissions.require("buyer:tender:manage");
    Tender tender = tenderMapper.findByTenantAndId(tenantId, tenderId);
    if (tender == null) {
      throw new IllegalArgumentException("Tender not found in tenant scope: " + tenderId);
    }
    scopes.requireCreatorAccess(tender.ownerId());
    return tender;
  }

  private static void requireTenderType(String type) {
    if (!TenderPolicy.TYPE_OPEN.equals(type) && !TenderPolicy.TYPE_INVITED.equals(type)) {
      throw new IllegalArgumentException("招标方式须为 公开招标 或 邀请招标: " + type);
    }
  }
}
