package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyEvaluationRecords.Config;
import com.procurement.agency.domain.AgencyMethodRecords.*;
import com.procurement.agency.infrastructure.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyMethodProcedureService {
  private final AgencyAssessmentContext c;
  private final AgencyMethodMapper data;
  private final AgencyOpeningMapper opening;
  private final AgencyQuoteMapper quotes;

  public AgencyMethodProcedureService(
      AgencyAssessmentContext c,
      AgencyMethodMapper data,
      AgencyOpeningMapper opening,
      AgencyQuoteMapper quotes) {
    this.c = c;
    this.data = data;
    this.opening = opening;
    this.quotes = quotes;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private String hash(String json) {
    return c.s.json.hash(c.s.json.read(json, Map.class));
  }

  private Config access(String pkg, String round, boolean write, String method) {
    c.s.guard.permissions().require("buyer:agency:procedure:read");
    c.s.guard.permissions().require("buyer:agency:evaluation:confidential");
    var p =
        write
            ? c.s.write(pkg, "buyer:agency:procedure:manage")
            : c.s.read(pkg, "buyer:agency:procedure:read");
    if (method != null && !method.equals(p.procurementMethod()))
      throw new IllegalStateException("当前采购方式不支持此专有程序");
    var view = c.evaluations.roundForAssessment(pkg, round);
    if (write) {
      c.organizer(view.config());
      c.controls.requireWritable(round);
      if (!view.round().status().equals("frozen") || view.frozenBasisStale())
        throw new IllegalStateException("须使用当前有效的冻结轮次");
    }
    return view.config();
  }

  private void text(String s, int max, String label) {
    c.s.text(s, max, true, label);
  }

  private String proof(String pkg, String id) {
    c.s.publicProjectSource(id, pkg, "脱敏专有程序凭证");
    return c.s.source(id, pkg).hash();
  }

  public Row latest(String round, String kind) {
    var r = data.latest(tenant(), round, kind);
    if (r != null
        && (!hash(r.snapshotJson()).equals(r.frozenHash())
            || !c.s
                .json
                .tree(r.snapshotJson())
                .path("sourceFingerprint")
                .asText()
                .equals(r.sourceFingerprint()))) throw new IllegalStateException("专有程序冻结指纹不一致");
    return r;
  }

  public Workspace workspace(String pkg, String round) {
    access(pkg, round, false, null);
    var all = data.history(tenant(), round);
    for (var r : all)
      if (!hash(r.snapshotJson()).equals(r.frozenHash()))
        throw new IllegalStateException("程序历史指纹不一致");
    List<String> blockers = new ArrayList<>(c.controls.writeBlockers(round));
    var v = c.evaluations.roundForAssessment(pkg, round);
    if (!v.round().status().equals("frozen") || v.frozenBasisStale())
      blockers.add("轮次未冻结或基线已变化，仅可读历史");
    return new Workspace(
        c.s.packages.find(tenant(), pkg).procurementMethod(),
        all,
        data.legacy(tenant(), round),
        c.s.data.participations(tenant(), pkg),
        c.data.byRound(tenant(), round) == null
            ? List.of()
            : Arrays.asList(
                c.s.json.read(
                    c.data.byRound(tenant(), round).subjectsJson(),
                    com.procurement.agency.domain.AgencyAssessmentRecords.Subject[].class)),
        blockers);
  }

  private Row append(
      String pkg,
      String round,
      String kind,
      String previous,
      String source,
      Object content,
      Map<String, String> proofs,
      String reason) {
    var old = latest(round, kind);
    if (!Objects.equals(
        old == null ? null : old.frozenHash(),
        previous == null || previous.isBlank() ? null : previous))
      throw new AgencyConflictException("专有程序版本已变化，请重新核对");
    if (old != null && old.ordinal() >= 100) throw new IllegalStateException("同一程序最多100个留痕版本");
    String id = "agency-method-" + UUID.randomUUID();
    Map<String, Object> snap = new TreeMap<>();
    snap.put("id", id);
    snap.put("kind", kind);
    snap.put("roundHash", c.rounds.round(tenant(), round).frozenHash());
    snap.put("previousHash", old == null ? null : old.frozenHash());
    snap.put("sourceFingerprint", source);
    snap.put("content", content);
    snap.put("evidenceHashes", proofs);
    snap.put("reason", reason);
    snap.put("actorId", c.s.guard.actor());
    String raw = c.s.json.write(snap);
    var r =
        new Row(
            id,
            tenant(),
            pkg,
            round,
            kind,
            old == null ? 1 : old.ordinal() + 1,
            old == null ? null : old.id(),
            source,
            raw,
            hash(raw),
            c.s.guard.actor(),
            null);
    data.create(r);
    c.s.event(
        pkg,
        "method_" + kind + "_recorded",
        id,
        null,
        Map.of("hash", r.frozenHash(), "ordinal", r.ordinal()),
        "线下专有程序留痕，不自动决定资格、推荐或成交");
    return latest(round, kind);
  }

  private void beforeOpening(String round) {
    if (opening.opening(tenant(), round) != null)
      throw new IllegalStateException("本轮已正式开启，不得事后改写邀请或适用依据，须另行组织");
  }

  private void command(boolean reviewed, String reason, String key) {
    if (!reviewed) throw new IllegalArgumentException("须人工核对适用规则、真实程序及凭证");
    text(reason, 2000, "登记依据");
    text(key, 100, "幂等键");
  }

  private String identity(String pkg, List<String> ids) {
    var ps = c.s.data.participations(tenant(), pkg);
    return c.s.json.hash(
        ids.stream()
            .sorted()
            .map(
                id -> {
                  var p =
                      ps.stream()
                          .filter(v -> v.id().equals(id))
                          .findFirst()
                          .orElseThrow(() -> new IllegalArgumentException("对象不属于本包参与台账"));
                  return Arrays.asList(p.id(), p.supplierName(), p.creditCode());
                })
            .toList());
  }

  @Transactional
  public Row invitation(String pkg, String round, Invitation d) {
    access(pkg, round, true, "邀请招标");
    if (d == null) throw new IllegalArgumentException("缺少邀请依据");
    command(d.reviewed(), d.reason(), d.idempotencyKey());
    String k = "method-invite:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(round, d));
    var cache = c.s.remembered(k);
    if (cache != null) return c.s.json.read(cache, Row.class);
    beforeOpening(round);
    if (!Set.of("documented_selection", "external_lottery")
        .contains(Objects.toString(d.selectionMode(), "")))
      throw new IllegalArgumentException("须明确有据名单形成或实际外部抽取；系统不随机指定供应商");
    text(d.formationBasis(), 4000, "名单来源、形成及适用选择依据");
    if (d.formedAt() == null || d.formedAt().isAfter(OffsetDateTime.now()))
      throw new IllegalArgumentException("名单形成须为真实非未来时间");
    if (d.participants() == null
        || d.participants().isEmpty()
        || d.participants().size() > 30
        || d.participants().stream().anyMatch(Objects::isNull)
        || d.participants().stream().map(Invitee::participationId).distinct().count()
            != d.participants().size()) throw new IllegalArgumentException("须明确1至30个不同邀请对象");
    Map<String, String> proofs = new TreeMap<>();
    proofs.put("formation", proof(pkg, d.evidenceVersionId()));
    for (var v : d.participants()) {
      text(v.participationId(), 150, "邀请对象");
      text(v.sourceNote(), 2000, "名单来源");
      text(v.verificationBasis(), 4000, "资格核验或预审适用依据与实际结果");
      text(v.selectionBasis(), 2000, "本对象形成及邀请依据");
      text(v.recipient(), 500, "实际通知对象及身份来源");
      if (!Set.of("qualification_check", "prequalification", "not_applicable")
              .contains(Objects.toString(v.verificationMode(), ""))
          || !Set.of("received", "declined", "unreachable")
              .contains(Objects.toString(v.deliveryStatus(), "")))
        throw new IllegalArgumentException("须明确核验适用性及真实送达处置，不默认一律资格预审");
      if (v.sentAt() == null
          || v.sentAt().isBefore(d.formedAt())
          || v.sentAt().isAfter(OffsetDateTime.now())
          || v.receivedAt() != null
              && (v.receivedAt().isBefore(v.sentAt())
                  || v.receivedAt().isAfter(OffsetDateTime.now()))
          || v.deliveryStatus().equals("received") && v.receivedAt() == null)
        throw new IllegalArgumentException("邀请与送达时间须真实、顺序一致，已送达须有实际接收时间");
      proofs.put(v.participationId(), proof(pkg, v.evidenceVersionId()));
    }
    var r =
        append(
            pkg,
            round,
            "invitation",
            d.expectedPreviousHash(),
            identity(pkg, d.participants().stream().map(Invitee::participationId).toList()),
            d,
            proofs,
            d.reason());
    c.s.remember(k, h, r);
    return r;
  }

  @Transactional
  public Row singleBasis(String pkg, String round, SingleBasis d) {
    access(pkg, round, true, "单一来源");
    if (d == null) throw new IllegalArgumentException("缺少适用依据");
    command(d.reviewed(), d.reason(), d.idempotencyKey());
    String k = "method-single-basis:" + d.idempotencyKey(),
        h = c.s.begin(k, Arrays.asList(round, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Row.class);
    beforeOpening(round);
    text(d.grounds(), 8000, "单一来源适用理由与论证依据");
    Map<String, String> proofs = new TreeMap<>();
    proofs.put("grounds", proof(pkg, d.evidenceVersionId()));
    applicability(
        pkg,
        "approval",
        d.approvalApplicability(),
        d.approvalNote(),
        d.approvalVersionId(),
        proofs);
    applicability(
        pkg,
        "publication",
        d.publicationApplicability(),
        d.publicationNote(),
        d.publicationVersionId(),
        proofs);
    var r =
        append(
            pkg,
            round,
            "single_basis",
            d.expectedPreviousHash(),
            c.rounds.round(tenant(), round).frozenHash(),
            d,
            proofs,
            d.reason());
    c.s.remember(k, h, r);
    return r;
  }

  private void applicability(
      String pkg,
      String key,
      String mode,
      String reason,
      String evidence,
      Map<String, String> hashes) {
    if (!Set.of("required", "not_applicable").contains(Objects.toString(mode, "")))
      throw new IllegalArgumentException("须明确论证审批或公示适用性");
    text(reason, 4000, "适用性与实际办理说明");
    if (mode.equals("required")) hashes.put(key, proof(pkg, evidence));
    else if (evidence != null && !evidence.isBlank()) hashes.put(key, proof(pkg, evidence));
  }

  public void openingGate(String pkg, String round, List<String> ids, OffsetDateTime openedAt) {
    String method = c.s.packages.find(tenant(), pkg).procurementMethod();
    if (method.equals("邀请招标")) {
      if (data.legacy(tenant(), round).contains("invitation")) return;
      var r = latest(round, "invitation");
      if (r == null) throw new IllegalStateException("须先记录有据邀请名单、适用核验及逐家邀请送达，再正式开启");
      var d =
          c.s.json.read(
              c.s.json.tree(r.snapshotJson()).path("content").toString(), Invitation.class);
      if (!identity(pkg, d.participants().stream().map(Invitee::participationId).toList())
          .equals(r.sourceFingerprint())) throw new IllegalStateException("邀请对象身份基线已变化，须重新核对");
      for (var id : ids)
        if (d.participants().stream()
            .noneMatch(
                v ->
                    v.participationId().equals(id)
                        && v.deliveryStatus().equals("received")
                        && !v.receivedAt().isAfter(openedAt)))
          throw new IllegalStateException("拟开启对象没有本轮实际送达邀请凭证，不自动认定进入评审");
    } else if (method.equals("单一来源")
        && !data.legacy(tenant(), round).contains("single_basis")
        && latest(round, "single_basis") == null)
      throw new IllegalStateException("须先登记单一来源适用理由、论证审批及公示适用性依据");
  }

  private String quoteBasis(String session) {
    return c.s.json.hash(quotes.list(tenant(), session));
  }

  @Transactional
  public Row inquiry(String pkg, String session, Inquiry d) {
    var a = c.access(pkg, session, true);
    c.organizer(a.config());
    access(pkg, a.session().roundId(), true, "询价");
    if (d == null) throw new IllegalArgumentException("缺少一次报价核对");
    command(d.reviewed(), d.reason(), d.idempotencyKey());
    if (!d.oneOfferChecked() || !d.noNegotiationChecked())
      throw new IllegalArgumentException("须核对一次报价及未进行普通议价，不用有效性登记替代原始金额");
    String k = "method-inquiry:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(session, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Row.class);
    if (d.offers() == null
        || d.offers().size() != a.subjects().size()
        || d.offers().stream().anyMatch(Objects::isNull)
        || !new HashSet<>(d.offers().stream().map(OfferCheck::participationId).toList())
            .equals(new HashSet<>(a.subjects().stream().map(v -> v.participationId()).toList())))
      throw new IllegalArgumentException("须对本轮全部已开启对象逐一核对，不能遗漏缺失者");
    var layers = quotes.list(tenant(), session);
    Map<String, String> proofs = new TreeMap<>();
    for (var offer : d.offers()) {
      if (!Set.of("valid", "invalid", "missing", "pending")
          .contains(Objects.toString(offer.status(), "")))
        throw new IllegalArgumentException("一次报价有效性状态无效");
      text(offer.responseLocator(), 2000, "原响应及一次报价位置");
      text(offer.handlingBasis(), 4000, "有效性或异常处理依据");
      var layer =
          layers.stream()
              .filter(v -> v.participationId().equals(offer.participationId()))
              .findFirst()
              .orElse(null);
      if (!Objects.equals(layer == null ? null : layer.id(), offer.quoteLayerId())
          || offer.status().equals("valid") && layer == null)
        throw new AgencyConflictException("报价层或对象已变化；有效报价须引用当前精确链尾，不得补造或再报价");
      proofs.put(offer.participationId(), proof(pkg, offer.evidenceVersionId()));
    }
    var r =
        append(
            pkg,
            a.session().roundId(),
            "inquiry",
            d.expectedPreviousHash(),
            quoteBasis(session),
            d,
            proofs,
            d.reason());
    c.s.remember(k, h, r);
    return r;
  }

  public Gate inquiryGate(AgencyAssessmentContext.Access a) {
    if (!c.s.packages.find(tenant(), a.session().packageId()).procurementMethod().equals("询价"))
      return new Gate(Set.of(), List.of(), null);
    if (data.legacy(tenant(), a.session().roundId()).contains("inquiry"))
      return new Gate(Set.of(), List.of(), null);
    var r = latest(a.session().roundId(), "inquiry");
    if (r == null) return new Gate(Set.of(), List.of("询价须先逐家核对一次报价有效性及异常依据"), "inquiry-required");
    List<String> blockers = new ArrayList<>();
    Set<String> failed = new HashSet<>();
    if (!r.sourceFingerprint().equals(quoteBasis(a.session().id())))
      blockers.add("一次报价来源层已变化，须重新核对有效性及价格计算");
    var d =
        c.s.json.read(c.s.json.tree(r.snapshotJson()).path("content").toString(), Inquiry.class);
    for (var v : d.offers())
      if (v.status().equals("pending")) blockers.add("尚有未处置的一次报价有效性问题");
      else if (!v.status().equals("valid")) failed.add(v.participationId());
    return new Gate(failed, blockers.stream().distinct().toList(), r.frozenHash());
  }

  @Transactional
  public Row negotiation(String pkg, String session, Negotiation d) {
    var a = c.access(pkg, session, true);
    c.organizer(a.config());
    var cfg = access(pkg, a.session().roundId(), true, "单一来源");
    if (d == null) throw new IllegalArgumentException("缺少专业协商结果");
    command(d.reviewed(), d.reason(), d.idempotencyKey());
    String k = "method-single-negotiation:" + d.idempotencyKey(),
        h = c.s.begin(k, Arrays.asList(session, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Row.class);
    if (a.subjects().size() != 1
        || !a.subjects().getFirst().participationId().equals(d.participationId()))
      throw new IllegalArgumentException("须明确本轮唯一协商供应商，不强制三家或生成竞争排名");
    if (d.staffUserIds() == null
        || d.staffUserIds().isEmpty()
        || d.staffUserIds().size() > 30
        || new HashSet<>(d.staffUserIds()).size() != d.staffUserIds().size()
        || d.staffUserIds().stream()
            .anyMatch(
                id ->
                    cfg.members().stream()
                        .noneMatch(
                            m ->
                                m.userId().equals(id)
                                    && (m.roles().contains("review_member")
                                        || m.roles().contains("purchaser_rep")))))
      throw new IllegalArgumentException("协商人员须为冻结名单中明确承担专业评审或采购人代表职责的人员，不能由技术管理身份代替");
    if (d.beganAt() == null
        || d.endedAt() == null
        || d.beganAt().isBefore(a.session().openedAt())
        || d.endedAt().isBefore(d.beganAt())
        || d.endedAt().isAfter(OffsetDateTime.now()))
      throw new IllegalArgumentException("协商实际时点须在开启后且不晚于当前时间");
    AgencyQuoteService.amount(d.agreedAmount());
    var pkgRow = c.s.packages.find(tenant(), pkg);
    if (!pkgRow.currency().equals(d.currency())
        || pkgRow.ceiling() != null && d.agreedAmount().compareTo(pkgRow.ceiling()) > 0)
      throw new IllegalArgumentException("协商金额币种须一致且不得超过本包明确的限价");
    text(d.priceReasonability(), 8000, "价格合理性依据");
    text(d.qualityAssurance(), 8000, "质量保障与履行承诺");
    text(d.supplierConfirmationNote(), 4000, "线下协商结果及供应商确认来源");
    if (d.marketSourceVersionIds() == null
        || d.marketSourceVersionIds().isEmpty()
        || d.marketSourceVersionIds().size() > 30
        || new HashSet<>(d.marketSourceVersionIds()).size() != d.marketSourceVersionIds().size())
      throw new IllegalArgumentException("须引用1至30份真实价格合理性资料，不预设三家竞争比价");
    Map<String, String> proofs = new TreeMap<>();
    proofs.put("result", proof(pkg, d.evidenceVersionId()));
    for (var id : d.marketSourceVersionIds()) proofs.put(id, proof(pkg, id));
    String source =
        c.s.json.hash(
            Arrays.asList(
                a.session().roundHash(),
                a.subjects(),
                latest(a.session().roundId(), "single_basis")));
    var r =
        append(
            pkg,
            a.session().roundId(),
            "single_negotiation",
            d.expectedPreviousHash(),
            source,
            d,
            proofs,
            d.reason());
    c.s.remember(k, h, r);
    return r;
  }
}
