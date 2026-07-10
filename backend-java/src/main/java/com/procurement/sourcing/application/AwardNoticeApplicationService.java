package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.AwardNoticeResponse;
import com.procurement.sourcing.api.AwardNoticeVerifyResponse;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.AwardNoticeSignature;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAwardNotice;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqAwardNoticeMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.UncheckedIOException;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 中标通知书:签发(电子签章留痕)+ 查询 + 生成 PDF(OpenPDF,含中文与红色印章)。
@Service
public class AwardNoticeApplicationService {

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy 年 MM 月 dd 日");

  private final RfqMapper rfqMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final RfqAwardNoticeMapper rfqAwardNoticeMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public AwardNoticeApplicationService(
      RfqMapper rfqMapper,
      AwardDecisionMapper awardDecisionMapper,
      RfqAwardNoticeMapper rfqAwardNoticeMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.rfqMapper = rfqMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.rfqAwardNoticeMapper = rfqAwardNoticeMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  // 签发(盖章):仅已定标可签发,幂等(已签发则返回原记录)。
  @Transactional
  public AwardNoticeResponse issue(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    Rfq rfq = requireAwardedRfq(tenantId, rfqId);
    AwardDecision award = requireApprovedAward(tenantId, rfqId);

    RfqAwardNotice existing = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
    if (existing == null) {
      String sealNo = "ZB-" + Integer.toHexString(rfqId.hashCode()).toUpperCase();
      rfqAwardNoticeMapper.insert(rfqId, tenantId, award.id(), sealNo, userId);
      existing = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
      // 数字签名:对规范化通知内容签名(含签发时间),落库供验签防伪。
      String signature = AwardNoticeSignature.sign(canonicalFor(rfq, award, existing));
      rfqAwardNoticeMapper.updateSignature(tenantId, rfqId, signature);
      auditLogApplicationService.recordTenantAction(
          tenantId, "rfq.notice_issued", "rfq", rfqId,
          "签发中标通知书 · 印章 " + sealNo + " · 数字签名 " + signature.substring(0, 12) + "…");
      existing = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
    }
    return toResponse(existing, award.supplierId());
  }

  public AwardNoticeResponse get(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    RfqAwardNotice notice = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
    AwardDecision award = awardDecisionMapper.findApprovedByRfq(tenantId, rfqId, ApprovalStatus.APPROVED);
    if (notice == null) {
      return new AwardNoticeResponse(
          rfqId, false, null, null, null, award == null ? null : award.supplierId(), null);
    }
    return toResponse(notice, award == null ? null : award.supplierId());
  }

  // 验签:重算规范化内容的签名与落库签名比对,不一致即视为被篡改。
  public AwardNoticeVerifyResponse verify(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    RfqAwardNotice notice = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
    if (notice == null) {
      return new AwardNoticeVerifyResponse(rfqId, false, false, AwardNoticeSignature.ALGORITHM, null);
    }
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    AwardDecision award = awardDecisionMapper.findApprovedByRfq(tenantId, rfqId, ApprovalStatus.APPROVED);
    boolean valid = rfq != null && award != null
        && AwardNoticeSignature.verify(canonicalFor(rfq, award, notice), notice.signature());
    return new AwardNoticeVerifyResponse(
        rfqId, true, valid, AwardNoticeSignature.ALGORITHM, notice.signature());
  }

  private String canonicalFor(Rfq rfq, AwardDecision award, RfqAwardNotice notice) {
    return AwardNoticeSignature.canonical(
        rfq.id(), rfq.title(), rfq.method(),
        award.supplierId(), award.amount() == null ? "" : award.amount().toPlainString(),
        notice.sealNo(), notice.issuedBy(),
        notice.issuedAt() == null ? "" : notice.issuedAt().toString());
  }

  // 生成中标通知书 PDF(需已签发,含电子签章)。
  public byte[] renderPdf(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = requireAwardedRfq(tenantId, rfqId);
    AwardDecision award = requireApprovedAward(tenantId, rfqId);
    RfqAwardNotice notice = rfqAwardNoticeMapper.findByTenantAndRfq(tenantId, rfqId);
    if (notice == null) {
      throw new IllegalStateException("Award notice not issued yet: " + rfqId);
    }
    return build(rfq, award, notice);
  }

  private byte[] build(Rfq rfq, AwardDecision award, RfqAwardNotice notice) {
    Document document = new Document(PageSize.A4, 56, 56, 56, 56);
    try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      PdfWriter.getInstance(document, out);
      document.open();
      BaseFont cjk = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
      Font titleFont = new Font(cjk, 20, Font.BOLD);
      Font bodyFont = new Font(cjk, 12);
      Font sealFont = new Font(cjk, 13, Font.BOLD, new Color(192, 32, 32));

      Paragraph title = new Paragraph("中标通知书", titleFont);
      title.setAlignment(Element.ALIGN_CENTER);
      title.setSpacingAfter(24);
      document.add(title);

      String amount = award.amount() == null ? "—" : award.amount().toPlainString();
      String body = "致 " + award.supplierId() + ":\n\n"
          + "    贵单位参与的项目「" + rfq.title() + "」(采购方式:" + rfq.method() + "),"
          + "经评定，确定贵单位为本项目中标人，中标含税总价 人民币 ¥" + amount + " 元。\n\n"
          + "    请贵单位接此通知后，按招采文件及报价承诺与我方签订合同并组织履约。特此通知。";
      Paragraph bodyPara = new Paragraph(body, bodyFont);
      bodyPara.setSpacingAfter(36);
      bodyPara.setLeading(22);
      document.add(bodyPara);

      Paragraph seal = new Paragraph(
          "电子签章(印章号 " + notice.sealNo() + ")\n签发人:" + notice.issuedBy()
              + "\n签发日期:" + (notice.issuedAt() == null ? "" : notice.issuedAt().format(DATE)),
          sealFont);
      seal.setAlignment(Element.ALIGN_RIGHT);
      seal.setLeading(20);
      document.add(seal);

      // 防伪数字签名(HMAC-SHA256),可在线验签。
      Font signFont = new Font(cjk, 8, Font.NORMAL, new Color(120, 120, 120));
      String sig = notice.signature() == null ? "" : notice.signature();
      Paragraph signPara = new Paragraph(
          "防伪数字签名(" + AwardNoticeSignature.ALGORITHM + "):" + sig, signFont);
      signPara.setAlignment(Element.ALIGN_RIGHT);
      signPara.setSpacingBefore(16);
      document.add(signPara);

      document.close();
      return out.toByteArray();
    } catch (Exception exception) {
      throw new UncheckedIOException(new java.io.IOException("Failed to render notice pdf", exception));
    }
  }

  private Rfq requireAwardedRfq(String tenantId, String rfqId) {
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!RfqStatus.AWARDED.equals(rfq.status())) {
      throw new IllegalStateException("Only awarded RFQs have an award notice: " + rfqId);
    }
    return rfq;
  }

  private AwardDecision requireApprovedAward(String tenantId, String rfqId) {
    AwardDecision award = awardDecisionMapper.findApprovedByRfq(tenantId, rfqId, ApprovalStatus.APPROVED);
    if (award == null) {
      throw new IllegalStateException("No approved award decision for RFQ: " + rfqId);
    }
    return award;
  }

  private AwardNoticeResponse toResponse(RfqAwardNotice notice, String winnerSupplierId) {
    return new AwardNoticeResponse(
        notice.rfqId(), true, notice.sealNo(), notice.issuedBy(), notice.issuedAt(),
        winnerSupplierId, notice.signature());
  }
}
