package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.workflow.application.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyService {
  private final AgencyMapper mapper;
  private final AgencyGuard guard;
  private final AgencyJson json;
  private final AgencyDrafts drafts;
  private final AgencyDirectory directory;
  private final AgencyFiles files;
  private final AgencyReviewProjector projector;
  private final UnifiedWorkflowApplicationService workflows;
  private final AuditLogApplicationService audit;
  private final AgencySequenceAlerts sequenceAlerts;

  public AgencyService(
      AgencyMapper mapper,
      AgencyGuard guard,
      AgencyJson json,
      AgencyDrafts drafts,
      AgencyDirectory directory,
      AgencyFiles files,
      AgencyReviewProjector projector,
      UnifiedWorkflowApplicationService workflows,
      AuditLogApplicationService audit,
      AgencySequenceAlerts sequenceAlerts) {
    this.mapper = mapper;
    this.guard = guard;
    this.json = json;
    this.drafts = drafts;
    this.directory = directory;
    this.files = files;
    this.projector = projector;
    this.workflows = workflows;
    this.audit = audit;
    this.sequenceAlerts = sequenceAlerts;
  }

  public AgencyMapper mapper() {
    return mapper;
  }

  public AgencyGuard guard() {
    return guard;
  }

  public AgencyJson json() {
    return json;
  }

  public AgencyDrafts drafts() {
    return drafts;
  }

  public AgencyDirectory directory() {
    return directory;
  }

  public AgencyFiles files() {
    return files;
  }

  public AgencyReviewProjector projector() {
    return projector;
  }

  public UnifiedWorkflowApplicationService workflows() {
    return workflows;
  }

  public AuditLogApplicationService audit() {
    return audit;
  }

  public List<Group> groups(String keyword) {
    guard.permissions().require("buyer:agency:read");
    return mapper.groups(guard.tenant(), keyword == null ? "" : keyword.strip());
  }

  @Transactional
  public Group createGroup(String name, String tags) {
    guard.permissions().require("buyer:agency:manage");
    if (name == null || name.isBlank() || name.length() > 200)
      throw new IllegalArgumentException("所属项目名称必填且不超过200字");
    AgencyPolicy.text(tags, 1000, "标签");
    String id = "agency-group-" + UUID.randomUUID();
    mapper.insertGroup(
        guard.tenant(), id, name.strip(), tags == null ? "" : tags.strip(), guard.actor());
    audit.recordTenantAction("agency.group.created", "agency_group", id);
    return mapper.group(guard.tenant(), id);
  }

  public Map<String, Object> groupSummary(String id) {
    guard.permissions().require("buyer:agency:read");
    if (mapper.group(guard.tenant(), id) == null) throw new IllegalArgumentException("所属项目不存在");
    var s = guard.scopes().currentUserDataScope();
    var packs =
        mapper.groupPackages(guard.tenant(), id, guard.actor(), !s.restricted(), s.departmentIds());
    Map<String, BigDecimal> totals = new TreeMap<>();
    for (var p : packs)
      if (p.budget() != null) totals.merge(p.currency(), p.budget(), BigDecimal::add);
    Map<String, String> amounts = new TreeMap<>();
    totals.forEach((k, v) -> amounts.put(k, v.toPlainString()));
    return Map.of(
        "packageCount",
        packs.size(),
        "budgetsByCurrency",
        amounts,
        "unknownBudgetCount",
        packs.stream().filter(p -> p.budget() == null).count(),
        "scope",
        "仅授权采购包，不重复计入所属项目");
  }

  @Transactional
  public Options options() {
    guard.permissions().require("buyer:agency:read");
    mapper.ensureNumbering(guard.tenant());
    return new Options(
        directory.people(),
        directory.departmentsList(),
        mapper.numbering(guard.tenant()),
        AgencyPolicy.METHODS);
  }

  @Transactional
  public Numbering configure(
      long expected,
      String pattern,
      String zone,
      Map<String, String> categories,
      Map<String, String> objects) {
    guard.permissions().require("buyer:agency:configure");
    AgencyPolicy.pattern(pattern, zone);
    codes(categories);
    codes(objects);
    mapper.ensureNumbering(guard.tenant());
    var c = mapper.lockNumbering(guard.tenant());
    AgencyPolicy.expected(c.version(), expected);
    if (!zone.equals(c.timeZone())
        && mapper.count(guard.tenant(), guard.actor(), true, List.of(), "", "", "", "", "") > 0)
      throw new IllegalStateException("已有档案后不可直接变更业务时区");
    mapper.numberingConfig(
        guard.tenant(), expected, pattern, zone, json.write(categories), json.write(objects));
    audit.recordTenantAction("agency.numbering.configured", "agency_config", guard.tenant());
    return mapper.numbering(guard.tenant());
  }

  private void codes(Map<String, String> values) {
    if (values == null || values.isEmpty() || values.size() > 50)
      throw new IllegalArgumentException("分类字典须含1至50项");
    for (var e : values.entrySet())
      if (!e.getKey().matches("[A-Z0-9]{1,12}")
          || e.getValue() == null
          || e.getValue().isBlank()
          || e.getValue().length() > 100)
        throw new IllegalArgumentException("类别代码须为1至12位大写字母数字，名称不能为空");
  }

  public Page list(
      int page,
      int pageSize,
      String status,
      String group,
      String method,
      String owner,
      String keyword) {
    guard.permissions().require("buyer:agency:read");
    int n = Math.max(1, Math.min(page, 100000)), size = Math.max(1, Math.min(pageSize, 100));
    var s = guard.scopes().currentUserDataScope();
    return new Page(
        mapper.list(
            guard.tenant(),
            guard.actor(),
            !s.restricted(),
            s.departmentIds(),
            status,
            group,
            method,
            owner,
            keyword,
            size,
            (n - 1) * size),
        mapper.count(
            guard.tenant(),
            guard.actor(),
            !s.restricted(),
            s.departmentIds(),
            status,
            group,
            method,
            owner,
            keyword),
        n,
        size);
  }

  public Detail detail(String id) {
    var p = guard.require(id, false);
    var reviews = mapper.reviews(guard.tenant(), id);
    boolean editable = guard.can(p, "buyer:agency:manage", true) && p.workflowId() == null;
    return new Detail(
        p,
        json.read(p.dataJson(), Draft.class),
        mapper.members(guard.tenant(), id),
        reviews,
        mapper.history(guard.tenant(), id),
        files.list(id),
        editable,
        guard.can(p, "buyer:agency:submit", true)
            && p.workflowId() == null
            && AgencyPolicy.EDITABLE.contains(p.status()),
        p.workflowId() != null
            && guard.can(p, "buyer:agency:submit", true)
            && reviews.stream()
                .anyMatch(
                    r ->
                        p.workflowId().equals(r.workflowId())
                            && guard.actor().equals(r.requestedBy())),
        editable && guard.permissions().currentUserHas("buyer:agency:file:manage"),
        p.businessStatus(),
        p.archiveCompletion(),
        p.financialStatus());
  }

  private void group(Draft d) {
    if (d.groupId() != null && mapper.group(guard.tenant(), d.groupId()) == null)
      throw new IllegalArgumentException("所属项目不在当前公司");
  }

  @Transactional
  public List<Detail> batch(List<Draft> requests, String key) {
    guard.permissions().require("buyer:agency:manage");
    if (requests == null || requests.isEmpty() || requests.size() > 20)
      throw new IllegalArgumentException("每批须为1至20个采购包");
    if (key == null || key.isBlank() || key.length() > 128)
      throw new IllegalArgumentException("批量建档须提供幂等键");
    String fingerprint = json.hash(Arrays.asList("batch", guard.actor(), requests));
    mapper.lockRequest(guard.tenant(), key);
    var old = mapper.idempotency(guard.tenant(), key);
    if (old != null) {
      if (!old.fingerprint().equals(fingerprint)) throw new AgencyConflictException("幂等键已用于不同批量内容");
      return Arrays.asList(json.read(old.responseJson(), Detail[].class));
    }
    List<Detail> result = new ArrayList<>();
    for (Draft request : requests) result.add(create(request));
    mapper.remember(guard.tenant(), key, fingerprint, json.write(result));
    return result;
  }

  @Transactional
  public Detail create(Draft request) {
    guard.permissions().require("buyer:agency:manage");
    Draft d = drafts.normalize(request);
    group(d);
    var s = guard.scopes().currentUserDataScope();
    if (s.restricted() && s.requesterId() == null && !s.departmentIds().contains(d.departmentId()))
      throw new com.procurement.common.tenant.PermissionDeniedException("不能在授权范围外部门建档");
    String id = "agency-package-" + UUID.randomUUID();
    mapper.create(guard.tenant(), id, d, json.write(d), guard.actor());
    projector.members(guard.tenant(), id, d);
    projector.history(mapper.find(guard.tenant(), id), "建档", guard.actor());
    audit.recordTenantAction("agency.package.created", "agency_package", id);
    return detail(id);
  }

  @Transactional
  public Detail edit(String id, Draft request) {
    guard.require(id, true);
    var p = mapper.lock(guard.tenant(), id);
    guard.mutable(p);
    AgencyPolicy.expected(p.version(), request.expectedVersion());
    Draft d = drafts.normalize(request);
    group(d);
    if ("approved".equals(p.status())
        && drafts.importantChange(json.read(p.dataJson(), Draft.class), d))
      throw new IllegalStateException("采购方式、主体、预算等重要字段须提交变更审批");
    if (mapper.edit(guard.tenant(), id, p.version(), d, json.write(d)) != 1)
      throw new AgencyConflictException("档案版本冲突");
    projector.members(guard.tenant(), id, d);
    projector.history(mapper.find(guard.tenant(), id), "档案修订", guard.actor());
    audit.recordTenantAction("agency.package.updated", "agency_package", id);
    return detail(id);
  }

  @Transactional
  public Detail submit(String id, Long expected, String key, Map<String, Object> form) {
    return review(id, expected, key, form, null, null);
  }

  @Transactional
  public Detail change(
      String id, Draft proposed, String key, String reason, Map<String, Object> form) {
    if (proposed == null) throw new IllegalArgumentException("缺少变更内容");
    return review(id, proposed.expectedVersion(), key, form, proposed, reason);
  }

  private Detail review(
      String id,
      Long expected,
      String key,
      Map<String, Object> form,
      Draft proposed,
      String reason) {
    guard.permissions().require("buyer:agency:submit");
    guard.require(id, true);
    if (key == null || key.isBlank() || key.length() > 128)
      throw new IllegalArgumentException("请提供不超过128字的幂等键");
    String fingerprint =
        json.hash(
            Arrays.asList(
                guard.actor(), id, expected, form == null ? Map.of() : form, proposed, reason));
    mapper.lockRequest(guard.tenant(), key);
    var saved = mapper.idempotency(guard.tenant(), key);
    if (saved != null) {
      if (!saved.fingerprint().equals(fingerprint))
        throw new AgencyConflictException("幂等键已用于不同提交内容");
      return json.read(saved.responseJson(), Detail.class);
    }
    var p = mapper.lock(guard.tenant(), id);
    guard.mutable(p);
    AgencyPolicy.expected(p.version(), expected);
    String kind = proposed == null ? "archive" : "change";
    if (proposed == null && !AgencyPolicy.EDITABLE.contains(p.status()))
      throw new IllegalStateException("当前档案不能提交建档审批");
    if (proposed != null
        && (!"approved".equals(p.status())
            || reason == null
            || reason.isBlank()
            || reason.length() > 1000)) throw new IllegalArgumentException("仅已通过档案可变更，且须填写变更原因");
    Draft d = drafts.normalize(proposed == null ? json.read(p.dataJson(), Draft.class) : proposed);
    group(d);
    mapper.ensureNumbering(guard.tenant());
    var config = mapper.lockNumbering(guard.tenant());
    drafts.ready(d, config);
    if (mapper.pendingFiles(guard.tenant(), id) > 0)
      throw new IllegalStateException("存在未完成附件版本，请先封存或取消");
    if (p.number() == null) {
      var now = ZonedDateTime.now(ZoneId.of(config.timeZone()));
      Integer serial = mapper.nextSerial(guard.tenant(), now.getYear());
      if (serial == null) {
        warnSequence(now.getYear());
        throw new IllegalStateException("公司年度流水达到9999，请管理员处理扩位，禁止循环取号");
      }
      if (serial >= 9900) warnSequence(now.getYear());
      String number =
          AgencyPolicy.number(
              config.pattern(),
              d.businessCategory(),
              d.objectCode(),
              now.format(DateTimeFormatter.ofPattern("yyyyMM")),
              serial);
      if (mapper.number(guard.tenant(), id, number, now.getYear(), serial) != 1)
        throw new AgencyConflictException("编号已分配");
      p = mapper.find(guard.tenant(), id);
    }
    String reviewId = "agency-review-" + UUID.randomUUID();
    var manifest = files.frozenManifest(id);
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("packageId", id);
    snapshot.put("title", d.title());
    snapshot.put("number", p.number());
    snapshot.put("packageVersion", p.version());
    snapshot.put("data", d);
    snapshot.put("files", manifest);
    snapshot.put("hash", json.hash(Arrays.asList(d, manifest)));
    snapshot.put("reason", reason == null ? "建档提交或重提" : reason);
    if (proposed != null) snapshot.put("previousData", json.read(p.dataJson(), Draft.class));
    mapper.review(
        guard.tenant(),
        reviewId,
        id,
        kind,
        p.version(),
        json.write(d),
        json.write(snapshot),
        guard.actor());
    if (mapper.state(
            guard.tenant(), id, p.version(), proposed == null ? "reviewing" : "approved", null)
        != 1) throw new AgencyConflictException("提交冲突");
    var workflow =
        workflows.start(
            new WorkflowStartCommand(
                proposed == null ? "agency_package_archive" : "agency_package_change",
                reviewId,
                d.departmentId(),
                d.budget(),
                form == null ? Map.of() : form,
                snapshot));
    mapper.bindReview(guard.tenant(), reviewId, workflow.workflowInstanceId());
    mapper.bindPackageWorkflow(guard.tenant(), id, workflow.workflowInstanceId());
    projector.history(mapper.find(guard.tenant(), id), "提交" + kind + "审批", guard.actor());
    audit.recordTenantAction("agency." + kind + ".submitted", "agency_package", id);
    Detail response = detail(id);
    mapper.remember(guard.tenant(), key, fingerprint, json.write(response));
    return response;
  }

  @Transactional
  public Detail withdraw(String id, Long expected, String reason) {
    guard.permissions().require("buyer:agency:submit");
    guard.require(id, true);
    var p = mapper.lock(guard.tenant(), id);
    AgencyPolicy.expected(p.version(), expected);
    if (p.workflowId() == null) throw new IllegalStateException("无进行中的审批");
    workflows.withdrawAgencyReview(p.workflowId(), reason);
    return detail(id);
  }

  private void warnSequence(int year) {
    try {
      sequenceAlerts.warn(guard.tenant(), year);
    } catch (RuntimeException error) {
      org.slf4j.LoggerFactory.getLogger(AgencyService.class)
          .warn("Agency sequence alert could not be delivered for year {}", year, error);
    }
  }

  public Map<String, Object> readiness(String id) {
    var p = guard.requireApproved(id);
    return Map.of(
        "packageId",
        p.id(),
        "approvedVersion",
        p.version(),
        "mode",
        p.operatingMode(),
        "ready",
        true);
  }
}
