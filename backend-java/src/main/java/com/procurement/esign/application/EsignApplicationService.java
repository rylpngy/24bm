package com.procurement.esign.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.esign.api.CreateEsignRequest;
import com.procurement.esign.api.EsignRecordResponse;
import com.procurement.esign.domain.EsignRecord;
import com.procurement.esign.infrastructure.EsignRecordMapper;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.domain.Quote;
import com.procurement.tender.application.TenderApplicationService;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderBid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * 电子签单:关键单据(报价单/合同)的电子签署留痕。
 * 签署时服务端按单据关键字段计算 SHA-256 内容指纹,后续可核验单据是否被篡改;
 * 签名图为签署人手写笔迹(data URL),与签署人/企业/时间一并归档。
 */
@Service
public class EsignApplicationService {
  private static final int MAX_SIGNATURE_LENGTH = 200_000;

  private final EsignRecordMapper esignRecordMapper;
  private final ContractApplicationService contractApplicationService;
  private final QuoteApplicationService quoteApplicationService;
  private final TenderApplicationService tenderApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public EsignApplicationService(
      EsignRecordMapper esignRecordMapper,
      ContractApplicationService contractApplicationService,
      QuoteApplicationService quoteApplicationService,
      TenderApplicationService tenderApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.esignRecordMapper = esignRecordMapper;
    this.contractApplicationService = contractApplicationService;
    this.quoteApplicationService = quoteApplicationService;
    this.tenderApplicationService = tenderApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  // ── 采购方:合同电子签章 ────────────────────────────────────
  public EsignRecordResponse buyerSign(CreateEsignRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("esign APIs");
    String userId = TenantAccessGuard.requireUserId("esign APIs");
    requireSignature(request.signatureImage());
    if ("tender-award".equals(request.targetType())) {
      return buyerSignTenderAward(request, tenantId, userId);
    }
    if (!"contract".equals(request.targetType())) {
      throw new IllegalArgumentException("采购方当前仅支持合同/中标通知书电子签章: " + request.targetType());
    }
    ContractLedger contract =
        contractApplicationService.findCurrentTenantContractForEsign(request.targetId());
    String digest = sha256(
        "contract:" + contract.id()
            + "|no:" + contract.contractNo()
            + "|order:" + contract.relatedOrderId()
            + "|supplier:" + contract.supplierId()
            + "|amount:" + contract.amount());
    EsignRecord record = insert(
        tenantId, "contract", contract.id(), "BUYER", userId,
        request.signerName(), tenantId, digest, request.signatureImage(), request.remark());
    auditLogApplicationService.recordCurrentTenantAction(
        "contract.esigned", AuditTargetType.CONTRACT, contract.id(), "采购方电子签章");
    return toResponse(record);
  }

  // 中标通知书签章:指纹绑定 通知书正文 + 中标投标密封凭证(sealedDigest),开标链路可核验。
  private EsignRecordResponse buyerSignTenderAward(
      CreateEsignRequest request, String tenantId, String userId) {
    Tender tender = tenderApplicationService.findCurrentTenantAwardedTender(request.targetId());
    TenderBid awarded = tenderApplicationService.findAwardedBid(tender);
    String digest = sha256(
        "tender-award:" + tender.id() + "|bid:" + awarded.id() + "|supplier:" + awarded.supplierId()
            + "|sealedDigest:" + awarded.contentDigest() + "|notice:" + sha256(tender.awardNoticeHtml()));
    EsignRecord record = insert(
        tenantId, "tender-award", tender.id(), "BUYER", userId,
        request.signerName(), tenantId, digest, request.signatureImage(), request.remark());
    auditLogApplicationService.recordCurrentTenantAction(
        "tender.award_esigned", "tender", tender.id(), "招标人签章中标通知书");
    return toResponse(record);
  }

  public List<EsignRecordResponse> listForBuyer(String targetType, String targetId) {
    String tenantId = TenantAccessGuard.requireTenantId("esign APIs");
    return esignRecordMapper.listByTarget(tenantId, targetType, targetId).stream()
        .map(this::toResponse)
        .toList();
  }

  // ── 供应商:报价单电子签署 ──────────────────────────────────
  public EsignRecordResponse supplierSign(CreateEsignRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("esign APIs");
    String userId = TenantAccessGuard.requireUserId("esign APIs");
    requireSignature(request.signatureImage());
    if ("tender-bid".equals(request.targetType())) {
      return supplierSignTenderBid(request, supplierId, userId);
    }
    if (!"quote".equals(request.targetType())) {
      throw new IllegalArgumentException("供应商当前仅支持报价单/投标函电子签署: " + request.targetType());
    }
    Quote quote = quoteApplicationService.findSupplierOwnQuote(request.targetId());
    String digest = sha256(
        "quote:" + quote.id()
            + "|rfq:" + quote.rfqId()
            + "|supplier:" + quote.supplierId()
            + "|amount:" + quote.amount()
            + "|submittedAt:" + quote.submittedAt());
    EsignRecord record = insert(
        quote.tenantId(), "quote", quote.id(), "SUPPLIER", userId,
        request.signerName(), supplierId, digest, request.signatureImage(), request.remark());
    auditLogApplicationService.recordTenantAction(
        quote.tenantId(), "quote.esigned", AuditTargetType.QUOTE, quote.id(), "供应商报价单电子签署");
    return toResponse(record);
  }

  // 投标函签署:绑定密封投标(内容指纹与投标密封凭证同源),开标后可核验。
  private EsignRecordResponse supplierSignTenderBid(
      CreateEsignRequest request, String supplierId, String userId) {
    TenderBid bid = tenderApplicationService.findSupplierOwnBid(request.targetId());
    String digest = sha256(
        "tender-bid:" + bid.id() + "|tender:" + bid.tenderId() + "|supplier:" + bid.supplierId()
            + "|sealedDigest:" + bid.contentDigest());
    EsignRecord record = insert(
        bid.tenantId(), "tender-bid", bid.id(), "SUPPLIER", userId,
        request.signerName(), supplierId, digest, request.signatureImage(), request.remark());
    auditLogApplicationService.recordTenantAction(
        bid.tenantId(), "tender.bid_esigned", "tender", bid.tenderId(), "供应商投标函电子签署");
    return toResponse(record);
  }

  public List<EsignRecordResponse> listForSupplier(String targetType, String targetId) {
    if ("tender-bid".equals(targetType)) {
      TenderBid bid = tenderApplicationService.findSupplierOwnBid(targetId);
      return esignRecordMapper.listByTarget(bid.tenantId(), "tender-bid", bid.id()).stream()
          .map(this::toResponse)
          .toList();
    }
    if (!"quote".equals(targetType)) {
      throw new IllegalArgumentException("供应商当前仅支持查询报价单/投标函签署记录: " + targetType);
    }
    Quote quote = quoteApplicationService.findSupplierOwnQuote(targetId);
    return esignRecordMapper.listByTarget(quote.tenantId(), "quote", quote.id()).stream()
        .map(this::toResponse)
        .toList();
  }

  private EsignRecord insert(
      String tenantId,
      String targetType,
      String targetId,
      String signerScope,
      String signerId,
      String signerName,
      String enterpriseId,
      String digest,
      String signatureImage,
      String remark) {
    String id = "esign-" + UUID.randomUUID();
    esignRecordMapper.insert(
        id, tenantId, targetType, targetId, signerScope, signerId,
        signerName, enterpriseId, digest, signatureImage, remark);
    return new EsignRecord(
        id, tenantId, targetType, targetId, signerScope, signerId,
        signerName, enterpriseId, digest, signatureImage, null, remark);
  }

  private static void requireSignature(String signatureImage) {
    if (signatureImage == null || !signatureImage.startsWith("data:image/")) {
      throw new IllegalArgumentException("签名格式无效,请在签名板上手写签名后提交");
    }
    if (signatureImage.length() > MAX_SIGNATURE_LENGTH) {
      throw new IllegalArgumentException("签名图片过大,请清除后重新签名");
    }
  }

  private static String sha256(String content) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(md.digest(content.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Content digest failed", e);
    }
  }

  private EsignRecordResponse toResponse(EsignRecord r) {
    return new EsignRecordResponse(
        r.id(), r.targetType(), r.targetId(), r.signerScope(), r.signerId(),
        r.signerName(), r.enterpriseId(), r.contentDigest(), r.signatureImage(),
        r.signedAt(), r.remark());
  }
}
