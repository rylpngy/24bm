package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyFinalQuoteMapper;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFinalQuoteService {
  private final AgencyAssessmentContext c;
  private final AgencyAssessmentStages stages;
  private final AgencyFinalQuoteMapper data;
  private final AgencyFiles files;
  private final AgencyDiscussionService discussions;
  private final AgencyRequirementChangeService changes;

  public AgencyFinalQuoteService(
      AgencyAssessmentContext c,
      AgencyAssessmentStages stages,
      AgencyFinalQuoteMapper data,
      AgencyFiles files,
      AgencyDiscussionService discussions,
      AgencyRequirementChangeService changes) {
    this.c = c;
    this.stages = stages;
    this.data = data;
    this.files = files;
    this.discussions = discussions;
    this.changes = changes;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:final:read");
    if (write) c.s.guard.permissions().require("buyer:agency:evaluation:final:manage");
    AgencyFinalQuotePolicy.method(c.s.packages.find(tenant(), pkg).procurementMethod());
    return a;
  }

  private List<Subject> eligible(AgencyAssessmentContext.Access a) {
    if (stages.released(a.session().id(), "evaluation") == null)
      throw new IllegalStateException("须先完成前置审查并有依据地开放评审或专业协商阶段");
    for (var member : a.config().members())
      if (c.data.corrections(tenant(), a.session().id(), member.userId()).stream()
          .anyMatch(r -> r.status().equals("processing")))
        throw new IllegalStateException("存在待审更正，不能发起最后报价");
    return stages.subjects(a.session().id(), "evaluation", a.subjects());
  }

  private List<Subject> subjects(Campaign row) {
    return Arrays.asList(c.s.json.read(row.subjectsJson(), Subject[].class));
  }

  private Campaign require(String session) {
    var row = data.campaign(tenant(), session);
    if (row == null) throw new IllegalStateException("尚未发起最后报价");
    return row;
  }

  private void collecting(Campaign row) {
    if (!row.status().equals("collecting"))
      throw new IllegalStateException("最后报价已确认并锁定；变更须按异常程序另行组织");
  }

  private void bump(Campaign row) {
    if (data.bump(tenant(), row.id(), row.version()) != 1)
      throw new AgencyConflictException("最后报价登记版本已变化，请重新核对");
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var row = data.campaign(tenant(), session);
    List<String> blockers = new ArrayList<>(a.blockers());
    List<Subject> candidates = List.of();
    try {
      candidates = eligible(a);
    } catch (IllegalStateException e) {
      blockers.add(e.getMessage());
    }
    var discussionGate = discussions.gate(a);
    return new Workspace(
        row,
        candidates,
        row == null ? List.of() : subjects(row),
        row == null
            ? List.of()
            : data.receipts(tenant(), row.id()).stream().map(this::view).toList(),
        row == null || row.decisionsJson() == null
            ? List.of()
            : Arrays.asList(c.s.json.read(row.decisionsJson(), Result[].class)),
        row == null ? "" : fingerprint(row),
        blockers,
        discussionGate.mode(),
        discussionGate.fingerprint(),
        discussionGate.blockers());
  }

  private String fingerprint(Campaign row) {
    return c.s.json.hash(
        Arrays.asList(
            row.version(), data.receipts(tenant(), row.id()).stream().map(this::view).toList()));
  }

  private ReceiptView view(Receipt row) {
    return new ReceiptView(
        row,
        new FileView(
            c.s.packages.file(tenant(), row.fileId()),
            c.s.packages.versions(tenant(), row.fileId())));
  }

  @Transactional
  public Campaign start(String pkg, String session, Start d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对最终需求、最终响应条件、参与者及通知凭证");
    AgencyFinalQuotePolicy.window(d.initiatedAt(), d.cutoffAt(), OffsetDateTime.now());
    AgencyFinalQuotePolicy.afterOpening(d.initiatedAt(), a.session().openedAt());
    c.s.text(d.reason(), 2000, true, "最后报价发起依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-start:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Campaign.class);
    if (data.campaign(tenant(), session) != null)
      throw new IllegalStateException("本任务已发起最后报价，不能重置截止或覆盖历史");
    var candidates = eligible(a);
    var ids = d.participationIds();
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 30
        || new HashSet<>(ids).size() != ids.size()
        || !candidates.stream().map(Subject::participationId).toList().containsAll(ids))
      throw new IllegalArgumentException("须从已开放评审对象中明确选择1至30个不同参与者");
    var exclusions = d.exclusions() == null ? Map.<String, String>of() : d.exclusions();
    var excluded =
        candidates.stream().map(Subject::participationId).filter(id -> !ids.contains(id)).toList();
    if (!exclusions.keySet().equals(new HashSet<>(excluded)))
      throw new IllegalArgumentException("未进入最后报价的对象须逐家记录处理依据，不接受额外对象");
    for (String reason : exclusions.values()) c.s.text(reason, 2000, true, "未进入最后报价的处理依据");
    var discussionManifest =
        discussions.finalManifest(a, ids, d.discussionFingerprint(), d.initiatedAt());
    var discussionGate = discussions.gate(a);
    var changeRefs =
        changes.finalReferences(a, d.requirementsVersionId(), d.initiatedAt(), d.cutoffAt());
    c.s.publicProjectSource(d.requirementsVersionId(), pkg, "脱敏最终需求核对依据");
    c.s.publicProjectSource(d.noticeVersionId(), pkg, "脱敏发起及通知凭证");
    var requirements = c.s.source(d.requirementsVersionId(), pkg);
    var notice = c.s.source(d.noticeVersionId(), pkg);
    var selected = candidates.stream().filter(s -> ids.contains(s.participationId())).toList();
    String selectedJson = c.s.json.write(selected);
    String scope =
        c.s.json.hash(
            Arrays.asList(
                a.session().roundHash(),
                selected,
                exclusions,
                stages.released(session, "evaluation")));
    data.create(
        new Campaign(
            "agency-final-" + UUID.randomUUID(),
            tenant(),
            session,
            pkg,
            "collecting",
            1,
            d.cutoffAt(),
            d.initiatedAt(),
            selectedJson,
            scope,
            c.s.json.write(exclusions),
            d.requirementsVersionId(),
            requirements.hash(),
            d.noticeVersionId(),
            notice.hash(),
            d.reason(),
            c.s.guard.actor(),
            null,
            null,
            null,
            null,
            null,
            null,
            c.s.json.write(discussionManifest),
            discussionGate.fingerprint(),
            changeRefs.isEmpty() ? null : c.s.json.write(changeRefs)));
    var saved = require(session);
    c.s.event(
        pkg,
        "final_quote_started",
        saved.id(),
        null,
        Map.of("scopeHash", scope, "cutoff", d.cutoffAt().toString()),
        d.reason());
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public ReceiptView receive(String pkg, String session, Receive d) {
    access(pkg, session, true);
    var row = require(session);
    if (d == null) throw new IllegalArgumentException("缺少最后报价接收信息");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-receive:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, ReceiptView.class);
    collecting(row);
    if (subjects(row).stream().noneMatch(s -> s.participationId().equals(d.participationId())))
      throw new IllegalArgumentException("对象不在本次最后报价范围");
    AgencyQuoteService.amount(d.amount());
    if (d.currency() == null || !d.currency().equals(c.s.packages.find(tenant(), pkg).currency()))
      throw new IllegalArgumentException("最后报价币种须与采购包币种一致");
    AgencyFinalQuotePolicy.received(row, d, OffsetDateTime.now());
    c.s.text(d.fileName(), 200, true, "最终响应及报价材料文件名");
    if (d.fileName().contains("/") || d.fileName().contains("\\"))
      throw new IllegalArgumentException("文件名无效");
    if (!Set.of("paper_scan", "electronic_copy").contains(Objects.toString(d.originalType(), "")))
      throw new IllegalArgumentException("须明确原件类型");
    c.s.text(d.sourceNote(), 2000, true, "来源及最终响应说明");
    c.s.text(d.lateEntryReason(), 2000, false, "补录依据");
    var receipts = data.receipts(tenant(), row.id());
    if (receipts.size() >= 300) throw new IllegalStateException("本任务最多保留300条最后报价接收登记");
    if (receipts.stream()
        .anyMatch(
            r -> r.status().equals("received") && r.participationId().equals(d.participationId())))
      throw new IllegalStateException("已有接收登记；错误登记须撤回后追加，不覆盖原记录");
    String file = "agency-file-" + UUID.randomUUID();
    c.s.packages.createFile(
        tenant(), file, pkg, d.fileName(), "final_quote_material", "restricted", c.s.guard.actor());
    c.s.packages.createVersion(
        tenant(), "agency-fv-" + UUID.randomUUID(), file, 1, c.s.guard.actor(), "线下最后报价及最终响应接收");
    data.receive(
        new Receipt(
            "agency-final-receipt-" + UUID.randomUUID(),
            tenant(),
            row.id(),
            d.participationId(),
            file,
            d.amount(),
            d.currency(),
            d.receivedAt(),
            d.originalType(),
            d.sourceNote(),
            c.s.str(d.lateEntryReason()),
            "received",
            null,
            c.s.guard.actor(),
            null));
    bump(row);
    var saved = view(data.receiptFile(tenant(), file));
    c.s.event(
        pkg,
        "final_quote_received",
        saved.receipt().id(),
        null,
        Map.of("campaign", row.id(), "file", file),
        "接收线下最终响应副本，不代表供应商身份或有效性确认");
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Receipt withdraw(String pkg, String session, String id, Withdraw d) {
    access(pkg, session, true);
    var row = require(session);
    if (d == null) throw new IllegalArgumentException("缺少撤回信息");
    c.s.text(d.reason(), 2000, true, "撤回原因");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-withdraw:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, id, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Receipt.class);
    collecting(row);
    c.s.expected(row.version(), d.expectedVersion());
    var r =
        data.receipts(tenant(), row.id()).stream()
            .filter(x -> x.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("接收登记不存在"));
    if (data.withdraw(tenant(), id, d.reason()) != 1) throw new IllegalStateException("登记已撤回");
    bump(row);
    c.s.event(pkg, "final_quote_withdrawn", id, null, Map.of("receipt", id), d.reason());
    var saved = data.receiptFile(tenant(), r.fileId());
    c.s.remember(key, hash, saved);
    return saved;
  }

  FileVersion verified(Receipt r) {
    var versions = c.s.packages.versions(tenant(), r.fileId());
    if (versions.size() != 1 || !versions.getFirst().status().equals("sealed"))
      throw new IllegalStateException("最终响应及最后报价副本须完成上传、检查和封存");
    var v = versions.getFirst();
    var metadata =
        files
            .attachments()
            .listActiveByTenantAndOwner(tenant(), "agency_file_version", v.id())
            .stream()
            .filter(a -> a.id().equals(v.attachmentId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("最终响应附件元数据缺失"));
    var bytes = files.storage().get(metadata.storageKey()).data();
    if (!c.s.json.bytesHash(bytes).equals(v.hash()))
      throw new IllegalStateException("最终响应实际字节与封存哈希不一致");
    files.safety().inspect(metadata.fileName(), bytes);
    return v;
  }

  @Transactional
  public Campaign confirm(String pkg, String session, Confirm d) {
    access(pkg, session, true);
    var row = require(session);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工逐家核对最终响应、实际接收时点及异常处理");
    c.s.text(d.note(), 2000, true, "确认及后续处理依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-confirm:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Campaign.class);
    collecting(row);
    c.s.expected(row.version(), d.expectedVersion());
    if (!Objects.equals(fingerprint(row), d.receiptFingerprint()))
      throw new AgencyConflictException("材料版本或登记已变化，请重新逐家核对");
    if (OffsetDateTime.now().isBefore(row.cutoffAt()))
      throw new IllegalStateException("截止前不能确认并开放最后报价材料");
    var ids =
        subjects(row).stream()
            .map(Subject::participationId)
            .collect(java.util.stream.Collectors.toSet());
    if (d.decisions() == null
        || d.decisions().size() != ids.size()
        || d.decisions().stream().anyMatch(x -> x == null)
        || !d.decisions().stream()
            .map(Decision::participationId)
            .collect(java.util.stream.Collectors.toSet())
            .equals(ids)) throw new IllegalArgumentException("须对锁定范围的每个对象作唯一处理，不能漏记未提交者");
    var receipts = data.receipts(tenant(), row.id());
    List<Result> results = new ArrayList<>();
    for (var decision : d.decisions()) {
      var receipt =
          receipts.stream()
              .filter(
                  r ->
                      r.status().equals("received")
                          && r.participationId().equals(decision.participationId()))
              .findFirst()
              .orElse(null);
      AgencyFinalQuotePolicy.decision(decision, receipt, row);
      FileVersion v = decision.status().equals("accepted") ? verified(receipt) : null;
      results.add(
          new Result(
              decision.participationId(),
              decision.receiptId(),
              decision.status(),
              decision.reason(),
              v == null ? null : v.id(),
              v == null ? null : v.hash(),
              v == null ? null : receipt.amount(),
              v == null ? null : receipt.currency()));
    }
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏最后报价确认及异常处理凭证");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    String json = c.s.json.write(results);
    if (data.confirm(
            tenant(), row.id(), row.version(), d.evidenceVersionId(), proof.hash(), json, d.note())
        != 1) throw new AgencyConflictException("最后报价已变化，请重新核对");
    var saved = require(session);
    c.s.event(
        pkg,
        "final_quote_confirmed",
        row.id(),
        null,
        Map.of("decisionsHash", c.s.json.hash(results)),
        "逐家确认最后报价及异常处理；不自动恢复评审、排名或形成成交结果");
    c.s.remember(key, hash, saved);
    return saved;
  }
}
