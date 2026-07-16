package com.procurement.tender.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record FormCommitteeRequest(@NotEmpty @Valid List<Member> members) {
  public record Member(@NotBlank String name, String role) {
  }
}
