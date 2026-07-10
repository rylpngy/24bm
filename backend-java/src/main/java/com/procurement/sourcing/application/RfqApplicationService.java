package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.api.BidEvaluationResponse;
import com.procurement.sourcing.api.BidEvaluationRowResponse;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.api.QuoteLineItemResponse;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.UpdateRfqRequest;
import com.procurement.sourcing.domain.BidEvaluator;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAuditAction;
import com.procurement.sourcing.domain.RfqDemandLinkPolicy;
import com.procurement.sourcing.domain.RfqInviteStatus;
import com.procurement.sourcing.domain.RfqAuctionPolicy;
import com.procurement.sourcing.domain.RfqMethod;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.domain.RfqSupplierInvitationPolicy;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqApplicationService {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final DataScopeService dataScopeService;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final SupplierQualificationMapper supplierQualificationMapper;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public RfqApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      QuoteLineItemMapper quoteLineItemMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      DataScopeService dataScopeService,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      SupplierQualificationMapper supplierQualificationMapper,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      RfqSourcingStatusTransition rfqSourcingStatusTransition,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.dataScopeService = dataScopeService;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public List<RfqResponse> listCurrentTenantRfqs() {
    return listCurrentTenantRfqs(null, null);
  }

  // 加权评标:按价格/交期权重对该 RFQ 的报价打分排名,推荐总分最高者(定标参考)。
  public BidEvaluationResponse evaluateRfq(String rfqId, int priceWeight, int deliveryWeight) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqSourcingStatusTransition.requireOpenedForEvaluation(rfq.status(), rfqId);
    List<Quote> quotes =
        quoteMapper.listByTenantAndRfqAndRound(tenantId, rfqId, rfq.currentRound());
    List<BidEvaluator.ScoredQuote> scored =
        BidEvaluator.evaluate(quotes, priceWeight, deliveryWeight);
    List<BidEvaluationRowResponse> rows = scored.stream()
        .map(s -> new BidEvaluationRowResponse(
            s.quote().id(),
            s.quote().supplierId(),
            s.quote().amount(),
            s.quote().deliveryDays(),
            s.quote().taxRate(),
            s.priceScore(),
            s.deliveryScore(),
            s.weightedScore(),
            s.rank(),
            s.rank() == 1))
        .toList();
    BidEvaluator.ScoredQuote top = scored.isEmpty() ? null : scored.get(0);
    return new BidEvaluationResponse(
        rfqId,
        priceWeight,
        deliveryWeight,
        top == null ? null : top.quote().id(),
        top == null ? null : top.quote().supplierId(),
        rows);
  }

  // 开标:把封存的「报价中」RFQ 转为「已开标」(到点开标 / 未到点需强制),开标后方可评标定标。
  @Transactional
  public RfqResponse openBids(String rfqId, boolean force) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqSourcingStatusTransition.requireQuotingForOpen(rfq.status(), rfqId);
    rfqSourcingStatusTransition.requireDeadlinePassedOrForce(rfq.deadlineAt(), force, rfqId);

    int opened = rfqMapper.openBids(tenantId, rfqId, RfqStatus.QUOTING, RfqStatus.OPENED, userId);
    if (opened == 0) {
      throw new IllegalStateException("RFQ status changed before bids could be opened: " + rfqId);
    }
    auditLogApplicationService.recordTenantAction(RfqAuditAction.OPENED, "rfq", rfqId);
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  // 再次报价/BAFO:已开标的 RFQ 觉得报价不理想,发起下一轮(重新封存,设新截止)。
  @Transactional
  public RfqResponse startNewRound(
      String rfqId, java.time.OffsetDateTime deadlineAt, boolean finalRound, String note) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!RfqStatus.OPENED.equals(rfq.status())) {
      throw new IllegalStateException("Only opened RFQs can start a new round: " + rfqId);
    }
    rfqSourcingStatusTransition.requireFutureDeadline(deadlineAt, rfqId);

    int updated = rfqMapper.startNewRound(tenantId, rfqId, deadlineAt, finalRound);
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before a new round could start: " + rfqId);
    }
    String roundLabel = finalRound ? "发起最终轮报价(BAFO)" : "发起新一轮报价";
    auditLogApplicationService.recordTenantAction(
        tenantId, RfqAuditAction.NEW_ROUND, "rfq", rfqId,
        note == null || note.isBlank() ? roundLabel : roundLabel + " · 谈判说明:" + note);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        "询比进入新一轮报价",
        rfq.title() + "已发起新一轮报价,请关注受邀供应商的二次报价。");
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  // 终止询价:流标(不足法定家数等)/废标(全部不合格、取消)。置终态 + 记录理由。
  @Transactional
  public RfqResponse abortRfq(String rfqId, String kind, String reason) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    String target = switch (kind) {
      case "流标" -> RfqStatus.NO_BID;
      case "废标" -> RfqStatus.ABORTED;
      default -> throw new IllegalArgumentException("Unknown abort kind: " + kind);
    };
    int updated = rfqMapper.abort(tenantId, rfqId, target, orEmpty(reason));
    if (updated == 0) {
      throw new IllegalStateException("Only ongoing RFQs can be aborted: " + rfqId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId, "rfq." + ("流标".equals(kind) ? "no_bid" : "aborted"), "rfq", rfqId,
        kind + (reason == null || reason.isBlank() ? "" : " · " + reason));
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  public List<RfqResponse> listCurrentTenantRfqs(String status, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    DataScope dataScope = dataScopeService.currentUserDataScope();
    if (dataScope.blocksAll()) {
      return List.of();
    }
    List<String> scopeDepartmentIds = dataScope.restricted() && dataScope.requesterId() == null
        ? dataScope.departmentIds()
        : null;
    String requesterId = dataScope.restricted() ? dataScope.requesterId() : null;
    return rfqMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(keyword),
            scopeDepartmentIds,
            requesterId)
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public RfqResponse create(CreateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.RFQ);
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), "new RFQ");
    validateDemands(tenantId, request.demandIds());
    String method = RfqMethod.orDefault(request.method());
    boolean draft = Boolean.TRUE.equals(request.saveAsDraft());
    List<String> invitedSupplierIds =
        request.invitedSupplierIds() == null ? List.of() : request.invitedSupplierIds();
    validateSuppliers(tenantId, invitedSupplierIds);
    if (!draft) {
      // 直接发布路径:创建时即校验家数;草稿路径在发布时校验(供应商在选商步骤补充)。
      RfqMethod.requireSupplierCount(method, invitedSupplierIds.size());
    }
    RfqAuctionPolicy.requireValidParams(
        method, request.auctionStartPrice(), request.auctionMinDecrement());
    RfqMethod.requireSourceJustification(method, request.singleSourceReason());

    String rfqId = newId("rfq");
    rfqMapper.insert(
        rfqId,
        tenantId,
        request.title(),
        draft ? RfqStatus.DRAFT : RfqStatus.QUOTING,
        request.deadlineAt(),
        userId,
        orEmpty(request.quoteRequirement()),
        orEmpty(request.deliveryRequirement()),
        orDefaultEvaluation(request.evaluationMethod()),
        method,
        request.auctionStartPrice(),
        request.auctionMinDecrement(),
        blankToNull(request.singleSourceReason()));

    insertRfqDemandLinks(tenantId, rfqId, request.demandIds());

    for (String supplierId : invitedSupplierIds) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
    }

    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.CREATED,
        AuditTargetType.RFQ,
        rfqId);
    for (String supplierId : draft ? List.<String>of() : invitedSupplierIds) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_CREATED,
          request.title() + "已邀请您参与报价，请及时处理。");
    }

    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  @Transactional
  public RfqResponse update(String rfqId, UpdateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found: " + rfqId);
    }
    if (!RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("Only quoting RFQ can be updated: " + rfqId);
    }
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), rfqId);
    validateSuppliers(tenantId, request.invitedSupplierIds());

    int updated = rfqMapper.updateQuotingDetails(
        tenantId,
        rfqId,
        request.title(),
        request.deadlineAt(),
        orEmpty(request.quoteRequirement()),
        orEmpty(request.deliveryRequirement()),
        orDefaultEvaluation(request.evaluationMethod()));
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before update could be saved: " + rfqId);
    }

    rfqInviteMapper.deleteByRfq(tenantId, rfqId);
    for (String supplierId : request.invitedSupplierIds()) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
    }

    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.UPDATED,
        AuditTargetType.RFQ,
        rfqId);
    for (String supplierId : request.invitedSupplierIds()) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_UPDATED,
          request.title() + "已更新询比信息，请按最新要求报价。");
    }

    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  private void validateDemands(String tenantId, List<String> demandIds) {
    for (String demandId : demandIds) {
      PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, demandId);
      if (demand == null) {
        throw new IllegalArgumentException("Purchase demand not found in tenant scope: " + demandId);
      }
      rfqSourcingStatusTransition.requireApprovedDemandForRfq(demand.status(), demandId);
      RfqDemandLinkPolicy.requireUnlinkedDemand(
          rfqDemandMapper.countByTenantAndDemand(tenantId, demandId),
          demandId);
    }
  }

  private void insertRfqDemandLinks(String tenantId, String rfqId, List<String> demandIds) {
    for (String demandId : demandIds) {
      try {
        rfqDemandMapper.insert(newId("rfq-demand"), tenantId, rfqId, demandId);
      } catch (DuplicateKeyException exception) {
        RfqDemandLinkPolicy.requireUnlinkedDemand(1, demandId);
        throw exception;
      }
    }
  }

  private void validateSuppliers(String tenantId, List<String> supplierIds) {
    RfqSupplierInvitationPolicy.requireValidInviteList(supplierIds);
    for (String supplierId : supplierIds) {
      RfqSupplierInvitationPolicy.requireAdmittedSupplier(
          buyerSupplierRelationMapper.countByTenantSupplierAndStatus(
              tenantId,
              supplierId,
              BuyerSupplierRelationStatus.ADMITTED),
          supplierId);
      RfqSupplierInvitationPolicy.requireActiveQualification(
          supplierQualificationMapper.listActiveBySupplier(supplierId).size(),
          supplierId);
    }
  }

  // 草稿选商:替换草稿项目的受邀供应商名单(发布前可反复调整)。
  @Transactional
  public RfqResponse updateDraftInvitations(String rfqId, List<String> supplierIds) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = requireRfq(tenantId, rfqId);
    if (!RfqStatus.DRAFT.equals(rfq.status())) {
      throw new IllegalStateException("仅草稿状态可调整受邀供应商: " + rfqId);
    }
    List<String> target = supplierIds == null ? List.of() : supplierIds;
    validateSuppliers(tenantId, target);
    rfqInviteMapper.deleteByRfq(tenantId, rfqId);
    for (String supplierId : target) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
    }
    auditLogApplicationService.recordTenantAction(RfqAuditAction.UPDATED, AuditTargetType.RFQ, rfqId);
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  // 正式发布:草稿 → 报价中;此刻校验方式家数并通知受邀供应商(询价函下发)。
  @Transactional
  public RfqResponse publish(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = requireRfq(tenantId, rfqId);
    if (!RfqStatus.DRAFT.equals(rfq.status())) {
      throw new IllegalStateException("仅草稿状态可发布询价单: " + rfqId);
    }
    List<String> supplierIds = rfqInviteMapper.listSupplierIds(tenantId, rfqId);
    RfqMethod.requireSupplierCount(RfqMethod.orDefault(rfq.method()), supplierIds.size());
    rfqSourcingStatusTransition.requireFutureDeadline(rfq.deadlineAt(), rfqId);
    int updated = rfqMapper.updateStatus(tenantId, rfqId, RfqStatus.DRAFT, RfqStatus.QUOTING);
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before publish: " + rfqId);
    }
    for (String supplierId : supplierIds) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_CREATED,
          rfq.title() + " 询价单已发布,请在 "
              + (rfq.deadlineAt() == null ? "截止时间" : rfq.deadlineAt().toLocalDate()) + " 前提交报价。");
    }
    auditLogApplicationService.recordTenantAction(RfqAuditAction.UPDATED, AuditTargetType.RFQ, rfqId);
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  // 结果公告:定标后向全体受邀方公示中标结果(中标人+金额),未中标方致谢;幂等。
  @Transactional
  public RfqResponse announceResult(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = requireRfq(tenantId, rfqId);
    if (!RfqStatus.AWARDED.equals(rfq.status()) || rfq.awardedSupplierId() == null) {
      throw new IllegalStateException("仅已定标的项目可发布结果公告: " + rfqId);
    }
    int updated = rfqMapper.markResultAnnounced(tenantId, rfqId);
    if (updated == 0) {
      throw new IllegalStateException("结果公告已发布过,不能重复发布: " + rfqId);
    }
    java.math.BigDecimal awardedAmount = quoteMapper
        .listByTenantAndRfqAndRound(tenantId, rfqId, rfq.currentRound()).stream()
        .filter(q -> rfq.awardedSupplierId().equals(q.supplierId()))
        .map(Quote::amount)
        .filter(java.util.Objects::nonNull)
        .findFirst()
        .orElse(null);
    String amountText = awardedAmount == null ? "" : ",中标含税总价 ¥" + awardedAmount.toPlainString();
    for (String supplierId : rfqInviteMapper.listSupplierIds(tenantId, rfqId)) {
      boolean winner = supplierId.equals(rfq.awardedSupplierId());
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_RESULT_ANNOUNCED,
          winner
              ? rfq.title() + " 结果公告:贵司中标" + amountText + ",请等待中标通知书与订单。"
              : rfq.title() + " 结果公告:本项目已定标" + amountText + ",感谢贵司参与,期待后续合作。");
    }
    auditLogApplicationService.recordTenantAction(RfqAuditAction.UPDATED, AuditTargetType.RFQ, rfqId);
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  private Rfq requireRfq(String tenantId, String rfqId) {
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    return rfq;
  }

  // 一键催标:向本轮尚未提交报价的受邀供应商发送催报提醒,返回催促家数。
  @Transactional
  public int remindPendingSuppliers(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfqId);
    int reminded = 0;
    for (String supplierId : rfqInviteMapper.listSupplierIds(tenantId, rfqId)) {
      int submitted = quoteMapper.countSubmittedBySupplier(tenantId, rfqId, supplierId, rfq.currentRound());
      if (submitted > 0) {
        continue;
      }
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_UPDATED,
          rfq.title() + " 报价截止 " + (rfq.deadlineAt() == null ? "临近" : rfq.deadlineAt().toLocalDate())
              + ",请尽快提交报价。");
      reminded++;
    }
    auditLogApplicationService.recordTenantAction(RfqAuditAction.UPDATED, AuditTargetType.RFQ, rfqId);
    return reminded;
  }

  // 商城直购锚点:方式=商城、直接已定标的 RFQ 记录,作为目录直购订单的来源与数据范围锚点。
  @Transactional
  public String createMallAnchor(String title, String supplierId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    String rfqId = newId("rfq");
    rfqMapper.insert(
        rfqId,
        tenantId,
        title,
        RfqStatus.AWARDED,
        java.time.OffsetDateTime.now(),
        userId,
        "",
        "商城协议价目录直购",
        "目录价",
        RfqMethod.MALL,
        null,
        null,
        null);
    rfqMapper.updateAward(tenantId, rfqId, RfqStatus.AWARDED, RfqStatus.AWARDED, supplierId);
    return rfqId;
  }

  private RfqResponse toResponse(Rfq rfq) {
    return new RfqResponse(
        rfq.id(),
        rfq.tenantId(),
        rfq.title(),
        rfq.status(),
        rfq.deadlineAt(),
        rfq.ownerId(),
        rfq.awardedSupplierId(),
        rfq.createdAt(),
        rfq.updatedAt(),
        rfqDemandMapper.listDemandIds(rfq.tenantId(), rfq.id()),
        rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id()),
        quoteMapper.listByTenantAndRfqAndRound(rfq.tenantId(), rfq.id(), rfq.currentRound()).stream()
            .map(this::toQuoteResponse)
            .toList(),
        rfq.quoteRequirement(),
        rfq.deliveryRequirement(),
        rfq.evaluationMethod(),
        rfq.openedAt(),
        rfq.currentRound(),
        rfq.finalRound(),
        RfqMethod.orDefault(rfq.method()),
        rfq.closeReason(),
        rfq.auctionStartPrice(),
        rfq.auctionMinDecrement(),
        auctionLowestAmount(rfq),
        rfq.singleSourceReason(),
        rfqInviteMapper.listByRfq(rfq.tenantId(), rfq.id()).stream()
            .map(inv -> new com.procurement.sourcing.api.RfqInvitationResponse(
                inv.supplierId(), inv.inviteStatus(), inv.viewedAt(), inv.declineReason()))
            .toList(),
        rfq.resultAnnouncedAt());
  }

  // 仅竞价方式回传当前轮最低已提交报价,供买卖双方观察价格竞争进度。
  private java.math.BigDecimal auctionLowestAmount(Rfq rfq) {
    if (!RfqAuctionPolicy.isAuction(rfq.method())) {
      return null;
    }
    return quoteMapper.findLowestSubmittedAmount(rfq.tenantId(), rfq.id(), rfq.currentRound());
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String orDefaultEvaluation(String value) {
    return value == null || value.isBlank() ? "最低价" : value;
  }

  private QuoteResponse toQuoteResponse(Quote quote) {
    List<QuoteLineItem> lines = quoteLineItemMapper.listByQuote(quote.tenantId(), quote.id());
    List<QuoteLineItemResponse> lineItems =
        lines == null
            ? List.of()
            : lines.stream()
                .map(
                    l ->
                        new QuoteLineItemResponse(
                            l.id(),
                            l.description(),
                            l.unit(),
                            l.quantity(),
                            l.unitPrice(),
                            l.lineAmount()))
                .toList();
    return new QuoteResponse(
        quote.id(),
        quote.tenantId(),
        quote.rfqId(),
        quote.supplierId(),
        quote.amount(),
        quote.taxRate(),
        quote.deliveryDays(),
        quote.status(),
        quote.submittedAt(),
        lineItems);
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
