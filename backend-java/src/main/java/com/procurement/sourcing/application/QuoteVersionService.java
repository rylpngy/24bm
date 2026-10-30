package com.procurement.sourcing.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.*;
import com.procurement.sourcing.domain.*;
import com.procurement.sourcing.infrastructure.QuotationMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class QuoteVersionService {
  private final QuotationMapper mapper;
  private final ObjectMapper json;
  public QuoteVersionService(QuotationMapper mapper,ObjectMapper json){this.mapper=mapper;this.json=json;}
  public record Snapshot(QuoteResponse quote,QuotationDetails details,boolean complete) {}
  public record VersionView(String quoteId,int versionNo,int round,String source,String actorId,
      OffsetDateTime createdAt,Snapshot snapshot) {}
  private static final Set<String> INVOICE_TYPES=Set.of("增值税专用发票","增值税普通发票","其他合法票据");

  public boolean strict(Rfq rfq) {
    var policy=mapper.policy(rfq.tenantId(),rfq.id());
    return policy!=null&&policy.fullQuoteRequired();
  }

  public boolean validate(Rfq rfq,String supplier,QuotationDetails details,BigDecimal tax,Integer days,List<QuoteLineItemRequest> lines) {
    if(details!=null){
      if(details.invoiceType()!=null&&!INVOICE_TYPES.contains(details.invoiceType()))throw new IllegalArgumentException("请选择有效的发票类型");
      var ids=details.attachmentIds()==null?List.<String>of():details.attachmentIds();
      if(new HashSet<>(ids).size()!=ids.size())throw new IllegalArgumentException("报价附件不能重复");
      for(String id:ids){
        var file=mapper.file(id);
        if(file==null||!rfq.tenantId().equals(file.tenantId())||!rfq.id().equals(file.rfqId())||!supplier.equals(file.supplierId()))
          throw new PermissionDeniedException("报价附件不属于本供应商的当前项目");
      }
      if(details.lines()!=null){
        Set<String> keys=new HashSet<>();
        Set<String> quoted=new HashSet<>();if(lines!=null)lines.forEach(line->quoted.add(line.demandItemId()));
        for(var line:details.lines())if(line==null||line.demandItemId()==null||!quoted.contains(line.demandItemId())||!keys.add(line.demandItemId()))
          throw new IllegalArgumentException("技术响应必须逐行对应本次报价清单，不能重复或跨项目");
      }
    }
    boolean complete=details!=null&&INVOICE_TYPES.contains(Objects.toString(details.invoiceType(),""))
        &&tax!=null&&tax.signum()>=0&&tax.compareTo(BigDecimal.valueOf(100))<=0&&days!=null&&days>0
        &&lines!=null&&!lines.isEmpty()&&details.lines()!=null&&details.lines().size()==lines.size()
        &&details.attachmentIds()!=null&&!details.attachmentIds().isEmpty()
        &&details.lines().stream().allMatch(line->present(line.brand())&&present(line.model())&&present(line.technicalParameters())&&present(line.technicalResponse()));
    if(strict(rfq)&&!complete)throw new IllegalArgumentException("完整报价须填写发票类型、税率、交期和全部行的品牌、型号、技术参数及响应，并上传报价附件");
    return complete;
  }

  public void checkVersion(Rfq rfq,Quote quote,Integer expected) {
    var latest=mapper.latest(quote.tenantId(),quote.id());int actual=latest==null?0:latest.versionNo();
    if((expected!=null&&expected!=actual)||(strict(rfq)&&expected==null))throw new IllegalStateException("报价版本已变化，请刷新后修改，当前版本为"+actual);
  }
  public void captureLegacy(Rfq rfq,Quote quote,QuoteResponse response) {
    if(mapper.latest(quote.tenantId(),quote.id())==null)record(rfq,response,null,false,"legacy",null,quote.submittedAt());
  }
  public void record(Rfq rfq,QuoteResponse quote,QuotationDetails details,boolean complete) {
    record(rfq,quote,details,complete,"submitted",TenantAccessGuard.requireUserId("quote version"),OffsetDateTime.now());
  }
  private void record(Rfq rfq,QuoteResponse quote,QuotationDetails details,boolean complete,String source,String actor,OffsetDateTime time) {
    var latest=mapper.latest(rfq.tenantId(),quote.id());
    try{mapper.insertVersion(new QuotationMapper.Version("qv-"+UUID.randomUUID(),rfq.tenantId(),quote.id(),rfq.id(),quote.supplierId(),
        latest==null?1:latest.versionNo()+1,rfq.currentRound(),source,actor,json.writeValueAsString(new Snapshot(quote,details,complete)),time));}
    catch(com.fasterxml.jackson.core.JsonProcessingException exception){throw new IllegalStateException("无法保存报价版本",exception);}
  }
  public VersionView view(QuotationMapper.Version version) {
    try{return new VersionView(version.quoteId(),version.versionNo(),version.round(),version.source(),version.actorId(),version.createdAt(),
        json.readValue(version.snapshotJson(),Snapshot.class));}
    catch(com.fasterxml.jackson.core.JsonProcessingException exception){throw new IllegalStateException("报价版本数据无法读取",exception);}
  }
  public int validCount(Rfq rfq,List<Quote> quotes) {
    return (int)quotes.stream().filter(quote->quote.amount()!=null&&quote.amount().signum()>0)
        .filter(quote->Set.of(QuoteStatus.SUBMITTED,QuoteStatus.LOCKED,QuoteStatus.AWARDED,QuoteStatus.NOT_SELECTED).contains(quote.status()))
        .filter(quote->{var latest=mapper.latest(rfq.tenantId(),quote.id());return !strict(rfq)||(latest!=null&&view(latest).snapshot().complete());})
        .map(Quote::supplierId).distinct().count();
  }
  private static boolean present(String value){return value!=null&&!value.isBlank();}
}
