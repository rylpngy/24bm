package com.procurement.agency.api;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyOpeningRecords.*;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/evaluation/packages/{pkg}")
public record AgencyOpeningController(
    AgencyOpeningService service,
    AgencyAssessmentStages stages,
    AgencyQuoteService quotes,
    AgencyFinalQuoteService finalQuotes,
    AgencyPriceService prices,
    AgencyTotalService totals,
    AgencyIncidentService incidents,
    AgencyDiscussionService discussions) {
  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningWorkspace")
  @GetMapping("/rounds/{round}/materials")
  public ApiResponse<Workspace> workspace(@PathVariable String pkg, @PathVariable String round) {
    return ApiResponse.ok(service.workspace(pkg, round));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningPlanSave")
  @PutMapping("/rounds/{round}/materials/plan")
  public ApiResponse<Plan> save(
      @PathVariable String pkg, @PathVariable String round, @RequestBody PlanSave r) {
    return ApiResponse.ok(service.savePlan(pkg, round, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningPlanConfirm")
  @PostMapping("/rounds/{round}/materials/plan/confirm")
  public ApiResponse<Plan> confirm(
      @PathVariable String pkg, @PathVariable String round, @RequestBody Confirm r) {
    return ApiResponse.ok(service.confirmPlan(pkg, round, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningReceive")
  @PostMapping("/rounds/{round}/materials/receipts")
  public ApiResponse<ReceiptView> receive(
      @PathVariable String pkg, @PathVariable String round, @RequestBody ReceiptDraft r) {
    return ApiResponse.ok(service.receive(pkg, round, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningReceiptWithdraw")
  @PostMapping("/rounds/{round}/materials/receipts/{id}/withdraw")
  public ApiResponse<Receipt> withdraw(
      @PathVariable String pkg,
      @PathVariable String round,
      @PathVariable String id,
      @RequestBody Confirm r) {
    return ApiResponse.ok(service.withdraw(pkg, round, id, r));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningSelection")
  public record Selection(List<String> participationIds) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningPreview")
  @PostMapping("/rounds/{round}/materials/preview")
  public ApiResponse<Preview> preview(
      @PathVariable String pkg, @PathVariable String round, @RequestBody Selection r) {
    return ApiResponse.ok(service.preview(pkg, round, r.participationIds()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningConfirm")
  @PostMapping("/rounds/{round}/materials/open")
  public ApiResponse<Summary> open(
      @PathVariable String pkg, @PathVariable String round, @RequestBody Open r) {
    return ApiResponse.ok(service.open(pkg, round, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningArtifact")
  @GetMapping("/rounds/{round}/materials/receipts/{id}/artifact")
  public ApiResponse<Map<String, String>> artifact(
      @PathVariable String pkg, @PathVariable String round, @PathVariable String id) {
    return ApiResponse.ok(service.download(pkg, round, id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningStages")
  @GetMapping("/sessions/{session}/stages")
  public ApiResponse<StageBoard> board(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(stages.board(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOpeningReleaseStage")
  @PostMapping("/sessions/{session}/stages/{stage}/release")
  public ApiResponse<Release> release(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String stage,
      @RequestBody ReleaseDraft r) {
    return ApiResponse.ok(stages.release(pkg, session, stage, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyQuoteList")
  @GetMapping("/sessions/{session}/quotes")
  public ApiResponse<java.util.List<AgencyQuoteService.Layer>> quotes(
      @PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(quotes.list(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyQuoteAppend")
  @PostMapping("/sessions/{session}/quotes")
  public ApiResponse<AgencyQuoteService.Layer> appendQuote(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody AgencyQuoteService.Draft r) {
    return ApiResponse.ok(quotes.append(pkg, session, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalQuoteWorkspace")
  @GetMapping("/sessions/{session}/final-quotes")
  public ApiResponse<com.procurement.agency.domain.AgencyFinalQuoteRecords.Workspace>
      finalQuoteWorkspace(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(finalQuotes.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalQuoteStart")
  @PostMapping("/sessions/{session}/final-quotes")
  public ApiResponse<com.procurement.agency.domain.AgencyFinalQuoteRecords.Campaign>
      finalQuoteStart(
          @PathVariable String pkg,
          @PathVariable String session,
          @RequestBody com.procurement.agency.domain.AgencyFinalQuoteRecords.Start r) {
    return ApiResponse.ok(finalQuotes.start(pkg, session, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalQuoteReceive")
  @PostMapping("/sessions/{session}/final-quotes/receipts")
  public ApiResponse<com.procurement.agency.domain.AgencyFinalQuoteRecords.ReceiptView>
      finalQuoteReceive(
          @PathVariable String pkg,
          @PathVariable String session,
          @RequestBody com.procurement.agency.domain.AgencyFinalQuoteRecords.Receive r) {
    return ApiResponse.ok(finalQuotes.receive(pkg, session, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalQuoteWithdraw")
  @PostMapping("/sessions/{session}/final-quotes/receipts/{id}/withdraw")
  public ApiResponse<com.procurement.agency.domain.AgencyFinalQuoteRecords.Receipt>
      finalQuoteWithdraw(
          @PathVariable String pkg,
          @PathVariable String session,
          @PathVariable String id,
          @RequestBody com.procurement.agency.domain.AgencyFinalQuoteRecords.Withdraw r) {
    return ApiResponse.ok(finalQuotes.withdraw(pkg, session, id, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalQuoteConfirm")
  @PostMapping("/sessions/{session}/final-quotes/confirm")
  public ApiResponse<com.procurement.agency.domain.AgencyFinalQuoteRecords.Campaign>
      finalQuoteConfirm(
          @PathVariable String pkg,
          @PathVariable String session,
          @RequestBody com.procurement.agency.domain.AgencyFinalQuoteRecords.Confirm r) {
    return ApiResponse.ok(finalQuotes.confirm(pkg, session, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyPriceWorkspace")
  @GetMapping("/sessions/{session}/price-calculations")
  public ApiResponse<com.procurement.agency.domain.AgencyPriceRecords.Workspace> priceWorkspace(
      @PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(prices.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyPriceRuleSave")
  @PutMapping("/sessions/{session}/price-calculations/rule")
  public ApiResponse<com.procurement.agency.domain.AgencyPriceRecords.RuleRow> priceSave(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyPriceRecords.Save d) {
    return ApiResponse.ok(prices.save(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyPriceRuleFreeze")
  @PostMapping("/sessions/{session}/price-calculations/rule/freeze")
  public ApiResponse<com.procurement.agency.domain.AgencyPriceRecords.RuleRow> priceFreeze(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyPriceRecords.Freeze d) {
    return ApiResponse.ok(prices.freeze(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyPricePreview")
  @PostMapping("/sessions/{session}/price-calculations/preview")
  public ApiResponse<com.procurement.agency.domain.AgencyPriceRecords.Preview> pricePreview(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyPriceRecords.Scope d) {
    return ApiResponse.ok(prices.preview(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyPriceConfirm")
  @PostMapping("/sessions/{session}/price-calculations")
  public ApiResponse<com.procurement.agency.domain.AgencyPriceRecords.Calculation> priceConfirm(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyPriceRecords.Confirm d) {
    return ApiResponse.ok(prices.confirm(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyTotalWorkspace")
  @GetMapping("/sessions/{session}/totals")
  public ApiResponse<com.procurement.agency.domain.AgencyTotalRecords.Workspace> totalWorkspace(
      @PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(totals.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyTotalRuleSave")
  @PutMapping("/sessions/{session}/totals/rule")
  public ApiResponse<com.procurement.agency.domain.AgencyTotalRecords.RuleRow> totalSave(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyTotalRecords.Save d) {
    return ApiResponse.ok(totals.save(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyTotalRuleFreeze")
  @PostMapping("/sessions/{session}/totals/rule/freeze")
  public ApiResponse<com.procurement.agency.domain.AgencyTotalRecords.RuleRow> totalFreeze(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyTotalRecords.Freeze d) {
    return ApiResponse.ok(totals.freeze(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyTotalPreview")
  @PostMapping("/sessions/{session}/totals/preview")
  public ApiResponse<com.procurement.agency.domain.AgencyTotalRecords.Preview> totalPreview(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyTotalRecords.Selection d) {
    return ApiResponse.ok(totals.preview(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyTotalConfirm")
  @PostMapping("/sessions/{session}/totals")
  public ApiResponse<com.procurement.agency.domain.AgencyTotalRecords.Snapshot> totalConfirm(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyTotalRecords.Confirm d) {
    return ApiResponse.ok(totals.confirm(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyIncidentWorkspace")
  @GetMapping("/rounds/{round}/incidents")
  public ApiResponse<com.procurement.agency.domain.AgencyIncidentRecords.Workspace>
      incidentWorkspace(@PathVariable String pkg, @PathVariable String round) {
    return ApiResponse.ok(incidents.workspace(pkg, round));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyIncidentCreate")
  @PostMapping("/rounds/{round}/incidents")
  public ApiResponse<com.procurement.agency.domain.AgencyIncidentRecords.Incident> incidentCreate(
      @PathVariable String pkg,
      @PathVariable String round,
      @RequestBody com.procurement.agency.domain.AgencyIncidentRecords.Create d) {
    return ApiResponse.ok(incidents.create(pkg, round, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyIncidentResolve")
  @PostMapping("/rounds/{round}/incidents/{id}/resolve")
  public ApiResponse<com.procurement.agency.domain.AgencyIncidentRecords.Incident> incidentResolve(
      @PathVariable String pkg,
      @PathVariable String round,
      @PathVariable String id,
      @RequestBody com.procurement.agency.domain.AgencyIncidentRecords.Resolution d) {
    return ApiResponse.ok(incidents.resolve(pkg, round, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationControlStatus")
  @GetMapping("/rounds/{round}/control")
  public ApiResponse<com.procurement.agency.domain.AgencyIncidentRecords.Status> incidentStatus(
      @PathVariable String pkg, @PathVariable String round) {
    return ApiResponse.ok(incidents.status(pkg, round));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationControlCommand")
  @PostMapping("/rounds/{round}/control/{action}")
  public ApiResponse<com.procurement.agency.domain.AgencyIncidentRecords.Control> incidentCommand(
      @PathVariable String pkg,
      @PathVariable String round,
      @PathVariable String action,
      @RequestBody com.procurement.agency.domain.AgencyIncidentRecords.Command d) {
    return ApiResponse.ok(incidents.command(pkg, round, action, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionWorkspace")
  @GetMapping("/sessions/{session}/discussions")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Workspace>
      discussionWorkspace(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(discussions.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionActivate")
  @PostMapping("/sessions/{session}/discussions/activate")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Plan> discussionActivate(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestBody com.procurement.agency.domain.AgencyDiscussionRecords.Activate d) {
    return ApiResponse.ok(discussions.activate(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionLedger")
  @GetMapping("/sessions/{session}/discussions/{participant}")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Ledger> discussionLedger(
      @PathVariable String pkg, @PathVariable String session, @PathVariable String participant) {
    return ApiResponse.ok(discussions.ledger(pkg, session, participant));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionSave")
  @PutMapping("/sessions/{session}/discussions/{participant}/draft")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Row> discussionSave(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String participant,
      @RequestBody com.procurement.agency.domain.AgencyDiscussionRecords.Save d) {
    return ApiResponse.ok(discussions.save(pkg, session, participant, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionConfirm")
  @PostMapping("/sessions/{session}/discussions/{participant}/{id}/confirm")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Row> discussionConfirm(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String participant,
      @PathVariable String id,
      @RequestBody com.procurement.agency.domain.AgencyDiscussionRecords.Confirm d) {
    return ApiResponse.ok(discussions.confirm(pkg, session, participant, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDiscussionVoid")
  @PostMapping("/sessions/{session}/discussions/{participant}/{id}/void")
  public ApiResponse<com.procurement.agency.domain.AgencyDiscussionRecords.Row> discussionVoid(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String participant,
      @PathVariable String id,
      @RequestBody com.procurement.agency.domain.AgencyDiscussionRecords.VoidDraft d) {
    return ApiResponse.ok(discussions.voidDraft(pkg, session, participant, id, d));
  }
}
