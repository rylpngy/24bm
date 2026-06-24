package com.procurement.contract.application;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.api.ContractFulfillmentEventResponse;
import com.procurement.contract.api.ContractResponse;
import com.procurement.contract.api.CreateContractFulfillmentEventRequest;
import com.procurement.contract.api.CreateContractRequest;
import com.procurement.contract.api.ReviewContractApprovalRequest;
import com.procurement.contract.api.UpdateContractArchiveStatusRequest;
import com.procurement.contract.api.UpdateContractRequest;
import com.procurement.contract.api.UpdateContractStatusRequest;
import com.procurement.contract.domain.ContractFulfillmentEvent;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractFulfillmentEventMapper;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractApplicationService {
  private final ContractMapper contractMapper;
  private final ContractFulfillmentEventMapper fulfillmentEventMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public ContractApplicationService(
      ContractMapper contractMapper,
      PurchaseOrderMapper purchaseOrderMapper) {
    this(contractMapper, null, purchaseOrderMapper, null, null, null, null);
  }

  public ContractApplicationService(
      ContractMapper contractMapper,
      ContractFulfillmentEventMapper fulfillmentEventMapper,
      PurchaseOrderMapper purchaseOrderMapper) {
    this(contractMapper, fulfillmentEventMapper, purchaseOrderMapper, null, null, null, null);
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
        approvalTaskMapper,
        approvalTaskApplicationService,
        auditLogApplicationService,
        notificationApplicationService);
  }

  @Autowired
  public ContractApplicationService(
      ContractMapper contractMapper,
      ContractFulfillmentEventMapper fulfillmentEventMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.contractMapper = contractMapper;
    this.fulfillmentEventMapper = fulfillmentEventMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public List<ContractResponse> listCurrentTenantContracts(
      String status,
      String archiveStatus,
      String supplierId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    return contractMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(archiveStatus),
            blankToNull(supplierId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ContractResponse createCurrentTenantContract(CreateContractRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, request.relatedOrderId());
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found in tenant scope: " + request.relatedOrderId());
    }

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
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("Archived contract can only be audited: " + contractId);
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
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("Archived contract can only be audited: " + contractId);
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
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(request.archiveStatus())) {
      int blockers = contractMapper.countArchiveBlockers(tenantId, contractId);
      if (blockers > 0) {
        throw new IllegalStateException(
            "Contract archive conditions are not satisfied: receipt and payment must be completed: " + contractId);
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

  @Transactional
  public ContractResponse submitCurrentTenantContractApproval(String contractId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);
    if (!"草案".equals(contract.status())) {
      throw new IllegalStateException("Only draft contracts can submit approval: " + contractId);
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

  @Transactional
  public ContractResponse reviewCurrentTenantContractApproval(
      String contractId,
      ReviewContractApprovalRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    String userId = TenantAccessGuard.requireUserId("buyer contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    requireEditable(contract, contractId);
    if (!"审批中".equals(contract.status())) {
      throw new IllegalStateException("Only contracts in approval can be reviewed: " + contractId);
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
    String tenantId = TenantAccessGuard.requireTenantId("buyer contract APIs");
    requireContract(tenantId, contractId);
    return fulfillmentEventMapper.listByTenantAndContract(tenantId, contractId)
        .stream()
        .map(this::toFulfillmentEventResponse)
        .toList();
  }

  @Transactional
  public ContractFulfillmentEventResponse createCurrentTenantContractFulfillmentEvent(
      String contractId,
      CreateContractFulfillmentEventRequest request) {
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
        contract.warrantyTerms());
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
