package com.procurement;

import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.procurement.common.api.HealthController;
import com.procurement.audit.api.AuditLogController;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.api.CreateMaterialRequest;
import com.procurement.catalog.api.MaterialController;
import com.procurement.catalog.api.MaterialResponse;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.buyer.api.BuyerWorkspaceController;
import com.procurement.buyer.api.BuyerWorkspaceResponse;
import com.procurement.buyer.application.BuyerWorkspaceApplicationService;
import com.procurement.approval.api.ApprovalInboxController;
import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.attachment.api.AttachmentController;
import com.procurement.attachment.api.AttachmentResponse;
import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.demand.api.PurchaseDemandController;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.identity.SecurityConfig;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.AuthController;
import com.procurement.identity.api.BuyerRoleController;
import com.procurement.identity.api.BuyerRoleResponse;
import com.procurement.identity.api.ChangeBuyerUserRoleRequest;
import com.procurement.identity.api.BuyerUserController;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import com.procurement.identity.application.BuyerRoleApplicationService;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.security.JwtAuthenticationFilter;
import com.procurement.identity.security.JwtTokenService;
import com.procurement.finance.api.SupplierReceivableController;
import com.procurement.finance.api.BuyerPaymentController;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.SupplierInvoiceController;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.notification.api.BuyerNotificationController;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.api.DepartmentController;
import com.procurement.organization.api.DepartmentResponse;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.order.api.BuyerReceiptController;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.api.ReceiptResponse;
import com.procurement.order.api.SupplierOrderController;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.api.SupplierDeliveryController;
import com.procurement.order.api.PurchaseOrderController;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.application.ReceiptApplicationService;
import com.procurement.platform.api.EnterpriseReviewRequest;
import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.PlatformEnterpriseController;
import com.procurement.platform.api.PlatformOverviewController;
import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.api.PlatformTenantController;
import com.procurement.platform.api.PlatformWorkspaceController;
import com.procurement.platform.api.PlatformWorkspaceResponse;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import com.procurement.platform.application.PlatformOverviewApplicationService;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.application.PlatformWorkspaceApplicationService;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.RfqAwardController;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.RfqController;
import com.procurement.sourcing.api.SupplierQuoteListController;
import com.procurement.sourcing.api.SupplierQuoteController;
import com.procurement.sourcing.application.AwardApplicationService;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.supplier.api.BuyerSupplierController;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.api.SupplierProfileController;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.api.SupplierWorkspaceController;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.supplier.application.SupplierWorkspaceApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = {
    HealthController.class,
    AuthController.class,
    ApprovalInboxController.class,
    PurchaseDemandController.class,
    SupplierQuoteController.class,
    RfqController.class,
    PlatformOverviewController.class,
    PlatformTenantController.class,
    PlatformEnterpriseController.class,
    PlatformWorkspaceController.class,
    BuyerSupplierController.class,
    MaterialController.class,
    BuyerRoleController.class,
    BuyerUserController.class,
    SupplierProfileController.class,
    SupplierQuoteListController.class,
    RfqAwardController.class,
    PurchaseOrderController.class,
    SupplierOrderController.class,
    BuyerReceiptController.class,
    SupplierDeliveryController.class,
    BuyerPaymentController.class,
    SupplierInvoiceController.class,
    SupplierReceivableController.class,
    AuditLogController.class,
    BuyerWorkspaceController.class,
    SupplierWorkspaceController.class,
    AttachmentController.class,
    BuyerNotificationController.class,
    DepartmentController.class
})
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JwtTokenService.class,
    AuthenticationApplicationService.class
})
@TestPropertySource(properties = {
    "procurement.security.jwt-secret=local-test-secret-must-be-at-least-32-bytes",
    "procurement.security.jwt-expires-in-seconds=7200"
})
class HttpSecurityContractTests {

  @Autowired
  private MockMvc mockMvc;

  @MockBean
  private PurchaseDemandApplicationService purchaseDemandApplicationService;

  @MockBean
  private ApprovalInboxApplicationService approvalInboxApplicationService;

  @MockBean
  private QuoteApplicationService quoteApplicationService;

  @MockBean
  private RfqApplicationService rfqApplicationService;

  @MockBean
  private AwardApplicationService awardApplicationService;

  @MockBean
  private PurchaseOrderApplicationService purchaseOrderApplicationService;

  @MockBean
  private ReceiptApplicationService receiptApplicationService;

  @MockBean
  private DeliveryApplicationService deliveryApplicationService;

  @MockBean
  private InvoiceApplicationService invoiceApplicationService;

  @MockBean
  private PaymentApplicationService paymentApplicationService;

  @MockBean
  private PlatformTenantApplicationService platformTenantApplicationService;

  @MockBean
  private PlatformEnterpriseApplicationService platformEnterpriseApplicationService;

  @MockBean
  private PlatformOverviewApplicationService platformOverviewApplicationService;

  @MockBean
  private PlatformWorkspaceApplicationService platformWorkspaceApplicationService;

  @MockBean
  private BuyerSupplierApplicationService buyerSupplierApplicationService;

  @MockBean
  private SupplierProfileApplicationService supplierProfileApplicationService;

  @MockBean
  private MaterialApplicationService materialApplicationService;

  @MockBean
  private BuyerRoleApplicationService buyerRoleApplicationService;

  @MockBean
  private BuyerUserApplicationService buyerUserApplicationService;

  @MockBean
  private AuditLogApplicationService auditLogApplicationService;

  @MockBean
  private BuyerWorkspaceApplicationService buyerWorkspaceApplicationService;

  @MockBean
  private SupplierWorkspaceApplicationService supplierWorkspaceApplicationService;

  @MockBean
  private AttachmentApplicationService attachmentApplicationService;

  @MockBean
  private NotificationApplicationService notificationApplicationService;

  @MockBean
  private DepartmentApplicationService departmentApplicationService;

  @Test
  void viteLocalhostPreflightCanUseAuthorizationHeaderForJavaApiCalls() throws Exception {
    mockMvc.perform(options("/api/v1/buyer/suppliers")
            .header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "GET")
            .header("Access-Control-Request-Headers", "authorization"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
        .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
        .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("authorization")));
  }

  @Test
  void healthAndLoginArePublicButBuyerApisRequireBuyerRole() throws Exception {
    mockMvc.perform(get("/api/v1/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("ok"));

    mockMvc.perform(get("/api/v1/buyer/demands"))
        .andExpect(status().isForbidden());

    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/demands")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(purchaseDemandApplicationService.listCurrentTenantDemands()).thenReturn(List.of());
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/demands")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data").isArray());
  }

  @Test
  void buyerCanListPendingApprovalTasksButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/approvals/pending")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(approvalInboxApplicationService.listPending()).thenReturn(List.of(
        new PendingApprovalTaskResponse(
            "approval-award",
            "tenant-acme",
            "rfq_award",
            "award-demo",
            "rfq-demo",
            "办公电脑询价",
            BigDecimal.valueOf(98000),
            "ent-supplier-sunrise",
            null,
            null,
            "待审批",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")),
        new PendingApprovalTaskResponse(
            "approval-demand",
            "tenant-acme",
            "purchase_demand",
            "demand-demo",
            null,
            "采购 20 台电脑",
            BigDecimal.valueOf(120000),
            null,
            null,
            null,
            "待审批",
            OffsetDateTime.parse("2026-06-15T11:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/approvals/pending")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].bizType").value("rfq_award"))
        .andExpect(jsonPath("$.data[0].parentBizId").value("rfq-demo"))
        .andExpect(jsonPath("$.data[0].summaryTitle").value("办公电脑询价"))
        .andExpect(jsonPath("$.data[0].amount").value(98000))
        .andExpect(jsonPath("$.data[0].status").value("待审批"))
        .andExpect(jsonPath("$.data[1].bizType").value("purchase_demand"))
        .andExpect(jsonPath("$.data[1].summaryTitle").value("采购 20 台电脑"));
  }

  @Test
  void buyerCanListTenantAuditLogsButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/audit-logs")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(auditLogApplicationService.listCurrentTenantAuditLogs(50)).thenReturn(List.of(
        new AuditLogResponse(
            "audit-demo",
            "tenant-acme",
            "buyer-user",
            "purchase_order.created",
            "purchase_order",
            "po-demo",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/audit-logs")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].tenantId").value("tenant-acme"))
        .andExpect(jsonPath("$.data[0].action").value("purchase_order.created"));
  }

  @Test
  void buyerCanLoadAggregatedWorkspaceButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/workspace")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerWorkspaceApplicationService.load()).thenReturn(new BuyerWorkspaceResponse(
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of()));

    mockMvc.perform(get("/api/v1/buyer/workspace")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.suppliers").isArray())
        .andExpect(jsonPath("$.data.materials").isArray())
        .andExpect(jsonPath("$.data.users").isArray())
        .andExpect(jsonPath("$.data.demands").isArray())
        .andExpect(jsonPath("$.data.rfqs").isArray())
        .andExpect(jsonPath("$.data.orders").isArray())
        .andExpect(jsonPath("$.data.invoices").isArray())
        .andExpect(jsonPath("$.data.pendingApprovals").isArray())
        .andExpect(jsonPath("$.data.auditLogs").isArray());
  }

  @Test
  void buyerCanListCurrentTenantDepartmentsButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/departments")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(departmentApplicationService.listCurrentTenantDepartments()).thenReturn(List.of(
        new DepartmentResponse("dept-it", "tenant-acme", "信息化部", null, "active")));

    mockMvc.perform(get("/api/v1/buyer/departments")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].id").value("dept-it"))
        .andExpect(jsonPath("$.data[0].tenantId").value("tenant-acme"))
        .andExpect(jsonPath("$.data[0].name").value("信息化部"))
        .andExpect(jsonPath("$.data[0].status").value("active"));
  }

  @Test
  void buyerCanCreateDepartmentButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(post("/api/v1/buyer/departments")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "研发采购部",
                  "parentId": "dept-it"
                }
                """))
        .andExpect(status().isForbidden());

    when(departmentApplicationService.createDepartment(org.mockito.ArgumentMatchers.any())).thenReturn(
        new DepartmentResponse("dept-rd", "tenant-acme", "研发采购部", "dept-it", "active"));

    mockMvc.perform(post("/api/v1/buyer/departments")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "研发采购部",
                  "parentId": "dept-it"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value("dept-rd"))
        .andExpect(jsonPath("$.data.name").value("研发采购部"))
        .andExpect(jsonPath("$.data.parentId").value("dept-it"))
        .andExpect(jsonPath("$.data.status").value("active"));
  }

  @Test
  void buyerCanDisableDepartmentButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(post("/api/v1/buyer/departments/dept-old/disable")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(departmentApplicationService.disableDepartment("dept-old")).thenReturn(
        new DepartmentResponse("dept-old", "tenant-acme", "历史部门", null, "inactive"));

    mockMvc.perform(post("/api/v1/buyer/departments/dept-old/disable")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value("dept-old"))
        .andExpect(jsonPath("$.data.status").value("inactive"));
  }

  @Test
  void loginIssuesScopedTokensWithoutCrossTenantSupplierClaims() throws Exception {
    MvcResult buyerLogin = mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "account": "buyer",
                  "password": "demo123456",
                  "scope": "BUYER",
                  "tenantId": "tenant-acme"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.scope").value("BUYER"))
        .andExpect(jsonPath("$.data.tenantId").value("tenant-acme"))
        .andExpect(jsonPath("$.data.supplierId").doesNotExist())
        .andReturn();

    String buyerBody = buyerLogin.getResponse().getContentAsString();
    org.assertj.core.api.Assertions.assertThat(buyerBody).contains("\"accessToken\"");
    org.assertj.core.api.Assertions.assertThat(buyerBody).contains("\"BUYER_OWNER\"");

    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "account": "supplier",
                  "password": "demo123456",
                  "scope": "SUPPLIER",
                  "supplierId": "ent-supplier-sunrise"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.scope").value("SUPPLIER"))
        .andExpect(jsonPath("$.data.supplierId").value("ent-supplier-sunrise"))
        .andExpect(jsonPath("$.data.tenantId").doesNotExist())
        .andExpect(jsonPath("$.data.roles[0]").value(not("BUYER_OWNER")));
  }

  @Test
  void loginRejectsScopeContextMismatchBeforeIssuingToken() throws Exception {
    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "account": "buyer",
                  "password": "demo123456",
                  "scope": "BUYER"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("BUYER login requires tenantId and forbids supplierId"));

    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "account": "supplier",
                  "password": "demo123456",
                  "scope": "SUPPLIER"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("SUPPLIER login requires supplierId and forbids tenantId"));

    mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "account": "platform",
                  "password": "demo123456",
                  "scope": "PLATFORM",
                  "tenantId": "tenant-acme"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("PLATFORM login forbids tenantId and supplierId"));
  }

  @Test
  void supplierApisRequireSupplierRoleAndPlatformApisRequirePlatformRole() throws Exception {
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String platformToken = loginAndExtractToken("""
        {
          "account": "platform",
          "password": "demo123456",
          "scope": "PLATFORM"
        }
        """);

    mockMvc.perform(post("/api/v1/supplier/rfqs/rfq-demo/quotes")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validQuotePayload()))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/supplier/profile")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/confirm")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(quoteApplicationService.submit(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.any(SubmitQuoteRequest.class)))
        .thenReturn(new QuoteResponse(
            "quote-demo",
            "tenant-acme",
            "rfq-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            BigDecimal.valueOf(13),
            7,
            "已提交",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));
    when(supplierProfileApplicationService.getCurrentSupplierProfile())
        .thenReturn(new SupplierProfileResponse(
            "ent-supplier-sunrise",
            "晨光科技供应商",
            "supplier",
            "办公设备",
            true,
            List.of("Acme 采购公司")));
    when(quoteApplicationService.listSupplierRfqs()).thenReturn(List.of());
    when(quoteApplicationService.listSupplierQuotes()).thenReturn(List.of());
    when(purchaseOrderApplicationService.listCurrentSupplierOrders()).thenReturn(List.of());
    when(purchaseOrderApplicationService.confirmCurrentSupplierOrder("po-demo"))
        .thenReturn(new PurchaseOrderResponse(
            "po-demo",
            "tenant-acme",
            "rfq-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            "待发货",
            LocalDate.parse("2026-07-10"),
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T12:05:00+08:00")));
    when(invoiceApplicationService.listCurrentSupplierInvoices()).thenReturn(List.of());

    mockMvc.perform(post("/api/v1/supplier/rfqs/rfq-demo/quotes")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validQuotePayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.supplierId").value("ent-supplier-sunrise"));

    mockMvc.perform(get("/api/v1/supplier/profile")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("ent-supplier-sunrise"));
    mockMvc.perform(get("/api/v1/supplier/rfqs")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/quotes")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/orders")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/confirm")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("待发货"));
    mockMvc.perform(get("/api/v1/supplier/invoices")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());

    mockMvc.perform(get("/api/v1/platform/overview")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(platformOverviewApplicationService.overview())
        .thenReturn(new PlatformOverviewResponse("platform", 2, 3, 1));

    mockMvc.perform(get("/api/v1/platform/overview")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.scope").value("platform"))
        .andExpect(jsonPath("$.data.tenantCount").value(2))
        .andExpect(jsonPath("$.data.publicSupplierCount").value(3))
        .andExpect(jsonPath("$.data.pendingEnterpriseReviews").value(1));
  }

  @Test
  void platformCanLoadAggregatedWorkspaceButBuyerCannot() throws Exception {
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);
    String platformToken = loginAndExtractToken("""
        {
          "account": "platform",
          "password": "demo123456",
          "scope": "PLATFORM"
        }
        """);

    mockMvc.perform(get("/api/v1/platform/workspace")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(platformWorkspaceApplicationService.load()).thenReturn(new PlatformWorkspaceResponse(
        new PlatformOverviewResponse("platform", 2, 3, 1),
        List.of(new TenantResponse("tenant-acme", "Acme 采购公司", "MVP", "active", List.of("rfq"), 100)),
        List.of(new EnterpriseReviewResponse("ent-supplier-sunrise", "晨光科技供应商", "supplier", false, "pending"))));

    mockMvc.perform(get("/api/v1/platform/workspace")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.overview.scope").value("platform"))
        .andExpect(jsonPath("$.data.tenants[0].id").value("tenant-acme"))
        .andExpect(jsonPath("$.data.enterpriseReviews[0].reviewStatus").value("pending"));
  }

  @Test
  void supplierCanLoadAggregatedWorkspaceButBuyerCannot() throws Exception {
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);

    mockMvc.perform(get("/api/v1/supplier/workspace")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(supplierWorkspaceApplicationService.load()).thenReturn(new SupplierWorkspaceResponse(
        new SupplierProfileResponse(
            "ent-supplier-sunrise",
            "晨光科技供应商",
            "supplier",
            "办公设备",
            true,
            List.of("Acme 采购公司")),
        List.of(),
        List.of(),
        List.of(),
        List.of()));

    mockMvc.perform(get("/api/v1/supplier/workspace")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.profile.id").value("ent-supplier-sunrise"))
        .andExpect(jsonPath("$.data.opportunities").isArray())
        .andExpect(jsonPath("$.data.quotes").isArray())
        .andExpect(jsonPath("$.data.orders").isArray())
        .andExpect(jsonPath("$.data.invoices").isArray());
  }

  @Test
  void buyerCanSubmitAndReviewAwardApprovalButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/award")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "quoteId": "quote-demo",
                  "reason": "最低价"
                }
                """))
        .andExpect(status().isForbidden());

    when(awardApplicationService.award(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.any(AwardRfqRequest.class)))
        .thenReturn(new AwardDecisionResponse(
            "award-demo",
            "tenant-acme",
            "rfq-demo",
            "quote-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            "最低价",
            "待审批",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/award")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "quoteId": "quote-demo",
                  "reason": "最低价"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("award-demo"))
        .andExpect(jsonPath("$.data.approvedStatus").value("待审批"));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/award/approval")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "awardId": "award-demo",
                  "approved": true
                }
                """))
        .andExpect(status().isForbidden());

    when(awardApplicationService.reviewApproval(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new AwardDecisionResponse(
            "award-demo",
            "tenant-acme",
            "rfq-demo",
            "quote-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            "最低价",
            "已通过",
            OffsetDateTime.parse("2026-06-15T12:05:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/award/approval")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "awardId": "award-demo",
                  "approved": true
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.rfqId").value("rfq-demo"))
        .andExpect(jsonPath("$.data.approvedStatus").value("已通过"));
  }

  @Test
  void buyerCanReviewPurchaseDemandApprovalButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(post("/api/v1/buyer/demands/demand-demo/approval")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "approved": true
                }
                """))
        .andExpect(status().isForbidden());

    when(purchaseDemandApplicationService.review(
        org.mockito.ArgumentMatchers.eq("demand-demo"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new ApprovalTaskResponse(
            "approval-demo",
            "tenant-acme",
            "purchase_demand",
            "demand-demo",
            "user-buyer-owner",
            "已通过",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/demands/demand-demo/approval")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "approved": true
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("已通过"))
        .andExpect(jsonPath("$.data.bizId").value("demand-demo"));
  }

  @Test
  void platformApisExposeTenantFeatureAndEnterpriseReviewOperations() throws Exception {
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);
    String platformToken = loginAndExtractToken("""
        {
          "account": "platform",
          "password": "demo123456",
          "scope": "PLATFORM"
        }
        """);

    when(platformTenantApplicationService.listTenants()).thenReturn(List.of(new TenantResponse(
        "tenant-acme",
        "Acme 采购公司",
        "starter",
        "active",
        List.of("rfq", "order"),
        50)));

    mockMvc.perform(get("/api/v1/platform/tenants")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/platform/tenants")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("tenant-acme"))
        .andExpect(jsonPath("$.data[0].enabledFeatures[0]").value("rfq"));

    when(platformTenantApplicationService.updateFeatureToggles(
        org.mockito.ArgumentMatchers.eq("tenant-acme"),
        org.mockito.ArgumentMatchers.any(FeatureToggleRequest.class)))
        .thenReturn(new TenantResponse(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "active",
            List.of("rfq", "order", "finance"),
            50));

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/features")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "enabledFeatures": ["rfq", "order", "finance"]
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.enabledFeatures[2]").value("finance"));

    when(platformEnterpriseApplicationService.listPendingReviews()).thenReturn(List.of(new EnterpriseReviewResponse(
        "ent-supplier-sunrise",
        "晨光供应商",
        "supplier",
        false,
        "pending")));

    mockMvc.perform(get("/api/v1/platform/enterprise-reviews")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("ent-supplier-sunrise"))
        .andExpect(jsonPath("$.data[0].reviewStatus").value("pending"));

    when(platformEnterpriseApplicationService.reviewEnterprise(
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.any(EnterpriseReviewRequest.class)))
        .thenReturn(new EnterpriseReviewResponse(
            "ent-supplier-sunrise",
            "晨光供应商",
            "supplier",
            true,
            "approved"));

    mockMvc.perform(post("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "verified": true,
                  "reviewStatus": "approved"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.verified").value(true))
        .andExpect(jsonPath("$.data.reviewStatus").value("approved"));
  }

  @Test
  void buyerAttachmentApisRegisterAndListTenantScopedAttachmentMetadata() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    when(attachmentApplicationService.listCurrentTenantAttachments("purchase_demand", "demand-demo"))
        .thenReturn(List.of(new AttachmentResponse(
            "att-demand-spec",
            "tenant-acme",
            "purchase_demand",
            "demand-demo",
            "需求规格书.pdf",
            "tenant-acme/purchase_demand/demand-demo/spec.pdf",
            "user-buyer-owner",
            "tenant",
            "active",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/attachments")
            .param("ownerType", "purchase_demand")
            .param("ownerId", "demand-demo")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/buyer/attachments")
            .param("ownerType", "purchase_demand")
            .param("ownerId", "demand-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("att-demand-spec"))
        .andExpect(jsonPath("$.data[0].ownerType").value("purchase_demand"))
        .andExpect(jsonPath("$.data[0].fileName").value("需求规格书.pdf"))
        .andExpect(jsonPath("$.data[0].uploadedBy").value("user-buyer-owner"))
        .andExpect(jsonPath("$.data[0].visibility").value("tenant"))
        .andExpect(jsonPath("$.data[0].status").value("active"));

    when(attachmentApplicationService.createCurrentTenantAttachment(
        org.mockito.ArgumentMatchers.any(CreateAttachmentRequest.class)))
        .thenReturn(new AttachmentResponse(
            "att-quote-file",
            "tenant-acme",
            "quote",
            "quote-demo",
            "报价单.xlsx",
            "tenant-acme/quote/quote-demo/quote.xlsx",
            "user-buyer-owner",
            "supplier_shared",
            "active",
            OffsetDateTime.parse("2026-06-15T11:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/attachments")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "ownerType": "quote",
                  "ownerId": "quote-demo",
                  "fileName": "报价单.xlsx",
                  "storageKey": "tenant-acme/quote/quote-demo/quote.xlsx",
                  "visibility": "supplier_shared"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("att-quote-file"))
        .andExpect(jsonPath("$.data.storageKey").value("tenant-acme/quote/quote-demo/quote.xlsx"))
        .andExpect(jsonPath("$.data.visibility").value("supplier_shared"))
        .andExpect(jsonPath("$.data.status").value("active"));
  }

  @Test
  void buyerNotificationApisListCurrentUserMessagesAndMarkThemRead() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    when(notificationApplicationService.listCurrentUserNotifications(50))
        .thenReturn(List.of(new NotificationResponse(
            "notice-demand-approval",
            "tenant-acme",
            "user-buyer-owner",
            "采购需求待审批",
            "办公电脑采购等待处理",
            false,
            null,
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/notifications")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/buyer/notifications")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("notice-demand-approval"))
        .andExpect(jsonPath("$.data[0].title").value("采购需求待审批"))
        .andExpect(jsonPath("$.data[0].read").value(false));

    when(notificationApplicationService.markCurrentUserNotificationRead("notice-demand-approval"))
        .thenReturn(new NotificationResponse(
            "notice-demand-approval",
            "tenant-acme",
            "user-buyer-owner",
            "采购需求待审批",
            "办公电脑采购等待处理",
            true,
            OffsetDateTime.parse("2026-06-15T12:30:00+08:00"),
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/notifications/notice-demand-approval/read")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("notice-demand-approval"))
        .andExpect(jsonPath("$.data.read").value(true));
  }

  @Test
  void buyerMasterDataApisRequireBuyerRoleAndExposeSupplierCatalogAndUserEntries() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/suppliers")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.listCurrentTenantSuppliers()).thenReturn(List.of(new BuyerSupplierResponse(
        "rel-sunrise",
        "tenant-acme",
        "ent-supplier-sunrise",
        "晨光供应商",
        "已准入",
        "A",
        List.of("办公设备"),
        BigDecimal.valueOf(92.50))));

    mockMvc.perform(get("/api/v1/buyer/suppliers")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].supplierName").value("晨光供应商"))
        .andExpect(jsonPath("$.data[0].categories[0]").value("办公设备"));

    when(buyerSupplierApplicationService.createSupplierRelation(
        org.mockito.ArgumentMatchers.any(CreateBuyerSupplierRequest.class)))
        .thenReturn(new BuyerSupplierResponse(
            "rel-created",
            "tenant-acme",
            "ent-supplier-ocean",
            "远洋供应商",
            "待准入",
            "B",
            List.of("服务"),
            BigDecimal.ZERO));

    mockMvc.perform(post("/api/v1/buyer/suppliers")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "supplierId": "ent-supplier-ocean",
                  "status": "待准入",
                  "level": "B",
                  "categories": ["服务"]
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.supplierId").value("ent-supplier-ocean"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/submit")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.submitAdmission("rel-created"))
        .thenReturn(new ApprovalTaskResponse(
            "approval-supplier-created",
            "tenant-acme",
            "buyer_supplier_admission",
            "rel-created",
            null,
            "待审批",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/submit")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.bizType").value("buyer_supplier_admission"))
        .andExpect(jsonPath("$.data.status").value("待审批"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/approval")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "approved": true
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.reviewAdmission(
        org.mockito.ArgumentMatchers.eq("rel-created"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new ApprovalTaskResponse(
            "approval-supplier-created",
            "tenant-acme",
            "buyer_supplier_admission",
            "rel-created",
            "user-buyer-owner",
            "已通过",
            OffsetDateTime.parse("2026-06-15T12:05:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/approval")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "approved": true
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.bizId").value("rel-created"))
        .andExpect(jsonPath("$.data.status").value("已通过"));

    when(materialApplicationService.listCurrentTenantMaterials()).thenReturn(List.of(new MaterialResponse(
        "mat-laptop",
        "tenant-acme",
        "IT-LAPTOP",
        "办公电脑",
        "办公设备",
        "台",
        BigDecimal.valueOf(6000))));

    mockMvc.perform(get("/api/v1/buyer/materials")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].code").value("IT-LAPTOP"));

    when(materialApplicationService.createMaterial(
        org.mockito.ArgumentMatchers.any(CreateMaterialRequest.class)))
        .thenReturn(new MaterialResponse(
            "mat-monitor",
            "tenant-acme",
            "IT-MONITOR",
            "显示器",
            "办公设备",
            "台",
            BigDecimal.valueOf(1200)));

    mockMvc.perform(post("/api/v1/buyer/materials")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "code": "IT-MONITOR",
                  "name": "显示器",
                  "category": "办公设备",
                  "unit": "台",
                  "referencePrice": 1200
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.name").value("显示器"));

    when(buyerUserApplicationService.listCurrentTenantUsers()).thenReturn(List.of(new BuyerUserResponse(
        "user-buyer-owner",
        "tenant-acme",
        "采购负责人",
        "13800000000",
        "buyer@example.com",
        "active",
        "dept-it",
        "role-buyer-owner")));

    mockMvc.perform(get("/api/v1/buyer/users")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("采购负责人"))
        .andExpect(jsonPath("$.data[0].departmentId").value("dept-it"))
        .andExpect(jsonPath("$.data[0].roleId").value("role-buyer-owner"));

    when(buyerUserApplicationService.createUser(
        org.mockito.ArgumentMatchers.any(CreateBuyerUserRequest.class)))
        .thenReturn(new BuyerUserResponse(
            "user-buyer-new",
            "tenant-acme",
            "需求申请人",
            "13900000000",
            "requester@example.com",
            "active",
            "dept-it",
            "role-buyer-requester"));

    mockMvc.perform(post("/api/v1/buyer/users")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "需求申请人",
                  "mobile": "13900000000",
                  "email": "requester@example.com",
                  "status": "active",
                  "departmentId": "dept-it",
                  "roleId": "role-buyer-requester"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("user-buyer-new"))
        .andExpect(jsonPath("$.data.departmentId").value("dept-it"))
        .andExpect(jsonPath("$.data.roleId").value("role-buyer-requester"));

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/role")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "roleId": "role-buyer-requester"
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerUserApplicationService.changeUserRole(
        org.mockito.ArgumentMatchers.eq("user-buyer-new"),
        org.mockito.ArgumentMatchers.any(ChangeBuyerUserRoleRequest.class)))
        .thenReturn(new BuyerUserResponse(
            "user-buyer-new",
            "tenant-acme",
            "需求申请人",
            "13900000000",
            "requester@example.com",
            "active",
            "dept-it",
            "role-buyer-owner"));

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/role")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "roleId": "role-buyer-owner"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("user-buyer-new"))
        .andExpect(jsonPath("$.data.roleId").value("role-buyer-owner"));

    mockMvc.perform(get("/api/v1/buyer/roles")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.listCurrentTenantRoles()).thenReturn(List.of(new BuyerRoleResponse(
        "role-buyer-requester",
        "tenant-acme",
        "需求申请人",
        List.of("buyer:demand:create", "buyer:demand:read"))));

    mockMvc.perform(get("/api/v1/buyer/roles")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("role-buyer-requester"))
        .andExpect(jsonPath("$.data[0].permissions[0]").value("buyer:demand:create"));
  }

  @Test
  void buyerFulfillmentAndPaymentApisRequireBuyerRole() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    mockMvc.perform(get("/api/v1/buyer/orders")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/orders")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validCreateOrderPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/orders/po-demo/receipts")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validReceiptPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/invoices")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/invoices/invoice-demo/payments")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentPayload()))
        .andExpect(status().isForbidden());

    when(purchaseOrderApplicationService.listCurrentTenantOrders()).thenReturn(List.of(orderResponse("po-demo", "待供应商确认")));
    when(purchaseOrderApplicationService.createFromAward(
        org.mockito.ArgumentMatchers.any(CreatePurchaseOrderRequest.class)))
        .thenReturn(orderResponse("po-created", "待供应商确认"));
    when(receiptApplicationService.create(
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.any(CreateReceiptRequest.class)))
        .thenReturn(new ReceiptResponse(
            "receipt-demo",
            "tenant-acme",
            "po-demo",
            "user-buyer-owner",
            "验收通过",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));
    when(paymentApplicationService.listCurrentTenantInvoices()).thenReturn(List.of(invoiceResponse("invoice-demo", "待付款")));
    when(paymentApplicationService.register(
        org.mockito.ArgumentMatchers.eq("invoice-demo"),
        org.mockito.ArgumentMatchers.any(RegisterPaymentRequest.class)))
        .thenReturn(invoiceResponse("invoice-demo", "已付款"));

    mockMvc.perform(get("/api/v1/buyer/orders")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("po-demo"));
    mockMvc.perform(post("/api/v1/buyer/orders")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validCreateOrderPayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("po-created"));
    mockMvc.perform(post("/api/v1/buyer/orders/po-demo/receipts")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validReceiptPayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.result").value("验收通过"));
    mockMvc.perform(get("/api/v1/buyer/invoices")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("invoice-demo"));
    mockMvc.perform(post("/api/v1/buyer/invoices/invoice-demo/payments")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.paymentStatus").value("已付款"));
  }

  @Test
  void supplierFulfillmentAndInvoiceApisRequireSupplierRole() throws Exception {
    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);
    String supplierToken = loginAndExtractToken("""
        {
          "account": "supplier",
          "password": "demo123456",
          "scope": "SUPPLIER",
          "supplierId": "ent-supplier-sunrise"
        }
        """);

    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/deliveries")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validDeliveryPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/invoices")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validInvoicePayload()))
        .andExpect(status().isForbidden());

    when(deliveryApplicationService.create(
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.any(CreateDeliveryRequest.class)))
        .thenReturn(new DeliveryResponse(
            "delivery-demo",
            "tenant-acme",
            "po-demo",
            "ent-supplier-sunrise",
            "顺丰",
            "SF123",
            "已发货",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));
    when(invoiceApplicationService.create(
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(invoiceResponse("invoice-created", "待付款"));

    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/deliveries")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validDeliveryPayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.status").value("已发货"));
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/invoices")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validInvoicePayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("invoice-created"));
  }

  private String loginAndExtractToken(String payload) throws Exception {
    String responseBody = mockMvc.perform(post("/api/v1/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andReturn()
        .getResponse()
        .getContentAsString();

    int markerIndex = responseBody.indexOf("\"accessToken\":\"");
    int tokenStart = markerIndex + "\"accessToken\":\"".length();
    int tokenEnd = responseBody.indexOf('"', tokenStart);
    return responseBody.substring(tokenStart, tokenEnd);
  }

  private String validQuotePayload() {
    return """
        {
          "amount": 98000,
          "taxRate": 13,
          "deliveryDays": 7
        }
        """;
  }

  private String validCreateOrderPayload() {
    return """
        {
          "awardId": "award-demo",
          "expectedReceiptDate": "2026-07-10"
        }
        """;
  }

  private String validReceiptPayload() {
    return """
        {
          "result": "验收通过"
        }
        """;
  }

  private String validDeliveryPayload() {
    return """
        {
          "carrier": "顺丰",
          "trackingNo": "SF123"
        }
        """;
  }

  private String validInvoicePayload() {
    return """
        {
          "amount": 98000,
          "invoiceNo": "INV-20260615"
        }
        """;
  }

  private String validPaymentPayload() {
    return """
        {
          "paymentStatus": "已付款"
        }
        """;
  }

  private PurchaseOrderResponse orderResponse(String id, String status) {
    return new PurchaseOrderResponse(
        id,
        "tenant-acme",
        "rfq-demo",
        "ent-supplier-sunrise",
        BigDecimal.valueOf(98000),
        status,
        LocalDate.parse("2026-07-10"),
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }

  private InvoiceResponse invoiceResponse(String id, String paymentStatus) {
    return new InvoiceResponse(
        id,
        "tenant-acme",
        "ent-supplier-sunrise",
        "po-demo",
        BigDecimal.valueOf(98000),
        "INV-20260615",
        paymentStatus,
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }
}
