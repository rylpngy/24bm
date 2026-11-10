package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.attachment.application.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AgencyExecutionSupport {
  public final AgencyGuard guard;
  public final AgencyMapper packages;
  public final AgencyExecutionMapper data;
  public final AgencyJson json;
  private final AgencyFileAccess fileAccess;
  private final AttachmentReviewQuery attachments;
  private final ObjectStorageService storage;
  private final AttachmentArtifactWriter writer;
  private final AuditLogApplicationService audit;

  public AgencyExecutionSupport(
      AgencyGuard guard,
      AgencyMapper packages,
      AgencyExecutionMapper data,
      AgencyJson json,
      AgencyFileAccess fileAccess,
      AttachmentReviewQuery attachments,
      ObjectStorageService storage,
      AttachmentArtifactWriter writer,
      AuditLogApplicationService audit) {
    this.guard = guard;
    this.packages = packages;
    this.data = data;
    this.json = json;
    this.fileAccess = fileAccess;
    this.attachments = attachments;
    this.storage = storage;
    this.writer = writer;
    this.audit = audit;
  }

  public PackageRow read(String pkg, String permission) {
    guard.permissions().require(permission);
    var p = guard.require(pkg, false);
    if (!"approved".equals(p.status())) throw new IllegalStateException("建档尚未通过，不能开展项目执行");
    return p;
  }

  public PackageRow write(String pkg, String permission) {
    guard.permissions().require(permission);
    guard.requireApproved(pkg);
    var p = packages.lock(guard.tenant(), pkg);
    guard.requireApproved(pkg);
    if ("closed".equals(p.businessStatus())
        && !permission.startsWith("buyer:agency:finance:")
        && !permission.startsWith("buyer:agency:archive:")
        && !permission.startsWith("buyer:agency:post:"))
      throw new IllegalStateException("业务已办结，继续采购执行须先受控恢复业务；收付款与补档仍可继续");
    return p;
  }

  public record Source(String name, byte[] bytes, String hash, FileVersion version) {}

  public FileVersion sourceVersion(String id, String pkg) {
    var v = packages.version(guard.tenant(), id);
    if (v == null || !"sealed".equals(v.status()))
      throw new IllegalArgumentException("来源文件须为已封存版本");
    var f = fileAccess.requireFile(v.fileId(), false);
    if ("response_material".equals(f.category()) || "final_quote_material".equals(f.category()))
      throw new IllegalArgumentException("响应材料仅供受控现场审阅，不能引用为通用来源或发布稿");
    if (!pkg.equals(f.packageId())) throw new IllegalArgumentException("来源文件不属于当前采购包");
    fileAccess.requireAccess(id, false);
    return v;
  }

  public Source source(String id, String pkg) {
    var v = sourceVersion(id, pkg);
    var a =
        attachments.listActiveByTenantAndOwner(guard.tenant(), "agency_file_version", id).stream()
            .filter(x -> x.id().equals(v.attachmentId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("来源文件元数据缺失"));
    var bytes = storage.get(a.storageKey()).data();
    if (!v.hash().equals(json.bytesHash(bytes))) throw new IllegalStateException("来源文件哈希不一致");
    return new Source(a.fileName(), bytes, v.hash(), v);
  }

  public void publicDemandSource(String id, String pkg) {
    publicProjectSource(id, pkg, "结构化需求");
  }

  public void publicProjectSource(String id, String pkg, String purpose) {
    var v = sourceVersion(id, pkg);
    var f = packages.file(guard.tenant(), v.fileId());
    if (!"project".equals(f.visibility()))
      throw new IllegalArgumentException(purpose + "需引用项目可见资料，请先准备脱敏的项目可见版本");
  }

  public FileVersion artifact(String pkg, String name, byte[] bytes) {
    return artifact(pkg, name, bytes, "generated_document", "project");
  }

  public FileVersion restrictedFormArtifact(String pkg, String name, byte[] bytes) {
    guard.permissions().require("buyer:agency:preparation:confidential");
    return artifact(pkg, name, bytes, "preparation_form", "restricted");
  }

  private FileVersion artifact(
      String pkg, String name, byte[] bytes, String category, String visibility) {
    String file = "agency-file-" + UUID.randomUUID(), version = "agency-fv-" + UUID.randomUUID();
    packages.createFile(guard.tenant(), file, pkg, name, category, visibility, guard.actor());
    packages.createVersion(guard.tenant(), version, file, 1, guard.actor(), "由编制任务生成");
    var result =
        writer.write(
            "agency_file_version",
            version,
            name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            bytes);
    if (packages.seal(guard.tenant(), version, result.attachmentId(), result.hash(), result.size())
        != 1) throw new IllegalStateException("生成版本封存失败");
    return packages.version(guard.tenant(), version);
  }

  public void event(
      String pkg, String type, String id, Object before, Object after, String reason) {
    data.event(
        guard.tenant(),
        "agency-event-" + UUID.randomUUID(),
        pkg,
        type,
        id,
        before == null ? null : json.write(before),
        json.write(after),
        reason,
        guard.actor());
    audit.recordCurrentTenantAction(
        "agency.execution." + type, "agency_package", pkg, reason + "；对象" + id);
  }

  public void templateEvent(String id, Object before, Object after, String reason) {
    audit.recordCurrentTenantAction(
        "agency.template.changed",
        "agency_template",
        id,
        json.write(
            Map.of(
                "beforeHash",
                before == null ? "" : json.hash(before),
                "afterHash",
                json.hash(after),
                "reason",
                reason)));
  }

  public void text(String value, int max, boolean required, String field) {
    if (required && (value == null || value.isBlank()) || value != null && value.length() > max)
      throw new IllegalArgumentException(field + "缺失或过长");
  }

  public String str(String value) {
    return value == null ? "" : value.strip();
  }

  public void expected(long value, Long expected) {
    com.procurement.agency.domain.AgencyPolicy.expected(value, expected);
  }

  public String begin(String key, Object request) {
    text(key, 128, true, "幂等键");
    String hash = json.hash(Arrays.asList(guard.actor(), request));
    packages.lockRequest(guard.tenant(), key);
    var old = packages.idempotency(guard.tenant(), key);
    if (old != null && !hash.equals(old.fingerprint()))
      throw new AgencyConflictException("幂等键不能用于不同请求");
    return hash;
  }

  public String remembered(String key) {
    var old = packages.idempotency(guard.tenant(), key);
    return old == null ? null : old.responseJson();
  }

  public void remember(String key, String hash, Object response) {
    packages.remember(guard.tenant(), key, hash, json.write(response));
  }

  public List<Chapter> chapters(String raw) {
    return Arrays.asList(json.read(raw, Chapter[].class));
  }

  public List<Chapter> validateChapters(List<Chapter> values) {
    if (values == null || values.isEmpty() || values.size() > 30)
      throw new IllegalArgumentException("章节须为1至30项");
    Set<String> codes = new HashSet<>();
    int total = 0;
    for (var c : values) {
      if (c == null
          || c.code() == null
          || !c.code().matches("[a-z][a-z0-9_]{0,39}")
          || !codes.add(c.code())) throw new IllegalArgumentException("章节编码须唯一且仅含小写字母数字下划线");
      text(c.title(), 150, true, "章节标题");
      text(c.body(), 30000, false, "章节正文");
      total += c.body() == null ? 0 : c.body().length();
    }
    if (total > 150000) throw new IllegalArgumentException("章节总文字超过15万字");
    return values.stream()
        .map(c -> new Chapter(c.code(), c.title().strip(), str(c.body()), c.required()))
        .toList();
  }
}
