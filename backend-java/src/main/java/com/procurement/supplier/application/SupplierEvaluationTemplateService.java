package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.SupplierEvaluationScoring;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.Definition;
import com.procurement.supplier.api.SupplierEvaluationTemplateResponse;
import com.procurement.supplier.infrastructure.SupplierEvaluationTemplateMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierEvaluationTemplateService {
  private final SupplierEvaluationTemplateMapper mapper;
  private final PermissionService permissions;
  private final ObjectMapper json;
  private final AuditLogApplicationService audit;

  public SupplierEvaluationTemplateService(SupplierEvaluationTemplateMapper mapper,
      PermissionService permissions, ObjectMapper json, AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.permissions = permissions;
    this.json = json;
    this.audit = audit;
  }

  public List<SupplierEvaluationTemplateResponse> list() {
    String tenant = tenant();
    permissions.require("buyer:supplier:read");
    return mapper.list(tenant);
  }

  @Transactional
  public SupplierEvaluationTemplateResponse create(Definition definition) {
    String tenant = writer();
    definition.validate();
    String id = "et-" + UUID.randomUUID();
    mapper.insertTemplate(id, tenant);
    var version = append(tenant, id, definition);
    audit.recordTenantAction(tenant, "supplier_evaluation_template.created", "supplier_evaluation_template",
        id, snapshot(version.scoring()));
    return version;
  }

  @Transactional
  public SupplierEvaluationTemplateResponse version(String templateId, Definition definition) {
    String tenant = writer();
    definition.validate();
    requireGroup(tenant, templateId);
    var version = append(tenant, templateId, definition);
    audit.recordTenantAction(tenant, "supplier_evaluation_template.version_created", "supplier_evaluation_template",
        templateId, snapshot(version.scoring()));
    return version;
  }

  @Transactional
  public void enabled(String templateId, Boolean enabled) {
    String tenant = writer();
    if (enabled == null) throw new IllegalArgumentException("必须指定启停状态");
    requireGroup(tenant, templateId);
    mapper.enabled(tenant, templateId, enabled);
    audit.recordTenantAction(tenant, "supplier_evaluation_template." + (enabled ? "enabled" : "disabled"),
        "supplier_evaluation_template", templateId, "enabled=" + enabled);
  }

  // Called inside the evaluation/task transaction. Serialize selection with group disable.
  public SupplierEvaluationScoring selectForCreate(String versionId) {
    if (versionId == null) return SupplierEvaluationScoring.legacy();
    String tenant = tenant();
    var version = requireVersion(tenant, versionId);
    requireGroup(tenant, version.templateId());
    version = requireVersion(tenant, versionId);
    if (!version.enabled()) throw new IllegalStateException("模板已停用，不能用于新考核或任务");
    return version.scoring();
  }

  // Existing tasks keep their immutable version even when its group is disabled.
  public SupplierEvaluationScoring assigned(String tenant, String versionId) {
    return versionId == null ? SupplierEvaluationScoring.legacy() : requireVersion(tenant, versionId).scoring();
  }

  public String snapshot(SupplierEvaluationScoring scoring) {
    try { return json.writeValueAsString(scoring); }
    catch (JsonProcessingException ex) { throw new IllegalStateException("无法保存评分模板快照", ex); }
  }

  public SupplierEvaluationScoring readSnapshot(String snapshot) {
    if (snapshot == null) return SupplierEvaluationScoring.legacy();
    try { return json.readValue(snapshot, SupplierEvaluationScoring.class); }
    catch (JsonProcessingException ex) { throw new IllegalStateException("评分模板快照损坏", ex); }
  }

  private SupplierEvaluationTemplateResponse append(String tenant, String templateId, Definition definition) {
    String id = "etv-" + UUID.randomUUID();
    mapper.insertVersion(id, tenant, templateId, mapper.nextVersion(tenant, templateId),
        new Definition(definition.name().strip(), definition.qualityWeight(), definition.deliveryWeight(),
            definition.priceWeight(), definition.serviceWeight()));
    return requireVersion(tenant, id);
  }

  private SupplierEvaluationTemplateResponse requireVersion(String tenant, String id) {
    var version = mapper.find(tenant, id);
    if (version == null) throw new IllegalArgumentException("考核模板版本不存在");
    return version;
  }

  private void requireGroup(String tenant, String id) {
    if (mapper.lock(tenant, id) == null) throw new IllegalArgumentException("考核模板不存在");
  }

  private String writer() {
    String tenant = tenant();
    TenantAccessGuard.requireUserId("evaluation templates");
    permissions.require("buyer:supplier:manage");
    return tenant;
  }

  private String tenant() { return TenantAccessGuard.requireTenantId("evaluation templates"); }
}
