package com.procurement.sourcing.application;

import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.infrastructure.*;
import com.procurement.sourcing.domain.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqQuotationService {
  private final RfqApplicationService rfqs;
  private final RfqMapper rows;
  private final QuoteMapper quotes;
  private final QuotationMapper mapper;
  private final RfqInviteMapper invitations;
  private final QuoteVersionService versions;
  private final PermissionService permissions;
  private final ObjectStorageService storage;
  private final NotificationApplicationService notifications;
  public RfqQuotationService(RfqApplicationService rfqs,RfqMapper rows,QuoteMapper quotes,QuotationMapper mapper,
      RfqInviteMapper invitations,QuoteVersionService versions,PermissionService permissions,
      ObjectStorageService storage,NotificationApplicationService notifications) {
    this.rfqs=rfqs;this.rows=rows;this.quotes=quotes;this.mapper=mapper;this.invitations=invitations;
    this.versions=versions;this.permissions=permissions;this.storage=storage;this.notifications=notifications;
  }
  public record FileView(String id,String fileName,long contentSize,String sha256,OffsetDateTime createdAt) {}
  public record Package(QuotationMapper.Policy policy,int validQuoteCount,int round,OffsetDateTime deadlineAt,
      List<QuoteVersionService.VersionView> versions,List<FileView> files,List<QuotationMapper.Extension> extensions,boolean sealed,
      List<String> submittedSupplierIds) {}
  public record Download(String fileName,byte[] data) {}
  public record PolicyRequest(boolean fullQuoteRequired,boolean autoExtend,int extensionHours,int maxAutoExtensions) {}
  public record ExtendRequest(OffsetDateTime expectedDeadline,OffsetDateTime newDeadline,String reason) {}

  public Rfq buyer(String id,boolean write) {
    permissions.require(write?"buyer:rfq:manage":"buyer:rfq:read");
    if(write)rfqs.requireWriteAccess(id);else rfqs.requireReadAccess(id);
    return rows.findByTenantAndId(TenantAccessGuard.requireTenantId("RFQ quotation"),id);
  }
  public Rfq supplier(String id) {
    permissions.require("supplier:quote:submit");
    var rfq=rows.findBySupplierInvite(id,TenantAccessGuard.requireSupplierId("RFQ quotation"));
    if(rfq==null)throw new PermissionDeniedException("未受邀参与此项目");
    return rfq;
  }
  public QuotationMapper.Policy policy(Rfq rfq) {
    var value=mapper.policy(rfq.tenantId(),rfq.id());
    return value==null?new QuotationMapper.Policy(rfq.tenantId(),rfq.id(),false,false,24,2):value;
  }
  public int count(Rfq rfq) {
    Set<String> invited=new HashSet<>(invitations.listSupplierIds(rfq.tenantId(),rfq.id()));
    return versions.validCount(rfq,quotes.listByTenantAndRfqAndRound(rfq.tenantId(),rfq.id(),rfq.currentRound()).stream()
        .filter(quote->invited.contains(quote.supplierId())).toList());
  }
  public Package read(String id,boolean supplierSide) {
    var rfq=supplierSide?supplier(id):buyer(id,false);
    String supplier=supplierSide?TenantAccessGuard.requireSupplierId("quotation"):null;
    boolean sealed=!supplierSide&&rfq.openedAt()==null;
    var history=sealed?List.<QuoteVersionService.VersionView>of():mapper.versions(rfq.tenantId(),id).stream()
        .filter(version->supplier==null||supplier.equals(version.supplierId())).map(versions::view).toList();
    var files=new LinkedHashMap<String,FileView>();
    if(supplierSide)mapper.files(rfq.tenantId(),id,supplier).forEach(file->files.put(file.id(),view(file)));
    else for(var version:history)if(version.snapshot().details()!=null&&version.snapshot().details().attachmentIds()!=null)
      for(String fileId:version.snapshot().details().attachmentIds()){
        var file=mapper.file(fileId);if(file!=null&&rfq.tenantId().equals(file.tenantId())&&rfq.id().equals(file.rfqId()))files.put(fileId,view(file));
      }
    return new Package(policy(rfq),supplierSide?0:count(rfq),rfq.currentRound(),rfq.deadlineAt(),history,List.copyOf(files.values()),
        mapper.extensions(rfq.tenantId(),id),sealed,supplierSide?List.of():quotes.listByTenantAndRfqAndRound(rfq.tenantId(),id,rfq.currentRound()).stream().map(Quote::supplierId).distinct().toList());
  }
  @Transactional public QuotationMapper.Policy configure(String id,PolicyRequest request) {
    var rfq=buyer(id,true);rows.lockByTenantAndId(rfq.tenantId(),id);rfq=rows.findByTenantAndId(rfq.tenantId(),id);
    requireInquiry(rfq);
    if(!Set.of(RfqStatus.DRAFT,RfqStatus.QUOTING).contains(rfq.status())||rfq.deadlineAt()==null||!rfq.deadlineAt().isAfter(OffsetDateTime.now()))
      throw new IllegalStateException("仅可在报价截止前配置询比规则");
    if(!quotes.listByTenantAndRfqAndRound(rfq.tenantId(),id,rfq.currentRound()).isEmpty())throw new IllegalStateException("已有报价，不能改变本轮报价规则");
    if(request.extensionHours()<1||request.extensionHours()>720||request.maxAutoExtensions()<0||request.maxAutoExtensions()>5)
      throw new IllegalArgumentException("延期应为1至720小时，自动延期上限为0至5次");
    var value=new QuotationMapper.Policy(rfq.tenantId(),id,request.fullQuoteRequired(),request.autoExtend(),request.extensionHours(),request.maxAutoExtensions());
    mapper.savePolicy(value);return value;
  }
  @Transactional public FileView upload(String id,String name,byte[] bytes) {
    var rfq=supplier(id);rows.lockByTenantAndId(rfq.tenantId(),id);rfq=rows.findBySupplierInvite(id,TenantAccessGuard.requireSupplierId("quotation"));
    if(rfq==null||!RfqStatus.QUOTING.equals(rfq.status())||rfq.deadlineAt()==null||!rfq.deadlineAt().isAfter(OffsetDateTime.now()))
      throw new IllegalStateException("当前项目不能上传报价材料");
    if(name==null||name.isBlank()||name.length()>180||name.chars().anyMatch(c->c<32||c=='/'||c=='\\'))throw new IllegalArgumentException("文件名不合法");
    if(bytes==null||bytes.length==0||bytes.length>10*1024*1024)throw new IllegalArgumentException("报价附件须为1字节至10MB");
    String supplier=TenantAccessGuard.requireSupplierId("quotation"),fileId="qfile-"+UUID.randomUUID();
    String key="quotation-files/"+rfq.tenantId()+"/"+rfq.id()+"/"+supplier+"/"+UUID.randomUUID();
    storage.put(key,bytes,"application/octet-stream");
    var file=new QuotationMapper.FileRow(fileId,rfq.tenantId(),id,supplier,name,key,bytes.length,hash(bytes),TenantAccessGuard.requireUserId("quotation"),OffsetDateTime.now());
    mapper.insertFile(file);return view(file);
  }
  public Download download(String id,String fileId,boolean supplierSide) {
    var pack=read(id,supplierSide);
    if(pack.files().stream().noneMatch(file->file.id().equals(fileId)))throw new PermissionDeniedException("无权下载此报价材料，采购方须先开标");
    var file=mapper.file(fileId);var object=storage.get(file.storageKey());
    if(object.data().length!=file.contentSize()||!hash(object.data()).equals(file.sha256()))throw new IllegalStateException("报价附件完整性核验失败");
    return new Download(file.fileName(),object.data());
  }
  @Transactional public QuotationMapper.Extension extend(String id,ExtendRequest request) {
    var rfq=buyer(id,true);rows.lockByTenantAndId(rfq.tenantId(),id);rfq=rows.findByTenantAndId(rfq.tenantId(),id);
    if(request.expectedDeadline()==null||request.newDeadline()==null||request.reason()==null||request.reason().isBlank()||request.reason().length()>1000)
      throw new IllegalArgumentException("请填写原截止时间、新截止时间和1000字内延期原因");
    int round=rfq.currentRound();
    var existing=mapper.extensions(rfq.tenantId(),id).stream().filter(event->event.round()==round
        &&event.oldDeadline().toInstant().equals(request.expectedDeadline().toInstant())).findFirst();
    if(existing.isPresent()){
      if(!existing.get().newDeadline().toInstant().equals(request.newDeadline().toInstant()))throw new IllegalStateException("延期版本已变化，请刷新");
      return existing.get();
    }
    if(rfq.deadlineAt()==null||!rfq.deadlineAt().toInstant().equals(request.expectedDeadline().toInstant()))throw new IllegalStateException("截止时间已变化，请刷新");
    return applyExtension(rfq,request.newDeadline(),"manual",request.reason(),TenantAccessGuard.requireUserId("extend quotation"));
  }
  @Transactional public void autoExtend(QuotationMapper.Policy candidate) {
    rows.lockByTenantAndId(candidate.tenantId(),candidate.rfqId());
    var rfq=rows.findByTenantAndId(candidate.tenantId(),candidate.rfqId());
    if(rfq==null||!RfqStatus.QUOTING.equals(rfq.status())||rfq.deadlineAt()==null||rfq.deadlineAt().isAfter(OffsetDateTime.now()))return;
    var policy=policy(rfq);
    long used=mapper.extensions(rfq.tenantId(),rfq.id()).stream().filter(e->e.round()==rfq.currentRound()&&"automatic".equals(e.mode())).count();
    if(!policy.autoExtend()||used>=policy.maxAutoExtensions()||count(rfq)>=3)return;
    applyExtension(rfq,OffsetDateTime.now().plusHours(policy.extensionHours()),"automatic","本轮有效报价不足三家，按已配置规则自动延期",null);
  }
  private QuotationMapper.Extension applyExtension(Rfq rfq,OffsetDateTime deadline,String mode,String reason,String actor) {
    requireInquiry(rfq);
    if(!RfqStatus.QUOTING.equals(rfq.status())||rfq.openedAt()!=null||rfq.deadlineAt()==null)throw new IllegalStateException("仅未开标的报价中项目可延期");
    int valid=count(rfq);if(valid>=3)throw new IllegalStateException("有效报价已达到三家，不适用不足三家延期规则");
    if(!deadline.isAfter(OffsetDateTime.now())||!deadline.isAfter(rfq.deadlineAt()))throw new IllegalArgumentException("新截止时间须晚于当前时间和原截止时间");
    var event=new QuotationMapper.Extension("rfq-extension-"+UUID.randomUUID(),rfq.tenantId(),rfq.id(),rfq.currentRound(),
        rfq.deadlineAt(),deadline,mode,valid,reason,actor,OffsetDateTime.now());
    mapper.insertExtension(event);rows.updateDeadline(rfq.tenantId(),rfq.id(),deadline);
    String message=rfq.title()+"；有效报价"+valid+"家；截止延至"+deadline+"；"+reason;
    notifications.notifyTenantUsers(rfq.tenantId(),List.of(rfq.ownerId()),"询比报价延期",message);
    for(String supplier:invitations.listSupplierIds(rfq.tenantId(),rfq.id()))notifications.notifyActiveSupplierUsers(rfq.tenantId(),supplier,"询比报价延期",message);
    return event;
  }
  private static void requireInquiry(Rfq rfq){if(!RfqMethod.COMPARE.equals(RfqMethod.orDefault(rfq.method())))throw new IllegalArgumentException("本规则仅适用于询比，不替代竞价软关闭或单一来源规则");}
  private static FileView view(QuotationMapper.FileRow file){return new FileView(file.id(),file.fileName(),file.contentSize(),file.sha256(),file.createdAt());}
  private static String hash(byte[] bytes){try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
}
