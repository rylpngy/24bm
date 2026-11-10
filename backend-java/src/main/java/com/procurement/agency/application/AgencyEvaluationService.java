package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.agency.infrastructure.AgencyEvaluationMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyEvaluationService {
  private final AgencyExecutionSupport s;
  private final AgencyEvaluationMapper data;
  private final AgencyDirectory directory;
  private final AgencyDocumentBasis documentBasis;

  public AgencyEvaluationService(
      AgencyExecutionSupport s,
      AgencyEvaluationMapper data,
      AgencyDirectory directory,
      AgencyDocumentBasis documentBasis) {
    this.s = s;
    this.data = data;
    this.directory = directory;
    this.documentBasis = documentBasis;
  }

  private PackageRow access(String pkg, boolean write) {
    for (String p :
        List.of(
            "buyer:agency:evaluation:confidential",
            "buyer:agency:document:read",
            "buyer:agency:file:read")) s.guard.permissions().require(p);
    return write
        ? s.write(pkg, "buyer:agency:evaluation:manage")
        : s.read(pkg, "buyer:agency:evaluation:read");
  }

  private Round require(String pkg, String id) {
    var r = data.round(s.guard.tenant(), id);
    if (r == null || !pkg.equals(r.packageId()))
      throw new PermissionDeniedException("评审轮次不存在或超出授权范围");
    return r;
  }

  private Source source(String pkg, String id) {
    var r = s.data.revision(s.guard.tenant(), id);
    if (r == null || !"approved".equals(r.status()))
      throw new IllegalArgumentException("来源须为已审批采购文件定稿");
    var d = s.data.document(s.guard.tenant(), r.documentId());
    if (d == null || !pkg.equals(d.packageId()) || !"purchase".equals(d.kind()))
      throw new IllegalArgumentException("定稿不属于当前采购包的采购文件");
    s.publicProjectSource(r.fileVersionId(), pkg, "评审规则");
    var v = s.sourceVersion(r.fileVersionId(), pkg);
    if (!r.hash().equals(v.hash())) throw new IllegalStateException("定稿与封存文件哈希不一致");
    return new Source(
        r.id(),
        d.id(),
        r.fileVersionId(),
        r.hash(),
        r.inputVersion(),
        "approved".equals(d.status())
            && r.id().equals(d.currentRevisionId())
            && d.version() == r.inputVersion(),
        documentBasis.stale(s.guard.tenant(), pkg, d.basisJson()));
  }

  private List<MemberSnapshot> members(String pkg, Config c) {
    var p = s.packages.find(s.guard.tenant(), pkg);
    Set<String> authorized = new HashSet<>();
    authorized.add(p.ownerId());
    authorized.add(p.createdBy());
    s.packages.members(s.guard.tenant(), pkg).forEach(m -> authorized.add(m.userId()));
    Map<String, String> users = new HashMap<>();
    directory.people().forEach(u -> users.put(u.id(), u.name()));
    List<MemberSnapshot> list = new ArrayList<>();
    for (var m : c.members()) {
      if (!authorized.contains(m.userId()) || !users.containsKey(m.userId()))
        throw new IllegalArgumentException("评审人员须为当前租户有效账号且已获采购包授权：" + m.userId());
      list.add(new MemberSnapshot(m.userId(), users.get(m.userId()), m.roles()));
    }
    return list;
  }

  private Map<String, Object> basis(String pkg, Config c) {
    var p = s.packages.find(s.guard.tenant(), pkg);
    var prep = s.data.preparation(s.guard.tenant(), pkg);
    return Map.of(
        "packageVersion",
        p.version(),
        "preparationVersion",
        prep == null ? 0 : prep.version(),
        "procurementMethod",
        p.procurementMethod(),
        "source",
        source(pkg, c.documentRevisionId()),
        "members",
        members(pkg, c));
  }

  private List<String> issues(String pkg, Config c) {
    var p = s.packages.find(s.guard.tenant(), pkg);
    List<String> errors = new ArrayList<>(AgencyEvaluationRules.blockers(c, p.procurementMethod()));
    try {
      var source = source(pkg, c.documentRevisionId());
      if (!source.current()) errors.add("引用的定稿已不是当前已审批版本");
      if (source.basisStale()) errors.add("定稿公共字段或确认需求已变化，须先重新核对采购文件");
      members(pkg, c);
    } catch (IllegalArgumentException | IllegalStateException e) {
      errors.add(e.getMessage());
    }
    return errors;
  }

  private View view(Round r) {
    Config c = s.json.read(r.configJson(), Config.class);
    var errors = issues(r.packageId(), c);
    boolean stale = false;
    if (r.frozenJson() != null) {
      try {
        stale =
            !s.json
                .hash(basis(r.packageId(), c))
                .equals(s.json.tree(r.frozenJson()).path("basisHash").asText());
      } catch (IllegalArgumentException | IllegalStateException e) {
        stale = true;
      }
    }
    List<MemberSnapshot> roster;
    if (r.frozenJson() != null)
      roster =
          Arrays.asList(
              s.json.read(
                  s.json.tree(r.frozenJson()).path("basis").path("members").toString(),
                  MemberSnapshot[].class));
    else {
      Map<String, String> names = new HashMap<>();
      directory.people().forEach(u -> names.put(u.id(), u.name()));
      roster =
          c.members().stream()
              .map(
                  m ->
                      new MemberSnapshot(
                          m.userId(), names.getOrDefault(m.userId(), "账号已失效或授权需复核"), m.roles()))
              .toList();
    }
    return new View(r, c, roster, AgencyEvaluationRules.differences(c), errors, stale);
  }

  public View roundForAssessment(String pkg, String id) {
    access(pkg, false);
    return view(require(pkg, id));
  }

  public Workspace workspace(String pkg) {
    access(pkg, false);
    List<Source> sources = new ArrayList<>();
    for (var d : s.data.documents(s.guard.tenant(), pkg))
      if ("purchase".equals(d.kind()))
        for (var r : s.data.revisions(s.guard.tenant(), d.id()))
          if ("approved".equals(r.status())) sources.add(source(pkg, r.id()));
    return new Workspace(
        data.rounds(s.guard.tenant(), pkg).stream().map(this::view).toList(), sources);
  }

  @Transactional
  public View save(String pkg, String id, Save d) {
    access(pkg, true);
    if (d == null) throw new IllegalArgumentException("缺少轮次配置");
    AgencyEvaluationRules.validate(d.config());
    s.text(d.reason(), 2000, true, "维护原因");
    source(pkg, d.config().documentRevisionId());
    members(pkg, d.config());
    String key = "evaluation-save:" + d.idempotencyKey();
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String hash = s.begin(key, Arrays.asList(pkg, id, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, View.class);
    Round old = null;
    if (id == null) {
      if (d.expectedVersion() != null && d.expectedVersion() != 0)
        throw new AgencyConflictException("新增轮次版本须为0");
      var all = data.rounds(s.guard.tenant(), pkg);
      if (all.size() >= 50) throw new IllegalStateException("每包最多50个保留轮次");
      id = "agency-evaluation-" + UUID.randomUUID();
      data.create(
          s.guard.tenant(),
          pkg,
          id,
          all.stream().mapToInt(Round::ordinal).max().orElse(0) + 1,
          s.json.write(d.config()),
          s.guard.actor());
    } else {
      old = require(pkg, id);
      s.expected(old.version(), d.expectedVersion());
      if (!old.status().equals("draft")) throw new IllegalStateException("冻结或作废轮次不可修改，请新建轮次并保留原因");
      if (data.save(s.guard.tenant(), id, old.version(), s.json.write(d.config())) != 1)
        throw new AgencyConflictException("轮次版本冲突");
    }
    var result = view(require(pkg, id));
    s.event(pkg, "evaluation_config", id, old, result, d.reason());
    s.remember(key, hash, result);
    return result;
  }

  @Transactional
  public View transition(String pkg, String id, Transition d, boolean freeze) {
    access(pkg, true);
    if (freeze) s.guard.permissions().require("buyer:agency:evaluation:freeze");
    if (d == null) throw new IllegalArgumentException("缺少确认信息");
    s.text(d.reason(), 2000, true, "确认依据及原因");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "evaluation-state:" + d.idempotencyKey();
    String hash = s.begin(key, Arrays.asList(pkg, id, freeze, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, View.class);
    var old = require(pkg, id);
    s.expected(old.version(), d.expectedVersion());
    if (freeze) {
      if (!old.status().equals("draft")) throw new IllegalStateException("只能冻结草稿配置");
      if (!d.businessRulesReviewed()) throw new IllegalArgumentException("须由项目人员核对适用规则并明确确认");
      Config c = s.json.read(old.configJson(), Config.class);
      AgencyEvaluationRules.validate(c);
      var blockers = issues(pkg, c);
      if (!blockers.isEmpty()) throw new IllegalStateException(String.join("；", blockers));
      var source = source(pkg, c.documentRevisionId());
      s.source(source.fileVersionId(), pkg);
      Map<String, Object> snapshot = new TreeMap<>();
      var basis = basis(pkg, c);
      snapshot.put("schemaVersion", "AGENCY-EVALUATION-1");
      snapshot.put("config", c);
      snapshot.put("basis", basis);
      snapshot.put("basisHash", s.json.hash(basis));
      snapshot.put("reviewedBy", s.guard.actor());
      snapshot.put("reviewNote", d.reason());
      snapshot.put("reviewedAt", java.time.OffsetDateTime.now().toString());
      String canonical = s.json.write(s.json.read(s.json.write(snapshot), Map.class));
      if (data.freeze(
              s.guard.tenant(),
              id,
              old.version(),
              canonical,
              s.json.bytesHash(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
              s.guard.actor())
          != 1) throw new AgencyConflictException("轮次版本冲突");
    } else {
      if (old.status().equals("voided")) throw new IllegalStateException("轮次已作废");
      if (data.voidRound(s.guard.tenant(), id, old.version(), d.reason()) != 1)
        throw new AgencyConflictException("轮次版本冲突");
    }
    var result = view(require(pkg, id));
    s.event(pkg, freeze ? "evaluation_frozen" : "evaluation_voided", id, old, result, d.reason());
    s.remember(key, hash, result);
    return result;
  }

  public Map<String, Object> snapshot(String pkg, String id) {
    access(pkg, false);
    var r = require(pkg, id);
    if (r.frozenJson() == null) throw new IllegalStateException("该轮次尚未冻结");
    Map<String, Object> result = s.json.read(r.frozenJson(), Map.class);
    if (!s.json
        .bytesHash(s.json.write(result).getBytes(java.nio.charset.StandardCharsets.UTF_8))
        .equals(r.frozenHash())) throw new IllegalStateException("冻结快照哈希不一致");
    return Map.of(
        "snapshot", result, "sha256", r.frozenHash(), "canonicalJson", s.json.write(result));
  }
}
