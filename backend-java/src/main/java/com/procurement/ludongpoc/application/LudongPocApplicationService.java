package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.catalog.domain.Material;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.ludongpoc.api.LudongPocApplicationRequest;
import com.procurement.ludongpoc.api.LudongPocApplicationResponse;
import com.procurement.ludongpoc.api.LudongPocStatsResponse;
import com.procurement.ludongpoc.api.LudongPocPriorApprovalEvidence;
import com.procurement.ludongpoc.domain.LudongPocApplication;
import com.procurement.ludongpoc.domain.LudongPocReviewRecord;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import com.procurement.ludongpoc.infrastructure.LudongPocReviewRecordMapper;
import com.procurement.ludongpoc.api.CompleteLudongPocTaskRequest;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.domain.Department;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowCompletionResult;
import com.procurement.workflow.application.WorkflowDefinitionPublicationService;
import com.procurement.workflow.application.WorkflowReusedTask;
import com.procurement.workflow.application.WorkflowStartCommand;
import com.procurement.workflow.application.WorkflowTaskContext;
import com.procurement.workflow.domain.WorkflowDefinitionVersion;
import com.procurement.ludongpoc.api.LudongPocTaskCompletionResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LudongPocApplicationService {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final TypeReference<List<Map<String, Object>>> ITEMS_TYPE = new TypeReference<>() {};

  private final LudongPocApplicationMapper mapper;
  private final WorkflowDefinitionPublicationService publicationService;
  private final UnifiedWorkflowApplicationService workflowService;
  private final PermissionService permissionService;
  private final AuditLogApplicationService auditService;
  private final ObjectMapper objectMapper;
  private final LudongPocReviewRecordMapper reviewRecordMapper;
  private final MaterialApplicationService materialApplicationService;
  private final DepartmentApplicationService departmentApplicationService;
  private final com.procurement.attachment.infrastructure.AttachmentMapper attachments;

  public LudongPocApplicationService(
      LudongPocApplicationMapper mapper,
      WorkflowDefinitionPublicationService publicationService,
      UnifiedWorkflowApplicationService workflowService,
      PermissionService permissionService,
      AuditLogApplicationService auditService,
      ObjectMapper objectMapper,
      LudongPocReviewRecordMapper reviewRecordMapper,
      MaterialApplicationService materialApplicationService,
      DepartmentApplicationService departmentApplicationService,
      com.procurement.attachment.infrastructure.AttachmentMapper attachments) {
    this.mapper = mapper;
    this.publicationService = publicationService;
    this.workflowService = workflowService;
    this.permissionService = permissionService;
    this.auditService = auditService;
    this.objectMapper = objectMapper;
    this.reviewRecordMapper = reviewRecordMapper;
    this.materialApplicationService = materialApplicationService;
    this.departmentApplicationService = departmentApplicationService;
    this.attachments = attachments;
  }

  public List<LudongPocArchiveMaterialCatalog.Category> archiveCategories(String id) {
    requireRead();
    return archiveCategories(requireApplication(tenant(), id));
  }

  public List<LudongPocArchiveMaterialCatalog.Category> archiveCategories(LudongPocApplication application) {
    String schema = attachmentFormSchema(application);
    List<LudongPocArchiveMaterialCatalog.Category> configured = LudongPocArchiveMaterialCatalog.parse(readTree(schema));
    var result = new java.util.ArrayList<>(configured);
    for (var category : LudongPocArchiveMaterialCatalog.supported()) {
      if (result.stream().noneMatch(item -> item.ownerType().equals(category.ownerType()))
          && !attachments.listActiveByTenantAndOwner(application.tenantId(), category.ownerType(), application.id()).isEmpty()) {
        result.add(category);
      }
    }
    return List.copyOf(result);
  }

  private String attachmentFormSchema(LudongPocApplication application) {
    if (!List.of("draft", "rejected").contains(application.status())) {
      String frozen = mapper.latestWorkflowFormSchema(application.tenantId(), application.id());
      if (frozen != null) return frozen;
      return "{}";
    }
    var published = publicationService.findPublishedVersion(application.tenantId(), LudongPocWorkflowDefinition.BUSINESS_TYPE);
    return published == null ? "{}" : published.formSchema();
  }

  private JsonNode readTree(String source) {
    try { return objectMapper.readTree(source == null ? "{}" : source); }
    catch (Exception exception) { throw new IllegalStateException("已发布附件配置无法解析", exception); }
  }

  public List<LudongPocApplicationResponse> list() {
    String tenantId = tenant();
    requireRead();
    return mapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  public LudongPocApplicationResponse get(String id) {
    requireRead();
    return toResponse(requireApplication(tenant(), id));
  }

  public List<LudongPocPriorApprovalEvidence> listPriorApprovals(String id) {
    requireRead();
    LudongPocApplication application = requireApplication(tenant(), id);
    return reviewRecordMapper.listEffectiveByApplication(application.tenantId(), application.id()).stream()
        .map(review -> new LudongPocPriorApprovalEvidence(
            review.nodeId(), review.reviewerId(), review.decision(),
            readMap(review.reviewDataJson()), review.comment(), review.reviewedAt()))
        .toList();
  }

  public List<LudongPocReviewRecord> reviewHistory(String applicationId, String instanceId) {
    requireRead();
    requireApplication(tenant(), applicationId);
    var history = workflowService.getCurrentTenantHistory(instanceId);
    if (!LudongPocWorkflowDefinition.BUSINESS_TYPE.equals(history.businessType()) || !applicationId.equals(history.businessId())) {
      throw new IllegalArgumentException("审批实例与申报不匹配");
    }
    return reviewRecordMapper.listByInstance(tenant(), applicationId, instanceId);
  }

  @Transactional
  public LudongPocApplicationResponse create(LudongPocApplicationRequest request) {
    return create(request, false);
  }

  @Transactional
  public LudongPocApplicationResponse saveDraft(String id, LudongPocApplicationRequest request) {
    permissionService.require("buyer:ludong-poc:write");
    if (request.formData() == null || request.items() == null
        || request.projectName() == null || request.applicantUnit() == null) {
      throw new IllegalArgumentException("草稿必须包含表单和设备清单，未填写的内容可留空");
    }
    if (request.departmentId() != null && !request.departmentId().isBlank()
        && departmentApplicationService.findCurrentTenantActiveDepartment(request.departmentId()) == null) {
      throw new IllegalArgumentException("申报单位不存在或不属于当前租户");
    }
    return id == null ? create(request, true) : update(id, request, true);
  }

  private LudongPocApplicationResponse create(LudongPocApplicationRequest request, boolean draft) {
    permissionService.require("buyer:ludong-poc:write");
    List<Map<String, Object>> normalizedItems = prepareApplicationItems(request.items(), draft);
    Map<String, Object> normalizedForm = prepareApplicationForm(request.formData(), normalizedItems);
    if (!draft) validate(request, normalizedForm, normalizedItems);
    BigDecimal budgetAmount = calculateBudget(normalizedItems, draft);
    String tenantId = tenant();
    String userId = user();
    String id = "ldu-poc-" + UUID.randomUUID();
    String no = "LDUG-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)
        + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    mapper.insert(
        id, tenantId, no, request.projectName().trim(), request.applicantUnit().trim(),
        blankToNull(request.departmentId()), budgetAmount, write(normalizedForm),
        write(normalizedItems), userId);
    auditService.recordCurrentTenantAction(
        "ludong_poc.created", "ludong_project_application", id, "创建货物类采购申报材料包 " + no);
    return get(id);
  }

  @Transactional
  public LudongPocApplicationResponse update(String id, LudongPocApplicationRequest request) {
    return update(id, request, false);
  }

  private LudongPocApplicationResponse update(String id, LudongPocApplicationRequest request, boolean draft) {
    permissionService.require("buyer:ludong-poc:write");
    List<Map<String, Object>> normalizedItems = prepareApplicationItems(request.items(), draft);
    Map<String, Object> normalizedForm = prepareApplicationForm(request.formData(), normalizedItems);
    if (!draft) validate(request, normalizedForm, normalizedItems);
    BigDecimal budgetAmount = calculateBudget(normalizedItems, draft);
    requireApplication(tenant(), id);
    int changed = mapper.updateDraft(
        tenant(), id, request.projectName().trim(), request.applicantUnit().trim(),
        blankToNull(request.departmentId()), budgetAmount, write(normalizedForm), write(normalizedItems));
    if (changed == 0) {
      throw new IllegalStateException("只有草稿或已驳回的申报可以编辑");
    }
    auditService.recordCurrentTenantAction(
        "ludong_poc.updated", "ludong_project_application", id, "更新申报材料与设备清单");
    return get(id);
  }

  @Transactional
  public LudongPocApplicationResponse submit(String id) {
    permissionService.require("buyer:ludong-poc:write");
    String tenantId = tenant();
    String userId = user();
    LudongPocApplication application = mapper.findByTenantAndIdForUpdate(tenantId, id);
    if (application == null) throw new IllegalArgumentException("申报不存在或不在当前企业范围内");
    Map<String, Object> form = readMap(application.formDataJson());
    LudongPocTaskFormCatalog.clearApprovalFields(form);
    List<Map<String, Object>> items = readItems(application.itemsJson());
    validate(new LudongPocApplicationRequest(application.projectName(), application.applicantUnit(),
        application.departmentId(), application.budgetAmount(), form, items), form, items);
    BigDecimal total = items.stream().map(item -> new BigDecimal(String.valueOf(item.get("quantity")))
        .multiply(new BigDecimal(String.valueOf(item.get("unitPrice"))))).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (total.compareTo(application.budgetAmount()) != 0) throw new IllegalArgumentException("设备清单合计与预算不一致，请编辑并重新保存");
    validateWorkflowFlags(form);
    // 默认流程只在首次启用时初始化。后续必须使用管理员在配置器中
    // 发布的版本，不能在业务提交时用代码内默认 schema 覆盖租户配置。
    ensureRequiredWorkflowDefinition(tenantId, userId);
    var published = publicationService.findPublishedVersion(tenantId, LudongPocWorkflowDefinition.BUSINESS_TYPE);
    JsonNode attachmentConfig = readTree(published == null ? "{}" : published.formSchema());
    if (attachmentConfig.has("attachmentCategories")) {
      for (var category : LudongPocArchiveMaterialCatalog.parse(attachmentConfig)) {
        if (category.required() && attachments.listActiveByTenantAndOwner(tenantId, category.ownerType(), id).isEmpty()) {
          throw new IllegalArgumentException("请先上传必备材料：" + category.label());
        }
      }
    }
    if (mapper.markSubmitted(tenantId, id, userId) == 0) {
      throw new IllegalStateException("当前申报状态不允许提交审批");
    }
    Map<String, Object> workflowForm = new LinkedHashMap<>();
    List.of("requiresItReview", "requiresAssetReview", "requiresLabReview")
        .forEach(key -> workflowForm.put(key, form.get(key)));
    workflowForm.put("requiresSchoolLeader", requiresSchoolLeader(application, form) ? "是" : "否");
    workflowService.start(new WorkflowStartCommand(
        LudongPocWorkflowDefinition.BUSINESS_TYPE,
        id,
        application.departmentId(),
        application.budgetAmount(),
        workflowForm,
        Map.of(
            "applicationNo", application.applicationNo(),
            "projectName", application.projectName(),
            "applicantUnit", application.applicantUnit(),
            "departmentId", application.departmentId(),
            "budgetAmount", application.budgetAmount(),
            "formData", form, "items", items)));
    auditService.recordCurrentTenantAction(
        "ludong_poc.submitted", "ludong_project_application", id, "提交统一 Flowable 审批");
    return get(id);
  }

  public LudongPocStatsResponse stats() {
    List<LudongPocApplication> all = mapper.listByTenant(tenant());
    requireRead();
    return new LudongPocStatsResponse(
        all.size(), count(all, "draft") + count(all, "rejected"), count(all, "in_approval"),
        count(all, "approved"), count(all, "archived"),
        all.stream().map(LudongPocApplication::budgetAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  @Transactional
  public LudongPocTaskCompletionResponse completeTask(
      String taskId, CompleteLudongPocTaskRequest request) {
    permissionService.require("buyer:ludong-poc:review");
    requireApplication(tenant(), request.applicationId());
    if (!List.of("approve", "reject").contains(request.action())) {
      throw new IllegalArgumentException("审批动作必须是 approve 或 reject");
    }
    WorkflowTaskContext task = workflowService.requireCurrentUserTaskContext(taskId);
    if (!LudongPocWorkflowDefinition.BUSINESS_TYPE.equals(task.businessType())
        || !request.applicationId().equals(task.businessId())) {
      throw new IllegalArgumentException("审批任务与鲁东采购申报不匹配");
    }
    String nodeId = LudongPocTaskFormCatalog.normalizeNodeId(task.taskDefinitionKey());
    if (!nodeId.equals(LudongPocTaskFormCatalog.normalizeNodeId(request.nodeId()))) {
      throw new IllegalArgumentException("审批节点已变化，请刷新待办后重试");
    }
    Map<String, Object> reviewData = LudongPocTaskFormCatalog.validate(
        nodeId, request.action(), request.reviewData());
    reviewRecordMapper.insert(
        "ldu-review-" + UUID.randomUUID(), tenant(), request.applicationId(), taskId,
        nodeId, user(), request.action(), write(reviewData), request.comment());
    WorkflowCompletionResult completion = workflowService.completeCurrentUserTaskForBusiness(
        taskId, request.action(), request.comment());
    recordReusedApprovals(request.applicationId(), completion.reusedTasks());
    return new LudongPocTaskCompletionResponse(completion.status(), completion.actedAt());
  }

  private void recordReusedApprovals(
      String applicationId, List<WorkflowReusedTask> reusedTasks) {
    Map<String, Map<String, Object>> generatedDataByTask = new LinkedHashMap<>();
    for (WorkflowReusedTask reused : reusedTasks) {
      Map<String, Object> sourceData = generatedDataByTask.get(reused.sourceTaskId());
      if (sourceData == null) {
        LudongPocReviewRecord source = reviewRecordMapper.findByWorkflowTaskId(
            tenant(), applicationId, reused.sourceTaskId());
        sourceData = source == null ? Map.of() : readMap(source.reviewDataJson());
      }
      String targetNodeId = LudongPocTaskFormCatalog.normalizeNodeId(reused.nodeId());
      Map<String, Object> reusedData = LudongPocTaskFormCatalog.reusedApprovalData(
          targetNodeId, reused.sourceNodeId(), sourceData);
      reviewRecordMapper.insert(
          "ldu-review-" + UUID.randomUUID(),
          tenant(),
          applicationId,
          reused.taskId(),
          targetNodeId,
          reused.actorId(),
          "approve",
          write(reusedData),
          reused.comment());
      generatedDataByTask.put(reused.taskId(), reusedData);
      auditService.recordAutomatedTenantAction(
          tenant(),
          reused.actorId(),
          "ludong_poc.approval_reused",
          LudongPocWorkflowDefinition.BUSINESS_TYPE,
          applicationId,
          "节点 " + targetNodeId + " 按工号 " + reused.employeeNo()
              + " 复用节点 " + LudongPocTaskFormCatalog.normalizeNodeId(reused.sourceNodeId())
              + " 的审批结论，已生成节点表单快照");
    }
  }

  public LudongPocApplication requireForExport(String id) {
    permissionService.require("buyer:ludong-poc:export");
    LudongPocApplication application = requireApplication(tenant(), id);
    if (!List.of("approved", "archived").contains(application.status())) {
      throw new IllegalStateException("表格仅可在审批通过后下载归档");
    }
    return application;
  }

  @Transactional
  public void markArchived(String id) {
    permissionService.require("buyer:ludong-poc:export");
    requireForExport(id);
    mapper.markArchived(tenant(), id);
    auditService.recordCurrentTenantAction(
        "ludong_poc.archived", "ludong_project_application", id, "下载完整归档材料包");
  }

  private void requireRead() {
    if (!permissionService.currentUserHas("buyer:ludong-poc:read")
        && !permissionService.currentUserHas("buyer:ludong-poc:write")
        && !permissionService.currentUserHas("buyer:ludong-poc:review")
        && !permissionService.currentUserHas("buyer:ludong-poc:export")) {
      permissionService.require("buyer:ludong-poc:read");
    }
  }

  private LudongPocApplication requireApplication(String tenantId, String id) {
    LudongPocApplication application = mapper.findByTenantAndId(tenantId, id);
    if (application == null) {
      throw new IllegalArgumentException("鲁东 POC 申报不存在或不在当前租户范围内: " + id);
    }
    return application;
  }

  private void validate(
      LudongPocApplicationRequest request,
      Map<String, Object> formData,
      List<Map<String, Object>> items) {
    if (request.projectName().isBlank() || request.applicantUnit().isBlank()) {
      throw new IllegalArgumentException("采购项目名称和申报单位不能为空");
    }
    if (request.departmentId() == null || request.departmentId().isBlank()) {
      throw new IllegalArgumentException("必须从学校组织机构中选择申报单位");
    }
    Department department = departmentApplicationService.findCurrentTenantActiveDepartment(request.departmentId());
    if (department == null) {
      throw new IllegalArgumentException("申报单位不存在或不属于当前租户");
    }
    if (department.parentId() == null || department.parentId().isBlank()) {
      throw new IllegalArgumentException("请选择具体申报单位，不能选择组织分类");
    }
    if (!request.applicantUnit().trim().equals(department.name())) {
      throw new IllegalArgumentException("申报单位名称与组织机构主数据不一致，请重新选择");
    }
    Map<String, String> requiredFields = Map.ofEntries(
        Map.entry("projectLeaderName", "项目负责人"),
        Map.entry("technicalLeaderName", "技术负责人"),
        Map.entry("fundingSource", "经费来源"),
        Map.entry("fundingUnitId", "经费主管单位"),
        Map.entry("purchaseReason", "购置理由及必要性"),
        Map.entry("procurementFunction", "采购标的需实现的功能"),
        Map.entry("procurementGoal", "采购标的需实现的目标"),
        Map.entry("implementationLocation", "项目实施地点"),
        Map.entry("installationReady", "是否具备安装条件"),
        Map.entry("utilitiesReady", "水电暖气等条件是否满足"),
        Map.entry("deliveryDays", "交付天数"),
        Map.entry("coreProduct", "核心产品"),
        Map.entry("warrantyYears", "质量保证期"));
    for (Map.Entry<String, String> field : requiredFields.entrySet()) {
      Object value = formData.get(field.getKey());
      if (value == null || String.valueOf(value).isBlank()) {
        throw new IllegalArgumentException("采购需求表必填项不能为空: " + field.getValue());
      }
    }
    for (Map.Entry<String, String> field : Map.of(
        "deliveryDays", "交付天数", "warrantyYears", "质量保证期").entrySet()) {
      try {
        if (new BigDecimal(String.valueOf(formData.get(field.getKey()))).signum() <= 0) {
          throw new IllegalArgumentException(field.getValue() + "必须大于 0");
        }
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException(field.getValue() + "必须是有效数字", exception);
      }
    }
    for (String field : List.of("siteVisitRequired", "sampleRequired", "demoRequired")) {
      if (!List.of("是", "否").contains(String.valueOf(formData.get(field)))) {
        throw new IllegalArgumentException("请完整选择评审现场与补充要求: " + field);
      }
    }
    if ("是".equals(String.valueOf(formData.get("siteVisitRequired")))) {
      requireFormText(formData, "siteVisitTime", "勘查时间");
      requireFormText(formData, "siteVisitLocation", "勘查地点");
      requireFormText(formData, "siteVisitContact", "勘查联系人");
      requireFormText(formData, "siteVisitPhone", "勘查联系电话");
    }
    if ("是".equals(String.valueOf(formData.get("sampleRequired")))) {
      requireFormText(formData, "sampleRequirement", "样品要求");
    }
    if ("是".equals(String.valueOf(formData.get("demoRequired")))) {
      requireFormText(formData, "demoDuration", "演示时长");
      requireFormText(formData, "demoRequirement", "演示要求");
    }
    if (items.isEmpty()) {
      throw new IllegalArgumentException("至少填写一条拟采购设备明细");
    }
    int coreProductCount = 0;
    for (int index = 0; index < items.size(); index++) {
      Map<String, Object> item = items.get(index);
      if (item.get("name") == null || String.valueOf(item.get("name")).isBlank()) {
        throw new IllegalArgumentException("第 " + (index + 1) + " 条设备名称不能为空");
      }
      requireItemText(item, index, "unit", "计量单位");
      requireItemText(item, index, "technicalParameters", "主要技术参数");
      requireItemText(item, index, "purpose", "主要用途");
      requireItemText(item, index, "imported", "是否进口设备");
      if (!List.of("是", "否").contains(String.valueOf(item.get("imported")))) {
        throw new IllegalArgumentException("第 " + (index + 1) + " 条是否进口设备必须选择是或否");
      }
      if ("是".equals(String.valueOf(item.get("imported")))) {
        requireItemText(item, index, "importLeadTime", "进口设备预计供货期");
      }
      requireItemText(item, index, "usageDirection", "使用方向");
      if (!List.of("教学", "科研", "行政", "行政办公", "其他")
          .contains(String.valueOf(item.get("usageDirection")))) {
        throw new IllegalArgumentException("第 " + (index + 1) + " 条使用方向不在允许范围内");
      }
      requireItemText(item, index, "userName", "使用人");
      requireItemText(item, index, "installationLocation", "存放地点");
      requireItemText(item, index, "coreProduct", "是否核心产品");
      requireItemText(item, index, "governmentMallCatalog", "是否属于网上商城目录");
      if ("是".equals(String.valueOf(item.get("coreProduct")))) {
        coreProductCount++;
      }
      try {
        if (new BigDecimal(String.valueOf(item.get("quantity"))).signum() <= 0) {
          throw new IllegalArgumentException("第 " + (index + 1) + " 条设备数量必须大于 0");
        }
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException("第 " + (index + 1) + " 条设备数量必须是有效数字", exception);
      }
      requirePositiveItemNumber(item, index, "unitPrice", "市场调研单价");
      if ("是".equals(String.valueOf(item.get("governmentMallCatalog")))) {
        requireItemText(item, index, "selectedBrand", "商城最终品牌");
        requireItemText(item, index, "selectedModel", "商城最终型号");
        requireItemText(item, index, "selectedSupplier", "商城供应商");
        requirePositiveItemNumber(item, index, "standardUnitPrice", "配置标准单价");
        requirePositiveItemNumber(item, index, "selectedUnitPrice", "商城确认单价");
        requireItemText(item, index, "selectionParticipants", "商城选型人员");
      }
    }
    if (coreProductCount != 1) {
      throw new IllegalArgumentException("拟采购设备清单必须且只能标注一个核心产品");
    }
  }

  private static void requireFormText(Map<String, Object> form, String field, String label) {
    Object value = form.get(field);
    if (value == null || String.valueOf(value).isBlank()) {
      throw new IllegalArgumentException("采购需求表必填项不能为空: " + label);
    }
  }

  private static void requirePositiveItemNumber(
      Map<String, Object> item, int index, String field, String label) {
    requireItemText(item, index, field, label);
    try {
      if (new BigDecimal(String.valueOf(item.get(field))).signum() <= 0) {
        throw new IllegalArgumentException("第 " + (index + 1) + " 条" + label + "必须大于 0");
      }
    } catch (NumberFormatException exception) {
      throw new IllegalArgumentException("第 " + (index + 1) + " 条" + label + "必须是有效数字", exception);
    }
  }

  private static void requireItemText(
      Map<String, Object> item, int index, String field, String label) {
    Object value = item.get(field);
    if (value == null || String.valueOf(value).isBlank()) {
      throw new IllegalArgumentException("第 " + (index + 1) + " 条" + label + "不能为空");
    }
  }

  private void validateWorkflowFlags(Map<String, Object> form) {
    for (String key : List.of("requiresItReview", "requiresAssetReview", "requiresLabReview")) {
      if (!List.of("是", "否").contains(String.valueOf(form.get(key)))) {
        throw new IllegalArgumentException("提交前必须完成审批路由项: " + key);
      }
    }
    if (!List.of("学院", "其他单位").contains(String.valueOf(form.get("applicantUnitType")))) {
      throw new IllegalArgumentException("提交前必须选择申报单位类型");
    }
  }

  /**
   * 新增的法定材料签字节点必须进入真实 Flowable 版本。若租户已经调整过其他节点，
   * 仅在现有发布版本中补入缺失节点，保留其余自定义条件和顺序。
   */
  private void ensureRequiredWorkflowDefinition(String tenantId, String userId) {
    WorkflowDefinitionVersion current = publicationService.findPublishedVersion(
        tenantId, LudongPocWorkflowDefinition.BUSINESS_TYPE);
    if (current == null) {
      publicationService.ensurePublishedDefinition(
          tenantId,
          userId,
          "process-ldu-goods-application",
          "鲁东大学货物类采购申报",
          "采购需求表与采购招标申请单共用一个材料包；按条件路由审核并统一归档。",
          LudongPocWorkflowDefinition.BUSINESS_TYPE,
          LudongPocWorkflowDefinition.FORM_SCHEMA,
          LudongPocWorkflowDefinition.FLOW_SCHEMA);
      return;
    }
    String upgradedFlow = upgradeManagedFlow(current.flowSchema());
    boolean formNeedsUpgrade = current.formSchema().contains("sameFundingUnit");
    if (upgradedFlow == null && !formNeedsUpgrade) {
      return;
    }
    publicationService.ensureManagedPublishedDefinition(
        tenantId,
        userId,
        "process-ldu-goods-application",
        "鲁东大学货物类采购申报",
        "采购需求表与采购招标申请单共用一个材料包；按条件路由审核并统一归档。",
        LudongPocWorkflowDefinition.BUSINESS_TYPE,
        LudongPocWorkflowDefinition.FORM_SCHEMA,
        upgradedFlow == null ? current.flowSchema() : upgradedFlow);
  }

  private String upgradeManagedFlow(String flowSchema) {
    try {
      JsonNode parsed = objectMapper.readTree(flowSchema);
      if (!(parsed instanceof ObjectNode root) || !(root.path("steps") instanceof ArrayNode steps)) {
        throw new IllegalArgumentException("鲁东 POC 流程定义缺少 steps 数组");
      }
      List<String> requiredIds = List.of(
          "technical_leader_review",
          "compilation_participant_review",
          "mall_selection_participant_review");
      List<String> existingIds = new java.util.ArrayList<>();
      steps.forEach(step -> existingIds.add(step.path("id").asText()));
      boolean changed = false;
      int insertAt = Math.max(0, existingIds.indexOf("argumentation_review") + 1);
      List<ObjectNode> requiredSteps = List.of(
          approvalStep("technical_leader_review", "技术负责人确认", "role-ldu-technical-leader"),
          approvalStep("compilation_participant_review", "参与编制人员确认", "role-ldu-compilation-participant"),
          approvalStep("mall_selection_participant_review", "网上商城选型参与人确认", "role-ldu-mall-selection-participant"));
      for (ObjectNode step : requiredSteps) {
        if (!existingIds.contains(step.path("id").asText())) {
          steps.insert(insertAt++, step);
          changed = true;
        }
      }
      boolean fundingStepPresent = false;
      for (int index = 0; index < steps.size(); index++) {
        String id = steps.get(index).path("id").asText();
        if ("funding_route".equals(id)) {
          steps.set(index, approvalStep(
              "funding_review", "经费主管单位负责人审核", "role-ldu-funding-manager"));
          fundingStepPresent = true;
          changed = true;
        } else if ("funding_review".equals(id)) {
          fundingStepPresent = true;
        }
      }
      if (!fundingStepPresent) {
        int unitIndex = -1;
        for (int index = 0; index < steps.size(); index++) {
          if ("unit_review".equals(steps.get(index).path("id").asText())) {
            unitIndex = index;
            break;
          }
        }
        steps.insert(unitIndex < 0 ? steps.size() : unitIndex + 1, approvalStep(
            "funding_review", "经费主管单位负责人审核", "role-ldu-funding-manager"));
        changed = true;
      }
      return changed ? objectMapper.writeValueAsString(root) : null;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalStateException("无法升级鲁东 POC 审批流程", exception);
    }
  }

  private ObjectNode approvalStep(String id, String title, String roleId) {
    ObjectNode assignment = objectMapper.createObjectNode();
    assignment.put("type", "role");
    assignment.put("roleId", roleId);
    ObjectNode step = objectMapper.createObjectNode();
    step.put("id", id);
    step.put("type", "approver");
    step.put("title", title);
    step.set("assignment", assignment);
    return step;
  }

  private List<Map<String, Object>> prepareApplicationItems(List<Map<String, Object>> items) {
    return prepareApplicationItems(items, false);
  }

  private List<Map<String, Object>> prepareApplicationItems(List<Map<String, Object>> items, boolean draft) {
    List<String> materialIds = items.stream()
        .map(item -> item.get("materialId") == null ? "" : String.valueOf(item.get("materialId")).trim())
        .filter(id -> !id.isBlank())
        .distinct()
        .toList();
    long linkedCount = items.stream()
        .filter(item -> item.get("materialId") != null && !String.valueOf(item.get("materialId")).isBlank())
        .count();
    if (materialIds.size() != linkedCount) {
      throw new IllegalArgumentException("设备配置明细不能重复关联同一物料");
    }
    Map<String, Material> materials = new LinkedHashMap<>();
    materialApplicationService.findMaterialsByTenantAndIds(tenant(), materialIds)
        .forEach(material -> materials.put(material.id(), material));
    List<Map<String, Object>> normalizedItems = items.stream().map(item -> {
      String materialId = item.get("materialId") == null ? "" : String.valueOf(item.get("materialId")).trim();
      Material material = materialId.isBlank() ? null : materials.get(materialId);
      if (!materialId.isBlank() && material == null) {
        throw new IllegalArgumentException("关联的学校采购目录物料不存在或不属于当前租户: " + materialId);
      }
      BigDecimal quantity;
      try {
        String raw = String.valueOf(item.getOrDefault("quantity", ""));
        quantity = new BigDecimal(draft && raw.isBlank() ? "0" : raw);
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException("设备数量必须为有效数字: " + item.get("name"), exception);
      }
      if (quantity.signum() < 0 || (!draft && quantity.signum() == 0)) {
        throw new IllegalArgumentException("设备数量必须大于 0: " + item.get("name"));
      }
      BigDecimal researchedPrice;
      try {
        String raw = String.valueOf(item.getOrDefault("unitPrice", ""));
        researchedPrice = new BigDecimal(draft && raw.isBlank() ? "0" : raw);
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException("市场调研单价必须为有效数字: " + item.get("name"), exception);
      }
      Map<String, Object> normalized = new LinkedHashMap<>(item);
      if (researchedPrice.signum() < 0) throw new IllegalArgumentException("市场调研单价不能为负数");
      normalized.put("quantity", quantity.toPlainString());
      normalized.put("unitPrice", researchedPrice.toPlainString());
      normalized.entrySet().removeIf(entry -> entry.getValue() == null);
      if ("行政".equals(String.valueOf(normalized.get("usageDirection")))) {
        normalized.put("usageDirection", "行政办公");
      }
      if (material != null) {
        normalized.put("materialId", material.id());
        normalized.put("materialCode", material.code() == null ? "" : material.code());
        normalized.put("materialCategory", material.category() == null ? "" : material.category());
        normalized.put("catalogSource", "catalog");
      } else {
        normalized.put("materialId", "");
        normalized.put("materialCode", "");
        normalized.put("catalogSource", "custom");
      }
      String submittedMallValue = String.valueOf(normalized.getOrDefault("governmentMallCatalog", ""));
      boolean manualMallDecision = "manual".equals(normalized.get("governmentMallCatalogMode"))
          && List.of("是", "否").contains(submittedMallValue);
      MallCatalogDecision systemDecision = inferMallCatalog(normalized, material);
      normalized.put("governmentMallCatalogSystemValue", systemDecision.value());
      normalized.put("governmentMallCatalogSystemReason", systemDecision.reason());
      if (manualMallDecision) {
        normalized.put("governmentMallCatalog", submittedMallValue);
        normalized.put("governmentMallCatalogMode", "manual");
        normalized.put("governmentMallCatalogReason", "申报人根据实际目录范围人工确认");
      } else {
        normalized.put("governmentMallCatalog", systemDecision.value());
        normalized.put("governmentMallCatalogMode", "auto");
        normalized.put("governmentMallCatalogReason", systemDecision.reason());
      }
      normalized.put("totalPrice", researchedPrice.multiply(quantity).toPlainString());
      normalized.remove("configurationLimit");
      return Map.copyOf(normalized);
    }).toList();
    for (int index = 0; !draft && index < normalizedItems.size(); index++) {
      Map<String, Object> item = normalizedItems.get(index);
      if ("是".equals(String.valueOf(item.get("governmentMallCatalog")))) {
        requireItemText(item, index, "selectedBrand", "商城最终品牌");
        requireItemText(item, index, "selectedModel", "商城最终型号");
        requireItemText(item, index, "selectedSupplier", "商城供应商");
        requirePositiveItemNumber(item, index, "standardUnitPrice", "配置标准单价");
        requirePositiveItemNumber(item, index, "selectedUnitPrice", "商城确认单价");
        requireItemText(item, index, "selectionParticipants", "商城选型人员");
      }
    }
    return normalizedItems;
  }

  private Map<String, Object> prepareApplicationForm(
      Map<String, Object> formData, List<Map<String, Object>> items) {
    long mallItemCount = items.stream()
        .filter(item -> "是".equals(String.valueOf(item.get("governmentMallCatalog"))))
        .count();
    Map<String, Object> normalized = new LinkedHashMap<>(formData);
    LudongPocTaskFormCatalog.clearApprovalFields(normalized);
    normalized.entrySet().removeIf(entry -> entry.getValue() == null);
    normalized.remove("sameFundingUnit");
    normalized.remove("configurationStandard");
    if (!"是".equals(String.valueOf(normalized.get("siteVisitRequired")))) {
      List.of("siteVisitTime", "siteVisitLocation", "siteVisitContact", "siteVisitPhone")
          .forEach(key -> normalized.put(key, ""));
    }
    if (!"是".equals(String.valueOf(normalized.get("sampleRequired")))) {
      normalized.put("sampleRequirement", "");
    }
    if (!"是".equals(String.valueOf(normalized.get("demoRequired")))) {
      normalized.put("demoDuration", "");
      normalized.put("demoRequirement", "");
    }
    normalized.put("coreProduct", items.stream()
        .filter(item -> "是".equals(String.valueOf(item.get("coreProduct"))))
        .map(item -> String.valueOf(item.getOrDefault("name", "")))
        .findFirst()
        .orElse(""));
    normalized.put("mallSelectionApplicable", mallItemCount > 0 ? "是" : "否");
    normalized.put("mallSelectionReason", mallItemCount > 0
        ? "设备清单中有 " + mallItemCount + " 项属于山东省政府采购网上商城目录"
        : "设备清单中没有属于山东省政府采购网上商城目录的项目");
    return Map.copyOf(normalized);
  }

  private static BigDecimal calculateBudget(List<Map<String, Object>> items) {
    return calculateBudget(items, false);
  }

  private static BigDecimal calculateBudget(List<Map<String, Object>> items, boolean draft) {
    BigDecimal total = items.stream()
        .map(item -> new BigDecimal(String.valueOf(item.get("totalPrice"))))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    if (!draft && total.signum() <= 0) {
      throw new IllegalArgumentException("根据设备清单计算的预算金额必须大于 0");
    }
    return total;
  }

  private static MallCatalogDecision inferMallCatalog(Map<String, Object> item, Material material) {
    if (material != null && material.governmentMallCatalog()) {
      return new MallCatalogDecision("是", "学校采购目录已标记为山东省政府采购网上商城目录");
    }
    String source = String.join(" ",
        String.valueOf(item.getOrDefault("name", "")),
        String.valueOf(item.getOrDefault("materialCategory", "")));
    for (String keyword : List.of(
        "台式计算机", "台式机", "笔记本电脑", "便携式计算机", "打印机", "复印机",
        "投影仪", "投影设备", "多功能一体机", "空调机")) {
      if (source.contains(keyword)) {
        return new MallCatalogDecision("是", "设备名称或目录分类命中网上商城品目关键词“" + keyword + "”");
      }
    }
    return new MallCatalogDecision("否", "学校采购目录标识和设备名称均未命中网上商城品目，可人工调整");
  }

  private record MallCatalogDecision(String value, String reason) {}

  private LudongPocApplicationResponse toResponse(LudongPocApplication value) {
    Map<String, Object> accumulated = accumulatedData(value);
    return new LudongPocApplicationResponse(
        value.id(), value.applicationNo(), value.projectName(), value.applicantUnit(), value.departmentId(),
        value.budgetAmount(), value.status(), accumulated, accumulatedItems(value, accumulated),
        value.createdBy(), value.submittedAt(), value.approvedAt(), value.archivedAt(), value.createdAt(), value.updatedAt());
  }

  private Map<String, Object> accumulatedData(LudongPocApplication value) {
    Map<String, Object> result = new LinkedHashMap<>(readMap(value.formDataJson()));
    LudongPocTaskFormCatalog.clearApprovalFields(result);
    for (var review : reviewRecordMapper.listEffectiveByApplication(value.tenantId(), value.id())) {
      if ("approve".equals(review.decision())) {
        result.putAll(readMap(review.reviewDataJson()));
      }
    }
    result.put("requiresSchoolLeader", requiresSchoolLeader(value, result) ? "是" : "否");
    return result;
  }

  private List<Map<String, Object>> accumulatedItems(
      LudongPocApplication value, Map<String, Object> accumulated) {
    Object items = accumulated.get("items");
    return items == null ? readItems(value.itemsJson()) : objectMapper.convertValue(items, ITEMS_TYPE);
  }

  private static boolean requiresSchoolLeader(
      LudongPocApplication application, Map<String, Object> form) {
    BigDecimal threshold = "学院".equals(String.valueOf(form.get("applicantUnitType")))
        ? new BigDecimal("300000")
        : new BigDecimal("100000");
    return application.budgetAmount().compareTo(threshold) >= 0;
  }

  private Map<String, Object> readMap(String json) {
    try {
      return objectMapper.readValue(json, MAP_TYPE);
    } catch (Exception exception) {
      throw new IllegalStateException("申报表单数据损坏", exception);
    }
  }

  private List<Map<String, Object>> readItems(String json) {
    try {
      return objectMapper.readValue(json, ITEMS_TYPE);
    } catch (Exception exception) {
      throw new IllegalStateException("申报设备清单数据损坏", exception);
    }
  }

  private String write(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("无法序列化申报数据", exception);
    }
  }

  private static long count(List<LudongPocApplication> all, String status) {
    return all.stream().filter(item -> status.equals(item.status())).count();
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String tenant() {
    return TenantAccessGuard.requireTenantId("Ludong POC APIs");
  }

  private static String user() {
    return TenantAccessGuard.requireUserId("Ludong POC APIs");
  }
}
