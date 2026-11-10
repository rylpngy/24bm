package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyEvaluationRecords.View;
import com.procurement.agency.domain.AgencyOpeningRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyOpeningMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyOpeningService {
  private final AgencyExecutionSupport s;
  private final AgencyOpeningMapper data;
  private final AgencyEvaluationService evaluations;
  private final AgencyFiles files;
  private final AgencyResponseAccess access;
  private final AgencyEvaluationControls controls;
  private final AgencyMethodProcedureService procedures;

  public AgencyOpeningService(
      AgencyExecutionSupport s,
      AgencyOpeningMapper data,
      AgencyEvaluationService evaluations,
      AgencyFiles files,
      AgencyResponseAccess access,
      AgencyEvaluationControls controls,
      AgencyMethodProcedureService procedures) {
    this.s = s;
    this.data = data;
    this.evaluations = evaluations;
    this.files = files;
    this.access = access;
    this.controls = controls;
    this.procedures = procedures;
  }

  private View round(String pkg, String id, boolean write) {
    if (write) s.write(pkg, "buyer:agency:evaluation:receipt:manage");
    var v = evaluations.roundForAssessment(pkg, id);
    if (v.config().members().stream().noneMatch(m -> m.userId().equals(s.guard.actor())))
      throw new PermissionDeniedException("仅冻结人员可访问现场材料");
    if (write) {
      controls.requireWritable(id);

      if (!access.custodian(id)) throw new PermissionDeniedException("非有权接收组织人员");
      if (!v.round().status().equals("frozen") || v.frozenBasisStale() || !v.blockers().isEmpty())
        throw new IllegalStateException("冻结规则或人员基础失效");
    }
    return v;
  }

  public Workspace workspace(String pkg, String id) {
    round(pkg, id, false);
    var p = data.plan(s.guard.tenant(), id);
    var opening = data.opening(s.guard.tenant(), id);
    var rows =
        data.receipts(s.guard.tenant(), id).stream()
            .filter(r -> access.visible(s.packages.file(s.guard.tenant(), r.fileId())))
            .map(
                r -> {
                  var f = s.packages.file(s.guard.tenant(), r.fileId());
                  return new ReceiptView(
                      r,
                      new FileView(f, s.packages.versions(s.guard.tenant(), f.id())),
                      access.readable(f));
                })
            .toList();
    return new Workspace(
        p,
        p == null ? null : s.json.read(p.configJson(), Config.class),
        rows,
        summary(opening),
        controls.writeBlockers(id));
  }

  public Summary summary(Opening o) {
    return o == null
        ? null
        : new Summary(
            o.id(),
            o.manifestHash(),
            Arrays.asList(s.json.read(o.subjectsJson(), Subject[].class)),
            o.openedAt(),
            o.evidenceVersionId(),
            o.note());
  }

  private void validate(Config c, String method) {
    if (c == null
        || c.cutoffAt() == null
        || c.notBefore() == null
        || c.notBefore().isBefore(c.cutoffAt())
        || c.minimumSubjects() < 1
        || c.minimumSubjects() > 30
        || c.items() == null
        || c.items().isEmpty()
        || c.items().size() > 20)
      throw new IllegalArgumentException("需明确截止、开启时间、1至30个对象门槛及1至20项材料清单");
    s.text(c.ruleBasis(), 2000, true, "清单与门槛适用依据");
    if ("单一来源".equals(method) && c.minimumSubjects() != 1)
      throw new IllegalArgumentException("单一来源不设置竞争性三家门槛，请按单一对象配置");
    Set<String> keys = new HashSet<>();
    for (var item : c.items()) {
      if (item == null
          || item.key() == null
          || !item.key().matches("[A-Za-z][A-Za-z0-9_-]{0,39}")
          || !keys.add(item.key())
          || item.readerRoles() == null
          || item.readerRoles().isEmpty()
          || new HashSet<>(item.readerRoles()).size() != item.readerRoles().size()
          || item.readerRoles().stream()
              .anyMatch(r -> r == null || !AgencyEvaluationRules.ROLES.contains(r)))
        throw new IllegalArgumentException("材料项编号或可读职责不合法");
      s.text(item.title(), 120, true, "材料项名称");
    }
    if (c.items().stream().noneMatch(Item::required))
      throw new IllegalArgumentException("至少有一项必需材料");
  }

  @Transactional
  public Plan savePlan(String pkg, String round, PlanSave d) {
    round(pkg, round, true);
    if (d == null) throw new IllegalArgumentException("缺少材料计划");
    validate(d.config(), s.packages.find(s.guard.tenant(), pkg).procurementMethod());
    s.text(d.reason(), 2000, true, "维护原因");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "opening-plan:" + d.idempotencyKey(), hash = s.begin(key, Arrays.asList(round, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Plan.class);
    var old = data.plan(s.guard.tenant(), round);
    if (old == null) {
      s.expected(0, d.expectedVersion());
      data.createPlan(s.guard.tenant(), round, pkg, s.json.write(d.config()), s.guard.actor());
    } else {
      s.expected(old.version(), d.expectedVersion());
      if (!old.status().equals("draft"))
        throw new IllegalStateException("接收计划已确认，不可更改门槛或清单，请另行组织轮次");
      if (data.savePlan(s.guard.tenant(), round, old.version(), s.json.write(d.config())) != 1)
        throw new IllegalStateException("计划版本冲突");
    }
    var result = data.plan(s.guard.tenant(), round);
    s.event(pkg, "opening_plan", round, old, result, d.reason());
    s.remember(key, hash, result);
    return result;
  }

  @Transactional
  public Plan confirmPlan(String pkg, String round, Confirm d) {
    var v = round(pkg, round, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对实际采购文件及适用清单后确认");
    s.text(d.reason(), 2000, true, "确认依据");
    String key = "opening-confirm:" + d.idempotencyKey();
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String hash = s.begin(key, Arrays.asList(round, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Plan.class);
    var p = requirePlan(round, "draft");
    s.expected(p.version(), d.expectedVersion());
    String method = s.packages.find(s.guard.tenant(), pkg).procurementMethod();
    validate(s.json.read(p.configJson(), Config.class), method);
    AgencyAssessmentStages.order(v.config(), method);
    if (data.planState(s.guard.tenant(), round, p.version(), "draft", "intake") != 1)
      throw new IllegalStateException("计划版本冲突");
    var result = data.plan(s.guard.tenant(), round);
    s.event(pkg, "opening_intake_confirmed", round, p, result, d.reason());
    s.remember(key, hash, result);
    return result;
  }

  private Plan requirePlan(String round, String status) {
    var p = data.plan(s.guard.tenant(), round);
    if (p == null || !p.status().equals(status)) throw new IllegalStateException("当前材料计划状态不可操作");
    return p;
  }

  @Transactional
  public ReceiptView receive(String pkg, String round, ReceiptDraft d) {
    round(pkg, round, true);
    s.guard.permissions().require("buyer:agency:file:manage");
    var p = requirePlan(round, "intake");
    var config = s.json.read(p.configJson(), Config.class);
    if (d == null) throw new IllegalArgumentException("缺少接收登记");
    s.text(d.fileName(), 200, true, "材料文件名");
    if (d.fileName().contains("/") || d.fileName().contains("\\"))
      throw new IllegalArgumentException("文件名无效");
    s.text(d.sourceNote(), 2000, true, "材料来源");
    s.text(d.note(), 2000, false, "接收说明");
    s.text(d.lateEntryReason(), 2000, false, "补录依据");
    if (d.receivedAt() == null
        || d.receivedAt().isAfter(OffsetDateTime.now())
        || !Set.of("paper_scan", "electronic_copy")
            .contains(Objects.toString(d.originalType(), "")))
      throw new IllegalArgumentException("须记录实际接收时间及原件类型");
    if (OffsetDateTime.now().isAfter(config.cutoffAt())
        && !d.receivedAt().isAfter(config.cutoffAt()))
      s.text(d.lateEntryReason(), 2000, true, "截止后补录须填写真实接收时间依据");
    if (config.items().stream().noneMatch(i -> i.key().equals(d.itemKey())))
      throw new IllegalArgumentException("材料项不属于已确认清单");
    var participant = s.data.participation(s.guard.tenant(), d.participationId());
    if (participant == null || !pkg.equals(participant.packageId()))
      throw new IllegalArgumentException("对象不属于当前采购包");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "response-receive:" + d.idempotencyKey(),
        hash = s.begin(key, Arrays.asList(round, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, ReceiptView.class);
    var receipts = data.receipts(s.guard.tenant(), round);
    if (receipts.size() >= 1200) throw new IllegalStateException("本轮最多保留1200条材料接收登记");
    if (receipts.stream()
        .anyMatch(
            r ->
                r.status().equals("received")
                    && r.participationId().equals(d.participationId())
                    && r.itemKey().equals(d.itemKey())))
      throw new IllegalStateException("本对象的材料项已有接收登记，先撤回错误登记再重新接收");
    String file = "agency-file-" + UUID.randomUUID(), id = "agency-receipt-" + UUID.randomUUID();
    s.packages.createFile(
        s.guard.tenant(),
        file,
        pkg,
        d.fileName(),
        "response_material",
        "restricted",
        s.guard.actor());
    s.packages.createVersion(
        s.guard.tenant(), "agency-fv-" + UUID.randomUUID(), file, 1, s.guard.actor(), "受控响应材料首次接收");
    var row =
        new Receipt(
            id,
            s.guard.tenant(),
            pkg,
            round,
            d.participationId(),
            d.itemKey(),
            file,
            d.receivedAt(),
            d.originalType(),
            d.sourceNote(),
            s.str(d.note()),
            s.str(d.lateEntryReason()),
            "received",
            1,
            s.guard.actor(),
            null,
            "");
    data.createReceipt(row);
    var result =
        new ReceiptView(
            data.receipt(s.guard.tenant(), id),
            new FileView(
                s.packages.file(s.guard.tenant(), file),
                s.packages.versions(s.guard.tenant(), file)),
            false);
    s.event(
        pkg,
        "response_received",
        id,
        null,
        Map.of("round", round, "receipt", id, "item", d.itemKey()),
        "材料接收登记，不代表资格或有效响应结论");
    s.remember(key, hash, result);
    return result;
  }

  @Transactional
  public Receipt withdraw(String pkg, String round, String id, Confirm d) {
    round(pkg, round, true);
    requirePlan(round, "intake");
    if (d == null) throw new IllegalArgumentException("缺少撤回信息");
    var r = data.receipt(s.guard.tenant(), id);
    if (r == null || !r.roundId().equals(round)) throw new IllegalArgumentException("接收登记不存在");
    s.text(d.reason(), 2000, true, "撤回原因");
    s.expected(r.version(), d.expectedVersion());
    if (data.withdraw(s.guard.tenant(), id, r.version(), d.reason()) != 1)
      throw new IllegalStateException("登记已撤回或版本冲突");
    s.event(pkg, "response_receipt_withdrawn", id, null, Map.of("receipt", id), d.reason());
    return data.receipt(s.guard.tenant(), id);
  }

  public Preview preview(String pkg, String round, List<String> ids) {
    round(pkg, round, false);
    s.guard.permissions().require("buyer:agency:evaluation:opening");
    if (!access.custodian(round)) throw new PermissionDeniedException("非有权开启人员");
    var p = requirePlan(round, "intake");
    var cfg = s.json.read(p.configJson(), Config.class);
    List<String> issues = new ArrayList<>();
    List<Subject> subjects = new ArrayList<>();
    List<Manifest> manifest = new ArrayList<>();
    if (ids == null || ids.isEmpty() || ids.size() > 30 || new HashSet<>(ids).size() != ids.size())
      throw new IllegalArgumentException("请选择1至30个不同对象");
    if (ids.size() < cfg.minimumSubjects()) issues.add("对象数量不足已确认门槛，禁止自动切换方式或放宽条件");
    if ("单一来源".equals(s.packages.find(s.guard.tenant(), pkg).procurementMethod())
        && ids.size() != 1) issues.add("单一来源按单一对象登记，不建立竞争性对象集合");
    if (OffsetDateTime.now().isBefore(cfg.cutoffAt())
        || OffsetDateTime.now().isBefore(cfg.notBefore())) issues.add("尚未到达截止或允许开启时间");
    var all = data.receipts(s.guard.tenant(), round);
    for (String id : ids) {
      var participant = s.data.participation(s.guard.tenant(), id);
      if (participant == null || !pkg.equals(participant.packageId()))
        throw new IllegalArgumentException("对象不属于当前采购包");
      subjects.add(new Subject(id, participant.supplierName()));
      for (var item : cfg.items()) {
        var receipt =
            all.stream()
                .filter(
                    r ->
                        r.participationId().equals(id)
                            && r.itemKey().equals(item.key())
                            && r.status().equals("received"))
                .findFirst();
        if (receipt.isEmpty()) {
          if (item.required()) issues.add(participant.supplierName() + " 缺少必需材料：" + item.title());
          continue;
        }
        var r = receipt.get();
        if (r.receivedAt().isAfter(cfg.cutoffAt())) {
          issues.add(participant.supplierName() + " 的材料实际接收晚于截止：" + item.title());
          continue;
        }
        var versions = s.packages.versions(s.guard.tenant(), r.fileId());
        var v = versions.getFirst();
        if (!v.status().equals("sealed")) {
          issues.add(participant.supplierName() + " 的材料尚未封存：" + item.title());
          continue;
        }
        manifest.add(
            new Manifest(
                r.id(),
                id,
                item.key(),
                r.fileId(),
                v.id(),
                v.attachmentId(),
                s.packages.file(s.guard.tenant(), r.fileId()).name(),
                v.hash(),
                item.readerRoles()));
      }
    }
    String fingerprint =
        s.json.hash(
            Map.of(
                "round",
                round,
                "planVersion",
                p.version(),
                "subjects",
                subjects,
                "manifest",
                manifest));
    return new Preview(p.version(), subjects, manifest, issues, fingerprint);
  }

  private void verify(Manifest m) {
    var metadata =
        files
            .attachments()
            .listActiveByTenantAndOwner(s.guard.tenant(), "agency_file_version", m.fileVersionId())
            .stream()
            .filter(a -> a.id().equals(m.attachmentId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("材料元数据缺失"));
    var bytes = files.storage().get(metadata.storageKey()).data();
    if (!s.json.bytesHash(bytes).equals(m.hash()))
      throw new IllegalStateException("响应材料实际字节与封存哈希不一致");
    files.safety().inspect(metadata.fileName(), bytes);
  }

  @Transactional
  public Summary open(String pkg, String round, Open d) {
    round(pkg, round, true);
    s.guard.permissions().require("buyer:agency:evaluation:opening");
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对实际开启与材料范围后确认");
    s.text(d.note(), 2000, true, "开启核对说明");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "response-open:" + d.idempotencyKey(),
        hash = s.begin(key, Arrays.asList(round, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Summary.class);
    var p = requirePlan(round, "intake");
    s.expected(p.version(), d.expectedVersion());
    var cfg = s.json.read(p.configJson(), Config.class);
    var preview = preview(pkg, round, d.participationIds());
    if (!preview.fingerprint().equals(d.previewFingerprint()))
      throw new com.procurement.agency.domain.AgencyConflictException("材料或选择范围已变化，请重新生成开启预览");
    if (!preview.blockers().isEmpty())
      throw new IllegalStateException(String.join("；", preview.blockers()));
    if (d.openedAt() == null
        || d.openedAt().isAfter(OffsetDateTime.now())
        || d.openedAt().isBefore(cfg.notBefore())
        || d.openedAt().isBefore(cfg.cutoffAt()))
      throw new IllegalArgumentException("实际开启时间须在允许开启时间之后且不晚于当前时间");
    procedures.openingGate(pkg, round, d.participationIds(), d.openedAt());
    s.publicProjectSource(d.evidenceVersionId(), pkg, "正式开启凭证");
    var evidence = s.source(d.evidenceVersionId(), pkg);
    preview.manifest().forEach(this::verify);
    var o =
        new Opening(
            "agency-opening-" + UUID.randomUUID(),
            s.guard.tenant(),
            pkg,
            round,
            s.json.write(preview.manifest()),
            s.json.hash(preview.manifest()),
            s.json.write(preview.subjects()),
            d.openedAt(),
            d.evidenceVersionId(),
            evidence.hash(),
            d.note(),
            s.guard.actor(),
            null);
    data.createOpening(o);
    if (data.planState(s.guard.tenant(), round, p.version(), "intake", "opened") != 1)
      throw new IllegalStateException("开启状态冲突");
    var result = summary(data.opening(s.guard.tenant(), round));
    s.event(
        pkg,
        "responses_formally_opened",
        o.id(),
        null,
        Map.of(
            "round", round, "manifestHash", o.manifestHash(), "count", preview.manifest().size()),
        d.note());
    s.remember(key, hash, result);
    return result;
  }

  public Map<String, String> download(String pkg, String round, String receiptId) {
    round(pkg, round, false);
    var r = data.receipt(s.guard.tenant(), receiptId);
    if (r == null || !r.roundId().equals(round)) throw new IllegalArgumentException("接收登记不存在");
    var v = s.packages.versions(s.guard.tenant(), r.fileId()).getFirst();
    files.access().requireDownloadAccess(v.id());
    return Map.of(
        "attachmentId",
        v.attachmentId(),
        "sha256",
        v.hash(),
        "name",
        s.packages.file(s.guard.tenant(), r.fileId()).name());
  }
}
