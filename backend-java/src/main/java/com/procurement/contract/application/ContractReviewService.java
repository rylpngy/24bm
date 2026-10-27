package com.procurement.contract.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.procurement.attachment.application.AttachmentTextExtractor;
import com.procurement.attachment.application.AttachmentTextExtractor.Segment;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.*;
import com.procurement.contract.api.ContractReviewContracts.*;
import com.procurement.contract.infrastructure.ContractReviewMapper;
import com.procurement.contract.infrastructure.ContractReviewMapper.*;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import java.io.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ContractReviewService {
  private final ContractReviewMapper mapper;
  private final ContractReviewCodec codec;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final ObjectStorageService storage;
  private final AttachmentTextExtractor extractor;
  private final ContractReviewRulesService rules;
  private final ContractReviewEngine engine;
  private final ContractReviewModelGateway model;
  private final AuditLogApplicationService audit;
  private final TransactionTemplate tx;
  private final ContractAccessService contractAccess;
  public record Download(String name,byte[] bytes) {}
  public ContractReviewService(ContractReviewMapper mapper,ContractReviewCodec codec,PermissionService permissions,
      DataScopeService scopes,ObjectStorageService storage,AttachmentTextExtractor extractor,ContractReviewRulesService rules,
      ContractReviewEngine engine,ContractReviewModelGateway model,AuditLogApplicationService audit,TransactionTemplate tx,ContractAccessService contractAccess){
    this.mapper=mapper;this.codec=codec;this.permissions=permissions;this.scopes=scopes;this.storage=storage;
    this.extractor=extractor;this.rules=rules;this.engine=engine;this.model=model;this.audit=audit;this.tx=tx;this.contractAccess=contractAccess;
  }
  public Page<Document> documents(int page,int size){
    return documents(page,size,null);
  }
  public Page<Document> documents(int page,int size,String contractId){
    permissions.require("buyer:contract:read");int p=Math.max(1,page),s=Math.max(1,Math.min(size,50));
    if(contractId!=null)contractAccess.requireContract(contractId,false);
    var scope=scopes.currentUserDataScope();if(scope.blocksAll())return new Page<>(List.of(),0,p,s);
    if(contractId!=null)return new Page<>(mapper.contractDocuments(tenant(),contractId,scope.restricted(),scope.requesterId(),scope.departmentIds(),s,(p-1)*s).stream().map(this::view).toList(),
        mapper.contractDocumentCount(tenant(),contractId,scope.restricted(),scope.requesterId(),scope.departmentIds()),p,s);
    var items=mapper.documents(tenant(),scope.restricted(),scope.requesterId(),scope.departmentIds(),s,(p-1)*s).stream().map(this::view).toList();
    return new Page<>(items,mapper.documentCount(tenant(),scope.restricted(),scope.requesterId(),scope.departmentIds()),p,s);
  }
  @Transactional public Document upload(String fileName,byte[] bytes){
    return upload(fileName,bytes,null);
  }
  @Transactional public Document upload(String fileName,byte[] bytes,String contractId){
    permissions.require("buyer:contract:manage");scopes.requireCreatorAccess(user());
    if(contractId!=null)contractAccess.requireContract(contractId,true);
    if(fileName==null||fileName.isBlank()||fileName.length()>180||fileName.chars().anyMatch(c->c<32||c=='/'||c=='\\'))throw new IllegalArgumentException("合同文件名无效");
    if(bytes==null||bytes.length==0||bytes.length>AttachmentTextExtractor.MAX_BYTES)throw new IllegalArgumentException("合同原件须为1字节至2MB的UTF-8文本或DOCX");
    var extraction=extractor.extract(fileName,bytes);
    if(extraction.segments().isEmpty())throw new IllegalArgumentException(String.join("；",extraction.limitations()));
    if(extraction.limitations().stream().anyMatch(value->value.contains("已达到")))throw new IllegalArgumentException("合同正文超过安全解析范围，请拆分后重新上传，避免基于截断正文作缺失判断");
    String id="crdoc-"+UUID.randomUUID(),key="contract-review/"+tenant()+"/"+id+"/original";
    storage.put(key,bytes,"application/octet-stream");
    var row=new DocumentRow(id,tenant(),contractId,fileName,key,ContractReviewCodec.hash(bytes),1,codec.write(extraction.limitations()),user(),OffsetDateTime.now());
    mapper.insertDocument(row);saveVersion(row,1,extraction.segments());
    audit.recordCurrentTenantAction("CONTRACT_REVIEW_DOCUMENT_UPLOADED","contract_review_document",id,"上传原件并提取审查正文；原件SHA256="+row.originalSha256());
    return view(row);
  }
  public Workspace workspace(String id){
    var row=requireDocument(id,false);
    return new Workspace(view(row),mapper.documentVersions(tenant(),id).stream().map(this::view).toList(),
        mapper.runs(tenant(),id).stream().map(this::view).toList(),mapper.decisions(tenant(),id).stream().map(this::view).toList());
  }
  public Run review(String id,Start request){
    var document=requireDocument(id,true);
    if(!Set.of("BUYER","SELLER").contains(request.perspective()))throw new IllegalArgumentException("审查视角须为甲方或乙方");
    if(document.currentVersion()!=request.expectedVersion())throw new IllegalStateException("审查稿已变化，请刷新后重试");
    var version=rules.requireVersion(request.rulesVersionId());
    var text=view(mapper.documentVersions(tenant(),id).getFirst()).segments();
    List<Finding> findings=new ArrayList<>(engine.check(version.rules(),text,request.perspective()));
    // External inference runs without holding database locks or a database connection.
    var result=model.analyze(version.rules(),text,request.perspective(),request.useModel());findings.addAll(result.findings());
    return tx.execute(status->{
      var current=mapper.lockDocument(tenant(),id);
      if(current.currentVersion()!=request.expectedVersion())throw new IllegalStateException("模型处理期间审查稿已变化，请基于新版本重新审查");
      var run=new RunRow("crrun-"+UUID.randomUUID(),tenant(),id,request.expectedVersion(),version.id(),request.perspective(),result.mode(),
          result.model(),result.limitation(),codec.write(findings),user(),OffsetDateTime.now());
      mapper.insertRun(run);audit.recordCurrentTenantAction("CONTRACT_REVIEW_STARTED","contract_review_document",id,
          "正文V"+run.documentVersion()+"；规则"+version.id()+"；视角"+run.perspective()+"；模式"+run.mode());
      return view(run);
    });
  }
  @Transactional public Decision decide(String id,String runId,Decide request){
    requireDocument(id,true);var document=mapper.lockDocument(tenant(),id);
    var row=mapper.run(tenant(),runId);
    if(row==null||!id.equals(row.documentId()))throw new PermissionDeniedException("审查记录不存在或无权访问");
    if(!Set.of("adopt","dismiss").contains(request.action()))throw new IllegalArgumentException("请选择采纳或不采纳");
    var previous=mapper.decisions(tenant(),id).stream().filter(d->runId.equals(d.runId())&&request.findingId().equals(d.findingId())).findFirst();
    if(previous.isPresent()){
      var decision=previous.get();
      if(decision.action().equals(request.action())&&decision.comment().equals(request.comment())
          &&(!"adopt".equals(request.action())||decision.afterText().equals(request.replacement())))return view(decision);
      throw new IllegalStateException("该风险已处理，请查看人工确认历史");
    }
    if(document.currentVersion()!=request.expectedVersion()||row.documentVersion()!=document.currentVersion())throw new IllegalStateException("审查结果对应旧正文，请对当前版本重新审查后处理");
    var finding=view(row).findings().stream().filter(f->f.id().equals(request.findingId())).findFirst().orElseThrow(()->new IllegalArgumentException("风险项不存在"));
    var text=new ArrayList<>(view(mapper.documentVersions(tenant(),id).getFirst()).segments());
    String before=finding.locator()==null?"":text.stream().filter(s->s.locator().equals(finding.locator())).findFirst().orElseThrow(()->new IllegalStateException("原文位置已变化")).text();
    int next=document.currentVersion();String after=before;
    if("adopt".equals(request.action())){
      if(request.replacement()==null||request.replacement().isBlank())throw new IllegalArgumentException("请确认完整的替换段落或新增条款");
      after=request.replacement();next++;
      if(finding.locator()==null)text.add(new Segment("addition:"+next,after));
      else for(int i=0;i<text.size();i++)if(text.get(i).locator().equals(finding.locator())){text.set(i,new Segment(finding.locator(),after));break;}
      if(text.size()>200||text.stream().mapToInt(s->s.text().length()).sum()>50000)throw new IllegalArgumentException("修订稿超过文本上限");
      saveVersion(document,next,text);mapper.advanceDocument(tenant(),id,next);
    }
    var decision=new DecisionRow("crdecision-"+UUID.randomUUID(),tenant(),id,runId,finding.id(),request.action(),document.currentVersion(),next,
        finding.locator(),before,after,request.comment(),user(),OffsetDateTime.now());
    mapper.insertDecision(decision);audit.recordCurrentTenantAction("CONTRACT_REVIEW_HUMAN_DECISION","contract_review_document",id,
        request.action()+"；正文V"+document.currentVersion()+"→V"+next+"；风险"+finding.id());
    return view(decision);
  }
  public Download original(String id){
    var doc=requireDocument(id,false);byte[] bytes=storage.get(doc.storageKey()).data();
    if(!ContractReviewCodec.hash(bytes).equals(doc.originalSha256()))throw new IllegalStateException("原件完整性核验失败");
    return new Download(doc.fileName(),bytes);
  }
  public Download export(String id,int version){
    requireDocument(id,false);
    var text=mapper.documentVersions(tenant(),id).stream().filter(v->v.version()==version).findFirst().orElseThrow(()->new IllegalArgumentException("审查稿版本不存在"));
    try(var doc=new XWPFDocument();var out=new ByteArrayOutputStream()){
      doc.createParagraph().createRun().setText("合同审查校对稿 V"+version+"（非签署正本）");
      doc.createParagraph().createRun().setText("由提取正文生成，不保留原件排版、图片、页眉和修订标记；原件另行下载。建议须经业务及法务确认。");
      for(var segment:view(text).segments())for(String line:segment.text().split("\\R",-1))doc.createParagraph().createRun().setText(line);
      doc.write(out);return new Download("合同审查校对稿-V"+version+".docx",out.toByteArray());
    }catch(IOException e){throw new IllegalStateException("校对稿导出失败",e);}
  }
  private DocumentRow requireDocument(String id,boolean write){
    permissions.require(write?"buyer:contract:manage":"buyer:contract:read");var row=mapper.document(tenant(),id);
    if(row==null)throw new PermissionDeniedException("审查文档不存在或无权访问");
    scopes.requireCreatorAccess(row.createdBy());if(row.contractId()!=null)contractAccess.requireContract(row.contractId(),write);return row;
  }
  private void saveVersion(DocumentRow doc,int number,List<Segment> segments){
    mapper.insertDocumentVersion(new DocumentVersionRow("crtext-"+UUID.randomUUID(),tenant(),doc.id(),number,codec.write(segments),codec.hashText(segments),user(),OffsetDateTime.now()));
  }
  private Document view(DocumentRow row){return new Document(row.id(),row.contractId(),row.fileName(),row.originalSha256(),row.currentVersion(),codec.read(row.limitationsJson(),new TypeReference<List<String>>(){}),row.createdBy(),row.createdAt());}
  private DocumentVersion view(DocumentVersionRow row){return new DocumentVersion(row.version(),row.textSha256(),codec.read(row.segmentsJson(),new TypeReference<List<Segment>>(){}),row.createdBy(),row.createdAt());}
  private Run view(RunRow row){return new Run(row.id(),row.documentId(),row.documentVersion(),row.rulesVersionId(),row.perspective(),row.mode(),row.model(),row.limitation(),codec.read(row.findingsJson(),new TypeReference<List<Finding>>(){}),row.createdBy(),mapper.actorName(tenant(),row.createdBy()),row.createdAt());}
  private Decision view(DecisionRow row){return new Decision(row.id(),row.runId(),row.findingId(),row.action(),row.oldVersion(),row.newVersion(),row.locator(),row.beforeText(),row.afterText(),row.comment(),row.actorId(),mapper.actorName(tenant(),row.actorId()),row.createdAt());}
  private static String tenant(){return TenantAccessGuard.requireTenantId("contract review");}
  private static String user(){return TenantAccessGuard.requireUserId("contract review");}
}
