package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.SupplierFulfillmentMetricsResponse;
import com.procurement.supplier.application.*;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;

class SupplierEvaluationAutoScoreTests {
  final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  final SupplierFulfillmentMetricsService metrics = mock(SupplierFulfillmentMetricsService.class);
  final SupplierEvaluationApplicationService service = new SupplierEvaluationApplicationService(
      mock(SupplierEvaluationMapper.class), relations, metrics, mock(AuditLogApplicationService.class),
      mock(SupplierEvaluationTemplateService.class));

  @BeforeEach void context() {
    TenantContext.set("a", null, "u");
    when(relations.findByTenantAndId("a", "r")).thenReturn(new BuyerSupplierRelation(
        "r", "a", "s", "Supplier", "admitted", "B", "[]", BigDecimal.ZERO,
        null,null,null,null,null,null,null,null,null,null));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void usesScopedPeriodMetricsAndNeverInventsMissingDimensionsOrTotal() {
    when(metrics.metricsForSupplier("s", "2026-Q1")).thenReturn(metrics(90, 75, 4));
    var result = service.autoScore("r", "2026-Q1");
    assertThat(result.qualityScore()).isEqualByComparingTo("90");
    assertThat(result.deliveryScore()).isEqualByComparingTo("75");
    assertMissing(result);
    verify(metrics).metricsForSupplier("s", "2026-Q1");
  }

  @Test void missingQuantitiesAndMissingScheduledDatesStayNull() {
    when(metrics.metricsForSupplier("s", null)).thenReturn(metrics(null, null, 4));
    var result = service.autoScore("r");
    assertThat(result.qualityScore()).isNull();
    assertThat(result.deliveryScore()).isNull();
    assertMissing(result);
  }

  @Test void noReceiptsNeverGeneratesEighty() {
    when(metrics.metricsForSupplier("s", null)).thenReturn(metrics(null, null, 0));
    var result = service.autoScore("r");
    assertThat(result.qualityScore()).isNull();
    assertThat(result.deliveryScore()).isNull();
    assertMissing(result);
  }

  void assertMissing(com.procurement.supplier.api.AutoScoreSuggestionResponse result) {
    assertThat(result.priceScore()).isNull();
    assertThat(result.serviceScore()).isNull();
    assertThat(result.totalScore()).isNull();
    assertThat(result.suggestedTier()).isNull();
  }

  SupplierFulfillmentMetricsResponse metrics(Integer quality, Integer delivery, int count) {
    return new SupplierFulfillmentMetricsResponse("s",count,3,delivery,100,90,quality,quality,delivery,
        null,null,null,delivery == null ? 0 : count);
  }
}
