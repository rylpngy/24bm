package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.supplier.api.PerformanceTaskRequests.*;
import com.procurement.supplier.application.PerformanceTaskApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class PerformanceTaskIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired PerformanceTaskApplicationService service;
  @Autowired com.procurement.supplier.application.SupplierEvaluationApplicationService evaluations;
  final LocalDate due = LocalDate.now().plusDays(10);

  @BeforeEach void seed() {
    jdbc.update("insert into tenants(id,name,plan,status) values ('pta','Buyer A','starter','active'),('ptb','Buyer B','starter','active') on conflict do nothing");
    jdbc.update("insert into enterprises(id,name,type) values ('pts','Supplier','supplier'),('ptother','Other','supplier') on conflict do nothing");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('ptra','pta','pts','admitted','B'),('ptrb','ptb','pts','admitted','B') on conflict do nothing");
    jdbc.update("insert into users(id,tenant_id,name,status) values ('ptu','pta','Assignee','active'),('ptmanager','pta','Manager','active'),('ptreader','pta','Reader','active'),('ptinactive','pta','Inactive','inactive'),('ptbu','ptb','Other tenant','active') on conflict do nothing");
    jdbc.update("insert into users(id,supplier_id,name,status) values ('ptsu','pts','Supplier user','active'),('ptou','ptother','Other supplier','active') on conflict do nothing");
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values ('ptrole','pta','buyer','Manager','[\"buyer:supplier:manage\",\"buyer:supplier:read\"]'),('ptread','pta','buyer','Read','[\"buyer:supplier:read\"]'),('ptbrole','ptb','buyer','Manager','[\"buyer:*\"]'),('ptsrole',null,'supplier','Supplier','[\"supplier:profile:read\",\"supplier:profile:manage\"]') on conflict do nothing");
    jdbc.update("insert into user_roles(user_id,role_id) values ('ptu','ptrole'),('ptmanager','ptrole'),('ptinactive','ptrole'),('ptreader','ptread'),('ptbu','ptbrole'),('ptsu','ptsrole'),('ptou','ptsrole') on conflict do nothing");
    buyer("ptu");
  }
  @AfterEach void clear() { TenantContext.clear(); }
  void buyer(String user) { TenantContext.set("pta", null, user); }
  void supplier() { TenantContext.set(null, "pts", "ptsu"); }
  Evaluate scores() { return new Evaluate(new BigDecimal("80"),new BigDecimal("90"),new BigDecimal("70"),new BigDecimal("60"),"Evaluation comment"); }

  @Test void fullLifecyclePreservesRoundsAndIsolation() {
    assertThat(service.assignees("ptra")).extracting(a -> a.id()).containsExactlyInAnyOrder("ptu","ptmanager");
    assertThatThrownBy(() -> service.create("ptra",new Create("2026-Q1","ptbu",due))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create("ptra",new Create("2026-Q1","ptinactive",due))).isInstanceOf(IllegalArgumentException.class);
    var task = service.create("ptra",new Create(" 2026-q1 ","ptu",due));
    String id = task.id();
    assertThat(task.period()).isEqualTo("2026-Q1");
    assertThat(task.buyerName()).isEqualTo("Buyer A");
    assertThatThrownBy(() -> service.create("ptra",new Create("2026-Q1","ptu",due))).isInstanceOf(IllegalStateException.class);
    buyer("ptmanager");
    assertThatThrownBy(() -> service.evaluate("ptra",id,scores())).isInstanceOf(PermissionDeniedException.class);
    buyer("ptreader");
    assertThatThrownBy(() -> service.create("ptra",new Create("2026-Q2","ptu",due))).isInstanceOf(PermissionDeniedException.class);
    TenantContext.set("ptb",null,"ptbu");
    assertThatThrownBy(() -> service.evaluate("ptra",id,scores())).isInstanceOf(IllegalArgumentException.class);
    assertThat(service.listBuyer("ptrb")).isEmpty();
    supplier();
    assertThat(service.listSupplier()).extracting(t -> t.id()).doesNotContain(id);
    assertThatThrownBy(() -> service.respond(id,new Response("premature",0L))).isInstanceOf(IllegalArgumentException.class);
    buyer("ptu");
    assertThatThrownBy(() -> service.evaluate("ptra",id,new Evaluate(new BigDecimal("101"),BigDecimal.TEN,BigDecimal.TEN,BigDecimal.TEN,"bad"))).isInstanceOf(IllegalArgumentException.class);
    assertThat(service.listBuyer("ptra").stream().filter(t -> t.id().equals(id)).findFirst().orElseThrow().status()).isEqualTo("assigned");
    var evaluated = service.evaluate("ptra",id,scores());
    assertThat(evaluated.status()).isEqualTo("evaluated");
    assertThat(evaluated.totalScore()).isEqualByComparingTo("78");
    assertThat(evaluated.evaluationId()).startsWith("eval-");
    assertThatThrownBy(() -> service.evaluate("ptra",id,scores())).isInstanceOf(IllegalStateException.class);
    supplier();
    assertThat(service.listSupplier()).extracting(t -> t.id()).doesNotContain(id);
    buyer("ptmanager");
    assertThatThrownBy(() -> service.requestRemediation("ptra",id,new Remediation("Improve",LocalDate.now().minusDays(1)))).isInstanceOf(IllegalArgumentException.class);
    service.requestRemediation("ptra",id,new Remediation("Improve delivery",due));
    TenantContext.set(null,"ptother","ptou");
    assertThat(service.listSupplier()).isEmpty();
    assertThatThrownBy(() -> service.respond(id,new Response("intrusion",2L))).isInstanceOf(IllegalArgumentException.class);
    supplier();
    assertThat(service.listSupplier()).extracting(t -> t.id()).contains(id);
    service.respond(id,new Response("First response",2L));
    assertThatThrownBy(() -> service.respond(id,new Response("duplicate",2L))).isInstanceOf(IllegalStateException.class);
    buyer("ptmanager");
    assertThatThrownBy(() -> service.review("ptra",id,new Review(false," ",3L))).isInstanceOf(IllegalArgumentException.class);
    assertThat(service.review("ptra",id,new Review(false,"More evidence required",3L)).status()).isEqualTo("remediation_requested");
    supplier();
    service.respond(id,new Response("Second response",4L));
    buyer("ptmanager");
    var closed = service.review("ptra",id,new Review(true,"Verified",5L));
    assertThat(closed.status()).isEqualTo("closed");
    assertThat(closed.history()).extracting(e -> e.action()).containsExactly("assigned","evaluated","remediation_requested","remediation_submitted","remediation_rejected","remediation_submitted","closed");
    assertThat(closed.history()).extracting(e -> e.comment()).contains("First response","More evidence required","Second response","Verified");
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id='pta' and target_id=? and action like 'supplier_performance_task.%'",Integer.class,id)).isEqualTo(7);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id='pta' and target_id=? and actor_id='ptsu'",Integer.class,id)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from supplier_evaluations where id=?",Integer.class,closed.evaluationId())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select cooperation_tier from buyer_supplier_relations where id='ptra'",String.class)).isEqualTo("合格");
    supplier();
    assertThatThrownBy(() -> service.respond(id,new Response("late",6L))).isInstanceOf(IllegalStateException.class);
  }

  @Test void concurrentEvaluationCommitsExactlyOnce() throws Exception {
    String id = service.create("ptra",new Create("2027","ptu",due)).id();
    try (var pool = Executors.newFixedThreadPool(2)) {
      CountDownLatch start = new CountDownLatch(1);
      Callable<Boolean> action = () -> {
        buyer("ptu");
        try {
          start.await();
          service.evaluate("ptra",id,scores());
          return true;
        } catch (IllegalStateException expected) { return false; }
        finally { TenantContext.clear(); }
      };
      var one = pool.submit(action);
      var two = pool.submit(action);
      start.countDown();
      assertThat(java.util.List.of(one.get(30,TimeUnit.SECONDS),two.get(30,TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(true,false);
    }
    assertThat(jdbc.queryForObject("select count(*) from supplier_evaluations where tenant_id='pta' and period='2027'",Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from supplier_performance_task_events where task_id=? and action='evaluated'",Integer.class,id)).isEqualTo(1);
  }

  @Test void freeFormEvaluationAndAssignmentsCannotStrandEachOther() {
    var score = new BigDecimal("80");
    var existing = new com.procurement.supplier.api.CreateSupplierEvaluationRequest(
        "2028",score,score,score,score,"Existing evaluation");
    evaluations.createEvaluation("ptra",existing);
    assertThatThrownBy(() -> service.create("ptra",new Create("2028","ptu",due)))
        .isInstanceOf(IllegalStateException.class);
    var task = service.create("ptra",new Create("2029","ptu",due));
    assertThatThrownBy(() -> evaluations.createEvaluation("ptra",
        new com.procurement.supplier.api.CreateSupplierEvaluationRequest(" 2029 ",score,score,score,score,"Bypass")))
        .isInstanceOf(IllegalStateException.class);
    assertThat(service.evaluate("ptra",task.id(),scores()).status()).isEqualTo("evaluated");
  }

  @Test void concurrentFreeFormAndTaskCreationReservePeriodAtomically() throws Exception {
    try (var pool = Executors.newFixedThreadPool(2)) {
      CountDownLatch start = new CountDownLatch(1);
      var task = pool.submit(() -> {
        buyer("ptu");
        try { start.await(); service.create("ptra",new Create("2031","ptu",due)); return true; }
        catch (IllegalStateException expected) { return false; }
        finally { TenantContext.clear(); }
      });
      var evaluation = pool.submit(() -> {
        buyer("ptu");
        try {
          start.await();
          var score = new BigDecimal("80");
          evaluations.createEvaluation("ptra",new com.procurement.supplier.api.CreateSupplierEvaluationRequest(
              "2031",score,score,score,score,"Free form"));
          return true;
        } catch (IllegalStateException expected) { return false; }
        finally { TenantContext.clear(); }
      });
      start.countDown();
      assertThat(java.util.List.of(task.get(30,TimeUnit.SECONDS),evaluation.get(30,TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(true,false);
    }
  }

  @Test void whitespaceVariantsCannotBypassReservationsOrCompletedEvaluations() {
    var score = new BigDecimal("80");
    String id = service.create("ptra",new Create("2032-Q1","ptu",due)).id();
    String[] variants = {"\t2032-Q1\n", "\r2032-q1\t", " 2032-Q1 ", "\u30002032-Q1\u2003"};
    for (String period : variants) {
      assertThatThrownBy(() -> evaluations.createEvaluation("ptra",
          new com.procurement.supplier.api.CreateSupplierEvaluationRequest(period,score,score,score,score,"Bypass")))
          .isInstanceOf(IllegalStateException.class);
    }
    service.evaluate("ptra",id,scores());
    for (String period : variants) {
      assertThatThrownBy(() -> evaluations.createEvaluation("ptra",
          new com.procurement.supplier.api.CreateSupplierEvaluationRequest(period,score,score,score,score,"Duplicate")))
          .isInstanceOf(IllegalStateException.class);
    }
    var canonical = evaluations.createEvaluation("ptra",
        new com.procurement.supplier.api.CreateSupplierEvaluationRequest("\t2033-q1\n",score,score,score,score,"Canonical"));
    assertThat(canonical.period()).isEqualTo("2033-Q1");
    for (String period : new String[]{"", "2033-Q5", "2033-13", "2033-1", "2033\t-Q1"}) {
      assertThatThrownBy(() -> evaluations.createEvaluation("ptra",
          new com.procurement.supplier.api.CreateSupplierEvaluationRequest(period,score,score,score,score,"Invalid")))
          .isInstanceOf(IllegalArgumentException.class);
    }
    // Seed historical rows only in the disposable container, without rewriting any old data.
    String whitespace = "\t\n\u000b\f\r\u001c\u001d\u001e\u001f \u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200a\u2028\u2029\u205f\u3000";
    jdbc.update("insert into supplier_evaluations(id,tenant_id,supplier_id,period,quality_score,delivery_score,price_score,service_score,total_score,suggested_tier) values ('legacy-whitespace','pta','pts',?,80,80,80,80,80,'合格')",whitespace + "2034-q2" + whitespace);
    assertThatThrownBy(() -> service.create("ptra",new Create("2034-Q2","ptu",due))).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> evaluations.createEvaluation("ptra",
        new com.procurement.supplier.api.CreateSupplierEvaluationRequest("2034-Q2",score,score,score,score,"Duplicate legacy")))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test void staleFirstRoundReviewCannotCloseResubmittedSecondRound() {
    var task = service.create("ptra",new Create("2036","ptu",due));
    String id = task.id();
    assertThat(task.version()).isZero();
    assertThat(service.evaluate("ptra",id,scores()).version()).isEqualTo(1);
    var requested = service.requestRemediation("ptra",id,new Remediation("Improve",due));
    assertThat(requested.version()).isEqualTo(2);
    supplier();
    var first = service.respond(id,new Response("Round one",requested.version()));
    assertThat(first.version()).isEqualTo(3);
    buyer("ptmanager");
    var rejected = service.review("ptra",id,new Review(false,"Needs evidence",first.version()));
    assertThat(rejected.version()).isEqualTo(4);
    supplier();
    assertThatThrownBy(() -> service.respond(id,new Response("Stale response",requested.version())))
        .isInstanceOf(IllegalStateException.class);
    assertThat(service.listSupplier().stream().filter(t -> t.id().equals(id)).findFirst().orElseThrow().history()).hasSize(5);
    var second = service.respond(id,new Response("Round two",rejected.version()));
    buyer("ptmanager");
    assertThatThrownBy(() -> service.review("ptra",id,new Review(true,"Stale approval",first.version())))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> service.review("ptra",id,new Review(false,"Stale rejection",first.version())))
        .isInstanceOf(IllegalStateException.class);
    var unchanged = service.listBuyer("ptra").stream().filter(t -> t.id().equals(id)).findFirst().orElseThrow();
    assertThat(unchanged.status()).isEqualTo("remediation_submitted");
    assertThat(unchanged.response()).isEqualTo("Round two");
    assertThat(unchanged.version()).isEqualTo(5);
    assertThat(unchanged.history()).hasSize(6);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action like 'supplier_performance_task.%'",Integer.class,id)).isEqualTo(6);
    var closed = service.review("ptra",id,new Review(true,"Current approval",second.version()));
    assertThat(closed.status()).isEqualTo("closed");
    assertThat(closed.version()).isEqualTo(6);
  }
}
