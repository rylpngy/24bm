package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyAssessmentContext {
  public final AgencyExecutionSupport s;
  public final AgencyAssessmentMapper data;
  public final AgencyEvaluationMapper rounds;
  public final AgencyEvaluationService evaluations;
  public final AgencyEvaluationControls controls;
  private final AgencyDirectory directory;
  private final com.procurement.agency.infrastructure.AgencyOpeningMapper opening;

  public AgencyAssessmentContext(
      AgencyExecutionSupport s,
      AgencyAssessmentMapper data,
      AgencyEvaluationMapper rounds,
      AgencyEvaluationService evaluations,
      AgencyDirectory directory,
      com.procurement.agency.infrastructure.AgencyOpeningMapper opening,
      AgencyEvaluationControls controls) {
    this.s = s;
    this.data = data;
    this.rounds = rounds;
    this.evaluations = evaluations;
    this.directory = directory;
    this.opening = opening;
    this.controls = controls;
  }

  public record Access(
      Session session, Config config, List<Subject> subjects, List<String> blockers) {}

  public Access access(String pkg, String id, boolean write) {
    for (String p :
        List.of(
            "buyer:agency:evaluation:read",
            "buyer:agency:evaluation:confidential",
            "buyer:agency:document:read",
            "buyer:agency:file:read")) s.guard.permissions().require(p);
    var p = s.guard.require(pkg, false);
    if (write) {
      if ("closed".equals(p.businessStatus()))
        throw new IllegalStateException("业务已办结，继续评审须先按权限办理业务恢复；收付款与补档仍可继续");
      s.packages.lock(s.guard.tenant(), pkg);
      p = s.guard.require(pkg, false);
    }
    if (directory.people().stream().noneMatch(u -> u.id().equals(s.guard.actor())))
      throw new PermissionDeniedException("账号已失效");
    var session = data.session(s.guard.tenant(), id);
    if (session == null || !pkg.equals(session.packageId()))
      throw new PermissionDeniedException("评审任务不存在或无权访问");
    var round = rounds.round(s.guard.tenant(), session.roundId());
    if (round == null || !Objects.equals(round.frozenHash(), session.roundHash()))
      throw new IllegalStateException("冻结规则指纹不一致");
    evaluations.snapshot(pkg, round.id());
    Config c = s.json.read(s.json.tree(round.frozenJson()).path("config").toString(), Config.class);
    if (c.members().stream().noneMatch(m -> m.userId().equals(s.guard.actor())))
      throw new PermissionDeniedException("当前账号不在冻结评审人员中");
    List<String> blockers = new ArrayList<>();
    if (!p.status().equals("approved")
        || p.workflowId() != null
        || !p.operatingMode().equals("half")) blockers.add("建档或变更状态不允许继续评审");
    if (!round.status().equals("frozen")) blockers.add("冻结轮次已作废");
    if (evaluations.roundForAssessment(pkg, round.id()).frozenBasisStale())
      blockers.add("项目、文件或人员基线已变化，须组织人员复核");
    if (opening.opening(s.guard.tenant(), session.roundId()) == null)
      blockers.add("历史任务尚无正式材料开启记录，仅保留历史读取");
    blockers.addAll(controls.writeBlockers(session.roundId()));
    if (write && !blockers.isEmpty()) throw new IllegalStateException(String.join("；", blockers));
    return new Access(
        session, c, Arrays.asList(s.json.read(session.subjectsJson(), Subject[].class)), blockers);
  }

  public void organizer(Config c) {
    s.guard.permissions().require("buyer:agency:evaluation:organize");
    if (c.members().stream()
        .noneMatch(
            m ->
                m.userId().equals(s.guard.actor())
                    && (m.roles().contains("organizer") || m.roles().contains("leader"))))
      throw new PermissionDeniedException("当前账号不是冻结的组织人员或组长");
  }

  public List<Entry> entries(Sheet v) {
    return Arrays.asList(s.json.read(v.entriesJson(), Entry[].class));
  }

  public List<Cell> cells(Correction c) {
    return Arrays.asList(s.json.read(c.cellsJson(), Cell[].class));
  }

  public java.util.List<Sheet> history(String session, String user, String stage) {
    return data.sheets(s.guard.tenant(), session, user).stream()
        .filter(v -> v.stageKey().equals(stage))
        .toList();
  }

  public Sheet latest(String session, String user, String stage) {
    var sheets = history(session, user, stage);
    if (sheets.isEmpty()) throw new PermissionDeniedException("当前账号没有独立评审任务");
    return sheets.getFirst();
  }

  public Sheet newDraft(
      String tenant,
      String session,
      String user,
      String stage,
      int ordinal,
      String entries,
      String previous,
      String correction) {
    var sheet =
        new Sheet(
            "agency-sheet-" + UUID.randomUUID(),
            tenant,
            session,
            user,
            stage,
            ordinal,
            "draft",
            entries,
            1,
            previous,
            correction,
            null,
            null,
            null);
    data.createSheet(sheet);
    return sheet;
  }

  public void trace(String pkg, String type, Sheet before, Sheet after) {
    s.event(
        pkg,
        type,
        after.id(),
        before == null
            ? null
            : Map.of(
                "sheet",
                before.id(),
                "version",
                before.version(),
                "status",
                before.status(),
                "contentHash",
                s.json.hash(entries(before))),
        Map.of(
            "sheet",
            after.id(),
            "version",
            after.version(),
            "status",
            after.status(),
            "contentHash",
            s.json.hash(entries(after))),
        "本人独立评审，业务事件仅保存指纹和状态");
  }
}
