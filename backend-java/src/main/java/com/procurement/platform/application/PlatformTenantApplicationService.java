package com.procurement.platform.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.platform.api.CreateTenantRequest;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.platform.api.TenantPlanChangeResponse;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.api.UpdateTenantConfigurationRequest;
import com.procurement.platform.domain.TenantPlanCatalog;
import com.procurement.tenant.domain.TenantFeatureKey;
import com.procurement.platform.domain.PlatformBuyerRoleDefaults;
import com.procurement.platform.domain.PlatformDefaultApprovalTemplate;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.domain.PlatformTenantAuditAction;
import com.procurement.platform.domain.PlatformTenantStatus;
import com.procurement.platform.domain.TenantPlanChange;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.TenantPlanChangeMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformTenantApplicationService {
  private final PlatformTenantMapper platformTenantMapper;
  private final ObjectMapper objectMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;
  private final TenantPlanChangeMapper tenantPlanChangeMapper;

  public PlatformTenantApplicationService(
      PlatformTenantMapper platformTenantMapper,
      ObjectMapper objectMapper,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder,
      TenantPlanChangeMapper tenantPlanChangeMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.objectMapper = objectMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
    this.tenantPlanChangeMapper = tenantPlanChangeMapper;
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
    String plan = TenantPlanCatalog.canonical(request.plan());
    requireUserLimit(request.userLimit());
    String buyerOwnerRoleId = buyerOwnerRoleId(request.tenantId());
    String buyerOwnerUserId = buyerOwnerUserId(request.tenantId());
    platformTenantMapper.insertTenant(
        request.tenantId(),
        request.name(),
        plan,
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
        PlatformBuyerRoleDefaults.OWNER_ROLE_NAME,
        PlatformBuyerRoleDefaults.OWNER_PERMISSIONS_JSON);
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
        PlatformTenantAuditAction.CREATED,
        AuditTargetType.TENANT,
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
        PlatformTenantAuditAction.FEATURES_UPDATED,
        AuditTargetType.TENANT,
        tenantId);
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  @Transactional
  public TenantResponse updateTenantPlan(String tenantId, UpdateTenantPlanRequest request) {
    String plan = TenantPlanCatalog.canonical(request.plan());
    requireUserLimit(request.userLimit());
    PlatformTenant before = platformTenantMapper.findById(tenantId);
    if (before == null) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    int updated = platformTenantMapper.updatePlan(tenantId, plan, request.userLimit());
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    int beforeLimit = before.userLimit() == null ? 0 : before.userLimit();
    int afterLimit = request.userLimit() == null ? 0 : request.userLimit();
    // 套餐或用户上限有变化才留痕。
    if (TenantPlanCatalog.rank(before.plan()) != TenantPlanCatalog.rank(plan) || beforeLimit != afterLimit) {
      tenantPlanChangeMapper.insert(
          "planchg-" + UUID.randomUUID(),
          tenantId,
          before.plan(),
          plan,
          beforeLimit,
          afterLimit,
          TenantAccessGuard.requireUserId("tenant plan APIs"));
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        PlatformTenantAuditAction.PLAN_UPDATED,
        AuditTargetType.TENANT,
        tenantId);
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  @Transactional
  public TenantResponse updateConfiguration(String tenantId, UpdateTenantConfigurationRequest request) {
    String plan = TenantPlanCatalog.canonical(request.plan());
    requireUserLimit(request.userLimit());
    String features = writeFeatures(request.enabledFeatures());
    String actorId = TenantAccessGuard.requireUserId("tenant configuration APIs");
    PlatformTenant before = platformTenantMapper.lockById(tenantId);
    if (before == null) throw new IllegalArgumentException("Tenant not found: " + tenantId);
    if (platformTenantMapper.updateConfiguration(tenantId, plan, request.userLimit(), features) != 1) {
      throw new IllegalStateException("租户配置保存失败，请刷新后重试");
    }
    int beforeLimit = before.userLimit() == null ? 0 : before.userLimit();
    if (TenantPlanCatalog.rank(before.plan()) != TenantPlanCatalog.rank(plan) || beforeLimit != request.userLimit()) {
      tenantPlanChangeMapper.insert("planchg-" + UUID.randomUUID(), tenantId,
          before.plan(), plan, beforeLimit, request.userLimit(), actorId);
    }
    auditLogApplicationService.recordTenantAction(tenantId, "tenant.configuration.updated", AuditTargetType.TENANT,
        tenantId, "before=" + configurationDetail(before.plan(), before.userLimit(), readFeatures(before.enabledFeaturesJson()))
            + "; after=" + configurationDetail(plan, request.userLimit(), request.enabledFeatures()));
    return toResponse(platformTenantMapper.findById(tenantId));
  }

  private String configurationDetail(String plan, Integer limit, List<String> features) {
    try {
      return objectMapper.writeValueAsString(java.util.Map.of("plan", plan, "userLimit", limit == null ? 0 : limit,
          "enabledFeatures", features));
    } catch (JsonProcessingException e) { throw new IllegalStateException("Unable to serialize configuration", e); }
  }

  private void requireUserLimit(Integer userLimit) {
    if (userLimit == null || userLimit < 1) throw new IllegalArgumentException("用户上限必须为正整数");
  }

  public List<TenantPlanChangeResponse> listPlanChanges(String tenantId) {
    return tenantPlanChangeMapper.listByTenant(tenantId).stream()
        .map(this::toPlanChangeResponse)
        .toList();
  }

  private TenantPlanChangeResponse toPlanChangeResponse(TenantPlanChange c) {
    int from = TenantPlanCatalog.rank(c.fromPlan());
    int to = TenantPlanCatalog.rank(c.toPlan());
    String direction;
    if (from >= 0 && to >= 0 && to > from) {
      direction = "升级";
    } else if (from >= 0 && to >= 0 && to < from) {
      direction = "降级";
    } else {
      direction = "调整";
    }
    return new TenantPlanChangeResponse(
        c.id(),
        c.fromPlan(),
        c.toPlan(),
        c.fromUserLimit(),
        c.toUserLimit(),
        direction,
        c.changedBy(),
        c.changedAt());
  }

  @Transactional
  public TenantResponse enableTenant(String tenantId) {
    int updated = platformTenantMapper.updateStatus(tenantId, PlatformTenantStatus.ACTIVE);
    if (updated == 0) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        PlatformTenantAuditAction.ENABLED,
        AuditTargetType.TENANT,
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
        PlatformTenantAuditAction.DISABLED,
        AuditTargetType.TENANT,
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
    TenantFeatureKey.validate(enabledFeatures);
    try {
      return objectMapper.writeValueAsString(enabledFeatures == null ? List.of() : enabledFeatures);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Unable to serialize tenant features.", exception);
    }
  }

  private void insertDefaultApprovalTemplates(String tenantId, String buyerOwnerRoleId) {
    for (PlatformDefaultApprovalTemplate template : PlatformDefaultApprovalTemplate.BUYER_TEMPLATES) {
      platformTenantMapper.insertApprovalTemplate(
          template.code(),
          tenantId,
          template.businessType(),
          template.name(),
          buyerOwnerRoleId,
          PlatformTenantStatus.ACTIVE,
          template.sortOrder());
    }
  }

  // 平台侧开通供应商企业:enterprises(type=supplier) + 明细 + 初始管理员(users.supplier_id)。
  // 干净环境引导:开通后需在 Keycloak 为管理员建号并配 claim(userId/supplierId/authScope=SUPPLIER)。
  @Transactional
  public com.procurement.platform.api.SupplierEnterpriseResponse createSupplierEnterprise(
      com.procurement.platform.api.CreateSupplierEnterpriseRequest request) {
    if (platformTenantMapper.countEnterpriseById(request.enterpriseId()) > 0) {
      throw new IllegalStateException("企业 ID 已存在: " + request.enterpriseId());
    }
    String adminUserId = "user-" + request.enterpriseId() + "-owner";
    platformTenantMapper.insertSupplierEnterprise(
        request.enterpriseId(), request.name(), request.industry());
    platformTenantMapper.insertSupplierEnterpriseDetail(
        request.enterpriseId(),
        request.creditCode() == null ? "" : request.creditCode(),
        request.legalPerson() == null ? "" : request.legalPerson());
    platformTenantMapper.insertInitialSupplierAdminUser(
        adminUserId,
        request.enterpriseId(),
        request.adminName(),
        request.adminMobile(),
        request.adminEmail(),
        PlatformTenantStatus.ACTIVE,
        passwordEncoder.encode(request.adminPassword()));
    platformTenantMapper.assignUserRole(adminUserId, "role-system-supplier-owner");
    auditLogApplicationService.recordTenantAction(
        null,
        "supplier_enterprise.created",
        AuditTargetType.ENTERPRISE,
        request.enterpriseId(),
        "平台开通供应商企业: " + request.name());
    return new com.procurement.platform.api.SupplierEnterpriseResponse(
        request.enterpriseId(),
        request.name(),
        request.industry(),
        adminUserId,
        request.adminEmail());
  }

  private String buyerOwnerRoleId(String tenantId) {
    return "role-" + tenantId + "-buyer-owner";
  }

  private String buyerOwnerUserId(String tenantId) {
    return "user-" + tenantId + "-owner";
  }
}
