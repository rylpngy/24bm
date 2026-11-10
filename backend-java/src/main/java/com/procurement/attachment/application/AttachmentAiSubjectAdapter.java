package com.procurement.attachment.application;

import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AttachmentAiSubjectAdapter implements AiSubjectAdapter {
  private final AttachmentApplicationService attachments;
  private final AttachmentAccessService access;
  private final AttachmentMapper mapper;
  private final AttachmentTextExtractor extractor;
  public AttachmentAiSubjectAdapter(AttachmentApplicationService attachments, AttachmentAccessService access,
      AttachmentMapper mapper, AttachmentTextExtractor extractor) {
    this.attachments=attachments; this.access=access; this.mapper=mapper; this.extractor=extractor;
  }
  public String subjectType() { return "attachment"; }
  public void authorize(String id) { require(id); }
  private Attachment require(String id) {
    var row=mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("AI attachment"),id);
    if(row==null || !"active".equals(row.status())) throw new PermissionDeniedException("Attachment is unavailable in current tenant");
    access.requireAccess(row.ownerType(),row.ownerId(),false); return row;
  }
  @Override public void authorizeSnapshot(String id,Snapshot snapshot) {
    authorize(id);
    for(var target:snapshot.accessTargets()) access.requireAccess(target.subjectType(),target.subjectId(),false);
  }
  @org.springframework.transaction.annotation.Transactional(readOnly=true,
      isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,
      propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public Snapshot capture(String id) {
    var row=require(id); var fingerprint=mapper.fingerprint(TenantAccessGuard.requireTenantId("AI attachment"),id);
    List<Evidence> evidence=new ArrayList<>(); List<Finding> findings=new ArrayList<>(); List<String> limitations=new ArrayList<>();
    String baseline=fingerprint==null?null:fingerprint.contentSha256();
    evidence.add(AiSupport.field("filename","附件名称",row.fileName(),id,baseline));
    evidence.add(AiSupport.field("uploadHash","上传时SHA-256",baseline,id,baseline));
    evidence.add(AiSupport.field("uploadSize","上传时文件字节数",fingerprint==null?null:fingerprint.contentSize(),id,baseline));
    String contentHash=null;
    String readState="not_attempted",integrityState="not_verified",extractionState="not_attempted",extractionHash=null;
    if(fingerprint==null || fingerprint.contentSize()==null || baseline==null) {
      integrityState="baseline_missing";
      limitations.add("缺少上传时文件指纹，不能证明历史文件完整性，正文未评估。");
      findings.add(AiSupport.finding("integrity-unknown","warning","缺少上传完整性基线","依赖正文作判断前，请先人工核对原始文件。","uploadHash"));
    } else if(fingerprint.contentSize()>AttachmentTextExtractor.MAX_BYTES) {
      readState="size_limit";
      limitations.add("文件超过10MB，正文未评估。");
    } else {
      try {
        var object=attachments.loadCurrentTenantObject(id); contentHash=AiSupport.hash(object.data()); readState="read";
        if(object.data().length!=fingerprint.contentSize() || !contentHash.equals(baseline)) {
          integrityState="mismatch"; throw new IllegalStateException("Attachment hash mismatch");
        }
        integrityState="verified";
        var extracted=extractor.extract(row.fileName(),object.data()); limitations.addAll(extracted.limitations());
        extractionState=extracted.segments().isEmpty()?"not_assessed":"extracted";
        extractionHash=AiSupport.revision(extracted);
        int index=0;
        for(var segment:extracted.segments()) {
          String eid="text:"+(++index);
          evidence.add(new Evidence(eid,"ATTACHMENT",segment.locator(),"附件正文片段",segment.text(),id,contentHash,null));
          if(segment.text().contains("TODO") || segment.text().contains("待填写") || segment.text().contains("待补充"))
            findings.add(AiSupport.finding("placeholder-"+index,"warning","正文存在待完善标记","所引正文包含TODO、待填写或待补充标记，请结合上下文人工确认。",eid));
          if(findings.size()>=80) { limitations.add("已达到提示数量上限，剩余正文标记须人工复核。"); break; }
        }
        if(extracted.segments().isEmpty()) findings.add(AiSupport.finding("text-not-assessed","warning","附件正文未评估","未能提取受支持的可读正文；文件名和元数据不能替代正文审查。","filename"));
      } catch(PermissionDeniedException denied) { throw denied; }
      catch(RuntimeException unavailable) {
        if(!"read".equals(readState)) readState="read_failed";
        if("verified".equals(integrityState)) extractionState="failed";
        else if(!"mismatch".equals(integrityState)) integrityState="not_verified";
        findings.add(AiSupport.finding("file-unverified","risk","附件读取或完整性核验未通过","文件缺失、暂不可读或与上传指纹不一致，不能据此形成正文结论。","uploadHash","uploadSize"));
        limitations.add("因读取或完整性核验失败，附件正文未评估。");
      }
    }
    evidence.add(AiSupport.field("actualHash","本次实际读取的SHA-256（未读取时为空）",contentHash,id,contentHash));
    evidence.add(AiSupport.field("readState","本次附件读取状态",switch(readState) {
      case "read" -> "已读取"; case "read_failed" -> "读取失败"; case "size_limit" -> "超过大小上限，未读取"; default -> "未读取";
    },id,contentHash));
    evidence.add(AiSupport.field("integrityState","本次附件完整性核验状态",switch(integrityState) {
      case "verified" -> "与上传基线一致"; case "mismatch" -> "与上传基线不一致"; case "baseline_missing" -> "缺少上传基线"; default -> "未核验通过";
    },id,contentHash));
    evidence.add(AiSupport.field("extractionState","本次附件正文提取状态",switch(extractionState) {
      case "extracted" -> "已提取受支持的正文"; case "not_assessed" -> "未提取到受支持正文";
      case "failed" -> "提取失败"; default -> "未尝试提取";
    },id,contentHash));
    String revision=AiSupport.revision(Arrays.asList(row.id(),row.ownerType(),row.ownerId(),row.status(),row.fileName(),baseline,
        fingerprint==null?null:fingerprint.contentSize(),contentHash,readState,integrityState,extractionState,extractionHash));
    limitations.add("正文规则仅识别明确的待完善标记，不作合法性、竞争性或制度符合性认定。");
    return new Snapshot(revision,evidence,findings,limitations,List.of(new AccessTarget(row.ownerType(),row.ownerId())));
  }
}
