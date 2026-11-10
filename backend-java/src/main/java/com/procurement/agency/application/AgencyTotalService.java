package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyPriceRecords;
import com.procurement.agency.domain.AgencyTotalRecords.*;
import com.procurement.agency.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyTotalService {
  private final AgencyAssessmentContext c;
  private final AgencyPriceService prices;
  private final AgencyPriceMapper priceData;
  private final AgencyTotalMapper data;
  private final AgencyFinalResponseService finalResponses;

  public AgencyTotalService(
      AgencyAssessmentContext c,
      AgencyPriceService prices,
      AgencyPriceMapper priceData,
      AgencyTotalMapper data,
      AgencyFinalResponseService finalResponses) {
    this.c = c;
    this.prices = prices;
    this.priceData = priceData;
    this.data = data;
    this.finalResponses = finalResponses;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:total:read");
    c.s.guard.permissions().require("buyer:agency:evaluation:calculation:read");
    if (write) c.s.guard.permissions().require("buyer:agency:evaluation:total:manage");
    return a;
  }

  private Config config(RuleRow row) {
    return row == null ? null : c.s.json.read(row.configJson(), Config.class);
  }

  private void validate(Config d) {
    if (d == null) throw new IllegalArgumentException("缺少汇总规则");
    c.s.text(d.ruleVersion(), 100, true, "汇总规则版本");
    c.s.text(d.basis(), 2000, true, "汇总适用依据");
    c.s.text(d.locator(), 500, true, "原文汇总及舍入位置");
    AgencyTotalPolicy.validate(d.documentRule());
    AgencyTotalPolicy.validate(d.configuredRule());
  }

  private List<String> blockers(
      AgencyAssessmentContext.Access a, Config d, AgencyPriceRecords.Workspace p) {
    if (d == null) return List.of("尚未保存并核对汇总规则");
    List<String> errors = new ArrayList<>();
    if (p.rule() == null || !p.rule().status().equals("frozen")) errors.add("须先冻结价格规则");
    errors.addAll(
        AgencyTotalPolicy.blockers(
            d.configuredRule(),
            a.config().evaluationMethod(),
            a.config().rules().stream().map(r -> r.configuredRule()).toList(),
            p.config() == null ? null : p.config().configuredRule()));
    return errors;
  }

  private void integrity(
      AgencyAssessmentContext.Access a, RuleRow row, AgencyPriceRecords.Workspace p) {
    if (row != null && row.status().equals("frozen"))
      if (!c.s.json.hash(c.s.json.read(row.frozenJson(), Map.class)).equals(row.frozenHash())
          || !c.s
              .json
              .tree(row.frozenJson())
              .path("roundHash")
              .asText()
              .equals(a.session().roundHash())
          || p.rule() == null
          || !c.s
              .json
              .tree(row.frozenJson())
              .path("priceRuleHash")
              .asText()
              .equals(p.rule().frozenHash())
          || !Objects.equals(
              config(row),
              c.s.json.read(
                  c.s.json.tree(row.frozenJson()).path("config").toString(), Config.class)))
        throw new IllegalStateException("汇总规则冻结指纹不一致");
  }

  private String basis(RuleRow row, AgencyPriceRecords.Workspace p) {
    return c.s.json.hash(
        Arrays.asList(row == null ? null : row.frozenHash(), p.basisFingerprint(), p.blockers()));
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var p = prices.workspace(pkg, session);
    var row = data.rule(tenant(), session);
    integrity(a, row, p);
    var d = config(row);
    String basis = basis(row, p);
    return new Workspace(
        row,
        d,
        d == null ? List.of() : AgencyTotalPolicy.differences(d.documentRule(), d.configuredRule()),
        blockers(a, d, p),
        basis,
        p.history().stream()
            .map(h -> new PriceOption(h.calculation().id(), h.calculation().createdAt(), h.stale()))
            .toList(),
        data.history(tenant(), session).stream()
            .map(
                h -> new History(h, !h.basisFingerprint().equals(basis) || !p.blockers().isEmpty()))
            .toList(),
        p.blockers());
  }

  @Transactional
  public RuleRow save(String pkg, String session, Save d) {
    var a = access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少汇总规则草稿");
    validate(d.config());
    c.s.text(d.reason(), 2000, true, "汇总规则维护说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "total-rule-save:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, RuleRow.class);
    var row = data.rule(tenant(), session);
    c.s.expected(row == null ? 0 : row.version(), d.expectedVersion());
    if (row == null)
      data.create(
          "agency-total-rule-" + UUID.randomUUID(),
          tenant(),
          session,
          c.s.json.write(d.config()),
          c.s.guard.actor());
    else {
      if (!row.status().equals("draft")) throw new IllegalStateException("汇总规则已冻结，不可覆盖；变更须另行组织");
      if (data.save(tenant(), row.id(), row.version(), c.s.json.write(d.config())) != 1)
        throw new AgencyConflictException("汇总规则已变化");
    }
    var saved = data.rule(tenant(), session);
    c.s.event(
        pkg,
        "total_rule_draft_saved",
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
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对原文汇总、唯一计分来源及舍入顺序");
    c.s.text(d.reason(), 2000, true, "汇总冻结说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "total-rule-freeze:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, RuleRow.class);
    var row = data.rule(tenant(), session);
    if (row == null || !row.status().equals("draft"))
      throw new IllegalStateException("没有可冻结的汇总规则草稿");
    c.s.expected(row.version(), d.expectedVersion());
    var dcfg = config(row);
    validate(dcfg);
    var p = prices.workspace(pkg, session);
    List<String> errors = new ArrayList<>(blockers(a, dcfg, p));
    errors.addAll(AgencyTotalPolicy.differences(dcfg.documentRule(), dcfg.configuredRule()));
    if (!errors.isEmpty()) throw new IllegalStateException(String.join("；", errors));
    String raw =
        c.s.json.write(
            Map.of(
                "config",
                dcfg,
                "roundHash",
                a.session().roundHash(),
                "priceRuleHash",
                p.rule().frozenHash(),
                "documentRevisionId",
                a.config().documentRevisionId()));
    String frozenHash = c.s.json.hash(c.s.json.read(raw, Map.class));
    if (data.freeze(tenant(), row.id(), row.version(), raw, frozenHash) != 1)
      throw new AgencyConflictException("汇总规则已变化");
    var saved = data.rule(tenant(), session);
    c.s.event(pkg, "total_rule_frozen", row.id(), null, Map.of("ruleHash", frozenHash), d.reason());
    c.s.remember(key, hash, saved);
    return saved;
  }

  public Preview preview(String pkg, String session, Selection d) {
    var a = access(pkg, session, false);
    return preview(pkg, a, d);
  }

  private Preview preview(String pkg, AgencyAssessmentContext.Access a, Selection d) {
    if (d == null || d.priceCalculationId() == null || d.priceCalculationId().isBlank())
      throw new IllegalArgumentException("须明确选择一份已确认的有效价格计算，不自动选择版本");
    var p = prices.workspace(pkg, a.session().id());
    var row = data.rule(tenant(), a.session().id());
    integrity(a, row, p);
    String basis = basis(row, p);
    List<String> errors = new ArrayList<>(p.blockers());
    var cfg = config(row);
    errors.addAll(blockers(a, cfg, p));
    if (row == null || !row.status().equals("frozen")) errors.add("汇总规则尚未冻结");
    var price = priceData.calculation(tenant(), a.session().id(), d.priceCalculationId());
    if (price == null) throw new IllegalArgumentException("价格计算不存在或不属于当前任务");
    var scope = c.s.json.read(price.scopeJson(), AgencyPriceRecords.Scope.class);
    var current = prices.preview(pkg, a.session().id(), scope);
    errors.addAll(current.blockers());
    if (!Objects.equals(current.fingerprint(), price.inputFingerprint())
        || !Objects.equals(current.ruleHash(), price.ruleHash())
        || current.trace() == null
        || !c.s
            .json
            .hash(c.s.json.read(price.traceJson(), Map.class))
            .equals(c.s.json.hash(c.s.json.read(c.s.json.write(current.trace()), Map.class))))
      errors.add("所选价格计算已失效或其明细不一致，须先重新复核价格计算");
    Trace trace = null;
    if (errors.isEmpty()) {
      var priceTrace = c.s.json.read(price.traceJson(), AgencyPriceRecords.Trace.class);
      List<SubjectTotal> totals = new ArrayList<>();
      Map<String, String> sources = new HashMap<>();
      cfg.configuredRule().sources().forEach(s -> sources.put(s.criterionKey(), s.source()));
      for (var line : priceTrace.lines()) {
        List<Component> components = new ArrayList<>();
        for (var pair : a.config().rules()) {
          var criterion = pair.configuredRule();
          if (!criterion.resultType().equals("score")) continue;
          if ("objective_price".equals(sources.get(criterion.key())))
            components.add(
                AgencyTotalPolicy.objective(
                    criterion,
                    p.config().configuredRule(),
                    line,
                    price.id(),
                    price.inputFingerprint()));
          else {
            Set<String> expected = new LinkedHashSet<>();
            List<AgencyTotalPolicy.Sample> samples = new ArrayList<>();
            for (var member : a.config().members())
              if (AgencyAssessmentPolicy.assigned(a.config(), member.userId()).stream()
                  .anyMatch(r -> r.key().equals(criterion.key()))) {
                expected.add(member.userId());
                var finalSample =
                    finalResponses.sample(
                        a, member.userId(), criterion.key(), line.participationId());
                if (finalSample != null) {
                  samples.add(finalSample);
                  continue;
                }
                var sheet = c.latest(a.session().id(), member.userId(), "evaluation");
                if (!sheet.status().equals("submitted"))
                  throw new IllegalStateException("成员意见尚未有效提交，不得汇总");
                String submittedHash =
                    c.s.json.hash(
                        Map.of(
                            "reviewerId",
                            sheet.userId(),
                            "session",
                            a.session().id(),
                            "roundHash",
                            a.session().roundHash(),
                            "stage",
                            sheet.stageKey(),
                            "ordinal",
                            sheet.ordinal(),
                            "entries",
                            c.entries(sheet)));
                if (!Objects.equals(submittedHash, sheet.contentHash()))
                  throw new IllegalStateException("成员提交版本指纹不一致，不得汇总");
                var entries =
                    c.entries(sheet).stream()
                        .filter(
                            e ->
                                e.participationId().equals(line.participationId())
                                    && e.criterionKey().equals(criterion.key()))
                        .toList();
                if (entries.size() != 1) throw new IllegalStateException("成员计分项缺失或重复，不得补填或汇总");
                samples.add(
                    new AgencyTotalPolicy.Sample(
                        member.userId(),
                        sheet.id(),
                        sheet.contentHash(),
                        entries.getFirst().score()));
              }
            components.add(AgencyTotalPolicy.member(criterion, expected, samples));
          }
        }
        totals.add(
            AgencyTotalPolicy.total(
                cfg.configuredRule(), line.participationId(), line.supplierName(), components));
      }
      trace =
          new Trace(
              cfg.configuredRule().method(),
              cfg.configuredRule().totalScale(),
              cfg.configuredRule().totalRounding(),
              "成员项按原始分精确求和×冻结权重÷(本项冻结成员数×满分)，仅分项最终除法舍入；客观价格项只取所选价格计算；分项结果相加后再按总分规则舍入",
              price.id(),
              price.inputFingerprint(),
              price.scopeJson(),
              a.config().tieRule(),
              totals,
              AgencyTotalPolicy.ties(totals));
    }
    String fingerprint =
        c.s.json.hash(
            Arrays.asList(basis, d.priceCalculationId(), price.inputFingerprint(), trace, errors));
    return new Preview(
        row == null ? null : row.id(),
        row == null ? null : row.frozenHash(),
        basis,
        fingerprint,
        trace,
        errors.stream().distinct().toList());
  }

  @Transactional
  public Snapshot confirm(String pkg, String session, Confirm d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须逐项复核唯一计分来源、成员版本及汇总明细");
    c.s.text(d.reason(), 2000, true, "汇总复核说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "total-confirm:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Snapshot.class);
    var preview = preview(pkg, a, new Selection(d.priceCalculationId()));
    if (!Objects.equals(preview.fingerprint(), d.fingerprint()))
      throw new AgencyConflictException("价格、成员意见、规则或状态已变化，请重新预览复核");
    if (!preview.blockers().isEmpty())
      throw new IllegalStateException(String.join("；", preview.blockers()));
    if (data.count(tenant(), session) >= 100) throw new IllegalStateException("每任务最多保留100份汇总记录");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏汇总复核凭证");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    var snapshot =
        new Snapshot(
            "agency-total-" + UUID.randomUUID(),
            tenant(),
            session,
            preview.ruleId(),
            preview.ruleHash(),
            d.priceCalculationId(),
            preview.basisFingerprint(),
            preview.fingerprint(),
            c.s.json.write(preview.trace()),
            d.evidenceVersionId(),
            proof.hash(),
            d.reason(),
            c.s.guard.actor(),
            null);
    data.snapshot(snapshot);
    var saved =
        data.history(tenant(), session).stream()
            .filter(x -> x.id().equals(snapshot.id()))
            .findFirst()
            .orElseThrow();
    c.s.event(
        pkg,
        "assessment_total_confirmed",
        saved.id(),
        null,
        Map.of(
            "inputFingerprint",
            saved.inputFingerprint(),
            "traceHash",
            c.s.json.hash(preview.trace())),
        "独立汇总复核留存，不形成确定排名、候选人推荐或成交结果");
    c.s.remember(key, hash, saved);
    return saved;
  }
}
