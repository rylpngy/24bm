package com.procurement.agency.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyTotalRecords {
  private AgencyTotalRecords() {}

  @Schema(name = "AgencyTotalSource")
  public record Source(String criterionKey, String source) {}

  @Schema(name = "AgencyTotalRule")
  public record Rule(
      String method,
      int totalScale,
      String totalRounding,
      String tieHandling,
      List<Source> sources) {}

  @Schema(name = "AgencyTotalConfig")
  public record Config(
      String ruleVersion, String basis, String locator, Rule documentRule, Rule configuredRule) {}

  @Schema(name = "AgencyTotalRuleRow")
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

  @Schema(name = "AgencyTotalSave")
  public record Save(Long expectedVersion, Config config, String reason, String idempotencyKey) {}

  @Schema(name = "AgencyTotalFreeze")
  public record Freeze(
      Long expectedVersion, boolean reviewed, String reason, String idempotencyKey) {}

  @Schema(name = "AgencyTotalReference")
  public record Reference(String id, String hash, String userId) {}

  @Schema(name = "AgencyTotalComponent")
  public record Component(
      String criterionKey,
      String title,
      String source,
      int memberCount,
      List<Reference> references,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal rawSum,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal maximum,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal weight,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal numerator,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal denominator,
      int scale,
      String rounding,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal value) {}

  @Schema(name = "AgencyTotalSubject")
  public record SubjectTotal(
      String participationId,
      String supplierName,
      List<Component> components,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal componentSum,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal total) {}

  @Schema(name = "AgencyTotalTie")
  public record Tie(
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal total,
      List<String> participationIds) {}

  @Schema(name = "AgencyTotalTrace")
  public record Trace(
      String method,
      int totalScale,
      String totalRounding,
      String roundingOrder,
      String priceCalculationId,
      String priceInputFingerprint,
      String scopeJson,
      String tieRule,
      List<SubjectTotal> subjects,
      List<Tie> ties) {}

  @Schema(name = "AgencyTotalSelection")
  public record Selection(String priceCalculationId) {}

  @Schema(name = "AgencyTotalPreview")
  public record Preview(
      String ruleId,
      String ruleHash,
      String basisFingerprint,
      String fingerprint,
      Trace trace,
      List<String> blockers) {}

  @Schema(name = "AgencyTotalConfirm")
  public record Confirm(
      String priceCalculationId,
      String fingerprint,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyTotalSnapshot")
  public record Snapshot(
      String id,
      String tenantId,
      String sessionId,
      String ruleId,
      String ruleHash,
      String priceCalculationId,
      String basisFingerprint,
      String inputFingerprint,
      String traceJson,
      String evidenceVersionId,
      String evidenceHash,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyTotalHistory")
  public record History(Snapshot snapshot, boolean stale) {}

  @Schema(name = "AgencyTotalPriceOption")
  public record PriceOption(String id, OffsetDateTime createdAt, boolean stale) {}

  @Schema(name = "AgencyTotalWorkspace")
  public record Workspace(
      RuleRow rule,
      Config config,
      List<String> differences,
      List<String> ruleBlockers,
      String basisFingerprint,
      List<PriceOption> prices,
      List<History> history,
      List<String> blockers) {}
}
