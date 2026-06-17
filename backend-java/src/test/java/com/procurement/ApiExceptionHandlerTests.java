package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.common.api.ApiExceptionHandler;
import org.junit.jupiter.api.Test;

class ApiExceptionHandlerTests {

  @Test
  void handlesIllegalStateAsBusinessFailureResponse() {
    ApiExceptionHandler handler = new ApiExceptionHandler();

    var response = handler.handleIllegalState(new IllegalStateException("Purchase demand already linked to an RFQ: dem-1"));

    assertThat(response.success()).isFalse();
    assertThat(response.message()).isEqualTo("Purchase demand already linked to an RFQ: dem-1");
  }
}
