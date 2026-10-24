package com.procurement.ai.api;

import com.procurement.common.ai.AiContracts.Clause;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class AiReviewDtos {
  private AiReviewDtos() {}
  public record CreateReview(@NotBlank @Pattern(regexp="demand|attachment|supplier|procurement_risk") String subjectType,
      @NotBlank @Size(max=160) String subjectId, @Size(max=128) String expectedRevision) {}
  public record SubmitFeedback(@NotBlank @Size(max=160) String findingId,
      @NotBlank @Pattern(regexp="adopted|dismissed|needs_review") String disposition,
      @Size(max=2000) String comment) {}
  public record CreatePolicy(@NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{1,80}") String policyKey,
      @NotBlank @Size(max=200) String title, @NotEmpty @Size(max=4) List<String> subjectTypes,
      @NotEmpty @Size(max=50) List<@Valid Clause> clauses, @Min(0) int expectedLatestVersion) {}
}
