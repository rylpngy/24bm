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
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    if (!readFeatures(enabledFeaturesJson).contains(featureKey)) {
      throw new IllegalStateException("Feature is not enabled for tenant: " + featureKey);
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
