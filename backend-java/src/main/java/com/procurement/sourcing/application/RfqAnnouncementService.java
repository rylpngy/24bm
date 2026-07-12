package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.PublicProcurementAnnouncementResponse;
import com.procurement.sourcing.api.RfqAnnouncementResponse;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAnnouncement;
import com.procurement.sourcing.infrastructure.PublicProcurementAnnouncementMapper;
import com.procurement.sourcing.infrastructure.RfqAnnouncementMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 采购公告登记与查询:公告由业务事件自动模板化生成(采购/变更/定标/终止),门户公开可见。
@Service
public class RfqAnnouncementService {
  private final RfqAnnouncementMapper rfqAnnouncementMapper;
  private final PublicProcurementAnnouncementMapper publicProcurementAnnouncementMapper;

  public RfqAnnouncementService(
      RfqAnnouncementMapper rfqAnnouncementMapper,
      PublicProcurementAnnouncementMapper publicProcurementAnnouncementMapper) {
    this.rfqAnnouncementMapper = rfqAnnouncementMapper;
    this.publicProcurementAnnouncementMapper = publicProcurementAnnouncementMapper;
  }

  // ── 事件登记(模板化正文由真实业务字段生成) ──────────────────

  public void onPublished(String tenantId, Rfq rfq) {
    insert(tenantId, rfq, "采购公告", rfq.title() + " 采购公告",
        "现对「" + rfq.title() + "」进行" + method(rfq) + "采购,欢迎符合条件的供应商参与报价。"
            + (rfq.deadlineAt() == null ? "" : "报价截止 " + rfq.deadlineAt().toLocalDate() + "。"),
        null, null, null);
  }

  public void onBulletin(String tenantId, Rfq rfq, String content) {
    insert(tenantId, rfq, "变更公告", rfq.title() + " 变更公告(补遗)",
        "采购方对「" + rfq.title() + "」发布补遗:" + content, null, null, null);
  }

  public void onNewRound(String tenantId, Rfq rfq, int nextRound, boolean finalRound) {
    insert(tenantId, rfq, "变更公告", rfq.title() + " 变更公告(第" + nextRound + "轮报价)",
        "「" + rfq.title() + "」发起第 " + nextRound + " 轮报价" + (finalRound ? "(最终轮)" : "")
            + ",受邀供应商请按新截止时间重新提交报价。",
        null, null, null);
  }

  public void onResultAnnounced(String tenantId, Rfq rfq, BigDecimal awardAmount) {
    String supplierName = rfq.awardedSupplierId() == null
        ? null
        : rfqAnnouncementMapper.findSupplierName(rfq.awardedSupplierId());
    insert(tenantId, rfq, "定标公告", rfq.title() + " 定标公告",
        "「" + rfq.title() + "」" + method(rfq) + "采购已定标,中标供应商:"
            + (supplierName == null ? rfq.awardedSupplierId() : supplierName)
            + (awardAmount == null ? "" : ",中标含税总价 ¥" + awardAmount.toPlainString())
            + "。特此公示。",
        supplierName, awardAmount, null);
  }

  public void onAborted(String tenantId, Rfq rfq, String kind, String reason) {
    insert(tenantId, rfq, "终止公告", rfq.title() + " " + kind + "公告",
        "「" + rfq.title() + "」" + method(rfq) + "采购项目已" + kind
            + (reason == null || reason.isBlank() ? "" : ",原因:" + reason)
            + "。关联采购需求已释放,后续如重新采购将另行公告。",
        null, null, kind + (reason == null || reason.isBlank() ? "" : ":" + reason));
  }

  // ── 查询 ─────────────────────────────────────────────

  public List<RfqAnnouncementResponse> listForRfq(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqAnnouncementMapper.listByTenantAndRfq(tenantId, rfqId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PublicProcurementAnnouncementResponse> listPublic() {
    return publicProcurementAnnouncementMapper.listPublicAnnouncements();
  }

  public PublicProcurementAnnouncementResponse getPublic(String id) {
    PublicProcurementAnnouncementResponse found =
        publicProcurementAnnouncementMapper.findPublicAnnouncementById(id);
    if (found == null) {
      throw new IllegalArgumentException("公告不存在: " + id);
    }
    return found;
  }

  private void insert(
      String tenantId,
      Rfq rfq,
      String type,
      String title,
      String summary,
      String awardedSupplierName,
      BigDecimal awardAmount,
      String closeReason) {
    rfqAnnouncementMapper.insert(
        "rfq-ann-" + UUID.randomUUID(),
        tenantId,
        rfq.id(),
        type,
        title,
        summary,
        method(rfq),
        rfq.deadlineAt(),
        rfq.evaluationMethod(),
        rfq.quoteRequirement(),
        rfq.deliveryRequirement(),
        awardedSupplierName,
        awardAmount,
        closeReason);
  }

  private static String method(Rfq rfq) {
    return rfq.method() == null || rfq.method().isBlank() ? "询价" : rfq.method();
  }

  private RfqAnnouncementResponse toResponse(RfqAnnouncement a) {
    return new RfqAnnouncementResponse(
        a.id(), a.rfqId(), a.type(), a.title(), a.summary(), a.method(), a.deadlineAt(),
        a.evaluationMethod(), a.quoteRequirement(), a.deliveryRequirement(),
        a.awardedSupplierName(), a.awardAmount(), a.closeReason(), a.publishedAt());
  }
}
