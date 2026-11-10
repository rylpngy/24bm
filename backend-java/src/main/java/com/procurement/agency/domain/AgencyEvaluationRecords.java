package com.procurement.agency.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class AgencyEvaluationRecords {
  private AgencyEvaluationRecords() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationCriterion")
  public record Criterion(
      String key,
      String title,
      String stage,
      String applicableTo,
      String resultType,
      BigDecimal minimum,
      BigDecimal maximum,
      BigDecimal weight,
      String formula,
      boolean evidenceRequired,
      int scale,
      String rounding) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationRulePair")
  public record RulePair(
      Criterion documentRule, Criterion configuredRule, String locator, boolean manuallyChecked) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationMember")
  public record Member(String userId, List<String> roles) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationConfig")
  public record Config(
      String title,
      String documentRevisionId,
      String evaluationMethod,
      String ruleVersion,
      String ruleBasis,
      String venue,
      OffsetDateTime scheduledAt,
      List<Member> members,
      List<RulePair> rules,
      String tieRule) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationSave")
  public record Save(Long expectedVersion, Config config, String reason, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationTransition")
  public record Transition(
      Long expectedVersion, boolean businessRulesReviewed, String reason, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationRound")
  public record Round(
      String id,
      String tenantId,
      String packageId,
      int ordinal,
      String status,
      String configJson,
      long version,
      String frozenJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      String frozenBy,
      OffsetDateTime frozenAt,
      String voidReason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationSource")
  public record Source(
      String revisionId,
      String documentId,
      String fileVersionId,
      String hash,
      long inputVersion,
      boolean current,
      boolean basisStale) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationMemberSnapshot")
  public record MemberSnapshot(String userId, String name, List<String> roles) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationDifference")
  public record Difference(
      String key, String field, String documentValue, String configuredValue) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationView")
  public record View(
      Round round,
      Config config,
      List<MemberSnapshot> roster,
      List<Difference> differences,
      List<String> blockers,
      boolean frozenBasisStale) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyEvaluationWorkspace")
  public record Workspace(List<View> rounds, List<Source> sources) {}
}
