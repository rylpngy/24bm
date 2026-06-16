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
        List.of(
            "RfqStatus.QUOTING",
            "RfqSourcingStatusTransition",
            "BuyerSupplierRelationStatus.ADMITTED",
            "RfqInviteStatus.INVITED"),
        List.of(
            "private static final String QUOTING_STATUS",
            "private static final String APPROVED_DEMAND_STATUS",
            "private static final String APPROVED_SUPPLIER_STATUS",
            "private static final String INVITED_STATUS"));
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
        List.of("RfqSourcingStatusTransition", "QuoteStatus.SUBMITTED"),
        List.of(
            "private static final String QUOTING_STATUS",
            "private static final String SUBMITTED_STATUS"));
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
            "InvoicePaymentStatus.PAID",
            "InvoicePaymentStatusTransition",
            "BuyerSupplierRelationStatus.BLACKLISTED"),
        List.of(
            "private static final String PENDING_PAYMENT_STATUS",
            "private static final String PAID_STATUS",
            "private static final String PARTIAL_PAID_STATUS",
            "private static final String BLACKLISTED_SUPPLIER_STATUS"));
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
    Path transition = SOURCE_ROOT.resolve("sourcing/domain/RfqAwardStatusTransition.java");
    Path awardService = SOURCE_ROOT.resolve("sourcing/application/AwardApplicationService.java");

    assertThat(transition).exists();

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
        .contains("rfqAwardStatusTransition.requireAwardSubmission")
        .contains("rfqAwardStatusTransition.requireAwardReview")
        .contains("rfqAwardStatusTransition.reviewTargetStatus")
        .doesNotContain("Only quoting RFQs can be awarded")
        .doesNotContain("Only RFQs in award approval can be reviewed");
  }

  @Test
  void rfqAndQuoteApplicationServicesDelegateSourcingStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("sourcing/domain/RfqSourcingStatusTransition.java");
    Path rfqService = SOURCE_ROOT.resolve("sourcing/application/RfqApplicationService.java");
    Path quoteService = SOURCE_ROOT.resolve("sourcing/application/QuoteApplicationService.java");

    assertThat(transition).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireApprovedDemandForRfq")
        .contains("void requireQuotingForQuoteSubmission")
        .contains("PurchaseDemandStatus.APPROVED")
        .contains("RfqStatus.QUOTING");

    assertThat(Files.readString(rfqService))
        .contains("RfqSourcingStatusTransition")
        .contains("rfqSourcingStatusTransition.requireApprovedDemandForRfq")
        .doesNotContain("RFQ can only use approved purchase demands")
        .doesNotContain("PurchaseDemandStatus.APPROVED");
    assertThat(Files.readString(quoteService))
        .contains("RfqSourcingStatusTransition")
        .contains("rfqSourcingStatusTransition.requireQuotingForQuoteSubmission")
        .doesNotContain("RFQ is not open for quotes")
        .doesNotContain("RfqStatus.QUOTING");
  }

  @Test
  void orderFulfillmentServicesDelegatePurchaseOrderStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("order/domain/PurchaseOrderStatusTransition.java");
    Path purchaseOrderService = SOURCE_ROOT.resolve("order/application/PurchaseOrderApplicationService.java");
    Path deliveryService = SOURCE_ROOT.resolve("order/application/DeliveryApplicationService.java");
    Path receiptService = SOURCE_ROOT.resolve("order/application/ReceiptApplicationService.java");

    assertThat(transition).exists();

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
        .contains("purchaseOrderStatusTransition.requireSupplierConfirmation")
        .doesNotContain("Only pending supplier confirmation orders can be confirmed");
    assertThat(Files.readString(deliveryService))
        .contains("PurchaseOrderStatusTransition")
        .contains("purchaseOrderStatusTransition.requireShipment")
        .doesNotContain("Only ready-to-ship orders can be shipped");
    assertThat(Files.readString(receiptService))
        .contains("PurchaseOrderStatusTransition")
        .contains("purchaseOrderStatusTransition.requireReceipt")
        .doesNotContain("Only shipped purchase orders can be received");
  }

  @Test
  void demandAndSupplierApplicationServicesUseDomainStatusConstants() throws IOException {
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("demand/application/PurchaseDemandApplicationService.java"),
        List.of(
            "PurchaseDemandStatus.DRAFT",
            "PurchaseDemandStatus.IN_APPROVAL",
            "PurchaseDemandStatus.APPROVED",
            "PurchaseDemandStatus.REJECTED",
            "ApprovalStatus.APPROVED",
            "ApprovalStatus.REJECTED"),
        List.of(
            "private static final String DRAFT_STATUS",
            "private static final String IN_APPROVAL_STATUS",
            "private static final String APPROVED_STATUS",
            "private static final String REJECTED_STATUS"));
    assertSourceUsesStatusConstants(
        SOURCE_ROOT.resolve("supplier/application/BuyerSupplierApplicationService.java"),
        List.of(
            "BuyerSupplierRelationStatus.PENDING_ADMISSION",
            "BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL",
            "BuyerSupplierRelationStatus.ADMITTED",
            "BuyerSupplierRelationStatus.REJECTED",
            "BuyerSupplierRelationStatus.BLACKLISTED",
            "ApprovalStatus.APPROVED",
            "ApprovalStatus.REJECTED"),
        List.of(
            "private static final String PENDING_ADMISSION_STATUS",
            "private static final String IN_ADMISSION_APPROVAL_STATUS",
            "private static final String ADMITTED_STATUS",
            "private static final String REJECTED_STATUS",
            "private static final String BLACKLISTED_STATUS",
            "private static final String APPROVED_STATUS"));
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
