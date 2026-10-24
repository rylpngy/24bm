package com.procurement.sourcing.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.sourcing.api.ProcurementExecutionResponse;
import com.procurement.sourcing.api.ProcurementExecutionResponse.ArchiveSummary;
import com.procurement.sourcing.domain.ProcurementExecutionArchive;
import com.procurement.sourcing.infrastructure.ProcurementExecutionMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProcurementExecutionApplicationService {
  private com.procurement.buyer.application.BudgetControlService budgetControl;
  @org.springframework.beans.factory.annotation.Autowired
  void setBudgetControlService(com.procurement.buyer.application.BudgetControlService control) { this.budgetControl=control; }
  @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ,
      propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public com.procurement.common.ai.AiContracts.Snapshot captureAiEvidence(String rfqId) {
    String tenant=authorize(rfqId,false);
    var data=capture(tenant,rfqId,false).snapshot();
    var evaluated=ProcurementExecutionPolicy.evaluate(data);
    String revision=ProcurementExecutionArchiveWriter.stateHash(data);
    var evidence=new ArrayList<com.procurement.common.ai.AiContracts.Evidence>();
    var findings=new ArrayList<com.procurement.common.ai.AiContracts.Finding>();
    var targets=new ArrayList<com.procurement.common.ai.AiContracts.AccessTarget>();
    var summary=json.createObjectNode(); summary.put("rfqId",rfqId);
    summary.set("budgetAmount",json.valueToTree(evaluated.budgetAmount()));
    summary.set("orderAmount",json.valueToTree(evaluated.orderAmount()));
    summary.set("paidAmount",json.valueToTree(evaluated.paidAmount()));
    summary.set("remainingAmount",json.valueToTree(evaluated.remainingAmount()));
    evidence.add(new com.procurement.common.ai.AiContracts.Evidence("execution-summary","BUSINESS","execution/amounts",
        "采购执行金额及已知付款证据",summary.toString(),rfqId,revision,null));
    for(var doc:evaluated.documents()) {
      if(evidence.size()>=180) throw new IllegalArgumentException("Project exceeds 180 evidence records; narrow the case before review");
      var value=json.createObjectNode(); value.put("status",doc.status()); value.set("amount",json.valueToTree(doc.amount()));
      evidence.add(new com.procurement.common.ai.AiContracts.Evidence("document:"+evidence.size(),"BUSINESS",doc.module()+"/"+doc.recordId(),
          doc.label(),value.toString(),doc.id(),revision,null));
    }
    int index=0;
    for(String blocker:evaluated.blockers()) {
      if(index>=80) throw new IllegalArgumentException("Project exceeds 80 risk findings; resolve existing exceptions before review");
      String eid="check:"+(++index);
      evidence.add(new com.procurement.common.ai.AiContracts.Evidence(eid,"BUSINESS","execution/blockers/"+index,
          "采购执行规则检查记录",blocker,rfqId,revision,null));
      findings.add(com.procurement.common.ai.AiSupport.finding("execution-"+index,"risk","存在未闭环的采购执行证据",blocker,eid,"execution-summary"));
    }
    for(var order:data.path("orders")) targets.add(new com.procurement.common.ai.AiContracts.AccessTarget("order",order.path("id").asText()));
    for(var owner:data.path("attachmentOwners")) targets.add(new com.procurement.common.ai.AiContracts.AccessTarget("owner:"+owner.path("type").asText(),owner.path("id").asText()));
    for(var attachment:data.path("attachments")) targets.add(new com.procurement.common.ai.AiContracts.AccessTarget("attachment",attachment.path("id").asText()));
    for(var history:data.path("workflowHistory")) targets.add(new com.procurement.common.ai.AiContracts.AccessTarget(
        "workflow_instance",history.path("instance").path("id").asText()));
    return new com.procurement.common.ai.AiContracts.Snapshot(revision,evidence,findings, List.of(
        "本次仅解释既有采购执行及结项检查，不作合法性、欺诈或围串标认定。",
        "项目附件仅引用元数据，本次未核验附件原件及正文；需审查正文时请进入附件独立审查。",
        "历史付款缺少证据时保持未知，不将未知金额解释为已付零元。"),targets);
  }

  public void authorizeAiEvidence(String rfqId,com.procurement.common.ai.AiContracts.Snapshot snapshot) {
    authorize(rfqId,false);
    if(snapshot==null) return;
    for(var target:snapshot.accessTargets()) {
      if(target.subjectType().equals("order")) access.requireOrder(target.subjectId(),"buyer:order:read");
      else if(target.subjectType().startsWith("owner:")) attachments.procurementExecutionAttachmentMetadata(target.subjectType().substring(6),target.subjectId());
      else if(target.subjectType().equals("attachment")) attachments.requireCurrentTenantReadAccess(target.subjectId());
      else if(target.subjectType().equals("workflow_instance")) workflow.requireCurrentTenantInstanceReadAccess(target.subjectId());
      else throw new IllegalArgumentException("Unsupported project evidence authorization target");
    }
  }
  public static final int MAX_ATTACHMENTS = 100;
  public static final long MAX_ATTACHMENT_BYTES = 100L * 1024 * 1024;
  private static final List<String> READS = List.of("buyer:demand:read","buyer:rfq:read","buyer:order:read",
      "buyer:receipt:read","buyer:contract:read","buyer:invoice:read","buyer:workflow:read");
  private final ProcurementExecutionMapper mapper;
  private final OrderAccessService access;
  private final PermissionService permissions;
  private final AttachmentApplicationService attachments;
  private final UnifiedWorkflowApplicationService workflow;
  private final ObjectMapper json;

  public ProcurementExecutionApplicationService(ProcurementExecutionMapper mapper,OrderAccessService access,
      PermissionService permissions,AttachmentApplicationService attachments,UnifiedWorkflowApplicationService workflow,ObjectMapper json) {
    this.mapper=mapper; this.access=access; this.permissions=permissions; this.attachments=attachments; this.workflow=workflow; this.json=json;
  }

  @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
  public ProcurementExecutionResponse get(String rfqId) {
    String tenant=authorize(rfqId,false);
    var current=capture(tenant,rfqId,false);
    var result=ProcurementExecutionPolicy.evaluate(current.snapshot());
    String stateHash=ProcurementExecutionArchiveWriter.stateHash(current.snapshot());
    return new ProcurementExecutionResponse(rfqId,current.snapshot().path("rfq").path("title").asText(),
        current.snapshot().path("rfq").path("status").asText(),result.documents(),result.budgetAmount(),result.orderAmount(),
        result.invoicedAmount(),result.paidAmount(),result.remainingAmount(),result.blockers(),result.blockers().isEmpty(),
        mapper.archives(tenant,rfqId).stream().map(a -> summary(a,
            !ProcurementExecutionArchiveWriter.stateHash(parse(a.snapshot())).equals(stateHash))).toList());
  }

  @Transactional
  public ArchiveSummary archive(String rfqId,String remark) {
    if(budgetControl!=null) budgetControl.lock(TenantAccessGuard.requireTenantId("budget settlement"));
    String tenant=authorize(rfqId,true);
    if (remark==null || remark.isBlank() || remark.length()>1000) throw new IllegalArgumentException("归档备注必填，长度须为1至1000字");
    if (mapper.lockRfq(tenant,rfqId)==null) throw new IllegalArgumentException("采购项目不存在");
    // RFQ row serializes archive requests; two captures detect concurrent independent module writes.
    var captured=capture(tenant,rfqId,true);
    var result=ProcurementExecutionPolicy.evaluate(captured.snapshot());
    if (!result.blockers().isEmpty()) throw new IllegalStateException("采购项目尚不可归档：" + String.join("；",result.blockers()));
    String hash=ProcurementExecutionArchiveWriter.hash(captured.snapshot());
    var prior=mapper.archives(tenant,rfqId).stream().filter(a -> a.sha256().equals(hash)).findFirst();
    if (prior.isPresent()) {
      if(budgetControl!=null) budgetControl.settleProject(tenant,rfqId,prior.get().id(),result.orderAmount(),result.paidAmount());
      return summary(prior.get(),false);
    }
    byte[] zip=ProcurementExecutionArchiveWriter.write(captured.snapshot(),captured.files(),json);
    var recheck=capture(tenant,rfqId,true);
    if (!hash.equals(ProcurementExecutionArchiveWriter.hash(recheck.snapshot()))) throw new IllegalStateException("归档期间业务数据或附件发生变化，请重试");
    var archive=new ProcurementExecutionArchive(UUID.randomUUID().toString(),tenant,rfqId,
        captured.snapshot().toString(),hash,TenantAccessGuard.requireUserId("procurement execution archive"),
        OffsetDateTime.now(),remark==null?"":remark,zip);
    mapper.insert(archive);
    if(budgetControl!=null) budgetControl.settleProject(tenant,rfqId,archive.id(),result.orderAmount(),result.paidAmount());
    return summary(archive,false);
  }

  @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
  public byte[] download(String rfqId,String archiveId) {
    String tenant=authorize(rfqId,false);
    var current=business(tenant,rfqId); requireOrders(current);
    var archive=mapper.archive(tenant,rfqId,archiveId);
    if (archive==null) throw new IllegalArgumentException("采购档案不存在或不属于当前项目");
    var saved=parse(archive.snapshot());
    if (!archive.sha256().equals(ProcurementExecutionArchiveWriter.hash(saved))) throw new IllegalStateException("归档快照SHA校验失败");
    requireOrders(saved);
    List<String> ids=businessIds(saved);
    workflow.procurementExecutionHistory(ids); // Revalidate current workflow instance scope, including historical approvals.
    Map<String,byte[]> expected=new LinkedHashMap<>();
    Map<String,com.procurement.attachment.domain.Attachment> currentAttachments=new LinkedHashMap<>();
    for (var owner : saved.path("attachmentOwners")) {
      for (var attachment : attachments.listCurrentTenantAttachmentEntities(owner.path("type").asText(),owner.path("id").asText()))
        currentAttachments.put(attachment.id(),attachment);
    }
    long total=0; int count=0;
    for (var entry : saved.path("attachments")) {
      if (++count>MAX_ATTACHMENTS) throw new IllegalStateException("档案附件数量超限");
      var currentAttachment=currentAttachments.get(entry.path("id").asText());
      if (currentAttachment==null || !entry.path("ownerType").asText().equals(currentAttachment.ownerType())
          || !entry.path("ownerId").asText().equals(currentAttachment.ownerId())) throw new IllegalStateException("档案附件缺失或归属已变化："+entry.path("fileName").asText());
      var loaded=attachments.loadCurrentTenantObject(entry.path("id").asText());
      total+=loaded.data().length; requireSize(total);
      if (entry.path("size").asLong(-1)!=loaded.data().length || !entry.path("sha256").asText().equals(ProcurementExecutionArchiveWriter.sha256(loaded.data())))
        throw new IllegalStateException("档案附件缺失或SHA不符：" + entry.path("fileName").asText());
      expected.put(entry.path("path").asText(),loaded.data());
    }
    // Validate the saved ZIP independently. Never rebuild a historic download with today's attachments.
    verifyZip(archive.zipData(),saved,expected);
    return archive.zipData();
  }

  private String authorize(String rfq,boolean write) {
    String tenant=TenantAccessGuard.requireTenantId("procurement execution");
    for (String permission : READS) permissions.require(permission);
    if (write) permissions.require("buyer:rfq:manage");
    access.requireRfq(rfq,"buyer:rfq:read");
    return tenant;
  }
  private ObjectNode business(String tenant,String rfq) {
    String raw=mapper.snapshot(tenant,rfq);
    if(raw==null) throw new IllegalArgumentException("采购项目不存在");
    return parse(raw);
  }
  private ObjectNode parse(String value) {
    try { return (ObjectNode) json.readTree(value); }
    catch (Exception error) { throw new IllegalStateException("无法读取采购档案业务快照",error); }
  }
  private void requireOrders(JsonNode snapshot) {
    for (var order : snapshot.path("orders")) access.requireOrder(order.path("id").asText(),"buyer:order:read");
  }
  private record Owner(String type,String id) {}
  private record Capture(ObjectNode snapshot,Map<String,byte[]> files) {}

  private Capture capture(String tenant,String rfq,boolean loadOriginals) {
    ObjectNode data=business(tenant,rfq); requireOrders(data);
    data.set("closeoutChecks",json.valueToTree(mapper.closeoutBlockers(tenant,rfq)));
    data.set("workflowHistory",json.valueToTree(workflow.procurementExecutionHistory(businessIds(data))));
    List<Owner> owners=new ArrayList<>(); owners.add(new Owner("rfq",rfq));
    for (var d : data.path("demands")) { owners.add(new Owner("demand",d.path("id").asText())); owners.add(new Owner("purchase_demand",d.path("id").asText())); }
    for (var q : data.path("quotes")) owners.add(new Owner("quote",q.path("id").asText()));
    for (var c : data.path("contracts")) owners.add(new Owner("contract",c.path("id").asText()));
    owners.sort(Comparator.comparing(Owner::type).thenComparing(Owner::id));
    var ownerManifest=data.putArray("attachmentOwners"); var manifest=data.putArray("attachments");
    var attachmentChecks=data.putArray("attachmentChecks");
    Map<String,byte[]> files=new LinkedHashMap<>(); long total=0; int count=0;
    for (var owner : owners) {
      ownerManifest.addObject().put("type",owner.type()).put("id",owner.id());
      var listed=new ArrayList<>(attachments.procurementExecutionAttachmentMetadata(owner.type(),owner.id()));
      listed.sort(Comparator.comparing(AttachmentApplicationService.ProcurementExecutionAttachmentMetadata::id));
      for (var a : listed) {
        if (!tenant.equals(a.tenantId()) || !owner.type().equals(a.ownerType()) || !owner.id().equals(a.ownerId()))
          throw new IllegalStateException("附件清单归属校验失败");
        ++count;
        if (count>MAX_ATTACHMENTS && loadOriginals) throw new IllegalStateException("归档最多允许100个附件");
        var loaded=loadOriginals?attachments.loadCurrentTenantObject(a.id()):null;
        Long size=loaded!=null?Long.valueOf(loaded.data().length):a.contentSize();
        String sha=loaded!=null?ProcurementExecutionArchiveWriter.sha256(loaded.data()):a.contentSha256();
        if (size!=null) total+=size;
        if (loadOriginals) {
          requireSize(total);
          if (a.contentSize()!=null && a.contentSize().longValue()!=size.longValue()
              || a.contentSha256()!=null && !a.contentSha256().equals(sha)) throw new IllegalStateException("附件内容与校验基线不符："+a.fileName());
        }
        String path=ProcurementExecutionArchiveWriter.attachmentPath(count,a.fileName());
        var entry=manifest.addObject().put("id",a.id()).put("ownerType",owner.type()).put("ownerId",owner.id())
            .put("fileName",a.fileName()).put("path",path);
        entry.set("metadataSize",json.valueToTree(a.contentSize())); entry.set("metadataSha256",json.valueToTree(a.contentSha256()));
        entry.set("size",json.valueToTree(size)); entry.set("sha256",json.valueToTree(sha));
        if (loaded!=null) files.put(path,loaded.data());
      }
    }
    if (count>MAX_ATTACHMENTS) attachmentChecks.add("归档最多允许100个附件");
    if (total>MAX_ATTACHMENT_BYTES) attachmentChecks.add("归档附件总大小不得超过100MB");
    return new Capture(data,files);
  }
  private List<String> businessIds(JsonNode data) {
    List<String> ids=new ArrayList<>(); ids.add(data.path("rfq").path("id").asText());
    for(String key : List.of("demands","orders","awards","contracts","invoices","paymentRequests")) for(var item:data.path(key)) {
      ids.add(item.path("id").asText());
      if (item.hasNonNull("paymentBatchNo") && !item.path("paymentBatchNo").asText().isBlank()) ids.add(item.path("paymentBatchNo").asText());
    }
    return ids;
  }
  private static void requireSize(long total) { if(total>MAX_ATTACHMENT_BYTES) throw new IllegalStateException("归档附件总大小不得超过100MB"); }
  private static ArchiveSummary summary(ProcurementExecutionArchive a,boolean stale) { return new ArchiveSummary(a.id(),a.createdAt(),a.createdBy(),a.sha256(),stale); }

  private void verifyZip(byte[] zipBytes,JsonNode snapshot,Map<String,byte[]> attachments) {
    try (var zip=new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes),java.nio.charset.StandardCharsets.UTF_8)) {
      Map<String,byte[]> files=new LinkedHashMap<>(); long size=0;
      for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry()) {
        String name=entry.getName();
        if (name.startsWith("/") || name.contains("..") || name.contains("\\") || files.containsKey(name)) throw new IllegalStateException("归档ZIP文件名无效");
        byte[] bytes=zip.readNBytes((int)MAX_ATTACHMENT_BYTES+10*1024*1024+1); size+=bytes.length;
        if (size>MAX_ATTACHMENT_BYTES+10*1024*1024 || files.size()>=MAX_ATTACHMENTS+4) throw new IllegalStateException("归档ZIP大小或数量超限");
        files.put(name,bytes);
      }
      if (files.size()!=attachments.size()+4 || !files.keySet().containsAll(List.of("台账.xlsx","业务快照.json","审核历史.json","SHA256SUMS.txt"))) throw new IllegalStateException("归档ZIP清单不完整");
      String sums=new String(files.get("SHA256SUMS.txt"),java.nio.charset.StandardCharsets.UTF_8);
      for(var file:files.entrySet()) if (!file.getKey().equals("SHA256SUMS.txt") && !sums.contains(ProcurementExecutionArchiveWriter.sha256(file.getValue())+"  "+file.getKey()+"\n")) throw new IllegalStateException("归档ZIP的SHA清单不符");
      if (!ProcurementExecutionArchiveWriter.hash(parse(new String(files.get("业务快照.json"),java.nio.charset.StandardCharsets.UTF_8))).equals(ProcurementExecutionArchiveWriter.hash(snapshot))) throw new IllegalStateException("归档ZIP快照不符");
      for(var a:attachments.entrySet()) if (!java.util.Arrays.equals(a.getValue(),files.get(a.getKey()))) throw new IllegalStateException("归档原件内容不符："+a.getKey());
    } catch(java.io.IOException error) { throw new IllegalStateException("无法校验归档ZIP",error); }
  }
}
