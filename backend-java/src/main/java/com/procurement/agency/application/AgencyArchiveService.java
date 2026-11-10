package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyArchiveRecords.*;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.attachment.application.AttachmentReviewQuery;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.PermissionDeniedException;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyArchiveService {
  final AgencyExecutionSupport s;
  final AgencyArchiveMapper data;
  final AgencyPostMapper post;
  final AgencyFinanceMapper finance;
  final AgencyFileAccess files;
  final AttachmentReviewQuery attachments;
  final ObjectStorageService storage;
  final AgencyEvaluationEvidence evaluationEvidence;

  public AgencyArchiveService(
      AgencyExecutionSupport s,
      AgencyArchiveMapper data,
      AgencyPostMapper post,
      AgencyFinanceMapper finance,
      AgencyFileAccess files,
      AttachmentReviewQuery attachments,
      ObjectStorageService storage,
      AgencyEvaluationEvidence evaluationEvidence) {
    this.s = s;
    this.data = data;
    this.post = post;
    this.finance = finance;
    this.files = files;
    this.attachments = attachments;
    this.storage = storage;
    this.evaluationEvidence = evaluationEvidence;
  }

  String t() {
    return s.guard.tenant();
  }

  String id(String type) {
    return "agency-archive-" + type + "-" + UUID.randomUUID();
  }

  String hash(String raw) {
    return s.json.hash(s.json.read(raw, Map.class));
  }

  void access(String p, boolean w) {
    if (w) s.write(p, "buyer:agency:archive:manage");
    else s.read(p, "buyer:agency:archive:read");
  }

  Completion state(String p) {
    var state = data.completion(t(), p);
    return state == null ? new Completion(t(), p, 1, "", "", "", 10, s.guard.actor(), null) : state;
  }

  List<FileVersion> versions(String p) {
    return s.packages.files(t(), p).stream()
        .flatMap(f -> s.packages.versions(t(), f.id()).stream())
        .filter(v -> v.status().equals("sealed"))
        .sorted(Comparator.comparing(FileVersion::id))
        .toList();
  }

  String fingerprint(String p) {
    var pack = s.packages.find(t(), p);
    return s.json.hash(
        Arrays.asList(
            pack.version(),
            pack.dataJson(),
            versions(p),
            data.checklist(t(), p),
            post.results(t(), p),
            post.results(t(), p).stream()
                .map(r -> evaluationEvidence.stamp(t(), r.sessionId()))
                .toList(),
            post.control(t(), p),
            post.documents(t(), p),
            post.events(t(), p),
            post.issues(t(), p),
            finance.accounts(t(), p),
            finance.entries(t(), p),
            data.events(t(), p).stream().filter(e -> !e.dimension().equals("archive")).toList()));
  }

  List<Requirement> requirements(String p) {
    var pack = s.packages.find(t(), p);
    var files = s.packages.files(t(), p);
    var results = post.results(t(), p);
    boolean awarded = !results.isEmpty() && results.getFirst().kind().equals("award"),
        stopped = !results.isEmpty() && !awarded;
    var docs = post.documents(t(), p);
    var execution = s.data.documents(t(), p);
    List<Requirement> r = new ArrayList<>();
    r.add(
        new Requirement(
            "initiation",
            "委托与立项",
            "required",
            pack.status().equals("approved"),
            "建档审批及不可变审批快照自动关联"));
    r.add(
        new Requirement(
            "entrustment", "委托协议及服务范围", "conditional", false, "按实际委托安排核对协议、纸质位置与签署件，允许明确不适用"));
    r.add(
        new Requirement(
            "requirements",
            "需求与采购文件",
            "required",
            execution.stream()
                .anyMatch(d -> d.kind().equals("purchase") && d.status().equals("approved")),
            "需求与已审核采购文件版本，未自动认定签署"));
    r.add(
        new Requirement("announcement", "采购公告与发布凭证", "conditional", false, "依据本方式和本项目实际适用条款人工核对"));
    if (pack.procurementMethod().equals("邀请招标"))
      r.add(new Requirement("invitation", "邀请名单来源与逐家邀请凭证", "required", false, "本方式邀请形成和送达实际材料"));
    if (pack.procurementMethod().equals("单一来源"))
      r.add(
          new Requirement("single_basis", "单一来源适用论证与审批公示", "required", false, "适用性、论证审批与公示条件实际核对"));
    r.add(
        new Requirement(
            "opening",
            "接收、开启、独立审查与评审材料",
            stopped ? "conditional" : "required",
            false,
            "包含现场记录、职责意见及更正历史；原始响应材料保持原权限"));
    r.add(
        new Requirement(
            "report", "评审报告与签署材料", stopped ? "conditional" : "required", false, "内部审核不替代实际成员签署"));
    r.add(
        new Requirement(
            "result", "有权结果确认", "required", !results.isEmpty(), "推荐与采购人确认分离，失败终止亦保留有权依据"));
    r.add(
        new Requirement(
            "notice",
            "结果公告与通知办理凭证",
            awarded ? "required" : "conditional",
            awarded
                && docs.stream()
                    .anyMatch(d -> d.kind().equals("notice") && d.status().equals("delivered")),
            "按适用规则核对公告、签发和实际送达"));
    r.add(
        new Requirement(
            "contract",
            "正式合同及签署回传",
            "conditional",
            docs.stream().anyMatch(d -> d.kind().equals("contract") && d.status().equals("signed")),
            "双方正式合同、日期及本轮范本核对"));
    r.add(
        new Requirement(
            "finance",
            "收入成本与往来凭证",
            "optional",
            !finance.accounts(t(), p).isEmpty(),
            "费用未结清不阻断业务办结，后续账务与补档保留历史"));
    r.add(new Requirement("other", "其他及纸质补件", "optional", false, "按实际归档制度保留纸质位置、责任人、期限与电子副本"));
    return r;
  }

  boolean visible(String version) {
    var v = s.packages.version(t(), version);
    if (v == null) return false;
    var f = s.packages.file(t(), v.fileId());
    return f != null
        && files.visible(f)
        && s.guard.permissions().currentUserHas("buyer:agency:file:read");
  }

  List<ChecklistView> views(String p) {
    var rows = data.checklist(t(), p);
    return requirements(p).stream()
        .map(
            r -> {
              var row =
                  rows.stream().filter(v -> v.itemKey().equals(r.key())).findFirst().orElse(null);
              if (row == null)
                return new ChecklistView(
                    r.key(),
                    r.title(),
                    r.applicability(),
                    r.systemPresent(),
                    null,
                    r.systemPresent() ? "included" : "missing",
                    List.of(),
                    0,
                    "",
                    "unknown",
                    null,
                    null,
                    "");
              var d =
                  s.json.read(
                      s.json.tree(row.snapshotJson()).path("draft").toString(),
                      ChecklistDraft.class);
              var ids = d.fileVersionIds() == null ? List.<String>of() : d.fileVersionIds();
              var allowed = ids.stream().filter(this::visible).toList();
              boolean withheld = allowed.size() != ids.size();
              return new ChecklistView(
                  r.key(),
                  r.title(),
                  r.applicability(),
                  r.systemPresent(),
                  row.version(),
                  row.disposition(),
                  allowed,
                  ids.size() - allowed.size(),
                  withheld ? "受限纸质材料" : d.paperLocation(),
                  withheld ? "受限" : d.signingStatus(),
                  d.ownerId(),
                  d.deadline(),
                  withheld ? "含受限材料，按职责查看" : d.reason());
            })
        .toList();
  }

  List<String> blockers(String p) {
    List<String> out = new ArrayList<>();
    for (var r : views(p)) {
      if (r.disposition().equals("missing") && !r.applicability().equals("optional"))
        out.add(r.title() + "缺失或适用性尚未核对");
    }
    return out;
  }

  public Workspace workspace(String p) {
    access(p, false);
    var pack = s.packages.find(t(), p);
    String fp = fingerprint(p);
    var snapshots = data.snapshots(t(), p);
    String archive = pack.archiveCompletion();
    if (!snapshots.isEmpty() && !snapshots.getFirst().sourceFingerprint().equals(fp))
      archive = "accumulating";
    return new Workspace(
        state(p),
        pack.businessStatus(),
        archive,
        pack.financialStatus(),
        fp,
        views(p),
        snapshots.stream()
            .map(
                r ->
                    new SnapshotView(
                        r.id(),
                        r.ordinal(),
                        r.previousId(),
                        r.frozenHash(),
                        r.complete(),
                        !r.sourceFingerprint().equals(fp),
                        r.reason(),
                        r.createdBy(),
                        r.createdAt()))
            .toList(),
        blockers(p),
        data.events(t(), p));
  }

  @Transactional
  public Checklist save(String p, String key, ChecklistDraft d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对归档适用性与实际资料");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "archive-check:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, key, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Checklist.class);
    var requirement =
        requirements(p).stream()
            .filter(r -> r.key().equals(key))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("当前方式不存在此清单项"));
    if (!Set.of("included", "not_applicable", "missing")
        .contains(Objects.toString(d.disposition(), "")))
      throw new IllegalArgumentException("归档处理状态无效");
    s.text(d.reason(), 4000, true, "适用性或缺件说明");
    s.text(d.paperLocation(), 1000, false, "纸质位置");
    if (!Set.of("signed", "unsigned", "not_required", "unknown")
        .contains(Objects.toString(d.signingStatus(), "")))
      throw new IllegalArgumentException("签署状态必须与真实材料一致");
    var refs = d.fileVersionIds() == null ? List.<String>of() : d.fileVersionIds();
    if (refs.size() > 200 || new HashSet<>(refs).size() != refs.size())
      throw new IllegalArgumentException("电子副本数量或重复引用无效");
    for (var ref : refs) {
      var v = s.packages.version(t(), ref);
      if (v == null || !v.status().equals("sealed"))
        throw new IllegalArgumentException("电子副本必须引用已封存版本");
      var f = files.requireFile(v.fileId(), false);
      if (!f.packageId().equals(p)) throw new PermissionDeniedException("归档资料不属于本包");
      files.requireAccess(ref, false);
      verified(v);
    }
    String proofHash = "";
    if (d.disposition().equals("not_applicable")) {
      if (requirement.applicability().equals("required"))
        s.guard.permissions().require("buyer:agency:archive:exception");
      s.publicProjectSource(d.evidenceVersionId(), p, "脱敏归档适用性依据");
      proofHash = s.source(d.evidenceVersionId(), p).hash();
    }
    if (d.disposition().equals("included")
        && !requirement.systemPresent()
        && refs.isEmpty()
        && (d.paperLocation() == null || d.paperLocation().isBlank()))
      throw new IllegalArgumentException("标记已收集需有实际电子副本或明确纸质原件位置");
    if (d.disposition().equals("missing")) {
      if (d.ownerId() == null || d.deadline() == null)
        throw new IllegalArgumentException("缺件须指派责任人与补件期限");
      if (s.packages.members(t(), p).stream().noneMatch(m -> m.userId().equals(d.ownerId()))
          && !Objects.equals(s.packages.find(t(), p).ownerId(), d.ownerId()))
        throw new IllegalArgumentException("补件责任人须为项目成员");
    }
    var old =
        data.checklist(t(), p).stream()
            .filter(r -> r.itemKey().equals(key))
            .findFirst()
            .orElse(null);
    if (old == null && d.expectedVersion() != null && d.expectedVersion() != 0
        || old != null && !Objects.equals(d.expectedVersion(), old.version()))
      throw new AgencyConflictException("归档清单版本变化");
    String raw = s.json.write(Map.of("draft", d, "evidenceHash", proofHash));
    if (old == null) data.createChecklist(t(), p, key, d.disposition(), raw, s.guard.actor());
    else if (data.updateChecklist(t(), p, key, old.version(), d.disposition(), raw, s.guard.actor())
        != 1) throw new AgencyConflictException("归档清单版本变化");
    data.flags(t(), p, "archive", "accumulating");
    s.event(p, "archive_checklist_changed", key, null, Map.of("hash", hash(raw)), d.reason());
    var result =
        data.checklist(t(), p).stream()
            .filter(r -> r.itemKey().equals(key))
            .findFirst()
            .orElseThrow();
    s.remember(k, h, result);
    return result;
  }

  byte[] verified(FileVersion v) {
    if (v.contentSize() == null || v.contentSize() > 50_000_000)
      throw new IllegalStateException("文件超过本次归档技术容量50MB，须按制度分册办理");
    var a =
        attachments.listActiveByTenantAndOwner(t(), "agency_file_version", v.id()).stream()
            .filter(row -> row.id().equals(v.attachmentId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("归档文件元数据缺失"));
    var bytes = storage.get(a.storageKey()).data();
    if (bytes.length != v.contentSize() || !s.json.bytesHash(bytes).equals(v.hash()))
      throw new IllegalStateException("归档文件字节、长度与哈希不一致");
    return bytes;
  }

  @Transactional
  public SnapshotView freeze(String p, Freeze d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对归档版本、完整性和保留期限");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "archive-freeze:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, SnapshotView.class);
    s.text(d.reason(), 4000, true, "正式归档或更正原因");
    if (d.retentionYears() < 1 || d.retentionYears() > 100)
      throw new IllegalArgumentException("须按本单位制度配置保留年限1至100；系统不自动永久删除");
    String fp = fingerprint(p);
    if (!fp.equals(d.expectedFingerprint())) throw new AgencyConflictException("项目资料已变化，须重新核对归档");
    var history = data.snapshots(t(), p);
    if (!Objects.equals(history.isEmpty() ? null : history.getFirst().id(), d.expectedPreviousId()))
      throw new AgencyConflictException("正式档案版本变化");
    if (!history.isEmpty()) s.guard.permissions().require("buyer:agency:archive:correct");
    var blockers = blockers(p);
    if (d.complete() && !blockers.isEmpty())
      throw new IllegalStateException(String.join("；", blockers));
    var entries = new ArrayList<Entry>();
    long size = 0;
    for (var v : versions(p)) {
      size += v.contentSize() == null ? 0 : v.contentSize();
      if (size > 150_000_000 || entries.size() >= 1000)
        throw new IllegalStateException("单包归档技术上限150MB或1000版本，请分册办理");
      verified(v);
      var file = s.packages.file(t(), v.fileId());
      String signing = "unknown";
      for (var checklist : data.checklist(t(), p)) {
        var cd =
            s.json.read(
                s.json.tree(checklist.snapshotJson()).path("draft").toString(),
                ChecklistDraft.class);
        if (cd.fileVersionIds() != null && cd.fileVersionIds().contains(v.id()))
          signing = cd.signingStatus();
      }
      entries.add(
          new Entry(
              file.id(),
              v.id(),
              file.name(),
              file.category(),
              v.ordinal(),
              v.hash(),
              v.contentSize(),
              v.reason(),
              signing));
    }
    var pack = s.packages.find(t(), p);
    Map<String, Object> snap = new TreeMap<>();
    snap.put("packageId", p);
    snap.put("number", Objects.toString(pack.number(), ""));
    snap.put("method", pack.procurementMethod());
    snap.put("sourceFingerprint", fp);
    snap.put("entries", entries);
    snap.put("checklist", data.checklist(t(), p));
    snap.put("requirements", requirements(p));
    snap.put("postResults", post.results(t(), p));
    snap.put("postDocuments", post.documents(t(), p));
    snap.put(
        "financeAccountHashes",
        finance.accounts(t(), p).stream()
            .map(a -> Map.of("id", a.id(), "hash", a.frozenHash(), "status", a.status()))
            .toList());
    snap.put("completionEvents", data.events(t(), p));
    snap.put("blockers", blockers);
    snap.put("retentionYears", d.retentionYears());
    snap.put("complete", d.complete());
    String raw = s.json.write(snap), id = id("snapshot");
    var row =
        new Snapshot(
            id,
            t(),
            p,
            history.size() + 1,
            history.isEmpty() ? null : history.getFirst().id(),
            raw,
            hash(raw),
            fp,
            d.complete(),
            d.reason(),
            s.guard.actor(),
            null);
    data.createSnapshot(row);
    data.ensure(t(), p, s.guard.actor());
    var state = data.completion(t(), p);
    if (data.state(
            t(), p, state.version(), "archive", d.reason(), d.retentionYears(), s.guard.actor())
        != 1) throw new AgencyConflictException("完成状态版本变化");
    data.flags(t(), p, "archive", d.complete() ? "complete" : "accumulating");
    completionEvent(
        p,
        "archive",
        Map.of(
            "snapshotId",
            id,
            "hash",
            row.frozenHash(),
            "complete",
            d.complete(),
            "reason",
            d.reason()));
    var result =
        new SnapshotView(
            id,
            row.ordinal(),
            row.previousId(),
            row.frozenHash(),
            row.complete(),
            false,
            row.reason(),
            row.createdBy(),
            null);
    s.remember(k, h, result);
    return result;
  }

  void completionEvent(String p, String dimension, Object detail) {
    String raw = s.json.write(detail);
    data.event(
        new CompletionEvent(
            id("completion"), t(), p, dimension, raw, hash(raw), s.guard.actor(), null));
    s.event(p, "completion_" + dimension, p, null, Map.of("hash", hash(raw)), "独立完成状态办理");
  }

  @Transactional
  public Workspace changeState(String p, StateChange d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对完成状态与遗留事项");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "completion:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, d));
    var cached = s.remembered(k);
    if (cached != null) return workspace(p);
    if (!Set.of("business", "financial").contains(Objects.toString(d.dimension(), "")))
      throw new IllegalArgumentException("档案完成须通过正式归档完整性检查");
    s.guard.permissions().require("buyer:agency:completion:" + d.dimension());
    s.text(d.reason(), 4000, true, "办结依据");
    s.text(d.remainingMatters(), 8000, true, "遗留事项及责任安排（无亦需明确）");
    s.publicProjectSource(d.evidenceVersionId(), p, "脱敏办结确认凭证");
    String ph = s.source(d.evidenceVersionId(), p).hash();
    if (d.ownerId() == null
        || !s.packages.members(t(), p).stream().anyMatch(m -> m.userId().equals(d.ownerId()))
            && !Objects.equals(s.packages.find(t(), p).ownerId(), d.ownerId()))
      throw new IllegalArgumentException("须明确项目内遗留事项责任人");
    if (d.dimension().equals("business")) {
      if (!Set.of("closed", "in_progress").contains(Objects.toString(d.status(), "")))
        throw new IllegalArgumentException("业务状态无效");
      if (d.status().equals("closed") && post.results(t(), p).isEmpty())
        throw new IllegalStateException("须先有权登记成交、失败或终止结果后办结业务");
    } else {
      if (!Set.of("settled", "unsettled").contains(Objects.toString(d.status(), "")))
        throw new IllegalArgumentException("费用状态无效");
      if (d.status().equals("settled")) {
        var accounts = finance.accounts(t(), p);
        var entries = finance.entries(t(), p);
        var summary = AgencyFinancePolicy.summary(accounts, entries);
        if (accounts.stream()
                .anyMatch(a -> a.status().equals("draft") || a.status().equals("reviewing"))
            || entries.stream().anyMatch(e -> e.status().equals("reviewing"))
            || summary.outstanding().signum() != 0
            || summary.overpaid().signum() != 0
            || summary.costPayable().signum() != 0)
          throw new IllegalStateException("存在未核定、未收、超收、待付或调整事项，不能标记费用结清");
      }
    }
    data.ensure(t(), p, s.guard.actor());
    var state = data.completion(t(), p);
    s.expected(state.version(), d.expectedVersion());
    if (data.state(
            t(),
            p,
            state.version(),
            d.dimension(),
            d.reason(),
            state.retentionYears(),
            s.guard.actor())
        != 1) throw new AgencyConflictException("完成状态版本变化");
    data.flags(t(), p, d.dimension(), d.status());
    completionEvent(p, d.dimension(), Map.of("change", d, "evidenceHash", ph));
    s.remember(k, h, Map.of("applied", true));
    return workspace(p);
  }

  Snapshot snapshot(String p, String id) {
    var r = data.snapshot(t(), id);
    if (r == null || !r.packageId().equals(p)) throw new PermissionDeniedException("正式档案不属于当前项目");
    if (!hash(r.snapshotJson()).equals(r.frozenHash()))
      throw new IllegalStateException("正式档案快照指纹不一致");
    return r;
  }

  void zipFile(ZipOutputStream zip, String path, byte[] bytes) throws IOException {
    zip.putNextEntry(new ZipEntry(path));
    zip.write(bytes);
    zip.closeEntry();
  }

  public byte[] export(String p, String snapshotId) {
    return exportPackages(List.of(p), Map.of(p, snapshotId));
  }

  public byte[] exportGroup(String group) {
    s.guard.permissions().require("buyer:agency:archive:export");
    var scope = s.guard.scopes().currentUserDataScope();
    var packages =
        s.packages.groupPackages(
            t(), group, s.guard.actor(), !scope.restricted(), scope.departmentIds());
    if (packages.isEmpty()) throw new PermissionDeniedException("无可导出的所属项目采购包");
    if (packages.size() > 50) throw new IllegalStateException("集合导出技术上限50包，请分批");
    Map<String, String> ids = new TreeMap<>();
    for (var p : packages) {
      var list = data.snapshots(t(), p.id());
      if (list.isEmpty()) throw new IllegalStateException("集合中存在尚无正式归档快照的可见采购包");
      ids.put(p.id(), list.getFirst().id());
    }
    return exportPackages(ids.keySet().stream().toList(), ids);
  }

  byte[] exportPackages(List<String> packages, Map<String, String> snapshotIds) {
    s.guard.permissions().require("buyer:agency:archive:export");
    s.guard.permissions().require("buyer:agency:file:download");
    List<Map<String, Object>> manifests = new ArrayList<>();
    Set<String> used = new HashSet<>();
    long total = 0;
    try (var out = new ByteArrayOutputStream();
        var zip = new ZipOutputStream(out)) {
      for (var p : new LinkedHashSet<>(packages)) {
        access(p, false);
        var r = snapshot(p, snapshotIds.get(p));
        String prefix =
            AgencyArchiveNames.unique(
                    Objects.toString(s.packages.find(t(), p).number(), "采购包") + "-" + p, used)
                + "/";
        List<Map<String, Object>> rows = new ArrayList<>();
        int withheld = 0;
        for (var entry :
            s.json.read(s.json.tree(r.snapshotJson()).path("entries").toString(), Entry[].class)) {
          if (!visible(entry.versionId())) {
            withheld++;
            continue;
          }
          files.requireAccess(entry.versionId(), false);
          var version = s.packages.version(t(), entry.versionId());
          if (version == null || !version.hash().equals(entry.hash()))
            throw new IllegalStateException("归档引用的历史文件指纹不一致");
          total += entry.size();
          if (total > 150_000_000) throw new IllegalStateException("本次授权文件超过150MB技术上限，请分批导出");
          String name =
              prefix
                  + "files/"
                  + AgencyArchiveNames.unique("V" + entry.ordinal() + "-" + entry.name(), used);
          zipFile(zip, name, verified(version));
          rows.add(
              Map.of(
                  "path",
                  name,
                  "versionId",
                  entry.versionId(),
                  "ordinal",
                  entry.ordinal(),
                  "sha256",
                  entry.hash(),
                  "size",
                  entry.size(),
                  "source",
                  Objects.toString(entry.source(), ""),
                  "signingStatus",
                  entry.signingStatus()));
        }
        Map<String, Object> manifest = new TreeMap<>();
        manifest.put("packageId", p);
        manifest.put("snapshotId", r.id());
        manifest.put("ordinal", r.ordinal());
        manifest.put("snapshotHash", r.frozenHash());
        manifest.put("sourceStale", !r.sourceFingerprint().equals(fingerprint(p)));
        manifest.put("completeAtFreeze", r.complete());
        manifest.put("archivedBy", r.createdBy());
        manifest.put("archivedAt", r.createdAt());
        manifest.put(
            "retentionYears", s.json.tree(r.snapshotJson()).path("retentionYears").asInt());
        manifest.put("files", rows);
        manifest.put("withheldCount", withheld);
        manifest.put("scope", "只导出当前权限可见的快照文件；受限资料不披露名称；不表示目录已包含无权读取的完整项目档案");
        manifest.put("missingNotes", s.json.tree(r.snapshotJson()).path("blockers"));
        zipFile(
            zip,
            prefix + "manifest.json",
            s.json.write(manifest).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        manifests.add(manifest);
        s.event(
            p,
            "archive_downloaded",
            r.id(),
            null,
            Map.of(
                "snapshotHash",
                r.frozenHash(),
                "visibleFiles",
                rows.size(),
                "withheldCount",
                withheld),
            "按本次权限导出，逐文件验证实际字节，不降权打包受限资料");
      }
      zipFile(
          zip,
          "collection.json",
          s.json
              .write(Map.of("packages", manifests, "packageCount", manifests.size()))
              .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      zip.finish();
      return out.toByteArray();
    } catch (IOException ex) {
      throw new IllegalStateException("档案包生成失败，未返回部分成功包", ex);
    }
  }
}
