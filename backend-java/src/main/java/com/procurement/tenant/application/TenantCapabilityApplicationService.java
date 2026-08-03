package com.procurement.tenant.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 租户能力(M-0):按 tenants.enabled_features 解析可用的采购方式与工作台模块。
 *
 * <p>方式门禁落在这里而不是各上下文自己判断,保证「后端拒绝」与「前端不渲染」用的是同一份规则。
 */
@Service
public class TenantCapabilityApplicationService {

  private final TenantFeatureMapper tenantFeatureMapper;
  private final ObjectMapper objectMapper;

  public TenantCapabilityApplicationService(
      TenantFeatureMapper tenantFeatureMapper, ObjectMapper objectMapper) {
    this.tenantFeatureMapper = tenantFeatureMapper;
    this.objectMapper = objectMapper;
  }

  public List<String> enabledFeatures(String tenantId) {
    String json = tenantFeatureMapper.findEnabledFeaturesJson(tenantId);
    if (json == null) {
      throw new IllegalArgumentException("租户不存在: " + tenantId);
    }
    if (json.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<>() {});
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("租户能力配置不是合法 JSON: " + tenantId, exception);
    }
  }

  public List<ProcurementMethodCatalog.MethodDefinition> enabledMethods(String tenantId) {
    return ProcurementMethodCatalog.enabledMethods(enabledFeatures(tenantId));
  }

  /** 立项入口门禁:方式未开通即拒绝,前端藏起来不算数。 */
  public void requireMethodEnabled(String tenantId, String methodCode) {
    if (!ProcurementMethodCatalog.isMethodEnabled(enabledFeatures(tenantId), methodCode)) {
      throw new IllegalStateException("本企业未开通「" + methodCode + "」采购方式,请联系平台运营开通。");
    }
  }
}
