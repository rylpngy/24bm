package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyDemandService {
  private final AgencyExecutionSupport s;

  public AgencyDemandService(AgencyExecutionSupport s) {
    this.s = s;
  }

  public List<DemandItem> list(String pkg) {
    s.read(pkg, "buyer:agency:demand:read");
    return s.data.demands(s.guard.tenant(), pkg).stream()
        .filter(
            x -> {
              try {
                s.sourceVersion(x.sourceVersionId(), pkg);
                return true;
              } catch (com.procurement.common.tenant.PermissionDeniedException e) {
                return false;
              }
            })
        .toList();
  }

  @Transactional
  public DemandItem save(String pkg, String id, DemandDraft d) {
    s.write(pkg, "buyer:agency:demand:manage");
    validate(pkg, id, d);
    if (id == null) {
      id = "agency-demand-" + UUID.randomUUID();
      s.data.demandCreate(s.guard.tenant(), id, pkg, d, "manual", null, s.guard.actor());
      s.event(pkg, "demand", id, null, d, "人工录入结构化需求");
    } else {
      var old = s.data.demand(s.guard.tenant(), id);
      if (old == null || !pkg.equals(old.packageId())) throw new IllegalArgumentException("需求项不存在");
      s.expected(old.version(), d.expectedVersion());
      if (s.data.demandUpdate(s.guard.tenant(), id, old.version(), d, s.guard.actor()) != 1)
        throw new AgencyConflictException("需求项版本冲突");
      s.event(pkg, "demand", id, old, d, "人工修订或确认需求");
    }
    return s.data.demand(s.guard.tenant(), id);
  }

  private void validate(String pkg, String id, DemandDraft d) {
    if (d == null) throw new IllegalArgumentException("需求项不能为空");
    s.text(d.fieldKey(), 100, true, "需求字段");
    s.text(d.valueText(), 8000, true, "需求值");
    s.text(d.locator(), 500, true, "来源位置");
    if (d.status() == null
        || !Set.of("pending", "confirmed", "conflict", "superseded").contains(d.status()))
      throw new IllegalArgumentException("需求状态不合法");
    s.publicDemandSource(d.sourceVersionId(), pkg);
    if ("confirmed".equals(d.status()))
      for (var other : s.data.demands(s.guard.tenant(), pkg))
        if (!Objects.equals(id, other.id())
            && other.fieldKey().equals(d.fieldKey())
            && "confirmed".equals(other.status())
            && !other.valueText().equals(d.valueText()))
          throw new IllegalStateException("该字段已有不同的已确认值，请先明确将旧值标为已替代");
  }

  @Transactional
  public Job extract(String pkg, List<String> sources, String key) {
    s.write(pkg, "buyer:agency:demand:manage");
    if (sources == null || sources.isEmpty() || sources.size() > 10)
      throw new IllegalArgumentException("每次提取1至10份资料");
    for (String id : sources) s.publicDemandSource(id, pkg);
    String hash = s.begin(key, Arrays.asList("extract", pkg, sources));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, Job.class);
    String id = "agency-job-" + UUID.randomUUID();
    s.data.enqueue(
        s.guard.tenant(),
        id,
        pkg,
        "extract",
        null,
        null,
        s.json.write(Map.of("sourceVersions", sources, "engine", "deterministic")),
        s.guard.actor());
    var job = s.data.job(s.guard.tenant(), id);
    s.remember(key, hash, job);
    return job;
  }

  @Transactional
  public Map<String, Object> finishExtraction(
      Job job, List<Map<String, String>> candidates, List<String> limitations) {
    s.write(job.packageId(), "buyer:agency:demand:manage");
    var current = s.data.lockJob(s.guard.tenant(), job.id());
    if (current == null
        || !"processing".equals(current.status())
        || current.attempts() != job.attempts()
        || !Objects.equals(current.startedAt(), job.startedAt()))
      throw new IllegalStateException("任务已失效");
    List<String> added = new ArrayList<>();
    for (var row : candidates) {
      s.publicDemandSource(row.get("sourceVersionId"), job.packageId());
      var existing = s.data.demands(s.guard.tenant(), job.packageId());
      if (existing.stream()
          .anyMatch(
              x ->
                  x.sourceVersionId().equals(row.get("sourceVersionId"))
                      && x.locator().equals(row.get("locator"))
                      && x.fieldKey().equals(row.get("fieldKey"))
                      && x.valueText().equals(row.get("value")))) continue;
      boolean conflict =
          existing.stream()
              .anyMatch(
                  x ->
                      !"superseded".equals(x.status())
                          && x.fieldKey().equals(row.get("fieldKey"))
                          && !x.valueText().equals(row.get("value")));
      String id = "agency-demand-" + UUID.randomUUID();
      var d =
          new DemandDraft(
              null,
              row.get("fieldKey"),
              row.get("value"),
              row.get("sourceVersionId"),
              row.get("locator"),
              conflict ? "conflict" : "pending");
      s.data.demandCreate(
          s.guard.tenant(), id, job.packageId(), d, "deterministic", job.id(), s.guard.actor());
      added.add(id);
    }
    var result =
        Map.<String, Object>of(
            "itemIds",
            added,
            "candidateCount",
            added.size(),
            "limitations",
            limitations,
            "engine",
            "确定性文本提取，未使用AI，结果须人工确认");
    s.data.finishJob(s.guard.tenant(), job.id(), "success", s.json.write(result), null);
    s.event(job.packageId(), "demand_extracted", job.id(), null, result, "生成待确认候选，未替代人工结论");
    return result;
  }
}
