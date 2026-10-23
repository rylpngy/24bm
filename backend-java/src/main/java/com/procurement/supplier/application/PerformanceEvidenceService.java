package com.procurement.supplier.application;

import com.procurement.supplier.api.PerformanceEvidenceResponse;
import com.procurement.supplier.domain.PerformanceTask;
import com.procurement.supplier.infrastructure.PerformanceEvidenceMapper;
import com.procurement.supplier.infrastructure.PerformanceTaskMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.audit.application.AuditLogApplicationService;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PerformanceEvidenceService {
  private final PerformanceEvidenceMapper files;
  private final PerformanceTaskMapper tasks;
  private final PermissionService permissions;
  private final ObjectStorageService storage;
  private final AuditLogApplicationService audit;

  public PerformanceEvidenceService(PerformanceEvidenceMapper files, PerformanceTaskMapper tasks,
      PermissionService permissions, ObjectStorageService storage, AuditLogApplicationService audit) {
    this.files = files; this.tasks = tasks; this.permissions = permissions; this.storage = storage; this.audit = audit;
  }

  public PerformanceEvidenceResponse upload(String taskId, long version, String name, byte[] data) {
    var task = supplierTask(taskId, true);
    if (!"remediation_requested".equals(task.status()) || version != task.version())
      throw new IllegalStateException("整改状态或轮次已更新，请刷新后重新上传");
    if (name == null || name.isBlank() || name.length() > 180 || name.contains("/") || name.contains("\\")
        || name.chars().anyMatch(Character::isISOControl)
        || !name.toLowerCase(Locale.ROOT).matches(".+\\.(pdf|png|jpe?g|docx|xlsx)$"))
      throw new IllegalArgumentException("请选择PDF、图片、DOCX或XLSX文件，文件名不得超过180字");
    if (data == null || data.length == 0 || data.length > 10 * 1024 * 1024)
      throw new IllegalArgumentException("文件不能为空且不能超过10MB");
    int round = files.round(taskId);
    String hash = hash(data);
    var current = files.list(taskId, version).stream().filter(f -> f.round() == round).toList();
    var duplicate = current.stream().filter(f -> f.fileName().equals(name) && f.sha256().equals(hash)).findFirst();
    if (duplicate.isPresent()) return duplicate.get();
    if (current.size() >= 10) throw new IllegalArgumentException("每轮最多上传10份材料");
    String id = "evidence-" + UUID.randomUUID();
    String key = "performance-evidence/" + task.tenantId() + "/" + task.id() + "/" + id;
    // A task lock serializes upload registration with feedback submission. Keys are never overwritten.
    storage.put(key, data, "application/octet-stream");
    String user = TenantAccessGuard.requireUserId("performance evidence");
    files.insert(id, taskId, version, round, name, key, data.length, hash, user, tasks.supplierActor(task.supplierId(), user));
    audit.recordTenantAction(task.tenantId(), "supplier_performance_evidence.uploaded", "supplier_performance_task", taskId, "第" + round + "轮：" + name);
    return files.list(taskId, version).stream().filter(f -> f.id().equals(id)).findFirst().orElseThrow();
  }

  public List<PerformanceEvidenceResponse> listSupplier(String taskId) {
    var task = supplierTask(taskId, false);
    return files.list(taskId, task.version());
  }

  public List<PerformanceEvidenceResponse> listBuyer(String relationId, String taskId) {
    var task = buyerTask(relationId, taskId);
    return files.list(taskId, buyerVersion(task));
  }

  public Download downloadSupplier(String taskId, String id) {
    var task = supplierTask(taskId, false);
    return download(task, id, task.version());
  }

  public Download downloadBuyer(String relationId, String taskId, String id) {
    var task = buyerTask(relationId, taskId);
    return download(task, id, buyerVersion(task));
  }

  private long buyerVersion(PerformanceTask task) {
    return "remediation_requested".equals(task.status()) ? task.version() - 1 : task.version();
  }

  private Download download(PerformanceTask task, String id, long maxVersion) {
    var file = files.list(task.id(), maxVersion).stream().filter(f -> f.id().equals(id)).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("材料不存在或尚未提交"));
    var object = storage.get(files.key(task.id(), id));
    if (object.data().length != file.size() || !hash(object.data()).equals(file.sha256()))
      throw new IllegalStateException("材料完整性核验失败，请联系管理员");
    audit.recordTenantAction(task.tenantId(), "supplier_performance_evidence.downloaded", "supplier_performance_task", task.id(), file.id());
    return new Download(file.fileName(), object.data());
  }

  private PerformanceTask supplierTask(String taskId, boolean write) {
    String supplier = TenantAccessGuard.requireSupplierId("performance evidence");
    String user = TenantAccessGuard.requireUserId("performance evidence");
    permissions.require("supplier:profile:" + (write ? "manage" : "read"));
    if (tasks.supplierActor(supplier, user) == null) throw new PermissionDeniedException("需要有效的供应商身份");
    var task = tasks.lockSupplier(supplier, taskId);
    if (task == null) throw new IllegalArgumentException("整改任务不存在");
    return task;
  }

  private PerformanceTask buyerTask(String relation, String taskId) {
    String tenant = TenantAccessGuard.requireTenantId("performance evidence");
    String user = TenantAccessGuard.requireUserId("performance evidence");
    permissions.require("buyer:supplier:read");
    if (tasks.buyerActor(tenant, user) == null) throw new PermissionDeniedException("需要有效的采购方身份");
    var task = tasks.lockBuyer(tenant, relation, taskId);
    if (task == null) throw new IllegalArgumentException("整改任务不存在");
    return task;
  }

  private static String hash(byte[] data) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); }
    catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
  }
  public record Download(String fileName, byte[] data) {}
}
