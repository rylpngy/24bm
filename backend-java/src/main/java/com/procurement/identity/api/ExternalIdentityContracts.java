package com.procurement.identity.api;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;

public final class ExternalIdentityContracts {
  private ExternalIdentityContracts() {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityBinding")
  public record Binding(String id, String tenantId, String userId, String issuer, String subject,
      boolean enabled, int revision, long validAfter, String reason, String createdBy,
      OffsetDateTime createdAt, OffsetDateTime updatedAt, String name, String employeeNo, String userStatus) {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityBindingPage")
  public record BindingPage(List<Binding> items, long total, int page, int pageSize) {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityCreateRequest")
  public record Create(@NotBlank @Size(max=80) String userId,
      @NotBlank @Size(max=255) String subject, @NotBlank @Size(max=1000) String reason) {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityChangeRequest")
  public record Change(boolean enabled, @Min(1) int revision, @NotBlank @Size(max=1000) String reason) {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityRemapRequest")
  public record Remap(@NotBlank @Size(max=80) String userId, @Min(1) int revision, @NotBlank @Size(max=1000) String reason) {}
  @io.swagger.v3.oas.annotations.media.Schema(name="ExternalIdentityReadiness")
  public record Readiness(boolean externalEnabled, boolean issuerConfigured, boolean audienceConfigured,
      boolean strictMapping, boolean selfIssuedAccepted, String issuer, long totalBindings, long activeBindings,
      List<String> pendingItems) {}
}
