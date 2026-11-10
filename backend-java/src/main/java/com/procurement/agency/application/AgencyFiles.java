package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.attachment.application.AttachmentReviewQuery;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFiles {
  private final AgencyMapper mapper;
  private final AgencyGuard guard;
  private final AgencyFileAccess access;
  private final AttachmentReviewQuery attachments;
  private final ObjectStorageService storage;
  private final AgencyFileSafety safety;
  private final AgencyJson json;
  private final AuditLogApplicationService audit;

  public AgencyFiles(
      AgencyMapper mapper,
      AgencyGuard guard,
      AgencyFileAccess access,
      AttachmentReviewQuery attachments,
      ObjectStorageService storage,
      AgencyFileSafety safety,
      AgencyJson json,
      AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.guard = guard;
    this.access = access;
    this.attachments = attachments;
    this.storage = storage;
    this.safety = safety;
    this.json = json;
    this.audit = audit;
  }

  public AgencyMapper mapper() {
    return mapper;
  }

  public AgencyGuard guard() {
    return guard;
  }

  public AgencyFileAccess access() {
    return access;
  }

  public AttachmentReviewQuery attachments() {
    return attachments;
  }

  public ObjectStorageService storage() {
    return storage;
  }

  public AgencyFileSafety safety() {
    return safety;
  }

  public AgencyJson json() {
    return json;
  }

  public AuditLogApplicationService audit() {
    return audit;
  }

  public List<FileView> list(String id) {
    guard.require(id, false);
    if (!guard.permissions().currentUserHas("buyer:agency:file:read")) return List.of();
    return mapper.files(guard.tenant(), id).stream()
        .filter(access::visible)
        .map(f -> new FileView(f, mapper.versions(guard.tenant(), f.id())))
        .toList();
  }

  @Transactional
  public FileView create(String packageId, String name, String category, String visibility) {
    guard.permissions().require("buyer:agency:file:manage");
    guard.require(packageId, true);
    guard.mutable(mapper.lock(guard.tenant(), packageId));
    if (name == null
        || name.isBlank()
        || name.length() > 200
        || name.contains("/")
        || name.contains("\\")) throw new IllegalArgumentException("请输入有效附件名称");
    if (category == null
        || !Set.of("entrustment", "initiation", "demand_source", "other", "preparation_signed")
            .contains(category)) throw new IllegalArgumentException("请选择附件类别");
    if (visibility == null || !Set.of("project", "restricted").contains(visibility))
      throw new IllegalArgumentException("无效附件可见范围");
    if ("preparation_signed".equals(category)) {
      guard.permissions().require("buyer:agency:preparation:confidential");
      if (!"restricted".equals(visibility)) throw new IllegalArgumentException("人员签署件必须使用受限材料范围");
    }
    String id = "agency-file-" + UUID.randomUUID();
    mapper.createFile(
        guard.tenant(), id, packageId, name.strip(), category, visibility, guard.actor());
    mapper.createVersion(
        guard.tenant(), "agency-fv-" + UUID.randomUUID(), id, 1, guard.actor(), "首次上传");
    audit.recordTenantAction("agency.file.created", "agency_package", packageId);
    return new FileView(mapper.file(guard.tenant(), id), mapper.versions(guard.tenant(), id));
  }

  @Transactional
  public FileVersion next(String fileId, int expectedOrdinal, String reason) {
    guard.permissions().require("buyer:agency:file:manage");
    var f = access.requireFile(fileId, true);
    guard.mutable(mapper.lock(guard.tenant(), f.packageId()));
    mapper.lockFile(guard.tenant(), fileId);
    if (reason == null || reason.isBlank() || reason.length() > 1000)
      throw new IllegalArgumentException("请填写版本变更原因");
    if (("generated_document".equals(f.category())
        || "preparation_form".equals(f.category())
        || "response_material".equals(f.category())
        || "final_quote_material".equals(f.category())
        || "evaluation_report".equals(f.category())))
      throw new IllegalStateException("生成文档须从编制工作区创建新版本");
    var versions = mapper.versions(guard.tenant(), fileId);
    if (versions.getFirst().ordinal() != expectedOrdinal)
      throw new AgencyConflictException("附件已有新版本，请刷新");
    if (versions.stream().anyMatch(v -> "uploading".equals(v.status())))
      throw new IllegalStateException("请先完成或取消待上传版本");
    String id = "agency-fv-" + UUID.randomUUID();
    mapper.createVersion(
        guard.tenant(), id, fileId, expectedOrdinal + 1, guard.actor(), reason.strip());
    audit.recordTenantAction("agency.file.version.created", "agency_package", f.packageId());
    return mapper.version(guard.tenant(), id);
  }

  @Transactional
  public FileVersion seal(String versionId, String attachmentId) {
    guard.permissions().require("buyer:agency:file:manage");
    var first = mapper.version(guard.tenant(), versionId);
    if (first == null) throw new IllegalArgumentException("版本不存在");
    var f = access.requireFile(first.fileId(), true);
    guard.mutable(mapper.lock(guard.tenant(), f.packageId()));
    if ("response_material".equals(f.category()) || "final_quote_material".equals(f.category()))
      access.requireFile(f.id(), true);
    var v = mapper.lockVersion(guard.tenant(), versionId);
    if ("sealed".equals(v.status()) && Objects.equals(v.attachmentId(), attachmentId)) return v;
    if (!"uploading".equals(v.status()) || !guard.actor().equals(v.createdBy()))
      throw new IllegalStateException("版本不可封存或非当前上传人");
    var metadata =
        attachments
            .listActiveByTenantAndOwner(guard.tenant(), "agency_file_version", versionId)
            .stream()
            .filter(a -> attachmentId == null || a.id().equals(attachmentId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("附件与版本不一致"));
    var fp = attachments.contentFingerprint(guard.tenant(), attachmentId);
    if (fp != null && fp.size() != null && fp.size() > AgencyFileSafety.MAX_BYTES)
      throw new IllegalArgumentException("附件超过10MB");
    if (fp == null || fp.size() == null || fp.hash() == null)
      throw new IllegalStateException("附件缺少真实上传字节及哈希证据");
    var stored = storage.get(metadata.storageKey());
    byte[] bytes = stored.data();
    if (fp.size() != bytes.length || !fp.hash().equals(json.bytesHash(bytes)))
      throw new IllegalStateException("附件字节与上传哈希不一致");
    safety.inspect(metadata.fileName(), bytes);
    if (mapper.seal(guard.tenant(), versionId, attachmentId, fp.hash(), bytes.length) != 1)
      throw new AgencyConflictException("文件版本已变化");
    audit.recordCurrentTenantAction(
        "agency.file.sealed",
        "agency_package",
        f.packageId(),
        "版本" + v.ordinal() + "；基础内容检查通过；SHA256=" + fp.hash());
    return mapper.version(guard.tenant(), versionId);
  }

  @Transactional
  public void cancel(String versionId, String reason) {
    guard.permissions().require("buyer:agency:file:manage");
    var v = mapper.version(guard.tenant(), versionId);
    if (v == null) throw new IllegalArgumentException("版本不存在");
    var f = access.requireFile(v.fileId(), true);
    guard.mutable(mapper.lock(guard.tenant(), f.packageId()));
    if (reason == null || reason.isBlank() || reason.length() > 1000)
      throw new IllegalArgumentException("请填写取消原因");
    if (mapper.cancelVersion(guard.tenant(), versionId, reason.strip()) != 1)
      throw new IllegalStateException("仅可取消未封存版本");
    audit.recordCurrentTenantAction(
        "agency.file.version.cancelled", "agency_package", f.packageId(), reason);
  }

  public List<Map<String, Object>> frozenManifest(String packageId) {
    List<Map<String, Object>> all = new ArrayList<>();
    for (var f : mapper.files(guard.tenant(), packageId)) {
      if ("response_material".equals(f.category()) || "final_quote_material".equals(f.category()))
        continue;
      var current =
          mapper.versions(guard.tenant(), f.id()).stream()
              .filter(v -> "sealed".equals(v.status()))
              .findFirst();
      if (current.isEmpty()) continue;
      var v = current.get();
      all.add(
          Map.of(
              "fileId",
              f.id(),
              "versionId",
              v.id(),
              "ordinal",
              v.ordinal(),
              "attachmentId",
              v.attachmentId(),
              "sha256",
              v.hash(),
              "visibility",
              f.visibility(),
              "name",
              "restricted".equals(f.visibility()) ? "Restricted attachment" : f.name()));
    }
    return all;
  }
}
