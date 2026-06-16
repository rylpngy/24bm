package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BackendModuleArchitectureTests {

  private static final Path SOURCE_ROOT = Path.of("src/main/java/com/procurement");
  private static final Map<String, String> MODULE_BOUNDARY_TERMS = Map.ofEntries(
      Map.entry("platform", "平台运营"),
      Map.entry("tenant", "租户能力"),
      Map.entry("organization", "组织架构"),
      Map.entry("identity", "账号身份"),
      Map.entry("supplier", "供应商协同"),
      Map.entry("catalog", "物料目录"),
      Map.entry("demand", "采购需求"),
      Map.entry("approval", "审批任务"),
      Map.entry("buyer", "采购方工作台"),
      Map.entry("sourcing", "询价比价"),
      Map.entry("order", "订单履约"),
      Map.entry("finance", "财务协同"),
      Map.entry("notification", "站内通知"),
      Map.entry("attachment", "附件中心"),
      Map.entry("audit", "操作审计"),
      Map.entry("dictionary", "公共字典"),
      Map.entry("common", "共享基础设施"));

  @Test
  void boundedContextPackagesDocumentTheirBusinessBoundary() throws IOException {
    for (Map.Entry<String, String> module : MODULE_BOUNDARY_TERMS.entrySet()) {
      Path packageInfo = SOURCE_ROOT.resolve(module.getKey()).resolve("package-info.java");

      assertThat(packageInfo).as(module.getKey() + " package-info should exist").exists();
      assertThat(Files.readString(packageInfo))
          .as(module.getKey() + " package should document its bounded context")
          .contains("/**")
          .contains(module.getValue())
          .contains("@since MVP");
    }
  }

  @Test
  void domainLayerStaysFreeOfSpringWebAndMyBatisInfrastructure() throws IOException {
    try (var stream = Files.walk(SOURCE_ROOT)) {
      for (Path domainFile : stream
          .filter(path -> path.toString().contains("/domain/"))
          .filter(path -> path.toString().endsWith(".java"))
          .toList()) {
        String source = Files.readString(domainFile);

        assertThat(source)
            .as(domainFile + " should stay persistence and web framework agnostic")
            .doesNotContain("org.springframework.web")
            .doesNotContain("org.apache.ibatis")
            .doesNotContain("@Mapper")
            .doesNotContain("@RestController");
      }
    }
  }

  @Test
  void apiLayerDoesNotDependOnPersistenceMappersDirectly() throws IOException {
    try (var stream = Files.walk(SOURCE_ROOT)) {
      for (Path apiFile : stream
          .filter(path -> path.toString().contains("/api/"))
          .filter(path -> path.toString().endsWith(".java"))
          .toList()) {
        String source = Files.readString(apiFile);

        assertThat(source)
            .as(apiFile + " should call application services instead of mappers")
            .doesNotContain(".infrastructure.")
            .doesNotContain("Mapper;");
      }
    }
  }

  @Test
  void materialApplicationServiceUsesDomainAuditActions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("catalog/domain/MaterialAuditAction.java");
    Path materialService = SOURCE_ROOT.resolve("catalog/application/MaterialApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"material.created\"")
        .contains("UPDATED = \"material.updated\"");
    assertThat(Files.readString(materialService))
        .contains("MaterialAuditAction.CREATED")
        .contains("MaterialAuditAction.UPDATED")
        .doesNotContain("private static final String MATERIAL_CREATED_ACTION")
        .doesNotContain("private static final String MATERIAL_UPDATED_ACTION");
  }

  @Test
  void departmentApplicationServiceUsesDomainDepartmentStatus() throws IOException {
    Path status = SOURCE_ROOT.resolve("organization/domain/DepartmentStatus.java");
    Path auditAction = SOURCE_ROOT.resolve("organization/domain/DepartmentAuditAction.java");
    Path departmentService = SOURCE_ROOT.resolve("organization/application/DepartmentApplicationService.java");

    assertThat(status).exists();
    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(auditAction).exists();
    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"department.created\"")
        .contains("DISABLED = \"department.disabled\"");
    assertThat(Files.readString(departmentService))
        .contains("DepartmentStatus.ACTIVE")
        .contains("DepartmentStatus.INACTIVE")
        .contains("DepartmentAuditAction.CREATED")
        .contains("DepartmentAuditAction.DISABLED")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("private static final String DEPARTMENT_CREATED_ACTION")
        .doesNotContain("private static final String DEPARTMENT_DISABLED_ACTION");
  }

  @Test
  void attachmentApplicationServiceUsesDomainAttachmentStatus() throws IOException {
    Path status = SOURCE_ROOT.resolve("attachment/domain/AttachmentStatus.java");
    Path visibility = SOURCE_ROOT.resolve("attachment/domain/AttachmentVisibility.java");
    Path attachmentService = SOURCE_ROOT.resolve("attachment/application/AttachmentApplicationService.java");

    assertThat(status).exists();
    assertThat(Files.readString(status)).contains("ACTIVE = \"active\"");
    assertThat(visibility).exists();
    assertThat(Files.readString(visibility))
        .contains("TENANT = \"tenant\"")
        .contains("BUYER_INTERNAL = \"buyer_internal\"")
        .contains("SUPPLIER_SHARED = \"supplier_shared\"")
        .contains("Unsupported attachment visibility");
    assertThat(Files.readString(attachmentService))
        .contains("AttachmentStatus.ACTIVE")
        .contains("AttachmentVisibility.normalize")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("DEFAULT_VISIBILITY")
        .doesNotContain("SUPPORTED_VISIBILITIES")
        .doesNotContain("Unsupported attachment visibility");
  }

  @Test
  void notificationApplicationServiceUsesDomainRecipientStatus() throws IOException {
    Path status = SOURCE_ROOT.resolve("notification/domain/NotificationRecipientStatus.java");
    Path notificationService = SOURCE_ROOT.resolve("notification/application/NotificationApplicationService.java");

    assertThat(status).exists();
    assertThat(Files.readString(status)).contains("ENABLED = \"启用\"");
    assertThat(Files.readString(notificationService))
        .contains("NotificationRecipientStatus.ENABLED")
        .doesNotContain("private static final String ENABLED_STATUS");
  }

  @Test
  void approvalApplicationServicesUseDomainApprovalStatus() throws IOException {
    Path status = SOURCE_ROOT.resolve("approval/domain/ApprovalStatus.java");
    Path businessType = SOURCE_ROOT.resolve("approval/domain/ApprovalBusinessType.java");
    Path templateCode = SOURCE_ROOT.resolve("approval/domain/ApprovalTemplateCode.java");
    Path taskService = SOURCE_ROOT.resolve("approval/application/ApprovalTaskApplicationService.java");
    Path inboxService = SOURCE_ROOT.resolve("approval/application/ApprovalInboxApplicationService.java");

    assertThat(businessType).exists();
    assertThat(Files.readString(businessType))
        .contains("PURCHASE_DEMAND = \"purchase_demand\"")
        .contains("BUYER_SUPPLIER_ADMISSION = \"buyer_supplier_admission\"")
        .contains("RFQ_AWARD = \"rfq_award\"");
    assertThat(Files.readString(status))
        .contains("PENDING = \"待审批\"")
        .contains("APPROVED = \"已通过\"")
        .contains("REJECTED = \"已驳回\"");
    assertThat(templateCode).exists();
    assertThat(Files.readString(templateCode))
        .contains("PURCHASE_DEMAND = \"TPL_PURCHASE_DEMAND\"")
        .contains("SUPPLIER_ADMISSION = \"TPL_SUPPLIER_ADMISSION\"")
        .contains("RFQ_AWARD = \"TPL_RFQ_AWARD\"")
        .contains("ApprovalBusinessType.PURCHASE_DEMAND")
        .contains("ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION")
        .contains("ApprovalBusinessType.RFQ_AWARD")
        .contains("Unsupported approval biz type");
    assertThat(Files.readString(taskService))
        .contains("ApprovalStatus.PENDING")
        .contains("ApprovalTemplateCode.requireByBusinessType")
        .doesNotContain("PENDING_APPROVAL_STATUS")
        .doesNotContain("\"TPL_PURCHASE_DEMAND\"")
        .doesNotContain("\"TPL_SUPPLIER_ADMISSION\"")
        .doesNotContain("\"TPL_RFQ_AWARD\"")
        .doesNotContain("case \"purchase_demand\"")
        .doesNotContain("case \"buyer_supplier_admission\"")
        .doesNotContain("case \"rfq_award\"");
    assertThat(Files.readString(inboxService))
        .contains("ApprovalStatus.PENDING")
        .contains("ApprovalBusinessType.PURCHASE_DEMAND")
        .contains("ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION")
        .contains("ApprovalBusinessType.RFQ_AWARD")
        .doesNotContain("private static final String PURCHASE_DEMAND_BIZ_TYPE")
        .doesNotContain("private static final String BUYER_SUPPLIER_ADMISSION_BIZ_TYPE")
        .doesNotContain("private static final String RFQ_AWARD_BIZ_TYPE")
        .doesNotContain("PENDING_APPROVAL_STATUS");
  }

  @Test
  void applicationServicesUseDomainAuditTargetTypes() throws IOException {
    Path targetType = SOURCE_ROOT.resolve("audit/domain/AuditTargetType.java");

    assertThat(targetType).exists();
    assertThat(Files.readString(targetType))
        .contains("BUYER_USER = \"buyer_user\"")
        .contains("BUYER_SUPPLIER_RELATION = \"buyer_supplier_relation\"")
        .contains("DEPARTMENT = \"department\"")
        .contains("ENTERPRISE = \"enterprise\"")
        .contains("INVOICE = \"invoice\"")
        .contains("MATERIAL = \"material\"")
        .contains("PLATFORM_ANNOUNCEMENT = \"platform_announcement\"")
        .contains("PURCHASE_ORDER = \"purchase_order\"")
        .contains("SUPPLIER_PROFILE = \"supplier_profile\"")
        .contains("SUPPLIER_USER = \"supplier_user\"")
        .contains("TENANT = \"tenant\"");

    Map.ofEntries(
            Map.entry("identity/application/BuyerUserApplicationService.java", "AuditTargetType.BUYER_USER"),
            Map.entry("organization/application/DepartmentApplicationService.java", "AuditTargetType.DEPARTMENT"),
            Map.entry("catalog/application/MaterialApplicationService.java", "AuditTargetType.MATERIAL"),
            Map.entry("supplier/application/BuyerSupplierApplicationService.java", "AuditTargetType.BUYER_SUPPLIER_RELATION"),
            Map.entry("supplier/application/SupplierProfileApplicationService.java", "AuditTargetType.SUPPLIER_PROFILE"),
            Map.entry("supplier/application/SupplierUserApplicationService.java", "AuditTargetType.SUPPLIER_USER"),
            Map.entry("platform/application/PlatformTenantApplicationService.java", "AuditTargetType.TENANT"),
            Map.entry("platform/application/PlatformEnterpriseApplicationService.java", "AuditTargetType.ENTERPRISE"),
            Map.entry("platform/application/PlatformAnnouncementApplicationService.java", "AuditTargetType.PLATFORM_ANNOUNCEMENT"),
            Map.entry("order/application/PurchaseOrderApplicationService.java", "AuditTargetType.PURCHASE_ORDER"),
            Map.entry("order/application/DeliveryApplicationService.java", "AuditTargetType.PURCHASE_ORDER"),
            Map.entry("order/application/ReceiptApplicationService.java", "AuditTargetType.PURCHASE_ORDER"),
            Map.entry("finance/application/InvoiceApplicationService.java", "AuditTargetType.INVOICE"),
            Map.entry("finance/application/PaymentApplicationService.java", "AuditTargetType.INVOICE"))
        .forEach((sourcePath, expectedTargetType) -> {
          try {
            assertThat(Files.readString(SOURCE_ROOT.resolve(sourcePath)))
                .contains(expectedTargetType)
                .doesNotContain("TARGET_TYPE");
          } catch (IOException exception) {
            throw new IllegalStateException(exception);
          }
        });
  }

  @Test
  void workspaceTodoAssemblersUseDomainStatusConstants() throws IOException {
    Path rfqStatus = SOURCE_ROOT.resolve("sourcing/domain/RfqStatus.java");
    Path purchaseOrderStatus = SOURCE_ROOT.resolve("order/domain/PurchaseOrderStatus.java");
    Path invoicePaymentStatus = SOURCE_ROOT.resolve("finance/domain/InvoicePaymentStatus.java");
    Path buyerAssembler = SOURCE_ROOT.resolve("buyer/application/BuyerTodoSummaryAssembler.java");
    Path supplierAssembler = SOURCE_ROOT.resolve("supplier/application/SupplierTodoSummaryAssembler.java");

    assertThat(rfqStatus).exists();
    assertThat(purchaseOrderStatus).exists();
    assertThat(invoicePaymentStatus).exists();

    String buyerSource = Files.readString(buyerAssembler);
    String supplierSource = Files.readString(supplierAssembler);

    assertThat(buyerSource)
        .contains("RfqStatus.QUOTING")
        .contains("PurchaseOrderStatus.SHIPPED")
        .contains("InvoicePaymentStatus.PENDING_PAYMENT")
        .contains("InvoicePaymentStatus.PARTIAL_PAID")
        .doesNotContain("private static final String RFQ_QUOTING_STATUS")
        .doesNotContain("private static final String ORDER_SHIPPED_STATUS");
    assertThat(supplierSource)
        .contains("RfqStatus.QUOTING")
        .contains("PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION")
        .contains("PurchaseOrderStatus.PENDING_SHIPMENT")
        .contains("InvoicePaymentStatus.PENDING_PAYMENT")
        .contains("InvoicePaymentStatus.PARTIAL_PAID")
        .doesNotContain("private static final String RFQ_QUOTING_STATUS")
        .doesNotContain("private static final String ORDER_PENDING_CONFIRMATION_STATUS");
  }

  @Test
  void buyerUserApplicationServiceDelegatesStatusTransitions() throws IOException {
    Path status = SOURCE_ROOT.resolve("identity/domain/BuyerUserStatus.java");
    Path transition = SOURCE_ROOT.resolve("identity/domain/BuyerUserStatusTransition.java");
    Path auditAction = SOURCE_ROOT.resolve("identity/domain/BuyerUserAuditAction.java");
    Path userService = SOURCE_ROOT.resolve("identity/application/BuyerUserApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();
    assertThat(auditAction).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"buyer_user.created\"")
        .contains("ROLE_CHANGED = \"buyer_user.role_changed\"")
        .contains("STATUS_CHANGED = \"buyer_user.status_changed\"")
        .contains("PASSWORD_RESET = \"buyer_user.password_reset\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("BuyerUserStatus.ACTIVE")
        .contains("BuyerUserStatus.INACTIVE")
        .contains("Unsupported buyer user status");
    assertThat(Files.readString(userService))
        .contains("BuyerUserAuditAction.CREATED")
        .contains("BuyerUserAuditAction.ROLE_CHANGED")
        .contains("BuyerUserAuditAction.STATUS_CHANGED")
        .contains("BuyerUserAuditAction.PASSWORD_RESET")
        .contains("BuyerUserStatusTransition")
        .contains("buyerUserStatusTransition.requireSupportedTarget")
        .doesNotContain("private static final String BUYER_USER_CREATED_ACTION")
        .doesNotContain("private static final String BUYER_USER_ROLE_CHANGED_ACTION")
        .doesNotContain("private static final String BUYER_USER_STATUS_CHANGED_ACTION")
        .doesNotContain("private static final String BUYER_USER_PASSWORD_RESET_ACTION")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("Unsupported buyer user status");
  }

  @Test
  void approvalTemplateApplicationServiceDelegatesStatusTransitions() throws IOException {
    Path status = SOURCE_ROOT.resolve("approval/domain/ApprovalTemplateStatus.java");
    Path transition = SOURCE_ROOT.resolve("approval/domain/ApprovalTemplateStatusTransition.java");
    Path templateService = SOURCE_ROOT.resolve("approval/application/ApprovalTemplateApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("ApprovalTemplateStatus.ACTIVE")
        .contains("ApprovalTemplateStatus.INACTIVE")
        .contains("Unsupported approval template status");
    assertThat(Files.readString(templateService))
        .contains("ApprovalTemplateStatusTransition")
        .contains("approvalTemplateStatusTransition.requireSupportedTarget")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("Unsupported approval template status");
  }

  @Test
  void supplierUserApplicationServiceDelegatesStatusTransitions() throws IOException {
    Path status = SOURCE_ROOT.resolve("supplier/domain/SupplierUserStatus.java");
    Path transition = SOURCE_ROOT.resolve("supplier/domain/SupplierUserStatusTransition.java");
    Path auditAction = SOURCE_ROOT.resolve("supplier/domain/SupplierUserAuditAction.java");
    Path userService = SOURCE_ROOT.resolve("supplier/application/SupplierUserApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();
    assertThat(auditAction).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"supplier_user.created\"")
        .contains("PASSWORD_RESET = \"supplier_user.password_reset\"")
        .contains("STATUS_CHANGED = \"supplier_user.status_changed\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("SupplierUserStatus.ACTIVE")
        .contains("SupplierUserStatus.INACTIVE")
        .contains("Unsupported supplier user status");
    assertThat(Files.readString(userService))
        .contains("SupplierUserAuditAction.CREATED")
        .contains("SupplierUserAuditAction.PASSWORD_RESET")
        .contains("SupplierUserAuditAction.STATUS_CHANGED")
        .contains("SupplierUserStatusTransition")
        .contains("supplierUserStatusTransition.requireSupportedTarget")
        .doesNotContain("private static final String SUPPLIER_USER_CREATED_ACTION")
        .doesNotContain("private static final String SUPPLIER_USER_PASSWORD_RESET_ACTION")
        .doesNotContain("private static final String SUPPLIER_USER_STATUS_CHANGED_ACTION")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("Unsupported supplier user status");
  }

  @Test
  void supplierQualificationApplicationServiceDelegatesStatusTransitions() throws IOException {
    Path status = SOURCE_ROOT.resolve("supplier/domain/SupplierQualificationStatus.java");
    Path transition = SOURCE_ROOT.resolve("supplier/domain/SupplierQualificationStatusTransition.java");
    Path qualificationService =
        SOURCE_ROOT.resolve("supplier/application/SupplierQualificationApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("SupplierQualificationStatus.ACTIVE")
        .contains("SupplierQualificationStatus.INACTIVE")
        .contains("Unsupported supplier qualification status");
    assertThat(Files.readString(qualificationService))
        .contains("SupplierQualificationStatus.ACTIVE")
        .contains("SupplierQualificationStatusTransition")
        .contains("supplierQualificationStatusTransition.requireSupportedTarget")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("Unsupported supplier qualification status");
  }

  @Test
  void platformAnnouncementApplicationServiceDelegatesAudiencePolicy() throws IOException {
    Path audience = SOURCE_ROOT.resolve("platform/domain/PlatformAnnouncementAudience.java");
    Path status = SOURCE_ROOT.resolve("platform/domain/PlatformAnnouncementStatus.java");
    Path auditAction = SOURCE_ROOT.resolve("platform/domain/PlatformAnnouncementAuditAction.java");
    Path policy = SOURCE_ROOT.resolve("platform/domain/PlatformAnnouncementAudiencePolicy.java");
    Path announcementService =
        SOURCE_ROOT.resolve("platform/application/PlatformAnnouncementApplicationService.java");

    assertThat(audience).exists();
    assertThat(status).exists();
    assertThat(auditAction).exists();
    assertThat(policy).exists();

    assertThat(Files.readString(audience))
        .contains("ALL = \"all\"")
        .contains("BUYER = \"buyer\"")
        .contains("SUPPLIER = \"supplier\"");
    assertThat(Files.readString(status)).contains("ACTIVE = \"active\"");
    assertThat(Files.readString(auditAction))
        .contains("PUBLISHED = \"platform_announcement.published\"");
    assertThat(Files.readString(policy))
        .contains("void requireSupported")
        .contains("PlatformAnnouncementAudience.ALL")
        .contains("PlatformAnnouncementAudience.BUYER")
        .contains("PlatformAnnouncementAudience.SUPPLIER")
        .contains("Unsupported platform announcement audience");
    assertThat(Files.readString(announcementService))
        .contains("PlatformAnnouncementAudiencePolicy")
        .contains("platformAnnouncementAudiencePolicy.requireSupported")
        .contains("PlatformAnnouncementAudience.ALL")
        .contains("PlatformAnnouncementAudience.BUYER")
        .contains("PlatformAnnouncementAudience.SUPPLIER")
        .contains("PlatformAnnouncementStatus.ACTIVE")
        .contains("PlatformAnnouncementAuditAction.PUBLISHED")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String PLATFORM_ANNOUNCEMENT_PUBLISHED_ACTION")
        .doesNotContain("private static final String ALL_AUDIENCE")
        .doesNotContain("private static final String BUYER_AUDIENCE")
        .doesNotContain("private static final String SUPPLIER_AUDIENCE")
        .doesNotContain("Unsupported platform announcement audience");
  }

  @Test
  void platformTenantServicesUseDomainTenantStatus() throws IOException {
    Path status = SOURCE_ROOT.resolve("platform/domain/PlatformTenantStatus.java");
    Path auditAction = SOURCE_ROOT.resolve("platform/domain/PlatformTenantAuditAction.java");
    Path buyerRoleDefaults = SOURCE_ROOT.resolve("platform/domain/PlatformBuyerRoleDefaults.java");
    Path defaultApprovalTemplate = SOURCE_ROOT.resolve("platform/domain/PlatformDefaultApprovalTemplate.java");
    Path tenantService = SOURCE_ROOT.resolve("platform/application/PlatformTenantApplicationService.java");
    Path workspaceService = SOURCE_ROOT.resolve("platform/application/PlatformWorkspaceApplicationService.java");

    assertThat(status).exists();
    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(auditAction).exists();
    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"tenant.created\"")
        .contains("FEATURES_UPDATED = \"tenant.features.updated\"")
        .contains("PLAN_UPDATED = \"tenant.plan_updated\"")
        .contains("ENABLED = \"tenant.enabled\"")
        .contains("DISABLED = \"tenant.disabled\"");
    assertThat(buyerRoleDefaults).exists();
    assertThat(Files.readString(buyerRoleDefaults))
        .contains("OWNER_ROLE_NAME = \"采购管理员\"")
        .contains("OWNER_PERMISSIONS_JSON = \"[\\\"buyer:*\\\"]\"");
    assertThat(defaultApprovalTemplate).exists();
    assertThat(Files.readString(defaultApprovalTemplate))
        .contains("BUYER_TEMPLATES")
        .contains("ApprovalTemplateCode.PURCHASE_DEMAND")
        .contains("ApprovalTemplateCode.SUPPLIER_ADMISSION")
        .contains("ApprovalTemplateCode.RFQ_AWARD")
        .contains("ApprovalBusinessType.PURCHASE_DEMAND")
        .contains("ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION")
        .contains("ApprovalBusinessType.RFQ_AWARD")
        .contains("\"需求审批\"")
        .contains("\"供应商准入\"")
        .contains("\"定标审批\"");
    assertThat(Files.readString(tenantService))
        .contains("PlatformTenantStatus.ACTIVE")
        .contains("PlatformTenantStatus.INACTIVE")
        .contains("PlatformTenantAuditAction.CREATED")
        .contains("PlatformTenantAuditAction.FEATURES_UPDATED")
        .contains("PlatformTenantAuditAction.PLAN_UPDATED")
        .contains("PlatformTenantAuditAction.ENABLED")
        .contains("PlatformTenantAuditAction.DISABLED")
        .contains("PlatformBuyerRoleDefaults.OWNER_ROLE_NAME")
        .contains("PlatformBuyerRoleDefaults.OWNER_PERMISSIONS_JSON")
        .contains("PlatformDefaultApprovalTemplate.BUYER_TEMPLATES")
        .doesNotContain("private static final String ACTIVE_STATUS")
        .doesNotContain("private static final String INACTIVE_STATUS")
        .doesNotContain("private static final String BUYER_OWNER_ROLE_NAME")
        .doesNotContain("private static final String BUYER_OWNER_PERMISSIONS")
        .doesNotContain("\"TPL_PURCHASE_DEMAND\"")
        .doesNotContain("\"TPL_SUPPLIER_ADMISSION\"")
        .doesNotContain("\"TPL_RFQ_AWARD\"")
        .doesNotContain("\"需求审批\"")
        .doesNotContain("\"供应商准入\"")
        .doesNotContain("\"定标审批\"")
        .doesNotContain("private static final String TENANT_CREATED_ACTION")
        .doesNotContain("private static final String TENANT_DISABLED_ACTION")
        .doesNotContain("private static final String TENANT_ENABLED_ACTION")
        .doesNotContain("private static final String TENANT_FEATURES_UPDATED_ACTION")
        .doesNotContain("private static final String TENANT_PLAN_UPDATED_ACTION");
    assertThat(Files.readString(workspaceService))
        .contains("PlatformTenantStatus.ACTIVE")
        .doesNotContain("private static final String ACTIVE_TENANT_STATUS");
  }

  @Test
  void applicationServicesUseDomainTenantFeatureKeys() throws IOException {
    Path featureKey = SOURCE_ROOT.resolve("tenant/domain/TenantFeatureKey.java");

    assertThat(featureKey).exists();
    assertThat(Files.readString(featureKey))
        .contains("RFQ = \"rfq\"")
        .contains("ORDER = \"order\"")
        .contains("FINANCE = \"finance\"");

    Map.ofEntries(
            Map.entry("sourcing/application/RfqApplicationService.java", "TenantFeatureKey.RFQ"),
            Map.entry("order/application/PurchaseOrderApplicationService.java", "TenantFeatureKey.ORDER"),
            Map.entry("order/application/DeliveryApplicationService.java", "TenantFeatureKey.ORDER"),
            Map.entry("order/application/ReceiptApplicationService.java", "TenantFeatureKey.ORDER"),
            Map.entry("finance/application/InvoiceApplicationService.java", "TenantFeatureKey.FINANCE"),
            Map.entry("finance/application/PaymentApplicationService.java", "TenantFeatureKey.FINANCE"))
        .forEach((sourcePath, expectedFeatureKey) -> {
          try {
            assertThat(Files.readString(SOURCE_ROOT.resolve(sourcePath)))
                .contains(expectedFeatureKey)
                .doesNotContain("RFQ_FEATURE")
                .doesNotContain("ORDER_FEATURE")
                .doesNotContain("FINANCE_FEATURE");
          } catch (IOException exception) {
            throw new IllegalStateException(exception);
          }
        });
  }

  @Test
  void applicationServicesUseDomainNotificationTitles() throws IOException {
    Path notificationTitle = SOURCE_ROOT.resolve("notification/domain/NotificationTitle.java");

    assertThat(notificationTitle).exists();
    assertThat(Files.readString(notificationTitle))
        .contains("PURCHASE_DEMAND_PENDING_APPROVAL = \"采购需求待审批\"")
        .contains("PURCHASE_DEMAND_APPROVED = \"采购需求审批已通过\"")
        .contains("PURCHASE_DEMAND_REJECTED = \"采购需求审批已驳回\"")
        .contains("SUPPLIER_ADMISSION_APPROVED = \"供应商准入审批已通过\"")
        .contains("SUPPLIER_ADMISSION_REJECTED = \"供应商准入审批已驳回\"")
        .contains("RFQ_AWARD_PENDING_APPROVAL = \"定标结果待审批\"")
        .contains("RFQ_AWARD_APPROVED = \"定标审批已通过\"")
        .contains("RFQ_AWARD_REJECTED = \"定标审批已驳回\"")
        .contains("PURCHASE_ORDER_CONFIRMED = \"采购订单已确认\"")
        .contains("PURCHASE_ORDER_SHIPPED = \"采购订单已发货\"")
        .contains("PURCHASE_ORDER_RECEIVED = \"采购订单已收货\"")
        .contains("INVOICE_CREATED = \"供应商已登记发票\"")
        .contains("INVOICE_PAID = \"发票已付款\"")
        .contains("INVOICE_PARTIAL_PAID = \"发票部分付款\"");

    Map.ofEntries(
            Map.entry("demand/application/PurchaseDemandApplicationService.java", "NotificationTitle.PURCHASE_DEMAND_PENDING_APPROVAL"),
            Map.entry("supplier/application/BuyerSupplierApplicationService.java", "NotificationTitle.SUPPLIER_ADMISSION_APPROVED"),
            Map.entry("sourcing/application/AwardApplicationService.java", "NotificationTitle.RFQ_AWARD_PENDING_APPROVAL"),
            Map.entry("order/application/PurchaseOrderApplicationService.java", "NotificationTitle.PURCHASE_ORDER_CONFIRMED"),
            Map.entry("order/application/DeliveryApplicationService.java", "NotificationTitle.PURCHASE_ORDER_SHIPPED"),
            Map.entry("order/application/ReceiptApplicationService.java", "NotificationTitle.PURCHASE_ORDER_RECEIVED"),
            Map.entry("finance/application/InvoiceApplicationService.java", "NotificationTitle.INVOICE_CREATED"),
            Map.entry("finance/application/PaymentApplicationService.java", "NotificationTitle.INVOICE_PAID"))
        .forEach((sourcePath, expectedTitle) -> {
          try {
            assertThat(Files.readString(SOURCE_ROOT.resolve(sourcePath)))
                .contains(expectedTitle)
                .doesNotContain("NOTIFICATION_TITLE");
          } catch (IOException exception) {
            throw new IllegalStateException(exception);
          }
        });
  }

  @Test
  void platformEnterpriseApplicationServiceUsesDomainAuditActions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("platform/domain/PlatformEnterpriseAuditAction.java");
    Path enterpriseService =
        SOURCE_ROOT.resolve("platform/application/PlatformEnterpriseApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(Files.readString(auditAction)).contains("REVIEWED = \"enterprise.reviewed\"");
    assertThat(Files.readString(enterpriseService))
        .contains("PlatformEnterpriseAuditAction.REVIEWED")
        .doesNotContain("private static final String ENTERPRISE_REVIEWED_ACTION");
  }

  @Test
  void rfqOrderAndInvoiceApplicationServicesUseDomainStatusConstants() throws IOException {
    Path invoiceAuditAction = SOURCE_ROOT.resolve("finance/domain/InvoiceAuditAction.java");
    assertThat(invoiceAuditAction).exists();
    assertThat(Files.readString(invoiceAuditAction))
        .contains("CREATED = \"invoice.created\"")
        .contains("PAID = \"invoice.paid\"")
        .contains("PARTIAL_PAID = \"invoice.partial_paid\"");

    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/RfqApplicationService.java"),
        List.of(
            "RfqStatus.QUOTING",
            "RfqSourcingStatusTransition",
            "RfqDemandLinkPolicy.requireUnlinkedDemand",
            "BuyerSupplierRelationStatus.ADMITTED",
            "RfqInviteStatus.INVITED"),
        List.of(
            "private static final String QUOTING_STATUS",
            "private static final String APPROVED_DEMAND_STATUS",
            "private static final String APPROVED_SUPPLIER_STATUS",
            "private static final String INVITED_STATUS",
            "Purchase demand already linked to an RFQ"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/AwardApplicationService.java"),
        List.of(
            "RfqStatus.QUOTING",
            "RfqStatus.AWARD_APPROVAL",
            "RfqAwardStatusTransition",
            "QuoteStatus.SUBMITTED",
            "ApprovalStatus.APPROVED",
            "ApprovalStatus.REJECTED"),
        List.of(
            "private static final String QUOTING_RFQ_STATUS",
            "private static final String AWARD_APPROVAL_RFQ_STATUS",
            "private static final String AWARDED_RFQ_STATUS",
            "private static final String SUBMITTED_QUOTE_STATUS",
            "private static final String APPROVED_STATUS",
            "private static final String REJECTED_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/QuoteApplicationService.java"),
        List.of(
            "RfqSourcingStatusTransition",
            "RfqQuoteSubmissionPolicy.requireNoSubmittedQuote",
            "QuoteStatus.SUBMITTED"),
        List.of(
            "private static final String QUOTING_STATUS",
            "private static final String SUBMITTED_STATUS",
            "Supplier has already submitted a quote"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/PurchaseOrderApplicationService.java"),
        List.of(
            "PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION",
            "PurchaseOrderStatus.PENDING_SHIPMENT",
            "ApprovalStatus.APPROVED"),
        List.of(
            "private static final String APPROVED_STATUS",
            "private static final String PENDING_SUPPLIER_CONFIRM_STATUS",
            "private static final String READY_TO_SHIP_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/DeliveryApplicationService.java"),
        List.of(
            "PurchaseOrderStatus.PENDING_SHIPMENT",
            "PurchaseOrderStatus.SHIPPED",
            "PurchaseOrderDocumentUniquenessPolicy.requireNoDelivery"),
        List.of(
            "private static final String READY_TO_SHIP_STATUS",
            "private static final String SHIPPED_STATUS",
            "Purchase order already has a delivery"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/ReceiptApplicationService.java"),
        List.of(
            "PurchaseOrderStatus.SHIPPED",
            "PurchaseOrderStatus.RECEIVED",
            "PurchaseOrderDocumentUniquenessPolicy.requireNoReceipt"),
        List.of(
            "private static final String SHIPPED_STATUS",
            "private static final String RECEIVED_STATUS",
            "Purchase order already has a receipt"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("finance/application/InvoiceApplicationService.java"),
        List.of(
            "InvoiceCreationStatusPolicy.requireReceivedOrder",
            "InvoiceAmountPolicy.requireInvoiceCreationAmountMatchesOrder",
            "PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice",
            "InvoicePaymentStatus.PENDING_PAYMENT",
            "InvoiceAuditAction.CREATED",
            "InvoiceAuditAction.PAID",
            "InvoiceAuditAction.PARTIAL_PAID"),
        List.of(
            "private static final String RECEIVED_STATUS",
            "private static final String PENDING_PAYMENT_STATUS",
            "private static final String INVOICE_CREATED_ACTION",
            "private static final String INVOICE_PAID_ACTION",
            "private static final String INVOICE_PARTIAL_PAID_ACTION",
            "PurchaseOrderStatus.RECEIVED",
            "compareTo(order.amount())",
            "Invoice amount must equal purchase order amount",
            "Only received purchase orders can be invoiced",
            "Purchase order already has an invoice"));
    Path invoiceCreationStatusPolicy = SOURCE_ROOT.resolve("finance/domain/InvoiceCreationStatusPolicy.java");
    assertThat(invoiceCreationStatusPolicy).exists();
    assertThat(Files.readString(invoiceCreationStatusPolicy))
        .contains("requireReceivedOrder")
        .contains("PurchaseOrderStatus.RECEIVED")
        .contains("Only received purchase orders can be invoiced");
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("finance/application/PaymentApplicationService.java"),
        List.of(
            "InvoiceAmountPolicy.requirePaymentAmountStillMatchesOrder",
            "BuyerSupplierPaymentPolicy.requirePayable",
            "InvoicePaymentStatus.PAID",
            "InvoicePaymentStatusTransition",
            "InvoiceAuditAction.PAID",
            "InvoiceAuditAction.PARTIAL_PAID",
            "BuyerSupplierRelationStatus.BLACKLISTED"),
        List.of(
            "private static final String PENDING_PAYMENT_STATUS",
            "private static final String PAID_STATUS",
            "private static final String PARTIAL_PAID_STATUS",
            "private static final String INVOICE_PAID_ACTION",
            "private static final String INVOICE_PARTIAL_PAID_ACTION",
            "private static final String BLACKLISTED_SUPPLIER_STATUS",
            "invoice.amount().compareTo",
            "Invoice amount no longer matches purchase order amount",
            "Blacklisted supplier cannot be paid"));
    Path invoiceAmountPolicy = SOURCE_ROOT.resolve("finance/domain/InvoiceAmountPolicy.java");
    assertThat(invoiceAmountPolicy).exists();
    assertThat(Files.readString(invoiceAmountPolicy))
        .contains("requireInvoiceCreationAmountMatchesOrder")
        .contains("requirePaymentAmountStillMatchesOrder")
        .contains("Invoice amount must equal purchase order amount")
        .contains("Invoice amount no longer matches purchase order amount");
    Path documentUniquenessPolicy = SOURCE_ROOT.resolve("order/domain/PurchaseOrderDocumentUniquenessPolicy.java");
    assertThat(documentUniquenessPolicy).exists();
    assertThat(Files.readString(documentUniquenessPolicy))
        .contains("requireNoDelivery")
        .contains("requireNoReceipt")
        .contains("requireNoInvoice")
        .contains("Purchase order already has a delivery")
        .contains("Purchase order already has a receipt")
        .contains("Purchase order already has an invoice");
    Path paymentPolicy = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierPaymentPolicy.java");
    assertThat(paymentPolicy).exists();
    assertThat(Files.readString(paymentPolicy))
        .contains("requirePayable")
        .contains("Blacklisted supplier cannot be paid");
  }

  @Test
  void paymentApplicationServiceDelegatesInvoicePaymentStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("finance/domain/InvoicePaymentStatusTransition.java");
    Path paymentService = SOURCE_ROOT.resolve("finance/application/PaymentApplicationService.java");

    assertThat(transition).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("boolean isSupportedTarget")
        .contains("boolean isIdempotentRegistration")
        .contains("void requireTransition")
        .contains("InvoicePaymentStatus.PENDING_PAYMENT")
        .contains("InvoicePaymentStatus.PARTIAL_PAID")
        .contains("InvoicePaymentStatus.PAID");

    assertThat(Files.readString(paymentService))
        .contains("InvoicePaymentStatusTransition")
        .contains("invoicePaymentStatusTransition.requireTransition")
        .doesNotContain("private boolean isSupportedPaymentTarget")
        .doesNotContain("private boolean isIdempotentPaymentRegistration")
        .doesNotContain("private void requirePaymentTransition");
  }

  @Test
  void awardApplicationServiceDelegatesRfqAwardStatusTransitions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("sourcing/domain/RfqAwardAuditAction.java");
    Path transition = SOURCE_ROOT.resolve("sourcing/domain/RfqAwardStatusTransition.java");
    Path awardService = SOURCE_ROOT.resolve("sourcing/application/AwardApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(auditAction))
        .contains("SUBMITTED = \"rfq_award.submitted\"")
        .contains("APPROVED = \"rfq_award.approved\"")
        .contains("REJECTED = \"rfq_award.rejected\"");

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireAwardSubmission")
        .contains("void requireAwardReview")
        .contains("String reviewTargetStatus")
        .contains("RfqStatus.QUOTING")
        .contains("RfqStatus.AWARD_APPROVAL")
        .contains("RfqStatus.AWARDED");

    assertThat(Files.readString(awardService))
        .contains("RfqAwardStatusTransition")
        .contains("RfqAwardAuditAction.SUBMITTED")
        .contains("RfqAwardAuditAction.APPROVED")
        .contains("RfqAwardAuditAction.REJECTED")
        .contains("ApprovalBusinessType.RFQ_AWARD")
        .contains("rfqAwardStatusTransition.requireAwardSubmission")
        .contains("rfqAwardStatusTransition.requireAwardReview")
        .contains("rfqAwardStatusTransition.reviewTargetStatus")
        .doesNotContain("private static final String RFQ_AWARD_BIZ_TYPE")
        .doesNotContain("private static final String RFQ_AWARD_SUBMITTED_ACTION")
        .doesNotContain("private static final String RFQ_AWARD_APPROVED_ACTION")
        .doesNotContain("private static final String RFQ_AWARD_REJECTED_ACTION")
        .doesNotContain("Only quoting RFQs can be awarded")
        .doesNotContain("Only RFQs in award approval can be reviewed");
  }

  @Test
  void rfqAndQuoteApplicationServicesDelegateSourcingStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("sourcing/domain/RfqSourcingStatusTransition.java");
    Path demandLinkPolicy = SOURCE_ROOT.resolve("sourcing/domain/RfqDemandLinkPolicy.java");
    Path quoteSubmissionPolicy = SOURCE_ROOT.resolve("sourcing/domain/RfqQuoteSubmissionPolicy.java");
    Path rfqService = SOURCE_ROOT.resolve("sourcing/application/RfqApplicationService.java");
    Path quoteService = SOURCE_ROOT.resolve("sourcing/application/QuoteApplicationService.java");

    assertThat(transition).exists();
    assertThat(demandLinkPolicy).exists();
    assertThat(quoteSubmissionPolicy).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireApprovedDemandForRfq")
        .contains("void requireQuotingForQuoteSubmission")
        .contains("PurchaseDemandStatus.APPROVED")
        .contains("RfqStatus.QUOTING");
    assertThat(Files.readString(quoteSubmissionPolicy))
        .contains("void requireNoSubmittedQuote")
        .contains("Supplier has already submitted a quote");
    assertThat(Files.readString(demandLinkPolicy))
        .contains("void requireUnlinkedDemand")
        .contains("Purchase demand already linked to an RFQ");

    assertThat(Files.readString(rfqService))
        .contains("RfqSourcingStatusTransition")
        .contains("RfqDemandLinkPolicy")
        .contains("rfqSourcingStatusTransition.requireApprovedDemandForRfq")
        .contains("RfqDemandLinkPolicy.requireUnlinkedDemand")
        .doesNotContain("RFQ can only use approved purchase demands")
        .doesNotContain("Purchase demand already linked to an RFQ")
        .doesNotContain("PurchaseDemandStatus.APPROVED");
    assertThat(Files.readString(quoteService))
        .contains("RfqSourcingStatusTransition")
        .contains("RfqQuoteSubmissionPolicy")
        .contains("rfqSourcingStatusTransition.requireQuotingForQuoteSubmission")
        .contains("RfqQuoteSubmissionPolicy.requireNoSubmittedQuote")
        .doesNotContain("RFQ is not open for quotes")
        .doesNotContain("Supplier has already submitted a quote")
        .doesNotContain("RfqStatus.QUOTING");
  }

  @Test
  void orderFulfillmentServicesDelegatePurchaseOrderStatusTransitions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("order/domain/PurchaseOrderAuditAction.java");
    Path transition = SOURCE_ROOT.resolve("order/domain/PurchaseOrderStatusTransition.java");
    Path purchaseOrderService = SOURCE_ROOT.resolve("order/application/PurchaseOrderApplicationService.java");
    Path deliveryService = SOURCE_ROOT.resolve("order/application/DeliveryApplicationService.java");
    Path receiptService = SOURCE_ROOT.resolve("order/application/ReceiptApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(auditAction))
        .contains("CREATED = \"purchase_order.created\"")
        .contains("CONFIRMED = \"purchase_order.confirmed\"")
        .contains("SHIPPED = \"purchase_order.shipped\"")
        .contains("RECEIVED = \"purchase_order.received\"");

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireSupplierConfirmation")
        .contains("void requireShipment")
        .contains("void requireReceipt")
        .contains("PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION")
        .contains("PurchaseOrderStatus.PENDING_SHIPMENT")
        .contains("PurchaseOrderStatus.SHIPPED");

    assertThat(Files.readString(purchaseOrderService))
        .contains("PurchaseOrderStatusTransition")
        .contains("PurchaseOrderAuditAction.CREATED")
        .contains("PurchaseOrderAuditAction.CONFIRMED")
        .contains("purchaseOrderStatusTransition.requireSupplierConfirmation")
        .doesNotContain("private static final String PURCHASE_ORDER_CREATED_ACTION")
        .doesNotContain("private static final String PURCHASE_ORDER_CONFIRMED_ACTION")
        .doesNotContain("Only pending supplier confirmation orders can be confirmed");
    assertThat(Files.readString(deliveryService))
        .contains("PurchaseOrderStatusTransition")
        .contains("PurchaseOrderAuditAction.SHIPPED")
        .contains("purchaseOrderStatusTransition.requireShipment")
        .doesNotContain("private static final String PURCHASE_ORDER_SHIPPED_ACTION")
        .doesNotContain("Only ready-to-ship orders can be shipped");
    assertThat(Files.readString(receiptService))
        .contains("PurchaseOrderStatusTransition")
        .contains("PurchaseOrderAuditAction.RECEIVED")
        .contains("purchaseOrderStatusTransition.requireReceipt")
        .doesNotContain("private static final String PURCHASE_ORDER_RECEIVED_ACTION")
        .doesNotContain("Only shipped purchase orders can be received");
  }

  @Test
  void demandAndSupplierApplicationServicesUseDomainStatusConstants() throws IOException {
    Path demandAuditAction = SOURCE_ROOT.resolve("demand/domain/PurchaseDemandAuditAction.java");
    assertThat(demandAuditAction).exists();
    assertThat(Files.readString(demandAuditAction))
        .contains("CREATED = \"purchase_demand.created\"")
        .contains("APPROVED = \"purchase_demand.approved\"")
        .contains("REJECTED = \"purchase_demand.rejected\"");

    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("demand/application/PurchaseDemandApplicationService.java"),
        List.of(
            "PurchaseDemandStatus.DRAFT",
            "PurchaseDemandStatus.IN_APPROVAL",
            "PurchaseDemandApprovalStatusTransition",
            "PurchaseDemandAuditAction.CREATED",
            "PurchaseDemandAuditAction.APPROVED",
            "PurchaseDemandAuditAction.REJECTED",
            "ApprovalBusinessType.PURCHASE_DEMAND",
            "ApprovalStatus.APPROVED",
            "ApprovalStatus.REJECTED"),
        List.of(
            "private static final String DRAFT_STATUS",
            "private static final String IN_APPROVAL_STATUS",
            "private static final String APPROVED_STATUS",
            "private static final String REJECTED_STATUS",
            "private static final String PURCHASE_DEMAND_BIZ_TYPE",
            "private static final String PURCHASE_DEMAND_CREATED_ACTION",
            "private static final String PURCHASE_DEMAND_APPROVED_ACTION",
            "private static final String PURCHASE_DEMAND_REJECTED_ACTION"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("supplier/application/BuyerSupplierApplicationService.java"),
        List.of(
            "BuyerSupplierRelationStatus.PENDING_ADMISSION",
            "BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL",
            "BuyerSupplierAdmissionStatusTransition",
            "BuyerSupplierManualStatusTransition",
            "ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION",
            "ApprovalStatus.APPROVED",
            "ApprovalStatus.REJECTED"),
        List.of(
            "private static final String PENDING_ADMISSION_STATUS",
            "private static final String IN_ADMISSION_APPROVAL_STATUS",
            "private static final String ADMITTED_STATUS",
            "private static final String REJECTED_STATUS",
            "private static final String BLACKLISTED_STATUS",
            "private static final String BUYER_SUPPLIER_ADMISSION_BIZ_TYPE",
            "private static final String APPROVED_STATUS"));
  }

  @Test
  void buyerSupplierApplicationServiceDelegatesAdmissionStatusTransitions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierAuditAction.java");
    Path transition = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierAdmissionStatusTransition.java");
    Path performanceScore = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierPerformanceScore.java");
    Path supplierService = SOURCE_ROOT.resolve("supplier/application/BuyerSupplierApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(transition).exists();
    assertThat(performanceScore).exists();

    assertThat(Files.readString(auditAction))
        .contains("RELATION_CREATED = \"buyer_supplier_relation.created\"")
        .contains("RELATION_PROFILE_UPDATED = \"buyer_supplier_relation.profile_updated\"")
        .contains("RELATION_PERFORMANCE_UPDATED = \"buyer_supplier_relation.performance_updated\"")
        .contains("RELATION_STATUS_CHANGED = \"buyer_supplier_relation.status_changed\"")
        .contains("ADMISSION_SUBMITTED = \"buyer_supplier_admission.submitted\"")
        .contains("ADMISSION_APPROVED = \"buyer_supplier_admission.approved\"")
        .contains("ADMISSION_REJECTED = \"buyer_supplier_admission.rejected\"");

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireAdmissionSubmission")
        .contains("void requireAdmissionReview")
        .contains("String reviewTargetStatus")
        .contains("BuyerSupplierRelationStatus.PENDING_ADMISSION")
        .contains("BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL")
        .contains("BuyerSupplierRelationStatus.ADMITTED")
        .contains("BuyerSupplierRelationStatus.REJECTED");
    assertThat(Files.readString(performanceScore))
        .contains("requireValid")
        .contains("BigDecimal.ZERO")
        .contains("BigDecimal.valueOf(100)")
        .contains("Supplier performance score must be between 0 and 100");

    assertThat(Files.readString(supplierService))
        .contains("BuyerSupplierAdmissionStatusTransition")
        .contains("BuyerSupplierPerformanceScore.requireValid")
        .contains("BuyerSupplierAuditAction.RELATION_CREATED")
        .contains("BuyerSupplierAuditAction.RELATION_PROFILE_UPDATED")
        .contains("BuyerSupplierAuditAction.RELATION_PERFORMANCE_UPDATED")
        .contains("BuyerSupplierAuditAction.RELATION_STATUS_CHANGED")
        .contains("BuyerSupplierAuditAction.ADMISSION_SUBMITTED")
        .contains("BuyerSupplierAuditAction.ADMISSION_APPROVED")
        .contains("BuyerSupplierAuditAction.ADMISSION_REJECTED")
        .contains("ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION")
        .contains("buyerSupplierAdmissionStatusTransition.requireAdmissionSubmission")
        .contains("buyerSupplierAdmissionStatusTransition.requireAdmissionReview")
        .contains("buyerSupplierAdmissionStatusTransition.reviewTargetStatus")
        .doesNotContain("private static final String BUYER_SUPPLIER_ADMISSION_BIZ_TYPE")
        .doesNotContain("private static final String SUPPLIER_RELATION_CREATED_ACTION")
        .doesNotContain("private static final String SUPPLIER_ADMISSION_SUBMITTED_ACTION")
        .doesNotContain("private static final String SUPPLIER_ADMISSION_APPROVED_ACTION")
        .doesNotContain("private static final String SUPPLIER_ADMISSION_REJECTED_ACTION")
        .doesNotContain("private static final String SUPPLIER_RELATION_PROFILE_UPDATED_ACTION")
        .doesNotContain("private static final String SUPPLIER_RELATION_PERFORMANCE_UPDATED_ACTION")
        .doesNotContain("private static final String SUPPLIER_RELATION_STATUS_CHANGED_ACTION")
        .doesNotContain("Only pending supplier relations can be submitted for admission")
        .doesNotContain("Only supplier relations in admission approval can be reviewed")
        .doesNotContain("Supplier performance score must be between 0 and 100");
  }

  @Test
  void supplierProfileApplicationServiceUsesDomainAuditActions() throws IOException {
    Path auditAction = SOURCE_ROOT.resolve("supplier/domain/SupplierProfileAuditAction.java");
    Path supplierProfileService =
        SOURCE_ROOT.resolve("supplier/application/SupplierProfileApplicationService.java");

    assertThat(auditAction).exists();
    assertThat(Files.readString(auditAction)).contains("UPDATED = \"supplier_profile.updated\"");
    assertThat(Files.readString(supplierProfileService))
        .contains("SupplierProfileAuditAction.UPDATED")
        .doesNotContain("private static final String SUPPLIER_PROFILE_UPDATED_ACTION");
  }

  @Test
  void buyerSupplierApplicationServiceDelegatesManualStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierManualStatusTransition.java");
    Path supplierService = SOURCE_ROOT.resolve("supplier/application/BuyerSupplierApplicationService.java");

    assertThat(transition).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireSupportedTarget")
        .contains("void requireTransition")
        .contains("BuyerSupplierRelationStatus.BLACKLISTED")
        .contains("BuyerSupplierRelationStatus.PENDING_ADMISSION")
        .contains("BuyerSupplierRelationStatus.REJECTED")
        .contains("BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL");

    assertThat(Files.readString(supplierService))
        .contains("BuyerSupplierManualStatusTransition")
        .contains("buyerSupplierManualStatusTransition.requireSupportedTarget")
        .contains("buyerSupplierManualStatusTransition.requireTransition")
        .doesNotContain("Unsupported buyer supplier relation target status")
        .doesNotContain("Supplier relations in admission approval cannot be manually changed")
        .doesNotContain("Only blacklisted or rejected supplier relations can be restored to pending admission");
  }

  @Test
  void purchaseDemandApplicationServiceDelegatesApprovalStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("demand/domain/PurchaseDemandApprovalStatusTransition.java");
    Path demandService = SOURCE_ROOT.resolve("demand/application/PurchaseDemandApplicationService.java");

    assertThat(transition).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireSubmission")
        .contains("void requireReview")
        .contains("String reviewTargetStatus")
        .contains("PurchaseDemandStatus.DRAFT")
        .contains("PurchaseDemandStatus.IN_APPROVAL")
        .contains("PurchaseDemandStatus.APPROVED")
        .contains("PurchaseDemandStatus.REJECTED");

    assertThat(Files.readString(demandService))
        .contains("PurchaseDemandApprovalStatusTransition")
        .contains("purchaseDemandApprovalStatusTransition.requireSubmission")
        .contains("purchaseDemandApprovalStatusTransition.requireReview")
        .contains("purchaseDemandApprovalStatusTransition.reviewTargetStatus")
        .doesNotContain("Only draft purchase demands can be submitted")
        .doesNotContain("Only in-approval purchase demands can be reviewed");
  }

  private void assertSourceUsesStatusConstants(
      Path sourcePath,
      List<String> expectedReferences,
      List<String> forbiddenLocalConstants) throws IOException {
    String source = Files.readString(sourcePath);

    for (String expectedReference : expectedReferences) {
      assertThat(source)
          .as(sourcePath + " should use " + expectedReference)
          .contains(expectedReference);
    }
    for (String forbiddenLocalConstant : forbiddenLocalConstants) {
      assertThat(source)
          .as(sourcePath + " should not redefine " + forbiddenLocalConstant)
          .doesNotContain(forbiddenLocalConstant);
    }
  }
}
