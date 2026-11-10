package com.procurement.agency.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyExecutionRecords {
  private AgencyExecutionRecords() {}

  public record PlanNode(
      String key,
      String title,
      List<String> dependencies,
      String materialRequirement,
      ReminderSettings reminders) {}

  public record PlanTemplate(
      String tenantId,
      String procurementMethod,
      String operatingMode,
      long version,
      String nodesJson,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionChapter")
  public record Chapter(String code, String title, String body, boolean required) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionTemplate")
  public record Template(
      String id,
      String tenantId,
      String packageId,
      String name,
      String scope,
      String procurementMethod,
      String objectCode,
      String regime,
      String region,
      String description,
      boolean active,
      int latestOrdinal,
      String publishedVersionId,
      long version,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionTemplateVersion")
  public record TemplateVersion(
      String id,
      String tenantId,
      String templateId,
      int ordinal,
      String sectionsJson,
      String status,
      String sourceNote,
      String workflowId,
      String requestedBy,
      String createdBy,
      OffsetDateTime createdAt,
      String comment,
      LocalDate sourceDate,
      String policyVersion,
      String originTemplateVersionId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionTemplateView")
  public record TemplateView(Template template, List<TemplateVersion> versions) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionTemplateDraft")
  public record TemplateDraft(
      Long expectedVersion,
      String packageId,
      String name,
      String scope,
      String procurementMethod,
      String objectCode,
      String regime,
      String region,
      String description,
      List<Chapter> sections,
      String sourceNote,
      LocalDate sourceDate,
      String policyVersion) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionDemandItem")
  public record DemandItem(
      String id,
      String tenantId,
      String packageId,
      String fieldKey,
      String valueText,
      String sourceVersionId,
      String locator,
      String status,
      long version,
      String origin,
      String jobId,
      String createdBy,
      String updatedBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionDemandDraft")
  public record DemandDraft(
      Long expectedVersion,
      String fieldKey,
      String valueText,
      String sourceVersionId,
      String locator,
      String status) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionDocument")
  public record Document(
      String id,
      String tenantId,
      String packageId,
      String kind,
      String templateVersionId,
      String sectionsJson,
      String settingsJson,
      String basisJson,
      long version,
      String status,
      String currentRevisionId,
      String createdBy,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionDocumentDraft")
  public record DocumentDraft(
      Long expectedVersion, List<Chapter> sections, Map<String, String> settings) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRevision")
  public record Revision(
      String id,
      String tenantId,
      String documentId,
      long inputVersion,
      String sourceKind,
      String fileVersionId,
      String hash,
      String snapshotJson,
      String status,
      String jobId,
      String workflowId,
      String requestedBy,
      String createdBy,
      OffsetDateTime createdAt,
      String comment) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionDocumentView")
  public record DocumentView(
      Document document,
      List<Chapter> sections,
      Map<String, String> settings,
      List<Revision> revisions,
      boolean basisStale,
      List<String> issues) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionJob")
  public record Job(
      String id,
      String tenantId,
      String packageId,
      String kind,
      String documentId,
      Long inputVersion,
      String payloadJson,
      String status,
      int attempts,
      String resultJson,
      String errorText,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime startedAt,
      OffsetDateTime finishedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPublicationRule")
  public record PublicationRule(
      String tenantId,
      String packageId,
      boolean announcementApplicable,
      String reason,
      String evidenceVersionId,
      long version,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPublication")
  public record Publication(
      String id,
      String tenantId,
      String packageId,
      String purchaseRevisionId,
      String announcementRevisionId,
      String platform,
      OffsetDateTime publishedAt,
      String url,
      String evidenceVersionId,
      Long ruleVersion,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReadiness")
  public record Readiness(
      boolean ready,
      List<String> reasons,
      String purchaseRevisionId,
      String announcementRevisionId,
      boolean announcementApplicable) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipation")
  public record Participation(
      String id,
      String tenantId,
      String packageId,
      String supplierName,
      String creditCode,
      String contact,
      String phone,
      String source,
      String acquisitionStatus,
      String submissionStatus,
      String riskNote,
      String riskStatus,
      String evidenceVersionId,
      String notes,
      long version,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      String importId,
      Integer sourceRow) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipationDraft")
  public record ParticipationDraft(
      Long expectedVersion,
      String supplierName,
      String creditCode,
      String contact,
      String phone,
      String source,
      String acquisitionStatus,
      String submissionStatus,
      String riskNote,
      String riskStatus,
      String evidenceVersionId,
      String notes) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionMilestone")
  public record Milestone(
      String id,
      String tenantId,
      String packageId,
      String nodeKey,
      String title,
      String ownerId,
      OffsetDateTime startsAt,
      OffsetDateTime dueAt,
      String dependenciesJson,
      String materialRequirement,
      String status,
      OffsetDateTime completedAt,
      String resultNote,
      String changeReason,
      OffsetDateTime legalDeadline,
      String legalBasis,
      long version,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      long templateVersion) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionMilestoneDraft")
  public record MilestoneDraft(
      Long expectedVersion,
      String title,
      String ownerId,
      OffsetDateTime startsAt,
      OffsetDateTime dueAt,
      List<String> dependencies,
      String materialRequirement,
      String status,
      String resultNote,
      String reason,
      OffsetDateTime legalDeadline,
      String legalBasis) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparation")
  public record Preparation(
      String tenantId,
      String packageId,
      String venue,
      OffsetDateTime scheduledAt,
      String materialNotes,
      String committeeNotes,
      String drawNotes,
      String evidenceVersionId,
      long version,
      String updatedBy,
      OffsetDateTime updatedAt,
      OffsetDateTime scheduledEndAt,
      String purpose) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationDraft")
  public record PreparationDraft(
      Long expectedVersion,
      String venue,
      OffsetDateTime scheduledAt,
      String materialNotes,
      String committeeNotes,
      String drawNotes,
      String evidenceVersionId,
      OffsetDateTime scheduledEndAt,
      String purpose) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionExecutionView")
  public record ExecutionView(
      List<DemandItem> requirements,
      List<DocumentView> documents,
      PublicationRule publicationRule,
      Readiness readiness,
      List<Publication> publications,
      List<Participation> participations,
      List<Milestone> milestones,
      Preparation preparation,
      List<Job> jobs,
      boolean aiEnabled,
      boolean onlineOfficeEnabled) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReminderSettings")
  public record ReminderSettings(
      Boolean enabled,
      List<Integer> leadHours,
      List<Integer> overdueHours,
      String escalationUserId,
      Integer escalationAfterHours) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReminderPolicy")
  public record ReminderPolicy(
      String tenantId,
      String milestoneId,
      String packageId,
      String settingsJson,
      long version,
      String reason,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReminderDelivery")
  public record ReminderDelivery(
      String id,
      String tenantId,
      String packageId,
      String milestoneId,
      long milestoneVersion,
      long policyVersion,
      String recipientId,
      String level,
      OffsetDateTime dueAt,
      String status,
      int attempts,
      OffsetDateTime nextAttemptAt,
      OffsetDateTime sentAt,
      String errorText,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReminderReceipt")
  public record ReminderReceipt(ReminderDelivery delivery, OffsetDateTime readAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionReminders")
  public record Reminders(
      List<ReminderPolicy> policies, List<ReminderReceipt> deliveries, boolean smsEnabled) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipationImportRow")
  public record ParticipationImportRow(
      int rowNumber, ParticipationDraft data, List<String> errors, List<String> warnings) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipationImport")
  public record ParticipationImport(
      String id,
      String tenantId,
      String packageId,
      String sourceVersionId,
      String sourceHash,
      String sourceName,
      String rowsJson,
      String status,
      long version,
      String resultJson,
      String createdBy,
      OffsetDateTime createdAt,
      String committedBy,
      OffsetDateTime committedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipationImportView")
  public record ParticipationImportView(
      ParticipationImport record,
      List<ParticipationImportRow> rows,
      int errorCount,
      int warningCount) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionParticipationImportSummary")
  public record ParticipationImportSummary(
      String id,
      String sourceName,
      String sourceVersionId,
      String status,
      long version,
      int rowCount,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationPerson")
  public record PreparationPerson(
      String id,
      String tenantId,
      String packageId,
      String name,
      String organization,
      String role,
      String status,
      long version,
      String reason,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationPersonDraft")
  public record PreparationPersonDraft(
      Long expectedVersion,
      String name,
      String organization,
      String role,
      String status,
      String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationForm")
  public record PreparationForm(
      String id,
      String tenantId,
      String packageId,
      String groupId,
      int ordinal,
      String kind,
      String code,
      String title,
      String peopleJson,
      String basisJson,
      String basisHash,
      String bodyText,
      String fileVersionId,
      String fileHash,
      String status,
      long version,
      String supersedesId,
      String createdBy,
      OffsetDateTime createdAt,
      String voidReason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationFormDraft")
  public record PreparationFormDraft(
      Long expectedPackageVersion,
      Long expectedPreparationVersion,
      String kind,
      String title,
      List<String> peopleIds,
      Map<String, Long> peopleVersions,
      String body,
      String newVersionOf,
      boolean contentReviewed,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationReturn")
  public record PreparationReturn(
      String id,
      String tenantId,
      String packageId,
      String formId,
      String peopleJson,
      String fileVersionId,
      String fileHash,
      LocalDate signedOn,
      String note,
      String staleReason,
      String status,
      long version,
      String createdBy,
      OffsetDateTime createdAt,
      String voidReason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationReturnDraft")
  public record PreparationReturnDraft(
      List<String> peopleIds,
      String fileVersionId,
      LocalDate signedOn,
      boolean manuallyConfirmed,
      String note,
      String staleReason,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationFormView")
  public record PreparationFormView(
      PreparationForm form,
      List<PreparationPerson> people,
      boolean stale,
      List<String> currentReturnedPeople) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionPreparationForms")
  public record PreparationForms(
      List<PreparationPerson> people,
      List<PreparationFormView> forms,
      List<PreparationReturn> returns,
      long packageVersion,
      long preparationVersion) {}
}
