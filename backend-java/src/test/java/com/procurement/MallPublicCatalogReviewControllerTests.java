package com.procurement;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.procurement.mall.api.PlatformMallCatalogReviewController;
import com.procurement.mall.api.ReviewMallProductRequest;
import com.procurement.mall.application.MallPublicCatalogReviewApplicationService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MallPublicCatalogReviewControllerTests {
  @Test void platformReviewQueueAndDecisionHaveReachableTypedRoutes() throws Exception {
    var reviews = mock(MallPublicCatalogReviewApplicationService.class);
    when(reviews.listPendingReview()).thenReturn(List.of());
    var mvc = MockMvcBuilders.standaloneSetup(new PlatformMallCatalogReviewController(reviews)).build();
    mvc.perform(get("/api/v1/platform/mall/products/pending-review"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
    mvc.perform(post("/api/v1/platform/mall/products/public-product/review")
        .contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true,\"comment\":\"Reviewed\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
    verify(reviews).review("public-product", new ReviewMallProductRequest(true, "Reviewed"));
  }
}
