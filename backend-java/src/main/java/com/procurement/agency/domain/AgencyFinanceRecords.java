package com.procurement.agency.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyFinanceRecords {
  public record Calculation(
      String formula,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal base,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal rate,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal fixedAmount,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal discount,
      String ruleVersion,
      String ruleBasis,
      String taxBasis,
      String trigger,
      String payer,
      String recipient,
      String evidenceVersionId,
      boolean reviewed,
      String idempotencyKey) {}

  public record CostDraft(
      String category,
      String reason,
      OffsetDateTime occurredAt,
      String bearer,
      String payee,
      String expertUserId,
      String sessionId,
      String service,
      String billingBasis,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal budget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal requested,
      String evidenceVersionId,
      boolean reviewed,
      String idempotencyKey) {}

  public record Account(
      String id,
      String tenantId,
      String packageId,
      String kind,
      String category,
      String currency,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal budget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal requested,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal approved,
      String status,
      long version,
      String snapshotJson,
      String frozenHash,
      String workflowId,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record AccountView(
      String id,
      String kind,
      String category,
      String currency,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal budget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal requested,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal approved,
      String status,
      long version,
      String detailJson,
      String workflowId,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Entry(
      String id,
      String tenantId,
      String packageId,
      String accountId,
      String kind,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal amount,
      OffsetDateTime occurredAt,
      String evidenceVersionId,
      String evidenceHash,
      String snapshotJson,
      String frozenHash,
      String status,
      long version,
      String workflowId,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record EntryView(
      String id,
      String accountId,
      String kind,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal amount,
      OffsetDateTime occurredAt,
      String status,
      long version,
      String workflowId) {}

  public record EntryDraft(
      String kind,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal amount,
      OffsetDateTime occurredAt,
      String evidenceVersionId,
      String counterparty,
      String reference,
      String reason,
      boolean reviewed,
      boolean duplicateReviewed,
      Map<String, Object> formData,
      String idempotencyKey) {}

  public record Submit(
      Long expectedVersion, String reason, Map<String, Object> formData, String idempotencyKey) {}

  public record Summary(
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal receivable,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal received,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal refunded,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal invoiced,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal waived,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal outstanding,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal overpaid,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costBudget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costRequested,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costApproved,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costActual,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costPaid,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal costPayable,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal basisDifference) {}

  public record Category(String code, String label, boolean active, long version) {}

  public record CategoryDraft(Long expectedVersion, String label, boolean active, String reason) {}

  public record Workspace(
      List<Category> categories,
      List<AccountView> accounts,
      List<EntryView> entries,
      Summary summary,
      List<String> notices) {}
}
