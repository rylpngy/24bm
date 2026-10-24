package com.procurement.common;

import com.procurement.finance.api.BuyerFinanceReportController;
import com.procurement.finance.application.FinanceReportApplicationService;
import io.swagger.v3.oas.models.Operation;
import org.junit.jupiter.api.Test;
import org.springframework.web.method.HandlerMethod;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OpenApiConfigTests {
  @Test
  void extractedFinanceControllerRetainsItsPublishedOperationIds() throws Exception {
    var controller = new BuyerFinanceReportController(mock(FinanceReportApplicationService.class));
    for (String method : new String[] {"exportInvoices", "exportReconciliation", "exportProcurementAnalytics"}) {
      Class<?>[] parameters = method.equals("exportProcurementAnalytics")
          ? new Class<?>[]{String.class, java.time.LocalDate.class, java.time.LocalDate.class, String.class, String.class}
          : new Class<?>[]{String.class};
      var handler = new HandlerMethod(controller, BuyerFinanceReportController.class.getMethod(method, parameters));
      var result = new OpenApiConfig().operationIdCustomizer().customize(new Operation(), handler);
      assertThat(result.getOperationId()).isEqualTo("BuyerFinanceAction_" + method);
    }
  }

  @Test
  void unannotatedEndpointsKeepTheExistingNamingConvention() throws Exception {
    var handler = new HandlerMethod(new SampleController(), SampleController.class.getMethod("list"));
    var result = new OpenApiConfig().operationIdCustomizer().customize(new Operation(), handler);
    assertThat(result.getOperationId()).isEqualTo("Sample_list");
  }

  static class SampleController {
    public void list() {}
  }
}
