package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.RfqResultResponse;
import com.procurement.sourcing.api.RfqResultResponse.RfqResultRowResponse;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Comparator;
import java.util.ArrayList;
import org.springframework.stereotype.Service;

// 定标结果公示:已定标 RFQ 的中标人 + 中标通知书 + 本轮报价排名;采购方与受邀供应商均可见。
@Service
public class RfqResultApplicationService {

  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final RfqInviteMapper rfqInviteMapper;

  public RfqResultApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      RfqInviteMapper rfqInviteMapper) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.rfqInviteMapper = rfqInviteMapper;
  }

  public RfqResultResponse resultForBuyer(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    return build(rfq);
  }

  public RfqResultResponse resultForSupplier(String rfqId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier RFQ APIs");
    Rfq rfq = rfqMapper.findBySupplierInvite(rfqId, supplierId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found for invited supplier: " + rfqId);
    }
    RfqQuoteInvitationPolicy.requireInvitedSupplier(
        rfqInviteMapper.isSupplierInvited(rfq.tenantId(), rfqId, supplierId), rfqId);
    return build(rfq);
  }

  // 仅已定标可公示;未定标返回空结果(前端据 status 决定是否展示)。
  private RfqResultResponse build(Rfq rfq) {
    if (!RfqStatus.AWARDED.equals(rfq.status())) {
      return new RfqResultResponse(
          rfq.id(), rfq.title(), rfq.status(), rfq.method(),
          null, null, null, null, "", List.of());
    }
    AwardDecision award = awardDecisionMapper.findApprovedByRfq(
        rfq.tenantId(), rfq.id(), ApprovalStatus.APPROVED);
    String winnerId = award == null ? rfq.awardedSupplierId() : award.supplierId();
    BigDecimal winnerAmount = award == null ? null : award.amount();

    List<Quote> quotes = new ArrayList<>(
        quoteMapper.listByTenantAndRfqAndRound(rfq.tenantId(), rfq.id(), rfq.currentRound()));
    quotes.sort(Comparator.comparing(Quote::amount));
    List<RfqResultRowResponse> rankings = new ArrayList<>();
    for (int i = 0; i < quotes.size(); i++) {
      Quote q = quotes.get(i);
      rankings.add(new RfqResultRowResponse(
          i + 1, q.supplierId(), q.amount(), q.deliveryDays(),
          q.supplierId().equals(winnerId)));
    }

    String notice = winnerId == null ? ""
        : "经评定,供应商「" + winnerId + "」以含税总价 ¥"
            + (winnerAmount == null ? "—" : winnerAmount.toPlainString())
            + " 中标本项目「" + rfq.title() + "」。特此公示。";

    return new RfqResultResponse(
        rfq.id(), rfq.title(), rfq.status(), rfq.method(),
        winnerId, winnerAmount,
        award == null ? null : award.reason(),
        award == null ? null : award.createdAt(),
        notice, rankings);
  }
}
