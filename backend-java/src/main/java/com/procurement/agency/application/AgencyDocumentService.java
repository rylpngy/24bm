package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.workflow.application.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyDocumentService {
  private final AgencyExecutionSupport s;
  private final AgencyDocumentBasis basis;
  private final AgencyTemplateService templates;
  private final UnifiedWorkflowApplicationService workflows;
  private final AgencyDocxComposer composer;

  public AgencyDocumentService(
      AgencyExecutionSupport s,
      AgencyDocumentBasis basis,
      AgencyTemplateService templates,
      UnifiedWorkflowApplicationService workflows,
      AgencyDocxComposer composer) {
    this.s = s;
    this.basis = basis;
    this.templates = templates;
    this.workflows = workflows;
    this.composer = composer;
  }

  public Document require(String id, boolean write) {
    var d = s.data.document(s.guard.tenant(), id);
    if (d == null) throw new IllegalArgumentException("编制对象不存在");
    if (write) s.write(d.packageId(), "buyer:agency:document:manage");
    else s.read(d.packageId(), "buyer:agency:document:read");
    return write ? s.data.lockDocument(s.guard.tenant(), id) : d;
  }

  private void mutable(Document d, Long expected) {
    s.expected(d.version(), expected);
    if ("reviewing".equals(d.status())) throw new IllegalStateException("文件审核中，须退回或撤回后编辑");
  }

  @Transactional
  public List<DocumentView> ensure(String pkg) {
    s.write(pkg, "buyer:agency:document:manage");
    for (String kind : List.of("purchase", "announcement")) {
      s.data.ensureDocument(
          s.guard.tenant(), "agency-doc-" + UUID.randomUUID(), pkg, kind, s.guard.actor());
    }
    for (var d : s.data.documents(s.guard.tenant(), pkg))
      if (s.chapters(d.sectionsJson()).isEmpty()) {
        List<Chapter> chapters =
            "announcement".equals(d.kind())
                ? List.of(new Chapter("notice", "采购公告或邀请", "", true))
                : List.of(
                    new Chapter("instructions", "须知及前附表", "", true),
                    new Chapter("qualification", "资格条件与审查", "", true),
                    new Chapter("demand", "采购需求", "", true),
                    new Chapter("evaluation", "评审或协商办法", "", true),
                    new Chapter("contract", "合同条款及格式", "", true),
                    new Chapter("response", "投标或响应文件格式", "", true));
        s.data.documentEdit(
            s.guard.tenant(),
            d.id(),
            d.version(),
            null,
            s.json.write(chapters),
            "{}",
            s.json.write(basis.current(s.guard.tenant(), pkg)));
      }
    return views(pkg);
  }

  public List<DocumentView> views(String pkg) {
    s.read(pkg, "buyer:agency:document:read");
    return s.data.documents(s.guard.tenant(), pkg).stream().map(this::view).toList();
  }

  public DocumentView view(Document d) {
    var chapters = s.chapters(d.sectionsJson());
    Map<String, String> settings = settings(d);
    return new DocumentView(
        d,
        chapters,
        settings,
        s.data.revisions(s.guard.tenant(), d.id()),
        basis.stale(s.guard.tenant(), d.packageId(), d.basisJson()),
        issues(d, false));
  }

  @SuppressWarnings("unchecked")
  private Map<String, String> settings(Document d) {
    return s.json.read(d.settingsJson(), java.util.TreeMap.class);
  }

  private Map<String, String> validateSettings(Map<String, String> input) {
    Map<String, String> out = new TreeMap<>();
    if (input == null) return out;
    for (var e : input.entrySet()) {
      if (!Set.of(
              "fileGetStart",
              "fileGetEnd",
              "submissionDeadline",
              "openingAt",
              "venue",
              "contact",
              "phone")
          .contains(e.getKey())) throw new IllegalArgumentException("不支持的发布要素：" + e.getKey());
      s.text(e.getValue(), 1000, false, "发布要素");
      if (e.getKey().endsWith("At")
          || e.getKey().endsWith("Deadline")
          || e.getKey().startsWith("fileGet"))
        if (e.getValue() != null && !e.getValue().isBlank())
          try {
            out.put(
                e.getKey(), java.time.OffsetDateTime.parse(e.getValue()).toInstant().toString());
          } catch (Exception ex) {
            throw new IllegalArgumentException("时间要素须为含时区的ISO时间");
          }
      out.putIfAbsent(e.getKey(), s.str(e.getValue()));
    }
    return out;
  }

  @Transactional
  public DocumentView save(String id, DocumentDraft request) {
    var d = require(id, true);
    mutable(d, request.expectedVersion());
    var chapters = s.validateChapters(request.sections());
    var settings = validateSettings(request.settings());
    if (s.data.documentEdit(
            s.guard.tenant(),
            id,
            d.version(),
            d.templateVersionId(),
            s.json.write(chapters),
            s.json.write(settings),
            d.basisJson())
        != 1) throw new AgencyConflictException("文件草稿版本冲突");
    s.event(d.packageId(), "document_edited", id, d, request, "保存章节草稿，不继承旧审批");
    return view(s.data.document(s.guard.tenant(), id));
  }

  @Transactional
  public DocumentView choose(String id, Long expected, String version) {
    var d = require(id, true);
    mutable(d, expected);
    var t = templates.usable(d.packageId(), version);
    var chapters = s.chapters(t.sectionsJson());
    if ("announcement".equals(d.kind())) {
      chapters = chapters.stream().filter(c -> c.code().equals("notice")).toList();
      if (chapters.isEmpty()) throw new IllegalArgumentException("该模板没有公告或邀请章节，请选择适用模板或手工编制");
    }
    s.data.documentEdit(
        s.guard.tenant(),
        id,
        d.version(),
        version,
        s.json.write(chapters),
        d.settingsJson(),
        s.json.write(basis.current(s.guard.tenant(), d.packageId())));
    s.event(
        d.packageId(),
        "template_selected",
        id,
        d,
        Map.of("templateVersion", version),
        "复制模板快照，后续模板更新不改当前稿");
    return view(s.data.document(s.guard.tenant(), id));
  }

  @Transactional
  public DocumentView sync(String id, Long expected) {
    var d = require(id, true);
    mutable(d, expected);
    s.data.documentEdit(
        s.guard.tenant(),
        id,
        d.version(),
        d.templateVersionId(),
        d.sectionsJson(),
        d.settingsJson(),
        s.json.write(basis.current(s.guard.tenant(), d.packageId())));
    s.event(
        d.packageId(),
        "document_basis_synced",
        id,
        d,
        Map.of("basis", basis.current(s.guard.tenant(), d.packageId())),
        "人工确认同步公共要素及需求版本");
    return view(s.data.document(s.guard.tenant(), id));
  }

  @Transactional
  public DocumentView syncNotice(String id, Long expected) {
    var d = require(id, true);
    mutable(d, expected);
    if (!d.kind().equals("purchase")) throw new IllegalArgumentException("仅整稿可同步独立公告");
    var a =
        s.data.documents(s.guard.tenant(), d.packageId()).stream()
            .filter(x -> x.kind().equals("announcement"))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("尚无公告草稿"));
    var notice =
        s.chapters(a.sectionsJson()).stream()
            .filter(c -> c.code().equals("notice"))
            .findFirst()
            .orElseThrow();
    var sections = new ArrayList<>(s.chapters(d.sectionsJson()));
    sections.removeIf(c -> c.code().equals("notice"));
    sections.add(0, notice);
    s.data.documentEdit(
        s.guard.tenant(),
        id,
        d.version(),
        d.templateVersionId(),
        s.json.write(sections),
        d.settingsJson(),
        d.basisJson());
    s.event(
        d.packageId(),
        "notice_synced",
        id,
        d,
        Map.of("announcementDraftVersion", a.version()),
        "人工同步公告到整稿");
    return view(s.data.document(s.guard.tenant(), id));
  }

  public Map<String, String> fields(Document d) {
    Map<String, String> out = new TreeMap<>();
    s.json
        .tree(d.basisJson())
        .path("fields")
        .fields()
        .forEachRemaining(e -> out.put(e.getKey(), e.getValue().asText()));
    s.json
        .tree(d.basisJson())
        .path("requirements")
        .forEach(
            item ->
                out.put("requirement." + item.path("key").asText(), item.path("value").asText()));
    out.putAll(settings(d));
    return out;
  }

  public List<String> issues(Document d, boolean uploaded) {
    List<String> issues = new ArrayList<>();
    if (basis.stale(s.guard.tenant(), d.packageId(), d.basisJson()))
      issues.add("公共字段或已确认需求已变化，请先同步复核");
    if (!uploaded)
      for (var c : s.chapters(d.sectionsJson())) {
        if (c.required() && c.body().isBlank()) issues.add("缺少必需章节内容：" + c.title());
        if (composer.expand(c.body(), fields(d)).contains("{{"))
          issues.add("章节含未解析字段：" + c.title());
      }
    var own = settings(d);
    for (var other : s.data.documents(s.guard.tenant(), d.packageId()))
      if (!other.id().equals(d.id())) {
        var pairs = settings(other);
        for (String key :
            List.of("fileGetStart", "fileGetEnd", "submissionDeadline", "openingAt", "venue"))
          if (!own.getOrDefault(key, "").isBlank()
              && !pairs.getOrDefault(key, "").isBlank()
              && !own.get(key).equals(pairs.get(key))) issues.add("整稿与公告要素不一致：" + key);
        if (!uploaded && "purchase".equals(d.kind())) {
          var n =
              s.chapters(d.sectionsJson()).stream()
                  .filter(c -> c.code().equals("notice"))
                  .findFirst();
          var o =
              s.chapters(other.sectionsJson()).stream()
                  .filter(c -> c.code().equals("notice"))
                  .findFirst();
          if (n.isPresent() && o.isPresent() && !n.get().body().equals(o.get().body()))
            issues.add("整稿公告章节与独立公告不一致，请人工同步");
        }
      }
    return issues;
  }

  @Transactional
  public Job compose(String id, Long expected, String key) {
    var d = require(id, true);
    mutable(d, expected);
    if (basis.stale(s.guard.tenant(), d.packageId(), d.basisJson()))
      throw new IllegalStateException("请先同步复核公共字段和需求");
    s.guard.permissions().require("buyer:agency:file:manage");
    String hash = s.begin(key, Arrays.asList("compose", id, expected));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, Job.class);
    String job = "agency-job-" + UUID.randomUUID();
    s.data.enqueue(
        s.guard.tenant(),
        job,
        d.packageId(),
        "compose",
        id,
        d.version(),
        s.json.write(Map.of("document", d)),
        s.guard.actor());
    var result = s.data.job(s.guard.tenant(), job);
    s.remember(key, hash, result);
    return result;
  }

  public byte[] render(Job job) {
    var d = s.json.read(s.json.tree(job.payloadJson()).path("document").toString(), Document.class);
    return composer.compose(
        (d.kind().equals("purchase") ? "采购文件" : "采购公告或邀请")
            + " "
            + fields(d).getOrDefault("projectTitle", ""),
        s.chapters(d.sectionsJson()),
        fields(d));
  }

  @Transactional
  public Revision finishComposition(Job job, byte[] bytes) {
    var d = require(job.documentId(), true);
    var current = s.data.lockJob(s.guard.tenant(), job.id());
    if (current == null
        || !"processing".equals(current.status())
        || current.attempts() != job.attempts()
        || !Objects.equals(current.startedAt(), job.startedAt()))
      throw new IllegalStateException("任务状态已变化");
    if (d.version() != job.inputVersion()
        || "reviewing".equals(d.status())
        || basis.stale(s.guard.tenant(), d.packageId(), d.basisJson())) {
      s.data.finishJob(s.guard.tenant(), job.id(), "stale", "{}", "输入版本已变化，输出未挂入当前稿");
      return null;
    }
    var file =
        s.artifact(
            d.packageId(),
            (d.kind().equals("purchase") ? "采购文件" : "公告") + "-V" + d.version() + ".docx",
            bytes);
    return revision(d, "composed", file.id(), file.hash(), job.id(), false, "");
  }

  private Revision revision(
      Document d,
      String source,
      String file,
      String hash,
      String job,
      boolean confirmed,
      String note) {
    String id = "agency-revision-" + UUID.randomUUID();
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("document", d);
    snapshot.put("fields", fields(d));
    snapshot.put("sections", s.chapters(d.sectionsJson()));
    snapshot.put("settings", settings(d));
    snapshot.put("basis", s.json.tree(d.basisJson()));
    snapshot.put("wholeDocumentConfirmed", confirmed);
    snapshot.put("manualNote", note);
    snapshot.put("sourceKind", source);
    snapshot.put("fileVersionId", file);
    snapshot.put("fileHash", hash);
    s.data.revisionCreate(
        s.guard.tenant(),
        id,
        d.id(),
        d.version(),
        source,
        file,
        hash,
        s.json.write(snapshot),
        job,
        s.guard.actor());
    s.data.documentState(s.guard.tenant(), d.id(), d.version(), "ready", id);
    if (job != null)
      s.data.finishJob(
          s.guard.tenant(),
          job,
          "success",
          s.json.write(Map.of("revisionId", id, "fileVersionId", file, "hash", hash)),
          null);
    s.event(d.packageId(), "document_revision", id, null, snapshot, "生成不可变候选稿，尚未审核");
    return s.data.revision(s.guard.tenant(), id);
  }

  @Transactional
  public Revision importWhole(
      String id, Long expected, String file, boolean confirmed, String note, String key) {
    var d = require(id, true);
    mutable(d, expected);
    if (!confirmed) throw new IllegalArgumentException("上传整稿须人工确认已核对正文、章节及公共要素");
    s.text(note, 2000, true, "整稿复核说明");
    String hash = s.begin(key, Arrays.asList("whole", id, expected, file, confirmed, note));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, Revision.class);
    var source = s.source(file, d.packageId());
    if (!source.name().toLowerCase(Locale.ROOT).endsWith(".docx"))
      throw new IllegalArgumentException("整稿上传仅接受可编辑DOCX");
    if (basis.stale(s.guard.tenant(), d.packageId(), d.basisJson()))
      throw new IllegalStateException("公共要素已变化，请先同步复核");
    var result = revision(d, "uploaded", file, source.hash(), null, true, note);
    s.remember(key, hash, result);
    return result;
  }

  @Transactional
  public Revision submit(String id, String key, String exception, Map<String, Object> form) {
    var r = s.data.revision(s.guard.tenant(), id);
    if (r == null) throw new IllegalArgumentException("文件版本不存在");
    var d = require(r.documentId(), true);
    s.guard.permissions().require("buyer:agency:document:submit");
    String fp = s.begin(key, Arrays.asList("doc-submit", id, exception, form));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, Revision.class);
    if (!Objects.equals(d.currentRevisionId(), id)
        || d.version() != r.inputVersion()
        || !Set.of("candidate", "rejected", "withdrawn").contains(r.status())
        || "reviewing".equals(d.status())) throw new IllegalStateException("当前候选稿不可送审，请生成或选择适用版本");
    if (basis.stale(s.guard.tenant(), d.packageId(), d.basisJson()))
      throw new IllegalStateException("公共要素已变化，请先同步复核并生成新稿");
    s.source(r.fileVersionId(), d.packageId());
    var problems = issues(d, "uploaded".equals(r.sourceKind()));
    if (problems.stream().anyMatch(x -> !x.startsWith("缺少必需章节内容：")))
      throw new IllegalStateException(String.join("；", problems));
    if (!problems.isEmpty()) {
      s.guard.permissions().require("buyer:agency:document:exception");
      s.text(exception, 2000, true, "完整性例外说明");
    }
    Map<String, Object> snap = new LinkedHashMap<>();
    snap.put("packageId", d.packageId());
    snap.put("documentKind", d.kind());
    snap.put("revisionId", id);
    snap.put("fileVersionId", r.fileVersionId());
    snap.put("fileHash", r.hash());
    snap.put("inputVersion", r.inputVersion());
    snap.put("documentSnapshot", s.json.tree(r.snapshotJson()));
    snap.put("completenessIssues", problems);
    snap.put("exceptionReason", s.str(exception));
    s.data.revisionState(
        s.guard.tenant(), id, r.status(), "processing", null, s.guard.actor(), null);
    s.data.documentState(s.guard.tenant(), d.id(), d.version(), "reviewing", id);
    var w =
        workflows.start(
            new WorkflowStartCommand(
                d.kind().equals("purchase") ? "agency_purchase_document" : "agency_announcement",
                id,
                s.packages.find(s.guard.tenant(), d.packageId()).departmentId(),
                null,
                form == null ? Map.of() : form,
                snap));
    s.data.revisionState(
        s.guard.tenant(),
        id,
        "processing",
        "processing",
        w.workflowInstanceId(),
        s.guard.actor(),
        null);
    s.data.reviewContext(
        s.guard.tenant(),
        w.workflowInstanceId(),
        id,
        s.json.write(problems),
        s.str(exception),
        s.guard.actor());
    var result = s.data.revision(s.guard.tenant(), id);
    s.remember(key, fp, result);
    return result;
  }

  @Transactional
  public Revision withdraw(String revision, String reason) {
    var r = s.data.revision(s.guard.tenant(), revision);
    if (r == null) throw new IllegalArgumentException("版本不存在");
    require(r.documentId(), true);
    workflows.withdrawAgencyExecution(r.workflowId(), reason);
    return s.data.revision(s.guard.tenant(), revision);
  }

  public List<Map<String, Object>> historical(String method, String keyword) {
    s.guard.permissions().require("buyer:agency:document:read");
    var scope = s.guard.scopes().currentUserDataScope();
    List<Map<String, Object>> out = new ArrayList<>();
    for (var r :
        s.data.historical(
            s.guard.tenant(),
            s.guard.actor(),
            !scope.restricted(),
            scope.departmentIds(),
            s.str(method),
            s.str(keyword))) {
      var d = s.data.document(s.guard.tenant(), r.documentId());
      try {
        s.sourceVersion(r.fileVersionId(), d.packageId());
      } catch (com.procurement.common.tenant.PermissionDeniedException denied) {
        continue;
      }
      var p = s.packages.find(s.guard.tenant(), d.packageId());
      out.add(
          Map.of(
              "revisionId",
              r.id(),
              "packageId",
              p.id(),
              "title",
              p.title(),
              "method",
              p.procurementMethod(),
              "fileVersionId",
              r.fileVersionId(),
              "hash",
              r.hash(),
              "sourceKind",
              r.sourceKind()));
    }
    return out;
  }

  @Transactional
  public DocumentView reuseHistory(String id, Long expected, String sourceRevision, String reason) {
    var d = require(id, true);
    mutable(d, expected);
    s.text(reason, 2000, true, "历史条款引用及复核说明");
    var r = s.data.revision(s.guard.tenant(), sourceRevision);
    if (r == null || !"approved".equals(r.status()))
      throw new IllegalArgumentException("历史稿须为已审核版本");
    var sourceDoc = require(r.documentId(), false);
    s.sourceVersion(r.fileVersionId(), sourceDoc.packageId());
    var source = s.json.tree(r.snapshotJson());
    if ("uploaded".equals(r.sourceKind()))
      throw new IllegalArgumentException("历史整份上传稿未可靠拆章，请下载复核后作为新候选整稿上传");
    var sections = s.chapters(source.path("document").path("sectionsJson").asText("[]"));
    if (sections.isEmpty()) throw new IllegalStateException("历史稿没有结构化章节");
    if ("announcement".equals(d.kind()))
      sections = sections.stream().filter(c -> c.code().equals("notice")).toList();
    s.validateChapters(sections);
    s.data.documentEdit(
        s.guard.tenant(),
        id,
        d.version(),
        null,
        s.json.write(sections),
        d.settingsJson(),
        s.json.write(basis.current(s.guard.tenant(), d.packageId())));
    s.event(
        d.packageId(),
        "historical_reuse",
        id,
        d,
        Map.of(
            "sourceRevisionId", r.id(), "sourcePackageId", sourceDoc.packageId(), "reason", reason),
        "历史条款已复制，须人工复核适用性及旧项目字面值");
    return view(s.data.document(s.guard.tenant(), id));
  }

  public Map<String, String> artifact(String revision) {
    var r = s.data.revision(s.guard.tenant(), revision);
    if (r == null) throw new IllegalArgumentException("文件版本不存在");
    var d = require(r.documentId(), false);
    s.guard.permissions().require("buyer:agency:file:download");
    var file = s.sourceVersion(r.fileVersionId(), d.packageId());
    return Map.of(
        "attachmentId",
        file.attachmentId(),
        "name",
        d.kind().equals("purchase") ? "采购文件.docx" : "公告.docx");
  }
}
