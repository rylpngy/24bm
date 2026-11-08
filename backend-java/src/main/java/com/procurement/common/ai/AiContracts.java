package com.procurement.common.ai;

import java.time.OffsetDateTime;
import java.util.List;

/** Neutral immutable contracts; business modules retain authorization and evidence ownership. */
public final class AiContracts {
  private AiContracts() {}
  public static final List<String> SUBJECT_TYPES = List.of("demand", "attachment", "supplier", "procurement_risk");
  public record Subject(String subjectType, String subjectId) {
    public Subject {
      if (!SUBJECT_TYPES.contains(subjectType) || subjectId == null || subjectId.isBlank() || subjectId.length() > 160)
        throw new IllegalArgumentException("Unsupported AI subject or invalid subject ID");
    }
  }
  public record Evidence(String id, String kind, String locator, String label, String value,
      String sourceId, String sourceHash, String policyVersion) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "AiReviewFinding")
  public record Finding(String id, String severity, String title, String detail, List<String> evidenceIds) {
    public Finding { evidenceIds = List.copyOf(evidenceIds); }
  }
  public record AccessTarget(String subjectType, String subjectId) {}
  public record Snapshot(String sourceRevision, List<Evidence> evidence, List<Finding> findings,
      List<String> limitations, List<AccessTarget> accessTargets) {
    public Snapshot {
      evidence = List.copyOf(evidence); findings = List.copyOf(findings);
      limitations = List.copyOf(limitations); accessTargets = List.copyOf(accessTargets);
    }
  }
  public record Feedback(String findingId, String disposition, String comment, String createdBy,
      OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "AiReviewResult")
  public record Review(String runId, String subjectType, String subjectId, String sourceRevision,
      OffsetDateTime createdAt, String mode, String model, String fallbackReason, String rulesetVersion,
      String summary, List<Finding> findings, List<Evidence> evidence, List<String> limitations,
      List<Feedback> feedback) {
    public Review {
      findings = List.copyOf(findings); evidence = List.copyOf(evidence);
      limitations = List.copyOf(limitations); feedback = List.copyOf(feedback);
    }
  }
  public record Clause(String id, String title, String text) {}
  public record Policy(String id, String policyKey, int version, String title, List<String> subjectTypes,
      List<Clause> clauses, String status, String sourceHash, String createdBy, OffsetDateTime createdAt) {
    public Policy { subjectTypes = List.copyOf(subjectTypes); clauses = List.copyOf(clauses); }
  }
  public record ModelResult(String mode, String model, String fallbackReason, String summary) {}
}
