package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.attachment.application.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyFileAccess implements AttachmentOwnerAccess {
  private final AgencyMapper mapper;
  private final AgencyGuard guard;
  private final AttachmentReviewQuery attachments;
  private final AgencyFileSafety safety;
  private final AgencyResponseAccess responses;
  private final AgencyFinalQuoteAccess finalQuotes;
  private final AgencyReportFileAccess reports;

  public AgencyFileAccess(
      AgencyMapper mapper,
      AgencyGuard guard,
      AttachmentReviewQuery attachments,
      AgencyFileSafety safety,
      AgencyResponseAccess responses,
      AgencyFinalQuoteAccess finalQuotes,
      AgencyReportFileAccess reports) {
    this.mapper = mapper;
    this.guard = guard;
    this.attachments = attachments;
    this.safety = safety;
    this.responses = responses;
    this.finalQuotes = finalQuotes;
    this.reports = reports;
  }

  public AgencyMapper mapper() {
    return mapper;
  }

  public AgencyGuard guard() {
    return guard;
  }

  public AttachmentReviewQuery attachments() {
    return attachments;
  }

  public AgencyFileSafety safety() {
    return safety;
  }

  public void validateUpload(String id, String name, byte[] data) {
    safety.inspect(name, data);
  }

  public Set<String> ownerTypes() {
    return Set.of("agency_file_version");
  }

  public boolean visible(FileRow f) {
    if ("evaluation_report".equals(f.category())) return reports != null && reports.visible(f);
    if ("final_quote_material".equals(f.category()))
      return finalQuotes != null && finalQuotes.visible(f);
    if ("response_material".equals(f.category())) return responses != null && responses.visible(f);
    if (("preparation_form".equals(f.category()) || "preparation_signed".equals(f.category()))
        && !guard.permissions().currentUserHas("buyer:agency:preparation:confidential"))
      return false;
    return "project".equals(f.visibility())
        || guard.actor().equals(f.createdBy())
        || guard.permissions().currentUserHas("buyer:agency:file:confidential");
  }

  public FileRow requireFile(String id, boolean write) {
    FileRow f = mapper.file(guard.tenant(), id);
    if (f == null) throw new PermissionDeniedException("附件不存在或无权访问");
    guard.require(f.packageId(), write);
    if (write && "response_material".equals(f.category())) responses.write(f);
    if (write && "final_quote_material".equals(f.category())) finalQuotes.write(f);
    if (!visible(f)) throw new PermissionDeniedException("无权查看受限附件");
    return f;
  }

  public void requireAccess(String id, boolean write) {
    FileVersion v = mapper.version(guard.tenant(), id);
    if (v == null) throw new PermissionDeniedException("附件版本不存在");
    FileRow f = requireFile(v.fileId(), write);
    if (write) {
      guard.permissions().require("buyer:agency:file:manage");
      PackageRow p = mapper.lock(guard.tenant(), f.packageId());
      guard.mutable(p);
      if ("response_material".equals(f.category())) responses.write(f);
      if ("final_quote_material".equals(f.category())) finalQuotes.write(f);
      v = mapper.lockVersion(guard.tenant(), id);
      if (!"uploading".equals(v.status())) throw new IllegalStateException("附件版本已封存或取消，不可覆盖");
      if (!guard.actor().equals(v.createdBy())) throw new PermissionDeniedException("仅版本创建人可完成上传");
      if (!attachments
          .listActiveByTenantAndOwner(guard.tenant(), "agency_file_version", id)
          .isEmpty()) throw new IllegalStateException("该版本已登记附件，请封存或创建新版本");
    } else {
      guard.permissions().require("buyer:agency:file:read");
      if ("response_material".equals(f.category())) responses.read(f, v);
      if ("final_quote_material".equals(f.category())) finalQuotes.read(f, v);
      if (!"sealed".equals(v.status())) throw new PermissionDeniedException("附件尚未通过检查并封存");
    }
  }

  public void requireDownloadAccess(String id) {
    requireAccess(id, false);
    guard.permissions().require("buyer:agency:file:download");
  }
}
