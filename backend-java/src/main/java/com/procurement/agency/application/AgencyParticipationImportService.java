package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyParticipationImportService {
  private final AgencyExecutionSupport s;
  private final AgencyParticipationImportParser parser;
  private final AgencyCollaborationService collaboration;

  public AgencyParticipationImportService(
      AgencyExecutionSupport s,
      AgencyParticipationImportParser parser,
      AgencyCollaborationService collaboration) {
    this.s = s;
    this.parser = parser;
    this.collaboration = collaboration;
  }

  public List<ParticipationImportSummary> recent(String pkg) {
    s.read(pkg, "buyer:agency:participation:read");
    return s.data.recentParticipationImports(s.guard.tenant(), pkg).stream()
        .filter(
            r -> {
              try {
                s.publicProjectSource(r.sourceVersionId(), pkg, "批量台账");
                return true;
              } catch (com.procurement.common.tenant.PermissionDeniedException denied) {
                return false;
              }
            })
        .toList();
  }

  public ParticipationImportView view(String pkg, String id) {
    s.read(pkg, "buyer:agency:participation:read");
    var record = s.data.participationImport(s.guard.tenant(), id);
    if (record == null || !record.packageId().equals(pkg))
      throw new IllegalArgumentException("导入预览不存在");
    s.publicProjectSource(record.sourceVersionId(), pkg, "批量台账");
    return view(record);
  }

  private ParticipationImportView view(ParticipationImport r) {
    var rows = Arrays.asList(s.json.read(r.rowsJson(), ParticipationImportRow[].class));
    return new ParticipationImportView(
        r,
        rows,
        rows.stream().mapToInt(v -> v.errors().size()).sum(),
        rows.stream().mapToInt(v -> v.warnings().size()).sum());
  }

  @Transactional
  public ParticipationImportView preview(String pkg, String source, String key) {
    s.write(pkg, "buyer:agency:participation:manage");
    s.guard.permissions().require("buyer:agency:participation:read");
    s.publicProjectSource(source, pkg, "批量台账");
    var input = s.source(source, pkg);
    String fp = s.begin(key, Arrays.asList("participation-preview", pkg, source, input.hash()));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, ParticipationImportView.class);
    var parsed = parser.parse(input.name(), input.bytes());
    List<ParticipationImportRow> rows = new ArrayList<>();
    var existing = s.data.participations(s.guard.tenant(), pkg);
    for (var row : parsed) {
      var warnings = new ArrayList<>(row.warnings());
      if (existing.stream().anyMatch(p -> same(row.data(), p.supplierName(), p.creditCode()))
          || parsed.stream()
              .anyMatch(
                  other ->
                      other.rowNumber() != row.rowNumber()
                          && same(
                              row.data(), other.data().supplierName(), other.data().creditCode())))
        warnings.add("供应商名称或信用代码可能重复；默认不导入重复记录，请人工核实");
      rows.add(new ParticipationImportRow(row.rowNumber(), row.data(), row.errors(), warnings));
    }
    String id = "agency-import-" + UUID.randomUUID();
    boolean invalid = rows.stream().anyMatch(r -> !r.errors().isEmpty());
    s.data.createParticipationImport(
        s.guard.tenant(),
        id,
        pkg,
        source,
        input.hash(),
        input.name(),
        s.json.write(rows),
        invalid ? "invalid" : "preview",
        s.guard.actor());
    var result = view(s.data.participationImport(s.guard.tenant(), id));
    s.event(
        pkg,
        "participation_import_preview",
        id,
        null,
        Map.of(
            "id",
            id,
            "sourceVersionId",
            source,
            "hash",
            input.hash(),
            "rows",
            rows.size(),
            "errors",
            result.errorCount()),
        "预览校验，不新增台账记录");
    s.remember(key, fp, result);
    return result;
  }

  private String clean(String value) {
    return value == null ? "" : value.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
  }

  private boolean same(ParticipationDraft d, String name, String code) {
    return clean(d.supplierName()).equals(clean(name))
        || !clean(d.creditCode()).isEmpty() && clean(d.creditCode()).equals(clean(code));
  }

  @Transactional
  public ParticipationImportView commit(
      String pkg,
      String id,
      Long expected,
      boolean confirmed,
      boolean allowDuplicates,
      String key) {
    s.write(pkg, "buyer:agency:participation:manage");
    s.guard.permissions().require("buyer:agency:participation:read");
    var record = s.data.participationImport(s.guard.tenant(), id);
    if (record == null || !record.packageId().equals(pkg))
      throw new IllegalArgumentException("导入预览不存在");
    if (!record.createdBy().equals(s.guard.actor()))
      throw new IllegalArgumentException("仅预览创建人可确认该批次");
    s.publicProjectSource(record.sourceVersionId(), pkg, "批量台账");
    var source = s.source(record.sourceVersionId(), pkg);
    if (!source.hash().equals(record.sourceHash()))
      throw new IllegalStateException("导入来源哈希已变化，请重新预览");
    String fp =
        s.begin(
            key,
            Arrays.asList("participation-commit", pkg, id, expected, confirmed, allowDuplicates));
    String prior = s.remembered(key);
    if (prior != null) return s.json.read(prior, ParticipationImportView.class);
    s.expected(record.version(), expected);
    var preview = view(record);
    if (!"preview".equals(record.status()) || preview.errorCount() != 0)
      throw new IllegalStateException("该批次存在错误或已处理，请修正来源文件后重新预览");
    if (!confirmed) throw new IllegalArgumentException("须人工核对本批次记录、来源、警告及内部台账用途后确认");
    var existing = s.data.participations(s.guard.tenant(), pkg);
    var rows = preview.rows();
    boolean duplicate =
        rows.stream()
            .anyMatch(
                row ->
                    existing.stream()
                            .anyMatch(p -> same(row.data(), p.supplierName(), p.creditCode()))
                        || rows.stream()
                            .anyMatch(
                                other ->
                                    other.rowNumber() != row.rowNumber()
                                        && same(
                                            row.data(),
                                            other.data().supplierName(),
                                            other.data().creditCode())));
    if (duplicate && !allowDuplicates)
      throw new IllegalStateException("存在可能重复的供应商记录，请核实后单独确认允许新增重复记录，或重新整理文件");
    try {
      List<String> ids = new ArrayList<>();
      for (var row : rows) {
        var created = collaboration.saveParticipation(pkg, null, row.data());
        if (s.data.linkParticipationImport(s.guard.tenant(), created.id(), id, row.rowNumber())
            != 1) throw new IllegalStateException("导入来源关联失败");
        ids.add(created.id());
      }
      var result =
          Map.of(
              "participationIds",
              ids,
              "rowCount",
              ids.size(),
              "duplicateAcknowledged",
              allowDuplicates,
              "sourceVersionId",
              record.sourceVersionId(),
              "sourceHash",
              record.sourceHash());
      if (s.data.commitParticipationImport(
              s.guard.tenant(), id, record.version(), s.json.write(result), s.guard.actor())
          != 1) throw new IllegalStateException("导入批次版本已变化");
      s.event(
          pkg, "participation_import_committed", id, null, result, "人工确认后整批追加；不覆盖原记录，不生成准入或资格结论");
      var output = view(s.data.participationImport(s.guard.tenant(), id));
      s.remember(key, fp, output);
      return output;
    } catch (RuntimeException e) {
      throw new IllegalStateException("批量导入未完成，本批记录未入库；请重试或联系管理员", e);
    }
  }
}
