package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.DiscoverableSupplierResponse;
import com.procurement.supplier.application.SupplierDiscoveryApplicationService;
import com.procurement.supplier.domain.SupplierProfile;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 寻源发现:按租户排除已在私域的供应商,空关键词归一为 null,映射到精简 DTO。
class SupplierDiscoveryApplicationServiceTests {

  private final SupplierProfileMapper mapper = mock(SupplierProfileMapper.class);
  private final SupplierDiscoveryApplicationService service =
      new SupplierDiscoveryApplicationService(mapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void mapsDiscoverableSuppliersForCurrentTenant() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(mapper.discoverForTenant("tenant-acme", "智能"))
        .thenReturn(List.of(new SupplierProfile(
            "ent-supplier-newapply",
            "远景智能装备有限公司",
            "supplier",
            "智能制造",
            false,
            "91310000MA1KNEWAPP",
            "张三",
            "pending",
            "submitted")));

    List<DiscoverableSupplierResponse> result = service.discover("智能");

    assertThat(result).hasSize(1);
    DiscoverableSupplierResponse r = result.get(0);
    assertThat(r.supplierId()).isEqualTo("ent-supplier-newapply");
    assertThat(r.name()).isEqualTo("远景智能装备有限公司");
    assertThat(r.industry()).isEqualTo("智能制造");
    assertThat(r.verifiedStatus()).isEqualTo("pending");
    assertThat(r.profileStatus()).isEqualTo("submitted");
  }

  @Test
  void blankKeywordIsNormalizedToNull() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(mapper.discoverForTenant(eq("tenant-acme"), isNull())).thenReturn(List.of());

    service.discover("   ");

    verify(mapper).discoverForTenant("tenant-acme", null);
  }
}
