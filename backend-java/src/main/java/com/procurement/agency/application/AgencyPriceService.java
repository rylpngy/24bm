package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.Result;
import com.procurement.agency.domain.AgencyPriceRecords.*;
import com.procurement.agency.infrastructure.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPriceService {
  private final AgencyAssessmentContext c;
  private final AgencyAssessmentStages stages;
  private final AgencyPriceMapper data;
  private final AgencyQuoteMapper quotes;
  private final AgencyFinalQuoteMapper finals;
  private final AgencyOpeningMapper openings;
  private final AgencyFinalResponseService finalResponses;
  private final AgencyMethodProcedureService procedures;

  public AgencyPriceService(
      AgencyAssessmentContext c,
      AgencyAssessmentStages stages,
      AgencyPriceMapper data,
      AgencyQuoteMapper quotes,
      AgencyFinalQuoteMapper finals,
      AgencyOpeningMapper openings,
      AgencyFinalResponseService finalResponses,
      AgencyMethodProcedureService procedures) {
    this.c = c;
    this.stages = stages;
    this.data = data;
    this.quotes = quotes;
    this.finals = finals;
    this.openings = openings;
    this.finalResponses = finalResponses;
    this.procedures = procedures;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:calculation:read");
    if (write) c.s.guard.permissions().require("buyer:agency:evaluation:calculation:manage");
    return a;
  }

  private Config config(RuleRow row) {
    return row == null ? null : c.s.json.read(row.configJson(), Config.class);
  }

  private void validate(Config d) {
    if (d == null) throw new IllegalArgumentException("缺少价格规则");
    c.s.text(d.ruleVersion(), 100, true, "价格规则版本");
    c.s.text(d.basis(), 2000, true, "价格规则依据");
    c.s.text(d.locator(), 500, true, "价格公式原文定位");
    AgencyPricePolicy.validate(d.documentRule());
    AgencyPricePolicy.validate(d.configuredRule());
  }

  private List<String> ruleBlockers(String pkg, AgencyAssessmentContext.Access a, Config d) {
    if (d == null) return List.of("尚未保存并核对价格规则");
    return AgencyPricePolicy.blockers(
        d.configuredRule(),
        c.s.packages.find(tenant(), pkg).procurementMethod(),
        a.config().evaluationMethod(),
        a.config().rules().stream().map(r -> r.configuredRule()).toList());
  }

  private void integrity(RuleRow row, AgencyAssessmentContext.Access a) {
    if (row != null && row.status().equals("frozen")) {
      if (!c.s.json.hash(c.s.json.read(row.frozenJson(), Map.class)).equals(row.frozenHash())
          || !c.s
              .json
              .tree(row.frozenJson())
              .path("roundHash")
              .asText()
              .equals(a.session().roundHash())
          || !Objects.equals(
              c.s.json.read(
                  c.s.json.tree(row.frozenJson()).path("config").toString(), Config.class),
              config(row))) throw new IllegalStateException("价格规则冻结指纹不一致");
    }
  }

  private record Inputs(
      List<Subject> subjects, Set<String> failed, List<String> blockers, String fingerprint) {}

  private Inputs inputs(String pkg, AgencyAssessmentContext.Access a, RuleRow row) {
    List<String> blockers = new ArrayList<>(a.blockers());
    blockers.addAll(c.controls.reviewBlockers(a.session().roundId()));
    List<Subject> subjects = List.of();
    Set<String> failed = new HashSet<>();
    var finalReview = finalResponses.gate(a);
    var procedureGate = procedures.inquiryGate(a);
    blockers.addAll(procedureGate.blockers());
    failed.addAll(procedureGate.failed());
    boolean useFinal = !finalReview.legacy() && !"required".equals(finalReview.marker());
    List<Object> sheetMarks = new ArrayList<>();
    var sequence =
        AgencyAssessmentStages.order(
            a.config(), c.s.packages.find(tenant(), pkg).procurementMethod());
    if (sequence.isEmpty()) blockers.add("没有冻结评审阶段");
    else {
      String last = sequence.getLast();
      var release = stages.released(a.session().id(), last);
      if (release == null) blockers.add("尚未按顺序开放全部适用评审阶段");
      else subjects = stages.subjects(a.session().id(), last, a.subjects());
      for (String stage :
          sequence.stream().filter(stage -> !useFinal || !stage.equals("evaluation")).toList())
        for (var member : a.config().members())
          if (!stages.criteria(a.config(), member.userId(), stage).isEmpty()) {
            var sheet =
                c.data.sheets(tenant(), a.session().id(), member.userId()).stream()
                    .filter(s -> s.stageKey().equals(stage))
                    .findFirst()
                    .orElse(null);
            if (sheet == null || !sheet.status().equals("submitted"))
              blockers.add("相关独立意见尚未全部提交，不能确认价格计算");
            if (sheet != null) {
              sheetMarks.add(
                  Map.of(
                      "id",
                      sheet.id(),
                      "version",
                      sheet.version(),
                      "status",
                      sheet.status(),
                      "hash",
                      c.s.json.hash(c.entries(sheet))));
              if (stage.equals(last))
                for (var entry : c.entries(sheet))
                  if (entry.conclusion() != null
                      && !entry.conclusion().isBlank()
                      && !entry.conclusion().equals("pass")) failed.add(entry.participationId());
            }
          }
    }
    List<Object> corrections = new ArrayList<>();
    for (var member : a.config().members())
      for (var correction : c.data.corrections(tenant(), a.session().id(), member.userId())) {
        corrections.add(Arrays.asList(correction.id(), correction.status()));
        if (correction.status().equals("processing")) blockers.add("存在待审更正，不能确认价格计算");
      }
    blockers.addAll(finalReview.blockers());
    failed.addAll(finalReview.failed());
    var finalRow = finals.campaign(tenant(), a.session().id());
    Object finalBasis = finalRow;
    // Empty new provenance columns must not invalidate pre-migration offline calculations.
    if (finalRow != null
        && (finalRow.discussionFingerprint() == null
            || finalRow.requirementChangesJson() == null)) {
      var legacy =
          (com.fasterxml.jackson.databind.node.ObjectNode) c.s.json.tree(c.s.json.write(finalRow));
      if (finalRow.discussionFingerprint() == null)
        legacy.remove(List.of("discussionManifestJson", "discussionFingerprint"));
      if (finalRow.requirementChangesJson() == null) legacy.remove("requirementChangesJson");
      finalBasis = legacy;
    }
    List<Object> basisParts =
        new ArrayList<>(
            Arrays.asList(
                a.session().roundHash(),
                blockers.stream().distinct().toList(),
                row == null ? null : row.frozenHash(),
                subjects,
                sheetMarks,
                corrections,
                quotes.list(tenant(), a.session().id()),
                finalBasis));
    if (finalReview.marker() != null) basisParts.add(finalReview.marker());
    if (procedureGate.marker() != null) basisParts.add(procedureGate.marker());
    var controlMarker = c.controls.marker(a.session().roundId());
    if (((Number) controlMarker.get("version")).longValue() > 0) basisParts.add(controlMarker);
    String fingerprint = c.s.json.hash(basisParts);
    return new Inputs(subjects, failed, blockers.stream().distinct().toList(), fingerprint);
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var row = data.rule(tenant(), session);
    integrity(row, a);
    var d = config(row);
    var in = inputs(pkg, a, row);
    return new Workspace(
        row,
        d,
        d == null ? List.of() : AgencyPricePolicy.differences(d.documentRule(), d.configuredRule()),
        ruleBlockers(pkg, a, d),
        in.subjects(),
        in.fingerprint(),
        data.history(tenant(), session).stream()
            .map(
                h ->
                    new History(
                        h,
                        !h.basisFingerprint().equals(in.fingerprint()) || !in.blockers().isEmpty()))
            .toList(),
        in.blockers());
  }

  @Transactional
  public RuleRow save(String pkg, String session, Save d) {
    var a = access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少价格规则草稿");
    validate(d.config());
    c.s.text(d.reason(), 2000, true, "规则维护原因");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "price-rule-save:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, RuleRow.class);
    var row = data.rule(tenant(), session);
    c.s.expected(row == null ? 0 : row.version(), d.expectedVersion());
    if (row == null)
      data.create(
          "agency-price-rule-" + UUID.randomUUID(),
          tenant(),
          session,
          c.s.json.write(d.config()),
          c.s.guard.actor());
    else {
      if (!row.status().equals("draft")) throw new IllegalStateException("价格规则已冻结，不能覆盖；变更须另行组织");
      if (data.save(tenant(), row.id(), row.version(), c.s.json.write(d.config())) != 1)
        throw new AgencyConflictException("价格规则已变化");
    }
    var saved = data.rule(tenant(), session);
    c.s.event(
        pkg,
        "price_rule_draft_saved",
        saved.id(),
        null,
        Map.of("version", saved.version()),
        d.reason());
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public RuleRow freeze(String pkg, String session, Freeze d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须逐项核对原文价格规则、来源和舍入顺序");
    c.s.text(d.reason(), 2000, true, "冻结核对说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "price-rule-freeze:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, RuleRow.class);
    var row = data.rule(tenant(), session);
    if (row == null || !row.status().equals("draft"))
      throw new IllegalStateException("没有可冻结的价格规则草稿");
    c.s.expected(row.version(), d.expectedVersion());
    var config = config(row);
    validate(config);
    List<String> errors = new ArrayList<>(ruleBlockers(pkg, a, config));
    errors.addAll(AgencyPricePolicy.differences(config.documentRule(), config.configuredRule()));
    if (!errors.isEmpty()) throw new IllegalStateException(String.join("；", errors));
    String raw =
        c.s.json.write(
            Map.of(
                "config",
                config,
                "roundHash",
                a.session().roundHash(),
                "documentRevisionId",
                a.config().documentRevisionId()));
    String frozenHash = c.s.json.hash(c.s.json.read(raw, Map.class));
    if (data.freeze(tenant(), row.id(), row.version(), raw, frozenHash) != 1)
      throw new AgencyConflictException("价格规则已变化");
    var saved = data.rule(tenant(), session);
    c.s.event(pkg, "price_rule_frozen", row.id(), null, Map.of("ruleHash", frozenHash), d.reason());
    c.s.remember(key, hash, saved);
    return saved;
  }

  public Preview preview(String pkg, String session, Scope scope) {
    var a = access(pkg, session, false);
    return preview(pkg, a, scope);
  }

  private Preview preview(String pkg, AgencyAssessmentContext.Access a, Scope scope) {
    var row = data.rule(tenant(), a.session().id());
    integrity(row, a);
    var in = inputs(pkg, a, row);
    List<String> errors = new ArrayList<>(in.blockers());
    if (scope == null
        || scope.participationIds() == null
        || scope.participationIds().isEmpty()
        || scope.participationIds().size() > 30
        || new HashSet<>(scope.participationIds()).size() != scope.participationIds().size()
        || !in.subjects().stream()
            .map(Subject::participationId)
            .toList()
            .containsAll(scope.participationIds()))
      throw new IllegalArgumentException("须从当前末阶段对象中明确选择1至30个不同对象");
    var plan = openings.plan(tenant(), a.session().roundId());
    if (plan == null) errors.add("缺少已确认的材料门槛，不能价格计算");
    else if (scope.participationIds().size()
        < c.s
            .json
            .read(
                plan.configJson(), com.procurement.agency.domain.AgencyOpeningRecords.Config.class)
            .minimumSubjects()) errors.add("计算范围数量不足已确认门槛，须按异常程序处理，不能自动放宽");
    var exclusions = scope.exclusions() == null ? Map.<String, String>of() : scope.exclusions();
    var excluded =
        in.subjects().stream()
            .map(Subject::participationId)
            .filter(id -> !scope.participationIds().contains(id))
            .toList();
    if (!exclusions.keySet().equals(new HashSet<>(excluded)))
      throw new IllegalArgumentException("未纳入价格计算的对象须逐家保留处理依据，不得自动跳过缺失报价");
    for (String reason : exclusions.values()) c.s.text(reason, 2000, true, "未纳入价格计算的处理依据");
    if (scope.participationIds().stream().anyMatch(in.failed()::contains))
      errors.add("所选对象存在未通过审查，不能纳入价格计算");
    if (row == null || !row.status().equals("frozen")) errors.add("价格规则尚未冻结");
    var config = config(row);
    errors.addAll(ruleBlockers(pkg, a, config));
    List<Line> lines = new ArrayList<>();
    Trace trace = null;
    if (config != null) {
      var rule = config.configuredRule();
      var finalRow = finals.campaign(tenant(), a.session().id());
      var layers = quotes.list(tenant(), a.session().id());
      for (var subject : in.subjects())
        if (scope.participationIds().contains(subject.participationId())) {
          BigDecimal value = null;
          String sourceId = null, sourceHash = null, currency = null;
          if (rule.priceSource().equals("final_original")) {
            if (finalRow != null && finalRow.status().equals("confirmed")) {
              var result =
                  Arrays.stream(c.s.json.read(finalRow.decisionsJson(), Result[].class))
                      .filter(
                          r ->
                              r.participationId().equals(subject.participationId())
                                  && r.status().equals("accepted"))
                      .findFirst()
                      .orElse(null);
              if (result != null) {
                value = result.amount();
                sourceId = result.receiptId();
                sourceHash = c.s.json.hash(Arrays.asList(finalRow.id(), result));
                currency = result.currency();
              }
            }
          } else {
            var layer =
                layers.stream()
                    .filter(l -> l.participationId().equals(subject.participationId()))
                    .findFirst()
                    .orElse(null);
            if (layer != null) {
              value =
                  switch (rule.priceSource()) {
                    case "original" -> layer.originalAmount();
                    case "corrected" -> layer.correctedAmount();
                    case "policy" -> layer.evaluationAmount();
                    default -> null;
                  };
              sourceId = layer.id();
              sourceHash = c.s.json.hash(layer);
              currency = layer.currency();
            }
          }
          if (value == null) errors.add(subject.supplierName() + "：缺少指定来源的已确认价格，禁止自动补用其他价格");
          else if (!c.s.packages.find(tenant(), pkg).currency().equals(currency))
            errors.add(subject.supplierName() + "：币种与采购包不符");
          else
            lines.add(
                new Line(
                    subject.participationId(),
                    subject.supplierName(),
                    sourceId,
                    sourceHash,
                    rule.priceSource(),
                    value,
                    currency,
                    null,
                    null));
        }
      if (errors.isEmpty())
        try {
          trace = AgencyPricePolicy.calculate(rule, lines);
        } catch (IllegalArgumentException e) {
          errors.add(e.getMessage());
        }
    }
    var normalized = new Scope(List.copyOf(scope.participationIds()), Map.copyOf(exclusions));
    String fingerprint = c.s.json.hash(Arrays.asList(in.fingerprint(), normalized, trace, errors));
    return new Preview(
        row == null ? null : row.id(),
        row == null ? null : row.frozenHash(),
        in.fingerprint(),
        fingerprint,
        normalized,
        trace,
        errors.stream().distinct().toList());
  }

  @Transactional
  public Calculation confirm(String pkg, String session, Confirm d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须复核价格来源、排除依据及全部计算明细");
    c.s.text(d.reason(), 2000, true, "计算复核说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "price-calculate:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Calculation.class);
    var preview = preview(pkg, a, d.scope());
    if (!Objects.equals(preview.fingerprint(), d.fingerprint()))
      throw new AgencyConflictException("价格、规则或意见版本已变化，请重新生成预览并核对");
    if (!preview.blockers().isEmpty())
      throw new IllegalStateException(String.join("；", preview.blockers()));
    if (data.count(tenant(), session) >= 100) throw new IllegalStateException("本任务最多保留100次价格计算记录");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏价格计算及范围复核依据");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    var calculation =
        new Calculation(
            "agency-price-calc-" + UUID.randomUUID(),
            tenant(),
            session,
            preview.ruleId(),
            preview.ruleHash(),
            preview.basisFingerprint(),
            preview.fingerprint(),
            c.s.json.write(preview.scope()),
            c.s.json.write(preview.trace()),
            d.evidenceVersionId(),
            proof.hash(),
            d.reason(),
            c.s.guard.actor(),
            null);
    data.createCalculation(calculation);
    var saved =
        data.history(tenant(), session).stream()
            .filter(x -> x.id().equals(calculation.id()))
            .findFirst()
            .orElseThrow();
    c.s.event(
        pkg,
        "price_calculation_confirmed",
        saved.id(),
        null,
        Map.of(
            "ruleHash",
            saved.ruleHash(),
            "inputFingerprint",
            saved.inputFingerprint(),
            "traceHash",
            c.s.json.hash(preview.trace())),
        "价格计算明细留存，不形成综合排名、推荐、成交或合同金额");
    c.s.remember(key, hash, saved);
    return saved;
  }
}
