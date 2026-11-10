package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyEvaluationRecords.View;
import com.procurement.agency.domain.AgencyIncidentRecords.*;
import com.procurement.agency.infrastructure.AgencyIncidentMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyIncidentService {
  private final AgencyExecutionSupport s;
  private final AgencyEvaluationService evaluations;
  private final AgencyDirectory directory;
  private final AgencyIncidentMapper data;
  private final AgencyEvaluationControls controls;

  public AgencyIncidentService(
      AgencyExecutionSupport s,
      AgencyEvaluationService evaluations,
      AgencyDirectory directory,
      AgencyIncidentMapper data,
      AgencyEvaluationControls controls) {
    this.s = s;
    this.evaluations = evaluations;
    this.directory = directory;
    this.data = data;
    this.controls = controls;
  }

  private View access(String pkg, String round, boolean write, boolean details) {
    if (write) {
      s.guard.require(pkg, false);
      s.packages.lock(s.guard.tenant(), pkg);
    }
    var v = evaluations.roundForAssessment(pkg, round);
    evaluations.snapshot(pkg, round);
    if (directory.people().stream().noneMatch(u -> u.id().equals(s.guard.actor()))
        || v.config().members().stream().noneMatch(m -> m.userId().equals(s.guard.actor())))
      throw new PermissionDeniedException("仅当前有效的冻结人员可查看轮次控制状态");
    if (details) {
      s.guard.permissions().require("buyer:agency:evaluation:incident:read");
      s.guard.permissions().require("buyer:agency:evaluation:organize");
      if (v.config().members().stream()
          .noneMatch(
              m ->
                  m.userId().equals(s.guard.actor())
                      && (m.roles().contains("organizer") || m.roles().contains("leader"))))
        throw new PermissionDeniedException("仅冻结组织人员或组长可处理异常明细");
    }
    return v;
  }

  private void manage() {
    s.guard.permissions().require("buyer:agency:evaluation:incident:manage");
  }

  private void controlPermission() {
    s.guard.permissions().require("buyer:agency:evaluation:control:manage");
  }

  private String fingerprint(String round) {
    return s.json.hash(data.incidents(s.guard.tenant(), round));
  }

  private void ensure(String pkg, String round) {
    data.ensure(s.guard.tenant(), round, pkg, s.guard.actor());
  }

  private List<String> resumeBlockers(String pkg, View v) {
    List<String> out = new ArrayList<>();
    var p = s.packages.find(s.guard.tenant(), pkg);
    if (!p.status().equals("approved")
        || p.workflowId() != null
        || !p.operatingMode().equals("half")) out.add("建档或变更状态不允许恢复");
    if (!v.round().status().equals("frozen") || v.frozenBasisStale() || !v.blockers().isEmpty())
      out.add("冻结规则、文件或人员基线不再有效，不能通过恢复按钮绕过");
    for (var i : data.incidents(s.guard.tenant(), v.round().id()))
      if (i.status().equals("open")) out.add("仍有未处理异常，须全部处理并复核恢复条件");
      else if (!s.json
          .read(i.resolutionJson(), ResolutionSnapshot.class)
          .outcome()
          .equals("continue_ready")) out.add("本轮存在另行组织或停止结论，不能恢复本轮");
    return out.stream().distinct().toList();
  }

  public Status status(String pkg, String round) {
    access(pkg, round, false, false);
    var c = controls.control(round);
    return new Status(
        c.state(),
        c.version(),
        (int)
            data.incidents(s.guard.tenant(), round).stream()
                .filter(i -> i.status().equals("open"))
                .count(),
        controls.writeBlockers(round));
  }

  public Workspace workspace(String pkg, String round) {
    var v = access(pkg, round, false, true);
    return new Workspace(
        controls.control(round),
        fingerprint(round),
        data.incidents(s.guard.tenant(), round),
        data.events(s.guard.tenant(), round),
        resumeBlockers(pkg, v));
  }

  private Control record(
      String pkg,
      String round,
      String next,
      String action,
      String incident,
      String proof,
      String proofHash,
      String reason) {
    var old = controls.control(round);
    if (data.state(s.guard.tenant(), round, old.version(), next, s.guard.actor()) != 1)
      throw new AgencyConflictException("轮次控制版本已变化，请重新核对");
    var saved = controls.control(round);
    data.event(
        new Event(
            "agency-control-event-" + UUID.randomUUID(),
            s.guard.tenant(),
            round,
            saved.version(),
            action,
            old.state(),
            saved.state(),
            incident,
            fingerprint(round),
            proof,
            proofHash,
            reason,
            s.guard.actor(),
            null));
    s.event(
        pkg,
        "evaluation_control_changed",
        round,
        Map.of("state", old.state(), "version", old.version()),
        Map.of("state", saved.state(), "version", saved.version()),
        "轮次异常及控制更新，业务事件不包含异常明细或个人意见");
    return saved;
  }

  @Transactional
  public Incident create(String pkg, String round, Create d) {
    access(pkg, round, true, true);
    manage();
    AgencyIncidentPolicy.create(d, OffsetDateTime.now());
    if (d.effect().equals("pause")) controlPermission();
    s.text(d.title(), 200, true, "异常标题");
    s.text(d.impactScope(), 2000, true, "异常影响范围");
    s.text(d.description(), 4000, true, "异常事实说明");
    s.text(d.restorationConditions(), 2000, true, "恢复或处理条件");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "incident-create:" + d.idempotencyKey(),
        hash = s.begin(key, Arrays.asList(round, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Incident.class);
    if (controls.control(round).state().equals("terminated"))
      throw new IllegalStateException("本轮已停止，仅保留原异常后续处理记录");
    Set<String> authorized = new HashSet<>();
    var p = s.packages.find(s.guard.tenant(), pkg);
    authorized.add(p.ownerId());
    authorized.add(p.createdBy());
    s.packages.members(s.guard.tenant(), pkg).forEach(m -> authorized.add(m.userId()));
    var owner =
        directory.people().stream()
            .filter(u -> u.id().equals(d.responsibleId()) && authorized.contains(u.id()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("责任人须为当前有效且已获采购包授权的账号"));
    if (data.incidents(s.guard.tenant(), round).size() >= 300)
      throw new IllegalStateException("本轮最多保留300条异常记录");
    s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏异常登记凭证");
    var proof = s.source(d.evidenceVersionId(), pkg);
    ensure(pkg, round);
    String id = "agency-incident-" + UUID.randomUUID();
    data.create(
        new Incident(
            id,
            s.guard.tenant(),
            round,
            pkg,
            d.kind(),
            d.title(),
            d.occurredAt(),
            d.responsibleId(),
            owner.name(),
            d.impactScope(),
            d.description(),
            d.evidenceVersionId(),
            proof.hash(),
            d.effect(),
            d.restorationConditions(),
            "open",
            1,
            s.guard.actor(),
            null,
            null,
            null,
            null));
    String next = d.effect().equals("pause") ? "paused" : controls.control(round).state();
    record(
        pkg,
        round,
        next,
        "incident_registered",
        id,
        d.evidenceVersionId(),
        proof.hash(),
        "登记异常及明确影响决定");
    var saved = data.incident(s.guard.tenant(), id);
    s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Incident resolve(String pkg, String round, String id, Resolution d) {
    access(pkg, round, true, true);
    manage();
    var incident = data.incident(s.guard.tenant(), id);
    if (incident == null || !incident.roundId().equals(round))
      throw new IllegalArgumentException("异常不存在或不属于当前轮次");
    AgencyIncidentPolicy.resolution(incident, d, OffsetDateTime.now());
    s.text(d.note(), 4000, true, "处理结论及条件核对说明");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    if (!d.outcome().equals("continue_ready")) controlPermission();
    String key = "incident-resolve:" + d.idempotencyKey(),
        hash = s.begin(key, Arrays.asList(round, id, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Incident.class);
    s.expected(incident.version(), d.expectedVersion());
    s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏异常处理及恢复条件凭证");
    var proof = s.source(d.evidenceVersionId(), pkg);
    var snapshot =
        new ResolutionSnapshot(
            d.handledAt(), d.outcome(), d.evidenceVersionId(), proof.hash(), d.note());
    if (data.resolve(
            s.guard.tenant(), id, incident.version(), s.json.write(snapshot), s.guard.actor())
        != 1) throw new AgencyConflictException("异常已处理或版本已变化，不覆盖旧结论");
    ensure(pkg, round);
    var state = controls.control(round).state();
    if (!d.outcome().equals("continue_ready") && !state.equals("terminated")) state = "paused";
    record(
        pkg,
        round,
        state,
        "incident_resolved",
        id,
        d.evidenceVersionId(),
        proof.hash(),
        "异常处理结论留存，不自动恢复轮次");
    var saved = data.incident(s.guard.tenant(), id);
    s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Control command(String pkg, String round, String action, Command d) {
    var v = access(pkg, round, true, true);
    controlPermission();
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对本轮状态、全部异常及处理条件后明确操作");
    s.text(d.reason(), 4000, true, "控制决定及授权依据说明");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "evaluation-control:" + d.idempotencyKey(),
        hash = s.begin(key, Arrays.asList(round, action, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Control.class);
    var old = controls.control(round);
    s.expected(old.version(), d.expectedVersion());
    if (!Objects.equals(fingerprint(round), d.casesFingerprint()))
      throw new AgencyConflictException("异常处理版本已变化，请重新核对全量异常");
    AgencyIncidentPolicy.transition(old, data.incidents(s.guard.tenant(), round), action);
    if (action.equals("resume")) {
      var blockers = resumeBlockers(pkg, v);
      if (!blockers.isEmpty()) throw new IllegalStateException(String.join("；", blockers));
    }
    s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏暂停/恢复/停止决定凭证");
    var proof = s.source(d.evidenceVersionId(), pkg);
    ensure(pkg, round);
    String next =
        switch (action) {
          case "pause" -> "paused";
          case "resume" -> "active";
          default -> "terminated";
        };
    var saved =
        record(pkg, round, next, action, null, d.evidenceVersionId(), proof.hash(), d.reason());
    s.remember(key, hash, saved);
    return saved;
  }
}
