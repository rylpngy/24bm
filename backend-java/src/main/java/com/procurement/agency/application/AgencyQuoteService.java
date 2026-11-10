package com.procurement.agency.application;

import com.procurement.agency.infrastructure.AgencyQuoteMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyQuoteService {
  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyQuoteLayer")
  public record Layer(
      String id,
      String tenantId,
      String sessionId,
      String participationId,
      int ordinal,
      String previousId,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          @io.swagger.v3.oas.annotations.media.Schema(type = "string")
          BigDecimal originalAmount,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          @io.swagger.v3.oas.annotations.media.Schema(type = "string")
          BigDecimal correctedAmount,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          @io.swagger.v3.oas.annotations.media.Schema(type = "string")
          BigDecimal evaluationAmount,
      String currency,
      String kind,
      String evidenceVersionId,
      String evidenceHash,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyQuoteDraft")
  public record Draft(
      String participationId,
      String expectedPreviousId,
      String kind,
      BigDecimal amount,
      String currency,
      String evidenceVersionId,
      String reason,
      boolean reviewed,
      String idempotencyKey) {}

  private final AgencyAssessmentContext c;
  private final AgencyQuoteMapper data;

  public AgencyQuoteService(AgencyAssessmentContext c, AgencyQuoteMapper data) {
    this.c = c;
    this.data = data;
  }

  public List<Layer> list(String pkg, String session) {
    var a = c.access(pkg, session, false);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:price:read");
    return data.list(c.s.guard.tenant(), session);
  }

  public static void amount(BigDecimal value) {
    if (value == null
        || value.signum() < 0
        || value.scale() > 2
        || value.precision() - value.scale() > 18)
      throw new IllegalArgumentException("报价须为非负金额，整数最多18位，小数最多2位；不自动舍入");
  }

  @Transactional
  public Layer append(String pkg, String session, Draft d) {
    var a = c.access(pkg, session, true);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:price:manage");
    c.s.guard.permissions().require("buyer:agency:evaluation:price:read");
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对报价来源和适用依据");
    amount(d.amount());
    if (!Set.of("original", "correction", "policy").contains(Objects.toString(d.kind(), "")))
      throw new IllegalArgumentException("不支持的报价层；最后报价需专有流程，不得用初次报价替代");
    if (d.currency() == null || !d.currency().matches("[A-Z]{3}"))
      throw new IllegalArgumentException("币种须为三位大写代码");
    if (a.subjects().stream().noneMatch(s -> s.participationId().equals(d.participationId())))
      throw new IllegalArgumentException("报价对象不属于本次开启范围");
    c.s.text(d.reason(), 2000, true, "报价依据及核对说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏报价核对凭证");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    String key = "quote-layer:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Layer.class);
    var previous =
        data.list(c.s.guard.tenant(), session).stream()
            .filter(r -> r.participationId().equals(d.participationId()))
            .findFirst()
            .orElse(null);
    if (!Objects.equals(
        previous == null ? null : previous.id(),
        d.expectedPreviousId() == null || d.expectedPreviousId().isBlank()
            ? null
            : d.expectedPreviousId()))
      throw new com.procurement.agency.domain.AgencyConflictException("报价版本已变化，请重新核对最新链尾");
    if (previous == null && !d.kind().equals("original")
        || previous != null && d.kind().equals("original"))
      throw new IllegalStateException("每个对象先记录一次原始报价，后续只追加修正或政策层");
    if (previous != null && !previous.currency().equals(d.currency()))
      throw new IllegalArgumentException("同一报价链不能混用币种");
    BigDecimal original = previous == null ? d.amount() : previous.originalAmount();
    BigDecimal corrected =
        d.kind().equals("correction")
            ? d.amount()
            : previous == null ? null : previous.correctedAmount();
    // A changed correction invalidates the earlier policy price; it must be reviewed again.
    BigDecimal evaluation = d.kind().equals("policy") ? d.amount() : null;
    var row =
        new Layer(
            "agency-quote-" + UUID.randomUUID(),
            c.s.guard.tenant(),
            session,
            d.participationId(),
            previous == null ? 1 : previous.ordinal() + 1,
            previous == null ? null : previous.id(),
            original,
            corrected,
            evaluation,
            d.currency(),
            d.kind(),
            d.evidenceVersionId(),
            proof.hash(),
            d.reason(),
            c.s.guard.actor(),
            null);
    data.create(row);
    var saved =
        data.list(c.s.guard.tenant(), session).stream()
            .filter(r -> r.id().equals(row.id()))
            .findFirst()
            .orElseThrow();
    c.s.event(
        pkg,
        "quote_layer_recorded",
        row.id(),
        null,
        Map.of("kind", row.kind(), "ordinal", row.ordinal(), "evidenceHash", proof.hash()),
        "人工报价分层记录；不形成排名、成交或合同金额");
    c.s.remember(key, hash, saved);
    return saved;
  }
}
