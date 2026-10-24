package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.PermissionMapper;
import com.procurement.supplier.application.SupplierFulfillmentMetricsService;
import com.procurement.supplier.domain.SupplierPerformancePeriod;
import com.procurement.supplier.domain.SupplierPeriodMetrics;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierFulfillmentMetricsMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SupplierFulfillmentMetricsServiceTests {
  private final SupplierFulfillmentMetricsMapper mapper = mock(SupplierFulfillmentMetricsMapper.class);
  private final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  private final PermissionMapper permissionMapper = mock(PermissionMapper.class);
  private final DataScopeService scopes = mock(DataScopeService.class);
  private final SupplierFulfillmentMetricsService service = new SupplierFulfillmentMetricsService(
      mapper, relations, new PermissionService(permissionMapper), scopes);

  @BeforeEach
  void context() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(permissionMapper.listUserPermissions("buyer-user")).thenReturn(List.of("buyer:supplier:read"));
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("buyer-user"));
    when(relations.countByTenantSupplier("tenant-1", "supplier")).thenReturn(1);
  }

  @AfterEach
  void clear() { TenantContext.clear(); }

  @Test
  void cumulativeMetricsRemainScopedAndHaveNoPeriodDates() {
    when(mapper.aggregatePeriod("tenant-1", "supplier", null, DataScope.self("buyer-user")))
        .thenReturn(new SupplierPeriodMetrics(3, 1, 504L, 499L, 2, 50, 99));
    var result = service.metricsForSupplier("supplier");
    assertThat(result.onTimeRate()).isEqualTo(50);
    assertThat(result.qualifiedRate()).isEqualTo(99);
    assertThat(result.derivedQualityScore()).isEqualTo(99);
    assertThat(result.derivedDeliveryScore()).isEqualTo(50);
    assertThat(result.scheduledReceiptCount()).isEqualTo(2);
    assertThat(result.period()).isNull();
    assertThat(result.startDate()).isNull();
    assertThat(result.endDateExclusive()).isNull();
  }

  @Test
  void missingExpectedDatesDoNotHideQualityOrInventDeliveryRate() {
    when(mapper.aggregatePeriod("tenant-1", "supplier", null, DataScope.self("buyer-user")))
        .thenReturn(new SupplierPeriodMetrics(2, 0, 10, 0, 0, null, 0));
    var result = service.metricsForSupplier("supplier");
    assertThat(result.receiptCount()).isEqualTo(2);
    assertThat(result.scheduledReceiptCount()).isZero();
    assertThat(result.onTimeRate()).isNull();
    assertThat(result.derivedDeliveryScore()).isNull();
    assertThat(result.qualifiedRate()).isZero();
  }

  @Test
  void normalizedPeriodAndScopeReachMapper() {
    var period = SupplierPerformancePeriod.parse("2001-Q4");
    when(mapper.aggregatePeriod("tenant-1", "supplier", period, DataScope.self("buyer-user")))
        .thenReturn(new SupplierPeriodMetrics(0, 0, 0, 0, 0, null, null));
    var result = service.metricsForSupplier("supplier", " 2001-q4 ");
    assertThat(result.period()).isEqualTo("2001-Q4");
    assertThat(result.startDate()).hasToString("2001-10-01");
    assertThat(result.endDateExclusive()).hasToString("2002-01-01");
    assertThat(result.onTimeRate()).isNull();
    assertThat(result.qualifiedRate()).isNull();
    verify(mapper).aggregatePeriod("tenant-1", "supplier", period, DataScope.self("buyer-user"));
  }

  @Test
  void bothEntrypointsRequireRealPermissionBeforeReading() {
    when(permissionMapper.listUserPermissions("buyer-user")).thenReturn(List.of("buyer:order:read"));
    assertThatThrownBy(() -> service.metricsForSupplier("supplier")).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.performanceComparison("2001-Q4")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(mapper, relations);
  }

  @Test
  void tenantContextAloneDoesNotAuthorizeReadingMetrics() {
    TenantContext.set("tenant-1", null, null);
    assertThatThrownBy(() -> service.metricsForSupplier("supplier")).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.performanceComparison("2001")).isInstanceOf(PermissionDeniedException.class);
  }

  @Test
  void foreignSupplierAndMissingTenantCannotReadMetrics() {
    assertThatThrownBy(() -> service.metricsForSupplier("foreign")).isInstanceOf(IllegalArgumentException.class);
    TenantContext.clear();
    assertThatThrownBy(() -> service.metricsForSupplier("supplier")).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> service.performanceComparison("2001")).isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(mapper);
  }

  @Test
  void explicitEmptyPeriodNeverFallsBackToCumulative() {
    for (String period : List.of("", " ", "2001-Q5")) {
      assertThatThrownBy(() -> service.metricsForSupplier("supplier", period)).isInstanceOf(IllegalArgumentException.class);
      assertThatThrownBy(() -> service.performanceComparison(period)).isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> service.performanceComparison(null)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }

  @Test
  void comparisonUsesOneBatchQueryWithoutPerSupplierRequests() {
    var period = SupplierPerformancePeriod.parse("2001-Q4");
    when(mapper.compare("tenant-1", period, DataScope.self("buyer-user"))).thenReturn(List.of());
    assertThat(service.performanceComparison("2001-q4")).isEmpty();
    verify(mapper).compare("tenant-1", period, DataScope.self("buyer-user"));
    verifyNoMoreInteractions(mapper);
    verifyNoInteractions(relations);
  }
}
