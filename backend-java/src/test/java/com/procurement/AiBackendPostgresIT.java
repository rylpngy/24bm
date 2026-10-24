package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.api.*;
import com.procurement.ai.api.AiReviewDtos.*;
import com.procurement.ai.application.*;
import com.procurement.ai.infrastructure.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import java.util.List;
import java.nio.charset.StandardCharsets;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.*;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.ibatis.datasource.pooled.PooledDataSource;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.aop.framework.ProxyFactory;
import com.procurement.demand.application.DemandAiSubjectAdapter;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.api.PurchaseDemandResponse;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicInteger;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
class AiBackendPostgresIT {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:16-alpine");
  static PooledDataSource data;
  static SqlSessionFactory sessions;
  static JdbcTemplate jdbc;
  SqlSession session;
  ObjectMapper json=new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
  PermissionService permissions=mock(PermissionService.class);
  AuditLogApplicationService audit=mock(AuditLogApplicationService.class);
  AiPolicyApplicationService policies;
  AiReviewApplicationService reviews;
  @BeforeAll static void schema() throws Exception {
    data=new PooledDataSource("org.postgresql.Driver",DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()); jdbc=new JdbcTemplate(data);
    jdbc.execute("create table tenants(id text primary key); create table users(id text primary key)");
    jdbc.execute("insert into tenants values('a'),('b'); insert into users values('u')");
    jdbc.execute("create table ai_capture_fixture(id text primary key, value integer); insert into ai_capture_fixture values('case',1)");
    try(var in=new ClassPathResource("db/migration/V230__generic_ai_evidence_policies_feedback.sql").getInputStream()) {
      jdbc.execute(new String(in.readAllBytes(),StandardCharsets.UTF_8));
    }
    var config=new Configuration(new Environment("test",new JdbcTransactionFactory(),data)); config.setMapUnderscoreToCamelCase(true);
    config.addMapper(AiReviewMapper.class); config.addMapper(AiPolicyMapper.class); sessions=new SqlSessionFactoryBuilder().build(config);
  }
  @BeforeEach void setup() {
    TenantContext.set("a",null,"u"); session=sessions.openSession(false);
    policies=new AiPolicyApplicationService(session.getMapper(AiPolicyMapper.class),permissions,audit,json);
    var adapters=AiContracts.SUBJECT_TYPES.stream().map(type -> new AiSubjectAdapter() {
      public String subjectType() { return type; }
      public void authorize(String id) { if(!"subject".equals(id)) throw new PermissionDeniedException("scope"); }
      public Snapshot capture(String id) { authorize(id); return AiSupport.snapshot(List.of(type,id),
          List.of(AiSupport.field("field","业务字段","待补充",id,"hash")),
          List.of(AiSupport.finding("finding","warning","材料待补充","请人工核对材料。","field")),List.of()); }
    }).map(AiSubjectAdapter.class::cast).toList();
    reviews=new AiReviewApplicationService(adapters,session.getMapper(AiReviewMapper.class),permissions,audit,json,
        new OpenAiCompatibleGateway(json,false,"","",""),policies,new AiReviewPersistence(session.getMapper(AiReviewMapper.class),audit));
  }
  @AfterEach void cleanup() { session.rollback(); session.close(); TenantContext.clear(); }
  @Test void fourHttpEntriesPersistEvidenceHistoryAndFeedbackWithoutBusinessWrites() throws Exception {
    MockMvc http=MockMvcBuilders.standaloneSetup(new AiReviewController(reviews,policies)).setControllerAdvice(new AiExceptionHandler()).build();
    for(String type:AiContracts.SUBJECT_TYPES) {
      var result=http.perform(post("/api/v1/buyer/ai/reviews").contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsBytes(new CreateReview(type,"subject",null))))
          .andExpect(status().isOk()).andExpect(jsonPath("$.data.mode").value("RULE_ASSISTED"))
          .andExpect(jsonPath("$.data.evidence[0].locator").value("field")).andReturn();
      String runId=json.readTree(result.getResponse().getContentAsByteArray()).path("data").path("runId").asText();
      http.perform(get("/api/v1/buyer/ai/reviews").param("subjectType",type).param("subjectId","subject"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].runId").value(runId));
      http.perform(post("/api/v1/buyer/ai/reviews/"+runId+"/feedback").contentType(MediaType.APPLICATION_JSON)
          .content("{\"findingId\":\"finding\",\"disposition\":\"adopted\"}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.data.feedback[0].createdBy").value("u"));
      session.clearCache();
      assertThat(reviews.detail(runId).feedback()).hasSize(1);
      assertThatThrownBy(() -> reviews.feedback(runId,new SubmitFeedback("fake","adopted",null))).isInstanceOf(IllegalArgumentException.class);
      TenantContext.set("b",null,"u"); assertThatThrownBy(() -> reviews.detail(runId)).isInstanceOf(IllegalArgumentException.class);
      TenantContext.set("a",null,"u");
    }
    verify(audit,times(4)).recordCurrentTenantAction(eq("ai.review.generated"),eq("ai_review"),any(),any());
  }
  @Test void immutablePolicyVersionsPublishRetireAndRemainTenantScoped() {
    var draft=policies.create(new CreatePolicy("purchase","企业采购制度",List.of("demand"),List.of(new Clause("c1","资料完整性","由人工复核资料完整性。")),0));
    assertThat(draft.version()).isEqualTo(1); assertThat(policies.published("demand")).isEmpty();
    assertThat(policies.publish(draft.id()).status()).isEqualTo("published");
    var second=policies.create(new CreatePolicy("purchase","企业采购制度",List.of("demand"),List.of(new Clause("c1","资料完整性","新增验收资料，仍由人工核验。")),1));
    policies.publish(second.id()); session.clearCache();
    assertThat(policies.detail(draft.id()).status()).isEqualTo("retired");
    assertThat(policies.published("demand")).extracting(Policy::version).containsExactly(2);
    policies.retire(second.id()); session.clearCache(); assertThat(policies.published("demand")).isEmpty();
    TenantContext.set("b",null,"u"); assertThat(policies.list()).isEmpty();
    assertThatThrownBy(() -> policies.detail(second.id())).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void databaseProtectsImmutableEvidenceAndCompositeTenantFeedback() {
    var run=reviews.create(new CreateReview("demand","subject",null)); session.commit();
    assertThatThrownBy(() -> jdbc.update("update ai_review_runs set payload='{}' where id=?",run.runId()))
        .hasMessageContaining("immutable");
    assertThatThrownBy(() -> jdbc.update("insert into ai_review_feedback(id,tenant_id,run_id,finding_id,reviewer_id,disposition) values('bad','b',?,'finding','u','adopted')",run.runId()))
        .hasMessageContaining("foreign key");
  }
  @Test void sourceCaptureIsConsistentAndSecondCaptureSeesCommittedChangesDespiteOuterTransaction() {
    var business=mock(PurchaseDemandApplicationService.class); AtomicInteger calls=new AtomicInteger();
    when(business.getCurrentTenantDemand("d")).thenAnswer(invocation -> {
      assertThat(jdbc.queryForObject("show transaction_isolation",String.class)).isEqualTo("repeatable read");
      assertThat(jdbc.queryForObject("show transaction_read_only",String.class)).isEqualTo("on");
      int before=jdbc.queryForObject("select value from ai_capture_fixture where id='case'",Integer.class);
      if(calls.incrementAndGet()==1) try(var connection=data.getConnection(); var statement=connection.createStatement()) {
        statement.executeUpdate("update ai_capture_fixture set value=2 where id='case'");
      }
      assertThat(jdbc.queryForObject("select value from ai_capture_fixture where id='case'",Integer.class)).isEqualTo(before);
      return new PurchaseDemandResponse("d","a","需求","dept","u",BigDecimal.valueOf(before),"草稿",null,null,List.of(),null,"normal","用途",null,null,"manual");
    });
    var manager=new DataSourceTransactionManager(data);
    var proxy=new ProxyFactory(new DemandAiSubjectAdapter(business)); proxy.setProxyTargetClass(true);
    proxy.addAdvice(new TransactionInterceptor(manager,new AnnotationTransactionAttributeSource()));
    var adapter=(DemandAiSubjectAdapter)proxy.getProxy();
    new TransactionTemplate(manager).execute(status -> {
      var first=adapter.capture("d"); var second=adapter.capture("d");
      assertThat(first.sourceRevision()).isNotEqualTo(second.sourceRevision()); return null;
    });
  }
  @Test void concurrentDifferentPolicyKeysCannotExceedTheTenantVersionCap() throws Exception {
    String tenant="version-cap"; jdbc.update("insert into tenants values(?)",tenant);
    for(int i=0;i<199;i++) seedPolicy(tenant,"version-seed-"+i,"retired","demand");
    var proxy=transactionalPolicies();
    var results=concurrentPolicies(tenant,() -> proxy.create(new CreatePolicy("left","制度",List.of("demand"),List.of(new Clause("c1","条款","正文")),0)),
        () -> proxy.create(new CreatePolicy("right","制度",List.of("demand"),List.of(new Clause("c1","条款","正文")),0)));
    assertThat(results).containsExactlyInAnyOrder("ok","conflict");
    assertThat(jdbc.queryForObject("select count(*) from ai_policies where tenant_id=?",Integer.class,tenant)).isEqualTo(200);
    TenantContext.set(tenant,null,"u"); assertThat(proxy.list()).hasSize(200);
  }
  @Test void subjectFilteringPrecedesLimitsAndPublicationAllowsOnlyOneFinalSlot() throws Exception {
    String tenant="publication-cap"; jdbc.update("insert into tenants values(?)",tenant);
    for(int i=0;i<49;i++) seedPolicy(tenant,"demand-seed-"+i,"published","demand");
    for(int i=0;i<3;i++) seedPolicy(tenant,"attachment-seed-"+i,"published","attachment");
    var proxy=transactionalPolicies(); TenantContext.set(tenant,null,"u");
    assertThat(proxy.published("attachment")).hasSize(3); assertThat(proxy.published("demand")).hasSize(49);
    var left=proxy.create(new CreatePolicy("left","制度",List.of("demand"),List.of(new Clause("c1","条款","正文")),0));
    var right=proxy.create(new CreatePolicy("right","制度",List.of("demand"),List.of(new Clause("c1","条款","正文")),0));
    var results=concurrentPolicies(tenant,() -> proxy.publish(left.id()),() -> proxy.publish(right.id()));
    assertThat(results).containsExactlyInAnyOrder("ok","conflict");
    assertThat(proxy.published("demand")).hasSize(50); assertThat(proxy.published("attachment")).hasSize(3);
    var replacement=proxy.create(new CreatePolicy("demand-seed-0","制度新版",List.of("demand"),List.of(new Clause("c1","条款","新正文")),1));
    proxy.publish(replacement.id()); assertThat(proxy.published("demand")).hasSize(50);
  }
  private void seedPolicy(String tenant,String key,String status,String type) throws Exception {
    String content=json.writeValueAsString(java.util.Map.of("subjectTypes",List.of(type),"clauses",List.of(new Clause("c1","条款","正文"))));
    String hash=AiSupport.revision(java.util.Map.of("key",key,"version",1,"title","制度","content",content));
    jdbc.update("insert into ai_policies(id,tenant_id,policy_key,version,title,content,status,source_hash,created_by) values(?,?,?,1,'制度',?,?,?,'u')",
        tenant+"-"+key,tenant,key,content,status,hash);
  }
  private AiPolicyApplicationService transactionalPolicies() {
    var configuration=new Configuration(new Environment("spring-test",new org.mybatis.spring.transaction.SpringManagedTransactionFactory(),data));
    configuration.setMapUnderscoreToCamelCase(true); configuration.addMapper(AiPolicyMapper.class);
    var factory=new SqlSessionFactoryBuilder().build(configuration);
    var template=new org.mybatis.spring.SqlSessionTemplate(factory);
    var target=new AiPolicyApplicationService(template.getMapper(AiPolicyMapper.class),permissions,audit,json);
    var proxy=new ProxyFactory(target); proxy.setProxyTargetClass(true);
    proxy.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(data),new AnnotationTransactionAttributeSource()));
    return (AiPolicyApplicationService)proxy.getProxy();
  }
  private List<String> concurrentPolicies(String tenant,java.util.concurrent.Callable<Policy> left,
      java.util.concurrent.Callable<Policy> right) throws Exception {
    var start=new java.util.concurrent.CountDownLatch(1);
    try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var futures=new java.util.ArrayList<java.util.concurrent.Future<String>>();
      for(var operation:List.of(left,right)) futures.add(executor.submit(() -> {
        TenantContext.set(tenant,null,"u");
        try { start.await(); operation.call(); return "ok"; }
        catch(AiConflictException expected) { return "conflict"; }
        finally { TenantContext.clear(); }
      }));
      start.countDown(); return List.of(futures.get(0).get(15,java.util.concurrent.TimeUnit.SECONDS),futures.get(1).get(15,java.util.concurrent.TimeUnit.SECONDS));
    }
  }
}
