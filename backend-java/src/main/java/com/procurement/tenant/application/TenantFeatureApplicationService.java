package com.procurement.tenant.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TenantFeatureApplicationService {
  private final TenantFeatureMapper tenantFeatureMapper;
  private final ObjectMapper objectMapper;

  public TenantFeatureApplicationService(TenantFeatureMapper tenantFeatureMapper, ObjectMapper objectMapper) {
    this.tenantFeatureMapper = tenantFeatureMapper;
    this.objectMapper = objectMapper;
  }

  public void requireEnabled(String tenantId, String featureKey) {
    String enabledFeaturesJson = tenantFeatureMapper.findEnabledFeaturesJson(tenantId);
    if (enabledFeaturesJson == null) {
      throw new IllegalArgumentException("租户不存在: " + tenantId);
    }
    if (!readFeatures(enabledFeaturesJson).contains(featureKey)) {
      // 只开商城的租户会正常撞到这里,给业务可读的提示而不是英文键名。
      throw new IllegalStateException(
          "本企业未开通该功能模块(" + featureKey + "),请联系平台运营开通。");
    }
  }

  /** Existing records retain fulfillment/rectification access; callers still enforce record scope and state. */
  public void requireHistoricalFulfillment(String tenantId, String featureKey) {
    if (!com.procurement.tenant.domain.TenantFeatureKey.ORDER.equals(featureKey)
        && !com.procurement.tenant.domain.TenantFeatureKey.FINANCE.equals(featureKey)) {
      throw new IllegalArgumentException("历史履约仅支持订单与财务模块");
    }
    if (tenantFeatureMapper.findEnabledFeaturesJson(tenantId) == null) {
      throw new IllegalArgumentException("租户不存在: " + tenantId);
    }
  }

  private List<String> readFeatures(String featuresJson) {
    if (featuresJson == null || featuresJson.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(featuresJson, new TypeReference<>() {});
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Invalid tenant feature JSON.", exception);
    }
  }
}
