package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyFinanceRecords.*;
import com.procurement.agency.infrastructure.*;
import java.io.*;
import java.time.*;
import java.util.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class AgencyOfficeService {
  final AgencyExecutionSupport s;
  final AgencyFinanceMapper finance;
  final AgencyArchiveMapper archive;
  final AgencyPostMapper post;

  public AgencyOfficeService(
      AgencyExecutionSupport s,
      AgencyFinanceMapper finance,
      AgencyArchiveMapper archive,
      AgencyPostMapper post) {
    this.s = s;
    this.finance = finance;
    this.archive = archive;
    this.post = post;
  }

  public record Todo(
      String kind, String title, String ownerId, OffsetDateTime dueAt, String state) {}

  public record CurrencySummary(String currency, Summary summary) {}

  public record Office(
      List<Todo> todos, List<CurrencySummary> summaries, int packageCount, String scope) {}

  public Office one(String pkg) {
    s.read(pkg, "buyer:agency:office:read");
    return build(List.of(s.packages.find(s.guard.tenant(), pkg)));
  }

  java.util.List<com.procurement.agency.domain.AgencyRecords.PackageRow> packages(String group) {
    s.guard.permissions().require("buyer:agency:office:read");
    var scope = s.guard.scopes().currentUserDataScope();
    return s
        .packages
        .groupPackages(
            s.guard.tenant(), group, s.guard.actor(), !scope.restricted(), scope.departmentIds())
        .stream()
        .filter(p -> p.status().equals("approved"))
        .collect(
            java.util.stream.Collectors.toMap(p -> p.id(), p -> p, (a, b) -> a, LinkedHashMap::new))
        .values()
        .stream()
        .toList();
  }

  public Office group(String group) {
    return build(packages(group));
  }

  Office build(List<com.procurement.agency.domain.AgencyRecords.PackageRow> packages) {
    String t = s.guard.tenant();
    List<Todo> todos = new ArrayList<>();
    Map<String, List<Account>> accounts = new TreeMap<>();
    Map<String, List<Entry>> entries = new TreeMap<>();
    for (var p : packages) {
      s.guard.require(p.id(), false);
      if (s.guard.permissions().currentUserHas("buyer:agency:finance:read")) {
        accounts
            .computeIfAbsent(p.currency(), k -> new ArrayList<>())
            .addAll(finance.accounts(t, p.id()));
        entries
            .computeIfAbsent(p.currency(), k -> new ArrayList<>())
            .addAll(finance.entries(t, p.id()));
        for (var a : finance.accounts(t, p.id()))
          if (a.status().equals("draft") || a.status().equals("reviewing"))
            todos.add(
                new Todo(
                    "finance",
                    p.title() + " · " + (a.kind().equals("cost") ? "成本申请" : "应收核算"),
                    a.category().equals("expert")
                            && !s.guard.permissions().currentUserHas("buyer:agency:finance:expert")
                        ? null
                        : a.createdBy(),
                    null,
                    a.status()));
      }
      if (s.guard.permissions().currentUserHas("buyer:agency:post:read")) {
        for (var i : post.issues(t, p.id()))
          if (!i.status().equals("closed")) {
            var d = s.json.tree(i.snapshotJson()).path("draft");
            todos.add(
                new Todo(
                    "issue",
                    p.title() + " · " + d.path("title").asText(),
                    d.path("ownerId").asText(),
                    OffsetDateTime.parse(d.path("deadline").asText()),
                    i.status()));
          }
        for (var doc : post.documents(t, p.id()))
          if (Set.of("generated", "reviewing", "approved", "issued").contains(doc.status()))
            todos.add(
                new Todo(
                    "document",
                    p.title()
                        + " · "
                        + switch (doc.kind()) {
                          case "notice" -> "通知书审核、用印或送达";
                          case "announcement" -> "结果公告审核或人工发布";
                          default -> "合同审核或正式签署回传";
                        },
                    doc.createdBy(),
                    null,
                    doc.status()));
      }
      if (s.guard.permissions().currentUserHas("buyer:agency:archive:read"))
        for (var row : archive.checklist(t, p.id()))
          if (row.disposition().equals("missing")) {
            var d = s.json.tree(row.snapshotJson()).path("draft");
            todos.add(
                new Todo(
                    "archive",
                    p.title() + " · 归档补件",
                    d.path("ownerId").asText(),
                    d.path("deadline").isNull()
                        ? null
                        : OffsetDateTime.parse(d.path("deadline").asText()),
                    "missing"));
          }
      for (var m : s.data.milestones(t, p.id()))
        if (!Set.of("completed", "cancelled").contains(m.status()))
          todos.add(
              new Todo(
                  "milestone", p.title() + " · " + m.title(), m.ownerId(), m.dueAt(), m.status()));
    }
    var summaries =
        accounts.entrySet().stream()
            .map(
                e ->
                    new CurrencySummary(
                        e.getKey(),
                        AgencyFinancePolicy.summary(
                            e.getValue(), entries.getOrDefault(e.getKey(), List.of()))))
            .toList();
    return new Office(
        todos, summaries, packages.size(), "仅当前授权采购包，每包计一次，按币种分别汇总；内部待办不自动对外催收，不计算固定工资或提成");
  }

  public byte[] export(String group) {
    s.guard.permissions().require("buyer:agency:finance:export");
    s.guard.permissions().require("buyer:agency:finance:read");
    var packages = packages(group);
    if (packages.size() > 500) throw new IllegalStateException("统计导出技术上限500包，请缩小范围");
    try (var workbook = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("授权采购包财务与绩效基础");
      String[] header = {
        "采购包",
        "项目编号",
        "采购方式",
        "币种",
        "主负责人",
        "协作人数",
        "节点完成数",
        "逾期未完数",
        "当前节点修订次数口径",
        "项目预算",
        "已确认应收",
        "实际到账",
        "退款",
        "净开票",
        "批准减免",
        "未收",
        "超收待处理",
        "实际成本",
        "实际净已付成本",
        "实际待付",
        "应收与实际成本口径差额",
        "业务状态",
        "档案状态",
        "费用状态"
      };
      var row = sheet.createRow(0);
      for (int i = 0; i < header.length; i++) row.createCell(i).setCellValue(header[i]);
      int n = 1;
      for (var p : packages) {
        s.guard.require(p.id(), false);
        var sum =
            AgencyFinancePolicy.summary(
                finance.accounts(s.guard.tenant(), p.id()),
                finance.entries(s.guard.tenant(), p.id()));
        var milestones = s.data.milestones(s.guard.tenant(), p.id());
        var now = OffsetDateTime.now();
        String[] values = {
          p.title(),
          Objects.toString(p.number(), ""),
          p.procurementMethod(),
          p.currency(),
          Objects.toString(p.ownerId(), ""),
          Integer.toString(s.packages.members(s.guard.tenant(), p.id()).size()),
          Long.toString(milestones.stream().filter(m -> m.status().equals("completed")).count()),
          Long.toString(
              milestones.stream()
                  .filter(
                      m ->
                          !m.status().equals("completed")
                              && m.dueAt() != null
                              && m.dueAt().isBefore(now))
                  .count()),
          Long.toString(milestones.stream().mapToLong(m -> Math.max(0, m.version() - 1)).sum()),
          Objects.toString(p.budget(), ""),
          sum.receivable().toPlainString(),
          sum.received().toPlainString(),
          sum.refunded().toPlainString(),
          sum.invoiced().toPlainString(),
          sum.waived().toPlainString(),
          sum.outstanding().toPlainString(),
          sum.overpaid().toPlainString(),
          sum.costActual().toPlainString(),
          sum.costPaid().toPlainString(),
          sum.costPayable().toPlainString(),
          sum.basisDifference().toPlainString(),
          p.businessStatus(),
          p.archiveCompletion(),
          p.financialStatus()
        };
        row = sheet.createRow(n++);
        for (int i = 0; i < values.length; i++) row.createCell(i).setCellValue(values[i]);
        s.event(
            p.id(),
            "finance_statistics_export",
            p.id(),
            null,
            Map.of("scope", "无专家身份明细；金额以精确文本导出，避免Excel精度及公式注入"),
            "授权财务与绩效基础数据导出，不混称审计利润或自动计薪");
      }
      sheet.createFreezePane(0, 1);
      sheet.setAutoFilter(
          new org.apache.poi.ss.util.CellRangeAddress(0, Math.max(0, n - 1), 0, header.length - 1));
      for (int i = 0; i < header.length; i++) sheet.setColumnWidth(i, 22 * 256);
      workbook.write(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("统计导出失败", e);
    }
  }
}
