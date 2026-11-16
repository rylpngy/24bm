package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyExecutionRecords.Chapter;
import com.procurement.agency.domain.AgencyRecords.FileVersion;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPaperScoreReview {
  private final AgencyAssessmentContext context;
  private final AgencyAssessmentStages stages;
  private final AgencyDocxComposer composer;
  private final AgencyFileAccess fileAccess;

  public AgencyPaperScoreReview(AgencyAssessmentContext context, AgencyAssessmentStages stages, AgencyDocxComposer composer, AgencyFileAccess fileAccess) {
    this.context = context;
    this.stages = stages;
    this.composer = composer;
    this.fileAccess = fileAccess;
  }

  public record Mark(String criterionKey, BigDecimal score, BigDecimal weightedScore,
                     String evidence, String opinion) {}
  public record ExpertScore(String userId, String sheetHash, List<Mark> marks, BigDecimal total) {}
  public record SupplierScore(String supplierName, List<ExpertScore> experts, BigDecimal average) {}
  public record Confirm(String fingerprint, String note, boolean filesChecked,
                        String fileVersionId, List<String> signedVersionIds) {}
  public record ReviewedFile(String kind, String versionId, int ordinal, String sha256) {}
  public record Review(String fingerprint, String note, String reviewedBy, OffsetDateTime reviewedAt,
                       String fileVersionId, String evaluationFileHash,
                       List<ReviewedFile> files, String documentRevisionId, String documentHash) {}
  public record Summary(String revisionId, String fileHash, String tieRule,
                        int submitted, int expected, List<String> blockers,
                        List<SupplierScore> scores, String fingerprint, Review review) {}

  public Summary summary(String pkg, String session) {
    var current = summary(pkg, context.access(pkg, session, false));
    if (current.review() == null) return current;
    var review = current.review();
    var allowed = review.files() == null ? null
        : review.files().stream().filter(file -> visible(file.versionId())).toList();
    boolean reportVisible = visible(review.fileVersionId());
    var filtered = new Review(review.fingerprint(), review.note(), review.reviewedBy(), review.reviewedAt(),
        reportVisible ? review.fileVersionId() : null, reportVisible ? review.evaluationFileHash() : null,
        allowed, review.documentRevisionId(), review.documentHash());
    return new Summary(current.revisionId(), current.fileHash(), current.tieRule(), current.submitted(),
        current.expected(), current.blockers(), current.scores(), current.fingerprint(), filtered);
  }

  private Summary summary(String pkg, AgencyAssessmentContext.Access access) {
    context.organizer(access.config());
    context.s.guard.permissions().require("buyer:agency:evaluation:total:read");
    var tenant = context.s.guard.tenant();
    var revision = context.s.data.revision(tenant, access.config().documentRevisionId());
    if (revision == null) throw new IllegalStateException("评分依据定稿不存在");
    var plan = AgencyScoringMethod.parse(context.s, context.s.json.tree(revision.snapshotJson())
        .path("settings").path(AgencyScoringMethod.SETTING).asText(null));
    if (plan == null || !plan.matches(access.config()))
      throw new IllegalStateException("当前任务未绑定定稿的结构化评分办法");

    List<Sheet> sheets = new ArrayList<>();
    for (var member : access.config().members())
      if (member.roles().contains("review_member"))
        sheets.add(context.latest(access.session().id(), member.userId(), "evaluation"));
    var submitted = sheets.stream().filter(sheet -> "submitted".equals(sheet.status())).toList();
    var blockers = new ArrayList<>(access.blockers());
    if (sheets.isEmpty() || submitted.size() != sheets.size()) blockers.add("须待全部专家提交后汇总");
    if (!blockers.isEmpty()) return new Summary(revision.id(), revision.hash(), plan.tieRule(),
        submitted.size(), sheets.size(), blockers, List.of(), null, null);

    Map<String, List<Entry>> entries = new LinkedHashMap<>();
    for (var sheet : submitted) entries.put(sheet.id(), context.entries(sheet));
    List<SupplierScore> scores = new ArrayList<>();
    for (var subject : stages.subjects(access.session().id(), "evaluation", access.subjects())) {
      List<ExpertScore> experts = new ArrayList<>();
      for (var sheet : submitted) {
        List<Mark> marks = new ArrayList<>();
        for (var rule : plan.criteria()) {
          if (!"score".equals(rule.resultType())) continue;
          var entry = entries.get(sheet.id()).stream()
              .filter(e -> subject.participationId().equals(e.participationId()) && rule.key().equals(e.criterionKey()))
              .findFirst().orElseThrow(() -> new IllegalStateException("专家评分表与冻结对象或评分项不一致"));
          if (entry.score() == null) throw new IllegalStateException("已提交的评分表缺少分值");
          var weighted = entry.score().multiply(rule.weight())
              .divide(rule.maximum(), rule.scale(), RoundingMode.valueOf(rule.rounding()));
          marks.add(new Mark(rule.key(), entry.score(), weighted, entry.evidence(), entry.opinion()));
        }
        var total = marks.stream().map(Mark::weightedScore).reduce(BigDecimal.ZERO, BigDecimal::add);
        experts.add(new ExpertScore(sheet.userId(), sheet.contentHash(), marks, total));
      }
      var average = experts.stream().map(ExpertScore::total).reduce(BigDecimal.ZERO, BigDecimal::add)
          .divide(BigDecimal.valueOf(experts.size()), 2, RoundingMode.HALF_UP);
      scores.add(new SupplierScore(subject.supplierName(), experts, average));
    }
    if (scores.isEmpty()) return new Summary(revision.id(), revision.hash(), plan.tieRule(),
        submitted.size(), sheets.size(), List.of("没有可汇总的有效供应商"), List.of(), null, null);
    var fingerprint = context.s.json.hash(List.of(access.session().roundHash(), revision.hash(), scores));
    var saved = context.s.data.paperScoreReview(tenant, pkg, access.session().id());
    var review = saved == null ? null : context.s.json.read(saved, Review.class);
    return new Summary(revision.id(), revision.hash(), plan.tieRule(), submitted.size(), sheets.size(),
        List.of(), scores, fingerprint, review != null && fingerprint.equals(review.fingerprint()) ? review : null);
  }

  @Transactional
  public Review confirm(String pkg, String session, Confirm request) {
    context.s.guard.permissions().require("buyer:agency:evaluation:total:manage");
    var access = context.access(pkg, session, true);
    if (request == null || !request.filesChecked()) throw new IllegalArgumentException("请核对纸质材料、评分表及汇总表");
    context.s.text(request.note(), 2000, true, "评标文件核对说明");
    var current = summary(pkg, access);
    if (current.fingerprint() == null || !current.fingerprint().equals(request.fingerprint()))
      throw new IllegalStateException("当前评分未齐或版本已变化，请重新核对");
    var previous = current.review();
    var signedIds = request.signedVersionIds();
    if (signedIds == null || signedIds.isEmpty() || signedIds.size() > 20
        || signedIds.stream().anyMatch(Objects::isNull)
        || new HashSet<>(signedIds).size() != signedIds.size() || signedIds.contains(request.fileVersionId()))
      throw new IllegalArgumentException("请选择1至20份不同的已封存签署材料，评标报告另行选择");
    if (previous != null && previous.files() != null
        && Objects.equals(previous.fileVersionId(), request.fileVersionId())
        && new HashSet<>(previous.files().stream().filter(file -> "signed_material".equals(file.kind()))
             .map(ReviewedFile::versionId).toList()).equals(new HashSet<>(signedIds))
        && previous.note().equals(request.note().trim())) return previous;
    context.s.text(request.fileVersionId(), 150, true, "评标资料封存版本");
    var checkedFile = context.s.source(request.fileVersionId(), pkg);
    List<ReviewedFile> files = new ArrayList<>();
    files.add(reference("evaluation_report", checkedFile.version()));
    for (var versionId : signedIds)
      files.add(reference("signed_material", context.s.source(versionId, pkg).version()));

    var round = context.evaluations.roundForAssessment(pkg, access.session().roundId());
    var names = new HashMap<String, String>();
    round.roster().forEach(member -> names.put(member.userId(), member.name()));
    var summaryRows = new ArrayList<Chapter>();
    var sheets = new ArrayList<Chapter>();
    for (var supplier : current.scores()) {
      var summary = new StringBuilder("专家平均分：" + supplier.average());
      for (var expert : supplier.experts()) {
        String name = names.getOrDefault(expert.userId(), expert.userId());
        summary.append("\n").append(name).append("：").append(expert.total());
        var detail = new StringBuilder("提交评分表指纹：" + expert.sheetHash());
        for (var mark : expert.marks()) {
          detail.append("\n").append(mark.criterionKey()).append(" 原始分 ").append(mark.score())
              .append("，折算分 ").append(mark.weightedScore())
              .append("；依据：").append(Objects.toString(mark.evidence(), ""))
              .append("；意见：").append(Objects.toString(mark.opinion(), ""));
        }
        sheets.add(new Chapter("expert", supplier.supplierName() + " · " + name, detail.toString(), true));
      }
      summaryRows.add(new Chapter("supplier", supplier.supplierName(), summary.toString(), true));
    }
    summaryRows.add(new Chapter("tie", "同分处理", current.tieRule(), true));
    files.add(reference("expert_scores", scoreArtifact(pkg, "专家评分表", round.config().title(), current, sheets)));
    files.add(reference("score_summary", scoreArtifact(pkg, "评分汇总表", round.config().title(), current, summaryRows)));
    var review = new Review(current.fingerprint(), request.note().trim(), context.s.guard.actor(),
        OffsetDateTime.now(), checkedFile.version().id(), checkedFile.hash(), List.copyOf(files),
        current.revisionId(), current.fileHash());
    context.s.event(pkg, "paper_score_reviewed", session, null, review, "确认半流程评分汇总及评标文件核对");
    return review;
  }

  private boolean visible(String versionId) {
    if (versionId == null) return false;
    var tenant = context.s.guard.tenant();
    var version = context.s.packages.version(tenant, versionId);
    var file = version == null ? null : context.s.packages.file(tenant, version.fileId());
    return file != null && fileAccess.visible(file);
  }

  private ReviewedFile reference(String kind, FileVersion version) {
    return new ReviewedFile(kind, version.id(), version.ordinal(), version.hash());
  }

  private FileVersion scoreArtifact(String pkg, String title, String round, Summary basis, List<Chapter> content) {
    var chapters = new ArrayList<Chapter>();
    chapters.add(new Chapter("basis", "评标与定稿依据", "评标轮次：" + round
        + "\n招标定稿版本：" + basis.revisionId() + "\n招标定稿 SHA-256：" + basis.fileHash()
        + "\n评分汇总指纹：" + basis.fingerprint(), true));
    chapters.addAll(content);
    return context.s.paperScoreArtifact(pkg, title + ".docx", composer.compose(title, chapters, Map.of()));
  }

}
