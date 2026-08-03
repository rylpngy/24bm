package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.common.deployment.DeploymentSurfaceFilter;
import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** M-5 部署形态裁剪:商城版关闭寻源/招标接口面,商城与支撑能力保持可用。 */
class DeploymentSurfaceTests {

  private static final List<String> MALL_PATHS = List.of(
      "/api/v1/health",
      "/api/v1/auth/login",
      "/api/v1/buyer/capabilities",
      "/api/v1/buyer/mall/products",
      "/api/v1/buyer/mall/cart",
      "/api/v1/buyer/mall/addresses",
      "/api/v1/buyer/orders",
      "/api/v1/buyer/receipts",
      "/api/v1/buyer/invoices",
      "/api/v1/buyer/materials",
      "/api/v1/buyer/suppliers",
      "/api/v1/supplier/mall/products",
      "/api/v1/supplier/orders",
      "/api/v1/public/mall/products");

  private static final List<String> NON_MALL_PATHS = List.of(
      "/api/v1/buyer/rfqs",
      "/api/v1/buyer/rfqs/rfq-1/announcements",
      "/api/v1/buyer/tenders",
      "/api/v1/buyer/auction-stream",
      "/api/v1/supplier/rfqs",
      "/api/v1/supplier/tenders/tender-1/acquire",
      "/api/v1/supplier/auction-stream",
      "/api/v1/public/opportunities");

  private static int statusFor(String profile, String path) throws Exception {
    DeploymentSurfaceFilter filter = new DeploymentSurfaceFilter(profile);
    MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
    request.setRequestURI(path);
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = Mockito.mock(FilterChain.class);
    filter.doFilter(request, response, chain);
    return response.getStatus();
  }

  @Test
  @DisplayName("完整形态:所有接口面照常放行(默认形态不改变任何现有行为)")
  void fullProfileKeepsEverything() throws Exception {
    for (String path : NON_MALL_PATHS) {
      assertThat(statusFor("full", path)).as(path).isEqualTo(200);
    }
    for (String path : MALL_PATHS) {
      assertThat(statusFor("full", path)).as(path).isEqualTo(200);
    }
    // 未配置时按 full 处理,升级现有部署不会突然少接口。
    assertThat(statusFor(null, "/api/v1/buyer/rfqs")).isEqualTo(200);
    assertThat(statusFor("  ", "/api/v1/buyer/tenders")).isEqualTo(200);
  }

  @Test
  @DisplayName("商城形态:寻源与招标接口面关闭并给出业务可读提示")
  void mallProfileClosesSourcingAndTender() throws Exception {
    for (String path : NON_MALL_PATHS) {
      assertThat(statusFor("mall", path)).as(path).isEqualTo(404);
    }

    DeploymentSurfaceFilter filter = new DeploymentSurfaceFilter("mall");
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/buyer/rfqs");
    request.setRequestURI("/api/v1/buyer/rfqs");
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, Mockito.mock(FilterChain.class));
    assertThat(response.getContentAsString()).contains("商城直采版");
  }

  @Test
  @DisplayName("商城形态:商城、履约、财务与主数据接口面保持可用")
  void mallProfileKeepsMallAndSupportingSurface() throws Exception {
    for (String path : MALL_PATHS) {
      assertThat(statusFor("mall", path)).as(path).isEqualTo(200);
    }
  }

  @Test
  @DisplayName("形态判定大小写不敏感,便于环境变量随手填")
  void profileIsCaseInsensitive() {
    assertThat(new DeploymentSurfaceFilter("MALL").isMallOnly()).isTrue();
    assertThat(new DeploymentSurfaceFilter("Mall").isMallOnly()).isTrue();
    assertThat(new DeploymentSurfaceFilter("full").isMallOnly()).isFalse();
  }
}
