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
  void rfqOrderAndInvoiceApplicationServicesUseDomainStatusConstants() throws IOException {
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/RfqApplicationService.java"),
        List.of("RfqStatus.QUOTING"),
        List.of("private static final String QUOTING_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/AwardApplicationService.java"),
        List.of("RfqStatus.QUOTING", "RfqStatus.AWARD_APPROVAL", "RfqStatus.AWARDED"),
        List.of(
            "private static final String QUOTING_RFQ_STATUS",
            "private static final String AWARD_APPROVAL_RFQ_STATUS",
            "private static final String AWARDED_RFQ_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("sourcing/application/QuoteApplicationService.java"),
        List.of("RfqStatus.QUOTING"),
        List.of("private static final String QUOTING_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/PurchaseOrderApplicationService.java"),
        List.of(
            "PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION",
            "PurchaseOrderStatus.PENDING_SHIPMENT"),
        List.of(
            "private static final String PENDING_SUPPLIER_CONFIRM_STATUS",
            "private static final String READY_TO_SHIP_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/DeliveryApplicationService.java"),
        List.of("PurchaseOrderStatus.PENDING_SHIPMENT", "PurchaseOrderStatus.SHIPPED"),
        List.of(
            "private static final String READY_TO_SHIP_STATUS",
            "private static final String SHIPPED_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("order/application/ReceiptApplicationService.java"),
        List.of("PurchaseOrderStatus.SHIPPED", "PurchaseOrderStatus.RECEIVED"),
        List.of(
            "private static final String SHIPPED_STATUS",
            "private static final String RECEIVED_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("finance/application/InvoiceApplicationService.java"),
        List.of("PurchaseOrderStatus.RECEIVED", "InvoicePaymentStatus.PENDING_PAYMENT"),
        List.of(
            "private static final String RECEIVED_STATUS",
            "private static final String PENDING_PAYMENT_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("finance/application/PaymentApplicationService.java"),
        List.of(
            "InvoicePaymentStatus.PENDING_PAYMENT",
            "InvoicePaymentStatus.PAID",
            "InvoicePaymentStatus.PARTIAL_PAID"),
        List.of(
            "private static final String PENDING_PAYMENT_STATUS",
            "private static final String PAID_STATUS",
            "private static final String PARTIAL_PAID_STATUS"));
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
