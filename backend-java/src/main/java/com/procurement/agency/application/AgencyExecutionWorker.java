package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.infrastructure.AgencyExecutionMapper;
import com.procurement.attachment.application.AttachmentTextExtractor;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.BuyerDirectoryQuery;
import com.procurement.notification.application.NotificationApplicationService;
import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AgencyExecutionWorker {
  private final AgencyExecutionMapper data;
  private final AgencyDocumentService documents;
  private final AgencyDemandService demands;
  private final AgencyExecutionSupport s;
  private final AttachmentTextExtractor extractor;
  private final BuyerDirectoryQuery directory;
  private final NotificationApplicationService notifications;
  private final AgencyReminderService reminders;
  private final AgencyDocumentPreviewService previews;

  public AgencyExecutionWorker(
      AgencyExecutionMapper data,
      AgencyDocumentService documents,
      AgencyDemandService demands,
      AgencyExecutionSupport s,
      AttachmentTextExtractor extractor,
      BuyerDirectoryQuery directory,
      NotificationApplicationService notifications,
      AgencyReminderService reminders,
      AgencyDocumentPreviewService previews) {
    this.data = data;
    this.documents = documents;
    this.demands = demands;
    this.s = s;
    this.extractor = extractor;
    this.directory = directory;
    this.notifications = notifications;
    this.reminders = reminders;
    this.previews = previews;
  }

  @Scheduled(fixedDelayString = "${agency.jobs.poll-ms:2000}")
  public void runJobs() {
    for (String tenant : data.jobTenants()) {
      data.recoverJobs(tenant);
      for (var queued : data.queuedJobs(tenant)) {
        if (data.claimJob(tenant, queued.id()) != 1) continue;
        var job = data.job(tenant, queued.id());
        TenantContext.set(tenant, null, job.createdBy());
        try {
          if (directory.active().stream().noneMatch(p -> p.id().equals(job.createdBy())))
            throw new IllegalStateException("任务创建账号已停用");
          if (job.kind().equals("compose")) {
            var bytes = documents.render(job);
            documents.finishComposition(job, bytes);
          } else if (job.kind().equals("preview")) {
            previews.finish(job, previews.render(job));
          } else extract(job);
        } catch (Exception error) {
          String reason =
              error instanceof IllegalArgumentException || error instanceof IllegalStateException
                  ? error.getMessage()
                  : "任务处理失败，请重试或联系管理员";
          if (reason == null) reason = "任务失败";
          data.failJobAttempt(
              tenant,
              job.id(),
              job.attempts(),
              job.startedAt(),
              reason.substring(0, Math.min(reason.length(), 1000)));
        } finally {
          TenantContext.clear();
        }
      }
    }
  }

  private void extract(Job job) {
    List<Map<String, String>> candidates = new ArrayList<>();
    List<String> limitations = new ArrayList<>();
    var sources = s.json.tree(job.payloadJson()).path("sourceVersions");
    Pattern key =
        Pattern.compile(
            "^(采购内容|技术要求|规格|数量|单位|履行地点|履行期限|验收要求|付款条件|资格条件|评审要素|政策事项|采购需求)[：:]\\s*(.+)$");
    for (var source : sources) {
      var input = s.source(source.asText(), job.packageId());
      s.publicDemandSource(source.asText(), job.packageId());
      var extracted = extractor.extract(input.name(), input.bytes());
      limitations.addAll(extracted.limitations());
      for (var segment : extracted.segments()) {
        var match = key.matcher(segment.text().strip());
        if (match.matches())
          candidates.add(
              Map.of(
                  "fieldKey",
                  match.group(1),
                  "value",
                  match.group(2),
                  "sourceVersionId",
                  source.asText(),
                  "locator",
                  segment.locator()));
      }
      if (extracted.segments().isEmpty()) limitations.add("资料未提取到可读正文，请人工录入并确认来源位置");
    }
    if (candidates.isEmpty()) limitations.add("未找到带标准字段标签的需求候选，不能标为已识别；仍可人工维护需求和选择模板");
    demands.finishExtraction(job, candidates, limitations);
  }

  @Scheduled(fixedDelayString = "${agency.plans.poll-ms:30000}")
  public void reminders() {
    for (String tenant : data.planTenants()) {
      String after = "";
      while (true) {
        var page = data.reminderMilestones(tenant, after);
        for (var m : page) {
          after = m.id();
          try {
            var p = s.packages.find(tenant, m.packageId());
            TenantContext.set(tenant, null, p.createdBy());
            reminders.prepare(m.id());
          } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(getClass())
                .warn("Agency reminder preparation deferred for {}", m.id());
          } finally {
            TenantContext.clear();
          }
        }
        if (page.size() < 200) break;
      }
      after = "";
      while (true) {
        var page = data.pendingReminders(tenant, after);
        for (var d : page) {
          after = d.id();
          try {
            var p = s.packages.find(tenant, d.packageId());
            TenantContext.set(tenant, null, p.createdBy());
            reminders.deliver(d.id());
          } catch (Exception e) {
            data.failedReminder(tenant, d.id());
            org.slf4j.LoggerFactory.getLogger(getClass())
                .warn("Agency reminder delivery deferred for {}", d.id());
          } finally {
            TenantContext.clear();
          }
        }
        if (page.size() < 200) break;
      }
    }
  }
}
