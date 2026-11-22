package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyEvaluationRecords.View;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyExpertCheckIn {
  private final AgencyAssessmentContext context;
  public AgencyExpertCheckIn(AgencyAssessmentContext context) { this.context = context; }

  public record Expert(String userId, String name, String status, OffsetDateTime recordedAt) {}
  public record State(long version, String drawNote, String proofVersionId, String proofHash,
                      List<Expert> experts, boolean started) {}
  public record Draw(long expectedVersion, String note, String proofVersionId) {}
  public record Attendance(long expectedVersion, String userId, String status, String note) {}

  private View access(String pkg, String round) {
    var view = context.evaluations.roundForAssessment(pkg, round);
    context.organizer(view.config());
    context.s.guard.permissions().require("buyer:agency:preparation:confidential");
    return view;
  }

  public State get(String pkg, String round) {
    return state(pkg, access(pkg, round));
  }

  private State state(String pkg, View view) {
    var round = view.round().id();
    var tenant = context.s.guard.tenant();
    var saved = context.s.data.expertCheckIn(tenant, pkg, round);
    boolean started = context.data.byRound(tenant, round) != null;
    if (saved != null) {
      var state = context.s.json.read(saved, State.class);
      return new State(state.version(), state.drawNote(), state.proofVersionId(), state.proofHash(),
          state.experts(), started);
    }
    var experts = view.roster().stream().filter(member -> member.roles().contains("review_member"))
        .map(member -> new Expert(member.userId(), member.name(), "pending", null)).toList();
    return new State(0, null, null, null, experts, started);
  }

  private State editable(String pkg, String round, long expected) {
    context.s.write(pkg, "buyer:agency:preparation:manage");
    var view = access(pkg, round);
    if (!"frozen".equals(view.round().status()) || view.frozenBasisStale())
      throw new IllegalStateException("须选择当前有效的冻结评标轮次");
    var state = state(pkg, view);
    if (state.started()) throw new IllegalStateException("评分任务已启动，抽取和签到记录已锁定");
    if (state.version() != expected) throw new AgencyConflictException("专家记录已更新，请刷新后重试");
    return state;
  }

  @Transactional
  public State draw(String pkg, String round, Draw request) {
    var old = editable(pkg, round, request.expectedVersion());
    if (old.experts().isEmpty()) throw new IllegalStateException("冻结轮次没有评分专家");
    context.s.text(request.note(), 2000, true, "抽取结果及名单核对说明");
    var proof = context.s.source(request.proofVersionId(), pkg);
    var updated = new State(old.version() + 1, request.note().trim(), proof.version().id(), proof.hash(),
        old.experts().stream().map(expert -> new Expert(expert.userId(), expert.name(), "pending", null)).toList(), false);
    context.s.event(pkg, "expert_check_in", round, old, updated, "确认外部抽取结果与冻结专家名单");
    return updated;
  }

  @Transactional
  public State attendance(String pkg, String round, Attendance request) {
    var old = editable(pkg, round, request.expectedVersion());
    if (old.proofVersionId() == null) throw new IllegalStateException("请先确认专家抽取结果");
    if (request.status() == null || !Set.of("present", "absent", "recused").contains(request.status())
        || old.experts().stream().noneMatch(expert -> expert.userId().equals(request.userId())))
      throw new IllegalArgumentException("请选择本轮专家及有效的到场状态");
    context.s.text(request.note(), 1000, !"present".equals(request.status()), "签到说明");
    var experts = old.experts().stream().map(expert -> expert.userId().equals(request.userId())
        ? new Expert(expert.userId(), expert.name(), request.status(), OffsetDateTime.now()) : expert).toList();
    var updated = new State(old.version() + 1, old.drawNote(), old.proofVersionId(), old.proofHash(), experts, false);
    context.s.event(pkg, "expert_check_in", round, old, updated,
        "登记专家签到状态：" + request.status() + "。" + Objects.toString(request.note(), ""));
    return updated;
  }

  public void requireReady(String pkg, View view) {
    if (!context.s.json.tree(view.round().frozenJson()).path("expertCheckInRequired").asBoolean()) return;
    var state = state(pkg, view);
    if (state.proofVersionId() == null || state.experts().isEmpty()
        || state.experts().stream().anyMatch(expert -> !"present".equals(expert.status())))
      throw new IllegalStateException("先核对专家抽取结果，并确认冻结名单中的评分专家全部到场");
  }
}
