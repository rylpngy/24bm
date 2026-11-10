package com.procurement.agency.api;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.common.api.ApiResponse;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/execution")
public record AgencyExecutionController(
    AgencyExecutionService service,
    AgencyTemplateService templates,
    AgencyDemandService demands,
    AgencyDocumentService documents,
    AgencyPublicationService publications,
    AgencyCollaborationService collaboration,
    AgencyReminderService reminders,
    AgencyParticipationImportService imports,
    AgencyPreparationFormsService preparationForms) {
  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestPlanConfig")
  public record PlanConfig(Long expectedVersion, List<PlanNode> nodes, String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPlanTemplate")
  @GetMapping("/plan-templates")
  public ApiResponse<PlanTemplate> planTemplate(@RequestParam String procurementMethod) {
    return ApiResponse.ok(collaboration.planTemplate(procurementMethod));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionSavePlanTemplate")
  @PutMapping("/plan-templates")
  public ApiResponse<PlanTemplate> savePlanTemplate(
      @RequestParam String procurementMethod, @RequestBody PlanConfig r) {
    return ApiResponse.ok(
        collaboration.savePlanTemplate(
            procurementMethod, r.expectedVersion(), r.nodes(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionMilestoneCreate")
  @PostMapping("/packages/{pkg}/milestones")
  public ApiResponse<Milestone> milestoneCreate(
      @PathVariable String pkg, @RequestBody MilestoneDraft r) {
    return ApiResponse.ok(collaboration.createMilestone(pkg, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionArtifact")
  @GetMapping("/revisions/{id}/artifact")
  public ApiResponse<Map<String, String>> artifact(@PathVariable String id) {
    return ApiResponse.ok(documents.artifact(id));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestSources")
  public record Sources(List<String> sourceVersionIds, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestChoose")
  public record Choose(Long expectedVersion, String templateVersionId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestVersion")
  public record Version(Long expectedVersion) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestCompose")
  public record Compose(Long expectedVersion, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestWhole")
  public record Whole(
      Long expectedVersion,
      String fileVersionId,
      boolean manuallyConfirmed,
      String note,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestSubmit")
  public record Submit(
      String idempotencyKey, String exceptionReason, Map<String, Object> formData) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestReason")
  public record Reason(String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestRule")
  public record Rule(
      Long expectedVersion, boolean applicable, String reason, String evidenceVersionId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestPublish")
  public record Publish(
      String idempotencyKey,
      String purchaseRevisionId,
      String announcementRevisionId,
      String platform,
      OffsetDateTime publishedAt,
      String url,
      String evidenceVersionId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestHistorical")
  public record Historical(Long expectedVersion, String sourceRevisionId, String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionHistorical")
  @GetMapping("/historical-documents")
  public ApiResponse<List<Map<String, Object>>> historical(
      @RequestParam(defaultValue = "") String procurementMethod,
      @RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(documents.historical(procurementMethod, keyword));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionReuse")
  @PostMapping("/documents/{id}/historical")
  public ApiResponse<DocumentView> reuse(@PathVariable String id, @RequestBody Historical r) {
    return ApiResponse.ok(
        documents.reuseHistory(id, r.expectedVersion(), r.sourceRevisionId(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionTemplateWithdraw")
  @PostMapping("/template-versions/{id}/withdraw")
  public ApiResponse<TemplateVersion> templateWithdraw(
      @PathVariable String id, @RequestBody Reason r) {
    return ApiResponse.ok(templates.withdraw(id, r.reason()));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestActive")
  public record Active(Long expectedVersion, boolean active, String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionWorkspace")
  @GetMapping("/packages/{pkg}")
  public ApiResponse<ExecutionView> workspace(@PathVariable String pkg) {
    return ApiResponse.ok(service.workspace(pkg));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionInitialize")
  @PostMapping("/packages/{pkg}/documents")
  public ApiResponse<List<DocumentView>> initialize(@PathVariable String pkg) {
    return ApiResponse.ok(documents.ensure(pkg));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionSearch")
  @GetMapping("/packages/{pkg}/templates")
  public ApiResponse<List<TemplateView>> search(
      @PathVariable String pkg,
      @RequestParam(defaultValue = "") String procurementMethod,
      @RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(templates.search(pkg, procurementMethod, keyword));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionTemplate")
  @PostMapping("/templates")
  public ApiResponse<TemplateView> template(@RequestBody TemplateDraft d) {
    return ApiResponse.ok(templates.create(d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionTemplateVersion")
  @PostMapping("/templates/{id}/versions")
  public ApiResponse<TemplateView> templateVersion(
      @PathVariable String id, @RequestBody TemplateDraft d) {
    return ApiResponse.ok(templates.next(id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionTemplateSubmit")
  @PostMapping("/template-versions/{id}/submit")
  public ApiResponse<TemplateVersion> templateSubmit(
      @PathVariable String id, @RequestBody Submit r) {
    return ApiResponse.ok(templates.submit(id, r.idempotencyKey(), r.formData()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionTemplateActive")
  @PostMapping("/templates/{id}/active")
  public ApiResponse<Template> templateActive(@PathVariable String id, @RequestBody Active r) {
    return ApiResponse.ok(templates.active(id, r.expectedVersion(), r.active(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionDemandCreate")
  @PostMapping("/packages/{pkg}/requirements")
  public ApiResponse<DemandItem> demandCreate(
      @PathVariable String pkg, @RequestBody DemandDraft d) {
    return ApiResponse.ok(demands.save(pkg, null, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionDemandEdit")
  @PutMapping("/packages/{pkg}/requirements/{id}")
  public ApiResponse<DemandItem> demandEdit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody DemandDraft d) {
    return ApiResponse.ok(demands.save(pkg, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionExtraction")
  @PostMapping("/packages/{pkg}/extractions")
  public ApiResponse<Job> extraction(@PathVariable String pkg, @RequestBody Sources r) {
    return ApiResponse.ok(demands.extract(pkg, r.sourceVersionIds(), r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionDocumentSave")
  @PutMapping("/documents/{id}")
  public ApiResponse<DocumentView> documentSave(
      @PathVariable String id, @RequestBody DocumentDraft d) {
    return ApiResponse.ok(documents.save(id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionChoose")
  @PostMapping("/documents/{id}/template")
  public ApiResponse<DocumentView> choose(@PathVariable String id, @RequestBody Choose r) {
    return ApiResponse.ok(documents.choose(id, r.expectedVersion(), r.templateVersionId()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionSync")
  @PostMapping("/documents/{id}/sync")
  public ApiResponse<DocumentView> sync(@PathVariable String id, @RequestBody Version r) {
    return ApiResponse.ok(documents.sync(id, r.expectedVersion()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionSyncNotice")
  @PostMapping("/documents/{id}/sync-notice")
  public ApiResponse<DocumentView> syncNotice(@PathVariable String id, @RequestBody Version r) {
    return ApiResponse.ok(documents.syncNotice(id, r.expectedVersion()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionCompose")
  @PostMapping("/documents/{id}/compose")
  public ApiResponse<Job> compose(@PathVariable String id, @RequestBody Compose r) {
    return ApiResponse.ok(documents.compose(id, r.expectedVersion(), r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionWhole")
  @PostMapping("/documents/{id}/whole")
  public ApiResponse<Revision> whole(@PathVariable String id, @RequestBody Whole r) {
    return ApiResponse.ok(
        documents.importWhole(
            id,
            r.expectedVersion(),
            r.fileVersionId(),
            r.manuallyConfirmed(),
            r.note(),
            r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionSubmit")
  @PostMapping("/revisions/{id}/submit")
  public ApiResponse<Revision> submit(@PathVariable String id, @RequestBody Submit r) {
    return ApiResponse.ok(
        documents.submit(id, r.idempotencyKey(), r.exceptionReason(), r.formData()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionWithdraw")
  @PostMapping("/revisions/{id}/withdraw")
  public ApiResponse<Revision> withdraw(@PathVariable String id, @RequestBody Reason r) {
    return ApiResponse.ok(documents.withdraw(id, r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionRule")
  @PostMapping("/packages/{pkg}/publication-rule")
  public ApiResponse<PublicationRule> rule(@PathVariable String pkg, @RequestBody Rule r) {
    return ApiResponse.ok(
        publications.rule(
            pkg, r.expectedVersion(), r.applicable(), r.reason(), r.evidenceVersionId()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPublication")
  @PostMapping("/packages/{pkg}/publications")
  public ApiResponse<Publication> publication(@PathVariable String pkg, @RequestBody Publish r) {
    return ApiResponse.ok(
        publications.record(
            pkg,
            r.idempotencyKey(),
            r.purchaseRevisionId(),
            r.announcementRevisionId(),
            r.platform(),
            r.publishedAt(),
            r.url(),
            r.evidenceVersionId()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionParticipationCreate")
  @PostMapping("/packages/{pkg}/participations")
  public ApiResponse<Participation> participationCreate(
      @PathVariable String pkg, @RequestBody ParticipationDraft d) {
    return ApiResponse.ok(collaboration.saveParticipation(pkg, null, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionParticipationEdit")
  @PutMapping("/packages/{pkg}/participations/{id}")
  public ApiResponse<Participation> participationEdit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody ParticipationDraft d) {
    return ApiResponse.ok(collaboration.saveParticipation(pkg, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionMilestone")
  @PutMapping("/packages/{pkg}/milestones/{id}")
  public ApiResponse<Milestone> milestone(
      @PathVariable String pkg, @PathVariable String id, @RequestBody MilestoneDraft d) {
    return ApiResponse.ok(collaboration.updateMilestone(pkg, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparation")
  @PutMapping("/packages/{pkg}/preparation")
  public ApiResponse<Preparation> preparation(
      @PathVariable String pkg, @RequestBody PreparationDraft d) {
    return ApiResponse.ok(collaboration.prepare(pkg, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionJob")
  @GetMapping("/jobs/{id}")
  public ApiResponse<Job> job(@PathVariable String id) {
    return ApiResponse.ok(service.job(id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionRetry")
  @PostMapping("/jobs/{id}/retry")
  public ApiResponse<Job> retry(@PathVariable String id) {
    return ApiResponse.ok(service.retry(id));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestReminder")
  public record ReminderRequest(Long expectedVersion, ReminderSettings settings, String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionReminders")
  @GetMapping("/packages/{pkg}/reminders")
  public ApiResponse<Reminders> reminders(@PathVariable String pkg) {
    return ApiResponse.ok(reminders.view(pkg));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionReminderPolicy")
  @PutMapping("/packages/{pkg}/milestones/{id}/reminders")
  public ApiResponse<ReminderPolicy> reminderPolicy(
      @PathVariable String pkg, @PathVariable String id, @RequestBody ReminderRequest r) {
    return ApiResponse.ok(reminders.save(pkg, id, r.expectedVersion(), r.settings(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionReminderRetry")
  @PostMapping("/packages/{pkg}/reminders/{id}/retry")
  public ApiResponse<ReminderDelivery> retryReminder(
      @PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(reminders.retry(pkg, id));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestPromotion")
  public record Promotion(
      String name,
      String sourceNote,
      java.time.LocalDate sourceDate,
      String policyVersion,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPromoteTemplate")
  @PostMapping("/template-versions/{id}/promote")
  public ApiResponse<TemplateView> promote(@PathVariable String id, @RequestBody Promotion r) {
    return ApiResponse.ok(
        templates.promote(
            id, r.name(), r.sourceNote(), r.sourceDate(), r.policyVersion(), r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestImportPreview")
  public record ImportPreview(String sourceVersionId, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestImportCommit")
  public record ImportCommit(
      Long expectedVersion,
      boolean manuallyConfirmed,
      boolean allowDuplicates,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionImportPreview")
  @PostMapping("/packages/{pkg}/participation-imports")
  public ApiResponse<ParticipationImportView> importPreview(
      @PathVariable String pkg, @RequestBody ImportPreview r) {
    return ApiResponse.ok(imports.preview(pkg, r.sourceVersionId(), r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionImportView")
  @GetMapping("/packages/{pkg}/participation-imports/{id}")
  public ApiResponse<ParticipationImportView> importView(
      @PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(imports.view(pkg, id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionImportCommit")
  @PostMapping("/packages/{pkg}/participation-imports/{id}/commit")
  public ApiResponse<ParticipationImportView> importCommit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody ImportCommit r) {
    return ApiResponse.ok(
        imports.commit(
            pkg,
            id,
            r.expectedVersion(),
            r.manuallyConfirmed(),
            r.allowDuplicates(),
            r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionImportRecent")
  @GetMapping("/packages/{pkg}/participation-imports")
  public ApiResponse<List<ParticipationImportSummary>> recentImports(@PathVariable String pkg) {
    return ApiResponse.ok(imports.recent(pkg));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyExecutionRequestPreparationVoid")
  public record PreparationVoid(Long expectedVersion, String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationForms")
  @GetMapping("/packages/{pkg}/preparation-forms")
  public ApiResponse<PreparationForms> preparationForms(@PathVariable String pkg) {
    return ApiResponse.ok(preparationForms.workspace(pkg));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationPersonCreate")
  @PostMapping("/packages/{pkg}/preparation-people")
  public ApiResponse<PreparationPerson> preparationPerson(
      @PathVariable String pkg, @RequestBody PreparationPersonDraft d) {
    return ApiResponse.ok(preparationForms.person(pkg, null, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationPersonUpdate")
  @PutMapping("/packages/{pkg}/preparation-people/{id}")
  public ApiResponse<PreparationPerson> preparationPersonEdit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody PreparationPersonDraft d) {
    return ApiResponse.ok(preparationForms.person(pkg, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationFormGenerate")
  @PostMapping("/packages/{pkg}/preparation-forms")
  public ApiResponse<PreparationFormView> preparationFormGenerate(
      @PathVariable String pkg, @RequestBody PreparationFormDraft d) {
    return ApiResponse.ok(preparationForms.generate(pkg, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationFormVoid")
  @PostMapping("/packages/{pkg}/preparation-forms/{id}/void")
  public ApiResponse<PreparationForm> preparationFormVoid(
      @PathVariable String pkg, @PathVariable String id, @RequestBody PreparationVoid d) {
    return ApiResponse.ok(preparationForms.voidForm(pkg, id, d.expectedVersion(), d.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationFormArtifact")
  @GetMapping("/packages/{pkg}/preparation-forms/{id}/artifact")
  public ApiResponse<Map<String, String>> preparationFormArtifact(
      @PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(preparationForms.artifact(pkg, id, false));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationReturnCreate")
  @PostMapping("/packages/{pkg}/preparation-forms/{id}/returns")
  public ApiResponse<PreparationReturn> preparationReturn(
      @PathVariable String pkg, @PathVariable String id, @RequestBody PreparationReturnDraft d) {
    return ApiResponse.ok(preparationForms.recordReturn(pkg, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationReturnVoid")
  @PostMapping("/packages/{pkg}/preparation-returns/{id}/void")
  public ApiResponse<PreparationReturn> preparationReturnVoid(
      @PathVariable String pkg, @PathVariable String id, @RequestBody PreparationVoid d) {
    return ApiResponse.ok(preparationForms.voidReturn(pkg, id, d.expectedVersion(), d.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyExecutionPreparationReturnArtifact")
  @GetMapping("/packages/{pkg}/preparation-returns/{id}/artifact")
  public ApiResponse<Map<String, String>> preparationReturnArtifact(
      @PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(preparationForms.artifact(pkg, id, true));
  }
}
