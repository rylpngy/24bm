package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.EnrollOpportunityRequest;
import com.procurement.sourcing.api.PublicOpportunityResponse;
import com.procurement.sourcing.api.RfqEnrollmentResponse;
import com.procurement.sourcing.domain.RfqAuditAction;
import com.procurement.sourcing.domain.RfqEnrollment;
import com.procurement.sourcing.infrastructure.PublicOpportunityMapper;
import com.procurement.sourcing.infrastructure.RfqEnrollmentMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 公开商机与报名参与:门户访客报名登记 → 采购方审核 → 转正式邀请接通报价链路。
@Service
public class OpportunityApplicationService {
  private final PublicOpportunityMapper publicOpportunityMapper;
  private final RfqEnrollmentMapper rfqEnrollmentMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final NotificationApplicationService notificationApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public OpportunityApplicationService(
      PublicOpportunityMapper publicOpportunityMapper,
      RfqEnrollmentMapper rfqEnrollmentMapper,
      RfqInviteMapper rfqInviteMapper,
      NotificationApplicationService notificationApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.publicOpportunityMapper = publicOpportunityMapper;
    this.rfqEnrollmentMapper = rfqEnrollmentMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.notificationApplicationService = notificationApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  // ====== 公开侧(无租户上下文)======

  public List<PublicOpportunityResponse> listPublicOpportunities() {
    return publicOpportunityMapper.listPublicOpportunities();
  }

  public PublicOpportunityResponse getPublicOpportunity(String rfqId) {
    PublicOpportunityResponse opportunity = publicOpportunityMapper.findPublicOpportunityById(rfqId);
    if (opportunity == null) {
      throw new IllegalArgumentException("商机不存在或未公开: " + rfqId);
    }
    return opportunity;
  }

  /** 报名参与:仅报价中的项目可报名;同一项目同一企业仅一条待处理报名。 */
  @Transactional
  public void enroll(String rfqId, EnrollOpportunityRequest request) {
    String tenantId = publicOpportunityMapper.findEnrollableTenantId(rfqId);
    if (tenantId == null) {
      throw new IllegalStateException("该商机不在报名期(仅报价中的项目可报名): " + rfqId);
    }
    if (rfqEnrollmentMapper.countPending(tenantId, rfqId, request.companyName().strip()) > 0) {
      throw new IllegalStateException("该企业已报名此项目,请勿重复提交: " + request.companyName());
    }
    rfqEnrollmentMapper.insert(
        "enr-" + UUID.randomUUID(),
        tenantId,
        rfqId,
        request.companyName().strip(),
        request.contactName().strip(),
        request.contactPhone().strip(),
        request.note() == null ? "" : request.note().strip());
  }

  // ====== 买方侧(租户上下文)======

  public List<RfqEnrollmentResponse> listEnrollments(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqEnrollmentMapper.listByRfq(tenantId, rfqId).stream().map(this::toResponse).toList();
  }

  /** 受理报名:报名企业须已是平台认证供应商(按企业名精确匹配),转为正式邀请后即可报价。 */
  @Transactional
  public RfqEnrollmentResponse acceptEnrollment(String rfqId, String enrollmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    RfqEnrollment enrollment = requirePendingEnrollment(tenantId, rfqId, enrollmentId);
    String supplierId = publicOpportunityMapper.findVerifiedSupplierIdByName(enrollment.companyName());
    if (supplierId == null) {
      throw new IllegalStateException(
          "报名企业「" + enrollment.companyName() + "」尚未入驻平台或未通过认证,请先通过「供应商邀请」引导其入驻");
    }
    boolean alreadyInvited = rfqInviteMapper.listSupplierIds(tenantId, rfqId).contains(supplierId);
    if (!alreadyInvited) {
      rfqInviteMapper.insert("rfq-invite-" + UUID.randomUUID(), tenantId, rfqId, supplierId, "已邀请");
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          "商机报名已受理",
          "您报名的项目已受理并向您发出询价邀请,请在项目截止前提交报价。");
    }
    if (rfqEnrollmentMapper.updateStatus(tenantId, enrollmentId, "已受邀") == 0) {
      throw new IllegalStateException("报名状态已变化,请刷新后重试: " + enrollmentId);
    }
    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.UPDATED, AuditTargetType.RFQ, rfqId);
    return toResponse(rfqEnrollmentMapper.findByTenantAndId(tenantId, enrollmentId));
  }

  /** 忽略报名(留痕,可在列表中追溯)。 */
  @Transactional
  public RfqEnrollmentResponse dismissEnrollment(String rfqId, String enrollmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    requirePendingEnrollment(tenantId, rfqId, enrollmentId);
    if (rfqEnrollmentMapper.updateStatus(tenantId, enrollmentId, "已忽略") == 0) {
      throw new IllegalStateException("报名状态已变化,请刷新后重试: " + enrollmentId);
    }
    return toResponse(rfqEnrollmentMapper.findByTenantAndId(tenantId, enrollmentId));
  }

  private RfqEnrollment requirePendingEnrollment(String tenantId, String rfqId, String enrollmentId) {
    RfqEnrollment enrollment = rfqEnrollmentMapper.findByTenantAndId(tenantId, enrollmentId);
    if (enrollment == null || !enrollment.rfqId().equals(rfqId)) {
      throw new IllegalArgumentException("报名记录不存在: " + enrollmentId);
    }
    if (!"待处理".equals(enrollment.status())) {
      throw new IllegalStateException("报名已处理,当前状态: " + enrollment.status());
    }
    return enrollment;
  }

  private RfqEnrollmentResponse toResponse(RfqEnrollment e) {
    return new RfqEnrollmentResponse(
        e.id(),
        e.rfqId(),
        e.companyName(),
        e.contactName(),
        e.contactPhone(),
        e.note(),
        e.status(),
        e.createdAt(),
        publicOpportunityMapper.findVerifiedSupplierIdByName(e.companyName()));
  }
}
