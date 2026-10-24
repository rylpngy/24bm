package com.procurement.buyer.api;

import com.procurement.buyer.domain.BudgetChange;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class BudgetContracts {
  private BudgetContracts() {}
  public record BudgetDraft(@NotBlank String departmentId, @Pattern(regexp="[0-9]{4}") @NotNull String period,
      @Pattern(regexp="initial|adjustment|exception") @NotNull String kind,
      @NotNull @DecimalMin("0") @Digits(integer=14,fraction=2) BigDecimal targetAmount,
      String targetType, String targetId, @NotBlank @Size(max=200) String title,
      @NotBlank @Size(max=2000) String reason, @Min(0) long revision) {}
  public record BudgetPolicy(String mode, long revision, String reason, String updatedBy, OffsetDateTime updatedAt,
      long unassignedOrderCount, long invalidDemandCount, boolean canConfigure) {}
  public record BudgetDepartment(String id,String name) {}
  public record BudgetPolicyUpdate(@NotNull @Pattern(regexp="warning|approval|hard") String mode,
      @Min(0) long revision, @NotBlank @Size(max=1000) String reason, boolean acknowledged) {}
  public record BudgetAction(@NotBlank @Size(max=1000) String reason) {}
  public record BudgetSubmission(java.util.Map<String,Object> formData) {}
  public record BudgetAssignment(@NotBlank String departmentId, @NotNull @Pattern(regexp="[0-9]{4}") String period,
      @NotBlank @Size(max=1000) String reason) {}
  public record BudgetChangePage(List<BudgetChange> items, long total, int page, int pageSize) {}
  public record BudgetLedgerLine(String departmentId, String period, String sourceType, String sourceId,
      String label, BigDecimal pending, BigDecimal committed, BigDecimal orderAmount, BigDecimal paidAmount,
      BigDecimal releasedAmount) {}
  public record BudgetLedgerPage(List<BudgetLedgerLine> items, long total, int page, int pageSize) {}
  public record BudgetUnassignedOrder(String id, String rfqId, BigDecimal amount, String status, OffsetDateTime createdAt) {}
  public record BudgetUnassignedPage(List<BudgetUnassignedOrder> items,long total,int page,int pageSize) {}
}
