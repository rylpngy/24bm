package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyRecommendationRecords.*;
import com.procurement.agency.infrastructure.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyRecommendationService {
  final AgencyAssessmentContext c;
  final AgencyRecommendationMapper data;
  final AgencyEvaluationEvidence evidence;
  final AgencyPriceService prices;
  final AgencyTotalService totals;
  final AgencyPriceMapper priceData;
  final AgencyTotalMapper totalData;
  final AgencyMethodProcedureService procedures;
  final AgencyQuoteMapper quotes;
  final AgencyFinalQuoteMapper finals;

  public AgencyRecommendationService(
      AgencyAssessmentContext c,
      AgencyRecommendationMapper data,
      AgencyEvaluationEvidence evidence,
      AgencyPriceService prices,
      AgencyTotalService totals,
      AgencyPriceMapper priceData,
      AgencyTotalMapper totalData,
      AgencyMethodProcedureService procedures,
      AgencyQuoteMapper quotes,
      AgencyFinalQuoteMapper finals) {
    this.c = c;
    this.data = data;
    this.evidence = evidence;
    this.prices = prices;
    this.totals = totals;
    this.priceData = priceData;
    this.totalData = totalData;
    this.procedures = procedures;
    this.quotes = quotes;
    this.finals = finals;
  }

  String tenant() {
    return c.s.guard.tenant();
  }

  AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:recommendation:read");
    if (write) c.s.guard.permissions().require("buyer:agency:recommendation:manage");
    return a;
  }

  private void rule(Inputs d, AgencyAssessmentContext.Access a) {
    if (d == null || d.documentRule() == null || d.configuredRule() == null)
      throw new IllegalArgumentException("须对照原文件明确推荐次序、数量与同分处理");
    c.s.text(d.locator(), 2000, true, "推荐原文定位");
    for (var r : List.of(d.documentRule(), d.configuredRule())) {
      if (r.candidateCount() < 1
          || r.candidateCount() > 30
          || !Set.of("score_desc", "price_asc", "sole_source")
              .contains(Objects.toString(r.ordering(), ""))
          || !Set.of("manual_pending", "manual_evidenced")
              .contains(Objects.toString(r.tieHandling(), "")))
        throw new IllegalArgumentException("推荐规则类型、数量或同分处理无效");
      c.s.text(r.ruleText(), 4000, true, "原文推荐规则");
    }
    if (!d.documentRule().equals(d.configuredRule()))
      throw new IllegalStateException("原文推荐规则与系统配置存在差异");
    String expected =
        a.config().evaluationMethod().equals("comprehensive")
            ? "score_desc"
            : a.config().evaluationMethod().equals("consultation") ? "sole_source" : "price_asc";
    if (!expected.equals(d.configuredRule().ordering()))
      throw new IllegalStateException("推荐次序与本采购方式及冻结评审方法不匹配");
  }

  private BigDecimal amount(
      String session, com.procurement.agency.domain.AgencyPriceRecords.Line line) {
    if (line.sourceKind().equals("policy")) {
      var layer =
          quotes.list(tenant(), session).stream()
              .filter(v -> v.id().equals(line.sourceId()))
              .findFirst()
              .orElseThrow();
      return layer.correctedAmount() == null ? layer.originalAmount() : layer.correctedAmount();
    }
    return line.price();
  }

  public Preview preview(String pkg, String session, Inputs d) {
    var a = access(pkg, session, false);
    rule(d, a);
    List<String> blockers = new ArrayList<>(a.blockers());
    blockers.addAll(c.controls.reviewBlockers(a.session().roundId()));
    List<Candidate> rows = new ArrayList<>();
    String method = c.s.packages.find(tenant(), pkg).procurementMethod();
    if (a.config().evaluationMethod().equals("consultation")) {
      var r = procedures.latest(a.session().roundId(), "single_negotiation");
      if (r == null) blockers.add("单一来源须先记录实际专业协商、价格合理性和质量保障");
      else {
        var n =
            c.s.json.read(
                c.s.json.tree(r.snapshotJson()).path("content").toString(),
                com.procurement.agency.domain.AgencyMethodRecords.Negotiation.class);
        if (a.subjects().size() != 1
            || !n.participationId().equals(a.subjects().getFirst().participationId()))
          blockers.add("协商对象与本轮唯一对象不一致");
        else
          rows.add(
              new Candidate(
                  n.participationId(),
                  a.subjects().getFirst().supplierName(),
                  null,
                  n.agreedAmount(),
                  n.currency(),
                  r.id()));
      }
      if (d.priceCalculationId() != null
          || d.totalSnapshotId() != null
          || d.configuredRule().candidateCount() != 1) blockers.add("单一来源只引用唯一专业协商结果，不配置竞争价格或评分汇总");
    } else {
      var price =
          d.priceCalculationId() == null
              ? null
              : priceData.calculation(tenant(), session, d.priceCalculationId());
      if (a.config().evaluationMethod().equals("comprehensive")) {
        if (d.totalSnapshotId() == null) blockers.add("须明确选择已确认且有效的综合汇总版本");
        else {
          var total = totalData.findSnapshot(tenant(), session, d.totalSnapshotId());
          if (total == null) throw new IllegalArgumentException("汇总不存在或不属于当前任务");
          var view =
              totals.preview(
                  pkg,
                  session,
                  new com.procurement.agency.domain.AgencyTotalRecords.Selection(
                      total.priceCalculationId()));
          blockers.addAll(view.blockers());
          if (!Objects.equals(view.fingerprint(), total.inputFingerprint())
              || !Objects.equals(view.ruleHash(), total.ruleHash())
              || view.trace() != null
                  && !c.s
                      .json
                      .hash(c.s.json.read(total.traceJson(), Map.class))
                      .equals(
                          c.s.json.hash(c.s.json.read(c.s.json.write(view.trace()), Map.class))))
            blockers.add("所选综合汇总已失效，须先受控复核");
          if (d.priceCalculationId() != null
              && !total.priceCalculationId().equals(d.priceCalculationId()))
            throw new IllegalArgumentException("不得混用不同价格及汇总版本");
          price = priceData.calculation(tenant(), session, total.priceCalculationId());
          if (price != null && view.trace() != null) {
            var trace =
                c.s.json.read(
                    price.traceJson(),
                    com.procurement.agency.domain.AgencyPriceRecords.Trace.class);
            for (var row : view.trace().subjects()) {
              var line =
                  trace.lines().stream()
                      .filter(v -> v.participationId().equals(row.participationId()))
                      .findFirst()
                      .orElseThrow();
              rows.add(
                  new Candidate(
                      row.participationId(),
                      row.supplierName(),
                      row.total(),
                      amount(session, line),
                      line.currency(),
                      total.id()));
            }
          }
        }
      } else if (d.totalSnapshotId() != null) throw new IllegalArgumentException("当前方式不得套用综合评分汇总");
      if (price == null) blockers.add("须明确选择本任务已确认的价格比较版本");
      else {
        var scope =
            c.s.json.read(
                price.scopeJson(), com.procurement.agency.domain.AgencyPriceRecords.Scope.class);
        var current = prices.preview(pkg, session, scope);
        blockers.addAll(current.blockers());
        if (!Objects.equals(current.fingerprint(), price.inputFingerprint())
            || !Objects.equals(current.ruleHash(), price.ruleHash())
            || current.trace() != null
                && !c.s
                    .json
                    .hash(c.s.json.read(price.traceJson(), Map.class))
                    .equals(
                        c.s.json.hash(c.s.json.read(c.s.json.write(current.trace()), Map.class))))
          blockers.add("所选价格计算已失效，须重新核对");
        if (!a.config().evaluationMethod().equals("comprehensive") && current.trace() != null)
          for (var line : current.trace().lines())
            rows.add(
                new Candidate(
                    line.participationId(),
                    line.supplierName(),
                    line.price(),
                    amount(session, line),
                    line.currency(),
                    price.id()));
      }
    }
    if (rows.size() < d.configuredRule().candidateCount())
      blockers.add("实际有效对象不足推荐数量，不能降低条件或自动切换方式");
    Comparator<Candidate> cmp =
        d.configuredRule().ordering().equals("score_desc")
            ? Comparator.comparing(Candidate::metric, Comparator.reverseOrder())
            : Comparator.comparing(
                Candidate::metric, Comparator.nullsFirst(Comparator.naturalOrder()));
    if (!d.configuredRule().ordering().equals("sole_source")) rows.sort(cmp);
    List<List<String>> ties = new ArrayList<>();
    if (!d.configuredRule().ordering().equals("sole_source")) {
      for (int i = 0; i < rows.size(); ) {
        int j = i + 1;
        while (j < rows.size() && rows.get(i).metric().compareTo(rows.get(j).metric()) == 0) j++;
        if (j - i > 1)
          ties.add(rows.subList(i, j).stream().map(Candidate::participationId).toList());
        i = j;
      }
    }
    String source = evidence.stamp(tenant(), session);
    String fp =
        c.s.json.hash(Arrays.asList(source, d, rows, ties, blockers.stream().distinct().toList()));
    return new Preview(method, fp, d, rows, ties, blockers.stream().distinct().toList());
  }

  @Transactional
  public Recommendation confirm(String pkg, String session, Confirm d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对推荐次序、实际对象、金额口径与全部依据");
    c.s.text(d.reason(), 4000, true, "人工推荐依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "recommendation:" + d.idempotencyKey(),
        h = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Recommendation.class);
    var p = preview(pkg, session, d.inputs());
    if (!Objects.equals(p.sourceFingerprint(), d.expectedFingerprint()))
      throw new AgencyConflictException("推荐依据或计算版本已变化，须重新核对");
    if (!p.blockers().isEmpty()) throw new IllegalStateException(String.join("；", p.blockers()));
    var ids = d.participationIds();
    if (ids == null
        || ids.size() != d.inputs().configuredRule().candidateCount()
        || new HashSet<>(ids).size() != ids.size()
        || !p.comparisons().stream().map(Candidate::participationId).toList().containsAll(ids))
      throw new IllegalArgumentException("须按文件明确推荐数量及唯一实际对象，不能增加无依据候选人");
    boolean tied = p.ties().stream().anyMatch(group -> group.stream().anyMatch(ids::contains));
    String tieHash = null;
    if (tied) {
      if (!d.inputs().configuredRule().tieHandling().equals("manual_evidenced"))
        throw new IllegalStateException("存在同分或同价，原规则仍待有权处理，不能给出确定推荐次序");
      c.s.text(d.tieReason(), 4000, true, "同分有权处理依据");
      c.s.publicProjectSource(d.tieEvidenceVersionId(), pkg, "脱敏同分有权处理凭证");
      tieHash = c.s.source(d.tieEvidenceVersionId(), pkg).hash();
    }
    for (int i = 0; i < ids.size(); i++) {
      String selectedId = ids.get(i);
      var actual =
          p.comparisons().stream()
              .filter(v -> v.participationId().equals(selectedId))
              .findFirst()
              .orElseThrow();
      var expected = p.comparisons().get(i);
      if (!Objects.equals(actual.metric(), expected.metric())
          && !(actual.metric() != null
              && expected.metric() != null
              && actual.metric().compareTo(expected.metric()) == 0))
        throw new IllegalArgumentException("推荐名单不得跳过按适用规则排在前面的有效对象");
    }
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏人工推荐确认凭证");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    var candidates =
        ids.stream()
            .map(
                id ->
                    p.comparisons().stream()
                        .filter(v -> v.participationId().equals(id))
                        .findFirst()
                        .orElseThrow())
            .toList();
    var old = data.recommendations(tenant(), session);
    if (old.size() >= 100) throw new IllegalStateException("推荐版本技术上限100，历史不得删除");
    String stamp = evidence.stamp(tenant(), session);
    var snap =
        new Snapshot(
            pkg,
            session,
            a.session().roundHash(),
            p.method(),
            d.inputs(),
            p.comparisons(),
            candidates,
            p.ties(),
            d.evidenceVersionId(),
            proof.hash(),
            d.tieEvidenceVersionId(),
            tieHash,
            d.tieReason(),
            d.reason(),
            stamp,
            c.s.guard.actor());
    String raw = c.s.json.write(snap);
    var r =
        new Recommendation(
            "agency-recommendation-" + UUID.randomUUID(),
            tenant(),
            pkg,
            session,
            a.session().roundId(),
            old.size() + 1,
            stamp,
            raw,
            c.s.json.hash(c.s.json.read(raw, Map.class)),
            c.s.guard.actor(),
            null);
    data.createRecommendation(r);
    c.s.event(
        pkg,
        "recommendation_recorded",
        r.id(),
        null,
        Map.of("hash", r.frozenHash(), "count", candidates.size()),
        "人工推荐，不自动形成采购人确认或成交");
    c.s.remember(key, h, r);
    return r;
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    String fp = evidence.stamp(tenant(), session);
    return new Workspace(
        fp,
        data.recommendations(tenant(), session).stream()
            .map(r -> new History(r, !r.sourceFingerprint().equals(fp)))
            .toList(),
        reportsVisible() ? data.reports(tenant(), session) : List.of(),
        reportsVisible() ? data.artifacts(tenant(), session) : List.of(),
        reportsVisible() ? data.submissions(tenant(), session) : List.of(),
        a.blockers());
  }

  private boolean reportsVisible() {
    return c.s.guard.permissions().currentUserHas("buyer:agency:report:read")
        && c.s.guard.permissions().currentUserHas("buyer:agency:report:confidential");
  }

  Recommendation require(String pkg, String session, String id, boolean current) {
    var r = data.recommendation(tenant(), id);
    if (r == null || !r.sessionId().equals(session) || !r.packageId().equals(pkg))
      throw new IllegalArgumentException("推荐记录不属于当前项目及任务");
    if (!c.s.json.hash(c.s.json.read(r.snapshotJson(), Map.class)).equals(r.frozenHash()))
      throw new IllegalStateException("推荐快照指纹不一致");
    if (current && !evidence.stamp(tenant(), session).equals(r.sourceFingerprint()))
      throw new IllegalStateException("推荐的评审依据已变化，须重新核对推荐及报告");
    return r;
  }
}
