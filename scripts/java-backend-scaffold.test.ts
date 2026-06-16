import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java backend scaffold', () => {
  it('keeps the Node backend explicitly marked as a prototype', () => {
    const doc = read('docs/backend-skeleton.md');

    expect(doc).toContain('Node 后端原型');
    expect(doc).toContain('正式后端以 backend-java 为准');
  });

  it('provides a Spring Boot backend module boundary', () => {
    expect(existsSync(join(root, 'backend-java/pom.xml'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/ProcurementApplication.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/resources/application.yml'))).toBe(true);
  });

  it('defines core package boundaries for the procurement SaaS backend', () => {
    const expectedPackages = [
      'platform',
      'tenant',
      'identity',
      'organization',
      'supplier',
      'catalog',
      'demand',
      'approval',
      'sourcing',
      'order',
      'finance',
      'notification',
      'attachment',
      'audit',
      'dictionary',
      'common',
    ];

    for (const packageName of expectedPackages) {
      expect(existsSync(join(root, `backend-java/src/main/java/com/procurement/${packageName}`))).toBe(true);
    }
  });

  it('permits the public health endpoint through Spring Security', () => {
    const securityConfig = read('backend-java/src/main/java/com/procurement/identity/SecurityConfig.java');

    expect(securityConfig).toContain('/api/v1/health');
    expect(securityConfig).toContain('permitAll');
  });

  it('moves the initial PostgreSQL schema into Flyway migrations', () => {
    const migration = read('backend-java/src/main/resources/db/migration/V1__initial_schema.sql');
    const supplierQualificationMigration = read('backend-java/src/main/resources/db/migration/V3__supplier_qualifications.sql');
    const dictionaryMigration = read('backend-java/src/main/resources/db/migration/V5__dictionaries.sql');

    expect(migration).toContain('create table tenants');
    expect(migration).toContain('create table departments');
    expect(migration).toContain('create table purchase_demands');
    expect(migration).toContain('create table rfqs');
    expect(migration).toContain('create table purchase_orders');
    expect(supplierQualificationMigration).toContain('create table supplier_qualifications');
    expect(dictionaryMigration).toContain('create table dictionaries');
  });

  it('documents and pins the local Maven verification entrypoint', () => {
    const mavenConfig = read('backend-java/.mvn/maven.config');
    const settings = read('backend-java/.mvn/settings.xml');
    const readme = read('backend-java/README.md');

    expect(mavenConfig).toContain('--settings');
    expect(mavenConfig).toContain('.mvn/settings.xml');
    expect(settings).toContain('https://maven.aliyun.com/repository/public');
    expect(readme).toContain('JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home');
    expect(readme).toContain('mvn test');
  });

  it('provides an explicit PostgreSQL integration test entrypoint', () => {
    const pom = read('backend-java/pom.xml');
    const readme = read('backend-java/README.md');

    expect(pom).toContain('<artifactId>junit-jupiter</artifactId>');
    expect(pom).toContain('<id>integration</id>');
    expect(pom).toContain('<artifactId>maven-failsafe-plugin</artifactId>');
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/DatabaseMigrationIT.java'))).toBe(true);
    expect(readme).toContain('mvn verify -Pintegration');
  });

  it('documents the local Java backend and Vite integration workflow', () => {
    const docPath = 'docs/local-java-integration.md';
    expect(existsSync(join(root, docPath))).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('mvn spring-boot:run');
    expect(doc).toContain('npm run dev:java');
    expect(doc).toContain('POST /api/v1/auth/login');
    expect(doc).toContain('Authorization: Bearer');
    expect(doc).toContain('createJavaProcurementApiClient');
    expect(doc).toContain('npm run dev:mock');
    expect(doc).toContain('mvn verify -Pintegration');
    expect(doc).toContain('Docker daemon');
  });

  it('keeps the frontend integration strategy aligned with Java as the primary backend path', () => {
    const doc = read('docs/api-and-data-design.md');

    expect(doc).toContain('Java 后端联调是主线');
    expect(doc).toContain('npm run dev:java');
    expect(doc).toContain('npm run dev:mock');
    expect(doc).not.toContain('开发早期默认使用 mock adapter');
  });

  it('documents the buyer attachment metadata API handoff', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const migration = read('backend-java/src/main/resources/db/migration/V1__initial_schema.sql');
    const attachmentService = read('backend-java/src/main/java/com/procurement/attachment/application/AttachmentApplicationService.java');
    const attachmentStatus = read('backend-java/src/main/java/com/procurement/attachment/domain/AttachmentStatus.java');
    const attachmentVisibility = read('backend-java/src/main/java/com/procurement/attachment/domain/AttachmentVisibility.java');
    const attachmentTests = read('backend-java/src/test/java/com/procurement/AttachmentMetadataLifecycleTests.java');

    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/api/AttachmentController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/application/AttachmentApplicationService.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/domain/AttachmentStatus.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/domain/AttachmentVisibility.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/infrastructure/AttachmentMapper.java'))).toBe(true);
    expect(architecture).toContain('附件元数据 Java API');
    expect(architecture).toContain('GET /api/v1/buyer/attachments');
    expect(architecture).toContain('attachment.created');
    expect(readme).toContain('Buyer Attachment Metadata APIs');
    expect(readme).toContain('POST /api/v1/buyer/attachments');
    expect(readme).toContain('visibility');
    expect(readme).toContain('active');
    expect(migration).toContain('visibility text not null default');
    expect(migration).toContain('status text not null default');
    expect(attachmentService).toContain('AttachmentVisibility.normalize');
    expect(attachmentService).toContain('listActiveByTenantAndOwner');
    expect(attachmentService).toContain('AttachmentStatus.ACTIVE');
    expect(attachmentStatus).toContain('ACTIVE = "active"');
    expect(attachmentVisibility).toContain('TENANT = "tenant"');
    expect(attachmentVisibility).toContain('BUYER_INTERNAL = "buyer_internal"');
    expect(attachmentVisibility).toContain('SUPPLIER_SHARED = "supplier_shared"');
    expect(attachmentTests).toContain('createAttachmentRecordsVisibilityAndActiveStatusFromServerContext');
  });

  it('documents and exposes buyer organization department APIs', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const localSmoke = read('scripts/java-local-smoke.mjs');
    const apiClient = read('services/procurementApiClient.ts');
    const departmentService = read('backend-java/src/main/java/com/procurement/organization/application/DepartmentApplicationService.java');
    const departmentStatus = read('backend-java/src/main/java/com/procurement/organization/domain/DepartmentStatus.java');
    const departmentAuditAction = read('backend-java/src/main/java/com/procurement/organization/domain/DepartmentAuditAction.java');
    const auditTargetType = read('backend-java/src/main/java/com/procurement/audit/domain/AuditTargetType.java');

    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/organization/api/DepartmentController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/organization/application/DepartmentApplicationService.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/organization/domain/DepartmentStatus.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/organization/domain/DepartmentAuditAction.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/organization/infrastructure/DepartmentMapper.java'))).toBe(true);
    expect(architecture).toContain('采购方组织部门 Java API');
    expect(architecture).toContain('GET /api/v1/buyer/departments');
    expect(architecture).toContain('POST /api/v1/buyer/departments');
    expect(architecture).toContain('POST /api/v1/buyer/departments/{departmentId}/disable');
    expect(readme).toContain('GET /api/v1/buyer/departments');
    expect(readme).toContain('POST /api/v1/buyer/departments');
    expect(readme).toContain('POST /api/v1/buyer/departments/{departmentId}/disable');
    expect(localSmoke).toContain('/api/v1/buyer/departments');
    expect(apiClient).toContain('listBuyerDepartments');
    expect(apiClient).toContain('createBuyerDepartment');
    expect(apiClient).toContain('disableBuyerDepartment');
    expect(departmentService).toContain('requireActiveParentDepartment');
    expect(departmentService).toContain('existsActiveByTenantAndId');
    expect(departmentService).toContain('countByTenantAndDepartment');
    expect(departmentService).toContain('DepartmentStatus.ACTIVE');
    expect(departmentService).toContain('DepartmentStatus.INACTIVE');
    expect(departmentService).toContain('DepartmentAuditAction.CREATED');
    expect(departmentService).toContain('DepartmentAuditAction.DISABLED');
    expect(departmentService).toContain('AuditTargetType.DEPARTMENT');
    expect(departmentStatus).toContain('ACTIVE = "active"');
    expect(departmentStatus).toContain('INACTIVE = "inactive"');
    expect(departmentAuditAction).toContain('CREATED = "department.created"');
    expect(departmentAuditAction).toContain('DISABLED = "department.disabled"');
    expect(auditTargetType).toContain('DEPARTMENT = "department"');
  });

  it('documents the notification API handoff', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const notificationService = read('backend-java/src/main/java/com/procurement/notification/application/NotificationApplicationService.java');
    const recipientStatus = read('backend-java/src/main/java/com/procurement/notification/domain/NotificationRecipientStatus.java');

    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/api/BuyerNotificationController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/api/SupplierNotificationController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/application/NotificationApplicationService.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/domain/NotificationRecipientStatus.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/infrastructure/NotificationMapper.java'))).toBe(true);
    expect(architecture).toContain('站内通知 Java API');
    expect(architecture).toContain('GET /api/v1/buyer/notifications');
    expect(architecture).toContain('POST /api/v1/buyer/notifications/{notificationId}/read');
    expect(architecture).toContain('GET /api/v1/supplier/notifications');
    expect(architecture).toContain('POST /api/v1/supplier/notifications/{notificationId}/read');
    expect(architecture).toContain('按当前 `recipient_id` 汇总多采购方业务通知');
    expect(architecture).toContain('采购需求提交审批时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('RFQ 定标结果提交审批时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('供应商确认采购订单时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('供应商提交发货时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('采购方完成收货验收时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('供应商登记发票时会为订单所属采购方租户启用采购方用户生成站内通知');
    expect(architecture).toContain('采购方登记付款状态时会为发票供应商企业启用供应商用户生成站内通知');
    expect(readme).toContain('Notification APIs');
    expect(readme).toContain('GET /api/v1/supplier/notifications');
    expect(readme).toContain('Purchase demand submission now creates in-app notifications');
    expect(readme).toContain('RFQ award approval submission also creates in-app notifications');
    expect(readme).toContain('Supplier order confirmation creates in-app notifications');
    expect(readme).toContain('Supplier shipment creates in-app notifications');
    expect(readme).toContain('Buyer receipt creates in-app notifications');
    expect(readme).toContain('Supplier invoice creation creates in-app notifications');
    expect(readme).toContain('Buyer payment registration creates in-app notifications');
    expect(notificationService).toContain('NotificationRecipientStatus.ENABLED');
    expect(recipientStatus).toContain('ENABLED = "启用"');
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/PurchaseDemandNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/RfqAwardNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/PurchaseOrderNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/DeliveryNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/ReceiptNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/FinanceInvoiceNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/SupplierNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/FinancePaymentNotificationTests.java'))).toBe(true);
  });

  it('documents and exposes shared dictionary APIs', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const controller = read('backend-java/src/main/java/com/procurement/dictionary/api/DictionaryController.java');
    const service = read('backend-java/src/main/java/com/procurement/dictionary/application/DictionaryApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/dictionary/infrastructure/DictionaryMapper.java');
    const migration = read('backend-java/src/main/resources/db/migration/V5__dictionaries.sql');
    const securityTests = read('backend-java/src/test/java/com/procurement/HttpSecurityContractTests.java');

    expect(architecture).toContain('数据字典 Java API');
    expect(architecture).toContain('GET /api/v1/dictionaries?type=payment_status');
    expect(readme).toContain('Shared Dictionary API');
    expect(readme).toContain('GET /api/v1/dictionaries?type=payment_status');
    expect(controller).toContain('@RequestMapping("/api/v1/dictionaries")');
    expect(service).toContain('listByType');
    expect(mapper).toContain('listActiveByType');
    expect(migration).toContain('payment_status');
    expect(securityTests).toContain('authenticatedUsersCanReadSharedDictionaries');
  });

  it('guards buyer master data creation audit coverage', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const controller = read('backend-java/src/main/java/com/procurement/supplier/api/BuyerSupplierController.java');
    const materialService = read('backend-java/src/main/java/com/procurement/catalog/application/MaterialApplicationService.java');
    const materialAuditAction = read('backend-java/src/main/java/com/procurement/catalog/domain/MaterialAuditAction.java');
    const approvalBusinessType = read('backend-java/src/main/java/com/procurement/approval/domain/ApprovalBusinessType.java');
    const auditTargetType = read('backend-java/src/main/java/com/procurement/audit/domain/AuditTargetType.java');
    const service = read('backend-java/src/main/java/com/procurement/supplier/application/BuyerSupplierApplicationService.java');
    const buyerSupplierAuditAction = read('backend-java/src/main/java/com/procurement/supplier/domain/BuyerSupplierAuditAction.java');
    const buyerSupplierPerformanceScore = read('backend-java/src/main/java/com/procurement/supplier/domain/BuyerSupplierPerformanceScore.java');
    const supplierProfileService = read('backend-java/src/main/java/com/procurement/supplier/application/SupplierProfileApplicationService.java');
    const supplierProfileAuditAction = read('backend-java/src/main/java/com/procurement/supplier/domain/SupplierProfileAuditAction.java');
    const notificationTitle = read('backend-java/src/main/java/com/procurement/notification/domain/NotificationTitle.java');
    const auditTests = read('backend-java/src/test/java/com/procurement/BuyerMasterDataAuditLogTests.java');
    const admissionTests = read('backend-java/src/test/java/com/procurement/BuyerSupplierAdmissionApprovalStateTransitionTests.java');

    expect(architecture).toContain('buyer_user.created');
    expect(architecture).toContain('material.created');
    expect(architecture).toContain('material.updated');
    expect(architecture).toContain('buyer_supplier_relation.created');
    expect(architecture).toContain('buyer_supplier_relation.profile_updated');
    expect(architecture).toContain('buyer_supplier_relation.performance_updated');
    expect(architecture).toContain('buyer_supplier_relation.status_changed');
    expect(architecture).toContain('supplier_profile.updated');
    expect(readme).toContain('Creating buyer users, materials, and private supplier relations records audit log actions');
    expect(readme).toContain('POST /api/v1/buyer/materials/{materialId}');
    expect(readme).toContain('optional `category` and `keyword` filters');
    expect(materialService).toContain('MaterialAuditAction.CREATED');
    expect(materialService).toContain('MaterialAuditAction.UPDATED');
    expect(materialService).toContain('AuditTargetType.MATERIAL');
    expect(materialAuditAction).toContain('CREATED = "material.created"');
    expect(materialAuditAction).toContain('UPDATED = "material.updated"');
    expect(readme).toContain('POST /api/v1/buyer/suppliers/{relationId}/status');
    expect(readme).toContain('POST /api/v1/buyer/suppliers/{relationId}/profile');
    expect(readme).toContain('POST /api/v1/buyer/suppliers/{relationId}/performance');
    expect(readme).toContain('POST /api/v1/supplier/profile');
    expect(readme).toContain('POST /api/v1/supplier/qualifications/{qualificationId}/status');
    expect(readme).toContain('status`, `level`, `category`, and `keyword`');
    expect(controller).toContain('@PostMapping("/{relationId}/status")');
    expect(controller).toContain('@PostMapping("/{relationId}/profile")');
    expect(service).toContain('BuyerSupplierAuditAction.RELATION_CREATED');
    expect(service).toContain('BuyerSupplierAuditAction.RELATION_PROFILE_UPDATED');
    expect(service).toContain('BuyerSupplierAuditAction.RELATION_PERFORMANCE_UPDATED');
    expect(service).toContain('BuyerSupplierAuditAction.RELATION_STATUS_CHANGED');
    expect(service).toContain('BuyerSupplierAuditAction.ADMISSION_SUBMITTED');
    expect(service).toContain('BuyerSupplierAuditAction.ADMISSION_APPROVED');
    expect(service).toContain('BuyerSupplierAuditAction.ADMISSION_REJECTED');
    expect(service).toContain('ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION');
    expect(service).toContain('AuditTargetType.BUYER_SUPPLIER_RELATION');
    expect(service).toContain('NotificationTitle.SUPPLIER_ADMISSION_APPROVED');
    expect(service).toContain('NotificationTitle.SUPPLIER_ADMISSION_REJECTED');
    expect(service).toContain('BuyerSupplierPerformanceScore.requireValid');
    expect(approvalBusinessType).toContain('BUYER_SUPPLIER_ADMISSION = "buyer_supplier_admission"');
    expect(auditTargetType).toContain('MATERIAL = "material"');
    expect(auditTargetType).toContain('BUYER_SUPPLIER_RELATION = "buyer_supplier_relation"');
    expect(buyerSupplierAuditAction).toContain('RELATION_CREATED = "buyer_supplier_relation.created"');
    expect(buyerSupplierAuditAction).toContain('RELATION_PROFILE_UPDATED = "buyer_supplier_relation.profile_updated"');
    expect(buyerSupplierAuditAction).toContain('RELATION_PERFORMANCE_UPDATED = "buyer_supplier_relation.performance_updated"');
    expect(buyerSupplierAuditAction).toContain('RELATION_STATUS_CHANGED = "buyer_supplier_relation.status_changed"');
    expect(buyerSupplierAuditAction).toContain('ADMISSION_SUBMITTED = "buyer_supplier_admission.submitted"');
    expect(buyerSupplierAuditAction).toContain('ADMISSION_APPROVED = "buyer_supplier_admission.approved"');
    expect(buyerSupplierAuditAction).toContain('ADMISSION_REJECTED = "buyer_supplier_admission.rejected"');
    expect(buyerSupplierPerformanceScore).toContain('BigDecimal.valueOf(100)');
    expect(buyerSupplierPerformanceScore).toContain('Supplier performance score must be between 0 and 100');
    expect(supplierProfileService).toContain('SupplierProfileAuditAction.UPDATED');
    expect(supplierProfileService).toContain('AuditTargetType.SUPPLIER_PROFILE');
    expect(supplierProfileAuditAction).toContain('UPDATED = "supplier_profile.updated"');
    expect(auditTargetType).toContain('SUPPLIER_PROFILE = "supplier_profile"');
    expect(service).toContain('changeRelationProfile');
    expect(service).toContain('BuyerSupplierManualStatusTransition');
    expect(service).toContain('buyerSupplierManualStatusTransition.requireTransition');
    const manualTransition = read('backend-java/src/main/java/com/procurement/supplier/domain/BuyerSupplierManualStatusTransition.java');
    expect(manualTransition).toContain('BuyerSupplierRelationStatus.BLACKLISTED');
    expect(manualTransition).toContain('requireSupportedTarget');
    expect(notificationTitle).toContain('SUPPLIER_ADMISSION_APPROVED = "供应商准入审批已通过"');
    expect(auditTests).toContain('buyerUserCreationRecordsAuditLog');
    expect(auditTests).toContain('materialCreationRecordsAuditLog');
    expect(auditTests).toContain('buyerSupplierRelationCreationRecordsAuditLog');
    expect(admissionTests).toContain('changeSupplierRelationStatusCanBlacklistAdmittedSupplier');
  });

  it('keeps the Java architecture handoff aligned with implemented MVP flow stages', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const checklist = read('docs/java-backend-stage-checklist.md');

    expect(architecture).toContain('比价定标基于 `quotes` 表中 `已提交` 报价生成 `award_decisions`');
    expect(architecture).toContain('订单模块基于已通过的 `award_decisions` 生成 `purchase_orders`');
    expect(architecture).toContain('履约模块从供应商确认订单开始，已串起发货、采购方收货验收、发票登记和付款状态');
    expect(architecture).toContain('收货模块基于 `purchase_orders` 和 `deliveries` 创建 `receipts`');
    expect(architecture).toContain('财务协同模块在订单已收货后接入发票登记和付款状态');
    expect(architecture).toContain('docs/java-backend-stage-checklist.md');
    expect(checklist).toContain('后续迭代入口');
    expect(architecture).not.toContain('供应商报价、报价比价、定标和订单生成在后续阶段继续补齐');
    expect(architecture).not.toContain('后续履约模块从供应商确认订单开始');
    expect(architecture).not.toContain('后续财务协同模块会在订单已收货后接入发票登记');
  });

  it('guards platform operation audit coverage', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');
    const tenantController = read('backend-java/src/main/java/com/procurement/platform/api/PlatformTenantController.java');
    const tenantService = read('backend-java/src/main/java/com/procurement/platform/application/PlatformTenantApplicationService.java');
    const tenantStatus = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformTenantStatus.java');
    const tenantAuditAction = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformTenantAuditAction.java');
    const buyerRoleDefaults = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformBuyerRoleDefaults.java');
    const defaultApprovalTemplate = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformDefaultApprovalTemplate.java');
    const auditTargetType = read('backend-java/src/main/java/com/procurement/audit/domain/AuditTargetType.java');
    const enterpriseService = read('backend-java/src/main/java/com/procurement/platform/application/PlatformEnterpriseApplicationService.java');
    const enterpriseAuditAction = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformEnterpriseAuditAction.java');
    const announcementService = read('backend-java/src/main/java/com/procurement/platform/application/PlatformAnnouncementApplicationService.java');
    const announcementAuditAction = read('backend-java/src/main/java/com/procurement/platform/domain/PlatformAnnouncementAuditAction.java');
    const auditTests = read('backend-java/src/test/java/com/procurement/PlatformAuditLogTests.java');
    const localSeed = read('backend-java/src/main/resources/db/dev/V100__local_demo_seed.sql');

    expect(architecture).toContain('tenant.features.updated');
    expect(architecture).toContain('tenant.plan_updated');
    expect(architecture).toContain('tenant.enabled');
    expect(architecture).toContain('tenant.disabled');
    expect(architecture).toContain('enterprise.reviewed');
    expect(architecture).toContain('platform_announcement.published');
    expect(readme).toContain('GET /api/v1/platform/tenants/{tenantId}');
    expect(readme).toContain('POST /api/v1/platform/tenants/{tenantId}/plan');
    expect(readme).toContain('POST /api/v1/platform/tenants/{tenantId}/enable');
    expect(readme).toContain('POST /api/v1/platform/tenants/{tenantId}/disable');
    expect(readme).toContain('tenant.plan_updated');
    expect(readme).toContain('tenant.enabled');
    expect(readme).toContain('tenant.disabled');
    expect(readme).toContain('platform_announcement.published');
    expect(tenantController).toContain('@GetMapping("/{tenantId}")');
    expect(tenantService).toContain('getTenant');
    expect(tenantService).toContain('PlatformTenantStatus.ACTIVE');
    expect(tenantService).toContain('PlatformTenantStatus.INACTIVE');
    expect(tenantService).toContain('PlatformTenantAuditAction.CREATED');
    expect(tenantService).toContain('PlatformTenantAuditAction.FEATURES_UPDATED');
    expect(tenantService).toContain('PlatformTenantAuditAction.PLAN_UPDATED');
    expect(tenantService).toContain('PlatformTenantAuditAction.ENABLED');
    expect(tenantService).toContain('PlatformTenantAuditAction.DISABLED');
    expect(tenantService).toContain('PlatformBuyerRoleDefaults.OWNER_ROLE_NAME');
    expect(tenantService).toContain('PlatformBuyerRoleDefaults.OWNER_PERMISSIONS_JSON');
    expect(tenantService).toContain('PlatformDefaultApprovalTemplate.BUYER_TEMPLATES');
    expect(tenantService).toContain('AuditTargetType.TENANT');
    expect(tenantStatus).toContain('ACTIVE = "active"');
    expect(tenantStatus).toContain('INACTIVE = "inactive"');
    expect(tenantAuditAction).toContain('CREATED = "tenant.created"');
    expect(tenantAuditAction).toContain('FEATURES_UPDATED = "tenant.features.updated"');
    expect(tenantAuditAction).toContain('PLAN_UPDATED = "tenant.plan_updated"');
    expect(tenantAuditAction).toContain('ENABLED = "tenant.enabled"');
    expect(tenantAuditAction).toContain('DISABLED = "tenant.disabled"');
    expect(buyerRoleDefaults).toContain('OWNER_ROLE_NAME = "采购管理员"');
    expect(buyerRoleDefaults).toContain('OWNER_PERMISSIONS_JSON = "[\\"buyer:*\\"]"');
    expect(defaultApprovalTemplate).toContain('BUYER_TEMPLATES');
    expect(defaultApprovalTemplate).toContain('ApprovalTemplateCode.PURCHASE_DEMAND');
    expect(defaultApprovalTemplate).toContain('ApprovalTemplateCode.SUPPLIER_ADMISSION');
    expect(defaultApprovalTemplate).toContain('ApprovalTemplateCode.RFQ_AWARD');
    expect(defaultApprovalTemplate).toContain('ApprovalBusinessType.PURCHASE_DEMAND');
    expect(defaultApprovalTemplate).toContain('ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION');
    expect(defaultApprovalTemplate).toContain('ApprovalBusinessType.RFQ_AWARD');
    expect(enterpriseService).toContain('PlatformEnterpriseAuditAction.REVIEWED');
    expect(enterpriseService).toContain('AuditTargetType.ENTERPRISE');
    expect(enterpriseAuditAction).toContain('REVIEWED = "enterprise.reviewed"');
    expect(announcementService).toContain('PlatformAnnouncementAuditAction.PUBLISHED');
    expect(announcementService).toContain('AuditTargetType.PLATFORM_ANNOUNCEMENT');
    expect(announcementAuditAction).toContain('PUBLISHED = "platform_announcement.published"');
    expect(auditTargetType).toContain('TENANT = "tenant"');
    expect(auditTargetType).toContain('ENTERPRISE = "enterprise"');
    expect(auditTargetType).toContain('PLATFORM_ANNOUNCEMENT = "platform_announcement"');
    expect(auditTests).toContain('tenantFeatureToggleUpdateRecordsAuditLogInTargetTenant');
    expect(auditTests).toContain('tenantPlanUpdateRecordsAuditLogInTargetTenant');
    expect(auditTests).toContain('tenantEnableRecordsAuditLogInTargetTenant');
    expect(auditTests).toContain('tenantDisableRecordsAuditLogInTargetTenant');
    expect(auditTests).toContain('enterpriseReviewRecordsPlatformAuditLog');
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/PlatformAnnouncementLifecycleTests.java'))).toBe(true);
    expect(localSeed).toContain('user-platform-admin');
  });

  it('provides a reproducible local PostgreSQL runtime for Java frontend integration', () => {
    const compose = read('backend-java/docker-compose.yml');
    const localProfile = read('backend-java/src/main/resources/application-local.yml');
    const localSeed = read('backend-java/src/main/resources/db/dev/V100__local_demo_seed.sql');
    const readme = read('backend-java/README.md');
    const integrationDoc = read('docs/local-java-integration.md');

    expect(compose).toContain('postgres:16');
    expect(compose).toContain('procurement_saas');
    expect(compose).toContain('5432:5432');
    expect(compose).toContain('procurement-postgres-data');

    expect(localProfile).toContain('jdbc:postgresql://localhost:5432/procurement_saas');
    expect(localProfile).toContain('classpath:db/migration,classpath:db/dev');

    expect(localSeed).toContain('tenant-acme');
    expect(localSeed).toContain('supplier-tech');
    expect(localSeed).toContain('mat-laptop');
    expect(localSeed).toContain('user-buyer-owner');
    expect(localSeed).toContain('user-platform-admin');

    expect(readme).toContain('docker compose up -d');
    expect(readme).toContain('mvn spring-boot:run -Dspring-boot.run.profiles=local');
    expect(integrationDoc).toContain('docker compose up -d');
    expect(integrationDoc).toContain('mvn spring-boot:run -Dspring-boot.run.profiles=local');
  });
});
