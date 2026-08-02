package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class TenantIsolationArchitectureTests {

  private static final Path SOURCE_ROOT = Path.of("src/main/java/com/procurement");
  private static final Path TEST_ROOT = Path.of("src/test/java/com/procurement");
  private static final Set<String> SHARED_SCOPE_MAPPERS = Set.of(
      "dictionary/infrastructure/DictionaryMapper.java",
      "platform/infrastructure/PlatformAnnouncementMapper.java",
      "platform/infrastructure/PlatformTenantMapper.java",
      "platform/infrastructure/PlatformEnterpriseMapper.java",
      // 平台经营看板:跨租户只读聚合(仅数值,不下发租户明细)。
      "platform/infrastructure/PlatformMetricsMapper.java",
      "supplier/infrastructure/SupplierProfileMapper.java",
      // 招标:公开招标发售清单为平台级公开数据;领取记录按 supplier 维度跨租户读取。
      "tender/infrastructure/TenderAcquisitionMapper.java",
      "tenant/infrastructure/TenantFeatureMapper.java",
      "tenant/infrastructure/TenantEntitlementMapper.java",
      // 身份/安全的跨切面映射:权限按用户解析(用户本身归属租户),非租户业务表。
      "identity/infrastructure/PermissionMapper.java",
      // 行级权限解析:按 user_id 读取角色 data_scope 与用户部门(用户本身归属租户)。
      "identity/infrastructure/DataScopeMapper.java",
      // 订阅套餐/配额为平台级参考数据(非租户业务表),按 plan_code 检索。
      "platform/infrastructure/SubscriptionPlanMapper.java",
      // 账单快照行按 statement_id 检索(账单头已按 tenant_id 限定)。
      "platform/infrastructure/BillingStatementLineMapper.java",
      // 公开商机跨租户只读(门户商机大厅),仅公开安全字段。
      "sourcing/infrastructure/PublicOpportunityMapper.java",
      // 门户公开采购公告:跨租户只读,仅公开安全字段。
      "sourcing/infrastructure/PublicProcurementAnnouncementMapper.java",
      // 公开商城跨租户只读(门户采购商城),不暴露价格/租户/供应商。
      "mall/infrastructure/PublicMallMapper.java");

  @Test
  void applicationServicesUseCentralTenantAccessGuardInsteadOfLocalThreadLocalReads() throws IOException {
    List<Path> serviceFiles;
    try (var stream = Files.walk(SOURCE_ROOT)) {
      serviceFiles = stream
          .filter(path -> path.toString().endsWith("ApplicationService.java"))
          .toList();
    }

    assertThat(serviceFiles).isNotEmpty();
    for (Path serviceFile : serviceFiles) {
      String source = Files.readString(serviceFile);
      assertThat(source)
          .as(serviceFile + " should not read TenantContext directly")
          .doesNotContain("TenantContext.tenantId()")
          .doesNotContain("TenantContext.supplierId()")
          .doesNotContain("TenantContext.userId()");
      if (source.contains("requireTenantId()")
          || source.contains("requireSupplierId()")
          || source.contains("requireUserId()")) {
        assertThat(source)
            .as(serviceFile + " should delegate context requirements to TenantAccessGuard")
            .contains("TenantAccessGuard");
      }
    }
  }

  @Test
  void tenantAccessGuardCentralizesBuyerSupplierAndUserContextMessages() throws IOException {
    Path guardPath = SOURCE_ROOT.resolve("common/tenant/TenantAccessGuard.java");

    assertThat(guardPath).exists();
    String guardSource = Files.readString(guardPath);

    assertThat(guardSource)
        .contains("requireTenantId")
        .contains("requireSupplierId")
        .contains("requireUserId")
        .contains("Tenant context is required")
        .contains("Supplier context is required")
        .contains("User context is required");
  }

  @Test
  void auditLogWriterUsesTenantAccessGuardAndWritesAuditLogsTable() throws IOException {
    Path servicePath = SOURCE_ROOT.resolve("audit/application/AuditLogApplicationService.java");
    Path mapperPath = SOURCE_ROOT.resolve("audit/infrastructure/AuditLogMapper.java");

    assertThat(servicePath).exists();
    assertThat(mapperPath).exists();
    assertThat(Files.readString(servicePath))
        .contains("TenantAccessGuard.requireTenantId")
        .contains("TenantAccessGuard.requireUserId");
    assertThat(Files.readString(mapperPath))
        .contains("insert into audit_logs")
        .contains("tenant_id")
        .contains("actor_id")
        .contains("target_id");
  }

  @Test
  void supplierWorkspaceOnlyListsApprovedBuyerRelationships() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("supplier/infrastructure/SupplierProfileMapper.java");
    String mapperSource = Files.readString(mapperPath);

    assertThat(mapperSource)
        .contains("listConnectedBuyerNames")
        .contains("where r.supplier_id = #{supplierId}")
        .contains("and r.status = '已准入'");
  }

  @Test
  void supplierRfqWorkspaceOnlyListsActiveInvites() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("sourcing/infrastructure/RfqMapper.java");
    String mapperSource = Files.readString(mapperPath);

    // 生命周期语义:供应商可见「已邀请/已拒绝(本方)」的项目,但草稿(未发布)必须不可见。
    assertThat(mapperSource)
        .contains("listBySupplierInvite")
        .contains("i.supplier_id = #{supplierId}")
        .contains("i.invite_status in ('已邀请', '已拒绝')")
        .contains("r.status <> '草稿'");
  }

  @Test
  void purchaseOrderStatusUpdatesRequireExpectedCurrentStatus() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("order/infrastructure/PurchaseOrderMapper.java");
    String mapperSource = Files.readString(mapperPath);

    assertThat(mapperSource)
        .contains("@Param(\"currentStatus\") String currentStatus")
        .contains("and status = #{currentStatus}");
  }

  @Test
  void invoicePaymentStatusUpdatesRequireExpectedCurrentStatus() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("finance/infrastructure/InvoiceMapper.java");
    String mapperSource = Files.readString(mapperPath);

    assertThat(mapperSource)
        .contains("@Param(\"currentPaymentStatus\") String currentPaymentStatus")
        .contains("and payment_status = #{currentPaymentStatus}");
  }

  @Test
  void rfqAwardStatusUpdatesRequireExpectedCurrentStatus() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("sourcing/infrastructure/RfqMapper.java");
    String mapperSource = Files.readString(mapperPath);

    assertThat(mapperSource)
        .contains("@Param(\"currentStatus\") String currentStatus")
        .contains("and status = #{currentStatus}");
  }

  @Test
  void rfqDemandMapperCanDetectAlreadyLinkedDemandInTenantScope() throws IOException {
    Path mapperPath = SOURCE_ROOT.resolve("sourcing/infrastructure/RfqDemandMapper.java");
    String mapperSource = Files.readString(mapperPath);

    assertThat(mapperSource)
        .contains("countByTenantAndDemand")
        .contains("where rd.tenant_id = #{tenantId} and rd.demand_id = #{demandId}")
        // 流标/废标项目不占用需求,允许重新立项。
        .contains("r.status not in ('已流标', '已废标')");
  }

  @Test
  void allApiControllersAreIncludedInHttpSecurityContractTests() throws IOException {
    List<String> apiControllers;
    try (var stream = Files.walk(SOURCE_ROOT)) {
      apiControllers = stream
          .filter(path -> path.toString().endsWith("Controller.java"))
          .filter(path -> {
            try {
              return Files.readString(path).contains("@RequestMapping(\"/api/");
            } catch (IOException exception) {
              throw new IllegalStateException(exception);
            }
          })
          .map(path -> path.getFileName().toString().replace(".java", ".class"))
          .sorted()
          .toList();
    }

    String securityContractSource = Files.readString(TEST_ROOT.resolve("HttpSecurityContractTests.java"));
    Matcher matcher = Pattern.compile("@WebMvcTest\\(controllers = \\{(?<controllers>.*?)\\}\\)", Pattern.DOTALL)
        .matcher(securityContractSource);

    assertThat(matcher.find()).isTrue();
    String testedControllers = matcher.group("controllers");
    assertThat(apiControllers).isNotEmpty();
    for (String controller : apiControllers) {
      assertThat(testedControllers)
          .as(controller + " should be covered by HttpSecurityContractTests")
          .contains(controller);
    }
  }

  @Test
  void tenantBusinessMappersKeepWhereClausesScopedByTenantOrSupplier() throws IOException {
    List<Path> mapperFiles;
    try (var stream = Files.walk(SOURCE_ROOT)) {
      mapperFiles = stream
          .filter(path -> path.toString().endsWith("Mapper.java"))
          .filter(path -> !isSharedScopeMapper(path))
          .toList();
    }

    assertThat(mapperFiles).isNotEmpty();
    for (Path mapperFile : mapperFiles) {
      String source = Files.readString(mapperFile);
      Matcher sqlMatcher = Pattern.compile("@(?:Select|Update|Delete)\\(\"\"\"(?<sql>.*?)\"\"\"\\)", Pattern.DOTALL)
          .matcher(source);
      while (sqlMatcher.find()) {
        String sql = sqlMatcher.group("sql").toLowerCase();
        if (sql.contains(" where ")) {
          assertThat(sql)
              .as(mapperFile + " SQL with where clauses must stay tenant or supplier scoped: " + sql.strip())
              .matches("(?s).*(tenant_id\\s*=|supplier_id\\s*=).*");
        }
      }
    }
  }

  private boolean isSharedScopeMapper(Path mapperFile) {
    String relativePath = SOURCE_ROOT.relativize(mapperFile).toString();
    return SHARED_SCOPE_MAPPERS.contains(relativePath);
  }
}
