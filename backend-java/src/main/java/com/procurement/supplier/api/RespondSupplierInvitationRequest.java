package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

// 处理邀请:action ∈ accept / decline / withdraw。
public record RespondSupplierInvitationRequest(@NotBlank String action) {}
