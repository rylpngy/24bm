package com.procurement.platform.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformTenantApplicationService {
  private final PlatformTenantMapper platformTenantMapper;
  private final ObjectMapper objectMapper;

  public PlatformTenantApplicationService(PlatformTenantMapper platformTenantMapper, ObjectMapper objectMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.objectMapper = objectMapper;
  }

  public List<TenantResponse> listTenants() {
    return platformTenantMapper.listAll().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public TenantResponse updateFeatureToggles(String tenantId, FeatureToggleRequest request) {
    int updated = platformTenantMapper.updateEnabledFeatures(tenantId, writeFeatures(request.enabledFeatures()));
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  private TenantResponse toResponse(PlatformTenant tenant) {
    return new TenantResponse(
        tenant.id(),
        tenant.name(),
        tenant.plan(),
        tenant.status(),
        readFeatures(tenant.enabledFeaturesJson()),
        tenant.userLimit());
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

  private String writeFeatures(List<String> enabledFeatures) {
    try {
      return objectMapper.writeValueAsString(enabledFeatures == null ? List.of() : enabledFeatures);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Unable to serialize tenant features.", exception);
    }
  }
}
