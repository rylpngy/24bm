package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ApprovalTaskInboxTests {

  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final PaymentRequestMapper paymentRequestMapper = org.mockito.Mockito.mock(PaymentRequestMapper.class);
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper =
      org.mockito.Mockito.mock(PaymentArchiveExceptionRequestMapper.class);
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final com.procurement.process.infrastructure.ProcessInstanceMapper processInstanceMapper =
      org.mockito.Mockito.mock(com.procurement.process.infrastructure.ProcessInstanceMapper.class);
  private final ApprovalInboxApplicationService approvalInboxApplicationService =
      new ApprovalInboxApplicationService(
          approvalTaskMapper,
          purchaseDemandMapper,
          buyerSupplierRelationMapper,
          awardDecisionMapper,
          rfqMapper,
          paymentRequestMapper,
          paymentBatchMapper,
          paymentArchiveExceptionRequestMapper,
          contractMapper,
          buyerUserMapper,
          processInstanceMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listsPendingApprovalTasksForCurrentTenantOnly() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-2", "tenant-1", "rfq_award", "award-1", "待审批", "2026-06-15T12:00:00+08:00"),
            task("approval-1", "tenant-1", "purchase_demand", "demand-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "办公电脑询价"));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "owner-1"))
        .thenReturn(user("owner-1", "采购负责人"));
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "采购 20 台电脑", BigDecimal.valueOf(120000)));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "requester-1"))
        .thenReturn(user("requester-1", "需求申请人"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).extracting(PendingApprovalTaskResponse::id)
        .containsExactly("approval-2", "approval-1");
    assertThat(responses).extracting(PendingApprovalTaskResponse::bizType)
        .containsExactly("rfq_award", "purchase_demand");
    assertThat(responses).extracting(PendingApprovalTaskResponse::summaryTitle)
        .containsExactly("办公电脑询价", "采购 20 台电脑");
    assertThat(responses).extracting(PendingApprovalTaskResponse::parentBizId)
        .containsExactly("rfq-1", null);
    assertThat(responses).extracting(PendingApprovalTaskResponse::amount)
        .containsExactly(BigDecimal.valueOf(98000), BigDecimal.valueOf(120000));
    assertThat(responses).extracting(PendingApprovalTaskResponse::businessStatus)
        .containsExactly("定标审批中", "审批中");
    assertThat(responses).extracting(PendingApprovalTaskResponse::priority)
        .containsExactly(90, 70);
    assertThat(responses).extracting(PendingApprovalTaskResponse::submittedById)
        .containsExactly("owner-1", "requester-1");
    assertThat(responses).extracting(PendingApprovalTaskResponse::submittedByName)
        .containsExactly("采购负责人", "需求申请人");
    verify(approvalTaskMapper).listByTenantAndStatus("tenant-1", "待审批");
  }

  @Test
  void enrichesSupplierAdmissionPendingTasksWithSupplierSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-1", "tenant-1", "buyer_supplier_admission", "rel-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(supplierRelation("rel-1", "tenant-1", "晨光供应商"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("晨光供应商");
          assertThat(response.businessStatus()).isEqualTo("准入审批中");
          assertThat(response.priority()).isEqualTo(80);
          assertThat(response.submittedById()).isEqualTo("supplier-1");
          assertThat(response.submittedByName()).isEqualTo("晨光供应商");
          assertThat(response.counterpartyName()).isEqualTo("晨光供应商");
          assertThat(response.amount()).isNull();
        });
  }

  @Test
  void enrichesPaymentRequestPendingTasksWithFinanceSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-1", "tenant-1", "payment_request", "payreq-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(paymentRequestMapper.findByTenantAndId("tenant-1", "payreq-1"))
        .thenReturn(paymentRequest("payreq-1", "tenant-1", "PAY-202606", BigDecimal.valueOf(118000)));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "requester-1"))
        .thenReturn(user("requester-1", "付款申请人"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("付款申请 PAY-202606");
          assertThat(response.businessStatus()).isEqualTo("付款申请审批中");
          assertThat(response.priority()).isEqualTo(85);
          assertThat(response.parentBizId()).isEqualTo("invoice-1");
          assertThat(response.submittedById()).isEqualTo("requester-1");
          assertThat(response.submittedByName()).isEqualTo("付款申请人");
          assertThat(response.amount()).isEqualByComparingTo(BigDecimal.valueOf(118000));
          assertThat(response.counterpartyId()).isEqualTo("supplier-1");
        });
  }

  @Test
  void enrichesPaymentBatchPendingTasksWithBatchSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-1", "tenant-1", "payment_batch", "PAY-202606", "待审批", "2026-06-15T10:00:00+08:00")));
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("paybatch-1", "tenant-1", "PAY-202606", BigDecimal.valueOf(236000)));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("付款批次 PAY-202606");
          assertThat(response.businessStatus()).isEqualTo("审批中");
          assertThat(response.priority()).isEqualTo(88);
          assertThat(response.parentBizId()).isNull();
          assertThat(response.submittedById()).isEqualTo("supplier-1");
          assertThat(response.submittedByName()).isEqualTo("供应商 supplier-1");
          assertThat(response.amount()).isEqualByComparingTo(BigDecimal.valueOf(236000));
          assertThat(response.counterpartyId()).isEqualTo("supplier-1");
        });
  }

  @Test
  void enrichesPaymentArchiveExceptionPendingTasksWithExceptionSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task(
                "approval-1",
                "tenant-1",
                "payment_archive_exception",
                "payarchive-exception-1",
                "待审批",
                "2026-06-15T10:00:00+08:00")));
    when(paymentArchiveExceptionRequestMapper.findByTenantAndId("tenant-1", "payarchive-exception-1"))
        .thenReturn(paymentArchiveExceptionRequest());
    when(buyerUserMapper.findByTenantAndId("tenant-1", "requester-1"))
        .thenReturn(user("requester-1", "财务申请人"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("付款归档异常 PAY-202606");
          assertThat(response.businessStatus()).isEqualTo("撤销申请 / 待审批");
          assertThat(response.priority()).isEqualTo(89);
          assertThat(response.parentBizId()).isEqualTo("PAY-202606");
          assertThat(response.submittedById()).isEqualTo("requester-1");
          assertThat(response.submittedByName()).isEqualTo("财务申请人");
          assertThat(response.amount()).isNull();
          assertThat(response.counterpartyId()).isEqualTo("PAY-202606");
        });
  }

  @Test
  void enrichesContractApprovalPendingTasksWithContractSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-1", "tenant-1", "contract_approval", "contract-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("contract-1", "tenant-1"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("测试采购合同");
          assertThat(response.businessStatus()).isEqualTo("审批中");
          assertThat(response.priority()).isEqualTo(86);
          assertThat(response.parentBizId()).isEqualTo("po-1");
          assertThat(response.submittedById()).isEqualTo("supplier-1");
          assertThat(response.submittedByName()).isEqualTo("供应商 supplier-1");
          assertThat(response.amount()).isEqualByComparingTo(BigDecimal.valueOf(60000));
          assertThat(response.counterpartyId()).isEqualTo("supplier-1");
        });
  }

  @Test
  void listsRecentReviewedApprovalTasksWithActedAtAndBusinessSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listRecentReviewedByTenant("tenant-1", 10))
        .thenReturn(List.of(
            task(
                "approval-approved",
                "tenant-1",
                "purchase_demand",
                "demand-1",
                "已通过",
                "2026-06-15T10:00:00+08:00",
                "2026-06-15T13:00:00+08:00"),
            task(
                "approval-rejected",
                "tenant-1",
                "buyer_supplier_admission",
                "rel-1",
                "已驳回",
                "2026-06-15T09:00:00+08:00",
                "2026-06-15T12:00:00+08:00")));
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "采购 20 台电脑", BigDecimal.valueOf(120000)));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "requester-1"))
        .thenReturn(user("requester-1", "需求申请人"));
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(supplierRelation("rel-1", "tenant-1", "晨光供应商"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listRecentReviewed();

    assertThat(responses).extracting(PendingApprovalTaskResponse::id)
        .containsExactly("approval-approved", "approval-rejected");
    assertThat(responses).extracting(PendingApprovalTaskResponse::status)
        .containsExactly("已通过", "已驳回");
    assertThat(responses).extracting(PendingApprovalTaskResponse::summaryTitle)
        .containsExactly("采购 20 台电脑", "晨光供应商");
    assertThat(responses).extracting(PendingApprovalTaskResponse::submittedByName)
        .containsExactly("需求申请人", "晨光供应商");
    assertThat(responses).extracting(PendingApprovalTaskResponse::actedAt)
        .containsExactly(
            OffsetDateTime.parse("2026-06-15T13:00:00+08:00"),
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"));
    verify(approvalTaskMapper).listRecentReviewedByTenant("tenant-1", 10);
  }

  private ApprovalTask task(
      String id,
      String tenantId,
      String bizType,
      String bizId,
      String status,
      String createdAt) {
    return task(id, tenantId, bizType, bizId, status, createdAt, null);
  }

  private ApprovalTask task(
      String id,
      String tenantId,
      String bizType,
      String bizId,
      String status,
      String createdAt,
      String actedAt) {
    return new ApprovalTask(
        id,
        tenantId,
        bizType,
        bizId,
        null,
        status,
        OffsetDateTime.parse(createdAt),
        actedAt == null ? null : OffsetDateTime.parse(actedAt));
  }

  private PurchaseDemand demand(String id, String tenantId, String title, BigDecimal budget) {
    return new PurchaseDemand(
        id,
        tenantId,
        title,
        "dept-1",
        "requester-1",
        budget,
        "审批中",
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明", null);
  }

  private BuyerSupplierRelation supplierRelation(String id, String tenantId, String supplierName) {
    return new BuyerSupplierRelation(
        id,
        tenantId,
        "supplier-1",
        supplierName,
        "准入审批中",
        "A",
        "[]",
        BigDecimal.ZERO, "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001");
  }

  private AwardDecision awardDecision(String id, String tenantId, String rfqId, String supplierId) {
    return new AwardDecision(
        id,
        tenantId,
        rfqId,
        "quote-1",
        supplierId,
        BigDecimal.valueOf(98000),
        "最低价",
        "待审批",
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"));
  }

  private PaymentRequest paymentRequest(String id, String tenantId, String batchNo, BigDecimal amount) {
    return new PaymentRequest(
        id,
        tenantId,
        "invoice-1",
        "supplier-1",
        "po-1",
        amount,
        "付款申请审批中",
        batchNo,
        "付款申请备注",
        "requester-1",
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"));
  }

  private PaymentBatch paymentBatch(String id, String tenantId, String batchNo, BigDecimal amount) {
    return new PaymentBatch(
        id,
        tenantId,
        batchNo,
        "supplier-1",
        2,
        amount,
        amount,
        amount,
        amount,
        BigDecimal.ZERO,
        1,
        1,
        0,
        "可继续登记付款",
        "暂无阻断",
        "审批中",
        java.time.LocalDate.parse("2026-07-15"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"));
  }

  private PaymentArchiveExceptionRequest paymentArchiveExceptionRequest() {
    return new PaymentArchiveExceptionRequest(
        "payarchive-exception-1",
        "tenant-1",
        "PAY-202606",
        "撤销申请",
        "归档后发现付款登记金额异常",
        "待审批",
        "待处理",
        null,
        "待关闭",
        null,
        "requester-1",
        null,
        null,
        null,
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"));
  }

  private ContractLedger contract(String id, String tenantId) {
    return new ContractLedger(
        id,
        tenantId,
        "CTR-1",
        "测试采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "审批中",
        "未归档",
        "审批中",
        java.time.LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.now().plusMonths(11), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金", null);
  }

  private Rfq rfq(String id, String tenantId, String title) {
    return new Rfq(
        id,
        tenantId,
        title,
        "定标审批中",
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "owner-1",
        null,
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null, null, null, null, null, null, null, null, null, null, null, null);
  }

  private BuyerUser user(String id, String name) {
    return new BuyerUser(
        id,
        "tenant-1",
        name,
        "13900000001",
        "buyer@example.com",
        "active",
        "dept-1",
        "role-buyer-owner");
  }
}
