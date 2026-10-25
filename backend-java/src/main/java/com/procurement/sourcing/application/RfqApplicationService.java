package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.application.DirectDemandRegistrar;
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
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqApplicationService {
  private com.procurement.buyer.application.ProcurementProjectGuard projects;
  @org.springframework.beans.factory.annotation.Autowired
  void setProcurementProjects(com.procurement.buyer.application.ProcurementProjectGuard projects){this.projects=projects;}
  @Transactional
  public String createProjectDraft(String title,List<String> demands){
    return create(new CreateRfqRequest(title,demands,List.of(),java.time.OffsetDateTime.now().plusDays(7),"","","综合评分","询比",null,null,null,true,null,null,null,null,null,null,null,null,null,null)).id();
  }
  @Transactional
  public String createProjectAuctionDraft(String title, List<String> demands,
      java.math.BigDecimal startPrice, java.math.BigDecimal decrement,
      java.time.OffsetDateTime startsAt, java.time.OffsetDateTime deadline,
      Integer triggerMinutes, Integer extendMinutes) {
    return create(new CreateRfqRequest(title, demands, List.of(),
        deadline == null ? java.time.OffsetDateTime.now().plusDays(7) : deadline,
        "", "", "最低价法", RfqMethod.AUCTION, startPrice, decrement, null, true,
        null, null, null, null, startsAt, triggerMinutes, extendMinutes, true, true, false)).id();
  }

  @Transactional
  public String createProjectMallAnchor(String title, List<String> demands, String supplier) {
    String tenant = TenantAccessGuard.requireTenantId("project mall");
    if (projects == null || demands.isEmpty()) throw new IllegalStateException("商城项目来源缺失");
    projects.lock();
    validateDemands(tenant, demands);
    validateSuppliers(tenant, List.of(supplier));
    String anchor = createMallAnchor(title, supplier);
    insertRfqDemandLinks(tenant, anchor, demands);
    projects.bindRfq(demands, anchor);
    return anchor;
  }
  @Transactional
  public void attachTenderProjectDemands(String rfq,String tender){
    if(projects==null)return;var ids=projects.tenderDemands(tender);if(ids.isEmpty())return;
    String tenant=TenantAccessGuard.requireTenantId("tender project");validateDemands(tenant,ids);insertRfqDemandLinks(tenant,rfq,ids);
  }
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final DirectDemandRegistrar directDemandRegistrar;
  private final DataScopeService dataScopeService;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final SupplierQualificationMapper supplierQualificationMapper;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final TenantCapabilityApplicationService tenantCapabilityApplicationService;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;
  private final RfqItemQueryService rfqItemQueryService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final RfqAnnouncementService rfqAnnouncementService;

  public RfqApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      QuoteLineItemMapper quoteLineItemMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      DirectDemandRegistrar directDemandRegistrar,
      DataScopeService dataScopeService,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      SupplierQualificationMapper supplierQualificationMapper,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      TenantCapabilityApplicationService tenantCapabilityApplicationService,
      RfqSourcingStatusTransition rfqSourcingStatusTransition,
      RfqItemQueryService rfqItemQueryService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      RfqAnnouncementService rfqAnnouncementService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.directDemandRegistrar = directDemandRegistrar;
    this.dataScopeService = dataScopeService;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.tenantCapabilityApplicationService = tenantCapabilityApplicationService;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
    this.rfqItemQueryService = rfqItemQueryService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.rfqAnnouncementService = rfqAnnouncementService;
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
    requireWriteAccess(rfq);
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
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    requireWriteAccess(rfq);
    rfqSourcingStatusTransition.requireQuotingForOpen(rfq.status(), rfqId);
    if (RfqAuctionPolicy.isAuction(rfq.method()) && rfq.deadlineAt() == null) {
      throw new IllegalStateException("竞价缺少可核验的截止时间");
    }
    rfqSourcingStatusTransition.requireDeadlinePassedOrForce(
        rfq.deadlineAt(), force && !RfqAuctionPolicy.isAuction(rfq.method()), rfqId);

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
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    requireWriteAccess(rfq);
    if (!RfqStatus.OPENED.equals(rfq.status())) {
      throw new IllegalStateException("Only opened RFQs can start a new round: " + rfqId);
    }
    if (rfq.finalRound()) throw new IllegalStateException("最终轮报价后不可再发起新一轮: " + rfqId);
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
    Rfq afterRound = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfqAnnouncementService != null) {
      rfqAnnouncementService.onNewRound(tenantId, afterRound, afterRound.currentRound(), finalRound);
    }
    return toResponse(afterRound);
  }

  // 终止询价:流标(不足法定家数等)/废标(全部不合格、取消)。置终态 + 记录理由。
  @Transactional
  public RfqResponse abortRfq(String rfqId, String kind, String reason) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    requireWriteAccess(rfq);
    if (RfqStatus.DRAFT.equals(rfq.status())) {
      if (!"废标".equals(kind) || reason == null || reason.isBlank()) {
        throw new IllegalArgumentException("取消草稿须填写取消原因");
      }
      String detail = "草稿取消:" + reason.strip();
      if (rfqMapper.cancelDraft(tenantId, rfqId, detail) == 0) {
        throw new IllegalStateException("草稿状态已变化,请刷新后重试");
      }
      auditLogApplicationService.recordTenantAction(tenantId, "rfq.draft_cancelled", "rfq", rfqId, detail);
      return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
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
    if (rfqAnnouncementService != null) {
      rfqAnnouncementService.onAborted(tenantId, rfq, kind, reason);
    }
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  public List<RfqResponse> listCurrentTenantRfqs(String status, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    DataScope dataScope = dataScopeService.currentUserDataScope();
    if (dataScope == null || dataScope.blocksAll()) {
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
        .filter(rfq -> canRead(rfq, dataScope))
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public RfqResponse create(CreateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.RFQ);
    // M-0:方式维度门禁——未开通的采购方式不可立项(前端不渲染,后端同样拒绝)。
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, RfqMethod.orDefault(request.method()));
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), "new RFQ");
    // Acquire the same budget/project lock before demand-link writes on both entry paths.
    if (projects != null) projects.lock();
    // 立项来源二选一:基于既有需求合并,或采购部门直录(反向登记「直录登记」需求保闭环)。
    List<String> demandIds = request.demandIds() == null ? List.of() : request.demandIds();
    boolean directCreate = demandIds.isEmpty();
    if (directCreate) {
      if (request.directItems() == null || request.directItems().isEmpty()) {
        throw new IllegalArgumentException("请选择要合并的采购需求,或在直录模式下录入采购内容明细");
      }
      requireDemandScope(request.directDepartmentId(), userId);
      String directDemandId = directDemandRegistrar.registerApproved(
          "直录·" + request.title(),
          request.directDepartmentId(),
          request.directBudget(),
          request.directItems().stream()
              .map(item -> new com.procurement.demand.application.DirectDemandRegistrar.DirectLineItem(
                  item.materialId(), item.quantity()))
              .toList());
      demandIds = List.of(directDemandId);
    } else if (request.directItems() != null && !request.directItems().isEmpty()) {
      throw new IllegalArgumentException("不能同时选择既有需求与直录采购内容");
    }
    validateDemands(tenantId, demandIds);
    String method = RfqMethod.orDefault(request.method());
    boolean draft = Boolean.TRUE.equals(request.saveAsDraft());
    List<String> invitedSupplierIds =
        request.invitedSupplierIds() == null ? List.of() : request.invitedSupplierIds();
    validateSuppliers(tenantId, invitedSupplierIds);
    if (!draft || RfqMethod.SINGLE_SOURCE.equals(method) && !invitedSupplierIds.isEmpty()) {
      // 直接发布路径:创建时即校验家数;草稿路径在发布时校验(供应商在选商步骤补充)。
      RfqMethod.requireSupplierCount(method, invitedSupplierIds.size());
    }
    RfqAuctionPolicy.requireValidParams(
        method, request.auctionStartPrice(), request.auctionMinDecrement());
    RfqMethod.requireSourceJustification(method, request.singleSourceReason());
    RfqAuctionPolicy.requireValidSchedule(method, request.auctionPlannedStart(), request.deadlineAt());

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
        blankToNull(request.singleSourceReason()),
        request.auctionReservePrice(),
        request.auctionPlannedStart(),
        request.auctionSoftCloseTriggerMinutes(),
        request.auctionSoftCloseExtendMinutes(),
        request.auctionShowRank(),
        request.auctionShowLowest(),
        request.auctionShowCompetitorNames());

    insertRfqDemandLinks(tenantId, rfqId, demandIds);
    if(projects!=null)projects.bindRfq(demandIds,rfqId);

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
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found: " + rfqId);
    }
    requireWriteAccess(rfq);
    boolean draft = RfqStatus.DRAFT.equals(rfq.status());
    if (!draft && !RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("Only quoting RFQ can be updated: " + rfqId);
    }
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), rfqId);
    List<String> supplierIds = request.invitedSupplierIds() == null
        ? rfqInviteMapper.listSupplierIds(tenantId, rfqId) : request.invitedSupplierIds();
    if (request.invitedSupplierIds() != null) validateSuppliers(tenantId, supplierIds);
    requireSingleSource(rfq, supplierIds, draft);
    RfqAuctionPolicy.requireValidSchedule(rfq.method(), rfq.auctionPlannedStart(), request.deadlineAt());
    boolean fixedInvitations = !draft && (RfqAuctionPolicy.isAuction(rfq.method())
        || RfqMethod.SINGLE_SOURCE.equals(rfq.method()));
    if (fixedInvitations && request.invitedSupplierIds() != null
        && !new java.util.HashSet<>(supplierIds).equals(
            new java.util.HashSet<>(rfqInviteMapper.listSupplierIds(tenantId, rfqId)))) {
      throw new IllegalStateException("已发布的竞价/单一来源项目不可更换受邀供应商");
    }
    if (!draft && RfqAuctionPolicy.isAuction(rfq.method())) {
      rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfqId);
      if (request.deadlineAt() == null || request.deadlineAt().isBefore(rfq.deadlineAt())) {
        throw new IllegalStateException("已发布竞价不可缩短报价截止时间");
      }
    }

    if (!draft && supplierIds.isEmpty()) {
      throw new IllegalArgumentException("报价中的项目须保留受邀供应商");
    }
    int updated = draft ? rfqMapper.updateDraftDetails(tenantId, rfqId, request.title(), request.deadlineAt(),
        orEmpty(request.quoteRequirement()), orEmpty(request.deliveryRequirement()),
        orDefaultEvaluation(request.evaluationMethod())) : rfqMapper.updateQuotingDetails(
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

    if (request.invitedSupplierIds() != null && !fixedInvitations) {
      rfqInviteMapper.deleteByRfq(tenantId, rfqId);
      for (String supplierId : supplierIds) {
        rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
      }
    }

    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.UPDATED,
        AuditTargetType.RFQ,
        rfqId);
    for (String supplierId : draft ? List.<String>of() : supplierIds) {
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
      requireDemandScope(demand.departmentId(), demand.requesterId());
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
    requireSingleSource(rfq, target, true);
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
    if(projects!=null){projects.lock();projects.requireExecution("rfq",rfqId);}
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = requireRfq(tenantId, rfqId);
    if (!RfqStatus.DRAFT.equals(rfq.status())) {
      throw new IllegalStateException("仅草稿状态可发布询价单: " + rfqId);
    }
    List<String> supplierIds = rfqInviteMapper.listSupplierIds(tenantId, rfqId);
    // 空邀请单发布=无人可见的死项目;商城锚点走 createMallAnchor 不经此路径。
    if (supplierIds.isEmpty()) {
      throw new IllegalStateException("发布前请先在「选择供应商」步骤邀请供应商: " + rfqId);
    }
    RfqMethod.requireSupplierCount(RfqMethod.orDefault(rfq.method()), supplierIds.size());
    if (RfqAuctionPolicy.isAuction(rfq.method()) || RfqMethod.SINGLE_SOURCE.equals(rfq.method())) {
      validateSuppliers(tenantId, supplierIds);
    }
    requireSingleSource(rfq, supplierIds, false);
    RfqAuctionPolicy.requireValidSchedule(rfq.method(), rfq.auctionPlannedStart(), rfq.deadlineAt());
    // 邀请家数不足参考门槛:不阻断发布,审计留痕(依法必招项目由采购人自行把关)。
    String supplierAdvisory = RfqMethod.supplierCountAdvisory(rfq.method(), supplierIds.size());
    if (supplierAdvisory != null) {
      auditLogApplicationService.recordTenantAction(
          tenantId, "rfq.supplier_quorum_shortfall", "rfq", rfqId, supplierAdvisory);
    }
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
    if (rfqAnnouncementService != null) {
      rfqAnnouncementService.onPublished(tenantId, rfqMapper.findByTenantAndId(tenantId, rfqId));
    }
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
    if (rfqAnnouncementService != null) {
      rfqAnnouncementService.onResultAnnounced(tenantId, rfq, awardedAmount);
    }
    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  private Rfq requireRfq(String tenantId, String rfqId) {
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    requireWriteAccess(rfq);
    return rfq;
  }

  public void requireWriteAccess(String rfqId) {
    requireRfq(TenantAccessGuard.requireTenantId("buyer RFQ APIs"), rfqId);
  }

  public void requireReadAccess(String rfqId) {
    Rfq rfq = rfqMapper.findByTenantAndId(TenantAccessGuard.requireTenantId("buyer RFQ APIs"), rfqId);
    if (rfq == null || !canRead(rfq, dataScopeService.currentUserDataScope())) {
      throw new com.procurement.common.tenant.PermissionDeniedException("当前数据范围无权访问该询比项目");
    }
  }

  public void requireAwardSupplier(Rfq rfq, String supplierId) {
    List<String> invited = rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id());
    requireSingleSource(rfq, invited, false);
    if (RfqMethod.SINGLE_SOURCE.equals(rfq.method())) {
      if (!invited.contains(supplierId)) throw new IllegalStateException("定标供应商必须为单一来源受邀方");
      validateSuppliers(rfq.tenantId(), invited);
    }
  }

  private void requireSingleSource(Rfq rfq, List<String> invited, boolean draft) {
    if (!RfqMethod.SINGLE_SOURCE.equals(rfq.method())) return;
    RfqMethod.requireSourceJustification(rfq.method(), rfq.singleSourceReason());
    if (!draft || !invited.isEmpty()) RfqMethod.requireSupplierCount(rfq.method(), invited.size());
  }

  public java.util.function.Predicate<String> currentReadFilter() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer auction stream");
    String userId = TenantAccessGuard.requireUserId("buyer auction stream");
    return id -> {
      Rfq rfq = rfqMapper.findByTenantAndId(tenantId, id);
      return rfq != null && canRead(rfq, dataScopeService.userDataScope(tenantId, userId));
    };
  }

  public java.util.function.Predicate<String> currentSupplierReadFilter() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier auction stream");
    return id -> rfqMapper.findBySupplierInvite(id, supplierId) != null;
  }

  private boolean canRead(Rfq rfq, DataScope scope) {
    if (scope == null || scope.blocksAll()) return false;
    if (!scope.restricted()) return true;
    var demands = rfqDemandMapper.listDemandAccess(rfq.tenantId(), rfq.id());
    if (demands.isEmpty()) return scope.requesterId() != null && scope.requesterId().equals(rfq.ownerId());
    return demands.stream().allMatch(d -> d.demandId() != null && (scope.requesterId() != null
        ? scope.requesterId().equals(d.requesterId()) : scope.departmentIds().contains(d.departmentId())));
  }

  public void requireAdditionalInvitation(String rfqId, String supplierId) {
    Rfq rfq = requireRfq(TenantAccessGuard.requireTenantId("buyer RFQ APIs"), rfqId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfqId);
    rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfqId);
    List<String> invited = rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfqId);
    if ((RfqMethod.SINGLE_SOURCE.equals(rfq.method()) || RfqAuctionPolicy.isAuction(rfq.method()))
        && !invited.contains(supplierId)) {
      throw new IllegalStateException("已发布竞价/单一来源不可通过公开报名追加供应商");
    }
    validateSuppliers(rfq.tenantId(), List.of(supplierId));
  }

  private void requireWriteAccess(Rfq rfq) {
    DataScope scope = dataScopeService.currentUserDataScope();
    if (scope == null || scope.blocksAll()) {
      throw new com.procurement.common.tenant.PermissionDeniedException("当前数据范围无权操作该询比项目");
    }
    if (!scope.restricted()) return;
    var demands = rfqDemandMapper.listDemandAccess(rfq.tenantId(), rfq.id());
    if (demands.isEmpty()) {
      if (scope.requesterId() != null && scope.requesterId().equals(rfq.ownerId())) return;
      throw new com.procurement.common.tenant.PermissionDeniedException("询比项目缺少可核验的需求归属");
    }
    for (var demand : demands) {
      if (demand.demandId() == null) {
        throw new com.procurement.common.tenant.PermissionDeniedException("关联采购需求不存在或不在本租户");
      }
      requireDemandScope(demand.departmentId(), demand.requesterId());
    }
  }

  private void requireDemandScope(String departmentId, String requesterId) {
    DataScope scope = dataScopeService.currentUserDataScope();
    if (scope == null || scope.blocksAll() || (scope.restricted() &&
        (scope.requesterId() != null ? !scope.requesterId().equals(requesterId)
            : !scope.departmentIds().contains(departmentId)))) {
      throw new com.procurement.common.tenant.PermissionDeniedException("当前数据范围无权操作关联采购需求");
    }
  }

  // 一键催标:向本轮尚未提交报价的受邀供应商发送催报提醒,返回催促家数。
  @Transactional
  public int remindPendingSuppliers(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    requireWriteAccess(rfq);
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
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
    rfqMapper.updateAward(tenantId, rfqId, RfqStatus.AWARDED, RfqStatus.AWARDED, supplierId);
    return rfqId;
  }

  // 招标定标转执行锚点:方式=招标、直接已定标的 RFQ 记录,使执行订单挂入既有履约/财务链。
  @Transactional
  public String createTenderAnchor(String title, String supplierId) {
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
        "招标定标转执行",
        "中标价",
        RfqMethod.TENDER,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
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
        rfq.resultAnnouncedAt(),
        rfq.auctionReservePrice(),
        rfq.auctionPlannedStart(),
        rfq.auctionSoftCloseTriggerMinutes(),
        rfq.auctionSoftCloseExtendMinutes(),
        rfq.auctionShowRank(),
        rfq.auctionShowLowest(),
        rfq.auctionShowCompetitorNames(),
        null,
        rfqItemQueryService.listItems(rfq.tenantId(), rfq.id()));
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
                            l.lineAmount(),
                            l.demandItemId()))
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
