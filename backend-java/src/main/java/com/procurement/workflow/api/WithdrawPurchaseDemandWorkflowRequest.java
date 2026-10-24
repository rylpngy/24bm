package com.procurement.workflow.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WithdrawPurchaseDemandWorkflowRequest(@NotBlank @Size(max = 1000) String reason) {}
