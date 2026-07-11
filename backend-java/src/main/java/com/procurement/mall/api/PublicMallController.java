package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.PublicMallApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 公开商城(permitAll):品类分布与精选商品;协议价属租户数据,登录后可见。
@RestController
@RequestMapping("/api/v1/public/mall")
public class PublicMallController {
  private final PublicMallApplicationService publicMallApplicationService;

  public PublicMallController(PublicMallApplicationService publicMallApplicationService) {
    this.publicMallApplicationService = publicMallApplicationService;
  }

  @GetMapping("/overview")
  public ApiResponse<PublicMallOverviewResponse> overview() {
    return ApiResponse.ok(publicMallApplicationService.overview());
  }
}
