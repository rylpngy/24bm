package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyFinanceRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.application.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFinanceService {
  final AgencyExecutionSupport s;
  final AgencyFinanceMapper data;
  final AgencyAssessmentMapper sessions;
  final AgencyEvaluationMapper rounds;
  final UnifiedWorkflowApplicationService workflows;

  public AgencyFinanceService(
      AgencyExecutionSupport s,
      AgencyFinanceMapper data,
      AgencyAssessmentMapper sessions,
      AgencyEvaluationMapper rounds,
      UnifiedWorkflowApplicationService workflows) {
    this.s = s;
    this.data = data;
    this.sessions = sessions;
    this.rounds = rounds;
    this.workflows = workflows;
  }

  String t() {
    return s.guard.tenant();
  }

  String id(String type) {
    return "agency-finance-" + type + "-" + UUID.randomUUID();
  }

  void access(String p, boolean w) {
    if (w) s.write(p, "buyer:agency:finance:manage");
    else s.read(p, "buyer:agency:finance:read");
  }

  String hash(String raw) {
    return s.json.hash(s.json.read(raw, Map.class));
  }

  String proof(String p, String id) {
    s.publicProjectSource(id, p, "脱敏财务凭证");
    return s.source(id, p).hash();
  }

  void reopened(String p) {
    data.reopen(t(), p);
  }

  void text(String v, String label) {
    s.text(v, 4000, true, label);
  }

  public Workspace workspace(String p) {
    access(p, false);
    var accounts = data.accounts(t(), p);
    var entries = data.entries(t(), p);
    boolean expert = s.guard.permissions().currentUserHas("buyer:agency:finance:expert");
    return new Workspace(
        categories(),
        accounts.stream()
            .map(
                a -> {
                  String detail = a.snapshotJson();
                  if (a.category().equals("expert") && !expert)
                    detail = s.json.write(Map.of("notice", "专家身份与服务明细按专门职责授权查看"));
                  return new AccountView(
                      a.id(),
                      a.kind(),
                      a.category(),
                      a.currency(),
                      a.budget(),
                      a.requested(),
                      a.approved(),
                      a.status(),
                      a.version(),
                      detail,
                      a.workflowId(),
                      a.category().equals("expert") && !expert ? null : a.createdBy(),
                      a.createdAt());
                })
            .toList(),
        entries.stream()
            .map(
                e ->
                    new EntryView(
                        e.id(),
                        e.accountId(),
                        e.kind(),
                        e.amount(),
                        e.occurredAt(),
                        e.status(),
                        e.version(),
                        e.workflowId()))
            .toList(),
        AgencyFinancePolicy.summary(accounts, entries),
        List.of(
            "应收、开票、到账及成本分别计量；差额为所列口径计算，不代表审计利润",
            "超收保留真实事实并单列待处理；不阻断通知书",
            "专家身份不向普通统计人员展开；不发起银行支付或外部催收"));
  }

  public List<Category> categories() {
    Map<String, Category> all = new LinkedHashMap<>();
    String[][] core = {
      {"expert", "专家费"},
      {"meal", "餐费"},
      {"tools", "工具材料"},
      {"transport", "交通"},
      {"venue", "场地"},
      {"other", "其他"}
    };
    for (var row : core) all.put(row[0], new Category(row[0], row[1], true, 0));
    for (var row : data.categories(t())) all.put(row.code(), row);
    return all.values().stream().toList();
  }

  @Transactional
  public List<Category> configureCategory(String p, String code, CategoryDraft d) {
    access(p, true);
    s.guard.permissions().require("buyer:agency:finance:configure");
    if (code == null || !code.matches("custom_[a-z0-9_]{1,40}") || d == null)
      throw new IllegalArgumentException("自定义类别编码须为custom_开头的稳定小写字母数字编码，不能改动核心类别含义");
    s.text(d.label(), 100, true, "成本类别名称");
    s.text(d.reason(), 1000, true, "配置原因");
    var old =
        data.categories(t()).stream()
            .filter(row -> row.code().equals(code))
            .findFirst()
            .orElse(null);
    if (old == null) {
      if (d.expectedVersion() != null && d.expectedVersion() != 0)
        throw new AgencyConflictException("类别版本变化");
      if (data.categories(t()).size() >= 100) throw new IllegalStateException("自定义类别最多100项，历史不删除");
      data.createCategory(t(), code, d.label(), d.active(), s.guard.actor());
    } else {
      s.expected(old.version(), d.expectedVersion());
      if (data.category(t(), code, old.version(), d.label(), d.active(), s.guard.actor()) != 1)
        throw new AgencyConflictException("类别版本变化");
    }
    s.event(
        p,
        "finance_category_configured",
        code,
        null,
        Map.of("label", d.label(), "active", d.active()),
        d.reason());
    return categories();
  }

  public record ExpertSource(String sessionId, String userId, String name, String roundTitle) {}

  public List<ExpertSource> expertSources(String p) {
    access(p, false);
    s.guard.permissions().require("buyer:agency:finance:expert");
    var out = new ArrayList<ExpertSource>();
    for (var round : rounds.rounds(t(), p)) {
      var session = sessions.byRound(t(), round.id());
      if (session == null) continue;
      for (var member : s.json.tree(round.frozenJson()).path("basis").path("members")) {
        boolean assigned = false;
        for (var role : member.path("roles"))
          if (Set.of("review_member", "qualification_reviewer", "conformity_reviewer")
              .contains(role.asText())) assigned = true;
        if (assigned)
          out.add(
              new ExpertSource(
                  session.id(),
                  member.path("userId").asText(),
                  member.path("name").asText(),
                  "轮次 " + round.ordinal()));
      }
    }
    return out;
  }

  @Transactional
  public Account receivable(String p, Calculation d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对约定触发节点与计费过程");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "finance-fee:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Account.class);
    BigDecimal amount = AgencyFinancePolicy.fee(d);
    for (var pair :
        List.of(
            Map.entry("规则版本", Objects.toString(d.ruleVersion(), "")),
            Map.entry("计费依据", Objects.toString(d.ruleBasis(), "")),
            Map.entry("税费口径", Objects.toString(d.taxBasis(), "")),
            Map.entry("触发节点", Objects.toString(d.trigger(), "")),
            Map.entry("付款方", Objects.toString(d.payer(), "")),
            Map.entry("收款主体", Objects.toString(d.recipient(), ""))))
      text(pair.getValue(), pair.getKey());
    var agreement = s.json.tree(s.packages.find(t(), p).dataJson()).path("feeAgreement");
    if (agreement.isMissingNode() || agreement.isEmpty())
      throw new IllegalStateException("立项收费约定缺失，须先补充真实约定，不能凭空计费");
    String agreementHash = s.json.hash(agreement);
    boolean duplicate =
        data.accounts(t(), p).stream()
            .anyMatch(
                a -> {
                  if (!a.kind().equals("receivable") || a.status().equals("rejected")) return false;
                  var previous = s.json.tree(a.snapshotJson());
                  var calc = previous.path("calculation");
                  return previous.path("agreementHash").asText().equals(agreementHash)
                      && calc.path("trigger").asText().strip().equals(d.trigger().strip())
                      && calc.path("payer").asText().strip().equals(d.payer().strip())
                      && calc.path("recipient").asText().strip().equals(d.recipient().strip());
                });
    if (duplicate)
      throw new IllegalStateException("同一收费约定、触发节点及付款收款主体已有待核算或确认应收，不能重复计费；已核定变化请走有权调整");
    String raw =
        s.json.write(
            Map.of(
                "calculation",
                d,
                "agreement",
                agreement,
                "agreementHash",
                s.json.hash(agreement),
                "evidenceHash",
                proof(p, d.evidenceVersionId()),
                "result",
                amount,
                "rounding",
                "先乘费率与折扣，最后四舍五入至两位"));
    var a =
        new Account(
            id("receivable"),
            t(),
            p,
            "receivable",
            "service_fee",
            s.packages.find(t(), p).currency(),
            null,
            amount,
            null,
            "draft",
            1,
            raw,
            hash(raw),
            null,
            s.guard.actor(),
            null);
    data.createAccount(a);
    reopened(p);
    s.event(
        p,
        "receivable_pending_review",
        a.id(),
        null,
        Map.of("hash", a.frozenHash()),
        "人工待核算应收，尚未确认");
    s.remember(k, h, a);
    return a;
  }

  @Transactional
  public Account cost(String p, CostDraft d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对实际费用申请、预算及依据");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "finance-cost:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Account.class);
    if (categories().stream()
        .noneMatch(category -> category.active() && category.code().equals(d.category())))
      throw new IllegalArgumentException("成本类别无效或已停用");
    if (d.budget() != null) AgencyFinancePolicy.money(d.budget(), false);
    AgencyFinancePolicy.money(d.requested(), false);
    text(d.reason(), "费用事由");
    text(d.bearer(), "承担主体");
    text(d.payee(), "支付对象");
    text(d.service(), "实际服务事项");
    text(d.billingBasis(), "计费依据");
    time(d.occurredAt());
    if (d.category().equals("expert")) {
      s.guard.permissions().require("buyer:agency:finance:expert");
      var session = sessions.session(t(), d.sessionId());
      if (session == null || !session.packageId().equals(p))
        throw new IllegalArgumentException("专家费用须关联本包实际任务");
      var round = rounds.round(t(), session.roundId());
      boolean found = false;
      for (var member : s.json.tree(round.frozenJson()).path("config").path("members"))
        if (member.path("userId").asText().equals(d.expertUserId()))
          for (var role : member.path("roles"))
            if (role.asText().equals("review_member")
                || role.asText().equals("qualification_reviewer")
                || role.asText().equals("conformity_reviewer")) found = true;
      if (!found) throw new IllegalArgumentException("专家费用必须引用实际冻结参与人员");
    } else if (d.expertUserId() != null && !d.expertUserId().isBlank())
      throw new IllegalArgumentException("其他成本不能夹带专家身份");
    String ph = proof(p, d.evidenceVersionId());
    if (data.accounts(t(), p).stream()
        .anyMatch(
            a ->
                a.kind().equals("cost")
                    && s.json.tree(a.snapshotJson()).path("evidenceHash").asText().equals(ph)
                    && !a.status().equals("rejected")))
      throw new IllegalStateException("同一费用申请凭证已使用，请核对是否重复申报");
    String raw =
        s.json.write(
            Map.of(
                "cost",
                d,
                "evidenceHash",
                ph,
                "categoryLabel",
                categories().stream()
                    .filter(cat -> cat.code().equals(d.category()))
                    .findFirst()
                    .orElseThrow()
                    .label()));
    var a =
        new Account(
            id("cost"),
            t(),
            p,
            "cost",
            d.category(),
            s.packages.find(t(), p).currency(),
            d.budget(),
            d.requested(),
            null,
            "draft",
            1,
            raw,
            hash(raw),
            null,
            s.guard.actor(),
            null);
    data.createAccount(a);
    reopened(p);
    s.event(p, "cost_requested", a.id(), null, Map.of("hash", a.frozenHash()), "预算、申请与实际发生分别计量");
    s.remember(k, h, a);
    return a;
  }

  Account account(String p, String id) {
    var a = data.account(t(), id);
    if (a == null || !a.packageId().equals(p)) throw new PermissionDeniedException("费用账户不属于当前项目");
    if (!hash(a.snapshotJson()).equals(a.frozenHash()))
      throw new IllegalStateException("计费快照指纹不一致");
    if (a.category().equals("expert")) s.guard.permissions().require("buyer:agency:finance:expert");
    return a;
  }

  @Transactional
  public Account submit(String p, String id, Submit d) {
    access(p, true);
    if (d == null) throw new IllegalArgumentException("缺少提交参数");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "finance-submit:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(id, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Account.class);
    var a = account(p, id);
    s.expected(a.version(), d.expectedVersion());
    if (!Set.of("draft", "rejected").contains(a.status()))
      throw new IllegalStateException("当前账户状态不可提审");
    text(d.reason(), "核算提审依据");
    var wf =
        workflows.start(
            new WorkflowStartCommand(
                "agency_finance_review",
                id,
                s.packages.find(t(), p).departmentId(),
                a.requested(),
                d.formData() == null ? Map.of() : d.formData(),
                Map.of(
                    "packageId",
                    p,
                    "objectKind",
                    "account",
                    "objectId",
                    id,
                    "version",
                    a.version() + 1,
                    "snapshotHash",
                    a.frozenHash(),
                    "amount",
                    a.requested().toPlainString())));
    if (data.state(t(), id, a.version(), a.status(), "reviewing", wf.workflowInstanceId(), null)
        != 1) throw new AgencyConflictException("账户版本变化");
    reopened(p);
    var r = data.account(t(), id);
    s.remember(k, h, r);
    return r;
  }

  @Transactional
  public void withdraw(String p, String id, String reason) {
    access(p, false);
    s.guard.permissions().require("buyer:agency:finance:manage");
    var a = data.account(t(), id);
    var e = a == null ? data.entry(t(), id) : null;
    String pkg = a == null ? (e == null ? null : e.packageId()) : a.packageId(),
        actor = a == null ? (e == null ? null : e.createdBy()) : a.createdBy(),
        wf = a == null ? (e == null ? null : e.workflowId()) : a.workflowId();
    if (!p.equals(pkg) || !s.guard.actor().equals(actor) || wf == null)
      throw new PermissionDeniedException("仅当前提审人可撤回进行中费用审批");
    workflows.withdrawAgencyExecution(wf, reason);
  }

  void time(OffsetDateTime at) {
    if (at == null || at.isAfter(OffsetDateTime.now().plusMinutes(5)))
      throw new IllegalArgumentException("实际发生日期缺失或晚于当前时间");
  }

  @Transactional
  public Entry enter(String p, String id, EntryDraft d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对金额、真实凭证及实际日期");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "finance-entry:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(id, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Entry.class);
    var a = account(p, id);
    if (!a.status().equals("approved")) throw new IllegalStateException("须先独立审核确认应收或批准成本申请");
    time(d.occurredAt());
    text(d.counterparty(), "实际往来主体");
    text(d.reference(), "银行流水或票据编号");
    text(d.reason(), "办理依据");
    var entries = data.entries(t(), p);
    AgencyFinancePolicy.validateEntry(a, entries, d);
    String ph = proof(p, d.evidenceVersionId());
    if (entries.stream()
        .anyMatch(
            e ->
                !e.status().equals("rejected")
                    && e.kind().equals(d.kind())
                    && e.evidenceHash().equals(ph)))
      throw new IllegalStateException("相同凭证及业务类型已登记，不能重复计入");
    boolean similar =
        entries.stream()
            .anyMatch(
                e ->
                    !e.status().equals("rejected")
                        && e.kind().equals(d.kind())
                        && e.amount().compareTo(d.amount()) == 0
                        && e.occurredAt().toLocalDate().equals(d.occurredAt().toLocalDate()));
    if (similar && !d.duplicateReviewed())
      throw new IllegalStateException("发现相同金额与日期的同类记录，须核对重复提示后明确确认");
    boolean approval = Set.of("waiver", "increase").contains(d.kind());
    String raw =
        s.json.write(Map.of("entry", d, "evidenceHash", ph, "accountHash", a.frozenHash()));
    var e =
        new Entry(
            id("entry"),
            t(),
            p,
            id,
            d.kind(),
            d.amount(),
            d.occurredAt(),
            d.evidenceVersionId(),
            ph,
            raw,
            hash(raw),
            approval ? "reviewing" : "approved",
            1,
            null,
            s.guard.actor(),
            null);
    data.createEntry(e);
    if (approval) {
      var wf =
          workflows.start(
              new WorkflowStartCommand(
                  "agency_finance_review",
                  e.id(),
                  s.packages.find(t(), p).departmentId(),
                  d.amount(),
                  d.formData() == null ? Map.of() : d.formData(),
                  Map.of(
                      "packageId",
                      p,
                      "objectKind",
                      "entry",
                      "objectId",
                      e.id(),
                      "version",
                      2,
                      "snapshotHash",
                      e.frozenHash(),
                      "amount",
                      e.amount().toPlainString())));
      if (data.entryState(t(), e.id(), 1, "reviewing", "reviewing", wf.workflowInstanceId()) != 1)
        throw new IllegalStateException("调整审批绑定失败");
    }
    reopened(p);
    s.event(
        p,
        "finance_" + d.kind(),
        e.id(),
        null,
        Map.of("hash", e.frozenHash(), "approvalRequired", approval),
        "实际事实登记；开票不等于到账");
    var result = data.entry(t(), e.id());
    s.remember(k, h, result);
    return result;
  }
}
