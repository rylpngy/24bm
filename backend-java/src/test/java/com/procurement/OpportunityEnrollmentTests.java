package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.EnrollOpportunityRequest;
import com.procurement.sourcing.application.OpportunityApplicationService;
import com.procurement.sourcing.domain.RfqEnrollment;
import com.procurement.sourcing.infrastructure.PublicOpportunityMapper;
import com.procurement.sourcing.infrastructure.RfqEnrollmentMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 公开商机报名闭环:报名登记(仅报价中/防重复)→ 买方受理(须平台认证供应商)→ 转正式邀请。
class OpportunityEnrollmentTests {

  private final PublicOpportunityMapper publicOpportunityMapper = mock(PublicOpportunityMapper.class);
  private final RfqEnrollmentMapper rfqEnrollmentMapper = mock(RfqEnrollmentMapper.class);
  private final RfqInviteMapper rfqInviteMapper = mock(RfqInviteMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      mock(NotificationApplicationService.class);
  private final OpportunityApplicationService service = new OpportunityApplicationService(
      publicOpportunityMapper,
      rfqEnrollmentMapper,
      rfqInviteMapper,
      notificationApplicationService,
      mock(AuditLogApplicationService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  private static RfqEnrollment pending(String company) {
    return new RfqEnrollment(
        "enr-1", "tenant-1", "rfq-1", company, "李经理", "13800000000", "", "待处理", null, null);
  }

  @Test
  void enrollRequiresQuotingRfqAndRejectsDuplicates() {
    when(publicOpportunityMapper.findEnrollableTenantId("rfq-x")).thenReturn(null);
    assertThatThrownBy(() -> service.enroll("rfq-x",
        new EnrollOpportunityRequest("新供应商", "李经理", "13800000000", null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("报名期");

    when(publicOpportunityMapper.findEnrollableTenantId("rfq-1")).thenReturn("tenant-1");
    when(rfqEnrollmentMapper.countPending("tenant-1", "rfq-1", "新供应商")).thenReturn(1);
    assertThatThrownBy(() -> service.enroll("rfq-1",
        new EnrollOpportunityRequest("新供应商", "李经理", "13800000000", null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("重复");

    when(rfqEnrollmentMapper.countPending("tenant-1", "rfq-1", "首次报名公司")).thenReturn(0);
    service.enroll("rfq-1", new EnrollOpportunityRequest("首次报名公司", "李经理", "13800000000", "备注"));
    verify(rfqEnrollmentMapper).insert(
        anyString(), eq("tenant-1"), eq("rfq-1"), eq("首次报名公司"), eq("李经理"), eq("13800000000"), eq("备注"));
  }

  @Test
  void acceptEnrollmentInvitesMatchedVerifiedSupplier() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqEnrollmentMapper.findByTenantAndId("tenant-1", "enr-1"))
        .thenReturn(pending("晨光科技供应商"), new RfqEnrollment(
            "enr-1", "tenant-1", "rfq-1", "晨光科技供应商", "李经理", "13800000000", "", "已受邀", null, null));
    when(publicOpportunityMapper.findVerifiedSupplierIdByName("晨光科技供应商"))
        .thenReturn("ent-supplier-sunrise");
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of());
    when(rfqEnrollmentMapper.updateStatus("tenant-1", "enr-1", "已受邀")).thenReturn(1);

    var result = service.acceptEnrollment("rfq-1", "enr-1");

    assertThat(result.status()).isEqualTo("已受邀");
    verify(rfqInviteMapper).insert(anyString(), eq("tenant-1"), eq("rfq-1"), eq("ent-supplier-sunrise"), eq("已邀请"));
    verify(notificationApplicationService).notifyActiveSupplierUsers(
        eq("tenant-1"), eq("ent-supplier-sunrise"), anyString(), anyString());
  }

  @Test
  void acceptEnrollmentRejectsUnregisteredCompany() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqEnrollmentMapper.findByTenantAndId("tenant-1", "enr-1")).thenReturn(pending("野生公司"));
    when(publicOpportunityMapper.findVerifiedSupplierIdByName("野生公司")).thenReturn(null);

    assertThatThrownBy(() -> service.acceptEnrollment("rfq-1", "enr-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("尚未入驻平台");
    verify(rfqInviteMapper, never()).insert(anyString(), anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void dismissEnrollmentMarksIgnored() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqEnrollmentMapper.findByTenantAndId("tenant-1", "enr-1"))
        .thenReturn(pending("某公司"), new RfqEnrollment(
            "enr-1", "tenant-1", "rfq-1", "某公司", "李经理", "13800000000", "", "已忽略", null, null));
    when(rfqEnrollmentMapper.updateStatus("tenant-1", "enr-1", "已忽略")).thenReturn(1);

    assertThat(service.dismissEnrollment("rfq-1", "enr-1").status()).isEqualTo("已忽略");
  }
}
