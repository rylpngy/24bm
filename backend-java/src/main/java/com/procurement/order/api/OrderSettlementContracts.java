package com.procurement.order.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class OrderSettlementContracts {
  @Schema(name = "OrderSettlementProposal")
  public record Proposal(
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank @Size(max = 1000) String reason,
      @NotNull @DecimalMin("0") @Digits(integer = 14, fraction = 2) BigDecimal compensation,
      @NotBlank String agreementId,
      List<@jakarta.validation.Valid Price> prices,
      List<@jakarta.validation.Valid Allocation> allocations,
      String previousSettlementId) {
    public Proposal(
        String requestKey,
        String reason,
        BigDecimal compensation,
        String agreementId,
        List<Price> prices,
        List<Allocation> allocations) {
      this(requestKey, reason, compensation, agreementId, prices, allocations, null);
    }

    public Proposal(
        String requestKey,
        String reason,
        BigDecimal compensation,
        String agreementId,
        List<Price> prices) {
      this(requestKey, reason, compensation, agreementId, prices, null);
    }
  }

  @Schema(name = "OrderSettlementAllocation")
  public record Allocation(
      @NotBlank @Size(max = 150) String source,
      @NotNull @DecimalMin("0") @Digits(integer = 14, fraction = 2) BigDecimal goodsAmount) {}

  public record Price(
      @NotBlank String lineId,
      @NotNull @DecimalMin("0") @Digits(integer = 14, fraction = 2) BigDecimal unitPrice) {}

  @Schema(name = "OrderSettlementAction")
  public record Action(
      @Min(1) int revision,
      @NotBlank @Pattern(regexp = "accept|reject|withdraw|submit|complete") String action,
      @NotBlank @Size(max = 1000) String reason,
      Map<String, Object> formData) {}

  @Schema(name = "OrderSettlementEvidenceRequest")
  public record EvidenceRequest(
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank @Pattern(regexp = "refund|payment|invoice|compensation_receipt") String kind,
      @NotNull @DecimalMin("0") @Digits(integer = 14, fraction = 2) BigDecimal amount,
      @NotBlank @Size(max = 150) String evidenceNo,
      @NotBlank String attachmentId,
      @NotBlank @Size(max = 1000) String remark,
      @Size(max = 150) String source,
      @Size(max = 30) List<@jakarta.validation.Valid FundingLine> fundingLines,
      @Pattern(regexp = "20[0-9]{2}") String cashPeriod) {
    public EvidenceRequest(
        String requestKey,
        String kind,
        BigDecimal amount,
        String evidenceNo,
        String attachmentId,
        String remark,
        String source,
        List<FundingLine> fundingLines) {
      this(requestKey, kind, amount, evidenceNo, attachmentId, remark, source, fundingLines, null);
    }

    public EvidenceRequest(
        String requestKey,
        String kind,
        BigDecimal amount,
        String evidenceNo,
        String attachmentId,
        String remark,
        String source) {
      this(requestKey, kind, amount, evidenceNo, attachmentId, remark, source, null);
    }

    public EvidenceRequest(
        String requestKey,
        String kind,
        BigDecimal amount,
        String evidenceNo,
        String attachmentId,
        String remark) {
      this(requestKey, kind, amount, evidenceNo, attachmentId, remark, null, null);
    }
  }

  @Schema(name = "SettlementFundingLine")
  public record FundingLine(
      @NotBlank String fundId,
      @NotNull @DecimalMin("0.01") @Digits(integer = 14, fraction = 2) BigDecimal amount,
      String targetFundId) {
    public FundingLine(String fundId, BigDecimal amount) {
      this(fundId, amount, null);
    }
  }

  @Schema(name = "SettlementFundingEntry")
  public record FundingEntry(
      String evidenceId,
      String fundId,
      String code,
      String name,
      BigDecimal amount,
      String targetFundId,
      String targetName) {}

  @Schema(name = "OrderSettlementRecord")
  public record Entry(
      String id,
      String orderId,
      String contractId,
      String kind,
      String reason,
      String previousStatus,
      String snapshot,
      BigDecimal goodsAmount,
      BigDecimal compensationAmount,
      BigDecimal finalAmount,
      BigDecimal initialPaid,
      BigDecimal initialInvoiced,
      String status,
      int revision,
      String workflowInstanceId,
      String createdBy,
      OffsetDateTime createdAt,
      String supplierActor,
      String supplierComment,
      OffsetDateTime supplierActedAt,
      String completedBy,
      OffsetDateTime completedAt,
      String agreementId,
      String agreementName,
      String agreementSha) {}

  @Schema(name = "OrderSettlementEvidence")
  public record Evidence(
      String id,
      String settlementId,
      String kind,
      BigDecimal amount,
      String evidenceNo,
      String attachmentId,
      String contentSha,
      String remark,
      String createdBy,
      OffsetDateTime createdAt,
      String source,
      String cashPeriod) {
    public Evidence(
        String id,
        String settlementId,
        String kind,
        BigDecimal amount,
        String evidenceNo,
        String attachmentId,
        String contentSha,
        String remark,
        String createdBy,
        OffsetDateTime createdAt,
        String source) {
      this(
          id,
          settlementId,
          kind,
          amount,
          evidenceNo,
          attachmentId,
          contentSha,
          remark,
          createdBy,
          createdAt,
          source,
          null);
    }

    public Evidence(
        String id,
        String settlementId,
        String kind,
        BigDecimal amount,
        String evidenceNo,
        String attachmentId,
        String contentSha,
        String remark,
        String createdBy,
        OffsetDateTime createdAt) {
      this(
          id,
          settlementId,
          kind,
          amount,
          evidenceNo,
          attachmentId,
          contentSha,
          remark,
          createdBy,
          createdAt,
          null);
    }
  }

  @Schema(name = "OrderSettlementPreview")
  public record Preview(
      String contractId,
      String kind,
      BigDecimal goodsAmount,
      BigDecimal paidAmount,
      BigDecimal invoicedAmount,
      String baseline,
      List<String> blockers) {}

  @Schema(name = "OrderSettlementView")
  public record View(
      Preview preview, List<Entry> items, long total, int page, int size, String actorId) {}

  @Schema(name = "OrderSettlementDetail")
  public record Detail(
      Entry record,
      List<Evidence> evidence,
      BigDecimal netPaid,
      BigDecimal refundDue,
      BigDecimal paymentDue,
      List<String> blockers,
      List<FundingEntry> fundingEntries,
      boolean fundingRequired) {}
}
