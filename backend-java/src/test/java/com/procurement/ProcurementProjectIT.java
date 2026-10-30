package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.application.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.process.api.*;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(
    classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class ProcurementProjectIT {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired ProcurementProjectService projects;
  @Autowired ProjectAttachmentAccess attachments;
  @Autowired BudgetControlService budget;
  @Autowired PurchaseDemandApplicationService demands;
  @Autowired UnifiedWorkflowApplicationService workflow;
  @Autowired ProcessDefinitionApplicationService definitions;
  @Autowired Validator validator;
  @Autowired com.procurement.sourcing.application.RfqApplicationService rfqs;
  @Autowired ProjectExpansionService expansion;
  @Autowired ProcurementProjectGuard projectGuard;
  @Autowired ProjectAllocationPolicy allocation;
  @Autowired ProjectCloseoutService closeout;
  @Autowired ProjectMallService projectMall;
  @Autowired ProjectChangeAttachmentAccess changeAttachments;
  @Autowired ProjectLifecycleService lifecycle;
  @Autowired com.procurement.finance.application.PaymentLedgerApplicationService paymentLedger;
  @Autowired com.procurement.finance.application.FrozenPaymentCorrectionService corrections;
  @Autowired FundingService funding;
  @Autowired FundingCarryoverService fundingCarryover;
  @Autowired ProjectReopenService reopening;
  com.procurement.buyer.api.ProjectLifecycleContracts.Request reopenRequest(String id,String lot){
    return new com.procurement.buyer.api.ProjectLifecycleContracts.Request(projects.detail(id).project().revision(),"reopen",null,"核对关闭依据后独立审批恢复办理",Map.of(),null,lot,lot==null?null:expansion.packages(id).stream().filter(l->l.info().id().equals(lot)).findFirst().orElseThrow().info().revision());
  }
  @Test void terminatedProjectReopensIndependentlyWithoutRevivingCancelledDemand(){
    var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    closeout.terminate(p.id(),new Action(projects.detail(p.id()).project().revision(),"不再采购",Map.of()));
    var old=projects.demands(p.id()).stream().map(d->d.id()+":"+d.status()).toList();
    var r=lifecycle.submit(p.id(),reopenRequest(p.id(),null));assertThat(projects.detail(p.id()).project().status()).isEqualTo("terminated");
    String initialReopenId=r.id();assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(initialReopenId));
    lifecycle.withdraw(p.id(),r.id(),r.revision(),"重新核对");assertThat(projects.detail(p.id()).project().status()).isEqualTo("terminated");
    r=lifecycle.submit(p.id(),reopenRequest(p.id(),null));decide(r.id(),"reject");context(author);assertThat(projects.detail(p.id()).project().status()).isEqualTo("terminated");
    r=lifecycle.submit(p.id(),reopenRequest(p.id(),null));decide(r.id(),"approve");context(author);
    assertThat(projects.detail(p.id()).project().status()).isEqualTo("approved");assertThat(projects.demands(p.id()).stream().map(d->d.id()+":"+d.status()).toList()).isEqualTo(old);
    assertThat(expansion.packages(p.id()).getFirst().info().status()).isEqualTo("cancelled");assertThat(reopening.preview(p.id(),null).blockers()).isNotEmpty();
    assertThat(lifecycle.history(p.id(),1,2).total()).isEqualTo(3);assertThat(lifecycle.history(p.id(),2,2).items()).hasSize(1);
  }
  FundedCase closedFundedProject(boolean terminated)throws Exception{
    var f=fundedPaidCase();var e=approveSettlement(f.order(),fundedSettlement(f,"5","10","closed"));String proof=e.agreementId();
    settlements.evidence(f.order().order(),e.id(),fundEvidence(f,"refund","40","10","30",proof,"close-refund"));settlementCash(f.order(),e,"invoice","10",f.invoice(),proof,"close-invoice");settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);
    expansion.closePackage(f.order().project(),f.order().lot(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(expansion.packages(f.order().project()).getFirst().info().revision(),"清算归档"));
    if(terminated){var r=lifecycle.submit(f.order().project(),lifecycleRequest(f.order().project(),"liquidation",null));decide(r.id(),"approve");context(author);}else expansion.closeProject(f.order().project(),new Action(projects.detail(f.order().project()).project().revision(),"整项目结项",Map.of()));
    return f;
  }
  @Test void closedProjectAndSelectedPackageReopenPreserveCashAndAllowSupplementalSettlement()throws Exception{
    var f=closedFundedProject(false);var old=jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where tenant_id=?",String.class,tenant);
    var archives=jdbc.queryForList("select id,snapshot::text,sha256 from procurement_execution_archives where tenant_id=? order by id",tenant);
    var withdrawn=lifecycle.submit(f.order().project(),reopenRequest(f.order().project(),null));var originalClosure=reopening.archive(f.order().project(),withdrawn.id());lifecycle.withdraw(f.order().project(),withdrawn.id(),withdrawn.revision(),"补充依据");
    var rejected=lifecycle.submit(f.order().project(),reopenRequest(f.order().project(),null));assertThat(reopening.archive(f.order().project(),rejected.id())).isEqualTo(originalClosure);decide(rejected.id(),"reject");context(author);
    var projectOnly=lifecycle.submit(f.order().project(),reopenRequest(f.order().project(),null));assertThat(projectOnly.amount()).isEqualByComparingTo("236.91");var closureZip=reopening.archive(f.order().project(),projectOnly.id());assertThat(closureZip).startsWith((byte)80,(byte)75);decide(projectOnly.id(),"approve");context(author);assertThat(reopening.archive(f.order().project(),projectOnly.id())).isEqualTo(closureZip);
    assertThat(expansion.packages(f.order().project()).getFirst().info().status()).isEqualTo("closed");
    assertThat(settlements.view(f.order().order(),false,1,10).preview().blockers()).anyMatch(b->b.contains("分包已关闭"));
    var request=lifecycle.submit(f.order().project(),reopenRequest(f.order().project(),f.order().lot()));assertThat(request.amount()).isZero();decide(request.id(),"approve");context(author);
    assertThat(expansion.packages(f.order().project()).getFirst().info().status()).isEqualTo("ready");
    assertThat(jdbc.queryForList("select id,snapshot::text,sha256 from procurement_execution_archives where tenant_id=? order by id",tenant)).isEqualTo(archives);
    String parent=jdbc.queryForObject("select id from order_settlements where tenant_id=?",String.class,tenant),line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());
    var e=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("after-project-reopen","结项重开后补充清算20",BigDecimal.ZERO,settlementProof(f.order()),List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,BigDecimal.TEN)),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("20"))),parent));
    assertThat(e.snapshot()).contains(request.id());e=approveSettlement(f.order(),e);settlements.evidence(f.order().order(),e.id(),fundEvidence(f,"payment","10","10","0",e.agreementId(),"new-pay"));settlementCash(f.order(),e,"invoice","20",f.invoice(),e.agreementId(),"new-invoice");settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,parent)).isEqualTo(old);assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");assertThat(settlements.detail(f.order().order(),e.id(),false).netPaid()).isEqualByComparingTo("20");
  }
  @Test void reopenRechecksReleasedSourceCapacityAtApprovalAndCannotBypassDatabase()throws Exception{
    var f=closedFundedProject(true);String project=f.order().project();
    assertThatThrownBy(()->jdbc.update("update procurement_projects set status='approved' where id=?",project)).hasMessageContaining("separately approved");
    assertThatThrownBy(()->jdbc.update("update procurement_project_packages set status='ready' where id=?",f.order().lot())).hasMessageContaining("separately approved");
    var r=lifecycle.submit(project,reopenRequest(project,f.order().lot()));
    var source=funding.funds(1,100).items().stream().filter(x->x.id().equals(f.a())).findFirst().orElseThrow();var reduced=funding.submit(fundLimit(source,"50","released-capacity-used"));decide(reduced.id(),"approve");context(author);
    assertThatThrownBy(()->decide(r.id(),"approve")).hasMessageContaining("额度不足");context(author);
    assertThat(projects.detail(project).project().status()).isEqualTo("terminated");assertThat(expansion.packages(project).getFirst().info().status()).isEqualTo("closed");assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
    decide(r.id(),"reject");context(author);assertThat(reopening.preview(project,f.order().lot()).blockers()).anyMatch(x->x.contains("额度不足"));
  }
  @Test void ordinaryArchivedContractNeedsApprovedProjectAndPackageReopenBeforeFirstSettlement()throws Exception{
    var f=fundedPaidCase();String contract=settlementContract(f.order(),true);fundedCash(f.invoice(),f.a(),f.b(),"80","70");jdbc.update("update invoices set payment_status='已付款' where id=?",f.invoice());jdbc.update("update contracts set archive_status='已归档' where id=?",contract);
    expansion.closeProject(f.order().project(),new Action(projects.detail(f.order().project()).project().revision(),"正常履约结项",Map.of()));
    assertThat(settlements.view(f.order().order(),false,1,10).preview().blockers()).isNotEmpty();
    var r=lifecycle.submit(f.order().project(),reopenRequest(f.order().project(),f.order().lot()));decide(r.id(),"approve");context(author);
    assertThat(settlements.view(f.order().order(),false,1,10).preview().blockers()).isEmpty();
    String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order()),proof=settlementProof(f.order());
    var e=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("first-after-close","正常合同归档后补充价款核验",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("90"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("180")))));e=approveSettlement(f.order(),e);
    settlements.evidence(f.order().order(),e.id(),fundEvidence(f,"refund","20","10","10",proof,"refund"));settlementCash(f.order(),e,"invoice","180",f.invoice(),proof,"final");settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(settlements.detail(f.order().order(),e.id(),false).netPaid()).isEqualByComparingTo("180");assertThat(jdbc.queryForObject("select amount from contracts where id=?",BigDecimal.class,contract)).isEqualByComparingTo("200");
  }
  @Test void reopenRejectsUnapprovedTerminationsForeignPackagesAndStaleVersions(){
    var draft=projects.create(draft(0)).project();closeout.terminate(draft.id(),new Action(draft.revision(),"尚未批准取消",Map.of()));
    assertThatThrownBy(()->lifecycle.submit(draft.id(),reopenRequest(draft.id(),null))).hasMessageContaining("原立项批准");
    var p=approve(projects.create(draft(0))).project();closeout.terminate(p.id(),new Action(p.revision(),"未采购取消",Map.of()));
    assertThatThrownBy(()->lifecycle.submit(p.id(),new com.procurement.buyer.api.ProjectLifecycleContracts.Request(p.revision(),"reopen",null,"过期版本",Map.of()))).hasMessageContaining("已变化");
    assertThatThrownBy(()->lifecycle.submit(p.id(),new com.procurement.buyer.api.ProjectLifecycleContracts.Request(projects.detail(p.id()).project().revision(),"reopen",null,"外部分包",Map.of(),null,"foreign",1))).hasMessageContaining("所选分包");
  }
  record FundedCase(CancelCase order,String invoice,String entry,String a,String b){}
  @Test void compensationReopenRefundsAndTopupsIndependentlyWithoutOverwritingPriorRecords()throws Exception{
    var c=cancellationCase();settlementContract(c,true);String line=receivedLine(c),proof=settlementProof(c);
    var first=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("comp-first","货款100及补偿20分别核验",new BigDecimal("20"),proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("50"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation("~unbilled",new BigDecimal("100")))));
    first=approveSettlement(c,first);
    settlementCash(c,first,"payment","100","~unbilled",proof,"goods");settlementCash(c,first,"payment","20","~compensation",proof,"comp");settlementCash(c,first,"invoice","100","~unbilled",proof,"invoice");settlementCash(c,first,"compensation_receipt","20","~compensation",proof,"receipt");
    settlements.act(c.order(),first.id(),settlementAction(first,"complete"),false);
    String old=jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,first.id());
    var second=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("comp-zero","新协议取消补偿，货款不变",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("50"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation("~unbilled",new BigDecimal("100"))),first.id()));
    assertThat(second.initialPaid()).isEqualByComparingTo("120");second=approveSettlement(c,second);var approved=second;
    assertThat(settlements.detail(c.order(),second.id(),false).refundDue()).isEqualByComparingTo("20");
    assertThatThrownBy(()->settlementCash(c,approved,"refund","20","~unbilled",proof,"wrong-source")).hasMessageContaining("超过");
    settlementCash(c,second,"refund","20","~compensation",proof,"refund");settlementCash(c,second,"invoice","100","~unbilled",proof,"invoice");
    assertThatThrownBy(()->settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false)).hasMessageContaining("补偿凭证");
    settlementCash(c,second,"compensation_receipt","0","~compensation",proof,"cancel-receipt");settlements.act(c.order(),second.id(),settlementAction(second,"complete"),false);
    var third=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("comp-again","货款减20，补偿增30，不能只补差额10",new BigDecimal("30"),proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("40"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation("~unbilled",new BigDecimal("80"))),second.id()));third=approveSettlement(c,third);
    var detail=settlements.detail(c.order(),third.id(),false);assertThat(detail.refundDue()).isEqualByComparingTo("20");assertThat(detail.paymentDue()).isEqualByComparingTo("30");
    settlementCash(c,third,"refund","20","~unbilled",proof,"goods-refund");settlementCash(c,third,"payment","30","~compensation",proof,"comp-topup");settlementCash(c,third,"invoice","80","~unbilled",proof,"invoice");settlementCash(c,third,"compensation_receipt","30","~compensation",proof,"receipt");settlements.act(c.order(),third.id(),settlementAction(third,"complete"),false);
    assertThat(jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,first.id())).isEqualTo(old);assertThat(jdbc.queryForObject("select count(*) from effective_order_settlements where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("110");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("110");
  }
  void settlementCash(CancelCase c,com.procurement.order.api.OrderSettlementContracts.Entry e,String kind,String amount,String source,String proof,String key){settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest(key,kind,new BigDecimal(amount),"PROOF-"+key,proof,"双方补充协议及实际凭证核验",source));}

  @Test void fundedCompensationReopenRefundsOnlyItsActualOriginalSource()throws Exception{
    var f=fundedPaidCase();settlementContract(f.order(),true);String proof=settlementProof(f.order()),line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());
    var first=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("fund-comp","货款10及补偿20",new BigDecimal("20"),proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("5"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("10")))));first=approveSettlement(f.order(),first);
    settlements.evidence(f.order().order(),first.id(),fundEvidence(f,"refund","40","10","30",proof,"goods-refund"));
    settlements.evidence(f.order().order(),first.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("comp-pay","payment",new BigDecimal("20"),"COMP-PAY",proof,"实际补偿款支付","~compensation",List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.a(),new BigDecimal("20")))));
    settlementCash(f.order(),first,"invoice","10",f.invoice(),proof,"invoice");settlementCash(f.order(),first,"compensation_receipt","20","~compensation",proof,"receipt");settlements.act(f.order().order(),first.id(),settlementAction(first,"complete"),false);
    var second=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("fund-comp-reopen","补偿调减至5",new BigDecimal("5"),proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("5"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("10"))),first.id()));second=approveSettlement(f.order(),second);var approved=second;
    assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("wrong","refund",new BigDecimal("15"),"BAD-COMP-REFUND",proof,"来源B未支付补偿","~compensation",List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.b(),new BigDecimal("15")))))).hasMessageContaining("超过");
    settlements.evidence(f.order().order(),second.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("comp-refund","refund",new BigDecimal("15"),"COMP-REFUND",proof,"来源A原补偿退款","~compensation",List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.a(),new BigDecimal("15")))));
    settlementCash(f.order(),second,"invoice","10",f.invoice(),proof,"invoice");settlementCash(f.order(),second,"compensation_receipt","5","~compensation",proof,"receipt");settlements.act(f.order().order(),second.id(),settlementAction(second,"complete"),false);
    assertThat(settlements.detail(f.order().order(),second.id(),false).netPaid()).isEqualByComparingTo("15");assertThat(funding.project(f.order().project()).sources().stream().map(x->x.paidAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("15");assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
  }

  @Test void frozenFundedRefundRestoresCurrentResponsibilityWithoutChangingHistoricalBasis()throws Exception{
    var f=fundedPaidCase();settlementContract(f.order(),true);String proof=settlementProof(f.order());var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");
    var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    String frozen=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carry.id());
    String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());
    var e=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("cross-year","历史现金退原年度，当年责任明确回补",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("5"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("10")))));e=approveSettlement(f.order(),e);var approved=e;
    var missing=fundEvidence(f,"refund","40","10","30",proof,"missing-target");assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),missing)).hasMessageContaining("年度");
    var refund=new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("refund","refund",new BigDecimal("40"),"CROSS-BANK",proof,"原年退款，回补当年责任",f.invoice(),List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.a(),new BigDecimal("10"),a.id()),new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.b(),new BigDecimal("30"),b.id())),year);
    settlements.evidence(f.order().order(),e.id(),refund);settlements.evidence(f.order().order(),e.id(),refund);
    settlements.evidence(f.order().order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("final","invoice",new BigDecimal("10"),"CREDIT",proof,"最终发票核对",f.invoice()));
    settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("10");assertThat(funding.project(f.order().project()).sources().stream().map(x->x.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("236.91");
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carry.id())).isEqualTo(frozen);assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
    var old=jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,e.id());
    var next=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("reopen","双方补充协议，上调为20",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("10"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("20"))),e.id()));next=approveSettlement(f.order(),next);
    settlements.evidence(f.order().order(),next.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("topup","payment",new BigDecimal("10"),"NEW-YEAR-TOPUP",proof,"当年来源补付",f.invoice(),List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(a.id(),new BigDecimal("10"))),String.valueOf(Integer.parseInt(year)+1)));
    settlements.evidence(f.order().order(),next.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("new-final","invoice",new BigDecimal("20"),"NEW-INVOICE",proof,"补充协议发票核对",f.invoice()));
    settlements.act(f.order().order(),next.id(),settlementAction(next,"complete"),false);
    assertThat(jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,e.id())).isEqualTo(old);assertThat(jdbc.queryForObject("select count(*) from effective_order_settlements where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    assertThat(funding.project(f.order().project()).sources().stream().map(x->x.paidAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("10");
    assertThat(settlements.detail(f.order().order(),next.id(),false).netPaid()).isEqualByComparingTo("20");
    assertThat(jdbc.queryForObject("select sum(paid_amount) from budget_commitment_lines where tenant_id=?",BigDecimal.class,tenant)).isEqualByComparingTo("20");
  }
  com.procurement.order.api.OrderSettlementContracts.Entry fundedSettlement(FundedCase f,String price,String target,String key)throws Exception{
    settlementContract(f.order(),true);String proof=settlementProof(f.order());String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());
    return settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal(key,"原资金来源明确的专项订单清算",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal(price))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal(target)))));
  }
  com.procurement.order.api.OrderSettlementContracts.EvidenceRequest fundEvidence(FundedCase f,String kind,String amount,String a,String b,String proof,String key){
    var lines=new ArrayList<com.procurement.order.api.OrderSettlementContracts.FundingLine>();if(new BigDecimal(a).signum()>0)lines.add(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.a(),new BigDecimal(a)));if(new BigDecimal(b).signum()>0)lines.add(new com.procurement.order.api.OrderSettlementContracts.FundingLine(f.b(),new BigDecimal(b)));
    return new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest(key,kind,new BigDecimal(amount),"BANK-"+key,proof,"实际收付及原来源核验",f.invoice(),lines);
  }
  @Test void fundedOrderRefundRetainsOriginalCashAndClosesWithExactInvoiceSourceNet()throws Exception{
    var f=fundedPaidCase();var old=jdbc.queryForList("select * from funding_payment_allocations where tenant_id=? order by fund_id",tenant);var e=fundedSettlement(f,"5","10","refund");String proof=e.agreementId();
    assertThat(e.snapshot()).contains("funding","invoicePlan");assertThatThrownBy(()->fundedCash(f.invoice(),f.a(),f.b(),"1","1")).hasMessageContaining("清算");
    assertThatThrownBy(()->funding.submit(reallocate(f,"locked","90","156.91"))).hasMessageContaining("清算");
    var source=funding.funds(1,100).items().stream().filter(x->x.id().equals(f.a())).findFirst().orElseThrow();assertThatThrownBy(()->funding.submit(fundLimit(source,"400","locked-limit"))).hasMessageContaining("清算");
    e=approveSettlement(f.order(),e);var approved=e;assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),fundEvidence(f,"refund","40","40","0",proof,"wrong"))).hasMessageContaining("该发票");
    var request=fundEvidence(f,"refund","40","10","30",proof,"refund-cash");var cash=settlements.evidence(f.order().order(),e.id(),request);assertThat(settlements.evidence(f.order().order(),e.id(),request).id()).isEqualTo(cash.id());
    assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),fundEvidence(f,"refund","40","20","20",proof,"refund-cash"))).hasMessageContaining("同一凭证");
    settlements.evidence(f.order().order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("10"),"CREDIT",proof,"最终红冲核对",f.invoice()));
    var done=settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);assertThat(done.status()).isEqualTo("settled");
    assertThat(settlements.detail(f.order().order(),e.id(),false).netPaid()).isEqualByComparingTo("10");assertThat(settlements.detail(f.order().order(),e.id(),false).fundingEntries()).hasSize(2);
    assertThat(funding.project(f.order().project()).sources().stream().map(x->x.paidAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("10");
    assertThat(jdbc.queryForList("select * from funding_payment_allocations where tenant_id=? order by fund_id",tenant)).isEqualTo(old);assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
    supplier(f.order());assertThat(settlements.detail(f.order().order(),e.id(),true).fundingEntries()).isEmpty();assertThat(settlements.detail(f.order().order(),e.id(),true).record().snapshot()).doesNotContain("funding");
  }
  @Test void fundedOrderReplayAndDetailDoNotLeakSourcesAfterBudgetPermissionRemoval()throws Exception{
    var f=fundedPaidCase();var e=fundedSettlement(f,"5","10","permission");String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());
    jdbc.update("update roles set permissions='[\"buyer:order:read\",\"buyer:order:manage\",\"buyer:contract:manage\"]'::jsonb where id=?",role);
    var replay=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("permission","原资金来源明确的专项订单清算",BigDecimal.ZERO,e.agreementId(),List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("5"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("10")))));
    assertThat(replay.snapshot()).doesNotContain("funding");var detail=settlements.detail(f.order().order(),e.id(),false);assertThat(detail.fundingRequired()).isTrue();assertThat(detail.fundingEntries()).isEmpty();assertThat(detail.record().snapshot()).doesNotContain("funding");
  }
  @Test void fundedOrderTopupRequiresExplicitCurrentSourcesAndRejectsNoncashAttribution()throws Exception{
    var f=fundedPaidCase();var e=approveSettlement(f.order(),fundedSettlement(f,"50","100","topup"));var approved=e;String proof=e.agreementId();
    assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("missing","payment",new BigDecimal("50"),"NO-LINES",proof,"缺少来源",f.invoice()))).hasMessageContaining("明确");
    settlements.evidence(f.order().order(),e.id(),fundEvidence(f,"payment","50","20","30",proof,"topup-cash"));
    assertThatThrownBy(()->settlements.evidence(f.order().order(),approved.id(),fundEvidence(f,"invoice","100","50","50",proof,"noncash"))).hasMessageContaining("非专项现金");
    settlements.evidence(f.order().order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("100"),"INV-FINAL",proof,"最终发票核对",f.invoice()));
    settlements.act(f.order().order(),e.id(),settlementAction(e,"complete"),false);assertThat(settlements.detail(f.order().order(),e.id(),false).netPaid()).isEqualByComparingTo("100");
  }
  @Test void fundedOrderRejectedAndWithdrawnPlansLeaveSourceBalancesUnchanged()throws Exception{
    var f=fundedPaidCase();var before=funding.project(f.order().project()).sources();var e=fundedSettlement(f,"50","100","withdraw");settlements.act(f.order().order(),e.id(),settlementAction(e,"withdraw"),false);
    String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,f.order().order());var next=settlements.propose(f.order().order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("reject","重新核对",BigDecimal.ZERO,e.agreementId(),List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("50"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(f.invoice(),new BigDecimal("100")))));supplier(f.order());settlements.act(f.order().order(),next.id(),settlementAction(next,"reject"),true);context(author);assertThat(funding.project(f.order().project()).sources()).isEqualTo(before);
  }
  @Test void databaseRejectsFundedSettlementCashWithoutItsSourceLines()throws Exception{
    var f=fundedPaidCase();var e=approveSettlement(f.order(),fundedSettlement(f,"50","100","raw"));var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);
    assertThatThrownBy(()->tx.executeWithoutResult(s->jdbc.update("insert into order_settlement_evidence(id,tenant_id,settlement_id,request_key,kind,amount,evidence_no,attachment_id,content_sha,remark,created_by,source) values(?,?,?,'raw','payment',50,'BANK-RAW',?,'hash','raw',?,?)","raw-"+UUID.randomUUID(),tenant,e.id(),e.agreementId(),author,f.invoice()))).hasStackTraceContaining("requires approved complete source lines");
    assertThat(settlements.detail(f.order().order(),e.id(),false).evidence()).isEmpty();
  }
  @Test void fundedOrderMultipleInvoicesCannotOffsetRefundAndTopupWithoutExplicitSources()throws Exception{
    var a=approvedFund("A","300");var b=approvedFund("B","300");var c=cancellationCase();var plan=funding.submit(fundPlan(c.project(),a.id(),b.id(),"plan"));decide(plan.id(),"approve");String line=receivedLine(c),proof=settlementProof(c);invoiceSupplier(c);
    var first=invoiceService.create(c.order(),installmentRequest(line,"first",1,100));var second=invoiceService.create(c.order(),installmentRequest(line,"second",1,100));context(author);fundedCash(first.id(),a.id(),b.id(),"60","40");jdbc.update("update invoices set payment_status='已付款' where id=?",first.id());
    var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("multi","两票退款和补付分别核验",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("50"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(first.id(),BigDecimal.ZERO),new com.procurement.order.api.OrderSettlementContracts.Allocation(second.id(),new BigDecimal("100")))));e=approveSettlement(c,e);var approved=e;
    assertThat(settlements.detail(c.order(),e.id(),false).netPaid()).isEqualByComparingTo("100");assertThat(settlements.detail(c.order(),e.id(),false).refundDue()).isEqualByComparingTo("100");assertThat(settlements.detail(c.order(),e.id(),false).paymentDue()).isEqualByComparingTo("100");
    assertThatThrownBy(()->settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false)).hasMessageContaining("净付款");
    var f=new FundedCase(c,first.id(),"",a.id(),b.id());settlements.evidence(c.order(),e.id(),fundEvidence(f,"refund","100","60","40",proof,"refund"));
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("payment","payment",new BigDecimal("100"),"PAY-B",proof,"补付第二票",second.id(),List.of(new com.procurement.order.api.OrderSettlementContracts.FundingLine(b.id(),new BigDecimal("100")))));
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("inv-a","invoice",BigDecimal.ZERO,"CREDIT-A",proof,"第一票全额红冲",first.id()));settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("inv-b","invoice",new BigDecimal("100"),"FINAL-B",proof,"第二票核验",second.id()));
    settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);assertThat(settlements.detail(c.order(),e.id(),false).fundingEntries()).hasSize(3);assertThat(funding.project(c.project()).sources()).filteredOn(s->s.fundId().equals(b.id())).singleElement().satisfies(s->assertThat(s.paidAmount()).isEqualByComparingTo("100"));
  }
  com.procurement.buyer.api.FundingContracts.Request reallocate(FundedCase f,String key,String a,String b){
    var view=funding.project(f.order().project());
    return new com.procurement.buyer.api.FundingContracts.Request(key,"project_reallocation",null,f.order().project(),projects.detail(f.order().project()).project().revision(),view.sources().stream().map(x->x.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add),List.of(new com.procurement.buyer.api.FundingContracts.Share(f.a(),new BigDecimal(a)),new com.procurement.buyer.api.FundingContracts.Share(f.b(),new BigDecimal(b))),"调整未付责任，已支付归属不变",Map.of());
  }
  @Test void unpaidReallocationApprovesIndependentlyWithoutChangingCashOrPlanVersion(){
    var f=fundedPaidCase();var before=jdbc.queryForList("select * from funding_payment_allocations where tenant_id=? order by entry_id,fund_id",tenant);var plan=funding.project(f.order().project()).planId();
    var request=reallocate(f,"adjust","90","156.91");var r=funding.submit(request);assertThat(funding.submit(request).id()).isEqualTo(r.id());
    assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(r.id()));assertThatThrownBy(()->fundedCash(f.invoice(),f.a(),f.b(),"1","1")).hasMessageContaining("审批中");
    decide(r.id(),"approve");assertThat(funding.project(f.order().project()).planId()).isEqualTo(plan);assertThat(jdbc.queryForList("select * from funding_payment_allocations where tenant_id=? order by entry_id,fund_id",tenant)).isEqualTo(before);
    assertThat(funding.project(f.order().project()).sources()).filteredOn(x->x.fundId().equals(f.a())).singleElement().satisfies(x->{assertThat(x.allocatedAmount()).isEqualByComparingTo("90");assertThat(x.paidAmount()).isEqualByComparingTo("20");});
    fundedCash(f.invoice(),f.a(),f.b(),"10","20");assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("80");
    var second=funding.submit(reallocate(f,"adjust-again","80","166.91"));decide(second.id(),"approve");
    assertThat(funding.history(f.a(),f.order().project(),1,100).items()).filteredOn(x->x.kind().equals("project_reallocation")).hasSize(2);
    assertThat(jdbc.queryForObject("select count(*) from funding_reallocation_lines where tenant_id=?",Integer.class,tenant)).isEqualTo(4);
  }
  @Test void unpaidReallocationCannotReassignPaidCashOrAddSourcesOrExceedCapacity(){
    var f=fundedPaidCase();assertThatThrownBy(()->funding.submit(reallocate(f,"under-paid","19","227.91"))).hasMessageContaining("不能低于");
    assertThatThrownBy(()->funding.submit(reallocate(f,"no-change","100","146.91"))).hasMessageContaining("未变化");
    assertThatThrownBy(()->funding.submit(reallocate(f,"total","90","150"))).hasMessageContaining("总额");
    var third=approvedFund("C","300");var input=reallocate(f,"foreign","90","156.91");
    assertThatThrownBy(()->funding.submit(new com.procurement.buyer.api.FundingContracts.Request(input.requestKey(),input.kind(),null,input.projectId(),input.revision(),input.amount(),List.of(new com.procurement.buyer.api.FundingContracts.Share(f.a(),new BigDecimal("20")),new com.procurement.buyer.api.FundingContracts.Share(f.b(),new BigDecimal("30")),new com.procurement.buyer.api.FundingContracts.Share(third.id(),new BigDecimal("196.91"))),input.reason(),Map.of()))).hasMessageContaining("当前版本");
    var r=funding.submit(reallocate(f,"capacity","90","156.91"));var b=funding.funds(1,100).items().stream().filter(x->x.id().equals(f.b())).findFirst().orElseThrow();var lower=funding.submit(fundLimit(b,"146.91","lower"));decide(lower.id(),"approve");
    assertThatThrownBy(()->decide(r.id(),"approve")).hasMessageContaining("额度不足");context(author);assertThat(jdbc.queryForObject("select count(*) from funding_reallocation_lines where tenant_id=?",Integer.class,tenant)).isZero();
  }
  @Test void unpaidReallocationWithdrawalAndRejectionPreserveResponsibilityAndCash(){
    var f=fundedPaidCase();var original=funding.project(f.order().project()).sources();var r=funding.submit(reallocate(f,"withdraw","90","156.91"));funding.withdraw(r.id(),"重新核对");r=funding.submit(reallocate(f,"reject","90","156.91"));decide(r.id(),"reject");
    assertThat(funding.project(f.order().project()).sources()).isEqualTo(original);assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
  }
  @Test void unpaidReallocationAfterCarryPreservesHistoricalBasisAndFlowsIntoNextCarry(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var c=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(c.id(),"approve");
    var current=new FundedCase(f.order(),f.invoice(),f.entry(),a.id(),b.id());var before=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,c.id());
    var r=funding.submit(reallocate(current,"after-carry","70","126.91"));decide(r.id(),"approve");assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("50");
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,c.id())).isEqualTo(before);
    var aa=futureFund("A",2,"300");var bb=futureFund("B",2,"300");var next=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),2,a.id(),b.id(),aa.id(),bb.id()));decide(next.id(),"approve");
    assertThat(funding.project(f.order().project()).sources()).filteredOn(x->x.fundId().equals(aa.id())).singleElement().satisfies(x->assertThat(x.allocatedAmount()).isEqualByComparingTo("70"));
  }
  @Test void databaseRejectsApprovedUnpaidReallocationWithMissingSourceEvidence(){
    var f=fundedPaidCase();var r=funding.submit(reallocate(f,"incomplete","90","156.91"));var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);
    assertThatThrownBy(()->tx.executeWithoutResult(s->jdbc.update("update special_funding_changes set status='approved',completed_by=?,completed_at=now(),revision=revision+1 where id=?",reviewer,r.id()))).hasStackTraceContaining("Reallocation must preserve");
    assertThat(funding.history(null,f.order().project(),1,100).items()).filteredOn(x->x.id().equals(r.id())).singleElement().satisfies(x->assertThat(x.status()).isEqualTo("submitted"));
    var plan=funding.project(f.order().project()).planId();
    assertThatThrownBy(()->tx.executeWithoutResult(s->jdbc.update("insert into funding_reallocation_lines(tenant_id,change_id,project_id,plan_id,fund_id,before_amount,after_amount,created_by) values(?,?,?,?,?,100,100,?)",tenant,plan,f.order().project(),plan,f.a(),reviewer))).hasStackTraceContaining("require reallocation business type");
  }
  com.procurement.buyer.api.FundingContracts.Fund futureFund(String code,int offset,String limit){
    var f=funding.create(new com.procurement.buyer.api.FundingContracts.Draft(dept,nextYear(offset),code,"年度专项 "+code));
    var c=funding.submit(fundLimit(f,limit,"future-"+code+"-"+offset));decide(c.id(),"approve");return f;
  }
  String fundedCash(String invoice,String a,String b,String first,String second){
    var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);
    return tx.execute(s->{var amount=new BigDecimal(first).add(new BigDecimal(second));String e=paidEntry(invoice,amount.toPlainString());
      funding.pay(tenant,invoice,e,amount,List.of(new com.procurement.buyer.domain.FundingAllocationPolicy.Share(a,new BigDecimal(first)),new com.procurement.buyer.domain.FundingAllocationPolicy.Share(b,new BigDecimal(second))));
      jdbc.update("update invoices set payment_status='部分付款' where id=?",invoice);return e;});
  }
  FundedCase fundedPaidCase(){
    var a=approvedFund("A","300");var b=approvedFund("B","300");var c=cancellationCase();var plan=funding.submit(fundPlan(c.project(),a.id(),b.id(),"plan"));decide(plan.id(),"approve");
    String line=receivedLine(c);invoiceSupplier(c);var invoice=invoiceService.create(c.order(),installmentRequest(line,"funded",2,200));context(author);
    return new FundedCase(c,invoice.id(),fundedCash(invoice.id(),a.id(),b.id(),"20","30"),a.id(),b.id());
  }
  com.procurement.buyer.api.ProjectLifecycleContracts.Request fundedCarry(String p,int n,String a,String b,String ta,String tb){
    return new com.procurement.buyer.api.ProjectLifecycleContracts.Request(projects.detail(p).project().revision(),"carryover",nextYear(n),"专项资金仅承接未付责任",Map.of(),List.of(new com.procurement.buyer.api.FundingCarryoverContracts.Mapping(a,ta),new com.procurement.buyer.api.FundingCarryoverContracts.Mapping(b,tb)));
  }
  @Test void fundedCarryoverRetainsHistoricalSourcesAndMovesOnlyUnpaidResponsibility(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");
    var original=jdbc.queryForMap("select * from funding_payment_allocations where entry_id=? and fund_id=?",f.entry(),f.a());
    var request=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));
    assertThat(funding.project(f.order().project()).sources()).anyMatch(x->x.fundId().equals(f.a()));
    assertThatThrownBy(()->fundedCash(f.invoice(),f.a(),f.b(),"1","1")).hasMessageContaining("审批中");
    decide(request.id(),"approve");
    assertThat(lifecycle.preview(f.order().project()).effectivePeriod()).isEqualTo(nextYear(1));
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("50");
    assertThat(funding.project(f.order().project()).sources()).anySatisfy(s->{assertThat(s.fundId()).isEqualTo(a.id());assertThat(s.allocatedAmount()).isEqualByComparingTo("80");});
    assertThat(funding.funds(1,100).items()).filteredOn(x->x.id().equals(f.a())).singleElement().satisfies(x->{assertThat(x.reservedAmount()).isEqualByComparingTo("20");assertThat(x.paidAmount()).isEqualByComparingTo("20");});
    assertThat(jdbc.queryForMap("select * from funding_payment_allocations where entry_id=? and fund_id=?",f.entry(),f.a())).isEqualTo(original);
    assertThatThrownBy(()->fundedCash(f.invoice(),f.a(),f.b(),"1","1")).hasMessageContaining("不属于");
    fundedCash(f.invoice(),a.id(),b.id(),"10","20");
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("80");
    assertThat(funding.history(a.id(),null,1,100).items()).anyMatch(x->x.kind().equals("project_carryover"));
    assertThatThrownBy(()->corrections.submit(f.invoice(),new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request("funded-correction",f.entry(),"BANK-CORRECTION","专项冻结不能猜测更正",Map.of()))).hasMessageContaining("明确选择");
  }
  @Test void fundedCarryoverSupportsMultipleYearsWithoutReassigningEarlierCash(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var first=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(first.id(),"approve");
    fundedCash(f.invoice(),a.id(),b.id(),"10","20");
    var aa=futureFund("A",2,"300");var bb=futureFund("B",2,"300");var second=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),2,a.id(),b.id(),aa.id(),bb.id()));decide(second.id(),"approve");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("80");
    assertThat(funding.project(f.order().project()).sources().stream().map(x->x.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("166.91");
    assertThat(funding.funds(1,100).items()).filteredOn(x->x.id().equals(a.id())).singleElement().satisfies(x->assertThat(x.reservedAmount()).isEqualByComparingTo("10"));
    assertThat(funding.funds(1,100).items()).filteredOn(x->x.id().equals(f.a())).singleElement().satisfies(x->assertThat(x.reservedAmount()).isEqualByComparingTo("20"));
    assertThat(funding.invoice(tenant,f.invoice()).blocker()).isEmpty();
    assertThat(jdbc.queryForObject("select count(*) from special_funding_changes where project_id=? and kind='project_carryover'",Integer.class,f.order().project())).isEqualTo(2);
  }
  @Test void fundedCarryoverRechecksTargetCapacityAndRejectsWithoutChangingSourcePlans(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var request=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));
    var current=funding.funds(1,100).items().stream().filter(x->x.id().equals(a.id())).findFirst().orElseThrow();var lower=funding.submit(fundLimit(current,"0","lower-limit"));decide(lower.id(),"approve");
    assertThatThrownBy(()->decide(request.id(),"approve")).hasMessageContaining("额度不足");context(author);
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isZero();decide(request.id(),"reject");
    assertThat(funding.project(f.order().project()).sources()).anyMatch(x->x.fundId().equals(f.a()));
    assertThat(jdbc.queryForObject("select count(*) from special_funding_changes where kind='project_carryover' and project_id=?",Integer.class,f.order().project())).isZero();
  }
  @Test void fundedCarryoverRequiresExplicitSameYearTargetsAndWithdrawalKeepsOriginalAllocation(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");
    assertThatThrownBy(()->lifecycle.submit(f.order().project(),lifecycleRequest(f.order().project(),"carryover",nextYear(1)))).hasMessageContaining("选择目标");
    assertThatThrownBy(()->lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),f.a(),b.id()))).hasMessageContaining("目标年度");
    var r=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));lifecycle.withdraw(f.order().project(),r.id(),r.revision(),"调整目标来源后重提");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isZero();assertThat(funding.project(f.order().project()).sources()).hasSize(2);
    assertThat(fundingCarryover.options(f.order().project(),nextYear(1)).choices()).hasSize(2);
  }
  @Test void fundedCarryoverAggregatesMultipleSourcesBeforeCheckingTargetLimit(){
    var f=fundedPaidCase();var target=futureFund("MERGED",1,"150");
    assertThatThrownBy(()->lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),target.id(),target.id()))).hasMessageContaining("额度不足");
    var fund=funding.funds(1,100).items().stream().filter(x->x.id().equals(target.id())).findFirst().orElseThrow();var limit=funding.submit(fundLimit(fund,"200","merged-limit"));decide(limit.id(),"approve");
    var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),target.id(),target.id()));decide(carry.id(),"approve");
    assertThat(funding.project(f.order().project()).sources()).singleElement().satisfies(x->assertThat(x.allocatedAmount()).isEqualByComparingTo("196.91"));
  }
  @Test void originalPendingCarryoverWithoutNewUiAvailabilityStillApprovesWithoutRewritingEvidence(){
    var f=paidProject();var request=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));
    jdbc.update("update procurement_project_lifecycle_requests set snapshot=jsonb_set(snapshot-'fundingCarryover','{preview}',(snapshot->'preview')-'fundingEnabled') where id=?",request.id());
    var original=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,request.id());
    decide(request.id(),"approve");
    assertThat(lifecycle.preview(f[0]).effectivePeriod()).isEqualTo(nextYear(1));
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,request.id())).isEqualTo(original);
  }
  com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request fundedCorrection(FundedCase f,String key,String a,String b){
    return new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request(key,f.entry(),"BANK-CORR-"+key,"核实原付款后整笔更正并回补当前年度",Map.of(),List.of(new com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget(f.a(),a),new com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget(f.b(),b)));
  }
  @Test void fundedFrozenCorrectionPreservesOldSourceAndRestoresCurrentResponsibilityAfterIndependentApproval(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var carried=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carried.id(),"approve");
    var original=jdbc.queryForList("select * from funding_payment_allocations where entry_id=? order by fund_id",f.entry());
    var snapshot=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried.id());
    assertThat(corrections.candidates(f.invoice())).singleElement().satisfies(c->{assertThat(c.fundingRequired()).isTrue();assertThat(c.blockers()).isEmpty();});
    var request=fundedCorrection(f,"funded-once",a.id(),b.id());var r=corrections.submit(f.invoice(),request);assertThat(corrections.submit(f.invoice(),request).id()).isEqualTo(r.id());
    assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(r.id()));
    assertThatThrownBy(()->fundedCash(f.invoice(),a.id(),b.id(),"1","1")).hasMessageContaining("更正审批中");
    assertThatThrownBy(()->lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),2,a.id(),b.id(),a.id(),b.id()))).hasMessageContaining("更正审批中");
    decide(r.id(),"approve");
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isZero();assertThat(funding.project(f.order().project()).priorPaidAmount()).isZero();
    assertThat(funding.project(f.order().project()).sources().stream().map(x->x.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("246.91");
    assertThat(jdbc.queryForList("select * from funding_payment_allocations where entry_id=? order by fund_id",f.entry())).isEqualTo(original);
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried.id())).isEqualTo(snapshot);
    assertThat(jdbc.queryForObject("select sum(amount) from funding_correction_allocations where correction_id=?",BigDecimal.class,r.id())).isEqualByComparingTo("50");
    assertThat(budget.position(tenant,dept,year).paidAmount()).isZero();assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("246.91");
    fundedCash(f.invoice(),a.id(),b.id(),"20","30");assertThat(funding.invoice(tenant,f.invoice()).blocker()).isEmpty();
  }
  com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request partial(String entry,String key,String amount,List<com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget> sources){
    return new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request(key,entry,"PARTIAL-"+key,"凭真实更正依据仅冲回本次金额",Map.of(),sources,new BigDecimal(amount));
  }
  com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget correctionShare(String source,String target,String amount){
    return new com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget(source,target,new BigDecimal(amount));
  }
  @Test void partialFrozenCorrectionsKeepRemainderFrozenAndAllowSeveralIndependentApprovals(){
    var f=paidProject();String carried=carry(f[0],1),snapshot=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried);
    var original=jdbc.queryForMap("select * from invoice_payment_entries where id=?",f[3]);
    var request=partial(f[3],"partial-one","12.34",null);var first=corrections.submit(f[2],request);
    assertThat(first.amount()).isEqualByComparingTo("12.34");assertThat(corrections.submit(f[2],request).id()).isEqualTo(first.id());
    assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(first.id()));
    assertThatThrownBy(()->corrections.submit(f[2],partial(f[3],"concurrent","1",null))).hasMessageContaining("在审");
    decide(first.id(),"approve");assertThat(corrections.submit(f[2],request).id()).isEqualTo(first.id());
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("37.66");
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("37.66");
    assertThat(corrections.candidates(f[2]).getFirst().remainingAmount()).isEqualByComparingTo("37.66");
    assertThat(corrections.candidates(f[2]).getFirst().blockers()).isEmpty();
    var second=corrections.submit(f[2],partial(f[3],"partial-two","7.66",null));decide(second.id(),"approve");
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("30");
    assertThat(lifecycle.preview(f[0]).carryoverBlockers()).isEmpty();carry(f[0],2);
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("30");
    assertThat(budget.position(tenant,dept,nextYear(2)).committed()).isEqualByComparingTo("216.91");
    var last=corrections.submit(f[2],correction(f,"finish-remainder"));assertThat(last.amount()).isEqualByComparingTo("30");decide(last.id(),"approve");
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isZero();assertThat(budget.position(tenant,dept,year).paidAmount()).isZero();
    assertThat(jdbc.queryForMap("select * from invoice_payment_entries where id=?",f[3])).isEqualTo(original);
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried)).isEqualTo(snapshot);
  }
  @Test void partialFrozenCorrectionValidatesAmountAndIdempotencyAndWithdrawalDoesNotReserveCash(){
    var f=paidProject();carry(f[0],1);
    for(String amount:List.of("0","-1","50.01","0.001"))assertThatThrownBy(()->corrections.submit(f[2],partial(f[3],"invalid-"+amount,amount,null))).hasMessageContaining("本次更正金额");
    var r=corrections.submit(f[2],partial(f[3],"key","15",null));
    assertThatThrownBy(()->corrections.submit(f[2],partial(f[3],"key","16",null))).hasMessageContaining("不同更正内容");
    corrections.withdraw(f[2],r.id(),"补充核对凭据");var rejected=corrections.submit(f[2],partial(f[3],"reject","15",null));decide(rejected.id(),"reject");
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("50");assertThat(corrections.candidates(f[2]).getFirst().remainingAmount()).isEqualByComparingTo("50");
  }
  @Test void partialFundedCorrectionUsesExplicitSourceSharesAndCarriesResidualResponsibility(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");
    var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    var original=jdbc.queryForList("select * from funding_payment_allocations where entry_id=? order by fund_id",f.entry());
    var request=partial(f.entry(),"fund-partial","12.34",List.of(correctionShare(f.b(),b.id(),"12.34")));
    var r=corrections.submit(f.invoice(),request);decide(r.id(),"approve");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("37.66");
    assertThat(funding.project(f.order().project()).sources().stream().map(s->s.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("209.25");
    assertThat(corrections.fundingOptions(f.invoice(),f.entry()).sources()).anySatisfy(s->{if(s.fundId().equals(f.b()))assertThat(s.amount()).isEqualByComparingTo("17.66");});
    var aa=futureFund("A",2,"300");var bb=futureFund("B",2,"300");var carry2=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),2,a.id(),b.id(),aa.id(),bb.id()));decide(carry2.id(),"approve");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("37.66");
    var second=corrections.submit(f.invoice(),partial(f.entry(),"second-source","20",List.of(correctionShare(f.a(),aa.id(),"20"))));decide(second.id(),"approve");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("17.66");
    assertThat(corrections.fundingOptions(f.invoice(),f.entry()).sources()).singleElement().satisfies(s->assertThat(s.fundId()).isEqualTo(f.b()));
    var last=corrections.submit(f.invoice(),partial(f.entry(),"last-source","17.66",List.of(correctionShare(f.b(),bb.id(),"17.66"))));decide(last.id(),"approve");
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isZero();assertThat(funding.project(f.order().project()).priorPaidAmount()).isZero();
    assertThat(jdbc.queryForList("select * from funding_payment_allocations where entry_id=? order by fund_id",f.entry())).isEqualTo(original);
  }
  @Test void partialFundedCorrectionRejectsOverdrawnOrUnbalancedSourceShares(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    assertThatThrownBy(()->corrections.submit(f.invoice(),partial(f.entry(),"over","25",List.of(correctionShare(f.a(),a.id(),"25"))))).hasMessageContaining("来源剩余金额");
    assertThatThrownBy(()->corrections.submit(f.invoice(),partial(f.entry(),"sum","25",List.of(correctionShare(f.a(),a.id(),"10"))))).hasMessageContaining("合计");
    var r=corrections.submit(f.invoice(),partial(f.entry(),"valid","20",List.of(correctionShare(f.a(),a.id(),"20"))));decide(r.id(),"approve");
    assertThatThrownBy(()->corrections.submit(f.invoice(),partial(f.entry(),"spent-source","5",List.of(correctionShare(f.a(),a.id(),"5"))))).hasMessageContaining("非原付款来源");
    assertThatThrownBy(()->corrections.submit(f.invoice(),partial(f.entry(),"over-rest","30.01",List.of(correctionShare(f.b(),b.id(),"30.01"))))).hasMessageContaining("剩余可更正");
  }
  @Test void partialCorrectionAlsoReversesOnlyTheRequestedContractMilestoneAmount(){
    var f=fundedPaidCase();String contract=settlementContract(f.order(),true),m="partial-milestone-"+UUID.randomUUID();
    jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,status,sort_no,reached) values (?,?,?,'合同总额',100,200,'待付',0,true)",m,tenant,contract);
    var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);tx.executeWithoutResult(s->contractInstallments.allocate(tenant,f.order().order(),f.order().supplier(),new BigDecimal("200"),f.entry(),new BigDecimal("50"),m,BigDecimal.ZERO));
    var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    var r=corrections.submit(f.invoice(),partial(f.entry(),"milestone","17.5",List.of(correctionShare(f.b(),b.id(),"17.5"))));decide(r.id(),"approve");
    assertThat(contractInstallments.balances(tenant,f.order().order()).getFirst().paid()).isEqualByComparingTo("32.5");
    var second=corrections.submit(f.invoice(),partial(f.entry(),"milestone-second","10",List.of(correctionShare(f.b(),b.id(),"10"))));decide(second.id(),"approve");
    assertThat(contractInstallments.balances(tenant,f.order().order()).getFirst().paid()).isEqualByComparingTo("22.5");
  }
  @Test void databaseRejectsPartialReversalOutsideApprovedCorrection(){
    var f=paidProject();carry(f[0],1);String id="illegal-partial-"+UUID.randomUUID();
    assertThatThrownBy(()->jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,reversal_of,created_by) values (?,?,?,?,-10,'BAD',?,?)",id,tenant,f[2],id,f[3],reviewer)).hasStackTraceContaining("requires approved frozen correction");
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("50");
  }
  @Test void partialCorrectionDoesNotGuessWhichOfSeveralContractMilestonesToReduce(){
    var f=fundedPaidCase();String contract=settlementContract(f.order(),true),first="multi-first-"+UUID.randomUUID(),second="multi-second-"+UUID.randomUUID();
    for(String m:List.of(first,second))jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,status,sort_no,reached) values (?,?,?,'待核对分项',50,100,'部分已付',0,true)",m,tenant,contract);
    for(String m:List.of(first,second))jdbc.update("insert into contract_payment_allocations(id,tenant_id,entry_id,milestone_id,amount) values (?,?,?,?,25)",UUID.randomUUID().toString(),tenant,f.entry(),m);
    var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    assertThatThrownBy(()->corrections.submit(f.invoice(),partial(f.entry(),"ambiguous","10",List.of(correctionShare(f.b(),b.id(),"10"))))).hasMessageContaining("多个合同里程碑");
    assertThat(corrections.history(f.invoice(),1,10).total()).isZero();assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");
    var full=corrections.submit(f.invoice(),fundedCorrection(f,"whole-is-known",a.id(),b.id()));decide(full.id(),"approve");
    assertThat(contractInstallments.balances(tenant,f.order().order()).stream().map(m->m.paid()).reduce(BigDecimal.ZERO,BigDecimal::add)).isZero();
  }
  @Test void fundedFrozenCorrectionAfterMultipleCarryoversDoesNotReassignOtherHistoricalCash(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var first=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(first.id(),"approve");fundedCash(f.invoice(),a.id(),b.id(),"10","20");
    var aa=futureFund("A",2,"300");var bb=futureFund("B",2,"300");var second=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),2,a.id(),b.id(),aa.id(),bb.id()));decide(second.id(),"approve");
    var r=corrections.submit(f.invoice(),fundedCorrection(f,"multiple",aa.id(),bb.id()));decide(r.id(),"approve");
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("30");assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("30");
    assertThat(funding.funds(1,100).items()).filteredOn(x->x.id().equals(a.id())).singleElement().satisfies(x->assertThat(x.paidAmount()).isEqualByComparingTo("10"));
    var aaa=futureFund("A",3,"300");var bbb=futureFund("B",3,"300");var third=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),3,aa.id(),bb.id(),aaa.id(),bbb.id()));decide(third.id(),"approve");
    assertThat(funding.project(f.order().project()).priorPaidAmount()).isEqualByComparingTo("30");assertThat(funding.project(f.order().project()).sources().stream().map(x->x.allocatedAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("216.91");
  }
  @Test void fundedFrozenCorrectionRechecksCapacityAndRejectsOrWithdrawsWithoutFinancialChanges(){
    var f=fundedPaidCase();var a=futureFund("A",1,"100");var b=futureFund("B",1,"300");var carried=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carried.id(),"approve");
    var r=corrections.submit(f.invoice(),fundedCorrection(f,"withdraw",a.id(),b.id()));corrections.withdraw(f.invoice(),r.id(),"重新核对回补来源");
    r=corrections.submit(f.invoice(),fundedCorrection(f,"reject",a.id(),b.id()));decide(r.id(),"reject");
    r=corrections.submit(f.invoice(),fundedCorrection(f,"capacity",a.id(),b.id()));var limited=funding.funds(1,100).items().stream().filter(x->x.id().equals(a.id())).findFirst().orElseThrow();var lower=funding.submit(fundLimit(limited,"80","lower-for-correction"));decide(lower.id(),"approve");
    String id=r.id();assertThatThrownBy(()->decide(id,"approve")).hasMessageContaining("额度不足");context(author);
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");assertThat(jdbc.queryForObject("select count(*) from funding_correction_allocations where tenant_id=?",Integer.class,tenant)).isZero();
  }
  @Test void fundedFrozenCorrectionDoesNotGuessMissingOrForeignTargetOrPermitDuplicateSource(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var c=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(c.id(),"approve");
    assertThatThrownBy(()->corrections.submit(f.invoice(),new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request("none",f.entry(),"BANK","缺少回补来源",Map.of()))).hasMessageContaining("明确选择");
    assertThatThrownBy(()->corrections.submit(f.invoice(),fundedCorrection(f,"old-target",f.a(),b.id()))).hasMessageContaining("当前年度");
    var bad=new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request("duplicate",f.entry(),"BANK","不能重复原来源",Map.of(),List.of(new com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget(f.a(),a.id()),new com.procurement.finance.api.FrozenPaymentCorrectionContracts.FundingTarget(f.a(),b.id())));
    assertThatThrownBy(()->corrections.submit(f.invoice(),bad)).hasMessageContaining("不得重复");
  }
  @Test void databaseRejectsFundedCorrectionApprovalThatOnlySkipsCashWithoutRestoringSources(){
    var f=fundedPaidCase();var a=futureFund("A",1,"300");var b=futureFund("B",1,"300");var carry=lifecycle.submit(f.order().project(),fundedCarry(f.order().project(),1,f.a(),f.b(),a.id(),b.id()));decide(carry.id(),"approve");
    var r=corrections.submit(f.invoice(),fundedCorrection(f,"missing-restoration",a.id(),b.id()));var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);
    assertThatThrownBy(()->tx.executeWithoutResult(s->{String id="bad-reversal-"+UUID.randomUUID();
      jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,reversal_of,created_by) values (?,?,?,?,-50,'BAD',?,?)",id,tenant,f.invoice(),id,f.entry(),reviewer);
      jdbc.update("insert into funding_payment_allocations(tenant_id,entry_id,project_id,fund_id,change_id,amount,created_by) select tenant_id,?,project_id,fund_id,change_id,-amount,? from funding_payment_allocations where tenant_id=? and entry_id=?",id,reviewer,tenant,f.entry());
      jdbc.update("update frozen_payment_corrections set status='approved',revision=revision+1,reversal_id=?,completed_by=?,completed_at=now() where id=?",id,reviewer,r.id());
    })).hasStackTraceContaining("independent workflow approval");
    assertThat(paymentLedger.summary(f.invoice()).paidAmount()).isEqualByComparingTo("50");assertThat(corrections.history(f.invoice(),1,10).items().getFirst().status()).isEqualTo("submitted");
  }
  com.procurement.buyer.api.FundingContracts.Request fundLimit(com.procurement.buyer.api.FundingContracts.Fund fund,String limit,String key){return new com.procurement.buyer.api.FundingContracts.Request(key,"fund_limit",fund.id(),null,fund.revision(),new BigDecimal(limit),null,"年度专项额度独立审批",Map.of());}
  com.procurement.buyer.api.FundingContracts.Fund approvedFund(String code,String limit){var fund=funding.create(new com.procurement.buyer.api.FundingContracts.Draft(dept,year,code,"专项资金 "+code));var c=funding.submit(fundLimit(fund,limit,"limit-"+code));decide(c.id(),"approve");return funding.funds(1,100).items().stream().filter(f->f.id().equals(fund.id())).findFirst().orElseThrow();}
  com.procurement.buyer.api.FundingContracts.Request fundPlan(String project,String first,String second,String key){return new com.procurement.buyer.api.FundingContracts.Request(key,"project_plan",null,project,projects.detail(project).project().revision(),new BigDecimal("246.91"),List.of(new com.procurement.buyer.api.FundingContracts.Share(first,new BigDecimal("100")),new com.procurement.buyer.api.FundingContracts.Share(second,new BigDecimal("146.91"))),"项目多来源资金分摊",Map.of());}
  @Test void specialFundingLimitsAndProjectResponsibilityOnlyChangeAfterIndependentApproval(){
    var a=approvedFund("A","200");var b=approvedFund("B","200");var c=cancellationCase();var input=fundPlan(c.project(),a.id(),b.id(),"plan");var r=funding.submit(input);
    assertThat(funding.submit(input).id()).isEqualTo(r.id());assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(r.id()));assertThat(funding.project(c.project()).enabled()).isFalse();decide(r.id(),"approve");
    assertThat(funding.project(c.project()).sources()).hasSize(2);assertThat(funding.funds(1,100).items()).anySatisfy(f->{if(f.id().equals(a.id()))assertThat(f.reservedAmount()).isEqualByComparingTo("100");});
    assertThatThrownBy(()->carry(c.project(),1)).hasMessageContaining("专项资金");assertThatThrownBy(()->funding.submit(fundLimit(funding.funds(1,100).items().stream().filter(f->f.id().equals(a.id())).findFirst().orElseThrow(),"99","reduce"))).hasMessageContaining("已占用");
  }
  @Test void specialFundingCashAndReversalRetainExactSourceAndRejectSilentOrOverAllocation(){
    var a=approvedFund("A","200");var b=approvedFund("B","200");var c=cancellationCase();var plan=funding.submit(fundPlan(c.project(),a.id(),b.id(),"plan"));decide(plan.id(),"approve");String line=receivedLine(c);invoiceSupplier(c);var invoice=invoiceService.create(c.order(),installmentRequest(line,"funded",2,200));context(author);
    var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);var split=List.of(new com.procurement.buyer.domain.FundingAllocationPolicy.Share(a.id(),new BigDecimal("20")),new com.procurement.buyer.domain.FundingAllocationPolicy.Share(b.id(),new BigDecimal("30")));
    assertThatThrownBy(()->tx.executeWithoutResult(s->{String e=paidEntry(invoice.id(),"50");funding.pay(tenant,invoice.id(),e,new BigDecimal("50"),null);})).hasMessageContaining("明确");
    assertThatThrownBy(()->tx.executeWithoutResult(s->{String e=paidEntry(invoice.id(),"150");funding.pay(tenant,invoice.id(),e,new BigDecimal("150"),List.of(new com.procurement.buyer.domain.FundingAllocationPolicy.Share(a.id(),new BigDecimal("150"))));})).hasMessageContaining("剩余额度");
    String entry=tx.execute(s->{String e=paidEntry(invoice.id(),"50");funding.pay(tenant,invoice.id(),e,new BigDecimal("50"),split);jdbc.update("update invoices set payment_status='部分付款' where id=?",invoice.id());return e;});
    assertThat(funding.matches(tenant,entry,split)).isTrue();assertThat(funding.invoice(tenant,invoice.id()).entries()).hasSize(2);assertThat(funding.project(c.project()).sources()).extracting(com.procurement.buyer.api.FundingContracts.Balance::paidAmount).allMatch(p->p.signum()>0);
    tx.executeWithoutResult(s->{String reverse="funded-reverse-"+UUID.randomUUID();jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,reversal_of,created_by) values (?,?,?,?, -50,'REV',?,?)",reverse,tenant,invoice.id(),reverse,entry,author);funding.reverse(tenant,invoice.id(),entry,reverse);jdbc.update("update invoices set payment_status='待付款' where id=?",invoice.id());});
    assertThat(funding.project(c.project()).sources()).allMatch(x->x.paidAmount().signum()==0);assertThat(funding.invoice(tenant,invoice.id()).entries()).hasSize(4);assertThatThrownBy(()->funding.submit(fundPlan(c.project(),a.id(),b.id(),"replan"))).hasMessageContaining("付款历史");
  }
  @Test void specialFundingApprovalRechecksAvailableCapacityAndRetainsRejectedAndWithdrawnHistory(){
    var a=approvedFund("A","200");var b=approvedFund("B","200");var c=cancellationCase();var r=funding.submit(fundPlan(c.project(),a.id(),b.id(),"withdraw"));funding.withdraw(r.id(),"重新核对来源");r=funding.submit(fundPlan(c.project(),a.id(),b.id(),"reject"));decide(r.id(),"reject");assertThat(funding.project(c.project()).enabled()).isFalse();assertThat(funding.history(null,c.project(),1,1).total()).isEqualTo(2);
    var pending=funding.submit(fundPlan(c.project(),a.id(),b.id(),"stale"));var other=cancellationCase();var first=funding.submit(fundPlan(other.project(),a.id(),b.id(),"other"));decide(first.id(),"approve");assertThatThrownBy(()->decide(pending.id(),"approve")).hasMessageContaining("额度不足");context(author);
    assertThat(funding.project(c.project()).enabled()).isFalse();assertThat(funding.project(other.project()).enabled()).isTrue();
  }
  @Test void specialFundingHasTenantAndDepartmentScopeAndCannotInventLegacyAttribution(){
    approvedFund("A","500");assertThat(funding.funds(1,1).total()).isEqualTo(1);assertThatThrownBy(()->funding.funds(0,20)).hasMessageContaining("分页");
    jdbc.update("update roles set data_scope='department' where id=?",role);String foreign="foreign-dept-"+UUID.randomUUID();jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')",foreign,tenant);assertThatThrownBy(()->funding.create(new com.procurement.buyer.api.FundingContracts.Draft(foreign,year,"O","Other"))).hasMessageContaining("数据范围");
    jdbc.update("update roles set data_scope='all' where id=?",role);var paid=paidProject();var fund=funding.funds(1,100).items().getFirst();assertThatThrownBy(()->funding.submit(new com.procurement.buyer.api.FundingContracts.Request("legacy","project_plan",null,paid[0],projects.detail(paid[0]).project().revision(),new BigDecimal("246.91"),List.of(new com.procurement.buyer.api.FundingContracts.Share(fund.id(),new BigDecimal("246.91"))),"不能补造",Map.of()))).hasMessageContaining("付款历史");
  }
  @Autowired com.procurement.finance.infrastructure.InvoiceMapper invoiceMapper;
  @Autowired com.procurement.buyer.infrastructure.BudgetLifecycleMapper budgetMapper;
  String tenant, dept, author, reviewer, role, material;
  @Autowired com.procurement.finance.application.InvoiceApplicationService invoiceService;
  @Autowired com.procurement.finance.application.FinanceActionApplicationService financeActions;
  @Autowired com.procurement.contract.application.ContractInstallmentService contractInstallments;
  @Autowired org.springframework.transaction.PlatformTransactionManager txManager;
  @Test void multipleInvoicePaymentsShareContractMilestonesWithoutConfusingInvoiceLocalBalances(){
    var c=cancellationCase();String line=receivedLine(c),contract=settlementContract(c,true);invoiceSupplier(c);
    var a=invoiceService.create(c.order(),installmentRequest(line,"milestone-a",1,100));var b=invoiceService.create(c.order(),installmentRequest(line,"milestone-b",1,100));context(author);
    String m1="milestone-"+UUID.randomUUID(),m2="milestone-"+UUID.randomUUID();jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,status,sort_no,reached) values (?,?,?,'第一批',50,100,'待付',0,true),(?,?,?,'第二批',50,100,'待付',1,false)",m1,tenant,contract,m2,tenant,contract);
    var tx=new org.springframework.transaction.support.TransactionTemplate(txManager);
    java.util.function.BiConsumer<String,String> pay=(invoice,milestone)->tx.executeWithoutResult(status->{String entry="payment-"+UUID.randomUUID();
      if(invoice.equals(b.id()))jdbc.update("update invoices set payment_status='已付款' where id=?",invoice);
      jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,? ,100,?,?)",entry,tenant,invoice,entry,"BANK-"+entry,author);
      contractInstallments.allocate(tenant,c.order(),c.supplier(),new BigDecimal("100"),entry,new BigDecimal("100"),milestone,BigDecimal.ZERO);
      jdbc.update("update invoices set payment_status='已付款' where id=?",invoice);
    });
    pay.accept(a.id(),m1);assertThat(paymentLedger.summary(a.id()).reconciliationRequired()).isFalse();assertThat(paymentLedger.summary(b.id()).reconciliationRequired()).isFalse();assertThatThrownBy(()->pay.accept(b.id(),m2)).hasMessageContaining("已达成里程碑");
    assertThat(jdbc.queryForObject("select count(*) from invoice_payment_entries where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    jdbc.update("update contract_payment_milestones set reached=true,reached_at=now() where id=?",m2);pay.accept(b.id(),m2);
    assertThat(contractInstallments.balances(tenant,c.order())).allMatch(x->x.verified()&&x.remaining().signum()==0);
    assertThat(jdbc.queryForObject("select blocking_reason from contract_closeout_checks where contract_id=?",String.class,contract)).isNull();
  }
  void invoiceSupplier(CancelCase c){jdbc.update("update roles set permissions=permissions||'[\"supplier:invoice:read\",\"supplier:invoice:manage\"]'::jsonb where id=?",c.user()+"role");supplier(c);}
  com.procurement.finance.api.CreateInvoiceRequest installmentRequest(String line,String key,int quantity,int amount){return new com.procurement.finance.api.CreateInvoiceRequest(BigDecimal.valueOf(amount),"INV-"+key,"",null,BigDecimal.ZERO,key,List.of(new com.procurement.finance.api.CreateInvoiceRequest.Line(line,BigDecimal.valueOf(quantity))));}
  @Test void installmentInvoicesRetainEachLineAndCanBePaidWithoutFalseFullOrderVariance(){
    var c=cancellationCase();String line=receivedLine(c);invoiceSupplier(c);var first=installmentRequest(line,"first",1,100);var invoice=invoiceService.create(c.order(),first);
    assertThat(invoice.amount()).isEqualByComparingTo("100");assertThat(invoice.taxRate()).isZero();assertThat(invoice.varianceAmount()).isZero();assertThat(invoice.reconciliationStatus()).isEqualTo("分次开票已核对");
    assertThat(invoiceService.create(c.order(),first).id()).isEqualTo(invoice.id());assertThat(invoiceService.issuancePreview(c.order()).remainingAmount()).isEqualByComparingTo("100");
    assertThatThrownBy(()->invoiceService.create(c.order(),installmentRequest(line,"first",2,200))).hasMessageContaining("提交编号内容不同");
    assertThatThrownBy(()->invoiceService.create(c.order(),installmentRequest(line,"excess",2,200))).hasMessageContaining("剩余");
    var second=invoiceService.create(c.order(),installmentRequest(line,"second",1,100));assertThat(second.id()).isNotEqualTo(invoice.id());assertThat(invoiceService.issuancePreview(c.order()).blockers()).contains("本订单已足额开票");
    context(author);assertThat(financeActions.listCurrentTenantThreeWayMatchLines(invoice.id()).getFirst().lineMatchStatus()).isEqualTo("本票分次匹配");
    assertThat(jdbc.queryForObject("select blocking_reason from finance_invoice_closeout_checks where invoice_id=?",String.class,invoice.id())).isNull();assertThat(jdbc.queryForObject("select sum(amount) from invoices where order_id=?",BigDecimal.class,c.order())).isEqualByComparingTo("200");
    supplier(c);assertThatThrownBy(()->invoiceService.create(c.order(),new com.procurement.finance.api.CreateInvoiceRequest(new BigDecimal("200"),"LEGACY",null,null,null))).isInstanceOf(IllegalStateException.class);
    jdbc.update("update purchase_orders set status='已清算' where id=?",c.order());assertThat(invoiceService.create(c.order(),first).id()).isEqualTo(invoice.id());
  }
  @Test void installmentIssuanceBlocksUnattributableLegacyInvoicesAndWrongSupplier(){
    var c=cancellationCase();String line=receivedLine(c);jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?,?,?,?,100,'LEGACY','待付款')","legacy-"+UUID.randomUUID(),tenant,c.supplier(),c.order());invoiceSupplier(c);
    assertThat(invoiceService.issuancePreview(c.order()).blockers()).anyMatch(b->b.contains("历史发票"));assertThatThrownBy(()->invoiceService.create(c.order(),installmentRequest(line,"new",1,100))).hasMessageContaining("历史发票");
    TenantContext.set(null,"other-supplier",c.user());assertThatThrownBy(()->invoiceService.issuancePreview(c.order())).isInstanceOf(RuntimeException.class);assertThat(jdbc.queryForObject("select count(*) from invoices where order_id=?",Integer.class,c.order())).isEqualTo(1);
  }
  @Test void concurrentFullRemainderRequestsNeverDoubleInvoice() throws Exception {
    var c=cancellationCase();String line=receivedLine(c);invoiceSupplier(c);
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
      java.util.concurrent.Callable<String> run=()->{supplier(c);try{return invoiceService.create(c.order(),installmentRequest(line,"retry",2,200)).id();}finally{TenantContext.clear();}};
      var first=pool.submit(run);var second=pool.submit(run);assertThat(first.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(second.get(20,java.util.concurrent.TimeUnit.SECONDS));
    }
    assertThat(jdbc.queryForObject("select count(*) from invoices where order_id=?",Integer.class,c.order())).isEqualTo(1);assertThat(jdbc.queryForObject("select sum(quantity) from invoice_line_items where order_line_id=?",BigDecimal.class,line)).isEqualByComparingTo("2");
  }
  @Test void existingInvoiceNumberCannotBeReusedWithANewRequestKey(){var c=cancellationCase();String line=receivedLine(c);invoiceSupplier(c);var r=installmentRequest(line,"number",1,100);invoiceService.create(c.order(),r);var duplicate=new com.procurement.finance.api.CreateInvoiceRequest(r.amount(),r.invoiceNo(),r.invoiceCode(),null,r.taxRate(),"other-key",r.lineItems());assertThatThrownBy(()->invoiceService.create(c.order(),duplicate)).hasMessageContaining("号码");}
  @Autowired com.procurement.order.application.OrderCancellationService cancellations;
  @Autowired com.procurement.order.application.PurchaseOrderApplicationService orderService;
  @Autowired com.procurement.contract.application.ContractApplicationService contractService;
  @Autowired com.procurement.order.application.OrderSettlementService settlements;
  @Autowired com.procurement.mall.application.PhysicalAfterSalesService physical;
  @Autowired com.procurement.mall.application.MallServiceApplicationService afterSales;
  @Autowired com.procurement.order.application.ReceiptQualityService quality;
  String negativeReceipt(CancelCase c,int qualified){String id=jdbc.queryForObject("select id from receipts where order_id=?",String.class,c.order());jdbc.update("update receipts set qualified_quantity=?,inspection_conclusion=?,disposition='退货换货',quality_note='到货质检异常' where id=?",qualified,qualified==0?"全部不合格":"部分合格",id);jdbc.update("update receipt_line_items set qualified_quantity=? where receipt_id=?",qualified,id);return id;}
  void finishPhysical(CancelCase c,String id,String type){context(author);physical.act(id,physicalAction(id+"-out","return_dispatch"),false);supplier(c);physical.act(id,physicalAction(id+"-received","return_receipt"),true);if(type.equals("换货")){physical.act(id,physicalAction(id+"-replacement","replacement_dispatch"),true);context(author);physical.act(id,physicalAction(id+"-pass","inspection_pass"),false);supplier(c);}afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("已完成","实物核验完毕",id+"-OK"));context(author);afterSales.buyerAction(id,"confirm","确认实物处理结果");}
  com.procurement.order.api.ReceiptQualityContracts.Request qualityRequest(String receipt,String afterSalesId){var line=quality.view(receipt).lines().getFirst();return new com.procurement.order.api.ReceiptQualityContracts.Request(line.receiptLineId(),afterSalesId,"核对原验收批次与实物签收/复验原件");}
  @Test void rejectedReceiptExchangeClearsQualityOnlyAfterExplicitReviewAndRetainsOriginalInspection(){
    var c=cancellationCase();settlementContract(c,true);String id=physicalCase(c,"换货"),r=negativeReceipt(c,1);finishPhysical(c,id,"换货");
    assertThat(jdbc.queryForObject("select blocking_reason from finance_fulfillment_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).contains("不合格");
    assertThatThrownBy(()->quality.resolve(r,new com.procurement.order.api.ReceiptQualityContracts.Request("foreign",id,"wrong line"))).hasMessageContaining("验收行");
    var request=qualityRequest(r,id);var result=quality.resolve(r,request);assertThat(result.lines().getFirst().unresolvedQuantity()).isZero();assertThat(result.lines().getFirst().exchangedQuantity()).isEqualByComparingTo("1");assertThat(quality.resolve(r,request).resolutions()).hasSize(1);
    assertThat(jdbc.queryForObject("select blocking_reason from finance_fulfillment_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).isNull();
    assertThat(jdbc.queryForObject("select qualified_quantity from receipts where id=?",Integer.class,r)).isEqualTo(1);assertThat(jdbc.queryForObject("select amount from purchase_orders where id=?",BigDecimal.class,c.order())).isEqualByComparingTo("200");
    assertThatThrownBy(()->quality.resolve(r,new com.procurement.order.api.ReceiptQualityContracts.Request(request.receiptLineId(),id,"覆盖核销"))).hasMessageContaining("不得覆盖");
    assertThatThrownBy(()->jdbc.update("delete from receipt_after_sales_resolutions where receipt_id=?",r)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    TenantContext.set("another-tenant",null,author);assertThatThrownBy(()->quality.view(r)).hasMessageContaining("不存在");
  }
  @Test void rejectedReceiptReturnThenRefundUsesRetainedGoodsAndBudgetWithoutChangingOriginalFacts() throws Exception {
    var c=cancellationCase();settlementContract(c,true);String id=physicalCase(c,"退货"),r=negativeReceipt(c,1),proof=settlementProof(c);finishPhysical(c,id,"退货");
    assertThat(settlements.view(c.order(),false,1,10).preview().blockers()).isNotEmpty();quality.resolve(r,qualityRequest(r,id));
    String inv="inv-"+UUID.randomUUID();jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?,?,?,?,200,'PREPAID','已付款')",inv,tenant,c.supplier(),c.order());jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'paid',200,'BANK',?)","paid-"+UUID.randomUUID(),tenant,inv,author);
    var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("bad-return","不合格品退回核销后退款清算",BigDecimal.ZERO,proof,null));assertThat(e.goodsAmount()).isEqualByComparingTo("100");e=approveSettlement(c,e);settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("refund","refund",new BigDecimal("100"),"REFUND-"+e.id(),proof,"实际到账"));settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("100"),"CREDIT-"+e.id(),proof,"最终货款红冲核对"));settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("100");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("100");assertThat(jdbc.queryForObject("select qualified_quantity from receipts where id=?",Integer.class,r)).isEqualTo(1);
    var snapshot=jdbc.queryForObject("select snapshot::text from order_settlements where id=?",String.class,e.id());assertThat(snapshot).contains("resolvedUnqualified","verifiedReturned");
  }
  String receivedLine(CancelCase c) {
    String line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,c.order());
    String d="delivery-"+UUID.randomUUID(),r="receipt-"+UUID.randomUUID();
    jdbc.update("insert into deliveries(id,tenant_id,order_id,supplier_id,carrier,tracking_no,status,shipped_quantity) values (?,?,?,?,'物流','TRACK','已发货',2)",d,tenant,c.order(),c.supplier());
    jdbc.update("insert into delivery_line_items(id,tenant_id,delivery_id,order_line_id,shipped_quantity) values (?,?,?,?,2)",d+"l",tenant,d,line);
    jdbc.update("insert into receipts(id,tenant_id,order_id,receiver_id,result,received_quantity,qualified_quantity,inspection_conclusion) values (?,?,?,?,'合格',2,2,'全部合格')",r,tenant,c.order(),author);
    jdbc.update("insert into receipt_line_items(id,tenant_id,receipt_id,order_line_id,description,ordered_quantity,received_quantity,qualified_quantity) values (?,?,?,?,'设备',2,2,2)",r+"l",tenant,r,line);
    jdbc.update("update purchase_orders set status='已收货' where id=?",c.order());return line;
  }
  String physicalCase(CancelCase c,String type){String line=receivedLine(c);afterSales.applyAfterSales(new com.procurement.mall.api.CreateAfterSalesRequest(c.order(),line,type,BigDecimal.ONE,"质量问题"));String id=jdbc.queryForObject("select id from mall_after_sales where tenant_id=? and order_id=?",String.class,tenant,c.order());supplier(c);afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("处理中","接受交接"));context(author);return id;}
  com.procurement.mall.api.PhysicalAfterSalesContracts.Action physicalAction(String key,String kind){return new com.procurement.mall.api.PhysicalAfterSalesContracts.Action(key,kind,BigDecimal.ONE,"REF-"+key,"按实际实物交接签收并核验","proof.txt",java.util.Base64.getEncoder().encodeToString(("proof:"+key).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
  @Test void physicalReturnIsVerifiedBeforeRefundAndBudgetUsesRetainedNet() throws Exception {
    var c=cancellationCase();settlementContract(c,true);String id=physicalCase(c,"退货"),proof=settlementProof(c);
    assertThatThrownBy(()->physical.act(id,physicalAction("wrong","return_receipt"),false)).hasMessageContaining("岗位");
    physical.act(id,physicalAction("dispatch","return_dispatch"),false);assertThat(physical.act(id,physicalAction("dispatch","return_dispatch"),false).events()).hasSize(1);
    assertThatThrownBy(()->physical.act(id,physicalAction("dispatch","inspection_pass"),false)).hasMessageContaining("编号内容不同");
    assertThat(settlements.view(c.order(),false,1,10).preview().blockers()).isNotEmpty();
    supplier(c);afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("处理中","交接中"));assertThatThrownBy(()->afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("已拒绝","不能逃避责任"))).hasMessageContaining("交接");
    physical.act(id,physicalAction("signed","return_receipt"),true);var f=physical.view(id,true).events().getFirst();assertThat(new String(physical.file(id,f.id(),true).bytes())).contains("proof:dispatch");
    afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("已完成","退回已签收","RETURN-1"));context(author);afterSales.buyerAction(id,"confirm","核对实物签收");
    String inv="inv-"+UUID.randomUUID();jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?,?,?,?,200,'INV','已付款')",inv,tenant,c.supplier(),c.order());
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'paid',200,'BANK',?)","paid-"+UUID.randomUUID(),tenant,inv,author);
    var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("return","退回1台，保留1台并退款清算",BigDecimal.ZERO,proof,null));assertThat(e.goodsAmount()).isEqualByComparingTo("100");e=approveSettlement(c,e);
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("refund","refund",new BigDecimal("100"),"REFUND-"+e.id(),proof,"实收退款"));
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("100"),"CREDIT-"+e.id(),proof,"红冲核对后最终货款"));settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("100");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("100");assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("18");
    assertThat(jdbc.queryForObject("select blocking_reason from mall_after_sales_finance_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).isNull();
    assertThatThrownBy(()->physical.act(id,physicalAction("late","return_dispatch"),false)).hasMessageContaining("清算");
  }
  @Test void exchangeRequiresReturnedGoodsReplacementAndPassingReinspectionWithoutNewCharges(){
    var c=cancellationCase();String id=physicalCase(c,"换货");physical.act(id,physicalAction("out","return_dispatch"),false);supplier(c);physical.act(id,physicalAction("received","return_receipt"),true);
    assertThatThrownBy(()->afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("已完成","只有签收","P"))).hasMessageContaining("复验");
    physical.act(id,physicalAction("replacement","replacement_dispatch"),true);context(author);physical.act(id,physicalAction("bad","inspection_fail"),false);supplier(c);assertThat(physical.view(id,true).actions()).isEmpty();context(author);physical.act(id,physicalAction("again","return_dispatch"),false);supplier(c);physical.act(id,physicalAction("received2","return_receipt"),true);physical.act(id,physicalAction("replacement2","replacement_dispatch"),true);context(author);physical.act(id,physicalAction("pass","inspection_pass"),false);supplier(c);afterSales.handleAfterSales(id,new com.procurement.mall.api.HandleAfterSalesRequest("已完成","复验合格","OK"));context(author);afterSales.buyerAction(id,"confirm","确认换货完成");
    assertThat(physical.view(id,false).events()).hasSize(8);assertThat(jdbc.queryForObject("select amount from purchase_orders where id=?",BigDecimal.class,c.order())).isEqualByComparingTo("200");assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("18");
    assertThat(jdbc.queryForObject("select blocking_reason from mall_after_sales_finance_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).isNull();
    TenantContext.set(null,"other",c.user());assertThatThrownBy(()->physical.view(id,true)).hasMessageContaining("无权");
  }
  @Test void legacyCompletedPhysicalCaseNeedsBackfillAndProofCannotBeEdited(){
    var c=cancellationCase();String id=physicalCase(c,"退货");jdbc.update("update mall_after_sales set status='已完成' where id=?",id);
    assertThat(jdbc.queryForObject("select blocking_reason from mall_after_sales_finance_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).contains("历史");
    physical.act(id,physicalAction("out","return_dispatch"),false);supplier(c);physical.act(id,physicalAction("signed","return_receipt"),true);context(author);
    assertThat(jdbc.queryForObject("select blocking_reason from mall_after_sales_finance_checks where tenant_id=? and order_id=?",String.class,tenant,c.order())).contains("退款");
    assertThatThrownBy(()->jdbc.update("update mall_after_sales_physical_events set note='tampered' where after_sales_id=?",id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(()->jdbc.update("delete from mall_after_sales_physical_events where after_sales_id=?",id)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThat(physical.view(id,false).events()).hasSize(2);
  }
  @org.springframework.boot.test.mock.mockito.SpyBean com.procurement.attachment.application.AttachmentApplicationService settlementAttachments;
  String settlementProof(CancelCase c) throws Exception {
    String id="proof-"+UUID.randomUUID();byte[] data=("Agreement "+id).getBytes(java.nio.charset.StandardCharsets.UTF_8);String sha=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(data));
    jdbc.update("insert into attachments(id,tenant_id,owner_type,owner_id,file_name,storage_key,uploaded_by,visibility,status) values (?,?,'order_settlement_document',?,'agreement.txt',?,?,'buyer_internal','active')",id,tenant,c.order(),"test/"+id,author);
    org.mockito.Mockito.doReturn(List.of(new com.procurement.attachment.application.AttachmentApplicationService.ProcurementExecutionAttachmentMetadata(id,tenant,"order_settlement_document",c.order(),"agreement.txt",(long)data.length,sha))).when(settlementAttachments).procurementExecutionAttachmentMetadata("order_settlement_document",c.order());
    org.mockito.Mockito.doReturn(new com.procurement.attachment.application.AttachmentApplicationService.DownloadedObject("agreement.txt",data,"text/plain")).when(settlementAttachments).loadCurrentTenantObject(id);
    return id;
  }
  String settlementContract(CancelCase c,boolean active){
    var contract=contractService.createCurrentTenantContract(new com.procurement.contract.api.CreateContractRequest("SET-"+UUID.randomUUID(),"Settlement contract",c.order(),new BigDecimal("200"),"草案","未履行",null,null,null,"",""));
    if(active)jdbc.update("update contracts set status='已生效' where id=?",contract.id());return contract.id();
  }
  com.procurement.order.api.OrderSettlementContracts.Action settlementAction(com.procurement.order.api.OrderSettlementContracts.Entry e,String action){return new com.procurement.order.api.OrderSettlementContracts.Action(e.revision(),action,"核对原始依据与双方结算协议",Map.of());}
  com.procurement.order.api.OrderSettlementContracts.Entry approveSettlement(CancelCase c,com.procurement.order.api.OrderSettlementContracts.Entry e){supplier(c);e=settlements.act(c.order(),e.id(),settlementAction(e,"accept"),true);context(author);e=settlements.act(c.order(),e.id(),settlementAction(e,"submit"),false);decide(e.id(),"approve");context(author);return settlements.detail(c.order(),e.id(),false).record();}
  @Test void directOrderWithoutContractCanCompleteBilateralApprovedCloseout() throws Exception {
    var c=cancellationCase();String proof=settlementProof(c);
    var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("direct","双方确认未履行的直采订单终止",BigDecimal.ZERO,proof,null));
    assertThat(e.contractId()).isNull();assertThat(e.kind()).isEqualTo("order_closeout");e=approveSettlement(c,e);
    var completed=settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);assertThat(completed.status()).isEqualTo("settled");
    assertThat(jdbc.queryForObject("select count(*) from contracts where related_order_id=?",Integer.class,c.order())).isZero();
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("20");
    assertThat(budget.position(tenant,dept,year).orderAmount()).isZero();
  }
  @Test void multipleInvoicesClearRefundAndSupplementIndividuallyEvenWhenAggregateBalanced() throws Exception { allocatedSettlement(true); }
  @Test void partialInvoiceIncludesExplicitUnbilledBalanceAndNoContractCloseout() throws Exception { allocatedSettlement(false); }
  void allocatedSettlement(boolean full) throws Exception {
    var c=cancellationCase();if(full)settlementContract(c,true);String line=receivedLine(c),proof=settlementProof(c),a="invoice-a-"+UUID.randomUUID(),bb="invoice-b-"+UUID.randomUUID();
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?,?,?,?,100,'A','已付款')",a,tenant,c.supplier(),c.order());
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'paid',100,'BANK',?)","paid-"+UUID.randomUUID(),tenant,a,author);
    if(full)jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?,?,?,?,100,'B','待付款')",bb,tenant,c.supplier(),c.order());
    String destination=full?bb:"~unbilled";
    var request=new com.procurement.order.api.OrderSettlementContracts.Proposal("allocated","逐票核对最终货款及红冲归属",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("50"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation(a,BigDecimal.ZERO),new com.procurement.order.api.OrderSettlementContracts.Allocation(destination,new BigDecimal("100"))));
    var e=settlements.propose(c.order(),request);assertThat(settlements.propose(c.order(),request).id()).isEqualTo(e.id());assertThat(e.snapshot()).contains("invoicePlan").doesNotContain("idempotency_key");e=approveSettlement(c,e);var approved=e;
    assertThat(settlements.detail(c.order(),e.id(),false).netPaid()).isEqualByComparingTo("100");
    assertThat(settlements.detail(c.order(),e.id(),false).refundDue()).isEqualByComparingTo("100");assertThat(settlements.detail(c.order(),e.id(),false).paymentDue()).isEqualByComparingTo("100");
    assertThatThrownBy(()->settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false)).hasMessageContaining("净付款");
    for(String source:List.of(a,destination)) {
      String kind=source.equals(a)?"refund":"payment";var cash=new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest(kind,kind,new BigDecimal("100"),kind+e.id(),proof,"实收付核验",source);
      settlements.evidence(c.order(),e.id(),cash);assertThat(settlements.evidence(c.order(),e.id(),cash).source()).isEqualTo(source);
      settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice-"+source,"invoice",source.equals(a)?BigDecimal.ZERO:new BigDecimal("100"),"CREDIT-"+source,proof,"本项最终发票核对",source));
    }
    assertThat(settlements.detail(c.order(),e.id(),false).blockers()).isEmpty();settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("100");assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("100");
    assertThat(jdbc.queryForObject("select sum(amount) from invoices where order_id=?",BigDecimal.class,c.order())).isEqualByComparingTo(full?"200":"100");
    assertThat(jdbc.queryForObject("select amount from invoice_payment_entries where invoice_id=?",BigDecimal.class,a)).isEqualByComparingTo("100");
    assertThatThrownBy(()->jdbc.update("update invoices set amount=1 where id=?",a)).isInstanceOf(org.springframework.dao.DataAccessException.class);
  }
  @Test void contractDraftVoidRequiresSupplierAndIndependentFlowableThenRestoresStock() throws Exception {
    var c=cancellationCase();String contract=settlementContract(c,false),proof=settlementProof(c);var request=new com.procurement.order.api.OrderSettlementContracts.Proposal("void","取消草案，双方确认未履行",BigDecimal.ZERO,proof,null);
    var e=settlements.propose(c.order(),request);assertThat(settlements.propose(c.order(),request).id()).isEqualTo(e.id());
    assertThatThrownBy(()->settlements.act(c.order(),e.id(),settlementAction(e,"accept"),false)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values (?, ?, ?, ?,200,'ILLEGAL','待付款')","invoice-"+UUID.randomUUID(),tenant,c.supplier(),c.order())).isInstanceOf(org.springframework.dao.DataAccessException.class);
    supplier(c);assertThat(new String(settlements.agreement(c.order(),e.id(),true),java.nio.charset.StandardCharsets.UTF_8)).contains(proof);context(author);
    var approved=approveSettlement(c,e);assertThat(approved.status()).isEqualTo("approved");
    settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false);
    assertThat(jdbc.queryForObject("select status from contracts where id=?",String.class,contract)).isEqualTo("已撤销");
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("20");
    assertThat(jdbc.queryForObject("select amount from purchase_orders where id=?",BigDecimal.class,c.order())).isEqualByComparingTo("200");
    assertThatThrownBy(()->settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false)).isInstanceOf(IllegalStateException.class);
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("0");
  }
  @Test void settlementRejectWithdrawAndScopePreserveOriginalData() throws Exception {
    var c=cancellationCase();settlementContract(c,true);String proof=settlementProof(c);var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("reject","合同解除",BigDecimal.ZERO,proof,null));
    context(reviewer);var first=e;assertThatThrownBy(()->settlements.act(c.order(),first.id(),settlementAction(first,"withdraw"),false)).isInstanceOf(IllegalStateException.class);
    supplier(c);e=settlements.act(c.order(),e.id(),settlementAction(e,"reject"),true);assertThat(e.status()).isEqualTo("rejected");context(author);
    assertThat(jdbc.queryForObject("select status from purchase_orders where id=?",String.class,c.order())).isEqualTo("待供应商确认");
    e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("withdraw","合同解除",BigDecimal.ZERO,proof,null));settlements.act(c.order(),e.id(),settlementAction(e,"withdraw"),false);
    assertThat(settlements.view(c.order(),false,1,1).total()).isEqualTo(2);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("18");
    TenantContext.set(null,"wrong-supplier",c.user());assertThatThrownBy(()->settlements.view(c.order(),true,1,10)).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void partialReductionRegistersRealNetPaymentWithoutChangingOriginalQuantities() throws Exception {
    var c=cancellationCase();settlementContract(c,true);String proof=settlementProof(c),line=jdbc.queryForObject("select id from order_line_items where order_id=?",String.class,c.order());
    String delivery="d-"+UUID.randomUUID(),receipt="r-"+UUID.randomUUID();
    jdbc.update("insert into deliveries(id,tenant_id,order_id,supplier_id,carrier,tracking_no,status,shipped_quantity) values (?,?,?,?,'物流','TRACK','已发货',1)",delivery,tenant,c.order(),c.supplier());
    jdbc.update("insert into delivery_line_items(id,tenant_id,delivery_id,order_line_id,shipped_quantity) values (?,?,?,?,1)",delivery+"l",tenant,delivery,line);
    jdbc.update("insert into receipts(id,tenant_id,order_id,receiver_id,result,received_quantity,qualified_quantity,inspection_conclusion) values (?,?,?,?,'验收合格',1,1,'全部合格')",receipt,tenant,c.order(),author);
    jdbc.update("insert into receipt_line_items(id,tenant_id,receipt_id,order_line_id,description,unit,ordered_quantity,received_quantity,qualified_quantity) values (?,?,?,?,'电脑','台',2,1,1)",receipt+"l",tenant,receipt,line);
    jdbc.update("update purchase_orders set status='已发货' where id=?",c.order());
    var e=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("partial","保留验收1台，终止剩余1台",BigDecimal.ZERO,proof,null));assertThat(e.goodsAmount()).isEqualByComparingTo("100");assertThat(e.kind()).isEqualTo("reduction");e=approveSettlement(c,e);var approved=e;
    assertThatThrownBy(()->settlements.act(c.order(),approved.id(),settlementAction(approved,"complete"),false)).hasMessageContaining("净付款");
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("pay","payment",new BigDecimal("100"),"BANK-"+e.id(),proof,"实际付讫凭证"));
    settlements.evidence(c.order(),e.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("100"),"INV-"+e.id(),proof,"最终结算货款核对"));
    settlements.act(c.order(),e.id(),settlementAction(e,"complete"),false);
    assertThat(jdbc.queryForObject("select quantity from order_line_items where id=?",BigDecimal.class,line)).isEqualByComparingTo("2");
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("19");
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("100");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("100");
    var parent=jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,e.id());
    var child=settlements.propose(c.order(),new com.procurement.order.api.OrderSettlementContracts.Proposal("supplement","已履行货款再调减20",BigDecimal.ZERO,proof,List.of(new com.procurement.order.api.OrderSettlementContracts.Price(line,new BigDecimal("80"))),List.of(new com.procurement.order.api.OrderSettlementContracts.Allocation("~unbilled",new BigDecimal("80"))),e.id()));
    child=approveSettlement(c,child);
    settlements.evidence(c.order(),child.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("refund","refund",new BigDecimal("20"),"SECOND-REFUND",proof,"补充协议退款","~unbilled"));
    settlements.evidence(c.order(),child.id(),new com.procurement.order.api.OrderSettlementContracts.EvidenceRequest("invoice","invoice",new BigDecimal("80"),"SECOND-FINAL",proof,"补充发票核对","~unbilled"));
    settlements.act(c.order(),child.id(),settlementAction(child,"complete"),false);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("19");
    assertThat(jdbc.queryForObject("select row_to_json(s)::text from order_settlements s where id=?",String.class,e.id())).isEqualTo(parent);
    assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("80");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("80");
  }
  record CancelCase(String project,String lot,String order,String sku,String supplier,String user) {}
  CancelCase cancellationCase() {
    return cancellationCase(true);
  }
  CancelCase cancellationCase(boolean tracked) {
    String sku=mallSku("100");if(!tracked)jdbc.update("update mall_skus set stock_qty=null where id=?",sku);var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var checkout=projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"));
    String supplier=jdbc.queryForObject("select supplier_id from purchase_orders where id=?",String.class,checkout.orderId()),user="cancel-supplier-"+UUID.randomUUID(),r=user+"role";
    jdbc.update("insert into users(id,supplier_id,name,status) values (?,?,'Cancellation supplier','active')",user,supplier);
    jdbc.update("insert into roles(id,supplier_id,scope,name,permissions) values (?,?,'supplier','Order manager','[\"supplier:order:manage\",\"supplier:order:read\"]'::jsonb)",r,supplier);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",user,r);
    return new CancelCase(p.id(),l.info().id(),checkout.orderId(),sku,supplier,user);
  }
  void supplier(CancelCase c){TenantContext.set(null,c.supplier(),c.user());}
  com.procurement.order.api.OrderCancellationContracts.Request cancelRequest(String key){return new com.procurement.order.api.OrderCancellationContracts.Request(key,"原计划调整，协商取消未履行订单");}
  com.procurement.order.api.OrderCancellationContracts.Decision cancelDecision(String action){return new com.procurement.order.api.OrderCancellationContracts.Decision(action,"确认未履行责任，记录双方意见");}
  @Test void orderCancellationIsBilateralRestoresStockOnceAndClosesWithOriginalEvidence(){
    var c=cancellationCase();var entry=cancellations.request(c.order(),cancelRequest("same"));
    assertThat(cancellations.request(c.order(),cancelRequest("same")).id()).isEqualTo(entry.id());
    assertThatThrownBy(()->cancellations.decide(c.order(),entry.id(),cancelDecision("accept"),false)).isInstanceOf(IllegalArgumentException.class);
    supplier(c);assertThatThrownBy(()->orderService.confirmCurrentSupplierOrder(c.order())).isInstanceOf(IllegalStateException.class);
    cancellations.decide(c.order(),entry.id(),cancelDecision("accept"),true);cancellations.decide(c.order(),entry.id(),cancelDecision("accept"),true);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("20");
    assertThat(jdbc.queryForObject("select amount from purchase_orders where id=?",BigDecimal.class,c.order())).isEqualByComparingTo("200");
    context(author);assertThat(budget.position(tenant,dept,year).orderAmount()).isEqualByComparingTo("0");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    expansion.closePackage(c.project(),c.lot(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(expansion.packages(c.project()).getFirst().info().revision(),"双方取消后核验归档"));
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("0");
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_execution_archives where tenant_id=?",String.class,tenant)).contains("orderCancellations",entry.id(),"双方");
  }
  @Test void cancellationRejectWithdrawRestorePriorStatusAndScopeCannotCrossSupplier(){
    var c=cancellationCase();var first=cancellations.request(c.order(),cancelRequest("first"));
    context(reviewer);assertThatThrownBy(()->cancellations.decide(c.order(),first.id(),cancelDecision("withdraw"),false)).isInstanceOf(IllegalStateException.class);
    supplier(c);cancellations.decide(c.order(),first.id(),cancelDecision("reject"),true);
    context(author);assertThat(jdbc.queryForObject("select status from purchase_orders where id=?",String.class,c.order())).isEqualTo("待供应商确认");
    var second=cancellations.request(c.order(),cancelRequest("second"));cancellations.decide(c.order(),second.id(),cancelDecision("withdraw"),false);
    assertThat(cancellations.view(c.order(),false,1,1).total()).isEqualTo(2);assertThat(cancellations.view(c.order(),false,2,1).items()).hasSize(1);
    TenantContext.set(null,"wrong-supplier",c.user());assertThatThrownBy(()->cancellations.view(c.order(),true,1,10)).isInstanceOf(IllegalArgumentException.class);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("18");
  }
  @Test void cancellationBlocksContractShipmentAndUnverifiableInventory(){
    var c=cancellationCase();var entry=cancellations.request(c.order(),cancelRequest("one"));
    assertThatThrownBy(()->contractService.createCurrentTenantContract(new com.procurement.contract.api.CreateContractRequest("C-1","合同",c.order(),new BigDecimal("200"),"草案","未履行",null,null,null,"",""))).isInstanceOf(IllegalStateException.class);
    jdbc.update("update mall_skus set stock_qty=null where id=?",c.sku());supplier(c);
    assertThatThrownBy(()->cancellations.decide(c.order(),entry.id(),cancelDecision("accept"),true)).isInstanceOf(IllegalStateException.class);
    assertThat(jdbc.queryForObject("select status from purchase_orders where id=?",String.class,c.order())).isEqualTo("取消协商中");
    assertThat(jdbc.queryForObject("select status from order_cancellation_requests where id=?",String.class,entry.id())).isEqualTo("pending");
    context(author);cancellations.decide(c.order(),entry.id(),cancelDecision("withdraw"),false);
    jdbc.update("update purchase_orders set status='已发货' where id=?",c.order());assertThatThrownBy(()->cancellations.request(c.order(),cancelRequest("late"))).isInstanceOf(IllegalStateException.class);
  }
  @Test void concurrentSupplierAgreementRestoresInventoryExactlyOnce() throws Exception {
    var c=cancellationCase();var e=cancellations.request(c.order(),cancelRequest("concurrent"));
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
      java.util.concurrent.Callable<String> action=()->{supplier(c);try{return cancellations.decide(c.order(),e.id(),cancelDecision("accept"),true).status();}finally{TenantContext.clear();}};
      var first=pool.submit(action);var second=pool.submit(action);
      assertThat(first.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("accepted");assertThat(second.get(20,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("accepted");
    }
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("20");
    assertThat(jdbc.queryForObject("select count(*) from order_cancellation_requests where order_id=? and status='accepted'",Integer.class,c.order())).isEqualTo(1);
  }
  @Test void untrackedCheckoutNeverAddsInventoryAndLegacyUnknownIsBlocked(){
    var c=cancellationCase(false);
    assertThat(jdbc.queryForObject("select reserved_stock_qty from order_line_items where order_id=?",BigDecimal.class,c.order())).isEqualByComparingTo("0");
    var e=cancellations.request(c.order(),cancelRequest("untracked"));jdbc.update("update mall_skus set stock_qty=50 where id=?",c.sku());supplier(c);cancellations.decide(c.order(),e.id(),cancelDecision("accept"),true);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,c.sku())).isEqualByComparingTo("50");
    context(author);var legacy=cancellationCase();jdbc.update("update order_line_items set reserved_stock_qty=null where order_id=?",legacy.order());
    assertThat(cancellations.view(legacy.order(),false,1,10).blockers()).anyMatch(b->b.contains("扣库依据"));
    assertThatThrownBy(()->cancellations.request(legacy.order(),cancelRequest("legacy"))).isInstanceOf(IllegalStateException.class);
  }

  String mallSku(String price) {
    String key="pm-"+UUID.randomUUID(), supplier=key+"s";
    jdbc.update("update tenants set enabled_features=enabled_features || '[\"mall\",\"method:mall\",\"method:auction\"]'::jsonb where id=?",tenant);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Project supplier','supplier')",supplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','普通')",key+"r",tenant,supplier);
    jdbc.update("insert into supplier_qualifications(id,supplier_id,qualification_type,file_name,storage_key) values (?,?,'营业执照','license.txt','isolated-test')",key+"q",supplier);
    jdbc.update("insert into mall_products(id,scope,tenant_id,supplier_id,name,brand,status) values (?,'tenant',?,?,'Project computer','Original brand','在架')",key,tenant,supplier);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status,stock_qty,lead_time_days) values (?,?,'Model A',?,'台',?,'在架',20,2)",key+"sku",key,material,new BigDecimal(price));
    return key+"sku";
  }

  com.procurement.buyer.api.ProjectMallContracts.Checkout mallRequest(
      com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail l,String sku,String quantity) {
    return new com.procurement.buyer.api.ProjectMallContracts.Checkout(l.info().revision(),"checkout-"+l.info().id(),"Approved catalogue selection",
        List.of(new com.procurement.buyer.api.ProjectMallContracts.Item(sku,new BigDecimal(quantity))),null,null);
  }

  @Test
  void mallUsesApprovedDemandPoolAndIdempotentStockOrderAndImmutableSelection() {
    String sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var request=mallRequest(l,sku,"2");var first=projectMall.checkout(p.id(),l.info().id(),request);
    assertThat(projectMall.checkout(p.id(),l.info().id(),request).orderId()).isEqualTo(first.orderId());
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,sku)).isEqualByComparingTo("18");
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from rfq_demands where tenant_id=? and rfq_id=?",Integer.class,tenant,first.rfqId())).isEqualTo(1);
    assertThat(projects.execution(p.id()).orderAmount()).isEqualByComparingTo("200");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(expansion.packages(p.id()).getFirst().sourceMethods().get(first.rfqId())).isEqualTo("商城");
    jdbc.update("update mall_skus set price=110,spec='{\"model\":\"Future model\"}'::jsonb where id=?",sku);
    assertThat(projectMall.selection(p.id(),l.info().id()).snapshot()).isEqualTo(first.snapshot());
    assertThat(projectGuard.archiveDefinitionForRfq(first.rfqId()).path("mallSelection").toString()).contains("Original brand").doesNotContain("Future model");
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"1"))).hasMessageContaining("重复下单");
  }

  @Test
  void mallRejectsWrongQuantityUnitMaterialPriceAndRollsBackAllSources() {
    String sku=mallSku("150");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).hasMessageContaining("成交额超过");
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"1"))).hasMessageContaining("批准数量");
    jdbc.update("update mall_skus set unit='箱',price=100 where id=?",sku);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).hasMessageContaining("单位");
    jdbc.update("update mall_skus set unit='台',material_id=null where id=?",sku);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).hasMessageContaining("未关联");
    assertThat(jdbc.queryForObject("select count(*) from procurement_project_executions where tenant_id=?",Integer.class,tenant)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?",Integer.class,tenant)).isZero();
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,sku)).isEqualByComparingTo("20");
  }

  @Test
  void mallCannotBypassIndependentApprovalOrExistingExecutionOrSourcePermissions() {
    String sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var raw=lot(p.id(),"2");
    var l=expansion.createDemand(p.id(),raw.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(raw.info().revision(),"Create"));
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).hasMessageContaining("审批通过");
    demands.submit(l.demands().getFirst().id(),Map.of());decide(l.demands().getFirst().id(),"approve");
    jdbc.update("update roles set permissions='[\"buyer:project:*\",\"buyer:demand:read\"]'::jsonb where id=?",role);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).isInstanceOf(RuntimeException.class);
    jdbc.update("update roles set permissions='[\"buyer:*\"]'::jsonb where id=?",role);
    expansion.execute(p.id(),l.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(l.info().revision(),"rfq","Source first"),false);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"))).hasMessageContaining("分包已变化");
  }

  @Test
  void auctionCreatesRealBoundDraftWithApprovedStartingCeilingAndRetainsBudget() {
    mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var invalid=new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(l.info().revision(),"auction","Auction",new BigDecimal("300"),BigDecimal.ONE,null,null);
    assertThatThrownBy(()->expansion.execute(p.id(),l.info().id(),invalid,false)).hasMessageContaining("起拍价");
    var result=expansion.execute(p.id(),l.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(l.info().revision(),"auction","Auction",new BigDecimal("240"),BigDecimal.ONE,OffsetDateTime.now(),OffsetDateTime.now().plusDays(2)),false);
    var run=result.runs().getFirst();
    assertThat(result.sourceMethods().get(run.executionId())).isEqualTo("竞价");
    assertThat(jdbc.queryForObject("select auction_start_price from rfqs where id=?",BigDecimal.class,run.executionId())).isEqualByComparingTo("240");
    assertThat(result.sourceStatuses().get(run.executionId())).isEqualTo("草稿");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(projects.execution(p.id()).orderAmount()).isEqualByComparingTo("0");
  }

  @Test
  void mallSupportsSeveralSkusForOneMaterialButRejectsDuplicateSkuAndMixedSuppliers() {
    String a=mallSku("100"),b=mallSku("110");
    var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var items=List.of(new com.procurement.buyer.api.ProjectMallContracts.Item(a,BigDecimal.ONE),new com.procurement.buyer.api.ProjectMallContracts.Item(b,BigDecimal.ONE));
    var request=new com.procurement.buyer.api.ProjectMallContracts.Checkout(l.info().revision(),"multi","Multiple models",items,null,null);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),request)).hasMessageContaining("同一供应商");
    jdbc.update("update mall_skus set product_id=(select product_id from mall_skus where id=?) where id=?",a,b);
    var duplicate=new com.procurement.buyer.api.ProjectMallContracts.Checkout(l.info().revision(),"duplicate","Invalid",List.of(items.getFirst(),items.getFirst()),null,null);
    assertThatThrownBy(()->projectMall.checkout(p.id(),l.info().id(),duplicate)).hasMessageContaining("规格重复");
    var bought=projectMall.checkout(p.id(),l.info().id(),request);
    assertThat(allocation.tree(bought.snapshot()).path("selections")).hasSize(2);
    assertThat(projects.execution(p.id()).orderAmount()).isEqualByComparingTo("210");
  }

  @Test
  void concurrentMallRequestsCreateOnlyOneOrderAndOneStockDeduction() throws Exception {
    String sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var start=new java.util.concurrent.CountDownLatch(1);
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var calls=new ArrayList<java.util.concurrent.Future<Boolean>>();
      for(int i=0;i<2;i++) {final int n=i;calls.add(pool.submit(()->{context(author);try {start.await();
        var base=mallRequest(l,sku,"2");projectMall.checkout(p.id(),l.info().id(),new com.procurement.buyer.api.ProjectMallContracts.Checkout(base.revision(),"concurrent-"+n,base.reason(),base.items(),null,null));return true;
      } catch(RuntimeException e) {assertThat(e).isNotInstanceOf(org.springframework.dao.DataAccessException.class);return false;} finally {TenantContext.clear();}}));}
      start.countDown();int won=0;for(var call:calls)if(call.get(15,java.util.concurrent.TimeUnit.SECONDS))won++;
      assertThat(won).isEqualTo(1);
    }
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,sku)).isEqualByComparingTo("18");
  }
  final String year = Year.now(ZoneId.of("Asia/Shanghai")).toString();

  @BeforeEach
  void seed() {
    String suffix = UUID.randomUUID().toString();
    tenant = "project-it-" + suffix;
    dept = "dept-" + suffix;
    author = "author-" + suffix;
    reviewer = "reviewer-" + suffix;
    role = "role-" + suffix;
    material = "material-" + suffix;
    jdbc.update(
        "insert into tenants(id,name,plan,status,enabled_features) values (?,'Project"
            + " IT','starter','active','[\"rfq\",\"order\",\"finance\",\"method:compare\",\"method:tender\"]'::jsonb)",
        tenant);
    jdbc.update(
        "insert into departments(id,tenant_id,name,status) values (?,?,'Procurement','active')",
        dept,
        tenant);
    for (String user : List.of(author, reviewer))
      jdbc.update(
          "insert into users(id,tenant_id,name,status,department_id) values (?,?,?,'active',?)",
          user,
          tenant,
          user,
          dept);
    jdbc.update(
        "insert into roles(id,tenant_id,scope,name,permissions,data_scope) values"
            + " (?,?,'buyer','Project admin','[\"buyer:*\"]'::jsonb,'all')",
        role,
        tenant);
    for (String user : List.of(author, reviewer))
      jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", user, role);
    jdbc.update(
        "insert into materials(id,tenant_id,code,name,category,unit,reference_price,specification)"
            + " values (?,?,'IT-01','Computer','IT','台',999,'Original spec')",
        material,
        tenant);
    context(author);
    for (String type : List.of("project_initiation", "purchase_demand", "project_change", "project_carryover", "project_liquidation", "project_reopen", "order_settlement", "frozen_payment_correction", "funding_change")) {
      var definition =
          definitions.createProcess(
              new CreateProcessDefinitionRequest("Project " + type, "", "file-text", type));
      String flow =
          "{\"steps\":[{\"id\":\"review\",\"type\":\"approver\",\"title\":\"Independent"
              + " review\",\"assignment\":{\"type\":\"role\",\"roleId\":\""
              + role
              + "\"}}]}";
      definitions.updateProcess(
          definition.id(),
          new UpdateProcessDefinitionRequest(
              definition.name(), "", "draft", "{\"fields\":[]}", flow, type));
      definitions.publishProcess(definition.id());
    }
  }

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  void context(String user) {
    TenantContext.set(tenant, null, user);
  }

  Draft draft(int revision) {
    return new Draft(
        "Office renewal",
        dept,
        author,
        year,
        "Annual funds",
        "Replace obsolete equipment",
        List.of(new LineInput(material, new BigDecimal("2"), new BigDecimal("123.4567"), "Office")),
        revision);
  }

  Action action(Detail d) {
    return new Action(d.project().revision(), "Verified business basis", Map.of());
  }

  Detail approve(Detail d) {
    var submitted = projects.submit(d.project().id(), action(d));
    assertThat(
            workflow.listCurrentUserTasks().stream()
                .filter(t -> t.businessId().equals(d.project().id())))
        .isEmpty();
    decide(d.project().id(), "approve");
    return projects.detail(submitted.project().id());
  }

  void decide(String id, String action) {
    context(reviewer);
    var task =
        workflow.listCurrentUserTasks().stream()
            .filter(t -> t.businessId().equals(id))
            .findFirst()
            .orElseThrow();
    workflow.completeCurrentUserTask(
        task.taskId(), new CompleteWorkflowTaskRequest(action, "Independent assessment"));
    context(author);
  }

  com.procurement.buyer.api.ProjectLifecycleContracts.Request lifecycleRequest(String project,String kind,String target){
    return new com.procurement.buyer.api.ProjectLifecycleContracts.Request(projects.detail(project).project().revision(),kind,target,"Audited responsibility transfer",Map.of());
  }

  @Test
  void carryoverMovesUnpaidExposureOnlyAfterIndependentApprovalWithoutChangingSourceYear(){
    var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    String target=String.valueOf(Integer.parseInt(year)+1);
    var original=jdbc.queryForMap("select created_at,budget from purchase_demands where id=?",l.demands().getFirst().id());
    var c=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target));
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(budget.position(tenant,dept,target).committed()).isEqualByComparingTo("0");
    assertThat(workflow.listCurrentUserTasks()).noneMatch(t->t.businessId().equals(c.id()));
    assertThatThrownBy(()->lot(p.id(),"1")).hasMessageContaining("审批中");
    decide(c.id(),"approve");
    assertThat(lifecycle.preview(p.id()).effectivePeriod()).isEqualTo(target);
    assertThat(projects.detail(p.id()).project().period()).isEqualTo(year);
    assertThat(jdbc.queryForMap("select created_at,budget from purchase_demands where id=?",l.demands().getFirst().id())).isEqualTo(original);
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("0");
    assertThat(budget.position(tenant,dept,target).committed()).isEqualByComparingTo("246.91");
    assertThat(projects.budget(p.id()).period()).isEqualTo(target);
    assertThatThrownBy(()->lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target))).hasMessageContaining("晚于");
  }

  @Test
  void carryoverRejectWithdrawAndDuplicateNeverMoveBudget(){
    var p=approve(projects.create(draft(0))).project();ready(lot(p.id(),"2"));
    String target=String.valueOf(Integer.parseInt(year)+1);
    var c=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target));
    assertThatThrownBy(()->lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target))).hasMessageContaining("重复提交");
    context(reviewer);
    assertThatThrownBy(()->lifecycle.withdraw(p.id(),c.id(),c.revision(),"Not initiator")).hasMessageContaining("发起人");
    context(author);lifecycle.withdraw(p.id(),c.id(),c.revision(),"Withdraw request");
    assertThat(lifecycle.history(p.id(),1,10).items().getFirst().status()).isEqualTo("withdrawn");
    var rejected=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target));decide(rejected.id(),"reject");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(budget.position(tenant,dept,target).committed()).isEqualByComparingTo("0");
    assertThat(lifecycle.history(p.id(),1,1).total()).isEqualTo(2);
    assertThat(lifecycle.history(p.id(),2,1).items()).hasSize(1);
    assertThatThrownBy(()->lifecycle.history(p.id(),1,101)).hasMessageContaining("分页");
  }

  @Test
  void carryoverHardBudgetFailureRollsBackTaskAndTransferThenAllowsBudgetAdjustment(){
    var p=approve(projects.create(draft(0))).project();ready(lot(p.id(),"2"));
    String target=String.valueOf(Integer.parseInt(year)+1);
    var c=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target));
    jdbc.update("insert into budget_policies(tenant_id,mode,reason,updated_by) values (?,'hard','IT',?)",tenant,author);
    assertThatThrownBy(()->decide(c.id(),"approve")).hasMessageContaining("承接年度预算不足");
    context(author);
    assertThat(lifecycle.history(p.id(),1,10).items().getFirst().status()).isEqualTo("submitted");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    jdbc.update("update budget_policies set mode='warning' where tenant_id=?",tenant);
    decide(c.id(),"approve");
    assertThat(budget.position(tenant,dept,target).committed()).isEqualByComparingTo("246.91");
  }

  @Test
  void carryoverDetectsChangedExposureAndCannotSkipPendingDemandOrOrderClearance(){
    var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    String target=String.valueOf(Integer.parseInt(year)+1);
    var c=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",target));
    jdbc.update("update purchase_demands set budget=240 where id=?",l.demands().getFirst().id());
    assertThatThrownBy(()->decide(c.id(),"approve")).hasMessageContaining("数据已变化");
    context(author);lifecycle.withdraw(p.id(),c.id(),c.revision(),"Recheck");
    assertThatThrownBy(()->lifecycle.submit(p.id(),lifecycleRequest(p.id(),"liquidation",null))).hasMessageContaining("没有已有订单");
    var p2=approve(projects.create(draft(0))).project();var pending=lot(p2.id(),"2");
    var withDemand=expansion.createDemand(p2.id(),pending.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(pending.info().revision(),"Create"));
    demands.submit(withDemand.demands().getFirst().id(),Map.of());
    assertThatThrownBy(()->lifecycle.submit(p2.id(),lifecycleRequest(p2.id(),"carryover",target))).hasMessageContaining("需求仍在审批");
  }

  @Test
  void carryoverAndLiquidationCannotEraseUnfulfilledMallOrder(){
    var sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var selection=projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"));
    var v=lifecycle.preview(p.id());
    assertThat(v.liquidationBlockers()).isNotEmpty();
    assertThatThrownBy(()->lifecycle.submit(p.id(),lifecycleRequest(p.id(),"liquidation",null))).isInstanceOf(IllegalStateException.class);
    var c=lifecycle.submit(p.id(),lifecycleRequest(p.id(),"carryover",String.valueOf(Integer.parseInt(year)+1)));
    decide(c.id(),"approve");
    assertThat(jdbc.queryForObject("select amount from purchase_orders where id=?",BigDecimal.class,selection.orderId())).isEqualByComparingTo("200");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("0");
    assertThat(budget.position(tenant,dept,String.valueOf(Integer.parseInt(year)+1)).committed()).isEqualByComparingTo("246.91");
  }

  @Test
  void liquidationCannotTreatCompletedAfterSalesAsVerifiedPhysicalReturn(){
    var sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var selected=projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"));
    var line=jdbc.queryForObject("select id from order_line_items where tenant_id=? and order_id=?",String.class,tenant,selected.orderId());
    var supplier=jdbc.queryForObject("select supplier_id from purchase_orders where id=?",String.class,selected.orderId());
    String after="after-"+UUID.randomUUID();
    jdbc.update("insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,reason,status) values (?,?,?,?,?,'退货',1,'Return evidence missing','已完成')",after,tenant,selected.orderId(),line,supplier);
    assertThat(lifecycle.preview(p.id()).liquidationBlockers()).anyMatch(x->x.contains("售后单完成不等于"));
    jdbc.update("update mall_after_sales set status='已撤回' where id=?",after);
    assertThat(lifecycle.preview(p.id()).liquidationBlockers()).noneMatch(x->x.contains("售后单完成不等于"));
  }

  String[] paidProject(){
    var sku=mallSku("100");var p=approve(projects.create(draft(0))).project();var l=ready(lot(p.id(),"2"));
    var checkout=projectMall.checkout(p.id(),l.info().id(),mallRequest(l,sku,"2"));
    String invoice="invoice-"+UUID.randomUUID();
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status,invoice_no) select ?,tenant_id,supplier_id,id,amount,'部分付款',? from purchase_orders where id=?",invoice,invoice,checkout.orderId());
    String entry=paidEntry(invoice,"50");
    return new String[]{p.id(),checkout.orderId(),invoice,entry};
  }

  String paidEntry(String invoice,String amount){
    String id="entry-"+UUID.randomUUID();
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,?,?,'BANK-REFERENCE',?)",id,tenant,invoice,id,new BigDecimal(amount),author);
    return id;
  }

  String nextYear(int n){return String.valueOf(Integer.parseInt(year)+n);}
  com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request correction(String[] f,String key){return new com.procurement.finance.api.FrozenPaymentCorrectionContracts.Request(key,f[3],"BANK-CORRECTION-"+key,"原付款登记核实后整笔冲销，保留原始证据",Map.of());}
  @Test void frozenCorrectionRequiresIndependentApprovalAndRestoresCurrentResponsibility(){
    var f=paidProject();String carried=carry(f[0],1),snapshot=jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried);
    var original=jdbc.queryForMap("select * from invoice_payment_entries where id=?",f[3]);var r=corrections.submit(f[2],correction(f,"once"));
    assertThat(corrections.submit(f[2],correction(f,"once")).id()).isEqualTo(r.id());
    assertThat(workflow.listCurrentUserTasks()).noneMatch(t->r.id().equals(t.businessId()));
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("50");
    assertThatThrownBy(()->paymentLedger.reverse(f[2],f[3],new com.procurement.finance.api.ReversePaymentRequest("direct","绕过审批"))).hasMessageContaining("跨年度承接");
    decide(r.id(),"approve");
    var saved=corrections.history(f[2],1,10).items().getFirst();assertThat(saved.status()).isEqualTo("approved");assertThat(saved.completedBy()).isEqualTo(reviewer);assertThat(saved.reversalId()).isNotBlank();
    assertThat(jdbc.queryForMap("select * from invoice_payment_entries where id=?",f[3])).isEqualTo(original);
    assertThat(jdbc.queryForObject("select snapshot::text from procurement_project_lifecycle_requests where id=?",String.class,carried)).isEqualTo(snapshot);
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isZero();assertThat(budget.position(tenant,dept,year).paidAmount()).isZero();
    assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("246.91");
    assertThat(corrections.submit(f[2],correction(f,"once")).id()).isEqualTo(r.id());
    assertThatThrownBy(()->corrections.submit(f[2],correction(f,"twice"))).hasMessageContaining("已冲销");
    assertThat(lifecycle.preview(f[0]).carryoverBlockers()).isEmpty();carry(f[0],2);assertThat(budget.position(tenant,dept,nextYear(2)).committed()).isEqualByComparingTo("246.91");
  }
  @Test void frozenCorrectionRejectionWithdrawalAndNonInitiatorLeaveMoneyUnchanged(){
    var f=paidProject();carry(f[0],1);var r=corrections.submit(f[2],correction(f,"withdraw"));String withdrawalId=r.id();context(reviewer);
    assertThatThrownBy(()->corrections.withdraw(f[2],withdrawalId,"不是发起人")).hasMessageContaining("发起人");context(author);
    corrections.withdraw(f[2],r.id(),"重新核对原始依据");r=corrections.submit(f[2],correction(f,"reject"));decide(r.id(),"reject");
    assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("50");assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("50");
    assertThat(corrections.history(f[2],1,1).total()).isEqualTo(2);assertThat(corrections.history(f[2],2,1).items()).hasSize(1);
  }
  @Test void frozenCorrectionRejectsChangedPaymentEvidenceAndHardBudgetRollsBack(){
    var f=paidProject();carry(f[0],1);var r=corrections.submit(f[2],correction(f,"hard"));
    jdbc.update("insert into budget_policies(tenant_id,mode,reason,updated_by) values (?,'hard','IT',?)",tenant,author);
    jdbc.update("insert into department_budgets(id,tenant_id,department_id,period,total_amount) values (?,?,?,?,196.91)","correction-pool",tenant,dept,nextYear(1));
    String id=r.id();assertThatThrownBy(()->decide(id,"approve")).hasMessageContaining("预算不足");context(author);
    assertThat(corrections.history(f[2],1,10).items().getFirst().status()).isEqualTo("submitted");assertThat(paymentLedger.summary(f[2]).paidAmount()).isEqualByComparingTo("50");
    jdbc.update("update department_budgets set total_amount=246.91 where tenant_id=?",tenant);decide(id,"approve");assertThat(paymentLedger.summary(f[2]).paidAmount()).isZero();
  }
  @Test void frozenCorrectionCannotAcceptAChangedCurrentYearOrOtherTenant(){
    var f=paidProject();assertThatThrownBy(()->corrections.submit(f[2],correction(f,"early"))).hasMessageContaining("冻结");carry(f[0],1);var r=corrections.submit(f[2],correction(f,"stale"));
    paidEntry(f[2],"25");assertThatThrownBy(()->decide(r.id(),"approve")).hasMessageContaining("已变化");context(author);
    TenantContext.set("other",null,author);assertThatThrownBy(()->corrections.history(f[2],1,10)).isInstanceOf(RuntimeException.class);context(author);
    assertThatThrownBy(()->corrections.history(f[2],0,10)).hasMessageContaining("分页");
  }
  String carry(String project,int n){var c=lifecycle.submit(project,lifecycleRequest(project,"carryover",nextYear(n)));decide(c.id(),"approve");return c.id();}

  @Test
  void paidCarryoverConservesExpenseAcrossTwoYearsAndFreezesOriginalPayment(){
    var f=paidProject();var original=jdbc.queryForMap("select amount,created_at from purchase_orders where id=?",f[1]);
    var c=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    decide(c.id(),"approve");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("50");
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("50");
    assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("196.91");
    assertThat(budget.position(tenant,dept,nextYear(1)).orderAmount()).isEqualByComparingTo("150");
    assertThat(invoiceMapper.carriedPayment(tenant,f[2],f[3])).isTrue();
    assertThatThrownBy(()->paymentLedger.reverse(f[2],f[3],new com.procurement.finance.api.ReversePaymentRequest("frozen-key","Cannot change frozen expense"))).hasMessageContaining("跨年度承接");
    assertThat(jdbc.queryForMap("select amount,created_at from purchase_orders where id=?",f[1])).isEqualTo(original);
  }

  @Test
  void hardCarryoverChecksOnlyUnpaidTargetResponsibilityAndRollsBackInsufficientBudget(){
    var f=paidProject();var c=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));
    jdbc.update("insert into budget_policies(tenant_id,mode,reason,updated_by) values (?,'hard','IT',?)",tenant,author);
    jdbc.update("insert into department_budgets(id,tenant_id,department_id,period,total_amount) values (?,?,?,?,196.90)","pool-"+f[0],tenant,dept,nextYear(1));
    assertThatThrownBy(()->decide(c.id(),"approve")).hasMessageContaining("预算不足");context(author);
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(invoiceMapper.carriedPayment(tenant,f[2],f[3])).isFalse();
    jdbc.update("update department_budgets set total_amount=196.91 where tenant_id=?",tenant);
    decide(c.id(),"approve");
    assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("196.91");
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("50");
  }

  @Test
  void subsequentPaymentAndSecondCarryoverDoNotRefreezePriorYearExpense(){
    var f=paidProject();carry(f[0],1);var newer=paidEntry(f[2],"25");
    assertThat(invoiceMapper.carriedPayment(tenant,f[2],newer)).isFalse();
    assertThat(lifecycle.preview(f[0]).paidAmount()).isEqualByComparingTo("75");
    assertThat(budget.position(tenant,dept,nextYear(1)).paidAmount()).isEqualByComparingTo("25");
    carry(f[0],2);
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("50");
    assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("25");
    assertThat(budget.position(tenant,dept,nextYear(2)).committed()).isEqualByComparingTo("171.91");
    assertThat(lifecycle.preview(f[0]).transferAmount()).isEqualByComparingTo("171.91");
    assertThat(invoiceMapper.carriedPayment(tenant,f[2],newer)).isTrue();
    assertThat(budgetMapper.rfqPools(tenant,jdbc.queryForObject("select rfq_id from purchase_orders where id=?",String.class,f[1]))).allMatch(row->nextYear(2).equals(row.get("period")));
  }

  @Test
  void paidCarryoverRejectAndWithdrawalPreserveOriginalAllocation(){
    var f=paidProject();var c=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));
    lifecycle.withdraw(f[0],c.id(),c.revision(),"Withdraw");
    c=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));decide(c.id(),"reject");
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("246.91");
    assertThat(budget.position(tenant,dept,nextYear(1)).committed()).isEqualByComparingTo("0");
    assertThat(invoiceMapper.carriedPayment(tenant,f[2],f[3])).isFalse();
  }

  @Test
  void unknownPaidStateAndChangedPaymentIdentityCannotApproveCarryover(){
    var f=paidProject();var c=lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)));
    String replacement=paidEntry(f[2],"50");
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,reversal_of,created_by) values (?,?,?,?, -50,'REV',?,?)","rev-"+replacement,tenant,f[2],"rev-"+replacement,f[3],author);
    assertThatThrownBy(()->decide(c.id(),"approve")).hasMessageContaining("数据已变化");context(author);
    lifecycle.withdraw(f[0],c.id(),c.revision(),"Recheck evidence");
    jdbc.update("update invoices set payment_status='已付款' where id=?",f[2]);
    assertThat(lifecycle.preview(f[0]).paidAmount()).isNull();
    assertThat(lifecycle.preview(f[0]).transferAmount()).isNull();
    assertThatThrownBy(()->lifecycle.submit(f[0],lifecycleRequest(f[0],"carryover",nextYear(1)))).hasMessageContaining("无法一致核验");
  }

  @Test
  void paidAllocationSurvivesLossOfMutableSourceLinkAsHistoricalEvidence(){
    var f=paidProject();carry(f[0],1);
    jdbc.update("update purchase_demands set status='已取消' where id in (select demand_id from procurement_project_demands where tenant_id=? and project_id=?)",tenant,f[0]);
    assertThat(budget.position(tenant,dept,year).committed()).isEqualByComparingTo("50");
    assertThat(budget.position(tenant,dept,year).paidAmount()).isEqualByComparingTo("50");
  }

  @Test
  void multipleRawFiscalRowsAreGroupedBeforeSubtractingFrozenPayment(){
    var f=paidProject();carry(f[0],1);
    var first=projects.demands(f[0]).getFirst();String duplicate="demand-"+UUID.randomUUID();
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status,created_at) select ?,tenant_id,title,department_id,requester_id,budget,'已转询价',created_at+interval '1 year' from purchase_demands where id=?",duplicate,first.id());
    jdbc.update("insert into procurement_project_demands(tenant_id,project_id,demand_id,linked_by) values (?,?,?,?)",tenant,f[0],duplicate,author);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) select ?,tenant_id,rfq_id,? from purchase_orders where id=?","link-"+duplicate,duplicate,f[1]);
    var rows=lifecycle.preview(f[0]).sources();
    assertThat(rows).hasSize(2);
    assertThat(rows.stream().map(com.procurement.buyer.api.ProjectLifecycleContracts.Source::paidAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("50");
    assertThat(rows.stream().map(com.procurement.buyer.api.ProjectLifecycleContracts.Source::orderAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("200");
  }

  @Test
  void draftAmountsSnapshotsValidationAndRevisionAreReal() {
    var d = projects.create(draft(0));
    assertThat(d.project().plannedAmount()).isEqualByComparingTo("246.91");
    assertThat(d.lines().getFirst().specification()).isEqualTo("Original spec");
    assertThat(validator.validate(action(d))).isEmpty();
    assertThat(projects.options().departments()).extracting(Option::id).containsExactly(dept);
    assertThat(projects.list(1, 10, "draft", "Office").total()).isEqualTo(1);
    jdbc.update("update materials set specification='New spec' where id=?", material);
    assertThat(projects.detail(d.project().id()).lines().getFirst().specification())
        .isEqualTo("Original spec");
    projects.edit(d.project().id(), draft(d.project().revision()));
    assertThatThrownBy(() -> projects.edit(d.project().id(), draft(0)))
        .hasMessageContaining("已被修改");
    var invalid =
        new Draft(
            "Invalid",
            dept,
            author,
            year,
            "Funds",
            "Purpose",
            List.of(new LineInput("foreign-material", BigDecimal.ONE, BigDecimal.ONE, "")),
            0);
    assertThatThrownBy(() -> projects.create(invalid)).hasMessageContaining("物料不属于");
    assertThat(projects.list(1, 10, "", "").total()).isEqualTo(1);
  }

  @Test
  void initiationDoesNotReserveBudgetAndDemandApprovalPrecedesProcurement() {
    var d = approve(projects.create(draft(0)));
    assertThat(d.project().status()).isEqualTo("approved");
    assertThat(budget.position(tenant, dept, year).pending()).isEqualByComparingTo("0");
    assertThatThrownBy(() -> projects.edit(d.project().id(), draft(d.project().revision())))
        .hasMessageContaining("只能编辑");
    assertThatThrownBy(() -> attachments.requireAccess(d.project().id(), true))
        .hasMessageContaining("仅草稿");
    var linked = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    assertThat(demand.budget()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                projects.createExecution(
                    d.project().id(), new ExecutionRequest(linked.project().revision(), "rfq")))
        .hasMessageContaining("先完成");
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    var execution =
        projects.createExecution(
            d.project().id(), new ExecutionRequest(linked.project().revision(), "rfq"));
    assertThat(execution.project().executionType()).isEqualTo("rfq");
    assertThat(projects.execution(d.project().id()).canClose()).isFalse();
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                projects.createExecution(
                    d.project().id(), new ExecutionRequest(execution.project().revision(), "rfq")))
        .hasMessageContaining("已有采购执行");
    assertThatThrownBy(() -> projects.close(d.project().id(), action(execution)))
        .hasMessageContaining("尚不能结项");
  }

  @Test
  void withdrawalRejectionAndResubmissionRetainSeparateWorkflowHistory() {
    var d = projects.create(draft(0));
    var first = projects.submit(d.project().id(), action(d));
    var withdrawn = projects.withdraw(d.project().id(), action(first));
    assertThat(withdrawn.project().status()).isEqualTo("withdrawn");
    assertThat(workflow.getCurrentTenantHistory(first.project().workflowInstanceId()).status())
        .isEqualTo("cancelled");
    var second = projects.submit(d.project().id(), action(withdrawn));
    decide(d.project().id(), "reject");
    var rejected = projects.detail(d.project().id());
    assertThat(rejected.project().status()).isEqualTo("rejected");
    var approved = approve(rejected);
    assertThat(approved.project().workflowInstanceId())
        .isNotEqualTo(second.project().workflowInstanceId());
    assertThat(workflow.getCurrentTenantHistory(second.project().workflowInstanceId()).status())
        .isEqualTo("rejected");
  }

  @Test
  void legacyAndProjectEntryCompeteWithoutDeadlockOrDuplicateExecution() throws Exception {
    var d = approve(projects.create(draft(0)));
    var linked = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    var start = new java.util.concurrent.CountDownLatch(1);
    try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var tasks = new ArrayList<java.util.concurrent.Future<Boolean>>();
      for (boolean fromProject : List.of(true, false)) {
        tasks.add(
            pool.submit(
                () -> {
                  context(author);
                  try {
                    start.await();
                    if (fromProject)
                      projects.createExecution(
                          d.project().id(),
                          new ExecutionRequest(linked.project().revision(), "rfq"));
                    else rfqs.createProjectDraft("Competing legacy entry", List.of(demand.id()));
                    return true;
                  } catch (RuntimeException e) {
                    assertThat(
                            org.springframework.core.NestedExceptionUtils.getMostSpecificCause(e)
                                .getMessage()
                                .toLowerCase(Locale.ROOT))
                        .doesNotContain("deadlock");
                    return false;
                  } finally {
                    TenantContext.clear();
                  }
                }));
      }
      start.countDown();
      int winners = 0;
      for (var task : tasks) if (task.get(15, java.util.concurrent.TimeUnit.SECONDS)) winners++;
      assertThat(winners).isEqualTo(1);
    }
    assertThat(
            jdbc.queryForObject(
                "select count(*) from rfqs where tenant_id=?", Integer.class, tenant))
        .isEqualTo(1);
    assertThat(projects.detail(d.project().id()).project().executionId()).isNotBlank();
  }

  @Test
  void permissionsTenantAndCreatorScopeAreEnforcedBeforeCountsAndOptions() {
    var d = projects.create(draft(0));
    jdbc.update(
        "update roles set permissions='[\"buyer:project:read\"]'::jsonb,data_scope='self' where"
            + " id=?",
        role);
    context(reviewer);
    assertThat(projects.list(1, 10, "", "").total()).isZero();
    assertThatThrownBy(() -> projects.detail(d.project().id()))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> projects.create(draft(0)))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(projects::options)
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    TenantContext.set("other-tenant", null, author);
    assertThatThrownBy(() -> projects.detail(d.project().id()))
        .isInstanceOf(RuntimeException.class);
  }

  com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail lot(
      String project, String qty) {
    return expansion.savePackage(
        project,
        null,
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageDraft(
            projects.detail(project).project().revision(),
            0,
            "Package " + UUID.randomUUID(),
            List.of(
                new com.procurement.buyer.api.ProjectExpansionContracts.Allocation(
                    material, new BigDecimal(qty))),
            List.of()));
  }

  com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail ready(
      com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail lot) {
    var d =
        expansion.createDemand(
            lot.info().projectId(),
            lot.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                lot.info().revision(), "Generate scoped demand"));
    demands.submit(d.demands().getFirst().id(), Map.of());
    decide(d.demands().getFirst().id(), "approve");
    return expansion.packages(lot.info().projectId()).stream()
        .filter(l -> l.info().id().equals(lot.info().id()))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void packagesSplitDecimalBudgetWithTailRoundingAndCannotOverallocate() {
    var p = approve(projects.create(draft(0))).project();
    var a = lot(p.id(), "1");
    var b = lot(p.id(), "1");
    assertThat(a.info().amount()).isEqualByComparingTo("123.46");
    assertThat(b.info().amount()).isEqualByComparingTo("123.45");
    assertThat(a.info().projectRevision()).isEqualTo(1);
    assertThat(b.info().projectRevision()).isEqualTo(1);
    assertThatThrownBy(() -> lot(p.id(), "1")).hasMessageContaining("数量超过");
    assertThatThrownBy(() -> projects.createDemand(p.id(), action(projects.detail(p.id()))))
        .hasMessageContaining("分包");
    expansion.cancel(
        p.id(),
        b.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            b.info().revision(), "Cancelled before procurement"));
    assertThat(lot(p.id(), "1").info().amount()).isEqualByComparingTo("123.45");
  }

  @Test
  void eachPackageHasIndependentDemandsAndOneActiveExecutionWithoutBudgetDuplication() {
    var p = approve(projects.create(draft(0))).project();
    var a = ready(lot(p.id(), "1"));
    var b = ready(lot(p.id(), "1"));
    var ea =
        expansion.execute(
            p.id(),
            a.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                a.info().revision(), "rfq", "First"),
            false);
    var eb =
        expansion.execute(
            p.id(),
            b.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                b.info().revision(), "rfq", "Second"),
            false);
    assertThat(ea.runs().getFirst().executionId()).isNotEqualTo(eb.runs().getFirst().executionId());
    assertThat(projects.detail(p.id()).project().executionId()).isNull();
    assertThat(
            projects.execution(p.id()).documents().stream()
                .filter(d -> d.module().equals("demands")))
        .hasSize(2);
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                expansion.execute(
                    p.id(),
                    ea.info().id(),
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                        ea.info().revision(), "rfq", "duplicate"),
                    false))
        .hasMessageContaining("已有有效执行");
  }

  @Test
  void approvedChangeOnlyAppliesAfterIndependentApprovalAndKeepsExistingPackageSnapshots() {
    var p = approve(projects.create(draft(0))).project();
    var a = lot(p.id(), "1");
    p = projects.detail(p.id()).project();
    String project = p.id();
    var proposal =
        new Draft(
            "Expanded plan",
            dept,
            author,
            year,
            "Additional funds",
            "Add equipment",
            List.of(
                new LineInput(material, new BigDecimal("3"), new BigDecimal("123.4567"), "Office")),
            p.revision());
    var c =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                p.revision(), 0, "Additional approved scope", proposal));
    assertThat(projects.detail(project).project().plannedAmount()).isEqualByComparingTo("246.91");
    var pending =
        expansion.submitChange(
            project, c.id(), new Action(c.revision(), "Submit change", Map.of()));
    assertThatThrownBy(() -> lot(project, "1")).hasMessageContaining("变更审批中");
    decide(c.id(), "approve");
    assertThat(projects.detail(project).project().plannedAmount()).isEqualByComparingTo("370.37");
    assertThat(expansion.packages(project).getFirst().info().snapshot())
        .isEqualTo(a.info().snapshot());
    var b = lot(project, "1");
    assertThat(b.info().projectRevision()).isEqualTo(2);
    assertThat(allocation.tree(b.info().snapshot()).path("changeIds").toString()).contains(c.id());
    assertThatThrownBy(
            () ->
                expansion.withdrawChange(
                    project, c.id(), new Action(pending.revision() + 1, "Too late", Map.of())))
        .hasMessageContaining("已结束");
  }

  @Test
  void changeCannotReduceAllocatedQuantityOrBudgetAndRejectedAndWithdrawnFormsDoNotApply() {
    var p = approve(projects.create(draft(0))).project();
    lot(p.id(), "2");
    String project = p.id();
    p = projects.detail(project).project();
    var smaller =
        new Draft(
            "Invalid",
            dept,
            author,
            year,
            "Funds",
            "Reduce",
            List.of(new LineInput(material, BigDecimal.ONE, BigDecimal.ONE, "")),
            p.revision());
    int version = p.revision();
    assertThatThrownBy(
            () ->
                expansion.saveChange(
                    project,
                    null,
                    new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                        version, 0, "Invalid decrease", smaller)))
        .hasMessageContaining("减少");
    var valid =
        new Draft(
            "Changed title",
            dept,
            author,
            year,
            "Funds",
            "Unchanged scope",
            draft(0).lines(),
            version);
    var c =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                version, 0, "Clarify title", valid));
    var pending =
        expansion.submitChange(project, c.id(), new Action(c.revision(), "Submit", Map.of()));
    decide(c.id(), "reject");
    assertThat(projects.detail(project).project().title()).isEqualTo("Office renewal");
    var rejected = expansion.change(project, c.id(), false);
    var again =
        expansion.submitChange(
            project, c.id(), new Action(rejected.revision(), "Resubmit", Map.of()));
    assertThat(again.workflowInstanceId()).isNotEqualTo(pending.workflowInstanceId());
    expansion.withdrawChange(project, c.id(), new Action(again.revision(), "Withdraw", Map.of()));
    assertThat(projects.detail(project).project().revision()).isEqualTo(version);
  }

  @Test
  void approvedChangePreservesLegacyExecutionSnapshotAndAllowsAdditionalPackages() {
    var d = approve(projects.create(draft(0)));
    d = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    d =
        projects.createExecution(
            d.project().id(), new ExecutionRequest(d.project().revision(), "rfq"));
    String project = d.project().id(), rfq = d.project().executionId();
    String before =
        com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.hash(
            projectGuard.archiveDefinitionForRfq(rfq));
    var proposal =
        new Draft(
            "Legacy plus new scope",
            dept,
            author,
            year,
            "Funds",
            "More equipment",
            List.of(
                new LineInput(material, new BigDecimal("3"), new BigDecimal("123.4567"), "Office")),
            d.project().revision());
    var change =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                d.project().revision(), 0, "Extend scope", proposal));
    expansion.submitChange(project, change.id(), new Action(change.revision(), "Submit", Map.of()));
    decide(change.id(), "approve");
    assertThat(
            com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.hash(
                projectGuard.archiveDefinitionForRfq(rfq)))
        .isEqualTo(before);
    assertThat(lot(project, "1").info().amount()).isEqualByComparingTo("123.46");
  }

  @Test
  void reworkReleasesExposureRetainsApprovalAndRequiresFreshApproval() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("123.46");
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Revise procurement plan"),
        true);
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
    var h = closeout.history(p.id(), 1, 10);
    assertThat(h.items().getFirst().snapshot()).contains("已通过");
    assertThat(h.items().getFirst().releasedAmount()).isEqualByComparingTo("123.46");
    assertThat(
            jdbc.queryForObject(
                "select status from workflow_business_instances where tenant_id=? and"
                    + " business_type='purchase_demand'",
                String.class,
                tenant))
        .isEqualTo("approved");
    String demand = l.demands().getFirst().id();
    demands.submit(demand, Map.of());
    decide(demand, "approve");
    var fresh = expansion.packages(p.id()).getFirst();
    expansion.execute(
        p.id(),
        fresh.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
            fresh.info().revision(), "rfq", "Fresh approval obtained"),
        false);
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("123.46");
    assertThatThrownBy(
            () ->
                closeout.adjust(
                    p.id(),
                    fresh.info().id(),
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                        fresh.info().revision(), "Stale click"),
                    false))
        .hasMessageContaining("变化");
  }

  @Test
  void pendingDemandReworkUsesRealInitiatorWithdrawalAndRollsBackForOthers() {
    var p = approve(projects.create(draft(0))).project();
    var l = lot(p.id(), "1");
    l =
        expansion.createDemand(
            p.id(),
            l.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                l.info().revision(), "Generate"));
    String lotId = l.info().id();
    int revision = l.info().revision();
    String demand = l.demands().getFirst().id();
    demands.submit(demand, Map.of());
    context(reviewer);
    assertThatThrownBy(
            () ->
                closeout.adjust(
                    p.id(),
                    lotId,
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                        revision, "Wrong initiator"),
                    true))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThat(closeout.history(p.id(), 1, 10).total()).isZero();
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("审批中");
    context(author);
    closeout.adjust(
        p.id(),
        lotId,
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            revision, "Withdraw and recompile"),
        true);
    assertThat(
            jdbc.queryForObject(
                "select status from workflow_business_instances where tenant_id=? and"
                    + " business_type='purchase_demand'",
                String.class,
                tenant))
        .isEqualTo("cancelled");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
  }

  @Test
  void approvedUnpurchasedPackageCanStopAndReleaseAllocationWithoutDeletingHistory() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Procurement no longer needed"),
        false);
    assertThat(expansion.packages(p.id()).getFirst().info().status()).isEqualTo("cancelled");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("已取消");
    assertThat(closeout.monitor(p.id()).packages().getFirst().milestones())
        .allMatch(m -> !m.complete() && !m.overdue());
    assertThat(expansion.summary(p.id()).demandAmount()).isEqualByComparingTo("0");
    assertThat(lot(p.id(), "2").info().amount()).isEqualByComparingTo("246.91");
    assertThatThrownBy(() -> demands.submit(l.demands().getFirst().id(), Map.of()))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void concurrentApprovalAndReworkPreserveStateWithoutDeadlock() throws Exception {
    var p=approve(projects.create(draft(0))).project();var l=lot(p.id(),"1");
    var linked=expansion.createDemand(p.id(),l.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(l.info().revision(),"Generate concurrent demand"));
    String demand=linked.demands().getFirst().id();demands.submit(demand,Map.of());context(reviewer);
    String task=workflow.listCurrentUserTasks().stream().filter(t->t.businessId().equals(demand)).findFirst().orElseThrow().taskId();context(author);
    var barrier=new java.util.concurrent.CountDownLatch(1);
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
      var edit=pool.submit(()->{context(author);try{barrier.await();closeout.adjust(p.id(),linked.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(linked.info().revision(),"Concurrent rework"),true);return true;}catch(RuntimeException e){assertThat(e).isNotInstanceOf(org.springframework.dao.DataAccessException.class);assertThat(e.getMessage()).doesNotContainIgnoringCase("deadlock");return false;}finally{TenantContext.clear();}});
      var approval=pool.submit(()->{context(reviewer);try{barrier.await();workflow.completeCurrentUserTask(task,new CompleteWorkflowTaskRequest("approve","Concurrent review"));return true;}catch(RuntimeException e){assertThat(e).isNotInstanceOf(org.springframework.dao.DataAccessException.class);assertThat(e.getMessage()).doesNotContainIgnoringCase("deadlock");return false;}finally{TenantContext.clear();}});
      barrier.countDown();boolean edited=edit.get(15,java.util.concurrent.TimeUnit.SECONDS),approved=approval.get(15,java.util.concurrent.TimeUnit.SECONDS);assertThat(edited||approved).isTrue();
      String state=projects.demands(p.id()).getFirst().status();assertThat(state).isIn("草稿","已通过");if(edited)assertThat(state).isEqualTo("草稿");assertThat(budget.position(tenant,dept,year).occupied()).isEqualByComparingTo("草稿".equals(state)?BigDecimal.ZERO:linked.info().amount());
    }
  }

  @Test
  void planHasActualEvidenceOverdueDetectionPaginationAndOptimisticVersions() {
    var p = approve(projects.create(draft(0))).project();
    var l = lot(p.id(), "1");
    for (int n = 0; n < 12; n++) {
      var row = expansion.packages(p.id()).getFirst();
      closeout.plan(
          p.id(),
          row.info().id(),
          new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
              row.info().revision(),
              "demand",
              LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(1),
              "Plan revision " + n));
    }
    assertThat(closeout.history(p.id(), 2, 10).items()).hasSize(2);
    assertThat(closeout.history(p.id(), 1, 10).total()).isEqualTo(12);
    assertThat(closeout.monitor(p.id()).overdueCount()).isEqualTo(1);
    assertThatThrownBy(
            () ->
                closeout.plan(
                    p.id(),
                    l.info().id(),
                    new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
                        l.info().revision(), "close", LocalDate.now(), "Stale")))
        .hasMessageContaining("变化");
    var current = expansion.packages(p.id()).getFirst();
    assertThatThrownBy(
            () ->
                closeout.plan(
                    p.id(),
                    current.info().id(),
                    new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
                        current.info().revision(),
                        "order",
                        LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(2),
                        "Invalid sequence")))
        .hasMessageContaining("先后顺序");
    ready(expansion.packages(p.id()).getFirst());
    assertThat(closeout.monitor(p.id()).overdueCount()).isZero();
    assertThat(closeout.monitor(p.id()).packages().getFirst().milestones().getFirst().complete())
        .isTrue();
  }

  @Test
  void projectTerminationCancelsOnlyUnpurchasedScopeAndHasDownloadableAuditArchive()
      throws Exception {
    var p = approve(projects.create(draft(0))).project();
    ready(lot(p.id(), "1"));
    lot(p.id(), "1");
    assertThatThrownBy(() -> closeout.download(p.id())).hasMessageContaining("仅已结项");
    var fresh = projects.detail(p.id());
    var change =
        expansion.saveChange(
            p.id(),
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                fresh.project().revision(),
                0,
                "Unsubmitted change",
                draft(fresh.project().revision())));
    assertThatThrownBy(() -> projects.terminate(p.id(), action(fresh))).hasMessageContaining("先处理");
    expansion.withdrawChange(
        p.id(), change.id(), new Action(change.revision(), "Withdraw draft", Map.of()));
    projects.terminate(p.id(), action(fresh));
    assertThat(projects.detail(p.id()).project().status()).isEqualTo("terminated");
    assertThatThrownBy(() -> changeAttachments.requireAccess(change.id(), true))
        .hasMessageContaining("项目已结束");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
    assertThat(expansion.packages(p.id())).allMatch(l -> "cancelled".equals(l.info().status()));
    var names = new ArrayList<String>();
    try (var zip =
        new java.util.zip.ZipInputStream(
            new java.io.ByteArrayInputStream(closeout.download(p.id())),
            java.nio.charset.StandardCharsets.UTF_8)) {
      java.util.zip.ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) names.add(entry.getName());
    }
    assertThat(names).contains("项目.json", "调整历史.json", "审批历史.json", "SHA256SUMS.txt");
    assertThatThrownBy(() -> projects.terminate(p.id(), action(projects.detail(p.id()))))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void projectDemandSubmissionCannotExceedPackageOrChangeDepartmentAfterRework() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Rework"),
        true);
    String id = l.demands().getFirst().id();
    jdbc.update("update purchase_demands set budget=500 where tenant_id=? and id=?", tenant, id);
    assertThatThrownBy(() -> demands.submit(id, Map.of())).hasMessageContaining("超过分包");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    jdbc.update("update roles set permissions='[\"buyer:project:read\"]'::jsonb where id=?", role);
    assertThatThrownBy(() -> closeout.monitor(p.id()))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }

  @Test
  void existingUnexecutedProjectDemandCanBeAdoptedByPackageWithoutRecreation() {
    var d = approve(projects.create(draft(0)));
    d = projects.createDemand(d.project().id(), action(d));
    var source = projects.demands(d.project().id()).getFirst();
    var adopted =
        expansion.savePackage(
            d.project().id(),
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageDraft(
                d.project().revision(),
                0,
                "Adopt historical demand",
                List.of(
                    new com.procurement.buyer.api.ProjectExpansionContracts.Allocation(
                        material, new BigDecimal("2"))),
                List.of(source.id())));
    assertThat(adopted.demands()).extracting(Demand::id).containsExactly(source.id());
    assertThat(projects.demands(d.project().id())).hasSize(1);
  }
}
