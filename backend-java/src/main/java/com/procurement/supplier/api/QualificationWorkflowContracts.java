package com.procurement.supplier.api;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class QualificationWorkflowContracts {
  private QualificationWorkflowContracts() {}
  public record StartReview(@NotBlank @Size(max=2000) String reason, Map<String,Object> formData) {}
  public record CancelReview(@NotBlank @Size(max=1000) String reason) {}
  public record Attempt(String id,String tenantId,long reviewId,String workflowInstanceId,String reason,
      String status,String createdBy,OffsetDateTime createdAt,OffsetDateTime completedAt) {}
  public record AttemptPage(List<Attempt> items,long total,int page,int pageSize) {}
  public record SupplementDraft(@NotBlank String relationId,@NotBlank String qualificationId,
      @NotBlank @Size(max=2000) String reason,@NotNull LocalDate dueDate) {}
  public record SupplementReply(@NotBlank String replacementId,@NotBlank @Size(max=2000) String response,@Min(0) long revision) {}
  public record SupplementCancel(@NotBlank @Size(max=1000) String reason,@Min(0) long revision) {}
  public record Supplement(String id,String tenantId,String relationId,String qualificationId,String reason,LocalDate dueDate,
      String status,long revision,String response,String replacementId,String createdBy,String respondedBy,
      OffsetDateTime createdAt,OffsetDateTime respondedAt,OffsetDateTime closedAt,String supplierId,
      String supplierName,String tenantName,String qualificationType) {}
  public record SupplementPage(List<Supplement> items,long total,int page,int pageSize) {}
}
