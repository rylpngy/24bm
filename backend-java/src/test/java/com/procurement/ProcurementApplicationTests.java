package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.common.api.ApiResponse;
import com.procurement.common.api.HealthController;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProcurementApplicationTests {

  @Test
  void healthControllerReturnsServiceStatus() {
    ApiResponse<Map<String, Object>> response = new HealthController().health();

    assertThat(response.success()).isTrue();
    assertThat(response.data()).containsEntry("status", "ok");
    assertThat(response.data()).containsEntry("service", "procurement-saas-backend");
  }
}
