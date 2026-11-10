package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.Config;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyFinalQuoteAccess {
  private final AgencyFinalQuoteMapper data;
  private final AgencyAssessmentMapper sessions;
  private final AgencyEvaluationMapper rounds;
  private final AgencyGuard guard;
  private final AgencyJson json;
  private final AgencyEvaluationControls controls;
  private final AgencyFinalResponseMapper reviews;

  public AgencyFinalQuoteAccess(
      AgencyFinalQuoteMapper data,
      AgencyAssessmentMapper sessions,
      AgencyEvaluationMapper rounds,
      AgencyGuard guard,
      AgencyJson json,
      AgencyEvaluationControls controls,
      AgencyFinalResponseMapper reviews) {
    this.data = data;
    this.sessions = sessions;
    this.rounds = rounds;
    this.guard = guard;
    this.json = json;
    this.controls = controls;
    this.reviews = reviews;
  }

  private Campaign campaign(FileRow f) {
    var r = data.receiptFile(guard.tenant(), f.id());
    return r == null ? null : data.find(guard.tenant(), r.campaignId());
  }

  private boolean organizer(Campaign c) {
    if (c == null
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:confidential")
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:organize")) return false;
    var s = sessions.session(guard.tenant(), c.sessionId());
    var r = s == null ? null : rounds.round(guard.tenant(), s.roundId());
    if (r == null
        || !Objects.equals(r.frozenHash(), s.roundHash())
        || !json.bytesHash(
                json.write(json.read(r.frozenJson(), Map.class))
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            .equals(r.frozenHash())) return false;
    var cfg = json.read(json.tree(r.frozenJson()).path("config").toString(), Config.class);
    return cfg.members().stream()
        .anyMatch(
            m ->
                m.userId().equals(guard.actor())
                    && (m.roles().contains("organizer") || m.roles().contains("leader")));
  }

  public boolean visible(FileRow f) {
    var c = campaign(f);
    if (organizer(c) && guard.permissions().currentUserHas("buyer:agency:evaluation:final:read"))
      return true;
    if (c == null
        || !c.status().equals("confirmed")
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:confidential")
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:final-response:read")
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:response:read"))
      return false;
    var session = sessions.session(guard.tenant(), c.sessionId());
    var round = session == null ? null : rounds.round(guard.tenant(), session.roundId());
    var p = reviews.plan(guard.tenant(), c.sessionId());
    if (round == null
        || !round.status().equals("frozen")
        || !Objects.equals(round.frozenHash(), session.roundHash())
        || !json.hash(json.read(round.frozenJson(), Map.class)).equals(round.frozenHash())
        || p == null
        || !p.mode().equals("active")
        || !json.hash(json.read(p.snapshotJson(), Map.class)).equals(p.frozenHash())) return false;
    var snap =
        json.read(
            p.snapshotJson(),
            com.procurement.agency.domain.AgencyFinalResponseRecords.Snapshot.class);
    if (!snap.roundHash().equals(session.roundHash())
        || !snap.campaignHash().equals(json.hash(c))
        || snap.members().stream().noneMatch(v -> v.userId().equals(guard.actor()))) return false;
    var receipt = data.receiptFile(guard.tenant(), f.id());
    return snap.subjects().stream().anyMatch(v -> v.receiptId().equals(receipt.id()));
  }

  public void write(FileRow f) {
    var c = campaign(f);
    var r = data.receiptFile(guard.tenant(), f.id());
    if (!organizer(c)
        || !visible(f)
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:final:manage"))
      throw new PermissionDeniedException("仅冻结的有权组织人员可接收最后报价材料");
    var s = sessions.session(guard.tenant(), c.sessionId());
    controls.requireWritable(s.roundId());
    var round = rounds.round(guard.tenant(), s.roundId());
    if (!c.status().equals("collecting")
        || !r.status().equals("received")
        || !round.status().equals("frozen"))
      throw new IllegalStateException("最后报价已确认、登记已撤回或轮次失效，不能继续上传");
  }

  public void read(FileRow f, FileVersion v) {
    var c = campaign(f);
    if (!visible(f) || !c.status().equals("confirmed"))
      throw new PermissionDeniedException("最后报价尚未经截止后确认，不能下载原文");
    if (!guard.permissions().currentUserHas("buyer:agency:evaluation:response:read"))
      throw new PermissionDeniedException("缺少响应材料读取权限");
    var r = data.receiptFile(guard.tenant(), f.id());
    if (Arrays.stream(json.read(c.decisionsJson(), Result[].class))
        .noneMatch(
            x ->
                x.status().equals("accepted")
                    && Objects.equals(x.receiptId(), r.id())
                    && Objects.equals(x.fileVersionId(), v.id())
                    && Objects.equals(x.hash(), v.hash())))
      throw new PermissionDeniedException("材料未作为有效最后报价确认，不能下载");
  }
}
