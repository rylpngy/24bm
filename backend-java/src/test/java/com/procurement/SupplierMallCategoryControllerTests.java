package com.procurement;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.procurement.mall.api.SupplierMallController;
import com.procurement.mall.application.MallApplicationService;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.domain.MallCategory;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SupplierMallCategoryControllerTests {
  @Test void categoriesQueryBindsDestinationAndUsesSupplierScopedApplicationService() throws Exception {
    var catalog = mock(MallCatalogApplicationService.class);
    when(catalog.listCategoriesForSupplier("tenant")).thenReturn(List.of(new MallCategory("office", "tenant", null, "Office", 0, null)));
    when(catalog.listCategoriesForSupplier(null)).thenReturn(List.of());
    var mvc = MockMvcBuilders.standaloneSetup(new SupplierMallController(mock(MallApplicationService.class), catalog,
        mock(MallServiceApplicationService.class))).build();
    mvc.perform(get("/api/v1/supplier/mall/categories").param("tenantId", "tenant"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value("office"));
    mvc.perform(get("/api/v1/supplier/mall/categories"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
    verify(catalog).listCategoriesForSupplier("tenant");
    verify(catalog).listCategoriesForSupplier(null);
  }
}
