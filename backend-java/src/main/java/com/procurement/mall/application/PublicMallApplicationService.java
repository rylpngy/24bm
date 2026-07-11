package com.procurement.mall.application;

import com.procurement.mall.api.PublicMallOverviewResponse;
import com.procurement.mall.infrastructure.PublicMallMapper;
import org.springframework.stereotype.Service;

// 公开商城概览:未登录门户展示品类与精选(协议价按租户隔离,登录后可见)。
@Service
public class PublicMallApplicationService {
  private final PublicMallMapper publicMallMapper;

  public PublicMallApplicationService(PublicMallMapper publicMallMapper) {
    this.publicMallMapper = publicMallMapper;
  }

  public PublicMallOverviewResponse overview() {
    return new PublicMallOverviewResponse(
        publicMallMapper.listCategoryCounts(), publicMallMapper.listFeatured());
  }
}
