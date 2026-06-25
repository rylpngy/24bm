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
      "supplier/infrastructure/SupplierProfileMapper.java",
      "tenant/infrastructure/TenantFeatureMapper.java",
      "tenant/infrastructure/TenantEntitlementMapper.java",
      // 身份/安全的跨切面映射:权限按用户解析(用户本身归属租户),非租户业务表。
      "identity/infrastructure/PermissionMapper.java",
      // 订阅套餐/配额为平台级参考数据(非租户业务表),按 plan_code 检索。
      "platform/infrastructure/SubscriptionPlanMapper.java");

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

    assertThat(mapperSource)
        .contains("listBySupplierInvite")
        .contains("i.supplier_id = #{supplierId}")
        .contains("i.invite_status = '已邀请'");
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
        .contains("where tenant_id = #{tenantId} and demand_id = #{demandId}");
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
