package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.identity.security.PortalPermissionPolicy;
import com.procurement.supplier.api.SupplierEvaluationScoring;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.Definition;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class SupplierEvaluationTemplateTests {
  @Test void legacyUsesOriginalWeightsAndCustomWeightsArePercentages() {
    var legacy = SupplierEvaluationScoring.legacy();
    assertThat(legacy.templateVersionId()).isNull();
    assertThat(legacy.templateId()).isNull();
    assertThat(legacy.templateName()).isEqualTo("默认模板");
    assertThat(legacy.version()).isZero();
    assertThat(legacy.total(bd(80), bd(90), bd(70), bd(60))).isEqualByComparingTo("78.00");
    var custom = new SupplierEvaluationScoring("v", "t", "Quality", 1,
        bd(100), bd(0), bd(0), bd(0));
    assertThat(custom.total(bd(80), bd(90), bd(70), bd(60))).isEqualByComparingTo("80.00");
  }

  @Test void weightsMustBePresentBoundedAndSumExactlyToOneHundred() {
    assertThatCode(() -> new Definition("T", bd(35), bd(30), bd(20), bd(15)).validate()).doesNotThrowAnyException();
    assertThatCode(() -> new Definition("T", new BigDecimal("33.33"), new BigDecimal("33.33"),
        new BigDecimal("33.34"), bd(0)).validate()).doesNotThrowAnyException();
    for (var weights : new BigDecimal[][] {{bd(-1),bd(101),bd(0),bd(0)},
        {bd(100),bd(1),bd(0),bd(0)}, {bd(0),bd(0),bd(0),bd(0)}, {null,bd(30),bd(20),bd(50)}}) {
      assertThatThrownBy(() -> new Definition("T", weights[0],weights[1],weights[2],weights[3]).validate())
          .isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> new Definition(" ",bd(100),bd(0),bd(0),bd(0)).validate())
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test void templateRoutesUseSupplierReadAndManagePermissions() {
    String path = "/api/v1/buyer/supplier-evaluation-templates";
    assertThat(PortalPermissionPolicy.required("buyer", "GET", path)).isEqualTo("buyer:supplier:read");
    assertThat(PortalPermissionPolicy.required("buyer", "POST", path)).isEqualTo("buyer:supplier:manage");
    assertThat(PortalPermissionPolicy.required("buyer", "POST", path + "/t/versions")).isEqualTo("buyer:supplier:manage");
    assertThat(PortalPermissionPolicy.required("buyer", "PATCH", path + "/t/enabled")).isEqualTo("buyer:supplier:manage");
  }

  static BigDecimal bd(int value) { return BigDecimal.valueOf(value); }
}
