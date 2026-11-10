package com.procurement.agency.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyPriceRecords {
  private AgencyPriceRecords() {}

  @Schema(name = "AgencyPriceRule")
  public record Rule(
      String priceSource,
      String formula,
      String criterionKey,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal fullScore,
      int scale,
      String rounding,
      String tieRule) {}

  @Schema(name = "AgencyPriceConfig")
  public record Config(
      String ruleVersion, String basis, String locator, Rule documentRule, Rule configuredRule) {}

  @Schema(name = "AgencyPriceRuleRow")
  public record RuleRow(
      String id,
      String tenantId,
      String sessionId,
      long version,
      String status,
      String configJson,
      String frozenJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime frozenAt) {}

  @Schema(name = "AgencyPriceSave")
  public record Save(Long expectedVersion, Config config, String reason, String idempotencyKey) {}

  @Schema(name = "AgencyPriceFreeze")
  public record Freeze(
      Long expectedVersion, boolean reviewed, String reason, String idempotencyKey) {}

  @Schema(name = "AgencyPriceScope")
  public record Scope(List<String> participationIds, Map<String, String> exclusions) {}

  @Schema(name = "AgencyPriceLine")
  public record Line(
      String participationId,
      String supplierName,
      String sourceId,
      String sourceHash,
      String sourceKind,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal price,
      String currency,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal numerator,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal score) {}

  @Schema(name = "AgencyPriceTrace")
  public record Trace(
      String formula,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal minimum,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal fullScore,
      int scale,
      String rounding,
      String roundingOrder,
      List<Line> lines) {}

  @Schema(name = "AgencyPricePreview")
  public record Preview(
      String ruleId,
      String ruleHash,
      String basisFingerprint,
      String fingerprint,
      Scope scope,
      Trace trace,
      List<String> blockers) {}

  @Schema(name = "AgencyPriceConfirm")
  public record Confirm(
      Scope scope,
      String fingerprint,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyPriceCalculation")
  public record Calculation(
      String id,
      String tenantId,
      String sessionId,
      String ruleId,
      String ruleHash,
      String basisFingerprint,
      String inputFingerprint,
      String scopeJson,
      String traceJson,
      String evidenceVersionId,
      String evidenceHash,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyPriceHistory")
  public record History(Calculation calculation, boolean stale) {}

  @Schema(name = "AgencyPriceWorkspace")
  public record Workspace(
      RuleRow rule,
      Config config,
      List<String> differences,
      List<String> ruleBlockers,
      List<Subject> candidates,
      String basisFingerprint,
      List<History> history,
      List<String> blockers) {}
}
