package com.procurement.contract.application;

import com.procurement.approval.application.ApprovalGate;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.api.ContractAmendmentResponse;
import com.procurement.contract.api.ContractFulfillmentEventResponse;
import com.procurement.contract.api.ContractResponse;
import com.procurement.contract.api.CreateContractAmendmentRequest;
import com.procurement.contract.api.CreateContractFulfillmentEventRequest;
import com.procurement.contract.api.CreateContractRequest;
import com.procurement.contract.api.ReviewContractApprovalRequest;
import com.procurement.contract.api.UpdateContractArchiveStatusRequest;
import com.procurement.contract.api.UpdateContractRequest;
import com.procurement.contract.api.UpdateContractStatusRequest;
import com.procurement.contract.domain.ContractAmendment;
import com.procurement.contract.domain.ContractFulfillmentEvent;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractFulfillmentEventMapper;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractApplicationService {
  private final ContractMapper contractMapper;
  private final ContractFulfillmentEventMapper fulfillmentEventMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DataScopeService dataScopeService;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final ApprovalGate approvalGate;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;
  private ContractAccessService contractAccess;

  @Autowired
  void setContractAccessService(ContractAccessService contractAccess) {
    this.contractAccess = contractAccess;
  }

  public ContractApplicationService(
      ContractMapper contractMapper,
      PurchaseOrderMapper purchaseOrderMapper) {
    this(contractMapper, null, purchaseOrderMapper, null, null, null, null, null, null);
  }

  public ContractApplicationService(
      ContractMapper contractMapper,
      ContractFulfillmentEventMapper fulfillmentEventMapper,
      PurchaseOrderMapper purchaseOrderMapper) {
    this(contractMapper, fulfillmentEventMapper, purchaseOrderMapper, null, null, null, null, null, null);
  }

  public ContractApplicationService(
      ContractMapper contractMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this(
        contractMapper,
        null,
        purchaseOrderMapper,
        null,
        approvalTaskMapper,
        approvalTaskApplicationService,
        auditLogApplicationService,
        notificationApplicationService,
        null);
  }

  public ContractApplicationService(
      ContractMapper contractMapper,
      ContractFulfillmentEventMapper fulfillmentEventMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this(
        contractMapper,
        fulfillmentEventMapper,
        purchaseOrderMapper,
        null,
        approvalTaskMapper,
        approvalTaskApplicationService,
        auditLogApplicationService,
        notificationApplicationService,
        null);
  }

  @Autowired
  public ContractApplicationService(
      ContractMapper contractMapper,
      ContractFulfillmentEventMapper fulfillmentEventMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      DataScopeService dataScopeService,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      ApprovalGate approvalGate) {
    this.contractMapper = contractMapper;
    this.fulfillmentEventMapper = fulfillmentEventMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.dataScopeService = dataScopeService;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.approvalGate = approvalGate;
  }

  @Autowired
  void setUnifiedWorkflowApplicationService(
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.unifiedWorkflowApplicationService = unifiedWorkflowApplicationService;
  }

  // 电子签章入口:按当前租户取合同(供 esign 模块计算内容指纹),不存在即抛错。
  public ContractLedger findCurrentTenantContractForEsign(String contractId) {
    contractAccess.requireContract(contractId, false);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = contractMapper.findByTenantAndId(tenantId, contractId);
    if (contract == null) {
      throw new IllegalArgumentException("Contract not found in tenant scope: " + contractId);
    }
    return contract;
  }

  public List<ContractResponse> listCurrentTenantContracts(
      String status,
      String archiveStatus,
      String supplierId) {
    contractAccess.requireRead();
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    DataScope dataScope = dataScopeService == null
        ? DataScope.unrestricted()
        : dataScopeService.currentUserDataScope();
    if (dataScope.blocksAll()) {
      return List.of();
    }
    List<String> scopeDepartmentIds = dataScope.restricted() && dataScope.requesterId() == null
        ? dataScope.departmentIds()
        : null;
    String requesterId = dataScope.restricted() ? dataScope.requesterId() : null;
    return contractMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(archiveStatus),
            blankToNull(supplierId),
            scopeDepartmentIds,
            requesterId)
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ContractResponse createCurrentTenantContract(CreateContractRequest request) {
    if (!"草案".equals(request.status())) {
      throw new IllegalStateException("普通创建只能保存草案，合同生效须完成审批");
    }
    contractAccess.requireOrder(request.relatedOrderId());
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, request.relatedOrderId());
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found in tenant scope: " + request.relatedOrderId());
    }

    if (java.util.Set.of("取消协商中","已取消").contains(order.status())) throw new IllegalStateException("订单正在取消或已取消，不能新建合同");
    String contractId = newId();
    contractMapper.insert(
        contractId,
        tenantId,
        request.contractNo(),
        request.contractName(),
        order.id(),
        order.supplierId(),
        request.amount(),
        request.status(),
        "未归档",
        request.fulfillmentProgress(),
        request.effectiveDate(),
        request.signDate(),
        request.expiryDate(),
        orEmpty(request.paymentTerms()),
        orEmpty(request.warrantyTerms()));
    return toResponse(requireContract(tenantId, contractId));
  }

  @Transactional
  public ContractResponse updateCurrentTenantContract(
      String contractId,
      UpdateContractRequest request) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("Archived contract can only be audited: " + contractId);
    }

    if (!"草案".equals(contract.status()) || !"草案".equals(request.status())) {
      throw new IllegalStateException("普通修改仅允许草案；审批中已锁定，生效合同须登记受控变更");
    }

    int updated = contractMapper.updateDetails(
        tenantId,
        contractId,
        request.contractNo(),
        request.contractName(),
        request.amount(),
        request.status(),
        request.fulfillmentProgress(),
        request.effectiveDate(),
        request.signDate(),
        request.expiryDate(),
        orEmpty(request.paymentTerms()),
        orEmpty(request.warrantyTerms()));
    if (updated == 0) {
      throw new IllegalStateException("Contract changed before update could be saved: " + contractId);
    }
    return toResponse(requireContract(tenantId, contractId));
  }

  @Transactional
  public ContractResponse updateCurrentTenantContractStatus(
      String contractId,
      UpdateContractStatusRequest request) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("Archived contract can only be audited: " + contractId);
    }
    if ("审批中".equals(contract.status()) || !contract.status().equals(request.status())) {
      throw new IllegalStateException(
          "Contract approval status can only be submitted and completed through the Flowable workflow");
    }

    int updated = contractMapper.updateStatus(
        tenantId,
        contractId,
        contract.status(),
        request.status(),
        request.fulfillmentProgress());
    if (updated == 0) {
      throw new IllegalStateException("Contract status changed before update could be saved: " + contractId);
    }
    return toResponse(requireContract(tenantId, contractId));
  }

  @Transactional
  public ContractResponse updateCurrentTenantContractArchiveStatus(
      String contractId,
      UpdateContractArchiveStatusRequest request) {
    contractAccess.requireArchiveAccess(contractId);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    // Match payment/after-sales lock order; fresh queries discard any pre-lock SESSION snapshots.
    String orderId = contractMapper.lockOrderForContract(tenantId, contractId);
    if (orderId == null || contractMapper.lockById(tenantId, contractId) == null) {
      throw new IllegalStateException("合同关联订单或合同已变化，请刷新重试");
    }
    ContractLedger contract = requireContract(tenantId, contractId);
    if (!orderId.equals(contract.relatedOrderId())) {
      throw new IllegalStateException("合同关联订单已变化，请刷新重试");
    }
    if (!"已归档".equals(request.archiveStatus()) && !"未归档".equals(request.archiveStatus())) {
      throw new IllegalArgumentException("不支持的合同归档状态");
    }
    if ("已归档".equals(contract.archiveStatus()) && !"已归档".equals(request.archiveStatus())) {
      throw new IllegalStateException("已归档合同不可直接解冻");
    }
    if ("已归档".equals(request.archiveStatus())) {
      int blockers = contractMapper.countArchiveBlockers(tenantId, contractId);
      if (blockers > 0) {
        throw new IllegalStateException(
            "Contract archive conditions are not satisfied: receipt and payment must be completed: "
                + contractMapper.archiveBlockingReason(tenantId, contractId));
      }
    }
    int updated = contractMapper.updateArchiveStatus(
        tenantId,
        contractId,
        contract.archiveStatus(),
        request.archiveStatus());
    if (updated == 0) {
      throw new IllegalStateException("Contract archive status changed before update could be saved: " + contractId);
    }
    return toResponse(requireContract(tenantId, contractId));
  }

  // 到期提醒扫描:为 withinDays 内临近到期、未归档、未续签的合同各生成一条提醒通知。
  // 可由定时任务(每日)或人工触发;返回扫描数与提醒数。
  @Transactional
  public com.procurement.contract.api.ScanExpiryResponse scanExpiringContracts(int withinDays) {
    contractAccess.requireRead();
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    int days = withinDays <= 0 ? 60 : withinDays;
    java.time.LocalDate threshold = java.time.LocalDate.now().plusDays(days);
    List<ContractLedger> expiring = contractMapper.listExpiringWithin(tenantId, threshold);
    int notified = 0;
    for (ContractLedger c : expiring) {
      try {
        contractAccess.requireContract(c.id(), false);
      } catch (com.procurement.common.tenant.PermissionDeniedException denied) {
        continue;
      }
      String when = c.expiryDate() == null ? "" : c.expiryDate().toString();
      notificationApplicationService.notifyActiveTenantUsers(
          tenantId,
          "合同到期提醒",
          "合同「" + c.contractName() + "」将于 " + when + " 到期,请及时安排续签或归档。");
      notified++;
    }
    if (notified > 0) {
      auditLogApplicationService.recordTenantAction(
          tenantId, "contract.expiry_scanned", "contract", "batch",
          "扫描到 " + notified + " 份临近到期合同并生成提醒");
    }
    return new com.procurement.contract.api.ScanExpiryResponse(days, notified, notified);
  }

  // 发起续签:置「已发起续签」(到期提醒驱动),幂等;审计留痕。
  @Transactional
  public ContractResponse initiateRenewal(String contractId) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if (!"已发起续签".equals(contract.renewalStatus())) {
      contractMapper.markRenewal(tenantId, contractId, "已发起续签");
      auditLogApplicationService.recordTenantAction(
          "contract.renewal_initiated", "contract", contractId);
    }
    return toResponse(requireContract(tenantId, contractId));
  }

  @Transactional
  public ContractResponse submitCurrentTenantContractApproval(String contractId) {
    return submitCurrentTenantContractApproval(contractId, Map.of());
  }

  @Transactional
  public ContractResponse submitCurrentTenantContractApproval(
      String contractId, Map<String, Object> formData) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);
    if (!"草案".equals(contract.status())) {
      throw new IllegalStateException("Only draft contracts can submit approval: " + contractId);
    }

    if (unifiedWorkflowApplicationService != null) {
      int updated = contractMapper.updateStatus(
          tenantId, contractId, contract.status(), "审批中", "审批中");
      if (updated == 0) {
        throw new IllegalStateException("Contract status changed before approval could be submitted: " + contractId);
      }
      unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
          ApprovalBusinessType.CONTRACT_APPROVAL,
          contractId,
          null,
          contract.amount(),
          formData == null ? Map.of() : formData,
          contractWorkflowSnapshot(contract)));
      auditLogApplicationService.recordTenantAction(
          "contract_approval.submitted", ApprovalBusinessType.CONTRACT_APPROVAL, contractId);
      notificationApplicationService.notifyActiveTenantUsers(
          tenantId,
          NotificationTitle.CONTRACT_APPROVAL_PENDING,
          contract.contractName() + "已提交合同审批，请及时处理。");
      return toResponse(requireContract(tenantId, contractId));
    }

    // 旧离线构造兼容路径。
    if (approvalGate != null && !approvalGate.requiresApproval(tenantId, ApprovalBusinessType.CONTRACT_APPROVAL)) {
      int bypassed = contractMapper.updateStatus(
          tenantId, contractId, contract.status(), "已生效", "已生效");
      if (bypassed == 0) {
        throw new IllegalStateException("Contract status changed before approval could be submitted: " + contractId);
      }
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "contract_approval.submitted",
          ApprovalBusinessType.CONTRACT_APPROVAL,
          contractId,
          ApprovalGate.bypassDetail());
      return toResponse(requireContract(tenantId, contractId));
    }

    int updated = contractMapper.updateStatus(
        tenantId,
        contractId,
        contract.status(),
        "审批中",
        "审批中");
    if (updated == 0) {
      throw new IllegalStateException("Contract status changed before approval could be submitted: " + contractId);
    }

    approvalTaskApplicationService.createPendingTask(
        tenantId,
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contractId,
        null);
    auditLogApplicationService.recordTenantAction(
        "contract_approval.submitted",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contractId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        NotificationTitle.CONTRACT_APPROVAL_PENDING,
        contract.contractName() + "已提交合同审批，请及时处理。");
    return toResponse(requireContract(tenantId, contractId));
  }

  private static Map<String, Object> contractWorkflowSnapshot(ContractLedger contract) {
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("contractNo", contract.contractNo());
    snapshot.put("contractName", contract.contractName());
    snapshot.put("supplierId", contract.supplierId());
    snapshot.put("relatedOrderId", contract.relatedOrderId());
    return snapshot;
  }

  @Transactional
  public ContractResponse reviewCurrentTenantContractApproval(
      String contractId,
      ReviewContractApprovalRequest request) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    String userId = TenantAccessGuard.requireUserId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);
    if (!"审批中".equals(contract.status())) {
      throw new IllegalStateException("Only contracts in approval can be reviewed: " + contractId);
    }

    if (unifiedWorkflowApplicationService != null) {
      unifiedWorkflowApplicationService.completeCurrentUserBusinessTask(
          ApprovalBusinessType.CONTRACT_APPROVAL,
          contractId,
          Boolean.TRUE.equals(request.approved()),
          request.comment());
      return toResponse(requireContract(tenantId, contractId));
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contractId,
        ApprovalStatus.PENDING);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for contract: " + contractId);
    }

    boolean approved = Boolean.TRUE.equals(request.approved());
    String approvalStatus = approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalStatus.PENDING,
        approvalStatus,
        userId,
        request.comment());
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    String targetStatus = approved ? "已生效" : "草案";
    String targetProgress = approved ? "已生效" : "待审批";
    int contractUpdated = contractMapper.updateStatus(
        tenantId,
        contractId,
        "审批中",
        targetStatus,
        targetProgress);
    if (contractUpdated == 0) {
      throw new IllegalStateException("Contract status changed before approval result could be applied: " + contractId);
    }

    auditLogApplicationService.recordTenantAction(
        approved ? "contract_approval.approved" : "contract_approval.rejected",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contractId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        approved ? NotificationTitle.CONTRACT_APPROVAL_APPROVED : NotificationTitle.CONTRACT_APPROVAL_REJECTED,
        contract.contractName() + "审批已" + (approved ? "通过" : "驳回") + "。");
    return toResponse(requireContract(tenantId, contractId));
  }

  public List<ContractFulfillmentEventResponse> listCurrentTenantContractFulfillmentEvents(
      String contractId) {
    contractAccess.requireContract(contractId, false);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    requireContract(tenantId, contractId);
    return fulfillmentEventMapper.listByTenantAndContract(tenantId, contractId)
        .stream()
        .map(this::toFulfillmentEventResponse)
        .toList();
  }

  public List<ContractAmendmentResponse> listCurrentTenantContractAmendments(String contractId) {
    contractAccess.requireContract(contractId, false);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    requireContract(tenantId, contractId);
    return contractMapper.listAmendments(tenantId, contractId).stream()
        .map(this::toAmendmentResponse)
        .toList();
  }

  // 登记合同变更/补充协议:留痕(按序号)+ 金额/工期变更应用到主合同 + 审计(带「从→到」明细)。
  @Transactional
  public ContractAmendmentResponse addCurrentTenantContractAmendment(
      String contractId, CreateContractAmendmentRequest request) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    String userId = TenantAccessGuard.requireUserId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);
    if (!"已生效".equals(contract.status())) {
      throw new IllegalStateException("仅未归档的生效合同可登记变更；草案请修改，审批中已锁定");
    }
    if (!ContractAmendment.isValidType(request.changeType())) {
      throw new IllegalArgumentException("非法变更类型: " + request.changeType());
    }
    boolean amountChange = ContractAmendment.AMOUNT.equals(request.changeType());
    boolean scheduleChange = ContractAmendment.SCHEDULE.equals(request.changeType());
    if (amountChange && (request.newAmount() == null || request.newAmount().signum() <= 0)) {
      throw new IllegalArgumentException("金额变更需填写新金额");
    }
    if (scheduleChange && request.newExpiryDate() == null) {
      throw new IllegalArgumentException("工期变更需填写新到期日");
    }

    int seq = contractMapper.maxAmendmentSeq(tenantId, contractId) + 1;
    java.math.BigDecimal oldAmount = contract.amount();
    java.time.LocalDate oldExpiry = contract.expiryDate();
    String amendmentId = "contract-amd-" + UUID.randomUUID();
    contractMapper.insertAmendment(
        amendmentId,
        tenantId,
        contractId,
        seq,
        request.changeType(),
        amountChange ? oldAmount : null,
        amountChange ? request.newAmount() : null,
        scheduleChange ? oldExpiry : null,
        scheduleChange ? request.newExpiryDate() : null,
        request.reason(),
        userId);

    if (amountChange || scheduleChange) {
      contractMapper.updateAmountAndExpiry(
          tenantId,
          contractId,
          amountChange ? request.newAmount() : contract.amount(),
          scheduleChange ? request.newExpiryDate() : contract.expiryDate());
    }

    String detail = "合同变更#" + seq + " " + request.changeType()
        + (amountChange ? ": ¥" + oldAmount + " → ¥" + request.newAmount() : "")
        + (scheduleChange ? ": " + oldExpiry + " → " + request.newExpiryDate() : "");
    if (auditLogApplicationService != null) {
      auditLogApplicationService.recordTenantAction(
          tenantId, "contract_amendment.created", AuditTargetType.CONTRACT, contractId, detail);
    }
    // 列表按 seq 倒序,刚插入的(最大 seq)即首条。
    return contractMapper.listAmendments(tenantId, contractId).stream()
        .findFirst()
        .map(this::toAmendmentResponse)
        .orElseThrow();
  }

  private ContractAmendmentResponse toAmendmentResponse(ContractAmendment a) {
    return new ContractAmendmentResponse(
        a.id(),
        a.contractId(),
        a.seq(),
        a.changeType(),
        a.oldAmount(),
        a.newAmount(),
        a.oldExpiryDate(),
        a.newExpiryDate(),
        a.reason(),
        a.actorId(),
        a.createdAt());
  }

  @Transactional
  public ContractFulfillmentEventResponse createCurrentTenantContractFulfillmentEvent(
      String contractId,
      CreateContractFulfillmentEventRequest request) {
    contractAccess.requireContract(contractId, true);
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    String userId = TenantAccessGuard.requireUserId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);

    String eventId = "contract-event-" + UUID.randomUUID();
    fulfillmentEventMapper.insert(
        eventId,
        tenantId,
        contractId,
        request.actionType(),
        request.targetId(),
        request.summary(),
        request.sourceLabel(),
        userId);
    if (auditLogApplicationService != null) {
      auditLogApplicationService.recordTenantAction(
          "contract_fulfillment_event.created",
          AuditTargetType.CONTRACT,
          contractId);
    }
    return toFulfillmentEventResponse(fulfillmentEventMapper.findByTenantAndId(tenantId, eventId));
  }

  private ContractLedger requireContract(String tenantId, String contractId) {
    ContractLedger contract = contractMapper.findByTenantAndId(tenantId, contractId);
    if (contract == null) {
      throw new IllegalArgumentException("Contract not found in tenant scope: " + contractId);
    }
    return contract;
  }

  private void requireEditable(ContractLedger contract, String contractId) {
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("Archived contract can only be audited: " + contractId);
    }
  }

  private ContractResponse toResponse(ContractLedger contract) {
    return new ContractResponse(
        contract.id(),
        contract.tenantId(),
        contract.contractNo(),
        contract.contractName(),
        contract.relatedOrderId(),
        contract.supplierId(),
        contract.amount(),
        contract.status(),
        contract.archiveStatus(),
        contract.fulfillmentProgress(),
        contract.effectiveDate(),
        contract.createdAt(),
        contract.updatedAt(),
        contract.signDate(),
        contract.expiryDate(),
        contract.paymentTerms(),
        contract.warrantyTerms(),
        contract.renewalStatus());
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private ContractFulfillmentEventResponse toFulfillmentEventResponse(ContractFulfillmentEvent event) {
    return new ContractFulfillmentEventResponse(
        event.id(),
        event.tenantId(),
        event.contractId(),
        event.actionType(),
        event.targetId(),
        event.summary(),
        event.sourceLabel(),
        event.createdBy(),
        event.createdAt());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private String newId() {
    return "contract-" + UUID.randomUUID();
  }
}
