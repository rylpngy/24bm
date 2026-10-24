package com.procurement;

import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import com.procurement.contract.api.BuyerContractController;
import com.procurement.contract.api.ContractScheduleController;
import com.procurement.contract.api.ContractResponse;
import com.procurement.contract.api.UpdateContractArchiveStatusRequest;
import com.procurement.contract.api.UpdateContractStatusRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.buyer.api.BuyerAnalyticsController;
import com.procurement.buyer.api.BuyerBudgetController;
import com.procurement.buyer.api.DepartmentBudgetResponse;
import com.procurement.buyer.api.BuyerWorkspaceController;
import com.procurement.buyer.api.BuyerWorkspaceResponse;
import com.procurement.buyer.api.BuyerTodoSummaryResponse;
import com.procurement.buyer.application.BuyerWorkspaceApplicationService;
import com.procurement.approval.api.ApprovalInboxController;
import com.procurement.approval.api.ApprovalTemplateResponse;
import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.approval.application.ApprovalTemplateApplicationService;
import com.procurement.attachment.api.AttachmentController;
import com.procurement.attachment.api.AttachmentResponse;
import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.demand.api.PurchaseDemandController;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.dictionary.api.DictionaryController;
import com.procurement.dictionary.api.PlatformDictionaryController;
import com.procurement.dictionary.api.DictionaryEntryResponse;
import com.procurement.dictionary.application.DictionaryApplicationService;
import com.procurement.identity.SecurityConfig;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.AuthController;
import com.procurement.identity.api.BuyerRoleController;
import com.procurement.identity.api.BuyerRoleResponse;
import com.procurement.identity.api.PermissionPointResponse;
import com.procurement.identity.api.ChangeBuyerUserRoleRequest;
import com.procurement.identity.api.ChangeBuyerUserStatusRequest;
import com.procurement.identity.api.ResetBuyerUserPasswordRequest;
import com.procurement.identity.api.BuyerUserController;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import com.procurement.identity.api.MyPermissionsResponse;
import com.procurement.identity.application.BuyerRoleApplicationService;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.domain.AuthenticatedUser;
import com.procurement.identity.infrastructure.AuthenticationUserMapper;
import com.procurement.identity.security.JwtAuthenticationFilter;
import com.procurement.identity.security.JwtTokenService;
import com.procurement.finance.api.SupplierReceivableController;
import com.procurement.finance.api.BuyerFinanceActionController;
import com.procurement.finance.api.BuyerFinanceReportController;
import com.procurement.finance.api.BuyerInvoiceReconciliationController;
import com.procurement.finance.api.BuyerPaymentController;
import com.procurement.finance.api.BuyerPaymentLedgerController;
import com.procurement.finance.api.BuyerPaymentReviewController;
import com.procurement.finance.application.PaymentReviewApplicationService;
import com.procurement.finance.application.PaymentLedgerApplicationService;
import com.procurement.finance.api.CreatePaymentRequestRequest;
import com.procurement.finance.api.CreateVarianceHandlingRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.InvoiceReconciliationResponse;
import com.procurement.finance.api.PaymentBatchResponse;
import com.procurement.finance.api.PaymentExecutionRecordResponse;
import com.procurement.finance.api.PaymentRequestResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.SupplierInvoiceController;
import com.procurement.finance.api.SupplierInvoiceReconciliationController;
import com.procurement.finance.api.UpdatePaymentBatchStatusRequest;
import com.procurement.finance.api.UpdatePaymentRequestStatusRequest;
import com.procurement.finance.api.VarianceHandlingResponse;
import com.procurement.finance.api.UpdateVarianceHandlingStatusRequest;
import com.procurement.finance.application.FinanceActionApplicationService;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.api.UpdateSupplierReceivableRequest;
import com.procurement.notification.api.BuyerNotificationChannelController;
import com.procurement.notification.api.BuyerNotificationController;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.api.SupplierNotificationController;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.api.DepartmentController;
import com.procurement.organization.api.DepartmentResponse;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.order.api.BuyerDeliveryController;
import com.procurement.workflow.api.UnifiedWorkflowController;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.order.api.BuyerReceiptController;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.api.ReceiptResponse;
import com.procurement.order.api.SupplierOrderController;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.api.SupplierDeliveryController;
import com.procurement.order.api.UpdateDeliveryRequest;
import com.procurement.order.api.PurchaseOrderController;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.application.ReceiptApplicationService;
import com.procurement.platform.api.EnterpriseReviewRequest;
import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.api.BuyerAnnouncementController;
import com.procurement.platform.api.CreatePlatformAnnouncementRequest;
import com.procurement.platform.api.CreateTenantRequest;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.PlatformAnnouncementController;
import com.procurement.platform.api.PlatformAnnouncementResponse;
import com.procurement.platform.api.PlatformEnterpriseController;
import com.procurement.platform.api.PlatformOperationSummaryResponse;
import com.procurement.platform.api.PlatformOverviewController;
import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.api.PlatformBillingController;
import com.procurement.platform.api.PlatformSupplierController;
import com.procurement.platform.api.PublicPortalController;
import com.procurement.mall.api.PublicMallController;
import com.procurement.sourcing.api.PublicOpportunityController;
import com.procurement.sourcing.api.PublicProcurementAnnouncementController;
import com.procurement.platform.api.PlatformTenantController;
import com.procurement.platform.api.PlatformWorkspaceController;
import com.procurement.platform.api.SupplierAnnouncementController;
import com.procurement.platform.api.PlatformWorkspaceResponse;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.api.UpdatePlatformAnnouncementRequest;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import com.procurement.platform.application.PlatformAnnouncementApplicationService;
import com.procurement.platform.application.PlatformOverviewApplicationService;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.application.SupplierCreditApplicationService;
import com.procurement.platform.application.PlatformWorkspaceApplicationService;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.RfqAwardController;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.AnswerClarificationRequest;
import com.procurement.sourcing.api.AskClarificationRequest;
import com.procurement.sourcing.api.RfqClarificationResponse;
import com.procurement.sourcing.api.RfqController;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.SupplierQuoteListController;
import com.procurement.sourcing.api.SupplierQuoteController;
import com.procurement.sourcing.application.AwardApplicationService;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.supplier.api.BuyerSupplierController;
import com.procurement.supplier.api.BuyerSupplierDiscoveryController;
import com.procurement.supplier.api.BuyerSupplierInvitationController;
import com.procurement.supplier.api.DiscoverableSupplierResponse;
import com.procurement.supplier.api.SupplierInvitationResponse;
import com.procurement.supplier.api.SupplierEvaluationController;
import com.procurement.supplier.api.SupplierFulfillmentController;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierProfileRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierPerformanceRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierStatusRequest;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.api.ChangeSupplierQualificationStatusRequest;
import com.procurement.supplier.api.ChangeSupplierUserStatusRequest;
import com.procurement.supplier.api.CreateSupplierQualificationRequest;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.ResetSupplierUserPasswordRequest;
import com.procurement.supplier.api.SupplierProfileController;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.api.SupplierQualificationController;
import com.procurement.supplier.api.SupplierQualificationResponse;
import com.procurement.supplier.api.SupplierUserController;
import com.procurement.supplier.api.SupplierUserResponse;
import com.procurement.supplier.api.UpdateSupplierProfileRequest;
import com.procurement.supplier.api.SupplierWorkspaceController;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import com.procurement.supplier.api.SupplierTodoSummaryResponse;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.application.SupplierEvaluationApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import com.procurement.supplier.application.SupplierUserApplicationService;
import com.procurement.supplier.application.SupplierWorkspaceApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
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
    DictionaryController.class,
    PlatformDictionaryController.class,
    AuthController.class,
    ApprovalInboxController.class,
    PurchaseDemandController.class,
    SupplierQuoteController.class,
    RfqController.class,
    PlatformOverviewController.class,
    PlatformAnnouncementController.class,
    BuyerAnnouncementController.class,
    PlatformSupplierController.class,
    PublicMallController.class,
    PublicOpportunityController.class,
    PublicProcurementAnnouncementController.class,
    PublicPortalController.class,
    PlatformTenantController.class,
    PlatformBillingController.class,
    PlatformEnterpriseController.class,
    PlatformWorkspaceController.class,
    SupplierAnnouncementController.class,
    BuyerSupplierController.class,
    com.procurement.supplier.api.SupplierExitController.class,
    com.procurement.supplier.api.SupplierCooperationInvitationController.class,
    com.procurement.supplier.api.SupplierExitItemsController.class,
    BuyerSupplierDiscoveryController.class,
    BuyerSupplierInvitationController.class,
    SupplierEvaluationController.class,
    com.procurement.supplier.api.BuyerPerformanceTaskController.class,
    com.procurement.supplier.api.SupplierPerformanceTaskController.class,
    SupplierFulfillmentController.class,
    MaterialController.class,
    BuyerRoleController.class,
    BuyerUserController.class,
    SupplierProfileController.class,
    SupplierQualificationController.class,
    SupplierUserController.class,
    SupplierQuoteListController.class,
    RfqAwardController.class,
    PurchaseOrderController.class,
    BuyerContractController.class,
    ContractScheduleController.class,
    SupplierOrderController.class,
    BuyerReceiptController.class,
    SupplierDeliveryController.class,
    BuyerDeliveryController.class,
    UnifiedWorkflowController.class,
    BuyerInvoiceReconciliationController.class,
    SupplierInvoiceReconciliationController.class,
    BuyerFinanceActionController.class,
    BuyerFinanceReportController.class,
    BuyerPaymentController.class,
    BuyerPaymentLedgerController.class,
    BuyerPaymentReviewController.class,
    SupplierInvoiceController.class,
    SupplierReceivableController.class,
    AuditLogController.class,
    BuyerWorkspaceController.class,
    BuyerAnalyticsController.class,
    BuyerBudgetController.class,
    SupplierWorkspaceController.class,
    AttachmentController.class,
    BuyerNotificationController.class,
    BuyerNotificationChannelController.class,
    SupplierNotificationController.class,
    DepartmentController.class,
    com.procurement.process.api.ProcessDefinitionController.class,
    com.procurement.mall.api.BuyerMallController.class,
    com.procurement.mall.api.SupplierMallController.class,
    com.procurement.esign.api.BuyerEsignController.class,
    com.procurement.esign.api.SupplierEsignController.class,
    com.procurement.tender.api.BuyerTenderController.class,
    com.procurement.tender.api.SupplierTenderController.class,
    com.procurement.tenant.api.BuyerCapabilityController.class,
    com.procurement.ludongpoc.api.LudongPocController.class,
    com.procurement.identity.api.SessionPermissionController.class
})
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JwtTokenService.class,
    com.procurement.identity.security.KeycloakTokenService.class,
    AuthenticationApplicationService.class,
    com.procurement.identity.application.AuthenticatedSessionService.class
})
@TestPropertySource(properties = {
    "procurement.security.jwt-secret=local-test-secret-must-be-at-least-32-bytes",
    "procurement.security.jwt-expires-in-seconds=7200"
})
class HttpSecurityContractTests {
  private static final String LOCAL_DEMO_PASSWORD_HASH =
      "$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O";

  @Autowired
  private MockMvc mockMvc;

  @MockBean
  private com.procurement.mall.application.MallServiceApplicationService mallServiceApplicationService;

  @MockBean
  private com.procurement.mall.application.MallCartApplicationService mallCartApplicationService;

  @MockBean
  private com.procurement.mall.application.MallCatalogApplicationService mallCatalogApplicationService;

  @MockBean
  private com.procurement.tenant.application.TenantCapabilityApplicationService tenantCapabilityApplicationService;

  @MockBean
  private com.procurement.platform.application.PublicPortalApplicationService publicPortalApplicationService;

  @MockBean
  private com.procurement.sourcing.application.OpportunityApplicationService opportunityApplicationService;

  @MockBean
  private com.procurement.sourcing.application.RfqAnnouncementService rfqAnnouncementService;

  @MockBean
  private com.procurement.mall.application.PublicMallApplicationService publicMallApplicationService;

  @MockBean
  private PurchaseDemandApplicationService purchaseDemandApplicationService;

  @MockBean
  private DictionaryApplicationService dictionaryApplicationService;

  @MockBean
  private ApprovalInboxApplicationService approvalInboxApplicationService;

  @MockBean
  private ApprovalTemplateApplicationService approvalTemplateApplicationService;

  @MockBean
  private QuoteApplicationService quoteApplicationService;

  @MockBean
  private RfqApplicationService rfqApplicationService;

  @MockBean
  private com.procurement.mall.application.MallApplicationService mallApplicationService;

  @MockBean
  private com.procurement.sourcing.application.RfqClarificationApplicationService rfqClarificationApplicationService;

  @MockBean
  private com.procurement.sourcing.application.RfqResultApplicationService rfqResultApplicationService;

  @MockBean
  private com.procurement.sourcing.application.RfqSupplierPerformanceApplicationService rfqSupplierPerformanceApplicationService;

  @MockBean
  private com.procurement.sourcing.application.AwardNoticeApplicationService awardNoticeApplicationService;

  @MockBean
  private AwardApplicationService awardApplicationService;

  @MockBean
  private PurchaseOrderApplicationService purchaseOrderApplicationService;

  @MockBean
  private ContractApplicationService contractApplicationService;

  @MockBean
  private com.procurement.contract.application.ContractScheduleService contractScheduleService;

  @MockBean
  private ReceiptApplicationService receiptApplicationService;

  @MockBean
  private DeliveryApplicationService deliveryApplicationService;

  @MockBean
  private InvoiceApplicationService invoiceApplicationService;

  @MockBean
  private PaymentApplicationService paymentApplicationService;

  @MockBean
  private PaymentLedgerApplicationService paymentLedgerApplicationService;

  @MockBean
  private PaymentReviewApplicationService paymentReviewApplicationService;

  @MockBean
  private FinanceActionApplicationService financeActionApplicationService;

  @MockBean
  private com.procurement.finance.application.FinanceReportApplicationService financeReportApplicationService;

  @MockBean
  private PlatformTenantApplicationService platformTenantApplicationService;

  @MockBean
  private SupplierCreditApplicationService supplierCreditApplicationService;

  @MockBean
  private com.procurement.platform.application.BillingApplicationService billingApplicationService;

  @MockBean
  private PlatformAnnouncementApplicationService platformAnnouncementApplicationService;

  @MockBean
  private PlatformEnterpriseApplicationService platformEnterpriseApplicationService;

  @MockBean
  private PlatformOverviewApplicationService platformOverviewApplicationService;

  @MockBean
  private PlatformWorkspaceApplicationService platformWorkspaceApplicationService;

  @MockBean
  private BuyerSupplierApplicationService buyerSupplierApplicationService;

  @MockBean
  private com.procurement.supplier.application.SupplierExitApplicationService supplierExitApplicationService;

  @MockBean
  private com.procurement.supplier.application.SupplierExitItemsService supplierExitItemsService;

  @MockBean
  private com.procurement.supplier.application.SupplierDiscoveryApplicationService supplierDiscoveryApplicationService;

  @MockBean
  private com.procurement.supplier.application.SupplierInvitationApplicationService supplierInvitationApplicationService;

  @MockBean
  private SupplierEvaluationApplicationService supplierEvaluationApplicationService;

  @MockBean
  private com.procurement.supplier.application.PerformanceTaskApplicationService performanceTaskApplicationService;

  @MockBean
  private com.procurement.supplier.application.SupplierFulfillmentMetricsService supplierFulfillmentMetricsService;

  @MockBean
  private SupplierProfileApplicationService supplierProfileApplicationService;

  @MockBean
  private SupplierQualificationApplicationService supplierQualificationApplicationService;

  @MockBean
  private SupplierUserApplicationService supplierUserApplicationService;

  @MockBean
  private MaterialApplicationService materialApplicationService;

  @MockBean
  private BuyerRoleApplicationService buyerRoleApplicationService;

  @MockBean
  private BuyerUserApplicationService buyerUserApplicationService;

  @MockBean
  private com.procurement.identity.application.BuyerUserImportApplicationService buyerUserImportApplicationService;

  @MockBean
  private com.procurement.process.application.ProcessDefinitionApplicationService processDefinitionApplicationService;

  @MockBean
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  @MockBean
  private com.procurement.ludongpoc.application.LudongPocApplicationService ludongPocApplicationService;

  @MockBean
  private com.procurement.ludongpoc.application.LudongPocDocumentService ludongPocDocumentService;

  @MockBean
  private com.procurement.ludongpoc.application.LudongPocAnalyticsReportService ludongPocAnalyticsReportService;

  @MockBean
  private com.procurement.ludongpoc.application.LudongPocAiReviewService ludongPocAiReviewService;

  @MockBean
  private com.procurement.ludongpoc.application.LudongPocAiReviewRegistry ludongPocAiReviewRegistry;

  @MockBean
  private AuditLogApplicationService auditLogApplicationService;

  @MockBean
  private BuyerWorkspaceApplicationService buyerWorkspaceApplicationService;

  @MockBean
  private com.procurement.buyer.application.BuyerAnalyticsApplicationService buyerAnalyticsApplicationService;

  @MockBean
  private com.procurement.buyer.application.BudgetApplicationService budgetApplicationService;

  @MockBean
  private SupplierWorkspaceApplicationService supplierWorkspaceApplicationService;

  @MockBean
  private AttachmentApplicationService attachmentApplicationService;

  @MockBean
  private NotificationApplicationService notificationApplicationService;

  @MockBean
  private com.procurement.notification.application.NotificationChannelService notificationChannelService;

  @MockBean
  private DepartmentApplicationService departmentApplicationService;

  @MockBean
  private com.procurement.esign.application.EsignApplicationService esignApplicationService;

  @MockBean
  private com.procurement.tender.application.TenderApplicationService tenderApplicationService;

  @MockBean
  private AuthenticationUserMapper authenticationUserMapper;

  @BeforeEach
  void stubDatabaseBackedLoginPrincipals() {
    when(portalPermissions.currentUserHas(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
    when(authenticationUserMapper.findActiveSessionUser(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.nullable(String.class), org.mockito.ArgumentMatchers.nullable(String.class)))
        .thenAnswer(invocation -> {
          String scope = invocation.getArgument(1);
          String account = switch (scope) {
            case "BUYER" -> "buyer";
            case "SUPPLIER" -> "supplier";
            default -> "platform";
          };
          return authenticationUserMapper.findActiveUser(account, scope,
              invocation.getArgument(2), invocation.getArgument(3));
        });
    when(authenticationUserMapper.findActiveUser("buyer", "BUYER", "tenant-acme", null))
        .thenReturn(new AuthenticatedUser(
            "user-buyer-owner",
            "tenant-acme",
            null,
            "采购负责人",
            LOCAL_DEMO_PASSWORD_HASH));
    when(authenticationUserMapper.listSecurityRoles("user-buyer-owner", "BUYER", "tenant-acme", null))
        .thenReturn(List.of("BUYER_OWNER"));
    when(authenticationUserMapper.findActiveUser("supplier", "SUPPLIER", null, "ent-supplier-sunrise"))
        .thenReturn(new AuthenticatedUser(
            "user-supplier-sales",
            null,
            "ent-supplier-sunrise",
            "供应商销售",
            LOCAL_DEMO_PASSWORD_HASH));
    when(authenticationUserMapper.listSecurityRoles("user-supplier-sales", "SUPPLIER", null, "ent-supplier-sunrise"))
        .thenReturn(List.of("SUPPLIER_SALES"));
    when(authenticationUserMapper.findActiveUser("platform", "PLATFORM", null, null))
        .thenReturn(new AuthenticatedUser(
            "user-platform-admin",
            null,
            null,
            "平台运营",
            LOCAL_DEMO_PASSWORD_HASH));
    when(authenticationUserMapper.listSecurityRoles("user-platform-admin", "PLATFORM", null, null))
        .thenReturn(List.of("PLATFORM_ADMIN"));
  }

  @MockBean
  private com.procurement.identity.application.PermissionService portalPermissions;

  @MockBean
  private com.procurement.audit.application.AuditReadAccess auditReadAccess;

  @Test
  void cooperationInvitationsRequireSupplierPortalAndProfilePermissions() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {"account":"supplier","password":"demo123456","scope":"SUPPLIER","supplierId":"ent-supplier-sunrise"}
        """);
    String buyerToken = loginAndExtractToken("""
        {"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}
        """);
    String path = "/api/v1/supplier/cooperation-invitations";
    mockMvc.perform(get(path)).andExpect(status().isForbidden());
    mockMvc.perform(get(path).header("Authorization","Bearer " + buyerToken)).andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("supplier:profile:read")).thenReturn(false);
    mockMvc.perform(get(path).header("Authorization","Bearer " + supplierToken)).andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("supplier:profile:manage")).thenReturn(false);
    mockMvc.perform(post(path + "/i/respond").header("Authorization","Bearer " + supplierToken)
        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"accept\"}"))
        .andExpect(status().isForbidden());
    org.mockito.Mockito.verifyNoInteractions(supplierInvitationApplicationService);
    when(portalPermissions.currentUserHas("supplier:profile:read")).thenReturn(true);
    when(supplierInvitationApplicationService.listSupplierInvitations()).thenReturn(List.of(new SupplierInvitationResponse(
        "i","ent-supplier-sunrise","供应商",null,null,"邀请说明","待回复",true,null,null,"采购企业")));
    mockMvc.perform(get(path).header("Authorization","Bearer " + supplierToken))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].buyerName").value("采购企业"))
        .andExpect(jsonPath("$.data[0].tenantId").doesNotExist());
    when(portalPermissions.currentUserHas("supplier:profile:manage")).thenReturn(true);
    mockMvc.perform(post(path + "/i/respond").header("Authorization","Bearer " + supplierToken)
        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\" \"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void exitItemsRequireBuyerPortalAndSupplierRead() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {"account":"supplier","password":"demo123456","scope":"SUPPLIER","supplierId":"ent-supplier-sunrise"}
        """);
    String buyerToken = loginAndExtractToken("""
        {"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}
        """);
    String path = "/api/v1/buyer/suppliers/r/exit-items";
    mockMvc.perform(get(path).param("kind","uninvoiced")).andExpect(status().isForbidden());
    mockMvc.perform(get(path).param("kind","uninvoiced").header("Authorization","Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("buyer:supplier:read")).thenReturn(false);
    mockMvc.perform(get(path).param("kind","uninvoiced").header("Authorization","Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    org.mockito.Mockito.verifyNoInteractions(supplierExitItemsService);
    when(portalPermissions.currentUserHas("buyer:supplier:read")).thenReturn(true);
    when(supplierExitItemsService.list("r","uninvoiced",1,10)).thenReturn(
        new com.procurement.supplier.api.SupplierExitItemsPage(List.of(),0,1,10));
    mockMvc.perform(get(path).param("kind","uninvoiced").header("Authorization","Bearer " + buyerToken))
        .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.pageSize").value(10));
  }

  @Test
  void performanceTaskRoutesEnforcePortalAndPermissionBoundaries() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {"account":"supplier","password":"demo123456","scope":"SUPPLIER","supplierId":"ent-supplier-sunrise"}
        """);
    String buyerToken = loginAndExtractToken("""
        {"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}
        """);
    String buyerPath = "/api/v1/buyer/suppliers/r/performance-tasks";
    String supplierPath = "/api/v1/supplier/performance-tasks";
    mockMvc.perform(get(buyerPath)).andExpect(status().isForbidden());
    mockMvc.perform(get(supplierPath)).andExpect(status().isForbidden());
    mockMvc.perform(get(buyerPath).header("Authorization","Bearer " + supplierToken)).andExpect(status().isForbidden());
    mockMvc.perform(get(supplierPath).header("Authorization","Bearer " + buyerToken)).andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("buyer:supplier:read")).thenReturn(false);
    mockMvc.perform(get(buyerPath).header("Authorization","Bearer " + buyerToken)).andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("supplier:profile:manage")).thenReturn(false);
    mockMvc.perform(post(supplierPath + "/t/response").header("Authorization","Bearer " + supplierToken)
        .contentType(MediaType.APPLICATION_JSON).content("{\"response\":\"已整改\"}"))
        .andExpect(status().isForbidden());
    when(portalPermissions.currentUserHas("supplier:profile:read")).thenReturn(true);
    when(performanceTaskApplicationService.listSupplier()).thenReturn(List.of());
    mockMvc.perform(get(supplierPath).header("Authorization","Bearer " + supplierToken))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
  }

  @Test
  void performanceReviewAndResponseRequireNonnegativeExpectedVersion() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {"account":"supplier","password":"demo123456","scope":"SUPPLIER","supplierId":"ent-supplier-sunrise"}
        """);
    String buyerToken = loginAndExtractToken("""
        {"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}
        """);
    when(portalPermissions.currentUserHas("buyer:supplier:manage")).thenReturn(true);
    when(portalPermissions.currentUserHas("supplier:profile:manage")).thenReturn(true);
    for (String version : new String[]{"", ",\"expectedVersion\":null", ",\"expectedVersion\":-1"}) {
      mockMvc.perform(post("/api/v1/buyer/suppliers/r/performance-tasks/t/review")
          .header("Authorization","Bearer " + buyerToken).contentType(MediaType.APPLICATION_JSON)
          .content("{\"approved\":true,\"comment\":\"已核实\"" + version + "}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("expectedVersion")));
      mockMvc.perform(post("/api/v1/supplier/performance-tasks/t/response")
          .header("Authorization","Bearer " + supplierToken).contentType(MediaType.APPLICATION_JSON)
          .content("{\"response\":\"已整改\"" + version + "}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("expectedVersion")));
    }
    mockMvc.perform(post("/api/v1/buyer/suppliers/r/performance-tasks/t/review")
        .header("Authorization","Bearer " + buyerToken).contentType(MediaType.APPLICATION_JSON)
        .content("{\"approved\":true,\"comment\":\"已核实\",\"expectedVersion\":0}"))
        .andExpect(status().isOk());
    mockMvc.perform(post("/api/v1/supplier/performance-tasks/t/response")
        .header("Authorization","Bearer " + supplierToken).contentType(MediaType.APPLICATION_JSON)
        .content("{\"response\":\"已整改\",\"expectedVersion\":0}"))
        .andExpect(status().isOk());
  }

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
  void platformAdminPreflightCanUseAuthorizationHeaderForJavaApiCalls() throws Exception {
    mockMvc.perform(options("/api/v1/buyer/suppliers")
            .header("Origin", "http://localhost:5174")
            .header("Access-Control-Request-Method", "GET")
            .header("Access-Control-Request-Headers", "authorization"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5174"))
        .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
        .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("authorization")));
  }

  @Test
  void mallPortalPreflightCanUseAuthorizationHeaderForJavaApiCalls() throws Exception {
    // 商城门户是独立部署的第四端(5176);新端上线必须同步 CORS 白名单,否则预检 403。
    mockMvc.perform(options("/api/v1/buyer/mall/products")
            .header("Origin", "http://localhost:5176")
            .header("Access-Control-Request-Method", "GET")
            .header("Access-Control-Request-Headers", "authorization"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5176"))
        .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
  }

  @Test
  void supplierPortalPreflightCanUseAuthorizationHeaderForJavaApiCalls() throws Exception {
    mockMvc.perform(options("/api/v1/buyer/workspace")
            .header("Origin", "http://127.0.0.1:5175")
            .header("Access-Control-Request-Method", "GET")
            .header("Access-Control-Request-Headers", "authorization"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5175"))
        .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
        .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("authorization")));
  }

  @Test
  void vitePreflightCanUsePutForJavaStatusActions() throws Exception {
    mockMvc.perform(options("/api/v1/buyer/payment-block-resolutions/resolution-demo/status")
            .header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "PUT")
            .header("Access-Control-Request-Headers", "authorization,content-type"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
        .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PUT")))
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

    for (String report : List.of("invoices", "reconciliation", "procurement-analytics")) {
      mockMvc.perform(get("/api/v1/buyer/reports/" + report)).andExpect(status().isForbidden());
      mockMvc.perform(get("/api/v1/buyer/reports/" + report)
          .header("Authorization", "Bearer " + supplierToken)).andExpect(status().isForbidden());
    }

    when(purchaseDemandApplicationService.listCurrentTenantDemands(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(purchaseDemandApplicationService.listCurrentTenantDemands(
        org.mockito.ArgumentMatchers.eq("已通过"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("电脑")))
        .thenReturn(List.of(new PurchaseDemandResponse(
            "demand-demo",
            "tenant-acme",
            "采购需求",
            "dept-it",
            "buyer-user-1",
            BigDecimal.valueOf(120000),
            "已通过",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            List.of(),
            java.time.LocalDate.parse("2026-07-15"),
            "常规",
            "采购用途说明",
            null,
            null,
            null)));
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
    mockMvc.perform(get("/api/v1/buyer/demands")
            .queryParam("status", "已通过")
            .queryParam("departmentId", "dept-it")
            .queryParam("keyword", "电脑")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].title").value("采购需求"));

    when(rfqApplicationService.listCurrentTenantRfqs(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(rfqApplicationService.listCurrentTenantRfqs(
        org.mockito.ArgumentMatchers.eq("报价中"),
        org.mockito.ArgumentMatchers.eq("电脑")))
        .thenReturn(List.of(new RfqResponse(
            "rfq-demo",
            "tenant-acme",
            "办公电脑 RFQ",
            "报价中",
            OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
            "buyer-user-1",
            null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            List.of("demand-demo"),
            List.of("ent-supplier-sunrise"))));
    mockMvc.perform(get("/api/v1/buyer/rfqs")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/buyer/rfqs")
            .queryParam("status", "报价中")
            .queryParam("keyword", "电脑")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].title").value("办公电脑 RFQ"));
  }

  @Test
  void buyerCanManageProcessDefinitionsButSupplierCannot() throws Exception {
    String supplierToken = loginAndExtractToken("""
        {"account": "supplier", "password": "demo123456", "scope": "SUPPLIER", "supplierId": "ent-supplier-sunrise"}
        """);
    String buyerToken = loginAndExtractToken("""
        {"account": "buyer", "password": "demo123456", "scope": "BUYER", "tenantId": "tenant-acme"}
        """);

    mockMvc.perform(get("/api/v1/buyer/process-definitions")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(processDefinitionApplicationService.listCurrentTenantProcesses())
        .thenReturn(List.of(new com.procurement.process.api.ProcessDefinitionResponse(
            "proc-1", "采购立项审批", "适用于非生产性物资采购申请", "box", "enabled",
            "{\"fields\":[]}", "{\"steps\":[]}",
            OffsetDateTime.parse("2026-06-29T10:00:00+08:00"))));
    mockMvc.perform(get("/api/v1/buyer/process-definitions")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("采购立项审批"))
        .andExpect(jsonPath("$.data[0].status").value("enabled"));

    when(processDefinitionApplicationService.updateProcess(
        org.mockito.ArgumentMatchers.eq("proc-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new com.procurement.process.api.ProcessDefinitionResponse(
            "proc-1", "采购立项审批", "x", "box", "enabled",
            "{\"fields\":[]}", "{\"steps\":[]}",
            OffsetDateTime.parse("2026-06-29T10:00:00+08:00")));
    mockMvc.perform(put("/api/v1/buyer/process-definitions/proc-1")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name": "采购立项审批", "description": "x", "status": "enabled",
                 "formSchema": "{\\"fields\\":[]}", "flowSchema": "{\\"steps\\":[]}"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("enabled"));

    // 统一审批运行时:供应商越权 403;采购方只可通过 Flowable 待办入口访问。
    mockMvc.perform(get("/api/v1/buyer/workflow/tasks")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(unifiedWorkflowApplicationService.listCurrentUserTasks()).thenReturn(List.of());
    mockMvc.perform(get("/api/v1/buyer/workflow/tasks")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
  }

  @Test
  void buyerCanEvaluateRfqBidsButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/rfqs/rfq-demo/evaluation")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(rfqApplicationService.evaluateRfq("rfq-demo", 70, 30))
        .thenReturn(new com.procurement.sourcing.api.BidEvaluationResponse(
            "rfq-demo", 70, 30, "quote-a", "ent-supplier-sunrise",
            List.of(new com.procurement.sourcing.api.BidEvaluationRowResponse(
                "quote-a", "ent-supplier-sunrise",
                java.math.BigDecimal.valueOf(118000), 7, java.math.BigDecimal.valueOf(13),
                java.math.BigDecimal.valueOf(100), java.math.BigDecimal.valueOf(100),
                java.math.BigDecimal.valueOf(100), 1, true))));

    mockMvc.perform(get("/api/v1/buyer/rfqs/rfq-demo/evaluation")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recommendedQuoteId").value("quote-a"))
        .andExpect(jsonPath("$.data.rows[0].rank").value(1))
        .andExpect(jsonPath("$.data.rows[0].recommended").value(true));
  }

  @Test
  void buyerCanOpenRfqBidsButSupplierCannot() throws Exception {
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

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/open")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"force\": true}"))
        .andExpect(status().isForbidden());

    when(rfqApplicationService.openBids("rfq-demo", true))
        .thenReturn(new RfqResponse(
            "rfq-demo", "tenant-acme", "办公电脑询价", "已开标",
            OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
            "user-buyer-owner", null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-21T09:00:00+08:00"),
            List.of(), List.of()));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/open")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"force\": true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("已开标"));
  }

  @Test
  void buyerCanStartNewRfqRoundButSupplierCannot() throws Exception {
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

    String body = "{\"deadlineAt\": \"2026-07-10T18:00:00+08:00\", \"finalRound\": true}";

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/new-round")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isForbidden());

    when(rfqApplicationService.startNewRound(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq(true),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new RfqResponse(
            "rfq-demo", "tenant-acme", "办公电脑询价", "报价中",
            OffsetDateTime.parse("2026-07-10T18:00:00+08:00"),
            "user-buyer-owner", null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-21T09:00:00+08:00"),
            List.of(), List.of(), List.of(), "", "", "最低价", null, 2, true, "询价", null, null, null, null, null, java.util.List.of(), null, null, null, null, null, null, null, null, null, java.util.List.of()));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/new-round")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("报价中"))
        .andExpect(jsonPath("$.data.currentRound").value(2))
        .andExpect(jsonPath("$.data.finalRound").value(true));
  }

  @Test
  void buyerCanAbortRfqButSupplierCannot() throws Exception {
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

    String body = "{\"kind\": \"流标\", \"reason\": \"不足法定家数\"}";

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/abort")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isForbidden());

    when(rfqApplicationService.abortRfq(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.eq("流标"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new RfqResponse(
            "rfq-demo", "tenant-acme", "办公电脑询价", "已流标",
            OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
            "user-buyer-owner", null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-21T09:00:00+08:00"),
            List.of(), List.of(), List.of(), "", "", "最低价", null, 1, false, "询价", "不足法定家数", null, null, null, null, java.util.List.of(), null, null, null, null, null, null, null, null, null, java.util.List.of()));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/abort")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("已流标"))
        .andExpect(jsonPath("$.data.closeReason").value("不足法定家数"));
  }

  @Test
  void buyerAndSupplierCanUseRfqClarificationsWithinTheirScope() throws Exception {
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

    RfqClarificationResponse asked = new RfqClarificationResponse(
        "clar-1", "rfq-demo", "ent-supplier-sunrise", "是否接受分批交货?",
        null, false, false,
        OffsetDateTime.parse("2026-06-18T10:00:00+08:00"), null);

    // 供应商提问:采购方禁止走供应商提问端点。
    mockMvc.perform(post("/api/v1/supplier/rfqs/rfq-demo/clarifications")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"question\": \"是否接受分批交货?\"}"))
        .andExpect(status().isForbidden());

    when(rfqClarificationApplicationService.ask(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.any(AskClarificationRequest.class)))
        .thenReturn(asked);

    mockMvc.perform(post("/api/v1/supplier/rfqs/rfq-demo/clarifications")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"question\": \"是否接受分批交货?\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.question").value("是否接受分批交货?"));

    // 采购方答复:供应商禁止走采购方答复端点。
    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/clarifications/clar-1/answer")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"answer\": \"接受分批\", \"published\": true}"))
        .andExpect(status().isForbidden());

    when(rfqClarificationApplicationService.answer(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.eq("clar-1"),
        org.mockito.ArgumentMatchers.any(AnswerClarificationRequest.class)))
        .thenReturn(new RfqClarificationResponse(
            "clar-1", "rfq-demo", "ent-supplier-sunrise", "是否接受分批交货?",
            "接受分批", true, true,
            OffsetDateTime.parse("2026-06-18T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-18T15:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/rfqs/rfq-demo/clarifications/clar-1/answer")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"answer\": \"接受分批\", \"published\": true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.answered").value(true))
        .andExpect(jsonPath("$.data.published").value(true));
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
            "定标审批中",
            90,
            "owner-1",
            "采购负责人",
            BigDecimal.valueOf(98000),
            "ent-supplier-sunrise",
            null,
            null,
            "待审批",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
            null),
        new PendingApprovalTaskResponse(
            "approval-demand",
            "tenant-acme",
            "purchase_demand",
            "demand-demo",
            null,
            "采购 20 台电脑",
            "审批中",
            70,
            "requester-1",
            "需求申请人",
            BigDecimal.valueOf(120000),
            null,
            null,
            null,
            "待审批",
            OffsetDateTime.parse("2026-06-15T11:00:00+08:00"),
            null)));

    mockMvc.perform(get("/api/v1/buyer/approvals/pending")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].bizType").value("rfq_award"))
        .andExpect(jsonPath("$.data[0].parentBizId").value("rfq-demo"))
        .andExpect(jsonPath("$.data[0].summaryTitle").value("办公电脑询价"))
        .andExpect(jsonPath("$.data[0].businessStatus").value("定标审批中"))
        .andExpect(jsonPath("$.data[0].priority").value(90))
        .andExpect(jsonPath("$.data[0].submittedByName").value("采购负责人"))
        .andExpect(jsonPath("$.data[0].amount").value(98000))
        .andExpect(jsonPath("$.data[0].status").value("待审批"))
        .andExpect(jsonPath("$.data[1].bizType").value("purchase_demand"))
        .andExpect(jsonPath("$.data[1].summaryTitle").value("采购 20 台电脑"))
        .andExpect(jsonPath("$.data[1].businessStatus").value("审批中"))
        .andExpect(jsonPath("$.data[1].priority").value(70))
        .andExpect(jsonPath("$.data[1].submittedByName").value("需求申请人"));

    mockMvc.perform(get("/api/v1/buyer/approvals/recent")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(approvalInboxApplicationService.listRecentReviewed()).thenReturn(List.of(
        new PendingApprovalTaskResponse(
            "approval-reviewed",
            "tenant-acme",
            "purchase_demand",
            "demand-demo",
            null,
            "采购 20 台电脑",
            "已通过",
            70,
            "requester-1",
            "需求申请人",
            BigDecimal.valueOf(120000),
            null,
            null,
            "buyer-user",
            "已通过",
            OffsetDateTime.parse("2026-06-15T11:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T13:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/approvals/recent")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("approval-reviewed"))
        .andExpect(jsonPath("$.data[0].status").value("已通过"))
        .andExpect(jsonPath("$.data[0].actedAt").value("2026-06-15T13:00:00+08:00"));

    mockMvc.perform(get("/api/v1/buyer/approvals/templates")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(approvalTemplateApplicationService.listTemplates()).thenReturn(List.of(new ApprovalTemplateResponse(
        "TPL_PURCHASE_DEMAND",
        "purchase_demand",
        "需求审批",
        "role-buyer-owner",
        "active")));

    mockMvc.perform(get("/api/v1/buyer/approvals/templates")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].templateCode").value("TPL_PURCHASE_DEMAND"))
        .andExpect(jsonPath("$.data[0].defaultApproverRoleId").value("role-buyer-owner"));

    mockMvc.perform(post("/api/v1/buyer/approvals/templates/TPL_PURCHASE_DEMAND/config")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "defaultApproverRoleId": "role-buyer-finance",
                  "status": "inactive"
                }
                """))
        .andExpect(status().isForbidden());

    when(approvalTemplateApplicationService.updateTemplate(
        org.mockito.ArgumentMatchers.eq("TPL_PURCHASE_DEMAND"),
        org.mockito.ArgumentMatchers.any())).thenReturn(new ApprovalTemplateResponse(
            "TPL_PURCHASE_DEMAND",
            "purchase_demand",
            "需求审批",
            "role-buyer-finance",
            "inactive"));

    mockMvc.perform(post("/api/v1/buyer/approvals/templates/TPL_PURCHASE_DEMAND/config")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "defaultApproverRoleId": "role-buyer-finance",
                  "status": "inactive"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.templateCode").value("TPL_PURCHASE_DEMAND"))
        .andExpect(jsonPath("$.data.defaultApproverRoleId").value("role-buyer-finance"))
        .andExpect(jsonPath("$.data.status").value("inactive"));
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

    when(auditLogApplicationService.listCurrentTenantAuditLogs(50, "", "", "", "")).thenReturn(List.of(
        new AuditLogResponse(
            "audit-demo",
            "tenant-acme",
            "buyer-user",
            "purchase_order.created",
            "purchase_order",
            "po-demo",
            null,
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/audit-logs")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].tenantId").value("tenant-acme"))
        .andExpect(jsonPath("$.data[0].action").value("purchase_order.created"));
  }

  @Test
  void buyerCanListContractTargetAuditLogsButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/audit-logs/target")
            .param("targetType", "contract")
            .param("targetId", "contract-demo")
            .param("actions", "contract_approval.submitted,contract_fulfillment_event.created")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(auditLogApplicationService.listCurrentTenantTargetActions(
        "contract",
        "contract-demo",
        List.of("contract_approval.submitted", "contract_fulfillment_event.created"),
        50)).thenReturn(List.of(
            new AuditLogResponse(
                "audit-contract-demo",
                "tenant-acme",
                "buyer-user",
                "contract_fulfillment_event.created",
                "contract",
                "contract-demo",
                null,
                OffsetDateTime.parse("2026-06-21T12:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/audit-logs/target")
            .param("targetType", "contract")
            .param("targetId", "contract-demo")
            .param("actions", "contract_approval.submitted,contract_fulfillment_event.created")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].targetType").value("contract"))
        .andExpect(jsonPath("$.data[0].targetId").value("contract-demo"))
        .andExpect(jsonPath("$.data[0].action").value("contract_fulfillment_event.created"));
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
        new BuyerTodoSummaryResponse(0, 0, 0, 0),
        List.of(),
        List.of(),
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
        .andExpect(jsonPath("$.data.todoSummary.pendingApprovalCount").value(0))
        .andExpect(jsonPath("$.data.suppliers").isArray())
        .andExpect(jsonPath("$.data.materials").isArray())
        .andExpect(jsonPath("$.data.users").isArray())
        .andExpect(jsonPath("$.data.demands").isArray())
        .andExpect(jsonPath("$.data.rfqs").isArray())
        .andExpect(jsonPath("$.data.orders").isArray())
        .andExpect(jsonPath("$.data.invoices").isArray())
        .andExpect(jsonPath("$.data.pendingApprovals").isArray())
        .andExpect(jsonPath("$.data.recentApprovals").isArray())
        .andExpect(jsonPath("$.data.notifications").isArray())
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

    // 编辑部门:供应商越权 403;采购方 200,透出负责人/成员数等组织架构字段。
    mockMvc.perform(put("/api/v1/buyer/departments/dept-it")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name": "信息化部", "description": "负责信息系统建设与运维"}
                """))
        .andExpect(status().isForbidden());

    when(departmentApplicationService.updateDepartment(
        org.mockito.ArgumentMatchers.eq("dept-it"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new DepartmentResponse(
            "dept-it", "tenant-acme", "信息化部", "dept-hq", "active",
            "负责信息系统建设与运维", "user-buyer-zhang", "张申请", 1,
            java.time.LocalDate.parse("2017-06-15")));

    mockMvc.perform(put("/api/v1/buyer/departments/dept-it")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name": "信息化部", "description": "负责信息系统建设与运维"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.managerName").value("张申请"))
        .andExpect(jsonPath("$.data.memberCount").value(1));
  }

  @Test
  void buyerCanManageRolePermissionsButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/roles/permission-catalog")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.permissionCatalog()).thenReturn(List.of(
        new PermissionPointResponse("buyer:role:manage", "管理角色与权限", "管理"),
        new PermissionPointResponse("buyer:report:export", "导出报表", "报表")));

    mockMvc.perform(get("/api/v1/buyer/roles/permission-catalog")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].point").value("buyer:role:manage"))
        .andExpect(jsonPath("$.data[1].label").value("导出报表"));

    mockMvc.perform(post("/api/v1/buyer/roles/role-fin/permissions")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"permissions": ["buyer:report:export"]}
                """))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.updateRolePermissions(
        org.mockito.ArgumentMatchers.eq("role-fin"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new BuyerRoleResponse(
            "role-fin", "tenant-acme", "财务", List.of("buyer:report:export"), "all"));

    mockMvc.perform(post("/api/v1/buyer/roles/role-fin/permissions")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"permissions": ["buyer:report:export"]}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("role-fin"))
        .andExpect(jsonPath("$.data.permissions[0]").value("buyer:report:export"));

    // 有效权限点端点:供应商越权 403;采购方返回展平后的权限点(供前端门禁)。
    mockMvc.perform(get("/api/v1/buyer/roles/my-permissions")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.myPermissions())
        .thenReturn(new MyPermissionsResponse(List.of("buyer:demand:read", "buyer:demand:create")));

    mockMvc.perform(get("/api/v1/buyer/roles/my-permissions")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.permissions[0]").value("buyer:demand:read"));

    // 数据范围(行级权限)端点:供应商越权 403;采购方 200,透出 dataScope。
    mockMvc.perform(post("/api/v1/buyer/roles/role-req/data-scope")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"dataScope": "department"}
                """))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.updateRoleDataScope(
        org.mockito.ArgumentMatchers.eq("role-req"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new BuyerRoleResponse(
            "role-req", "tenant-acme", "申请员", List.of("buyer:demand:read"), "department"));

    mockMvc.perform(post("/api/v1/buyer/roles/role-req/data-scope")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"dataScope": "department"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.dataScope").value("department"));
  }

  @Test
  void buyerCanManageSupplierInvitationsButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/supplier-invitations")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(supplierInvitationApplicationService.listInvitations()).thenReturn(List.of(
        new SupplierInvitationResponse(
            "inv-demo",
            "ent-supplier-newapply",
            "远景智能装备有限公司",
            "zhang@yuanjing.com",
            "智能制造",
            "邀请补资料",
            "待回复",
            true,
            OffsetDateTime.parse("2026-06-20T10:00:00+08:00"),
            null)));

    mockMvc.perform(get("/api/v1/buyer/supplier-invitations")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].supplierName").value("远景智能装备有限公司"))
        .andExpect(jsonPath("$.data[0].status").value("待回复"))
        .andExpect(jsonPath("$.data[0].linkedToKnownSupplier").value(true));

    mockMvc.perform(post("/api/v1/buyer/supplier-invitations")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"supplierName": "蓝海办公"}
                """))
        .andExpect(status().isForbidden());

    when(supplierInvitationApplicationService.respond(
        org.mockito.ArgumentMatchers.eq("inv-demo"),
        org.mockito.ArgumentMatchers.any())).thenReturn(new SupplierInvitationResponse(
            "inv-demo",
            "ent-supplier-newapply",
            "远景智能装备有限公司",
            "zhang@yuanjing.com",
            "智能制造",
            "邀请补资料",
            "已接受",
            true,
            OffsetDateTime.parse("2026-06-20T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-21T10:00:00+08:00")));

    mockMvc.perform(post("/api/v1/buyer/supplier-invitations/inv-demo/respond")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"action": "accept"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("已接受"))
        .andExpect(jsonPath("$.data.respondedAt").value("2026-06-21T10:00:00+08:00"));
  }

  @Test
  void buyerCanDiscoverPlatformSuppliersButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/suppliers/discover")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(supplierDiscoveryApplicationService.discover(org.mockito.ArgumentMatchers.eq("智能")))
        .thenReturn(List.of(new DiscoverableSupplierResponse(
            "ent-supplier-newapply",
            "远景智能装备有限公司",
            "智能制造",
            "91310000MA1KNEWAPP",
            "pending",
            "submitted")));

    mockMvc.perform(get("/api/v1/buyer/suppliers/discover")
            .queryParam("keyword", "智能")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].supplierId").value("ent-supplier-newapply"))
        .andExpect(jsonPath("$.data[0].name").value("远景智能装备有限公司"))
        .andExpect(jsonPath("$.data[0].industry").value("智能制造"))
        .andExpect(jsonPath("$.data[0].profileStatus").value("submitted"));
  }

  @Test
  void buyerCanListAndUpsertDepartmentBudgetsButSupplierCannot() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/budgets")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(budgetApplicationService.listBudgets()).thenReturn(List.of(
        new DepartmentBudgetResponse(
            "budget-it-2026",
            "dept-it",
            "信息化部",
            "2026",
            BigDecimal.valueOf(480000),
            BigDecimal.valueOf(458000),
            BigDecimal.valueOf(36000),
            BigDecimal.valueOf(-14000),
            103,
            true, new java.math.BigDecimal("0"))));

    mockMvc.perform(get("/api/v1/buyer/budgets")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].departmentId").value("dept-it"))
        .andExpect(jsonPath("$.data[0].occupancyPercent").value(103))
        .andExpect(jsonPath("$.data[0].overBudget").value(true));

    mockMvc.perform(post("/api/v1/buyer/budgets")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "departmentId": "dept-finance",
                  "period": "2026",
                  "totalAmount": 200000
                }
                """))
        .andExpect(status().isForbidden());

    when(budgetApplicationService.upsertBudget(org.mockito.ArgumentMatchers.any())).thenReturn(
        new DepartmentBudgetResponse(
            "budget-fin-2026",
            "dept-finance",
            "财务部",
            "2026",
            BigDecimal.valueOf(200000),
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.valueOf(200000),
            0,
            false, new java.math.BigDecimal("0")));

    mockMvc.perform(post("/api/v1/buyer/budgets")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "departmentId": "dept-finance",
                  "period": "2026",
                  "totalAmount": 200000
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.departmentId").value("dept-finance"))
        .andExpect(jsonPath("$.data.remaining").value(200000))
        .andExpect(jsonPath("$.data.overBudget").value(false));
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
  void authenticatedUsersCanReadSharedDictionaries() throws Exception {
    mockMvc.perform(get("/api/v1/dictionaries")
            .param("type", "payment_status"))
        .andExpect(status().isForbidden());

    String buyerToken = loginAndExtractToken("""
        {
          "account": "buyer",
          "password": "demo123456",
          "scope": "BUYER",
          "tenantId": "tenant-acme"
        }
        """);

    when(dictionaryApplicationService.listByType("payment_status")).thenReturn(List.of(
        new DictionaryEntryResponse("payment_status", "pending", "待付款", 10),
        new DictionaryEntryResponse("payment_status", "paid", "已付款", 20)));

    mockMvc.perform(get("/api/v1/dictionaries")
            .param("type", "payment_status")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].code").value("pending"))
        .andExpect(jsonPath("$.data[1].label").value("已付款"));
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
    mockMvc.perform(post("/api/v1/supplier/profile")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "晨光科技集团",
                  "industry": "办公设备与企业服务",
                  "creditCode": "91310000MA1K2026X8",
                  "legalPerson": "李小明"
                }
                """))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/supplier/qualifications")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/supplier/qualifications/qual-demo/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/supplier/users")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/supplier/users/user-supplier-finance/password")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "newPassword": "new-password"
                }
                """))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/supplier/users/user-supplier-finance/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
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
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
            List.of()));
    when(supplierProfileApplicationService.getCurrentSupplierProfile())
        .thenReturn(new SupplierProfileResponse(
            "ent-supplier-sunrise",
            "晨光科技供应商",
            "supplier",
            "办公设备",
            true,
            "91310000MA1K2026X1",
            "王小明",
            "approved",
            "published",
            List.of("Acme 采购公司")));
    when(supplierProfileApplicationService.updateCurrentSupplierProfile(
        org.mockito.ArgumentMatchers.any(UpdateSupplierProfileRequest.class)))
        .thenReturn(new SupplierProfileResponse(
            "ent-supplier-sunrise",
            "晨光科技集团",
            "supplier",
            "办公设备与企业服务",
            true,
            "91310000MA1K2026X8",
            "李小明",
            "approved",
            "published",
            List.of("Acme 采购公司")));
    when(supplierQualificationApplicationService.listCurrentSupplierQualifications(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(new SupplierQualificationResponse(
            "qual-demo",
            "ent-supplier-sunrise",
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "license.pdf",
            "suppliers/ent-supplier-sunrise/license.pdf",
            "active",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            "有效",
            365L)));
    when(supplierQualificationApplicationService.listCurrentSupplierQualifications(
        org.mockito.ArgumentMatchers.eq("inactive"),
        org.mockito.ArgumentMatchers.eq("营业")))
        .thenReturn(List.of(new SupplierQualificationResponse(
            "qual-demo",
            "ent-supplier-sunrise",
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "license.pdf",
            "suppliers/ent-supplier-sunrise/license.pdf",
            "inactive",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            "有效",
            365L)));
    when(supplierQualificationApplicationService.createCurrentSupplierQualification(
        org.mockito.ArgumentMatchers.any(CreateSupplierQualificationRequest.class)))
        .thenReturn(new SupplierQualificationResponse(
            "qual-demo",
            "ent-supplier-sunrise",
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "license.pdf",
            "suppliers/ent-supplier-sunrise/license.pdf",
            "active",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            "有效",
            365L));
    when(supplierQualificationApplicationService.changeQualificationStatus(
        org.mockito.ArgumentMatchers.eq("qual-demo"),
        org.mockito.ArgumentMatchers.any(ChangeSupplierQualificationStatusRequest.class)))
        .thenReturn(new SupplierQualificationResponse(
            "qual-demo",
            "ent-supplier-sunrise",
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "license.pdf",
            "suppliers/ent-supplier-sunrise/license.pdf",
            "inactive",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            "有效",
            365L));
    when(supplierUserApplicationService.listCurrentSupplierUsers(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(new SupplierUserResponse(
            "user-supplier-finance",
            "ent-supplier-sunrise",
            "供应商财务",
            "13800009999",
            "supplier.finance@example.com",
            "active",
            "role-supplier-sales")));
    when(supplierUserApplicationService.listCurrentSupplierUsers(
        org.mockito.ArgumentMatchers.eq("active"),
        org.mockito.ArgumentMatchers.eq("财务")))
        .thenReturn(List.of(new SupplierUserResponse(
            "user-supplier-finance",
            "ent-supplier-sunrise",
            "供应商财务",
            "13800009999",
            "supplier.finance@example.com",
            "active",
            "role-supplier-sales")));
    when(supplierUserApplicationService.createCurrentSupplierUser(
        org.mockito.ArgumentMatchers.any(CreateSupplierUserRequest.class)))
        .thenReturn(new SupplierUserResponse(
            "user-supplier-finance",
            "ent-supplier-sunrise",
            "供应商财务",
            "13800009999",
            "supplier.finance@example.com",
            "active",
            "role-supplier-sales"));
    when(supplierUserApplicationService.resetUserPassword(
        org.mockito.ArgumentMatchers.eq("user-supplier-finance"),
        org.mockito.ArgumentMatchers.any(ResetSupplierUserPasswordRequest.class)))
        .thenReturn(new SupplierUserResponse(
            "user-supplier-finance",
            "ent-supplier-sunrise",
            "供应商财务",
            "13800009999",
            "supplier.finance@example.com",
            "active",
            "role-supplier-sales"));
    when(supplierUserApplicationService.changeUserStatus(
        org.mockito.ArgumentMatchers.eq("user-supplier-finance"),
        org.mockito.ArgumentMatchers.any(ChangeSupplierUserStatusRequest.class)))
        .thenReturn(new SupplierUserResponse(
            "user-supplier-finance",
            "ent-supplier-sunrise",
            "供应商财务",
            "13800009999",
            "supplier.finance@example.com",
            "inactive",
            "role-supplier-sales"));
    when(quoteApplicationService.listSupplierRfqs(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(quoteApplicationService.listSupplierRfqs(
        org.mockito.ArgumentMatchers.eq("报价中"),
        org.mockito.ArgumentMatchers.eq("电脑")))
        .thenReturn(List.of(new RfqResponse(
            "rfq-demo",
            "tenant-acme",
            "办公电脑 RFQ",
            "报价中",
            OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
            "buyer-user-1",
            null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
            List.of("demand-demo"),
            List.of("ent-supplier-sunrise"))));
    when(quoteApplicationService.listSupplierQuotes(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(quoteApplicationService.listSupplierQuotes(
        org.mockito.ArgumentMatchers.eq("rfq-demo"),
        org.mockito.ArgumentMatchers.eq("已提交")))
        .thenReturn(List.of(new QuoteResponse(
            "quote-demo",
            "tenant-acme",
            "rfq-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            BigDecimal.valueOf(13),
            7,
            "已提交",
            OffsetDateTime.parse("2026-06-15T13:00:00+08:00"),
            List.of())));
    when(quoteApplicationService.update(
        org.mockito.ArgumentMatchers.eq("quote-demo"),
        org.mockito.ArgumentMatchers.any(UpdateQuoteRequest.class)))
        .thenReturn(new QuoteResponse(
            "quote-demo",
            "tenant-acme",
            "rfq-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(97000),
            BigDecimal.valueOf(13),
            6,
            "已提交",
            OffsetDateTime.parse("2026-06-15T13:00:00+08:00"),
            List.of()));
    when(purchaseOrderApplicationService.listCurrentSupplierOrders(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(purchaseOrderApplicationService.listCurrentSupplierOrders(
        org.mockito.ArgumentMatchers.eq("待发货"),
        org.mockito.ArgumentMatchers.eq("rfq-demo")))
        .thenReturn(List.of(new PurchaseOrderResponse(
            "po-demo",
            "tenant-acme",
            "rfq-demo",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(98000),
            "待发货",
            LocalDate.parse("2026-07-10"),
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T12:05:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款",
            java.util.List.of(), null)));
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
            OffsetDateTime.parse("2026-06-15T12:05:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款",
            java.util.List.of(), null));
    when(invoiceApplicationService.listCurrentSupplierInvoices(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of());
    when(invoiceApplicationService.listCurrentSupplierInvoices(
        org.mockito.ArgumentMatchers.eq("待付款"),
        org.mockito.ArgumentMatchers.eq("po-demo")))
        .thenReturn(List.of(new InvoiceResponse(
            "invoice-demo",
            "tenant-acme",
            "ent-supplier-sunrise",
            "po-demo",
            BigDecimal.valueOf(98000),
            "INV-20260615-001",
            "待付款",
            null,
            LocalDate.parse("2026-07-15"),
            false,
            0L,
            BigDecimal.valueOf(98000),
            BigDecimal.ZERO,
            "已收货",
            "三单一致",
            "REC-invoice-demo",
            "待付款",
            "登记付款",
            OffsetDateTime.parse("2026-06-15T14:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T14:00:00+08:00"), "", null, new java.math.BigDecimal("13.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, 500, 495, 99, "存在不合格",
            java.util.List.of())));
    when(invoiceApplicationService.listCurrentSupplierReconciliations(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(invoiceReconciliationResponse("recon-supplier-all", "invoice-demo", "待付款")));
    when(invoiceApplicationService.listCurrentSupplierReconciliations(
        org.mockito.ArgumentMatchers.eq("待付款"),
        org.mockito.ArgumentMatchers.eq("po-demo")))
        .thenReturn(List.of(invoiceReconciliationResponse("recon-supplier-demo", "invoice-demo", "待付款")));
    when(invoiceApplicationService.listCurrentSupplierPaymentAuditLogs("invoice-demo"))
        .thenReturn(List.of(new AuditLogResponse(
            "audit-supplier-payment-demo",
            "tenant-acme",
            "user-buyer-owner",
            "invoice.paid",
            "invoice",
            "invoice-demo",
            null,
            OffsetDateTime.parse("2026-06-15T15:00:00+08:00"))));
    when(invoiceApplicationService.updateReceivable(
        org.mockito.ArgumentMatchers.eq("invoice-demo"),
        org.mockito.ArgumentMatchers.any(UpdateSupplierReceivableRequest.class)))
        .thenReturn(new InvoiceResponse(
            "invoice-demo",
            "tenant-acme",
            "ent-supplier-sunrise",
            "po-demo",
            BigDecimal.valueOf(98000),
            "INV-20260615-001",
            "部分付款",
            "已与采购方确认 6 月底付尾款",
            LocalDate.parse("2026-07-15"),
            false,
            0L,
            BigDecimal.valueOf(98000),
            BigDecimal.ZERO,
            "已收货",
            "三单一致",
            "REC-invoice-demo",
            "待付款",
            "登记付款",
            OffsetDateTime.parse("2026-06-15T14:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T14:00:00+08:00"), "", null, new java.math.BigDecimal("13.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, 500, 495, 99, "存在不合格",
            java.util.List.of()));

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
    mockMvc.perform(post("/api/v1/supplier/profile")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "晨光科技集团",
                  "industry": "办公设备与企业服务",
                  "creditCode": "91310000MA1K2026X8",
                  "legalPerson": "李小明"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.name").value("晨光科技集团"))
        .andExpect(jsonPath("$.data.creditCode").value("91310000MA1K2026X8"));
    mockMvc.perform(get("/api/v1/supplier/qualifications")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].qualificationType").value("营业执照"));
    mockMvc.perform(get("/api/v1/supplier/qualifications")
            .queryParam("status", "inactive")
            .queryParam("keyword", "营业")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].status").value("inactive"));
    mockMvc.perform(post("/api/v1/supplier/qualifications")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "qualificationType": "营业执照",
                  "certificateNo": "Q-2026-001",
                  "expiresAt": "%s",
                  "fileName": "license.pdf",
                  "storageKey": "suppliers/ent-supplier-sunrise/license.pdf"
                }
                """.formatted(java.time.LocalDate.now().plusYears(1))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.supplierId").value("ent-supplier-sunrise"));
    mockMvc.perform(post("/api/v1/supplier/qualifications/qual-demo/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("inactive"));
    mockMvc.perform(get("/api/v1/supplier/users")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].email").value("supplier.finance@example.com"));
    mockMvc.perform(get("/api/v1/supplier/users")
            .queryParam("status", "active")
            .queryParam("keyword", "财务")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("供应商财务"));
    mockMvc.perform(post("/api/v1/supplier/users")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "供应商财务",
                  "mobile": "13800009999",
                  "email": "supplier.finance@example.com",
                  "status": "active",
                  "initialPassword": "initial-password"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.supplierId").value("ent-supplier-sunrise"));
    mockMvc.perform(post("/api/v1/supplier/users/user-supplier-finance/password")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "newPassword": "new-password"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("user-supplier-finance"));
    mockMvc.perform(post("/api/v1/supplier/users/user-supplier-finance/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("inactive"));
    mockMvc.perform(get("/api/v1/supplier/rfqs")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/rfqs")
            .queryParam("status", "报价中")
            .queryParam("keyword", "电脑")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].title").value("办公电脑 RFQ"));
    mockMvc.perform(get("/api/v1/supplier/quotes")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/quotes")
            .queryParam("rfqId", "rfq-demo")
            .queryParam("status", "已提交")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("quote-demo"));
    mockMvc.perform(put("/api/v1/supplier/quotes/quote-demo")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "amount": 97000,
                  "taxRate": 13,
                  "deliveryDays": 6
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.amount").value(97000))
        .andExpect(jsonPath("$.data.deliveryDays").value(6));
    mockMvc.perform(put("/api/v1/supplier/quotes/quote-demo")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "amount": 97000,
                  "taxRate": 13,
                  "deliveryDays": 6
                }
                """))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/supplier/orders")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/orders")
            .queryParam("status", "待发货")
            .queryParam("rfqId", "rfq-demo")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("po-demo"));
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/confirm")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("待发货"));
    mockMvc.perform(get("/api/v1/supplier/invoices")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
    mockMvc.perform(get("/api/v1/supplier/invoices")
            .queryParam("paymentStatus", "待付款")
            .queryParam("orderId", "po-demo")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("invoice-demo"));
    mockMvc.perform(get("/api/v1/supplier/invoice-reconciliations")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("recon-supplier-all"));
    mockMvc.perform(get("/api/v1/supplier/invoice-reconciliations")
            .queryParam("stage", "待付款")
            .queryParam("orderId", "po-demo")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("recon-supplier-demo"))
        .andExpect(jsonPath("$.data[0].invoiceId").value("invoice-demo"))
        .andExpect(jsonPath("$.data[0].stage").value("待付款"));
    mockMvc.perform(get("/api/v1/supplier/invoice-reconciliations")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/supplier/invoices/invoice-demo/payment-audit-logs")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("audit-supplier-payment-demo"))
        .andExpect(jsonPath("$.data[0].action").value("invoice.paid"));
    mockMvc.perform(put("/api/v1/supplier/invoices/invoice-demo/reconciliation")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "reconciliationNote": "已与采购方确认 6 月底付尾款"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.reconciliationNote").value("已与采购方确认 6 月底付尾款"));

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
        new PlatformOperationSummaryResponse(2, 1, 3, 1),
        List.of(new TenantResponse("tenant-acme", "Acme 采购公司", "MVP", "active", List.of("rfq"), 100)),
        List.of(new EnterpriseReviewResponse(
            "ent-supplier-sunrise",
            "晨光科技供应商",
            "supplier",
            false,
            "pending",
            null,
            false,
            false, null, null, null, null, null, null))));

    mockMvc.perform(get("/api/v1/platform/workspace")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.overview.scope").value("platform"))
        .andExpect(jsonPath("$.data.operationSummary.activeTenantCount").value(1))
        .andExpect(jsonPath("$.data.tenants[0].id").value("tenant-acme"))
        .andExpect(jsonPath("$.data.enterpriseReviews[0].reviewStatus").value("pending"));
  }

  @Test
  void platformCanPublishAnnouncementsButBuyerCannot() throws Exception {
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

    mockMvc.perform(post("/api/v1/platform/announcements")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "系统维护通知",
                  "content": "6 月 20 日 22:00-23:00 进行例行维护。",
                  "audience": "all"
                }
                """))
        .andExpect(status().isForbidden());

    when(platformAnnouncementApplicationService.publish(
        org.mockito.ArgumentMatchers.any(CreatePlatformAnnouncementRequest.class)))
        .thenReturn(new PlatformAnnouncementResponse(
            "announcement-demo",
            "系统维护通知",
            "6 月 20 日 22:00-23:00 进行例行维护。",
            "all",
            "active",
            "user-platform-admin",
            OffsetDateTime.parse("2026-06-16T10:00:00+08:00")));
    when(platformAnnouncementApplicationService.listForManagement()).thenReturn(List.of(new PlatformAnnouncementResponse(
        "announcement-demo",
        "系统维护通知",
        "6 月 20 日 22:00-23:00 进行例行维护。",
        "all",
        "active",
        "user-platform-admin",
        OffsetDateTime.parse("2026-06-16T10:00:00+08:00"))));

    mockMvc.perform(post("/api/v1/platform/announcements")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "系统维护通知",
                  "content": "6 月 20 日 22:00-23:00 进行例行维护。",
                  "audience": "all"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("announcement-demo"))
        .andExpect(jsonPath("$.data.audience").value("all"));

    mockMvc.perform(get("/api/v1/platform/announcements")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].title").value("系统维护通知"));
  }

  @Test
  void platformCanUpdateAndWithdrawAnnouncementsButBuyerCannot() throws Exception {
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

    mockMvc.perform(put("/api/v1/platform/announcements/announcement-demo")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "系统维护通知更新",
                  "content": "维护窗口已调整。",
                  "audience": "buyer"
                }
                """))
        .andExpect(status().isForbidden());

    when(platformAnnouncementApplicationService.update(
        org.mockito.ArgumentMatchers.eq("announcement-demo"),
        org.mockito.ArgumentMatchers.any(UpdatePlatformAnnouncementRequest.class)))
        .thenReturn(new PlatformAnnouncementResponse(
            "announcement-demo",
            "系统维护通知更新",
            "维护窗口已调整。",
            "buyer",
            "active",
            "user-platform-admin",
            OffsetDateTime.parse("2026-06-16T10:00:00+08:00")));
    when(platformAnnouncementApplicationService.withdraw("announcement-demo"))
        .thenReturn(new PlatformAnnouncementResponse(
            "announcement-demo",
            "系统维护通知更新",
            "维护窗口已调整。",
            "buyer",
            "withdrawn",
            "user-platform-admin",
            OffsetDateTime.parse("2026-06-16T10:00:00+08:00")));

    mockMvc.perform(put("/api/v1/platform/announcements/announcement-demo")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "系统维护通知更新",
                  "content": "维护窗口已调整。",
                  "audience": "buyer"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.title").value("系统维护通知更新"))
        .andExpect(jsonPath("$.data.audience").value("buyer"));

    mockMvc.perform(post("/api/v1/platform/announcements/announcement-demo/withdraw")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("withdrawn"));
  }

  @Test
  void buyerAndSupplierCanReadVisiblePlatformAnnouncements() throws Exception {
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

    mockMvc.perform(get("/api/v1/buyer/announcements")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/supplier/announcements")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(platformAnnouncementApplicationService.listBuyerVisible()).thenReturn(List.of(new PlatformAnnouncementResponse(
        "announcement-buyer",
        "采购方功能更新",
        "询价比价流程新增导出能力。",
        "buyer",
        "active",
        "user-platform-admin",
        OffsetDateTime.parse("2026-06-16T11:00:00+08:00"))));
    when(platformAnnouncementApplicationService.listSupplierVisible()).thenReturn(List.of(new PlatformAnnouncementResponse(
        "announcement-supplier",
        "供应商报价提醒",
        "请及时维护报价联系人。",
        "supplier",
        "active",
        "user-platform-admin",
        OffsetDateTime.parse("2026-06-16T11:30:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/announcements")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].audience").value("buyer"));

    mockMvc.perform(get("/api/v1/supplier/announcements")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].audience").value("supplier"));
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
            "91310000MA1K2026X1",
            "王小明",
            "approved",
            "published",
            List.of("Acme 采购公司")),
        new SupplierTodoSummaryResponse(0, 0, 0, 0),
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        List.of()));

    mockMvc.perform(get("/api/v1/supplier/workspace")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.profile.id").value("ent-supplier-sunrise"))
        .andExpect(jsonPath("$.data.todoSummary.pendingQuoteCount").value(0))
        .andExpect(jsonPath("$.data.opportunities").isArray())
        .andExpect(jsonPath("$.data.quotes").isArray())
        .andExpect(jsonPath("$.data.orders").isArray())
        .andExpect(jsonPath("$.data.invoices").isArray())
        .andExpect(jsonPath("$.data.notifications").isArray());
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

    when(platformTenantApplicationService.getTenant("tenant-acme"))
        .thenReturn(new TenantResponse(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "active",
            List.of("rfq", "order"),
            50));

    mockMvc.perform(get("/api/v1/platform/tenants/tenant-acme")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/platform/tenants/tenant-acme")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("tenant-acme"))
        .andExpect(jsonPath("$.data.plan").value("starter"));

    when(platformTenantApplicationService.createBuyerTenant(
        org.mockito.ArgumentMatchers.any(CreateTenantRequest.class)))
        .thenReturn(new TenantResponse(
            "tenant-demo",
            "示例采购企业",
            "MVP",
            "active",
            List.of("rfq", "order", "finance"),
            50));

    mockMvc.perform(post("/api/v1/platform/tenants")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "tenantId": "tenant-demo",
                  "enterpriseId": "ent-demo-buyer",
                  "name": "示例采购企业",
                  "industry": "综合采购",
                  "plan": "MVP",
                  "userLimit": 50,
                  "enabledFeatures": ["rfq", "order", "finance"],
                  "adminName": "首席采购管理员",
                  "adminMobile": "13900000001",
                  "adminEmail": "owner@demo.example.com",
                  "adminPassword": "owner-password"
                }
                """))
        .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/v1/platform/tenants")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "tenantId": "tenant-demo",
                  "enterpriseId": "ent-demo-buyer",
                  "name": "示例采购企业",
                  "industry": "综合采购",
                  "plan": "MVP",
                  "userLimit": 50,
                  "enabledFeatures": ["rfq", "order", "finance"],
                  "adminName": "首席采购管理员",
                  "adminMobile": "13900000001",
                  "adminEmail": "owner@demo.example.com",
                  "adminPassword": "owner-password"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("tenant-demo"))
        .andExpect(jsonPath("$.data.enabledFeatures[2]").value("finance"));

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

    when(platformTenantApplicationService.updateTenantPlan(
        org.mockito.ArgumentMatchers.eq("tenant-acme"),
        org.mockito.ArgumentMatchers.any(UpdateTenantPlanRequest.class)))
        .thenReturn(new TenantResponse(
            "tenant-acme",
            "Acme 采购公司",
            "pro",
            "active",
            List.of("rfq", "order", "finance"),
            120));

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/plan")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "plan": "pro",
                  "userLimit": 120
                }
                """))
        .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/plan")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "plan": "pro",
                  "userLimit": 120
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.plan").value("pro"))
        .andExpect(jsonPath("$.data.userLimit").value(120));

    when(platformTenantApplicationService.enableTenant("tenant-acme"))
        .thenReturn(new TenantResponse(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "active",
            List.of("rfq", "order", "finance"),
            50));

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/enable")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/enable")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("active"));

    when(platformTenantApplicationService.disableTenant("tenant-acme"))
        .thenReturn(new TenantResponse(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "inactive",
            List.of("rfq", "order", "finance"),
            50));

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/disable")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/v1/platform/tenants/tenant-acme/disable")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("inactive"));

    when(platformEnterpriseApplicationService.listPendingReviews()).thenReturn(List.of(new EnterpriseReviewResponse(
        "ent-supplier-sunrise",
        "晨光供应商",
        "supplier",
        false,
        "pending",
        null,
        false,
        false, null, null, null, null, null, null)));

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
            "approved",
            "资料齐全，准入通过。",
            true,
            true, null, null, null, null, null, null));

    mockMvc.perform(post("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "verified": true,
                  "reviewStatus": "approved",
                  "reviewComment": "资料齐全，准入通过。",
                  "profileConfirmed": true,
                  "riskConfirmed": true
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.verified").value(true))
        .andExpect(jsonPath("$.data.reviewStatus").value("approved"))
        .andExpect(jsonPath("$.data.reviewComment").value("资料齐全，准入通过。"))
        .andExpect(jsonPath("$.data.profileConfirmed").value(true))
        .andExpect(jsonPath("$.data.riskConfirmed").value(true));

    // 多步审核工作流:推进端点 + 时间线端点。采购方越权 403;平台 200。
    mockMvc.perform(post("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise/advance")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"action": "preliminary_pass"}
                """))
        .andExpect(status().isForbidden());

    when(platformEnterpriseApplicationService.advanceReview(
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.any()))
        .thenReturn(new EnterpriseReviewResponse(
            "ent-supplier-sunrise", "晨光供应商", "supplier", false, "preliminary", null, false, false, null, null, null, null, null, null));

    mockMvc.perform(post("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise/advance")
            .header("Authorization", "Bearer " + platformToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"action": "preliminary_pass"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.reviewStatus").value("preliminary"));

    mockMvc.perform(get("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise/events")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    when(platformEnterpriseApplicationService.listReviewEvents("ent-supplier-sunrise"))
        .thenReturn(List.of(new com.procurement.platform.api.EnterpriseReviewEventResponse(
            "erv-1", "preliminary_pass", "pending", "待初审", "preliminary", "初审通过",
            null, "user-platform-admin", java.time.OffsetDateTime.parse("2026-06-29T10:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/platform/enterprise-reviews/ent-supplier-sunrise/events")
            .header("Authorization", "Bearer " + platformToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].action").value("preliminary_pass"))
        .andExpect(jsonPath("$.data[0].toStatusLabel").value("初审通过"));
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
  void supplierNotificationApisListCurrentUserMessagesAndMarkThemRead() throws Exception {
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

    when(notificationApplicationService.listCurrentSupplierUserNotifications(50))
        .thenReturn(List.of(new NotificationResponse(
            "notice-invoice-paid",
            "tenant-acme",
            "user-supplier-owner",
            "发票已付款",
            "采购方已登记付款",
            false,
            null,
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"))));

    mockMvc.perform(get("/api/v1/supplier/notifications")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(get("/api/v1/supplier/notifications")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("notice-invoice-paid"))
        .andExpect(jsonPath("$.data[0].title").value("发票已付款"))
        .andExpect(jsonPath("$.data[0].read").value(false));

    when(notificationApplicationService.markCurrentSupplierUserNotificationRead("notice-invoice-paid"))
        .thenReturn(new NotificationResponse(
            "notice-invoice-paid",
            "tenant-acme",
            "user-supplier-owner",
            "发票已付款",
            "采购方已登记付款",
            true,
            OffsetDateTime.parse("2026-06-15T12:30:00+08:00"),
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00")));

    mockMvc.perform(post("/api/v1/supplier/notifications/notice-invoice-paid/read")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("notice-invoice-paid"))
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

    when(buyerSupplierApplicationService.listCurrentTenantSuppliers(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(new BuyerSupplierResponse(
        "rel-sunrise",
        "tenant-acme",
        "ent-supplier-sunrise",
        "晨光供应商",
        "已准入",
        "A",
        List.of("办公设备"),
        BigDecimal.valueOf(92.50), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001")));

    mockMvc.perform(get("/api/v1/buyer/suppliers")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].supplierName").value("晨光供应商"))
        .andExpect(jsonPath("$.data[0].categories[0]").value("办公设备"));

    when(buyerSupplierApplicationService.listCurrentTenantSuppliers(
        org.mockito.ArgumentMatchers.eq("已准入"),
        org.mockito.ArgumentMatchers.eq("A"),
        org.mockito.ArgumentMatchers.eq("办公设备"),
        org.mockito.ArgumentMatchers.eq("晨光")))
        .thenReturn(List.of(new BuyerSupplierResponse(
            "rel-sunrise",
            "tenant-acme",
            "ent-supplier-sunrise",
            "晨光供应商",
            "已准入",
            "A",
            List.of("办公设备"),
            BigDecimal.valueOf(92.50), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001")));

    mockMvc.perform(get("/api/v1/buyer/suppliers")
            .queryParam("status", "已准入")
            .queryParam("level", "A")
            .queryParam("category", "办公设备")
            .queryParam("keyword", "晨光")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].supplierName").value("晨光供应商"));

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
            BigDecimal.ZERO, "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

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

    mockMvc.perform(get("/api/v1/buyer/suppliers/rel-created/qualifications")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.listRelationQualifications("rel-created"))
        .thenReturn(List.of(new SupplierQualificationResponse(
            "qual-created",
            "ent-supplier-ocean",
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "营业执照.pdf",
            "supplier/qualifications/business-license.pdf",
            "active",
            OffsetDateTime.parse("2026-06-22T10:00:00+08:00"),
            "有效",
            365L)));

    mockMvc.perform(get("/api/v1/buyer/suppliers/rel-created/qualifications")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].qualificationType").value("营业执照"))
        .andExpect(jsonPath("$.data[0].fileName").value("营业执照.pdf"));

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

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "黑名单"
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.changeRelationStatus(
        org.mockito.ArgumentMatchers.eq("rel-created"),
        org.mockito.ArgumentMatchers.any(ChangeBuyerSupplierStatusRequest.class)))
        .thenReturn(new BuyerSupplierResponse(
            "rel-created",
            "tenant-acme",
            "ent-supplier-ocean",
            "远洋供应商",
            "黑名单",
            "B",
            List.of("服务"),
            BigDecimal.ZERO, "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "黑名单"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("黑名单"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/profile")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "level": "S",
                  "categories": ["服务", "办公设备"]
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.changeRelationProfile(
        org.mockito.ArgumentMatchers.eq("rel-created"),
        org.mockito.ArgumentMatchers.any(ChangeBuyerSupplierProfileRequest.class)))
        .thenReturn(new BuyerSupplierResponse(
            "rel-created",
            "tenant-acme",
            "ent-supplier-ocean",
            "远洋供应商",
            "黑名单",
            "S",
            List.of("服务", "办公设备"),
            BigDecimal.ZERO, "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/profile")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "level": "S",
                  "categories": ["服务", "办公设备"]
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.level").value("S"))
        .andExpect(jsonPath("$.data.categories[1]").value("办公设备"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/performance")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "performanceScore": 96.5
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerSupplierApplicationService.changeRelationPerformance(
        org.mockito.ArgumentMatchers.eq("rel-created"),
        org.mockito.ArgumentMatchers.any(ChangeBuyerSupplierPerformanceRequest.class)))
        .thenReturn(new BuyerSupplierResponse(
            "rel-created",
            "tenant-acme",
            "ent-supplier-ocean",
            "远洋供应商",
            "黑名单",
            "S",
            List.of("服务", "办公设备"),
            BigDecimal.valueOf(96.50), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

    mockMvc.perform(post("/api/v1/buyer/suppliers/rel-created/performance")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "performanceScore": 96.5
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.performanceScore").value(96.5));

    when(materialApplicationService.listCurrentTenantMaterials(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(new MaterialResponse(
        "mat-laptop",
        "tenant-acme",
        "IT-LAPTOP",
        "办公电脑",
        "办公设备",
        "台",
        BigDecimal.valueOf(6000), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述")));

    mockMvc.perform(get("/api/v1/buyer/materials")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].code").value("IT-LAPTOP"));

    when(materialApplicationService.listCurrentTenantMaterials(
        org.mockito.ArgumentMatchers.eq("办公设备"),
        org.mockito.ArgumentMatchers.eq("电脑")))
        .thenReturn(List.of(new MaterialResponse(
            "mat-laptop",
            "tenant-acme",
            "IT-LAPTOP",
            "办公电脑",
            "办公设备",
            "台",
            BigDecimal.valueOf(6000), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述")));

    mockMvc.perform(get("/api/v1/buyer/materials")
            .queryParam("category", "办公设备")
            .queryParam("keyword", "电脑")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("办公电脑"));

    when(materialApplicationService.createMaterial(
        org.mockito.ArgumentMatchers.any(CreateMaterialRequest.class)))
        .thenReturn(new MaterialResponse(
            "mat-monitor",
            "tenant-acme",
            "IT-MONITOR",
            "显示器",
            "办公设备",
            "台",
            BigDecimal.valueOf(1200), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述"));

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

    mockMvc.perform(post("/api/v1/buyer/materials/mat-monitor")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "code": "IT-MONITOR-27",
                  "name": "27寸显示器",
                  "category": "办公设备",
                  "unit": "台",
                  "referencePrice": 1500
                }
                """))
        .andExpect(status().isForbidden());

    when(materialApplicationService.updateMaterial(
        org.mockito.ArgumentMatchers.eq("mat-monitor"),
        org.mockito.ArgumentMatchers.any(CreateMaterialRequest.class)))
        .thenReturn(new MaterialResponse(
            "mat-monitor",
            "tenant-acme",
            "IT-MONITOR-27",
            "27寸显示器",
            "办公设备",
            "台",
            BigDecimal.valueOf(1500), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述"));

    mockMvc.perform(post("/api/v1/buyer/materials/mat-monitor")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "code": "IT-MONITOR-27",
                  "name": "27寸显示器",
                  "category": "办公设备",
                  "unit": "台",
                  "referencePrice": 1500
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.code").value("IT-MONITOR-27"))
        .andExpect(jsonPath("$.data.name").value("27寸显示器"));

    when(buyerUserApplicationService.listCurrentTenantUsers(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(new BuyerUserResponse(
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

    when(buyerUserApplicationService.listCurrentTenantUsers(
        org.mockito.ArgumentMatchers.eq("active"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("采购")))
        .thenReturn(List.of(new BuyerUserResponse(
            "user-buyer-owner",
            "tenant-acme",
            "采购负责人",
            "13800000000",
            "buyer@example.com",
            "active",
            "dept-it",
            "role-buyer-owner")));

    mockMvc.perform(get("/api/v1/buyer/users")
            .queryParam("status", "active")
            .queryParam("departmentId", "dept-it")
            .queryParam("keyword", "采购")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("采购负责人"));

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
                  "roleId": "role-buyer-requester",
                  "initialPassword": "requester-password"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("user-buyer-new"))
        .andExpect(jsonPath("$.data.departmentId").value("dept-it"))
        .andExpect(jsonPath("$.data.roleId").value("role-buyer-requester"));

    // 批量导入:供应商越权 403;采购方 200,返回成功/失败明细。
    mockMvc.perform(post("/api/v1/buyer/users/import")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"departmentId": "dept-it", "defaultPassword": "demo123456",
                 "members": [{"name": "王五", "roleName": "采购申请员"}]}
                """))
        .andExpect(status().isForbidden());

    when(buyerUserImportApplicationService.importUsers(org.mockito.ArgumentMatchers.any()))
        .thenReturn(new com.procurement.identity.api.ImportBuyerUsersResponse(
            1, 1, List.of(new com.procurement.identity.api.ImportBuyerUsersResponse.Failure(
                2, "李四", "角色不存在: 不存在角色"))));

    mockMvc.perform(post("/api/v1/buyer/users/import")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"departmentId": "dept-it", "defaultPassword": "demo123456",
                 "members": [{"name": "王五", "roleName": "采购申请员"},
                             {"name": "李四", "roleName": "不存在角色"}]}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.created").value(1))
        .andExpect(jsonPath("$.data.failed").value(1))
        .andExpect(jsonPath("$.data.failures[0].row").value(2));

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

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/password")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "newPassword": "reset-password"
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerUserApplicationService.resetUserPassword(
        org.mockito.ArgumentMatchers.eq("user-buyer-new"),
        org.mockito.ArgumentMatchers.any(ResetBuyerUserPasswordRequest.class)))
        .thenReturn(new BuyerUserResponse(
            "user-buyer-new",
            "tenant-acme",
            "需求申请人",
            "13900000000",
            "requester@example.com",
            "active",
            "dept-it",
            "role-buyer-owner"));

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/password")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "newPassword": "reset-password"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("user-buyer-new"));

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
        .andExpect(status().isForbidden());

    when(buyerUserApplicationService.changeUserStatus(
        org.mockito.ArgumentMatchers.eq("user-buyer-new"),
        org.mockito.ArgumentMatchers.any(ChangeBuyerUserStatusRequest.class)))
        .thenReturn(new BuyerUserResponse(
            "user-buyer-new",
            "tenant-acme",
            "需求申请人",
            "13900000000",
            "requester@example.com",
            "inactive",
            "dept-it",
            "role-buyer-owner"));

    mockMvc.perform(post("/api/v1/buyer/users/user-buyer-new/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "inactive"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("user-buyer-new"))
        .andExpect(jsonPath("$.data.status").value("inactive"));

    mockMvc.perform(get("/api/v1/buyer/roles")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(buyerRoleApplicationService.listCurrentTenantRoles()).thenReturn(List.of(new BuyerRoleResponse(
        "role-buyer-requester",
        "tenant-acme",
        "需求申请人",
        List.of("buyer:demand:create", "buyer:demand:read"), "department")));

    mockMvc.perform(get("/api/v1/buyer/roles")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("role-buyer-requester"))
        .andExpect(jsonPath("$.data[0].permissions[0]").value("buyer:demand:create"))
        .andExpect(jsonPath("$.data[0].dataScope").value("department"));
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
    mockMvc.perform(get("/api/v1/buyer/contracts/contract-demo/amendments")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/contracts/contract-demo/amendments")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"changeType": "金额变更", "newAmount": 130000, "reason": "新增范围"}
                """))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/buyer/contracts/contract-demo/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validContractStatusPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/buyer/contracts/contract-demo/archive-status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validContractArchiveStatusPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/orders/po-demo/receipts")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validReceiptPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/receipts")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/invoices")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/invoice-reconciliations")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/payment-requests")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/payment-batches")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/payment-execution-records")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/payment-requests")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentRequestPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/buyer/payment-requests/payreq-demo/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentRequestStatusPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/buyer/payment-batches/PAY-DEMO/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentBatchStatusPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/variance-handlings")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/variance-handlings")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validVarianceHandlingPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/buyer/variance-handlings/variance-demo/status")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validVarianceHandlingStatusPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/buyer/invoices/invoice-demo/payments")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/buyer/invoices/invoice-demo/payment-audit-logs")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    when(purchaseOrderApplicationService.listCurrentTenantOrders(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(orderResponse("po-demo", "待供应商确认")));
    when(purchaseOrderApplicationService.listCurrentTenantOrders(
        org.mockito.ArgumentMatchers.eq("待供应商确认"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("rfq-demo")))
        .thenReturn(List.of(orderResponse("po-demo", "待供应商确认")));
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
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 100, 98, "外观完好，抽检合格",
            java.util.List.of(), null, null, null));
    when(receiptApplicationService.listCurrentTenantReceipts(
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.eq("user-buyer-owner")))
        .thenReturn(List.of(new ReceiptResponse(
            "receipt-demo",
            "tenant-acme",
            "po-demo",
            "user-buyer-owner",
            "验收通过",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 100, 98, "外观完好，抽检合格",
            java.util.List.of(), null, null, null)));
    when(paymentApplicationService.listCurrentTenantInvoices(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(invoiceResponse("invoice-demo", "待付款")));
    when(paymentApplicationService.listCurrentTenantInvoices(
        org.mockito.ArgumentMatchers.eq("待付款"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("po-demo")))
        .thenReturn(List.of(invoiceResponse("invoice-filtered", "待付款")));
    when(paymentApplicationService.listCurrentTenantReconciliations(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(invoiceReconciliationResponse("recon-all", "invoice-demo", "待付款")));
    when(paymentApplicationService.listCurrentTenantReconciliations(
        org.mockito.ArgumentMatchers.eq("待付款"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("po-demo")))
        .thenReturn(List.of(invoiceReconciliationResponse("recon-demo", "invoice-demo", "待付款")));
    when(financeActionApplicationService.listCurrentTenantPaymentRequests(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(paymentRequestResponse("payreq-demo", "invoice-demo", "付款申请待提交")));
    when(financeActionApplicationService.listCurrentTenantPaymentRequests(
        org.mockito.ArgumentMatchers.eq("付款申请待提交"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.eq("invoice-demo")))
        .thenReturn(List.of(paymentRequestResponse("payreq-filtered", "invoice-demo", "付款申请待提交")));
    when(financeActionApplicationService.listCurrentTenantPaymentBatches(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(paymentBatchResponse("paybatch-demo", "PAY-202606", "待提交审批")));
    when(financeActionApplicationService.listCurrentTenantPaymentBatches(
        org.mockito.ArgumentMatchers.eq("待提交审批"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise")))
        .thenReturn(List.of(paymentBatchResponse("paybatch-filtered", "PAY-202606", "待提交审批")));
    when(financeActionApplicationService.listCurrentTenantPaymentExecutionRecords(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(paymentExecutionRecordResponse("payexec-demo", "PAY-202606", "待登记付款")));
    when(financeActionApplicationService.listCurrentTenantPaymentExecutionRecords(
        org.mockito.ArgumentMatchers.eq("PAY-202606"),
        org.mockito.ArgumentMatchers.eq("待登记付款"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("invoice-demo")))
        .thenReturn(List.of(paymentExecutionRecordResponse("payexec-filtered", "PAY-202606", "待登记付款")));
    when(financeActionApplicationService.createCurrentTenantPaymentRequest(
        org.mockito.ArgumentMatchers.any(CreatePaymentRequestRequest.class)))
        .thenReturn(paymentRequestResponse("payreq-created", "invoice-demo", "付款申请待提交"));
    when(financeActionApplicationService.updateCurrentTenantPaymentRequestStatus(
        org.mockito.ArgumentMatchers.eq("payreq-demo"),
        org.mockito.ArgumentMatchers.any(UpdatePaymentRequestStatusRequest.class)))
        .thenReturn(paymentRequestResponse("payreq-demo", "invoice-demo", "付款申请审批中"));
    when(financeActionApplicationService.updateCurrentTenantPaymentBatchStatus(
        org.mockito.ArgumentMatchers.eq("PAY-DEMO"),
        org.mockito.ArgumentMatchers.any(UpdatePaymentBatchStatusRequest.class)))
        .thenReturn(paymentBatchResponse("paybatch-demo", "PAY-DEMO", "审批中"));
    when(contractApplicationService.updateCurrentTenantContractStatus(
        org.mockito.ArgumentMatchers.eq("contract-demo"),
        org.mockito.ArgumentMatchers.any(UpdateContractStatusRequest.class)))
        .thenReturn(contractResponse("contract-demo", "履约完成", "未归档"));
    when(contractApplicationService.updateCurrentTenantContractArchiveStatus(
        org.mockito.ArgumentMatchers.eq("contract-demo"),
        org.mockito.ArgumentMatchers.any(UpdateContractArchiveStatusRequest.class)))
        .thenReturn(contractResponse("contract-demo", "履约完成", "已归档"));
    when(financeActionApplicationService.registerCurrentTenantPaymentExecutionRecord(
        org.mockito.ArgumentMatchers.eq("payexec-demo"),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(paymentExecutionRecordResponse("payexec-demo", "PAY-202606", "已登记付款"));
    when(financeActionApplicationService.registerCurrentTenantPaymentExecutionRecord(
        org.mockito.ArgumentMatchers.eq("payexec-demo"),
        org.mockito.ArgumentMatchers.any(RegisterPaymentRequest.class)))
        .thenReturn(paymentExecutionRecordResponse("payexec-demo", "PAY-202606", "已登记付款"));
    when(financeActionApplicationService.listCurrentTenantVarianceHandlings(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(List.of(varianceHandlingResponse("variance-demo", "invoice-demo", "待处理")));
    when(financeActionApplicationService.listCurrentTenantVarianceHandlings(
        org.mockito.ArgumentMatchers.eq("待处理"),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("po-demo"),
        org.mockito.ArgumentMatchers.eq("invoice-demo")))
        .thenReturn(List.of(varianceHandlingResponse("variance-filtered", "invoice-demo", "待处理")));
    when(financeActionApplicationService.createCurrentTenantVarianceHandling(
        org.mockito.ArgumentMatchers.any(CreateVarianceHandlingRequest.class)))
        .thenReturn(varianceHandlingResponse("variance-created", "invoice-demo", "待处理"));
    when(financeActionApplicationService.updateCurrentTenantVarianceHandlingStatus(
        org.mockito.ArgumentMatchers.eq("variance-demo"),
        org.mockito.ArgumentMatchers.any(UpdateVarianceHandlingStatusRequest.class)))
        .thenReturn(varianceHandlingResponse("variance-demo", "invoice-demo", "已处理"));
    when(paymentApplicationService.register(
        org.mockito.ArgumentMatchers.eq("invoice-demo"),
        org.mockito.ArgumentMatchers.any(RegisterPaymentRequest.class)))
        .thenReturn(invoiceResponse("invoice-demo", "已付款"));
    when(paymentApplicationService.listCurrentTenantPaymentAuditLogs("invoice-demo"))
        .thenReturn(List.of(new AuditLogResponse(
            "audit-payment-demo",
            "tenant-acme",
            "user-buyer-owner",
            "invoice.paid",
            "invoice",
            "invoice-demo",
            null,
            OffsetDateTime.parse("2026-06-15T12:30:00+08:00"))));

    mockMvc.perform(get("/api/v1/buyer/orders")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("po-demo"));
    mockMvc.perform(get("/api/v1/buyer/orders")
            .queryParam("status", "待供应商确认")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("rfqId", "rfq-demo")
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
    mockMvc.perform(get("/api/v1/buyer/receipts")
            .queryParam("orderId", "po-demo")
            .queryParam("receiverId", "user-buyer-owner")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("receipt-demo"));
    mockMvc.perform(get("/api/v1/buyer/invoices")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("invoice-demo"));
    mockMvc.perform(get("/api/v1/buyer/invoices")
            .queryParam("paymentStatus", "待付款")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("orderId", "po-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("invoice-filtered"));
    mockMvc.perform(get("/api/v1/buyer/invoice-reconciliations")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("recon-all"));
    mockMvc.perform(get("/api/v1/buyer/invoice-reconciliations")
            .queryParam("stage", "待付款")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("orderId", "po-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("recon-demo"))
        .andExpect(jsonPath("$.data[0].invoiceId").value("invoice-demo"))
        .andExpect(jsonPath("$.data[0].stage").value("待付款"));
    mockMvc.perform(get("/api/v1/buyer/payment-requests")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("payreq-demo"));
    mockMvc.perform(get("/api/v1/buyer/payment-requests")
            .queryParam("requestStatus", "付款申请待提交")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("orderId", "po-demo")
            .queryParam("invoiceId", "invoice-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("payreq-filtered"));
    mockMvc.perform(get("/api/v1/buyer/payment-batches")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("paybatch-demo"));
    mockMvc.perform(get("/api/v1/buyer/payment-batches")
            .queryParam("batchStatus", "待提交审批")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("paybatch-filtered"))
        .andExpect(jsonPath("$.data[0].paymentBatchNo").value("PAY-202606"));
    mockMvc.perform(get("/api/v1/buyer/payment-execution-records")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("payexec-demo"));
    mockMvc.perform(get("/api/v1/buyer/payment-execution-records")
            .queryParam("paymentBatchNo", "PAY-202606")
            .queryParam("executionStatus", "待登记付款")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("invoiceId", "invoice-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("payexec-filtered"))
        .andExpect(jsonPath("$.data[0].paymentBatchNo").value("PAY-202606"));
    mockMvc.perform(post("/api/v1/buyer/payment-requests")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentRequestPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("payreq-created"));
    mockMvc.perform(put("/api/v1/buyer/payment-requests/payreq-demo/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentRequestStatusPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.requestStatus").value("付款申请审批中"));
    mockMvc.perform(put("/api/v1/buyer/payment-batches/PAY-DEMO/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentBatchStatusPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.batchStatus").value("审批中"));
    mockMvc.perform(put("/api/v1/buyer/contracts/contract-demo/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validContractStatusPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("contract-demo"))
        .andExpect(jsonPath("$.data.status").value("履约完成"));
    mockMvc.perform(put("/api/v1/buyer/contracts/contract-demo/archive-status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validContractArchiveStatusPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("contract-demo"))
        .andExpect(jsonPath("$.data.archiveStatus").value("已归档"));

    when(contractApplicationService.addCurrentTenantContractAmendment(
        org.mockito.ArgumentMatchers.eq("contract-demo"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new com.procurement.contract.api.ContractAmendmentResponse(
            "contract-amd-1", "contract-demo", 1, "金额变更",
            java.math.BigDecimal.valueOf(120000), java.math.BigDecimal.valueOf(130000),
            null, null, "新增实施范围", "user-buyer-owner",
            OffsetDateTime.parse("2026-06-29T10:00:00+08:00")));
    mockMvc.perform(post("/api/v1/buyer/contracts/contract-demo/amendments")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"changeType": "金额变更", "newAmount": 130000, "reason": "新增实施范围"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.seq").value(1))
        .andExpect(jsonPath("$.data.changeType").value("金额变更"))
        .andExpect(jsonPath("$.data.newAmount").value(130000));

    when(contractApplicationService.listCurrentTenantContractAmendments("contract-demo"))
        .thenReturn(List.of(new com.procurement.contract.api.ContractAmendmentResponse(
            "contract-amd-1", "contract-demo", 1, "金额变更",
            java.math.BigDecimal.valueOf(120000), java.math.BigDecimal.valueOf(130000),
            null, null, "新增实施范围", "user-buyer-owner",
            OffsetDateTime.parse("2026-06-29T10:00:00+08:00"))));
    mockMvc.perform(get("/api/v1/buyer/contracts/contract-demo/amendments")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].changeType").value("金额变更"));
    mockMvc.perform(post("/api/v1/buyer/payment-execution-records/payexec-demo/registration")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("payexec-demo"))
        .andExpect(jsonPath("$.data.executionStatus").value("已登记付款"))
        .andExpect(jsonPath("$.data.releaseEvidenceNo").value("BANK-20260701-001"))
        .andExpect(jsonPath("$.data.releaseRemark").value("招商银行付款流水"));
    // 带放款证据 body:controller 必须把 body 透传给 service 的带参重载。
    mockMvc.perform(post("/api/v1/buyer/payment-execution-records/payexec-demo/registration")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"paymentStatus": "已付款", "releaseEvidenceNo": "BANK-20260701-002", "releaseRemark": "工商银行付款流水"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("payexec-demo"))
        .andExpect(jsonPath("$.data.executionStatus").value("已登记付款"));
    org.mockito.Mockito.verify(financeActionApplicationService)
        .registerCurrentTenantPaymentExecutionRecord(
            org.mockito.ArgumentMatchers.eq("payexec-demo"),
            org.mockito.ArgumentMatchers.argThat((RegisterPaymentRequest req) ->
                req != null
                    && "已付款".equals(req.paymentStatus())
                    && "BANK-20260701-002".equals(req.releaseEvidenceNo())
                    && "工商银行付款流水".equals(req.releaseRemark())));
    mockMvc.perform(get("/api/v1/buyer/variance-handlings")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("variance-demo"));
    mockMvc.perform(get("/api/v1/buyer/variance-handlings")
            .queryParam("status", "待处理")
            .queryParam("supplierId", "ent-supplier-sunrise")
            .queryParam("orderId", "po-demo")
            .queryParam("invoiceId", "invoice-demo")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("variance-filtered"));
    mockMvc.perform(post("/api/v1/buyer/variance-handlings")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validVarianceHandlingPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("variance-created"));
    mockMvc.perform(put("/api/v1/buyer/variance-handlings/variance-demo/status")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validVarianceHandlingStatusPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("已处理"));
    mockMvc.perform(post("/api/v1/buyer/invoices/invoice-demo/payments")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validPaymentPayload()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.paymentStatus").value("已付款"));
    mockMvc.perform(get("/api/v1/buyer/invoices/invoice-demo/payment-audit-logs")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("audit-payment-demo"))
        .andExpect(jsonPath("$.data[0].action").value("invoice.paid"));
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
    mockMvc.perform(get("/api/v1/supplier/deliveries")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/supplier/deliveries/delivery-demo")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validDeliveryPayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/invoices")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validInvoicePayload()))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/v1/supplier/invoices/invoice-demo/payment-audit-logs")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());
    mockMvc.perform(put("/api/v1/supplier/invoices/invoice-demo/reconciliation")
            .header("Authorization", "Bearer " + buyerToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "reconciliationNote": "已与采购方确认 6 月底付尾款"
                }
                """))
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
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货"));
    when(deliveryApplicationService.listCurrentSupplierDeliveries(
        org.mockito.ArgumentMatchers.eq("已发货"),
        org.mockito.ArgumentMatchers.eq("po-demo")))
        .thenReturn(List.of(new DeliveryResponse(
            "delivery-demo",
            "tenant-acme",
            "po-demo",
            "ent-supplier-sunrise",
            "顺丰",
            "SF123",
            "已发货",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货")));
    when(deliveryApplicationService.update(
        org.mockito.ArgumentMatchers.eq("delivery-demo"),
        org.mockito.ArgumentMatchers.any(UpdateDeliveryRequest.class)))
        .thenReturn(new DeliveryResponse(
            "delivery-demo",
            "tenant-acme",
            "po-demo",
            "ent-supplier-sunrise",
            "京东物流",
            "JD987654321",
            "已发货",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货"));
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
    mockMvc.perform(get("/api/v1/supplier/deliveries")
            .queryParam("status", "已发货")
            .queryParam("orderId", "po-demo")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].id").value("delivery-demo"));
    mockMvc.perform(put("/api/v1/supplier/deliveries/delivery-demo")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "carrier": "京东物流",
                  "trackingNo": "JD987654321"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.carrier").value("京东物流"))
        .andExpect(jsonPath("$.data.trackingNo").value("JD987654321"));
    mockMvc.perform(post("/api/v1/supplier/orders/po-demo/invoices")
            .header("Authorization", "Bearer " + supplierToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validInvoicePayload()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").value("invoice-created"));
  }

  @Test
  void accountStoreOutageReturnsRetryable503InsteadOfInvalidatingSession() throws Exception {
    String token = loginAndExtractToken("""
        {"account":"buyer","password":"demo123456","scope":"BUYER","tenantId":"tenant-acme"}
        """);
    org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("Account store unavailable"))
        .when(authenticationUserMapper).findActiveSessionUser(
            org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.nullable(String.class), org.mockito.ArgumentMatchers.nullable(String.class));
    mockMvc.perform(get("/api/v1/buyer/demands").header("Authorization", "Bearer " + token))
        .andExpect(status().isServiceUnavailable())
        .andExpect(header().string("Retry-After", "5"));
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
    // 动态日期:@FutureOrPresent 校验,写死日期会随时间流逝变成过期用例。
    return """
        {
          "awardId": "award-demo",
          "expectedReceiptDate": "%s"
        }
        """.formatted(java.time.LocalDate.now().plusDays(7));
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

  private String validPaymentRequestPayload() {
    return """
        {
          "invoiceId": "invoice-demo",
          "requestStatus": "付款申请待提交",
          "paymentBatchNo": "PAY-202606",
          "remark": "三单匹配通过后发起付款申请"
        }
        """;
  }

  private String validPaymentRequestStatusPayload() {
    return """
        {
          "requestStatus": "付款申请审批中"
        }
        """;
  }

  private String validPaymentBatchStatusPayload() {
    return """
        {
          "batchStatus": "审批中"
        }
        """;
  }

  private String validContractStatusPayload() {
    return """
        {
          "status": "履约完成",
          "fulfillmentProgress": "已收货验收"
        }
        """;
  }

  private String validContractArchiveStatusPayload() {
    return """
        {
          "archiveStatus": "已归档"
        }
        """;
  }

  private String validVarianceHandlingPayload() {
    return """
        {
          "invoiceId": "invoice-demo",
          "reason": "发票金额与订单金额存在差异",
          "ownerId": "user-buyer-owner",
          "result": "待供应商确认差异原因",
          "status": "待处理"
        }
        """;
  }

  private String validVarianceHandlingStatusPayload() {
    return """
        {
          "status": "已处理",
          "result": "差异已核对并关闭，允许进入付款申请。"
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
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款",
            java.util.List.of(), null);
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
        null,
        LocalDate.parse("2026-07-15"),
        false,
        0L,
        BigDecimal.valueOf(98000),
        BigDecimal.ZERO,
        "已收货",
        "三单一致",
        "REC-" + id,
        "待付款",
        "登记付款",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"), "", null, new java.math.BigDecimal("13.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, 500, 495, 99, "存在不合格",
            java.util.List.of());
  }

  private ContractResponse contractResponse(String id, String status, String archiveStatus) {
    return new ContractResponse(
        id,
        "tenant-acme",
        "CTR-DEMO",
        "晨光科技供应商采购合同",
        "po-demo",
        "ent-supplier-sunrise",
        BigDecimal.valueOf(98000),
        status,
        archiveStatus,
        "已收货验收",
        LocalDate.parse("2026-06-15"),
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.now().plusMonths(11), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金", null);
  }

  private InvoiceReconciliationResponse invoiceReconciliationResponse(String id, String invoiceId, String stage) {
    return new InvoiceReconciliationResponse(
        id,
        "tenant-acme",
        "REC-" + invoiceId,
        invoiceId,
        "ent-supplier-sunrise",
        "po-demo",
        stage,
        "登记付款",
        BigDecimal.valueOf(98000),
        BigDecimal.valueOf(98000),
        BigDecimal.ZERO,
        "已收货",
        "待付款",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }

  private PaymentRequestResponse paymentRequestResponse(String id, String invoiceId, String requestStatus) {
    return new PaymentRequestResponse(
        id,
        "tenant-acme",
        invoiceId,
        "ent-supplier-sunrise",
        "po-demo",
        BigDecimal.valueOf(98000),
        requestStatus,
        "PAY-202606",
        "三单匹配通过后发起付款申请",
        "user-buyer-owner",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }

  private PaymentBatchResponse paymentBatchResponse(String id, String paymentBatchNo, String batchStatus) {
    return new PaymentBatchResponse(
        id,
        "tenant-acme",
        paymentBatchNo,
        "ent-supplier-sunrise",
        1,
        BigDecimal.valueOf(98000),
        BigDecimal.ZERO,
        BigDecimal.valueOf(98000),
        BigDecimal.valueOf(98000),
        BigDecimal.ZERO,
        1,
        1,
        0,
        "可继续登记付款",
        "暂无阻断",
        batchStatus,
        LocalDate.parse("2026-07-15"),
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }

  private PaymentExecutionRecordResponse paymentExecutionRecordResponse(
      String id,
      String paymentBatchNo,
      String executionStatus) {
    return new PaymentExecutionRecordResponse(
        id,
        "tenant-acme",
        paymentBatchNo,
        "payreq-demo",
        "invoice-demo",
        "ent-supplier-sunrise",
        BigDecimal.valueOf(98000),
        LocalDate.parse("2026-07-15"),
        executionStatus,
        "付款申请已通过，可进入线下付款登记",
        "付款申请已通过",
        "BANK-20260701-001",
        "招商银行付款流水",
        "可登记付款",
        "登记付款状态，真实支付仍不接入",
        "user-buyer-owner",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"));
  }

  private VarianceHandlingResponse varianceHandlingResponse(String id, String invoiceId, String status) {
    return new VarianceHandlingResponse(
        id,
        "tenant-acme",
        invoiceId,
        "ent-supplier-sunrise",
        "po-demo",
        BigDecimal.ZERO,
        "发票金额与订单金额存在差异",
        "user-buyer-owner",
        "待供应商确认差异原因",
        status,
        "user-buyer-owner",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T12:05:00+08:00"),
        null, null);
  }

  @Test
  void mallEndpointsAreBuyerOnly() throws Exception {
    when(mallApplicationService.listCurrentTenantListings(
        org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull()))
        .thenReturn(java.util.List.of());

    mockMvc.perform(get("/api/v1/buyer/mall/listings"))
        .andExpect(status().isForbidden());

    String supplierToken = loginAndExtractToken("""
        {"account": "supplier", "password": "demo123456", "scope": "SUPPLIER", "supplierId": "ent-supplier-sunrise"}
        """);
    mockMvc.perform(get("/api/v1/buyer/mall/listings")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isForbidden());

    String buyerToken = loginAndExtractToken("""
        {"account": "buyer", "password": "demo123456", "scope": "BUYER", "tenantId": "tenant-acme"}
        """);
    mockMvc.perform(get("/api/v1/buyer/mall/listings")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isOk());
  }

  @Test
  void supplierMallShelfIsSupplierOnly() throws Exception {
    when(mallApplicationService.listSupplierListings()).thenReturn(java.util.List.of());

    mockMvc.perform(get("/api/v1/supplier/mall/listings"))
        .andExpect(status().isForbidden());

    String buyerToken = loginAndExtractToken("""
        {"account": "buyer", "password": "demo123456", "scope": "BUYER", "tenantId": "tenant-acme"}
        """);
    mockMvc.perform(get("/api/v1/supplier/mall/listings")
            .header("Authorization", "Bearer " + buyerToken))
        .andExpect(status().isForbidden());

    String supplierToken = loginAndExtractToken("""
        {"account": "supplier", "password": "demo123456", "scope": "SUPPLIER", "supplierId": "ent-supplier-sunrise"}
        """);
    mockMvc.perform(get("/api/v1/supplier/mall/listings")
            .header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk());
  }
  @Test
  void publicPortalEndpointsAreReadableWithoutAuthentication() throws Exception {
    // 公开门户只读端点:未登录 200(permitAll),供门户首页展示真实名录与公告。
    org.mockito.Mockito.when(publicPortalApplicationService.listPublicSuppliers())
        .thenReturn(java.util.List.of(new com.procurement.platform.api.PublicSupplierResponse(
            "ent-supplier-sunrise", "晨光科技供应商", "办公设备", true, "approved")));
    org.mockito.Mockito.when(publicPortalApplicationService.listActiveAnnouncements())
        .thenReturn(java.util.List.of(new com.procurement.platform.api.PublicAnnouncementResponse(
            "ann-1", "平台维护通知", "内容", "all", null)));

    mockMvc.perform(get("/api/v1/public/suppliers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("晨光科技供应商"));
    mockMvc.perform(get("/api/v1/public/announcements"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].title").value("平台维护通知"));
  }

}
