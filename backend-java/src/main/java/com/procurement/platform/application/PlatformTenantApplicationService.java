package com.procurement.platform.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.platform.api.CreateTenantRequest;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.domain.PlatformTenantStatus;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformTenantApplicationService {
  private static final String BUYER_OWNER_ROLE_NAME = "采购管理员";
  private static final String BUYER_OWNER_PERMISSIONS = "[\"buyer:*\"]";
  private static final String TENANT_CREATED_ACTION = "tenant.created";
  private static final String TENANT_DISABLED_ACTION = "tenant.disabled";
  private static final String TENANT_ENABLED_ACTION = "tenant.enabled";
  private static final String TENANT_FEATURES_UPDATED_ACTION = "tenant.features.updated";
  private static final String TENANT_PLAN_UPDATED_ACTION = "tenant.plan_updated";
  private static final String TENANT_TARGET_TYPE = "tenant";

  private final PlatformTenantMapper platformTenantMapper;
  private final ObjectMapper objectMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;

  public PlatformTenantApplicationService(
      PlatformTenantMapper platformTenantMapper,
      ObjectMapper objectMapper,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder) {
    this.platformTenantMapper = platformTenantMapper;
    this.objectMapper = objectMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
  }

  public List<TenantResponse> listTenants() {
    return platformTenantMapper.listAll().stream()
        .map(this::toResponse)
        .toList();
  }

  public TenantResponse getTenant(String tenantId) {
    PlatformTenant tenant = platformTenantMapper.findById(tenantId);
    if (tenant == null) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    return toResponse(tenant);
  }

  @Transactional
  public TenantResponse createBuyerTenant(CreateTenantRequest request) {
    String enabledFeaturesJson = writeFeatures(request.enabledFeatures());
    String buyerOwnerRoleId = buyerOwnerRoleId(request.tenantId());
    String buyerOwnerUserId = buyerOwnerUserId(request.tenantId());
    platformTenantMapper.insertTenant(
        request.tenantId(),
        request.name(),
        request.plan(),
        PlatformTenantStatus.ACTIVE,
        enabledFeaturesJson,
        request.userLimit());
    platformTenantMapper.insertBuyerEnterprise(
        request.enterpriseId(),
        request.name(),
        request.industry(),
        true);
    platformTenantMapper.insertBuyerAdminRole(
        buyerOwnerRoleId,
        request.tenantId(),
        BUYER_OWNER_ROLE_NAME,
        BUYER_OWNER_PERMISSIONS);
    platformTenantMapper.insertInitialBuyerAdminUser(
        buyerOwnerUserId,
        request.tenantId(),
        request.adminName(),
        request.adminMobile(),
        request.adminEmail(),
        PlatformTenantStatus.ACTIVE,
        passwordEncoder.encode(request.adminPassword()));
    platformTenantMapper.assignUserRole(buyerOwnerUserId, buyerOwnerRoleId);
    insertDefaultApprovalTemplates(request.tenantId(), buyerOwnerRoleId);
    auditLogApplicationService.recordTenantAction(
        request.tenantId(),
        TENANT_CREATED_ACTION,
        TENANT_TARGET_TYPE,
        request.tenantId());
    return toResponse(platformTenantMapper.findById(request.tenantId()));
  }

  @Transactional
  public TenantResponse updateFeatureToggles(String tenantId, FeatureToggleRequest request) {
    int updated = platformTenantMapper.updateEnabledFeatures(tenantId, writeFeatures(request.enabledFeatures()));
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        TENANT_FEATURES_UPDATED_ACTION,
        TENANT_TARGET_TYPE,
        tenantId);
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  @Transactional
  public TenantResponse updateTenantPlan(String tenantId, UpdateTenantPlanRequest request) {
    int updated = platformTenantMapper.updatePlan(tenantId, request.plan(), request.userLimit());
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        TENANT_PLAN_UPDATED_ACTION,
        TENANT_TARGET_TYPE,
        tenantId);
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  @Transactional
  public TenantResponse enableTenant(String tenantId) {
    int updated = platformTenantMapper.updateStatus(tenantId, PlatformTenantStatus.ACTIVE);
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        TENANT_ENABLED_ACTION,
        TENANT_TARGET_TYPE,
        tenantId);
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  @Transactional
  public TenantResponse disableTenant(String tenantId) {
    int updated = platformTenantMapper.updateStatus(tenantId, PlatformTenantStatus.INACTIVE);
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        TENANT_DISABLED_ACTION,
        TENANT_TARGET_TYPE,
        tenantId);
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

  private void insertDefaultApprovalTemplates(String tenantId, String buyerOwnerRoleId) {
    platformTenantMapper.insertApprovalTemplate(
        "TPL_PURCHASE_DEMAND",
        tenantId,
        "purchase_demand",
        "需求审批",
        buyerOwnerRoleId,
        PlatformTenantStatus.ACTIVE,
        10);
    platformTenantMapper.insertApprovalTemplate(
        "TPL_SUPPLIER_ADMISSION",
        tenantId,
        "buyer_supplier_admission",
        "供应商准入",
        buyerOwnerRoleId,
        PlatformTenantStatus.ACTIVE,
        20);
    platformTenantMapper.insertApprovalTemplate(
        "TPL_RFQ_AWARD",
        tenantId,
        "rfq_award",
        "定标审批",
        buyerOwnerRoleId,
        PlatformTenantStatus.ACTIVE,
        30);
  }

  private String buyerOwnerRoleId(String tenantId) {
    return "role-" + tenantId + "-buyer-owner";
  }

  private String buyerOwnerUserId(String tenantId) {
    return "user-" + tenantId + "-owner";
  }
}
