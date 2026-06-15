package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierRfqListFilterTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteApplicationService quoteApplicationService =
      new QuoteApplicationService(rfqMapper, rfqDemandMapper, rfqInviteMapper, quoteMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listSupplierRfqsAppliesFiltersInsideCurrentSupplierInvites() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.listBySupplierInviteFiltered("ent-supplier-sunrise", "报价中", "电脑"))
        .thenReturn(List.of());

    quoteApplicationService.listSupplierRfqs("报价中", "电脑");

    verify(rfqMapper).listBySupplierInviteFiltered("ent-supplier-sunrise", "报价中", "电脑");
  }
}
