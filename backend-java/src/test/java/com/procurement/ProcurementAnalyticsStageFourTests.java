package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.buyer.domain.*;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.*;

class ProcurementAnalyticsStageFourTests {
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void fillsMissingMonthsRetainsExactAmountsAndReturnsAppliedDefinitions() {
    var mapper = mock(BuyerAnalyticsMapper.class);
    var permissions = mock(PermissionService.class);
    var service = new BuyerAnalyticsApplicationService(mapper, permissions, TestDataScopes.unrestricted());
    TenantContext.set("tenant-1", null, "user");
    when(mapper.monthlySpend(anyString(), any(), any())).thenReturn(List.of(new MonthlySpend("2026-02", new BigDecimal("123.45"), 1)));
    when(mapper.supplierSpend(anyString(), any(), any())).thenReturn(List.of(new SupplierSpend("s", "Supplier", new BigDecimal("123.45"), 1)));
    when(mapper.statusDistribution(anyString(), any(), any())).thenReturn(List.of(new StatusSlice("待供应商确认", 1, new BigDecimal("123.45"))));
    when(mapper.categorySpend(anyString(), any(), any())).thenReturn(List.of(new CategorySpend("Estimate", new BigDecimal("999.99"))));
    when(mapper.biddingSavings(anyString(), any(), any())).thenReturn(new BigDecimal("20.01"));
    var response = service.procurementAnalytics(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-03-31"), "s", "待供应商确认");
    assertThat(response.totalSpend()).isEqualByComparingTo("123.45");
    assertThat(response.monthlySpend()).extracting(m -> m.period()).containsExactly("2026-01", "2026-02", "2026-03");
    assertThat(response.monthlySpend().get(0).totalAmount()).isEqualByComparingTo("0");
    assertThat(response.biddingSavings()).isEqualByComparingTo("20.01");
    assertThat(response.categoryDemandEstimate()).isEqualTo(response.categorySpend());
    assertThat(response.metadata().appliedFilters().supplierId()).isEqualTo("s");
    assertThat(response.metadata().timezone()).isEqualTo("Asia/Shanghai");
    assertThat(response.metadata().definitionVersion()).isEqualTo("procurement-analytics-v2");
    assertThat(response.metadata().createdAt()).isNotNull();
    assertThat(response.metadata().estimateBoundary()).contains("供应商", "状态", "估算");
    verify(permissions).require("buyer:analytics:read");
  }

  @Test void bothPublicQueryEntrypointsStartTheirOwnRepeatableReadSnapshot() throws Exception {
    for (var signature : List.of(new Class<?>[0], new Class<?>[]{LocalDate.class, LocalDate.class, String.class, String.class})) {
      var tx = BuyerAnalyticsApplicationService.class.getMethod("procurementAnalytics", signature).getAnnotation(Transactional.class);
      assertThat(tx).isNotNull();
      assertThat(tx.readOnly()).isTrue();
      assertThat(tx.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
      assertThat(tx.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }
  }
}
