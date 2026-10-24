package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.procurement.supplier.application.*;
import com.procurement.supplier.api.*;
import com.procurement.supplier.api.QualificationWorkflowContracts.*;
import com.procurement.supplier.infrastructure.QualificationWorkflowMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.process.api.*;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class QualificationWorkflowIT {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",DB::getJdbcUrl);r.add("spring.datasource.username",DB::getUsername);r.add("spring.datasource.password",DB::getPassword);r.add("keycloak.enabled",()->false);r.add("app.seed.locations",()->"");}
  @Autowired JdbcTemplate jdbc;
  @Autowired QualificationWorkflowService changes;
  @Autowired QualificationWorkflowMapper mapper;
  @Autowired SupplierQualificationApplicationService qualifications;
  @Autowired QualificationNotificationService notices;
  @Autowired UnifiedWorkflowApplicationService workflow;
  @Autowired ProcessDefinitionApplicationService definitions;
  @Autowired SupplierImportService imports;
  @Autowired com.procurement.identity.application.BuyerUserApplicationService users;
  @MockBean ObjectStorageService storage;
  final Map<String,ObjectStorageService.StoredObject> files=new HashMap<>();
  String tenant,foreign,supplier,relation,buyer,reviewer,second,role,department,supplierUser;
  LocalDate today=LocalDate.now(ZoneId.of("Asia/Shanghai"));
  @BeforeEach void seed(){
    String id=UUID.randomUUID().toString();tenant="qual-it-"+id;foreign="foreign-"+id;supplier="supplier-"+id;relation="relation-"+id;buyer="author-"+id;reviewer="reviewer-"+id;second="second-"+id;role="role-"+id;department="department-"+id;supplierUser="supplier-user-"+id;
    for(String t:List.of(tenant,foreign))jdbc.update("insert into tenants(id,name,plan,status) values (?,?,'starter','active')",t,t);
    jdbc.update("insert into enterprises(id,name,type,verified) values (?,?,'supplier',true)",supplier,supplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','普通')",relation,tenant,supplier);
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,?,'active')",department,tenant,department);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values (?,?,'buyer','SRM','[\"buyer:*\"]','all')",role,tenant);
    for(String u:List.of(buyer,reviewer,second)){jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,?,'active',?)",u,tenant,u,department);jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",u,role);}
    jdbc.update("insert into users(id,supplier_id,name,status) values (?,?,?,'active')",supplierUser,supplier,supplierUser);
    String supplierRole="supplier-role-"+id;jdbc.update("insert into roles(id,scope,name,permissions,data_scope) values (?,'supplier','资质','[\"supplier:*\"]','all')",supplierRole);jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",supplierUser,supplierRole);
    when(storage.get(anyString())).thenAnswer(a->files.get(a.getArgument(0)));
    doAnswer(a->{files.put(a.getArgument(0),new ObjectStorageService.StoredObject(a.getArgument(1),a.getArgument(2)));return null;}).when(storage).put(anyString(),any(byte[].class),anyString());
    buyer();publish(2);
  }
  @AfterEach void clear(){TenantContext.clear();}
  void buyer(){TenantContext.set(tenant,null,buyer);}
  void supplier(){TenantContext.set(null,supplier,supplierUser);}
  void publish(int steps){
    var def=definitions.createProcess(new CreateProcessDefinitionRequest("资质变更多级审批","","file-text","supplier_qualification_change"));
    String flow="{\"steps\":["+java.util.stream.IntStream.range(0,steps).mapToObj(i->"{\"id\":\"review"+i+"\",\"type\":\"approver\",\"title\":\"第"+(i+1)+"级核验\",\"assignment\":{\"type\":\"role\",\"roleId\":\""+role+"\"}}").collect(java.util.stream.Collectors.joining(","))+"]}";
    definitions.updateProcess(def.id(),new UpdateProcessDefinitionRequest(def.name(),"","draft","{\"fields\":[{\"id\":\"basis\",\"type\":\"text\",\"label\":\"核验依据\",\"required\":true}]}",flow,"supplier_qualification_change"));definitions.publishProcess(def.id());
  }
  SupplierQualificationResponse upload(String previous){
    supplier();String name="原件-"+UUID.randomUUID()+".pdf";
    var ticket=qualifications.createUploadTicket(new CreateQualificationUploadTicketRequest(name));
    qualifications.storeObject(ticket.storageKey(),("%PDF-1.4\n"+name+"\n%%EOF").getBytes(java.nio.charset.StandardCharsets.UTF_8),"application/pdf");
    var request=new CreateSupplierQualificationRequest("营业执照",UUID.randomUUID().toString(),today.plusYears(1),name,ticket.storageKey());
    return previous==null?qualifications.createCurrentSupplierQualification(request):qualifications.replaceQualification(previous,request);
  }
  long review(String qualification){return jdbc.queryForObject("select id from supplier_qualification_reviews where relation_id=? and qualification_id=?",Long.class,relation,qualification);}
  Attempt start(long review){buyer();return changes.start(review,new StartReview("换证核验依据",Map.of("basis","工商登记原件")));}
  void decide(Attempt a,String user,String action){TenantContext.set(tenant,null,user);var task=workflow.listCurrentUserTasks().stream().filter(t->t.businessId().equals(a.id())).findFirst().orElseThrow();workflow.completeCurrentUserTask(task.taskId(),new CompleteWorkflowTaskRequest(action,"核对新旧原件后"+action));}
  String status(long review){return jdbc.queryForObject("select status from supplier_qualification_reviews where id=?",String.class,review);}
  @Test void configurableNodesPreserveOriginalsAndOnlyFinalApprovalChangesReview(){
    var old=upload(null);var next=upload(old.id());long r=review(next.id());buyer();
    assertThatThrownBy(()->changes.start(r,new StartReview("缺少表单",Map.of()))).hasMessageContaining("核验依据");
    assertThat(mapper.count(tenant,r,com.procurement.identity.domain.DataScope.unrestricted())).isZero();
    var a=start(r);assertThatThrownBy(()->changes.start(r,new StartReview("重复",Map.of("basis","核验")))).hasMessageContaining("在审");
    assertThatThrownBy(()->qualifications.review(r,new QualificationReviewRequest(true,"绕过"))).hasMessageContaining("统一审批");
    decide(a,reviewer,"approve");assertThat(status(r)).isEqualTo("pending");
    decide(a,second,"approve");assertThat(status(r)).isEqualTo("approved");
    assertThat(mapper.find(tenant,a.id()).status()).isEqualTo("completed");
    buyer();var history=workflow.getCurrentTenantHistory(a.workflowInstanceId());assertThat(history.events().stream().filter(e->"approved".equals(e.action())).count()).isEqualTo(2);
    assertThat(qualifications.findForBuyerReview(supplier,old.id()).status()).isEqualTo("inactive");assertThat(qualifications.loadObject(qualifications.findForBuyerReview(supplier,old.id())).data()).isNotEmpty();
  }
  @Test void supersededMaterialCannotAdvanceEvenAnIntermediateNodeAndCanBeCancelled(){
    var old=upload(null);var next=upload(old.id());long r=review(next.id());var a=start(r);upload(next.id());
    assertThatThrownBy(()->decide(a,reviewer,"approve")).hasMessageContaining("已替代");
    buyer();changes.cancel(a.id(),"新版材料已更新");assertThat(mapper.find(tenant,a.id()).status()).isEqualTo("cancelled");assertThat(status(r)).isEqualTo("superseded");
  }
  @Test void supplementaryDocumentsRoundTripThroughRejectionAndApproval(){
    var old=upload(null);buyer();var task=changes.request(new SupplementDraft(relation,old.id(),"证照临期，请补充有效原件",today.plusDays(5)));
    assertThat(jdbc.queryForObject("select count(*) from notifications where recipient_id=? and title='资质补件通知'",Integer.class,supplierUser)).isEqualTo(1);
    var next=upload(old.id());supplier();changes.reply(task.id(),new SupplementReply(next.id(),"已换证",task.revision()));
    var first=start(review(next.id()));decide(first,reviewer,"reject");
    var returned=mapper.supplement(task.id());assertThat(returned.status()).isEqualTo("returned");
    var corrected=upload(next.id());supplier();
    assertThatThrownBy(()->changes.reply(task.id(),new SupplementReply(corrected.id(),"旧版本提交",0))).hasMessageContaining("状态已变化");
    changes.reply(task.id(),new SupplementReply(corrected.id(),"补正原件",returned.revision()));
    var finalAttempt=start(review(corrected.id()));decide(finalAttempt,reviewer,"approve");decide(finalAttempt,second,"approve");
    assertThat(mapper.supplement(task.id()).status()).isEqualTo("closed");
  }
  @Test void expiredOrCorruptDocumentsCannotBeApprovedAndOtherTenantsCannotSubmit(){
    var old=upload(null);var next=upload(old.id());var a=start(review(next.id()));
    TenantContext.set(foreign,null,buyer);assertThatThrownBy(()->changes.start(review(next.id()),new StartReview("越权",Map.of("basis","no")))).hasMessageContaining("当前企业");
    jdbc.update("update supplier_qualifications set expires_at=? where id=?",today.minusDays(1),next.id());
    assertThatThrownBy(()->decide(a,reviewer,"approve")).hasMessageContaining("已过期");decide(a,reviewer,"reject");assertThat(status(review(next.id()))).isEqualTo("rejected");
    var corrected=upload(next.id());var fresh=start(review(corrected.id()));files.put(corrected.storageKey(),new ObjectStorageService.StoredObject(new byte[]{1,2,3},"application/pdf"));
    assertThatThrownBy(()->decide(fresh,reviewer,"approve")).hasMessageContaining("完整性");decide(fresh,reviewer,"reject");
  }
  @Test void anotherReplacementReturnsSubmittedSupplementInsteadOfLeavingItStuck(){
    var old=upload(null);buyer();var task=changes.request(new SupplementDraft(relation,old.id(),"更新有效执照",today.plusDays(5)));
    var next=upload(old.id());supplier();changes.reply(task.id(),new SupplementReply(next.id(),"第一版补件",0));
    var latest=upload(next.id());assertThat(mapper.supplement(task.id()).status()).isEqualTo("returned");
    supplier();changes.reply(task.id(),new SupplementReply(latest.id(),"已重新关联最新版",mapper.supplement(task.id()).revision()));assertThat(mapper.supplement(task.id()).replacementId()).isEqualTo(latest.id());
  }
  @Test void actualCandidatesAndDataScopesProtectEveryApprovalAttempt(){
    var old=upload(null);var next=upload(old.id());var a=start(review(next.id()));
    String user="outsider-"+UUID.randomUUID(),newRole="outside-role-"+UUID.randomUUID();
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,?,'active')",user,tenant,user);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values (?,?,'buyer','其他部门','[\"buyer:*\"]','all')",newRole,tenant);jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",user,newRole);
    TenantContext.set(tenant,null,reviewer);var task=workflow.listCurrentUserTasks().stream().filter(t->t.businessId().equals(a.id())).findFirst().orElseThrow();
    TenantContext.set(tenant,null,user);assertThat(workflow.listCurrentUserTasks()).isEmpty();
    assertThatThrownBy(()->workflow.completeCurrentUserTask(task.taskId(),new CompleteWorkflowTaskRequest("approve","越权"))).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    jdbc.update("update roles set data_scope='department' where id=?",newRole);
    assertThat(changes.history(review(next.id()),1,20).total()).isZero();
    assertThatThrownBy(()->workflow.getCurrentTenantHistory(a.workflowInstanceId())).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }
  @Test void reminderPhasesAreIdempotentAndDoNotChangeCooperation(){
    var old=upload(null);buyer();var task=changes.request(new SupplementDraft(relation,old.id(),"补件提醒核验",today));
    notices.remindExpiry(today);notices.remindExpiry(today);
    assertThat(jdbc.queryForObject("select count(*) from notifications where title='资质补件期限提醒' and recipient_id=?",Integer.class,supplierUser)).isEqualTo(1);
    notices.remindExpiry(today.plusDays(1));assertThat(jdbc.queryForObject("select count(*) from notifications where title='资质补件期限提醒' and recipient_id=?",Integer.class,supplierUser)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select status from buyer_supplier_relations where id=?",String.class,relation)).isEqualTo("已准入");
    buyer();changes.cancelSupplement(task.id(),new SupplementCancel("无需重复补件",task.revision()));assertThat(mapper.supplement(task.id()).status()).isEqualTo("cancelled");
  }
  @Test void supplierImportReportsFailuresAndNeverApprovesOrUpdatesPublicProfiles(){
    String extra="extra-"+UUID.randomUUID();jdbc.update("insert into enterprises(id,name,type,verified) values (?,?,'supplier',true)",extra,"可导入供应商");buyer();
    var headers=com.procurement.common.excel.ExcelSheets.readFirstSheet(imports.template(),201).getFirst();
    byte[] bytes=com.procurement.common.excel.ExcelSheets.template("供应商",headers,List.of(List.of(extra,"普通","通用采购;办公用品","张老师","13800000000","a@example.com","供应服务"),List.of(extra,"普通","通用采购","","","",""),List.of("不存在","普通","通用采购","","","","")));
    var result=imports.importFile(bytes);assertThat(result.successCount()).isEqualTo(1);assertThat(result.failures()).hasSize(2);assertThat(result.totalRows()).isEqualTo(3);
    assertThat(jdbc.queryForObject("select status from buyer_supplier_relations where tenant_id=? and supplier_id=?",String.class,tenant,extra)).isEqualTo("待准入");
    assertThat(jdbc.queryForObject("select name from enterprises where id=?",String.class,extra)).isEqualTo("可导入供应商");
  }
  @Test void memberMaintenanceAllowsAnOptionalBlankJobTitle(){
    buyer();users.updateUser(buyer,new com.procurement.identity.api.UpdateBuyerUserRequest("资质管理员",null,null,department,role,null,null));
    assertThat(jdbc.queryForObject("select job_title from users where id=?",String.class,buyer)).isEmpty();
  }
}
