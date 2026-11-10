package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPublicationService {
  private final AgencyExecutionSupport s;
  private final AgencyDocumentService docs;
  private final AgencyDocumentBasis basis;

  public AgencyPublicationService(
      AgencyExecutionSupport s, AgencyDocumentService docs, AgencyDocumentBasis basis) {
    this.s = s;
    this.docs = docs;
    this.basis = basis;
  }

  public Readiness readiness(String pkg) {
    var p = s.read(pkg, "buyer:agency:document:read");
    var rule = s.data.rule(s.guard.tenant(), pkg);
    boolean applicable = rule == null || rule.announcementApplicable();
    List<String> reasons = new ArrayList<>();
    if (p.workflowId() != null) reasons.add("项目存在待审重要变更");
    var list = s.data.documents(s.guard.tenant(), pkg);
    Document
        purchase = list.stream().filter(d -> d.kind().equals("purchase")).findFirst().orElse(null),
        announcement =
            list.stream().filter(d -> d.kind().equals("announcement")).findFirst().orElse(null);
    String pRev = approved(purchase, reasons, "完整采购文件");
    String aRev = applicable ? approved(announcement, reasons, "独立公告或邀请") : null;
    if (!applicable && (rule.reason().isBlank() || rule.evidenceVersionId() == null))
      reasons.add("公告不适用记录缺少依据");
    if (purchase != null) reasons.addAll(unresolved(purchase));
    if (applicable && announcement != null) reasons.addAll(unresolved(announcement));
    return new Readiness(reasons.isEmpty(), reasons, pRev, aRev, applicable);
  }

  private List<String> unresolved(Document d) {
    var problems = docs.issues(d, uploaded(d));
    if (!"approved".equals(d.status()) || d.currentRevisionId() == null) return problems;
    var r = s.data.revision(s.guard.tenant(), d.currentRevisionId());
    if (r == null || r.workflowId() == null) return problems;
    String raw = s.data.waivedIssues(s.guard.tenant(), r.workflowId(), r.id());
    var waived = raw == null ? List.<String>of() : Arrays.asList(s.json.read(raw, String[].class));
    return problems.stream()
        .filter(x -> !x.startsWith("缺少必需章节内容：") || !waived.contains(x))
        .toList();
  }

  private boolean uploaded(Document d) {
    if (d.currentRevisionId() == null) return false;
    var r = s.data.revision(s.guard.tenant(), d.currentRevisionId());
    return r != null && "uploaded".equals(r.sourceKind());
  }

  private String approved(Document d, List<String> reasons, String label) {
    if (d == null || !"approved".equals(d.status()) || d.currentRevisionId() == null) {
      reasons.add(label + "尚无当前已通过版本");
      return null;
    }
    var r = s.data.revision(s.guard.tenant(), d.currentRevisionId());
    if (r == null
        || !"approved".equals(r.status())
        || r.inputVersion() != d.version()
        || basis.stale(s.guard.tenant(), d.packageId(), d.basisJson())) {
      reasons.add(label + "审批版本已过期");
      return null;
    }
    return r.id();
  }

  @Transactional
  public PublicationRule rule(
      String pkg, Long expected, boolean applicable, String reason, String evidence) {
    s.write(pkg, "buyer:agency:publication:manage");
    s.guard.permissions().require("buyer:agency:document:exception");
    var old = s.data.rule(s.guard.tenant(), pkg);
    s.expected(old == null ? 0 : old.version(), expected);
    s.text(reason, 2000, true, "公告适用性依据");
    s.sourceVersion(evidence, pkg);
    s.data.saveRule(s.guard.tenant(), pkg, applicable, reason, evidence, s.guard.actor());
    var result = s.data.rule(s.guard.tenant(), pkg);
    s.event(pkg, "publication_rule", pkg, old, result, reason);
    return result;
  }

  @Transactional
  public Publication record(
      String pkg,
      String key,
      String purchase,
      String announcement,
      String platform,
      OffsetDateTime publishedAt,
      String url,
      String evidence) {
    s.write(pkg, "buyer:agency:publication:manage");
    String hash =
        s.begin(
            key,
            Arrays.asList(
                "publication", pkg, purchase, announcement, platform, publishedAt, url, evidence));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, Publication.class);
    var ready = readiness(pkg);
    if (!ready.ready()) throw new IllegalStateException(String.join("；", ready.reasons()));
    if (!Objects.equals(purchase, ready.purchaseRevisionId())
        || !Objects.equals(announcement, ready.announcementRevisionId()))
      throw new IllegalArgumentException("发布登记须引用当前适用的审批版本");
    s.text(platform, 200, true, "发布平台或渠道");
    if (publishedAt == null || publishedAt.isAfter(OffsetDateTime.now().plusMinutes(5)))
      throw new IllegalArgumentException("人工发布必须登记已发生的时间");
    if ((url == null || url.isBlank()) && (evidence == null || evidence.isBlank()))
      throw new IllegalArgumentException("发布须填写有效链接或上传凭证");
    if (url != null && !url.isBlank()) {
      try {
        var u = new java.net.URI(url);
        if (!Set.of("http", "https").contains(u.getScheme()) || u.getHost() == null)
          throw new IllegalArgumentException();
      } catch (Exception e) {
        throw new IllegalArgumentException("发布链接须为HTTP或HTTPS地址");
      }
    }
    if (evidence != null && !evidence.isBlank()) s.sourceVersion(evidence, pkg);
    String id = "agency-publication-" + UUID.randomUUID();
    var rule = s.data.rule(s.guard.tenant(), pkg);
    s.data.publication(
        s.guard.tenant(),
        id,
        pkg,
        purchase,
        announcement,
        platform,
        publishedAt,
        url,
        evidence,
        rule == null ? null : rule.version(),
        s.guard.actor());
    s.data.businessStatus(s.guard.tenant(), pkg, "published");
    var result =
        s.data.publications(s.guard.tenant(), pkg).stream()
            .filter(p -> p.id().equals(id))
            .findFirst()
            .orElseThrow();
    s.event(pkg, "publication", id, null, result, "记录外部人工发布，不执行平台自动发布");
    s.remember(key, hash, result);
    return result;
  }
}
