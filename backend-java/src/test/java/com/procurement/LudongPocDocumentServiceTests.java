package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.application.AttachmentApplicationService.DownloadedObject;
import com.procurement.attachment.domain.Attachment;
import com.procurement.ludongpoc.application.LudongPocApplicationService;
import com.procurement.ludongpoc.application.LudongPocArchiveMaterialCatalog;
import com.procurement.ludongpoc.application.LudongPocDocumentService;
import com.procurement.ludongpoc.domain.LudongPocApplication;
import com.procurement.ludongpoc.domain.LudongPocReviewRecord;
import com.procurement.ludongpoc.infrastructure.LudongPocReviewRecordMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowApprovalSignature;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

class LudongPocDocumentServiceTests {
  private static final String APPLICATION_ID = "ldu-doc-test";
  private static final String TENANT_ID = "tenant-ldu-doc-test";
  private static final OffsetDateTime ACTED_AT = OffsetDateTime.parse("2026-08-28T10:00:00+08:00");

  @Test
  void approvedApplicationDataPopulatesBothOfficialTemplatesAndRejectedDataIsExcluded() throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    LudongPocApplicationService applicationService = mock(LudongPocApplicationService.class);
    UnifiedWorkflowApplicationService workflowService = mock(UnifiedWorkflowApplicationService.class);
    LudongPocReviewRecordMapper reviewMapper = mock(LudongPocReviewRecordMapper.class);
    LudongPocApplication application = application(objectMapper);
    when(applicationService.requireForExport(APPLICATION_ID)).thenReturn(application);
    when(reviewMapper.listByApplication(TENANT_ID, APPLICATION_ID)).thenReturn(reviews(objectMapper));
    when(workflowService.listApprovalSignatures("ludong_project_application", APPLICATION_ID))
        .thenReturn(signatures());
    LudongPocDocumentService service = new LudongPocDocumentService(
        applicationService, workflowService, objectMapper, reviewMapper,
        mock(AttachmentApplicationService.class));

    byte[] demandDocument = service.generate(APPLICATION_ID, LudongPocDocumentService.DocumentType.DEMAND);
    byte[] applicationDocument = service.generate(APPLICATION_ID, LudongPocDocumentService.DocumentType.APPLICATION);
    String demandText = text(demandDocument);
    String applicationText = text(applicationDocument);
    String mallConfirmationText = tableText(applicationDocument, 2);
    Path qaDirectory = Path.of("target", "docx-qa");
    Files.createDirectories(qaDirectory);
    Files.write(qaDirectory.resolve("ludong-purchase-demand.docx"), demandDocument);
    Files.write(qaDirectory.resolve("ludong-project-application.docx"), applicationDocument);

    assertThat(demandText).contains(
        "智慧教室设备更新项目", "预算金额：320000 元", "项目负责人签字：王老师",
        "参与编制人员：王老师、赵老师", "专门面向中小企业采购：☑ 是    ☐ 否",
        "远程教学和课堂互动", "提升教学质量", "GB 4943.1", "学校设备技术规范",
        "南校区教学楼", "合同签订后 30 日内", "智慧教学终端", "3 年",
        "安装调试完成后验收", "技术负责人", "参与编制确认人",
        "单位负责人（签字）：申报单位负责人");
    assertThat(applicationText).contains(
        "智慧教室设备更新项目", "32", "年度教学经费", "教学条件改善专项",
        "王老师", "赵老师", "购置必要性充分", "☑ 同意", "☐ 不同意",
        "教育信息技术部意见", "申报单位意见", "经费主管单位意见",
        "是否超价格上限：☐ 是    ☑ 否", "配置审核意见",
        "大型仪器设备共享审核", "分管校领导意见",
        "☑ 本项目已列入本年度学校预算",
        "☐ 本项目年初无预算，现已办理预算追加手续",
        "☑ 本项目年初无预算，现已办理预算追加手续",
        "☐ 本项目本年度无预算，已列入下一年度预算",
        "材料完整，确认提交", "材料齐全，确认受理",
        "☑ 公开招标", "☐ 邀请招标", "☐ 单一来源采购",
        "负责人终审意见", "技术负责人确认", "参与编制人员确认", "网上商城选型确认",
        "高性能教学终端", "目录外专用实验装置", "国产处理器，32GB内存", "商城选型确认人", "申报单位负责人");
    assertThat(mallConfirmationText).contains("高性能教学终端").doesNotContain("目录外专用实验装置");
    assertThat(demandText).doesNotContain("驳回时的错误覆盖值");
    assertThat(applicationText).doesNotContain("驳回时的错误覆盖值");
  }

  @Test
  void applicationTemplateKeepsEveryChoiceVisibleWhenReviewFieldsAreStillBlank() throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    LudongPocApplicationService applicationService = mock(LudongPocApplicationService.class);
    UnifiedWorkflowApplicationService workflowService = mock(UnifiedWorkflowApplicationService.class);
    LudongPocReviewRecordMapper reviewMapper = mock(LudongPocReviewRecordMapper.class);
    when(applicationService.requireForExport(APPLICATION_ID)).thenReturn(application(objectMapper));
    when(reviewMapper.listByApplication(TENANT_ID, APPLICATION_ID)).thenReturn(List.of());
    when(workflowService.listApprovalSignatures("ludong_project_application", APPLICATION_ID))
        .thenReturn(List.of());
    LudongPocDocumentService service = new LudongPocDocumentService(
        applicationService, workflowService, objectMapper, reviewMapper,
        mock(AttachmentApplicationService.class));

    String applicationText = text(service.generate(
        APPLICATION_ID, LudongPocDocumentService.DocumentType.APPLICATION));

    assertThat(applicationText).contains(
        "预算审查情况", "☐ 本项目已列入本年度学校预算",
        "☐ 本项目年初无预算，现已办理预算追加手续",
        "☐ 本项目本年度无预算，已列入下一年度预算",
        "采购方式", "☐ 公开招标", "☐ 邀请招标", "☐ 竞争性谈判",
        "☐ 竞争性磋商", "☐ 单一来源采购", "☐ 询价",
        "是否超价格上限：☐ 是    ☐ 否", "论证结论：☐ 同意    ☐ 不同意");
  }

  @Test
  void archiveContainsGeneratedDocumentsMaterialLedgerAndEveryUploadedMaterialCategory()
      throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    LudongPocApplicationService applicationService = mock(LudongPocApplicationService.class);
    UnifiedWorkflowApplicationService workflowService = mock(UnifiedWorkflowApplicationService.class);
    LudongPocReviewRecordMapper reviewMapper = mock(LudongPocReviewRecordMapper.class);
    AttachmentApplicationService attachmentService = mock(AttachmentApplicationService.class);
    LudongPocApplication application = application(objectMapper);
    when(applicationService.requireForExport(APPLICATION_ID)).thenReturn(application);
    when(reviewMapper.listByApplication(TENANT_ID, APPLICATION_ID)).thenReturn(reviews(objectMapper));
    when(workflowService.listApprovalSignatures("ludong_project_application", APPLICATION_ID))
        .thenReturn(signatures());

    int index = 0;
    for (LudongPocArchiveMaterialCatalog.Category category
        : LudongPocArchiveMaterialCatalog.CATEGORIES) {
      index++;
      String storageKey = "archive/material-" + index;
      Attachment attachment = new Attachment(
          "attachment-" + index, TENANT_ID, category.ownerType(), APPLICATION_ID,
          category.label() + ".pdf", storageKey, "LDU100001", "buyer_internal",
          "active", ACTED_AT);
      when(attachmentService.listCurrentTenantAttachmentEntities(category.ownerType(), APPLICATION_ID))
          .thenReturn(List.of(attachment));
      when(attachmentService.loadCurrentTenantObject(attachment.id())).thenReturn(
          new DownloadedObject(
              attachment.fileName(),
              (category.label() + "-content").getBytes(java.nio.charset.StandardCharsets.UTF_8),
              "application/pdf"));
    }
    LudongPocDocumentService service = new LudongPocDocumentService(
        applicationService, workflowService, objectMapper, reviewMapper,
        attachmentService);

    Map<String, byte[]> entries = zipEntries(service.archive(APPLICATION_ID));

    assertThat(entries).containsKeys(
        "00-归档材料清单.txt",
        "01-生成表格/01-采购需求表（货物类）.docx",
        "01-生成表格/02-货物类项目采购及招标申请单、受理单.docx",
        "02-项目附件/01-项目附件.pdf",
        "03-商城确认材料/01-商城确认材料.pdf",
        "04-补充证明/01-补充证明.pdf");
    String manifest = new String(
        entries.get("00-归档材料清单.txt"), java.nio.charset.StandardCharsets.UTF_8);
    assertThat(manifest).contains(
        "鲁东大学货物类采购申报归档材料清单",
        "项目附件：1 份（应归档）",
        "商城确认材料：1 份（应归档）",
        "补充证明：1 份（按需归档）",
        "SHA-256:");
    verify(applicationService).markArchived(APPLICATION_ID);
  }

  private static LudongPocApplication application(ObjectMapper objectMapper) throws Exception {
    Map<String, Object> form = new LinkedHashMap<>();
    form.put("projectLeaderName", "王老师");
    form.put("projectLeaderPhone", "13800000001");
    form.put("technicalLeaderName", "赵老师");
    form.put("technicalLeaderPhone", "13800000002");
    form.put("participants", "王老师、赵老师");
    form.put("fundingSource", "年度教学经费");
    form.put("fundingProjectName", "教学条件改善专项");
    form.put("fundingProjectNo", "JX-2026-01");
    form.put("smeSuitable", "是");
    form.put("microSuitable", "否");
    form.put("procurementFunction", "远程教学和课堂互动");
    form.put("procurementGoal", "提升教学质量");
    form.put("purchaseReason", "购置必要性充分");
    form.put("mandatoryStandards", "GB 4943.1");
    form.put("otherStandards", "学校设备技术规范");
    form.put("supplierQualifications", "依法登记并具备履约能力");
    form.put("implementationLocation", "南校区教学楼");
    form.put("installationReady", "是");
    form.put("utilitiesReady", "是");
    form.put("assetDisposalPlan", "旧设备统一调拨");
    form.put("deliveryDays", "30");
    form.put("coreProduct", "智慧教学终端");
    form.put("packingRequirement", "防潮防震包装");
    form.put("warrantyYears", "3");
    form.put("domesticPaymentTerms", "验收后付款");
    form.put("importPaymentTerms", "不涉及进口设备");
    form.put("afterSalesRequirement", "两小时响应");
    form.put("acceptanceStandard", "安装调试完成后验收");
    form.put("otherTechnicalRequirements", "符合节能要求");
    form.put("siteVisitRequired", "否");
    form.put("sampleRequired", "否");
    form.put("sampleRequirement", "不要求样品");
    form.put("demoRequired", "是");
    form.put("demoDuration", "20分钟");
    form.put("demoRequirement", "演示课堂互动");
    form.put("otherNotes", "无其他事项");
    List<Map<String, Object>> items = List.of(Map.ofEntries(
        Map.entry("name", "高性能教学终端"), Map.entry("quantity", "10"),
        Map.entry("governmentMallCatalog", "是"),
        Map.entry("unitPrice", "32000"), Map.entry("totalPrice", "320000"),
        Map.entry("technicalParameters", "国产处理器，32GB内存"),
        Map.entry("referenceBrands", "品牌甲、品牌乙、品牌丙"), Map.entry("imported", "否"),
        Map.entry("importLeadTime", ""), Map.entry("purpose", "智慧教学"),
        Map.entry("usageDirection", "教学"), Map.entry("userName", "王老师"),
        Map.entry("installationLocation", "南校区教学楼"), Map.entry("standardUnitPrice", "32000"),
        Map.entry("selectedBrand", "品牌甲"), Map.entry("selectedModel", "A1"),
        Map.entry("selectedSupplier", "测试供应商"), Map.entry("supplierContact", "李经理"),
        Map.entry("supplierPhone", "13900000001"), Map.entry("productLink", "https://example.test/a1"),
        Map.entry("selectedParameters", "国产处理器，32GB内存"),
        Map.entry("selectedUnitPrice", "31800"), Map.entry("selectionParticipants", "王老师、赵老师、李老师")),
        Map.ofEntries(
            Map.entry("name", "目录外专用实验装置"), Map.entry("quantity", "1"),
            Map.entry("governmentMallCatalog", "否"), Map.entry("unitPrice", "0"),
            Map.entry("totalPrice", "0"), Map.entry("technicalParameters", "定制实验参数"),
            Map.entry("referenceBrands", "无"), Map.entry("imported", "否"),
            Map.entry("importLeadTime", ""), Map.entry("purpose", "实验教学"),
            Map.entry("usageDirection", "教学"), Map.entry("userName", "王老师"),
            Map.entry("installationLocation", "实验楼")));
    return new LudongPocApplication(
        APPLICATION_ID, TENANT_ID, "LDU-2026-001", "智慧教室设备更新项目", "教务处", "dept-jwc",
        new BigDecimal("320000"), "approved", objectMapper.writeValueAsString(form),
        objectMapper.writeValueAsString(items), "applicant", "applicant", ACTED_AT, ACTED_AT,
        null, ACTED_AT, ACTED_AT);
  }

  private static List<LudongPocReviewRecord> reviews(ObjectMapper objectMapper) throws Exception {
    List<LudongPocReviewRecord> result = new ArrayList<>();
    result.add(review(objectMapper, "argumentation_review", "approve", Map.of(
        "argumentationOpinion", "同意", "argumentationComment", "论证材料完整")));
    result.add(review(objectMapper, "technical_leader_review", "approve", Map.of(
        "technicalLeaderOpinion", "同意")));
    result.add(review(objectMapper, "compilation_participant_review", "approve", Map.of(
        "compilationParticipantOpinion", "同意")));
    result.add(review(objectMapper, "mall_selection_participant_review", "approve", Map.of(
        "mallSelectionParticipantOpinion", "同意")));
    result.add(review(objectMapper, "it_review", "approve", Map.of(
        "itReviewOpinion", "同意", "itReviewComment", "符合校内信息化标准")));
    result.add(review(objectMapper, "unit_review", "approve", Map.of("applicantUnitOpinion", "同意")));
    result.add(review(objectMapper, "funding_review", "approve", Map.of("fundingUnitOpinion", "同意")));
    result.add(review(objectMapper, "asset_configuration_review", "approve", Map.of(
        "exceedsPriceLimit", "否", "exceedsQuantityLimit", "否",
        "assetConfigurationOpinion", "同意", "assetConfigurationComment", "配置合理")));
    result.add(review(objectMapper, "asset_division_leader_review", "approve", Map.of(
        "assetDivisionLeaderOpinion", "同意", "assetDivisionLeaderComment", "按标准配置")));
    result.add(review(objectMapper, "asset_unit_leader_review", "approve", Map.of(
        "assetUnitLeaderOpinion", "同意", "assetUnitLeaderComment", "同意办理")));
    result.add(review(objectMapper, "lab_equipment_review", "approve", Map.of(
        "largeEquipmentSharing", "同意共享", "labReviewOpinion", "同意",
        "labReviewComment", "共享方案可行")));
    result.add(review(objectMapper, "lab_division_leader_review", "approve", Map.of(
        "labDivisionLeaderOpinion", "同意", "labDivisionLeaderComment", "论证充分")));
    result.add(review(objectMapper, "lab_unit_leader_review", "approve", Map.of(
        "labUnitLeaderOpinion", "同意", "labUnitLeaderComment", "同意实施")));
    result.add(review(objectMapper, "school_leader_review", "approve", Map.of("schoolLeaderOpinion", "同意")));
    result.add(review(objectMapper, "finance_budget_review", "approve", Map.of(
        "financeBudgetStatus", "本项目已列入本年度学校预算")));
    result.add(review(objectMapper, "procurement_budget_review", "approve", Map.of(
        "procurementBudgetStatus", "本项目年初无预算，现已办理预算追加手续")));
    result.add(review(objectMapper, "handover_submit", "approve", Map.of(
        "handoverSubmitConfirmation", "材料完整，确认提交", "handoverSubmitComment", "已核对原件")));
    result.add(review(objectMapper, "handover_accept", "approve", Map.of(
        "handoverAcceptance", "材料齐全，确认受理", "handoverAcceptComment", "受理材料无缺项")));
    result.add(review(objectMapper, "procurement_method_review", "approve", Map.of(
        "procurementMethod", "公开招标", "procurementMethodComment", "达到公开招标条件")));
    result.add(review(objectMapper, "finance_responsible_review", "approve", Map.of(
        "financeResponsibleOpinion", "同意", "financeResponsibleComment", "同意按批准方式采购")));
    result.add(review(objectMapper, "unit_review", "reject", Map.of("applicantUnitOpinion", "驳回时的错误覆盖值")));
    return result;
  }

  private static LudongPocReviewRecord review(
      ObjectMapper objectMapper, String nodeId, String decision, Map<String, Object> data) throws Exception {
    return new LudongPocReviewRecord(
        "review-" + nodeId + "-" + decision, TENANT_ID, APPLICATION_ID, "task-" + nodeId,
        nodeId, "reviewer-" + nodeId, decision, objectMapper.writeValueAsString(data), "同意", ACTED_AT);
  }

  private static List<WorkflowApprovalSignature> signatures() {
    return List.of(
        new WorkflowApprovalSignature("task_argumentation_review", "论证人", ACTED_AT),
        new WorkflowApprovalSignature("task_technical_leader_review", "技术负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_compilation_participant_review", "参与编制确认人", ACTED_AT),
        new WorkflowApprovalSignature("task_mall_selection_participant_review", "商城选型确认人", ACTED_AT),
        new WorkflowApprovalSignature("task_it_review", "信息技术部负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_unit_review", "申报单位负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_funding_review", "经费主管单位负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_asset_configuration_review", "资产配置审核人", ACTED_AT),
        new WorkflowApprovalSignature("task_asset_division_leader_review", "资产处分管领导", ACTED_AT),
        new WorkflowApprovalSignature("task_asset_unit_leader_review", "资产处负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_lab_equipment_review", "实验室审核人", ACTED_AT),
        new WorkflowApprovalSignature("task_lab_division_leader_review", "实验室分管领导", ACTED_AT),
        new WorkflowApprovalSignature("task_lab_unit_leader_review", "实验室负责人", ACTED_AT),
        new WorkflowApprovalSignature("task_school_leader_review", "分管校领导", ACTED_AT),
        new WorkflowApprovalSignature("task_finance_budget_review", "财务预算审核人", ACTED_AT),
        new WorkflowApprovalSignature("task_procurement_budget_review", "采购预算审核人", ACTED_AT),
        new WorkflowApprovalSignature("task_handover_submit", "材料提交人", ACTED_AT),
        new WorkflowApprovalSignature("task_handover_accept", "材料受理人", ACTED_AT),
        new WorkflowApprovalSignature("task_procurement_method_review", "采购方式经办人", ACTED_AT),
        new WorkflowApprovalSignature("task_finance_responsible_review", "财经处负责人", ACTED_AT));
  }

  private static String text(byte[] documentBytes) throws Exception {
    try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(documentBytes))) {
      StringBuilder result = new StringBuilder();
      document.getParagraphs().forEach(paragraph -> result.append(paragraph.getText()).append('\n'));
      for (XWPFTable table : document.getTables()) {
        table.getRows().forEach(row -> row.getTableCells().forEach(cell -> result.append(cell.getText()).append('\n')));
      }
      return result.toString();
    }
  }

  private static String tableText(byte[] documentBytes, int tableIndex) throws Exception {
    try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(documentBytes))) {
      StringBuilder result = new StringBuilder();
      document.getTables().get(tableIndex).getRows()
          .forEach(row -> row.getTableCells().forEach(cell -> result.append(cell.getText()).append('\n')));
      return result.toString();
    }
  }

  private static Map<String, byte[]> zipEntries(byte[] bytes) throws Exception {
    Map<String, byte[]> result = new HashMap<>();
    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        result.put(entry.getName(), zip.readAllBytes());
      }
    }
    return result;
  }
}
