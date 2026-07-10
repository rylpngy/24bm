package com.procurement.buyer.api;

import com.procurement.buyer.application.BudgetApplicationService;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/budgets")
public class BuyerBudgetController {
  private final BudgetApplicationService budgetApplicationService;

  public BuyerBudgetController(BudgetApplicationService budgetApplicationService) {
    this.budgetApplicationService = budgetApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DepartmentBudgetResponse>> budgets() {
    return ApiResponse.ok(budgetApplicationService.listBudgets());
  }

  @PostMapping
  public ApiResponse<DepartmentBudgetResponse> upsert(
      @Valid @RequestBody UpsertDepartmentBudgetRequest request) {
    return ApiResponse.ok(budgetApplicationService.upsertBudget(request));
  }
}
