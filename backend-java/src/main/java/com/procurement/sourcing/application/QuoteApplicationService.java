package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.api.QuoteLineItemRequest;
import com.procurement.sourcing.api.QuoteLineItemResponse;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteAuditAction;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAuctionPolicy;
import com.procurement.sourcing.domain.RfqQuoteLinePolicy;
import com.procurement.sourcing.domain.RfqMethod;
import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import com.procurement.sourcing.domain.RfqQuoteSubmissionPolicy;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuoteApplicationService {
  private final RfqMapper rfqMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final QuoteMapper quoteMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;
  private final RfqItemQueryService rfqItemQueryService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final ApplicationEventPublisher eventPublisher;

  public QuoteApplicationService(
      RfqMapper rfqMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      QuoteMapper quoteMapper,
      QuoteLineItemMapper quoteLineItemMapper,
      RfqSourcingStatusTransition rfqSourcingStatusTransition,
      RfqItemQueryService rfqItemQueryService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      ApplicationEventPublisher eventPublisher) {
    this.rfqMapper = rfqMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.quoteMapper = quoteMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
    this.rfqItemQueryService = rfqItemQueryService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.eventPublisher = eventPublisher;
  }

  public List<RfqResponse> listSupplierRfqs() {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return rfqMapper.listBySupplierInvite(supplierId).stream()
        .map(rfq -> toRfqResponse(rfq, supplierId))
        .toList();
  }

  public List<RfqResponse> listSupplierRfqs(String status, String keyword) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return rfqMapper.listBySupplierInviteFiltered(
            supplierId,
            blankToNull(status),
            blankToNull(keyword))
        .stream()
        .map(rfq -> toRfqResponse(rfq, supplierId))
        .toList();
  }

  // 电子签署入口:取本方报价(供 esign 模块计算内容指纹),非本方或不存在即抛错。
  public Quote findSupplierOwnQuote(String quoteId) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return quoteMapper.listBySupplier(supplierId).stream()
        .filter(quote -> quote.id().equals(quoteId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Quote not found for supplier: " + quoteId));
  }

  public List<QuoteResponse> listSupplierQuotes() {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return quoteMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<QuoteResponse> listSupplierQuotes(String rfqId, String status) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return quoteMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(rfqId),
            blankToNull(status))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public QuoteResponse submit(String rfqId, SubmitQuoteRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    requireNotDeclined(rfq, supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfqId);
    rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfqId);

    int submittedCount = quoteMapper.countSubmittedBySupplier(
        rfq.tenantId(),
        rfqId,
        supplierId,
        rfq.currentRound());
    RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(submittedCount, rfqId);

    String quoteId = newId("quote");
    requireQuoteFollowsRfqItems(rfq, request.lineItems());
    BigDecimal amount = effectiveAmount(request.amount(), request.lineItems());
    RfqAuctionPolicy.requireValidBid(
        rfq.method(),
        rfq.auctionStartPrice(),
        rfq.auctionMinDecrement(),
        quoteMapper.findLowestSubmittedAmount(rfq.tenantId(), rfqId, rfq.currentRound()),
        amount,
        rfqId);
    try {
      quoteMapper.insert(
          quoteId,
          rfq.tenantId(),
          rfqId,
          supplierId,
          amount,
          request.taxRate(),
          request.deliveryDays(),
          QuoteStatus.SUBMITTED,
          rfq.currentRound());
    } catch (DuplicateKeyException exception) {
      RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(1, rfqId);
      throw exception;
    }
    persistLineItems(rfq.tenantId(), quoteId, request.lineItems());
    publishAuctionEvent(rfq, AuctionEvent.KIND_BID);
    maybeExtendAuctionDeadline(rfq);

    // 供应商无租户上下文,审计需显式落到 RFQ 所属租户(否则 requireTenantId 抛错)。
    auditLogApplicationService.recordTenantAction(
        rfq.tenantId(),
        QuoteAuditAction.SUBMITTED,
        AuditTargetType.QUOTE,
        quoteId);
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.SUPPLIER_QUOTE_SUBMITTED,
        rfq.title() + "已收到供应商报价，请进入报价对比处理。");
    return toResponse(quoteMapper.findByTenantAndId(rfq.tenantId(), quoteId));
  }

  @Transactional
  public QuoteResponse update(String quoteId, UpdateQuoteRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Quote quote = quoteMapper.findBySupplierAndId(supplierId, quoteId);
    if (quote == null) {
      throw new IllegalArgumentException("Quote not found for supplier: " + quoteId);
    }
    if (QuoteStatus.LOCKED.equals(quote.status())) {
      throw new IllegalStateException("Locked supplier quote cannot be updated: " + quoteId);
    }

    Rfq rfq = findRfqForInvitedSupplier(quote.rfqId(), supplierId);
    requireNotDeclined(rfq, supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfq.id());
    rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfq.id());

    requireQuoteFollowsRfqItems(rfq, request.lineItems());
    BigDecimal amount = effectiveAmount(request.amount(), request.lineItems());
    RfqAuctionPolicy.requireValidBid(
        rfq.method(),
        rfq.auctionStartPrice(),
        rfq.auctionMinDecrement(),
        quoteMapper.findLowestSubmittedAmount(rfq.tenantId(), rfq.id(), rfq.currentRound()),
        amount,
        rfq.id());
    int updated = quoteMapper.updateSubmittedQuote(
        quote.tenantId(),
        quoteId,
        supplierId,
        amount,
        request.taxRate(),
        request.deliveryDays(),
        QuoteStatus.SUBMITTED);
    if (updated == 0) {
      throw new IllegalStateException("Only submitted supplier quote can be updated: " + quoteId);
    }
    persistLineItems(quote.tenantId(), quoteId, request.lineItems());
    publishAuctionEvent(rfq, AuctionEvent.KIND_BID);
    maybeExtendAuctionDeadline(rfq);

    auditLogApplicationService.recordTenantAction(
        rfq.tenantId(),
        QuoteAuditAction.UPDATED,
        AuditTargetType.QUOTE,
        quoteId);
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.SUPPLIER_QUOTE_SUBMITTED,
        rfq.title() + "供应商报价已更新，请重新查看报价对比。");
    return toResponse(quoteMapper.findByTenantAndId(quote.tenantId(), quoteId));
  }

  private void requireNotDeclined(Rfq rfq, String supplierId) {
    com.procurement.sourcing.domain.RfqInvitation invitation =
        rfqInviteMapper.findBySupplier(rfq.tenantId(), rfq.id(), supplierId);
    if (invitation != null && com.procurement.sourcing.domain.RfqInviteStatus.DECLINED.equals(invitation.inviteStatus())) {
      throw new IllegalStateException("已拒绝参与的询价不能提交报价: " + rfq.id());
    }
  }

  // 已读回执:供应商打开询价单时登记首次查看时间(幂等)。
  @Transactional
  public void markInvitationViewed(String rfqId) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    rfqInviteMapper.markViewed(rfq.tenantId(), rfqId, supplierId);
  }

  // 拒绝参与:报价中且尚未提交报价时可拒绝;通知采购方,拒绝后不可再报价。
  @Transactional
  public void declineInvitation(String rfqId, String reason) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfqId);
    int submitted = quoteMapper.countSubmittedBySupplier(rfq.tenantId(), rfqId, supplierId, rfq.currentRound());
    if (submitted > 0) {
      throw new IllegalStateException("已提交报价,不能拒绝参与: " + rfqId);
    }
    int updated = rfqInviteMapper.decline(
        rfq.tenantId(), rfqId, supplierId, reason == null || reason.isBlank() ? "供应商拒绝参与" : reason);
    if (updated == 0) {
      throw new IllegalStateException("邀请状态已变化,无法拒绝: " + rfqId);
    }
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.RFQ_INVITATION_UPDATED,
        rfq.title() + " 有受邀供应商拒绝参与" + (reason == null || reason.isBlank() ? "。" : ":" + reason));
  }

  private Rfq findRfqForInvitedSupplier(String rfqId, String supplierId) {
    Rfq rfq = rfqMapper.findBySupplierInvite(rfqId, supplierId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found for invited supplier: " + rfqId);
    }

    int inviteCount = rfqInviteMapper.isSupplierInvited(rfq.tenantId(), rfqId, supplierId);
    RfqQuoteInvitationPolicy.requireInvitedSupplier(inviteCount, rfqId);

    return rfq;
  }

  private QuoteResponse toResponse(Quote quote) {
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
        lineItemResponses(quote.tenantId(), quote.id()));
  }

  // 行项明细持久化:全量替换(先删后插),行金额按 数量 × 单价 计算。
  private void persistLineItems(
      String tenantId, String quoteId, List<QuoteLineItemRequest> lineItems) {
    quoteLineItemMapper.deleteByQuote(tenantId, quoteId);
    if (lineItems == null || lineItems.isEmpty()) {
      return;
    }
    int sortNo = 0;
    for (QuoteLineItemRequest line : lineItems) {
      BigDecimal lineAmount = line.quantity().multiply(line.unitPrice());
      String unit = line.unit() == null || line.unit().isBlank() ? "项" : line.unit();
      quoteLineItemMapper.insert(
          newId("qli"),
          tenantId,
          quoteId,
          line.description(),
          unit,
          line.quantity(),
          line.unitPrice(),
          lineAmount,
          sortNo++,
          line.demandItemId());
    }
  }

  private List<QuoteLineItemResponse> lineItemResponses(String tenantId, String quoteId) {
    List<QuoteLineItem> lines = quoteLineItemMapper.listByQuote(tenantId, quoteId);
    if (lines == null) {
      return List.of();
    }
    return lines.stream()
        .map(
            l ->
                new QuoteLineItemResponse(
                    l.id(), l.description(), l.unit(), l.quantity(), l.unitPrice(), l.lineAmount(),
                    l.demandItemId()))
        .toList();
  }

  // 出价须依据采购清单:逐行对应清单行、数量以清单为准(清单为空的存量项目不施加)。
  private void requireQuoteFollowsRfqItems(Rfq rfq, List<QuoteLineItemRequest> lineItems) {
    RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        rfqItemQueryService.itemQuantities(rfq.tenantId(), rfq.id()),
        lineItems == null
            ? List.of()
            : lineItems.stream()
                .map(l -> new RfqQuoteLinePolicy.QuotedLine(l.demandItemId(), l.quantity()))
                .toList(),
        rfq.id());
  }

  // 提供行项时按行汇总覆盖报价头金额(头/明细一致);否则沿用供应商填写的 amount。
  private BigDecimal effectiveAmount(BigDecimal headerAmount, List<QuoteLineItemRequest> lineItems) {
    if (lineItems == null || lineItems.isEmpty()) {
      return headerAmount;
    }
    return lineItems.stream()
        .map(l -> l.quantity().multiply(l.unitPrice()))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  /**
   * G-1 竞价实时推送:出价落库后向本租户与全部受邀供应商广播信号
   * (仅 rfqId + 事件类型,不含金额),订阅端据此拉取自己有权看到的最新数据。
   */
  private void publishAuctionEvent(Rfq rfq, String kind) {
    if (!RfqAuctionPolicy.isAuction(rfq.method())) {
      return;
    }
    eventPublisher.publishEvent(new AuctionEvent(
        rfq.tenantId(), rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id()), rfq.id(), kind));
  }

  // 竞价软关闭:临近截止的有效出价自动顺延截止时间,并通知买方与全部受邀供应商。
  private void maybeExtendAuctionDeadline(Rfq rfq) {
    if (!RfqAuctionPolicy.isAuction(rfq.method())) {
      return;
    }
    java.time.OffsetDateTime extended =
        RfqAuctionPolicy.extendedDeadline(
            rfq.deadlineAt(),
            java.time.OffsetDateTime.now(),
            rfq.auctionSoftCloseTriggerMinutes(),
            rfq.auctionSoftCloseExtendMinutes());
    if (extended == null) {
      return;
    }
    rfqMapper.updateDeadline(rfq.tenantId(), rfq.id(), extended);
    publishAuctionEvent(rfq, AuctionEvent.KIND_DEADLINE_EXTENDED);
    String message = rfq.title() + " 收到临近截止的新出价,竞价截止顺延至 "
        + extended.toLocalDateTime().toLocalTime().withNano(0) + "。";
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(), NotificationTitle.AUCTION_DEADLINE_EXTENDED, message);
    for (String invitedSupplierId : rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id())) {
      notificationApplicationService.notifyActiveSupplierUsers(
          rfq.tenantId(), invitedSupplierId, NotificationTitle.AUCTION_DEADLINE_EXTENDED, message);
    }
  }

  // 供应商侧:报价中封存(不回传任何他方报价);开标后唱标公开——
  // 各家报价头(金额/轮次/时间)对全体受邀方可见,他方 supplierId 匿名化、行项明细不下发,本方保留完整。
  private List<QuoteResponse> openedQuotesForSupplier(Rfq rfq, String supplierId) {
    if (rfq.openedAt() == null) {
      return List.of();
    }
    return quoteMapper.listByTenantAndRfqAndRound(rfq.tenantId(), rfq.id(), rfq.currentRound()).stream()
        .sorted(java.util.Comparator.comparing(
            Quote::amount, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
        .map(quote -> {
          boolean mine = supplierId.equals(quote.supplierId());
          return new QuoteResponse(
              quote.id(),
              null,
              quote.rfqId(),
              mine ? quote.supplierId() : null,
              quote.amount(),
              quote.taxRate(),
              quote.deliveryDays(),
              quote.status(),
              quote.submittedAt(),
              mine ? lineItemResponses(rfq.tenantId(), quote.id()) : List.of());
        })
        .toList();
  }

  private RfqResponse toRfqResponse(Rfq rfq, String supplierId) {
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
        openedQuotesForSupplier(rfq, supplierId),
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
        // 可见性开关:关闭「显示当前最低价」时对供应商隐藏(采购方侧不受影响)。
        Boolean.FALSE.equals(rfq.auctionShowLowest()) ? null : auctionLowestAmount(rfq),
        rfq.singleSourceReason(),
        ownInvitation(rfq, supplierId),
        rfq.resultAnnouncedAt(),
        // 保留价仅采购方内部可见。
        null,
        rfq.auctionPlannedStart(),
        rfq.auctionSoftCloseTriggerMinutes(),
        rfq.auctionSoftCloseExtendMinutes(),
        rfq.auctionShowRank(),
        rfq.auctionShowLowest(),
        rfq.auctionShowCompetitorNames(),
        auctionMyRank(rfq, supplierId),
        rfqItemQueryService.listItems(rfq.tenantId(), rfq.id()));
  }

  // 供应商本方名次:开启「显示当前排名」时,按各家最新有效报价升序计算(1=领先)。
  private Integer auctionMyRank(Rfq rfq, String supplierId) {
    if (!RfqAuctionPolicy.isAuction(rfq.method()) || Boolean.FALSE.equals(rfq.auctionShowRank())) {
      return null;
    }
    var quotes = quoteMapper.listByTenantAndRfqAndRound(rfq.tenantId(), rfq.id(), rfq.currentRound());
    java.util.Map<String, java.math.BigDecimal> latest = new java.util.LinkedHashMap<>();
    for (Quote q : quotes) {
      if (q.supplierId() != null && q.amount() != null) {
        latest.put(q.supplierId(), q.amount());
      }
    }
    java.math.BigDecimal mine = latest.get(supplierId);
    if (mine == null) {
      return null;
    }
    int rank = 1;
    for (var entry : latest.entrySet()) {
      if (!entry.getKey().equals(supplierId) && entry.getValue().compareTo(mine) < 0) {
        rank += 1;
      }
    }
    return rank;
  }

  // 供应商视角仅返回本方邀请记录(已读/拒绝状态),不暴露其他受邀方。
  private java.util.List<com.procurement.sourcing.api.RfqInvitationResponse> ownInvitation(Rfq rfq, String supplierId) {
    com.procurement.sourcing.domain.RfqInvitation invitation =
        rfqInviteMapper.findBySupplier(rfq.tenantId(), rfq.id(), supplierId);
    if (invitation == null) {
      return java.util.List.of();
    }
    return java.util.List.of(new com.procurement.sourcing.api.RfqInvitationResponse(
        invitation.supplierId(), invitation.inviteStatus(), invitation.viewedAt(), invitation.declineReason()));
  }

  // 竞价的当前最低价对受邀供应商公开(价格竞争的核心信息);其它方式保持封存返回 null。
  private BigDecimal auctionLowestAmount(Rfq rfq) {
    if (!RfqAuctionPolicy.isAuction(rfq.method())) {
      return null;
    }
    return quoteMapper.findLowestSubmittedAmount(rfq.tenantId(), rfq.id(), rfq.currentRound());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
