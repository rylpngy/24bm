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
  void buyerUserApplicationServiceDelegatesStatusTransitions() throws IOException {
    Path status = SOURCE_ROOT.resolve("identity/domain/BuyerUserStatus.java");
    Path transition = SOURCE_ROOT.resolve("identity/domain/BuyerUserStatusTransition.java");
    Path userService = SOURCE_ROOT.resolve("identity/application/BuyerUserApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("BuyerUserStatus.ACTIVE")
        .contains("BuyerUserStatus.INACTIVE")
        .contains("Unsupported buyer user status");
    assertThat(Files.readString(userService))
        .contains("BuyerUserStatusTransition")
        .contains("buyerUserStatusTransition.requireSupportedTarget")
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
    Path userService = SOURCE_ROOT.resolve("supplier/application/SupplierUserApplicationService.java");

    assertThat(status).exists();
    assertThat(transition).exists();

    assertThat(Files.readString(status))
        .contains("ACTIVE = \"active\"")
        .contains("INACTIVE = \"inactive\"");
    assertThat(Files.readString(transition))
        .contains("void requireSupportedTarget")
        .contains("SupplierUserStatus.ACTIVE")
        .contains("SupplierUserStatus.INACTIVE")
        .contains("Unsupported supplier user status");
    assertThat(Files.readString(userService))
        .contains("SupplierUserStatusTransition")
        .contains("supplierUserStatusTransition.requireSupportedTarget")
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
            "PurchaseDemandApprovalStatusTransition",
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
            "BuyerSupplierAdmissionStatusTransition",
            "BuyerSupplierManualStatusTransition",
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

  @Test
  void buyerSupplierApplicationServiceDelegatesAdmissionStatusTransitions() throws IOException {
    Path transition = SOURCE_ROOT.resolve("supplier/domain/BuyerSupplierAdmissionStatusTransition.java");
    Path supplierService = SOURCE_ROOT.resolve("supplier/application/BuyerSupplierApplicationService.java");

    assertThat(transition).exists();

    String transitionSource = Files.readString(transition);
    assertThat(transitionSource)
        .contains("void requireAdmissionSubmission")
        .contains("void requireAdmissionReview")
        .contains("String reviewTargetStatus")
        .contains("BuyerSupplierRelationStatus.PENDING_ADMISSION")
        .contains("BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL")
        .contains("BuyerSupplierRelationStatus.ADMITTED")
        .contains("BuyerSupplierRelationStatus.REJECTED");

    assertThat(Files.readString(supplierService))
        .contains("BuyerSupplierAdmissionStatusTransition")
        .contains("buyerSupplierAdmissionStatusTransition.requireAdmissionSubmission")
        .contains("buyerSupplierAdmissionStatusTransition.requireAdmissionReview")
        .contains("buyerSupplierAdmissionStatusTransition.reviewTargetStatus")
        .doesNotContain("Only pending supplier relations can be submitted for admission")
        .doesNotContain("Only supplier relations in admission approval can be reviewed");
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
