package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.application.AttachmentApplicationService.DownloadedObject;
import com.procurement.attachment.domain.Attachment;
import com.procurement.ludongpoc.domain.LudongPocApplication;
import com.procurement.ludongpoc.domain.LudongPocReviewRecord;
import com.procurement.ludongpoc.infrastructure.LudongPocReviewRecordMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowApprovalSignature;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.TableRowHeightRule;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class LudongPocDocumentService {
  public enum DocumentType { DEMAND, APPLICATION }

  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final TypeReference<List<Map<String, Object>>> ITEMS_TYPE = new TypeReference<>() {};
  private static final List<String> YES_NO_OPTIONS = List.of("是", "否");
  private static final List<String> APPROVAL_OPTIONS = List.of("同意", "不同意");
  private static final List<String> FINANCE_BUDGET_STATUS_OPTIONS = List.of(
      "本项目已列入本年度学校预算",
      "本项目年初无预算，现已办理预算追加手续",
      "本项目本年度无预算，已列入下一年度预算");
  private static final List<String> PROCUREMENT_BUDGET_STATUS_OPTIONS = List.of(
      "本项目已列入本年度采购预算",
      "本项目年初无采购预算，现已办理采购预算追加手续",
      "本项目本年度无采购预算，已列入下一年度采购预算");
  private static final List<String> SHARING_OPTIONS = List.of("同意共享", "不同意共享", "不涉及");
  private static final List<String> HANDOVER_ACCEPTANCE_OPTIONS = List.of(
      "材料齐全，确认受理", "材料不齐，退回补充");
  private static final List<String> PROCUREMENT_METHOD_OPTIONS = List.of(
      "公开招标", "邀请招标", "竞争性谈判", "竞争性磋商", "单一来源采购", "询价");

  private final LudongPocApplicationService applicationService;
  private final UnifiedWorkflowApplicationService workflowService;
  private final ObjectMapper objectMapper;
  private final LudongPocReviewRecordMapper reviewRecordMapper;
  private final AttachmentApplicationService attachmentService;

  public LudongPocDocumentService(
      LudongPocApplicationService applicationService,
      UnifiedWorkflowApplicationService workflowService,
      ObjectMapper objectMapper,
      LudongPocReviewRecordMapper reviewRecordMapper,
      AttachmentApplicationService attachmentService) {
    this.applicationService = applicationService;
    this.workflowService = workflowService;
    this.objectMapper = objectMapper;
    this.reviewRecordMapper = reviewRecordMapper;
    this.attachmentService = attachmentService;
  }

  public byte[] generate(String id, DocumentType type) {
    LudongPocApplication application = applicationService.requireForExport(id);
    return type == DocumentType.DEMAND
        ? generateDemand(application)
        : generateApplication(application);
  }

  public byte[] archive(String id) {
    LudongPocApplication application = applicationService.requireForExport(id);
    byte[] demand = generateDemand(application);
    byte[] applicationForm = generateApplication(application);
    List<ArchiveMaterial> materials = loadArchiveMaterials(application);
    try (ByteArrayOutputStream output = new ByteArrayOutputStream();
         ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
      add(zip, "00-归档材料清单.txt", archiveManifest(application, demand, applicationForm, materials));
      add(zip, "01-生成表格/01-采购需求表（货物类）.docx", demand);
      add(zip, "01-生成表格/02-货物类项目采购及招标申请单、受理单.docx", applicationForm);
      for (LudongPocArchiveMaterialCatalog.Category category
          : LudongPocArchiveMaterialCatalog.CATEGORIES) {
        List<ArchiveMaterial> categoryMaterials = materials.stream()
            .filter(material -> material.category().ownerType().equals(category.ownerType()))
            .toList();
        if (categoryMaterials.isEmpty()) {
          add(zip, category.archiveDirectory() + "/未上传材料.txt",
              ("本项目暂未上传" + category.label() + "。\n").getBytes(StandardCharsets.UTF_8));
          continue;
        }
        for (int index = 0; index < categoryMaterials.size(); index++) {
          ArchiveMaterial material = categoryMaterials.get(index);
          add(zip, category.archiveDirectory() + "/"
              + String.format("%02d-", index + 1) + safeFileName(material.attachment().fileName()),
              material.bytes());
        }
      }
      zip.finish();
      applicationService.markArchived(id);
      return output.toByteArray();
    } catch (Exception exception) {
      throw new IllegalStateException("无法生成申报归档压缩包", exception);
    }
  }

  private List<ArchiveMaterial> loadArchiveMaterials(LudongPocApplication application) {
    List<ArchiveMaterial> result = new ArrayList<>();
    for (LudongPocArchiveMaterialCatalog.Category category
        : LudongPocArchiveMaterialCatalog.CATEGORIES) {
      for (Attachment attachment : attachmentService.listCurrentTenantAttachmentEntities(
          category.ownerType(), application.id())) {
        try {
          DownloadedObject object = attachmentService.loadCurrentTenantObject(attachment.id());
          result.add(new ArchiveMaterial(category, attachment, object.data(), object.contentType()));
        } catch (RuntimeException exception) {
          throw new IllegalStateException(
              "归档材料对象缺失，无法生成完整归档包：" + attachment.fileName(), exception);
        }
      }
    }
    return result;
  }

  private byte[] archiveManifest(
      LudongPocApplication application,
      byte[] demand,
      byte[] applicationForm,
      List<ArchiveMaterial> materials) {
    StringBuilder manifest = new StringBuilder();
    manifest.append("鲁东大学货物类采购申报归档材料清单\n")
        .append("项目编号：").append(application.applicationNo()).append('\n')
        .append("项目名称：").append(application.projectName()).append('\n')
        .append("申报单位：").append(application.applicantUnit()).append('\n')
        .append("归档生成日期：").append(LocalDate.now()).append("\n\n")
        .append("一、系统生成表格\n")
        .append("1. 采购需求表（货物类）.docx | SHA-256: ").append(sha256(demand)).append('\n')
        .append("2. 货物类项目采购及招标申请单、受理单.docx | SHA-256: ")
        .append(sha256(applicationForm)).append("\n\n")
        .append("二、原始材料台账\n");
    int sequence = 1;
    for (LudongPocArchiveMaterialCatalog.Category category
        : LudongPocArchiveMaterialCatalog.CATEGORIES) {
      List<ArchiveMaterial> categoryMaterials = materials.stream()
          .filter(material -> material.category().ownerType().equals(category.ownerType()))
          .toList();
      manifest.append(category.label()).append("：")
          .append(categoryMaterials.isEmpty() ? "未上传" : categoryMaterials.size() + " 份")
          .append(category.required() ? "（应归档）" : "（按需归档）").append('\n');
      for (ArchiveMaterial material : categoryMaterials) {
        Attachment attachment = material.attachment();
        manifest.append(sequence++).append(". ").append(attachment.fileName())
            .append(" | 上传人：").append(attachment.uploadedBy())
            .append(" | 上传时间：")
            .append(attachment.createdAt() == null ? "未知"
                : attachment.createdAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
            .append(" | SHA-256: ").append(sha256(material.bytes())).append('\n');
      }
    }
    manifest.append("\n说明：系统生成表格与上传原始材料共同构成项目归档包；")
        .append("校验值用于检查文件归档后是否被修改。\n");
    return manifest.toString().getBytes(StandardCharsets.UTF_8);
  }

  private static String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception exception) {
      throw new IllegalStateException("无法计算归档材料校验值", exception);
    }
  }

  private static String safeFileName(String value) {
    String normalized = value == null ? "未命名附件" : value.trim();
    normalized = normalized.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_");
    return normalized.isBlank() ? "未命名附件" : normalized;
  }

  private record ArchiveMaterial(
      LudongPocArchiveMaterialCatalog.Category category,
      Attachment attachment,
      byte[] bytes,
      String contentType) {
  }

  private byte[] generateDemand(LudongPocApplication application) {
    Map<String, Object> data = data(application);
    Map<String, String> signatures = signatures(application);
    try (XWPFDocument document = openTemplate("purchase-demand-goods.docx")) {
      replace(document, "项目负责人签字：", "项目负责人签字：" + value(data, "projectLeaderName")
          + "    负责人联系电话：" + value(data, "projectLeaderPhone")
          + "    日期：" + LocalDate.now()
          + "\n技术负责人：" + signatureOrValue(
              signatures, "technical_leader_review", data, "technicalLeaderName"));
      replace(document, "参与编制人员：", "参与编制人员：" + signatureOrValue(
          signatures, "compilation_participant_review", data, "participants"));
      replace(document, "1.项目名称", "1.项目名称  " + application.projectName()
          + "    预算金额：" + application.budgetAmount().stripTrailingZeros().toPlainString() + " 元");
      replace(document, "2.是否适宜由中小企业", choice(
          "2.是否适宜由中小企业提供，并专门面向中小企业采购",
          value(data, "smeSuitable"), YES_NO_OPTIONS, 0));
      replace(document, "是否适宜由小微", choice(
          "是否适宜由小微企业提供，并专门面向小微企业采购",
          value(data, "microSuitable"), YES_NO_OPTIONS, 0));
      replace(document, "1.采购标的需实现的功能", "1.采购标的需实现的功能  " + value(data, "procurementFunction"));
      replace(document, "2.采购标的需实现的目标", "2.采购标的需实现的目标  " + value(data, "procurementGoal"));
      replace(document, "1.国家强制标准要求", "1.国家强制标准要求  " + value(data, "mandatoryStandards"));
      replace(document, "2.其它标准", "2.其它标准  " + value(data, "otherStandards"));
      replace(document, "3.对供应商的特殊资质要求", "3.对供应商的特殊资质要求  " + value(data, "supplierQualifications"));
      replace(document, "1.项目实施地点", "1.项目实施地点：" + value(data, "implementationLocation")
          + "；" + choice("是否具备安装条件", value(data, "installationReady"), YES_NO_OPTIONS, 0)
          + "。" + choice("场所、水、电、暖、气等需求是否满足", value(data, "utilitiesReady"), YES_NO_OPTIONS, 0)
          + "；项目涉及现有资产的处置使用方案：" + value(data, "assetDisposalPlan") + "。");
      replace(document, "项目交付时间：", "项目交付时间：合同签订后 " + value(data, "deliveryDays")
          + " 日内。供应商应按采购文件完成供货、安装、调试和培训工作。");
      replace(document, "3.核心产品", "3.核心产品。本项目核心产品为 " + value(data, "coreProduct") + "。");
      replace(document, "5.包装和运输要求", "5.包装和运输要求：" + value(data, "packingRequirement"));
      replace(document, "1.本项目免费质量保证期", "1.本项目免费质量保证期要求不低于 "
          + value(data, "warrantyYears") + " 年。");
      replace(document, "国产设备及服务：", "国产设备及服务：" + value(data, "domesticPaymentTerms"));
      replace(document, "进口设备：", "进口设备：" + value(data, "importPaymentTerms"));
      replace(document, "需要有明确的售后服务方案", value(data, "afterSalesRequirement"));
      replace(document, "货物安装完成正常运行后", value(data, "acceptanceStandard"));
      replace(document, "符合国家关于国产设备", value(data, "otherTechnicalRequirements"));
      replace(document, "1.是否需要进行现场勘查", choice(
          "1.是否需要进行现场勘查", value(data, "siteVisitRequired"), YES_NO_OPTIONS, 0)
          + "    勘查时间：" + value(data, "siteVisitTime"));
      replace(document, "勘查地点：", "勘查地点：" + value(data, "siteVisitLocation")
          + "    联系人：" + value(data, "siteVisitContact") + "    联系电话：" + value(data, "siteVisitPhone"));
      replace(document, "2.是否需要提供样品供评审", choice(
          "2.是否需要提供样品供评审", value(data, "sampleRequired"), YES_NO_OPTIONS, 0));
      replace(document, "要求投标人提供样品的", value(data, "sampleRequirement"));
      replace(document, "3.评审现场是否需要进行产品演示", choice(
          "3.评审现场是否需要进行产品演示", value(data, "demoRequired"), YES_NO_OPTIONS, 0)
          + "    演示时长：" + value(data, "demoDuration"));
      replace(document, "演示要求：", "演示要求：" + value(data, "demoRequirement"));
      replace(document, "4.其他补充事宜", "4.其他补充事宜：" + value(data, "otherNotes"));
      replace(document, "单位负责人（签字）：", "单位负责人（签字）：" + signatures.getOrDefault("unit_review", "")
          + "    申报单位（盖章）：" + application.applicantUnit());
      optimizeDocumentLayout(document);
      return write(document);
    } catch (Exception exception) {
      throw new IllegalStateException("无法生成采购需求表", exception);
    }
  }

  private byte[] generateApplication(LudongPocApplication application) {
    Map<String, Object> data = data(application);
    List<Map<String, Object>> items = items(application);
    Map<String, String> signatures = signatures(application);
    try (XWPFDocument document = openTemplate("project-application-goods.docx")) {
      replace(document, "申报单位（公章）：", "申报单位（公章）：" + application.applicantUnit()
          + "    申请单编号：" + application.applicationNo());
      replace(document, "A包预算金额", "A包预算金额  "
          + application.budgetAmount().divide(BigDecimal.valueOf(10_000)).stripTrailingZeros().toPlainString()
          + " 万元");
      replace(document, "申报单位：（盖章）", "申报单位（盖章）：" + application.applicantUnit()
          + "    日期：" + LocalDate.now());
      XWPFTable main = document.getTables().get(0);
      // XWPF 使用物理单元格索引；学校模板包含大量横向合并，索引不同于页面网格列号。
      set(main, 0, 1, application.projectName());
      set(main, 1, 1, application.budgetAmount().divide(BigDecimal.valueOf(10_000)).stripTrailingZeros().toPlainString());
      set(main, 1, 4, value(data, "fundingProjectName") + "\n经费来源：" + value(data, "fundingSource"));
      set(main, 2, 4, value(data, "fundingProjectNo"));
      set(main, 3, 2, value(data, "projectLeaderName"));
      set(main, 3, 5, signatureOrValue(
          signatures, "technical_leader_review", data, "technicalLeaderName"));
      set(main, 4, 2, value(data, "projectLeaderPhone"));
      set(main, 4, 5, value(data, "technicalLeaderPhone"));
      set(main, 5, 1, "申报人购置理由及必要性：" + value(data, "purchaseReason")
          + "\n论证人审核：" + choice("论证结论", value(data, "argumentationOpinion"), APPROVAL_OPTIONS, 0)
          + "\n论证意见：" + value(data, "argumentationComment")
          + "\n论证人（签字）：" + signatures.getOrDefault("argumentation_review", ""));
      set(main, 6, 1, choice("教育信息技术部意见", value(data, "itReviewOpinion"), APPROVAL_OPTIONS, 0)
          + "\n补充意见：" + value(data, "itReviewComment")
          + "\n单位负责人（签字）：" + signatures.getOrDefault("it_review", ""));
      set(main, 7, 1, choice("申报单位意见", value(data, "applicantUnitOpinion"), APPROVAL_OPTIONS, 0)
          + "\n" + value(data, "applicantUnitComment") + "\n单位负责人（签字）："
          + signatures.getOrDefault("unit_review", ""));
      set(main, 8, 1, choice("经费主管单位意见", value(data, "fundingUnitOpinion"), APPROVAL_OPTIONS, 0)
          + "\n" + value(data, "fundingUnitComment") + "\n单位负责人（签字）："
          + signatures.getOrDefault("funding_review", ""));
      set(main, 9, 1, choice("是否超价格上限", value(data, "exceedsPriceLimit"), YES_NO_OPTIONS, 0)
          + "    " + choice("是否超数量上限", value(data, "exceedsQuantityLimit"), YES_NO_OPTIONS, 0)
          + "\n" + choice("配置审核意见", value(data, "assetConfigurationOpinion"), APPROVAL_OPTIONS, 0)
          + "\n配置审核说明：" + value(data, "assetConfigurationComment")
          + "\n审核人（签字）：" + signatures.getOrDefault("asset_configuration_review", "")
          + "\n" + choice("分管领导意见", value(data, "assetDivisionLeaderOpinion"), APPROVAL_OPTIONS, 0)
          + "\n分管领导说明：" + value(data, "assetDivisionLeaderComment")
          + "\n分管领导（签字）：" + signatures.getOrDefault("asset_division_leader_review", "")
          + "\n" + choice("单位负责人意见", value(data, "assetUnitLeaderOpinion"), APPROVAL_OPTIONS, 0)
          + "\n单位负责人说明：" + value(data, "assetUnitLeaderComment")
          + "\n单位负责人（签字）：" + signatures.getOrDefault("asset_unit_leader_review", ""));
      set(main, 10, 1, choice("大型仪器设备共享审核", value(data, "largeEquipmentSharing"), SHARING_OPTIONS, 0)
          + "\n" + choice("论证审核意见", value(data, "labReviewOpinion"), APPROVAL_OPTIONS, 0)
          + "\n论证审核说明：" + value(data, "labReviewComment")
          + "\n审核人（签字）：" + signatures.getOrDefault("lab_equipment_review", "")
          + "\n" + choice("分管领导意见", value(data, "labDivisionLeaderOpinion"), APPROVAL_OPTIONS, 0)
          + "\n分管领导说明：" + value(data, "labDivisionLeaderComment")
          + "\n分管领导（签字）：" + signatures.getOrDefault("lab_division_leader_review", "")
          + "\n" + choice("单位负责人意见", value(data, "labUnitLeaderOpinion"), APPROVAL_OPTIONS, 0)
          + "\n单位负责人说明：" + value(data, "labUnitLeaderComment")
          + "\n单位负责人（签字）：" + signatures.getOrDefault("lab_unit_leader_review", ""));
      set(main, 11, 1, choice("分管校领导意见", value(data, "schoolLeaderOpinion"), APPROVAL_OPTIONS, 0)
          + "\n补充意见：" + value(data, "schoolLeaderComment")
          + "\n负责人（签字）："
          + signatures.getOrDefault("school_leader_review", ""));
      set(main, 12, 1, choice("预算审查情况", value(data, "financeBudgetStatus"), FINANCE_BUDGET_STATUS_OPTIONS, 1)
          + "\n补充意见：" + value(data, "financeBudgetOpinion")
          + "\n负责人（签字）：" + signatures.getOrDefault("finance_budget_review", ""));
      set(main, 13, 1, choice("采购预算审查情况",
          normalizeProcurementBudgetStatus(value(data, "procurementBudgetStatus")),
          PROCUREMENT_BUDGET_STATUS_OPTIONS, 1)
          + "\n补充意见：" + value(data, "procurementBudgetOpinion")
          + "\n经办人（签字）：" + signatures.getOrDefault("procurement_budget_review", ""));
      set(main, 14, 1, "提交确认：" + value(data, "handoverSubmitConfirmation")
          + "\n补充说明：" + value(data, "handoverSubmitComment")
          + "\n提交人（签字）：" + signatures.getOrDefault("handover_submit", ""));
      set(main, 14, 2, choice("受理确认", value(data, "handoverAcceptance"), HANDOVER_ACCEPTANCE_OPTIONS, 1)
          + "\n补充说明：" + value(data, "handoverAcceptComment")
          + "\n受理人（签字）：" + signatures.getOrDefault("handover_accept", ""));
      set(main, 16, 1, choice("采购方式", value(data, "procurementMethod"), PROCUREMENT_METHOD_OPTIONS, 3)
          + "\n采购方式说明：" + value(data, "procurementMethodComment")
          + "\n经办人（签字）：" + signatures.getOrDefault("procurement_method_review", "")
          + "\n" + choice("负责人终审意见", value(data, "financeResponsibleOpinion"), APPROVAL_OPTIONS, 0)
          + "\n负责人终审说明：" + value(data, "financeResponsibleComment")
          + "\n负责人（签字）：" + signatures.getOrDefault("finance_responsible_review", ""));
      set(main, 17, 0, "负责人（签字）：" + signatures.getOrDefault("finance_responsible_review", "")
          + "    日期：" + LocalDate.now());

      for (int row = 5; row < main.getNumberOfRows(); row++) {
        main.getRow(row).setHeight(0);
        main.getRow(row).setHeightRule(TableRowHeightRule.AUTO);
      }
      fillEquipmentTable(document.getTables().get(1), items);
      fillMallTable(document.getTables().get(2), items, signatures);
      optimizeDocumentLayout(document);
      return write(document);
    } catch (Exception exception) {
      throw new IllegalStateException("无法生成项目采购及招标申请单", exception);
    }
  }

  private void fillEquipmentTable(XWPFTable table, List<Map<String, Object>> items) {
    table.getRow(0).setRepeatHeader(true);
    set(table, 0, 10, "使用方向\n（教学、科研、行政办公）");
    set(table, 0, 12, "存放地点");
    int count = Math.min(items.size(), table.getNumberOfRows() - 1);
    String[] keys = {"name", "quantity", "unitPrice", "totalPrice", "technicalParameters",
        "referenceBrands", "imported", "importLeadTime", "purpose", "usageDirection", "userName", "installationLocation"};
    for (int row = 1; row <= count; row++) {
      Map<String, Object> item = items.get(row - 1);
      set(table, row, 0, String.valueOf(row));
      for (int col = 1; col <= keys.length; col++) {
        set(table, row, col, value(item, keys[col - 1]));
      }
    }
    removeUnusedRows(table, count + 1);
  }

  private void fillMallTable(
      XWPFTable table, List<Map<String, Object>> items, Map<String, String> signatures) {
    table.getRow(0).setRepeatHeader(true);
    boolean hasCatalogSnapshot = items.stream().anyMatch(item -> item.containsKey("governmentMallCatalog"));
    List<Map<String, Object>> mallItems = hasCatalogSnapshot
        ? items.stream().filter(item -> "是".equals(value(item, "governmentMallCatalog"))).toList()
        : items;
    int count = Math.min(mallItems.size(), table.getNumberOfRows() - 1);
    for (int row = 1; row <= count; row++) {
      Map<String, Object> item = mallItems.get(row - 1);
      set(table, row, 0, String.valueOf(row));
      set(table, row, 1, value(item, "name"));
      set(table, row, 2, value(item, "quantity"));
      set(table, row, 3, value(item, "unitPrice"));
      set(table, row, 4, value(item, "standardUnitPrice"));
      set(table, row, 5, value(item, "technicalParameters"));
      set(table, row, 6, "品牌：" + value(item, "selectedBrand") + "\n型号：" + value(item, "selectedModel")
          + "\n供货商：" + value(item, "selectedSupplier") + "\n联系人：" + value(item, "supplierContact")
          + "\n联系电话：" + value(item, "supplierPhone") + "\n产品链接：" + value(item, "productLink"));
      set(table, row, 7, value(item, "selectedParameters"));
      set(table, row, 8, value(item, "selectedUnitPrice"));
      set(table, row, 9, signatureOrValue(
          signatures, "mall_selection_participant_review", item, "selectionParticipants"));
    }
    removeUnusedRows(table, count + 1);
  }

  private static void removeUnusedRows(XWPFTable table, int firstUnusedRow) {
    for (int row = table.getNumberOfRows() - 1; row >= firstUnusedRow; row--) {
      table.removeRow(row);
    }
  }

  private Map<String, String> signatures(LudongPocApplication application) {
    Map<String, String> result = new LinkedHashMap<>();
    for (WorkflowApprovalSignature signature : workflowService.listApprovalSignatures(
        LudongPocWorkflowDefinition.BUSINESS_TYPE, application.id())) {
      result.putIfAbsent(stripTaskPrefix(signature.nodeId()), signature.actorName()
          + "（" + signature.actedAt().toLocalDate() + "）");
    }
    return result;
  }

  private static String stripTaskPrefix(String value) {
    return value != null && value.startsWith("task_") ? value.substring(5) : value;
  }

  private Map<String, Object> data(LudongPocApplication application) {
    try {
      Map<String, Object> result = new LinkedHashMap<>(objectMapper.readValue(application.formDataJson(), MAP_TYPE));
      for (LudongPocReviewRecord review : reviewRecordMapper.listByApplication(application.tenantId(), application.id())) {
        if ("approve".equals(review.decision())) {
          result.putAll(objectMapper.readValue(review.reviewDataJson(), MAP_TYPE));
        }
      }
      return result;
    } catch (Exception exception) {
      throw new IllegalStateException("申报表单数据损坏", exception);
    }
  }

  private List<Map<String, Object>> items(LudongPocApplication application) {
    try {
      Map<String, Object> accumulated = data(application);
      Object items = accumulated.get("items");
      return items == null
          ? objectMapper.readValue(application.itemsJson(), ITEMS_TYPE)
          : objectMapper.convertValue(items, ITEMS_TYPE);
    } catch (Exception exception) {
      throw new IllegalStateException("申报设备清单数据损坏", exception);
    }
  }

  private static XWPFDocument openTemplate(String name) throws Exception {
    ClassPathResource resource = new ClassPathResource("ludong-poc/templates/" + name);
    try (InputStream input = resource.getInputStream()) {
      return new XWPFDocument(new ByteArrayInputStream(input.readAllBytes()));
    }
  }

  private static byte[] write(XWPFDocument document) throws Exception {
    try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.write(output);
      return output.toByteArray();
    }
  }

  private static void replace(XWPFDocument document, String prefix, String text) {
    for (XWPFParagraph paragraph : document.getParagraphs()) {
      if (paragraph.getText().trim().startsWith(prefix)) {
        setParagraph(paragraph, text, 10.5);
        return;
      }
    }
  }

  private static void set(XWPFTable table, int row, int col, String text) {
    if (row >= table.getNumberOfRows() || col >= table.getRow(row).getTableCells().size()) return;
    XWPFTableCell cell = table.getRow(row).getCell(col);
    if (cell == null) return;
    if (cell.getCTTc().getTcPr() != null && cell.getCTTc().getTcPr().isSetNoWrap()) {
      cell.getCTTc().getTcPr().unsetNoWrap();
    }
    XWPFParagraph paragraph = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().get(0);
    setParagraph(paragraph, text, 8.5);
    while (cell.getParagraphs().size() > 1) {
      cell.removeParagraph(1);
    }
  }

  private static void setParagraph(XWPFParagraph paragraph, String text, double fontSize) {
    while (!paragraph.getRuns().isEmpty()) {
      paragraph.removeRun(0);
    }
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    paragraph.setSpacingBetween(1.0);
    paragraph.setWordWrapped(true);
    XWPFRun run = paragraph.createRun();
    applyArchiveFont(run);
    run.setColor("000000");
    run.setFontSize(fontSize);
    String[] lines = (text == null ? "" : text).split("\\R", -1);
    for (int index = 0; index < lines.length; index++) {
      if (index > 0) {
        run.addBreak();
      }
      run.setText(lines[index]);
    }
  }

  private static void optimizeDocumentLayout(XWPFDocument document) {
    for (XWPFTable table : document.getTables()) {
      table.getRows().forEach(row -> {
        row.setHeight(0);
        row.setHeightRule(TableRowHeightRule.AUTO);
        row.setCantSplitRow(true);
        row.getTableCells().forEach(cell -> {
          if (cell.getCTTc().getTcPr() != null && cell.getCTTc().getTcPr().isSetNoWrap()) {
            cell.getCTTc().getTcPr().unsetNoWrap();
          }
          cell.getParagraphs().forEach(paragraph -> paragraph.setWordWrapped(true));
        });
      });
    }
  }

  private static String signatureOrValue(
      Map<String, String> signatures, String nodeId, Map<String, Object> data, String field) {
    String signature = signatures.getOrDefault(nodeId, "").trim();
    return signature.isBlank() ? value(data, field) : signature;
  }

  private static String normalizeProcurementBudgetStatus(String selected) {
    return switch (selected == null ? "" : selected.trim()) {
      case "本项目已列入本年度学校预算", "本项目已列入本年度预算" ->
          "本项目已列入本年度采购预算";
      case "本项目年初无预算，现已办理预算追加手续" ->
          "本项目年初无采购预算，现已办理采购预算追加手续";
      case "本项目本年度无预算，已列入下一年度预算" ->
          "本项目本年度无采购预算，已列入下一年度采购预算";
      default -> selected == null ? "" : selected.trim();
    };
  }

  private static void applyArchiveFont(XWPFRun run) {
    for (XWPFRun.FontCharRange range : XWPFRun.FontCharRange.values()) {
      run.setFontFamily("宋体", range);
    }
  }

  private static String value(Map<String, Object> data, String key) {
    Object value = data.get(key);
    return value == null ? "" : String.valueOf(value);
  }

  private static String choice(
      String label, String selected, List<String> options, int optionsPerLine) {
    String normalized = selected == null ? "" : selected.trim();
    StringBuilder result = new StringBuilder(label).append("：");
    if (optionsPerLine == 1) {
      result.append('\n');
    }
    boolean matched = false;
    for (int index = 0; index < options.size(); index++) {
      if (index > 0) {
        result.append(optionsPerLine > 0 && index % optionsPerLine == 0 ? '\n' : "    ");
      }
      String option = options.get(index);
      boolean selectedOption = option.equals(normalized);
      matched |= selectedOption;
      result.append(selectedOption ? "☑ " : "☐ ").append(option);
    }
    if (!normalized.isBlank() && !matched) {
      result.append('\n').append("当前记录：").append(normalized);
    }
    return result.toString();
  }

  private static void add(ZipOutputStream zip, String name, byte[] bytes) throws Exception {
    zip.putNextEntry(new ZipEntry(name));
    zip.write(bytes);
    zip.closeEntry();
  }
}
